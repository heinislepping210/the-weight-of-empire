// Resumable turn resolution (§3.4) on the fixed turn timeline (§3.4a).
//
// Where resolution stands is part of the GameState. `advance` applies one player input, then runs
// stages until the next point that needs the player. Nothing here waits on the UI or keeps hidden
// state outside the GameState, so a saved pause can be resumed exactly.

import { decideNightfall, decideRound } from './ai';
import { updateIntel } from './intel';
import { updatePressure } from './russian';
import { fallBack, oncoming, resolveNightfall, resolveRound, retreatNodeFor } from './battle';
import { ISSUE_ORDER, capacityGrams, issueTarget, takenUp, usableWagons, weightGrams, withinCapacity } from './carriage';
import { lineOfRetreatBlocked } from './outcome';
import { edgeBetween, neighboursOf, roadDistance, shortestPath, type EdgeDef } from './graph';
import { chance, drawBetween } from './rng';
import type { Context } from './scenario';
import { ROUNDS_PER_SLOT, dayIndex, isAfternoon, nextDaylight, slotIndex } from './time';
import type {
  Activity,
  BattleState,
  Convoy,
  Depot,
  Encounter,
  Force,
  ForceId,
  GameState,
  Input,
  LogEntry,
  LogisticsOrders,
  NightChoice,
  NodeId,
  RoundAction,
  Side,
  Slot,
  Stage,
  Status,
  Transit,
} from './types';
import { addInto, emptySupplies, enemyPresent, fatiguePermille, loseMen, must, note, otherSide, setPosture, sortedValues } from './util';

export type AdvanceResult =
  | { ok: true; state: GameState; status: Status; log: LogEntry[] }
  | { ok: false; reason: string };

type RunStage = Exclude<Stage, 'orders'>;

const PACES = ['rest', 'steady', 'forced'];
const ENGAGEMENTS = ['seek', 'accept', 'avoid'];
const POSTURES = ['dispersed', 'concentrated'];
const ROUND_ACTIONS = ['press', 'hold', 'withdraw'];
const NIGHT_CHOICES = ['stay', 'withdraw'];

// ---------------------------------------------------------------------------------------- API

export function statusOf(s: GameState): Status {
  if (s.ended) return { kind: 'ended', ending: s.ended };
  if (s.resolution.stage === 'orders') return { kind: 'awaitingOrders', turn: s.resolution.turn };
  const b = waitingBattle(s);
  if (!b || !b.awaiting) return { kind: 'resolving' };
  const round = b.awaiting === 'deploy' ? 0 : b.awaiting === 'round' ? b.roundsFought + 1 : b.roundsFought;
  return { kind: 'awaitingBattleInput', battleId: b.id, step: b.awaiting, round };
}

/** The only way the game moves forward. Pure: the input state is never modified. */
export function advance(state: GameState, input: Input, ctx: Context): AdvanceResult {
  const submitted = submit(state, input, ctx);
  if (!submitted.ok) return submitted;
  runUntilPause(submitted.state, ctx, submitted.log);
  return { ok: true, state: submitted.state, status: statusOf(submitted.state), log: submitted.log };
}

/** Validates and applies an input without resolving further. Used by stage-by-stage tests and tools. */
export function submit(state: GameState, input: Input, ctx: Context): AdvanceResult {
  const reason = validate(state, input, ctx);
  if (reason !== null) return { ok: false, reason };
  const s = structuredClone(state);
  const log: LogEntry[] = [];
  applyInput(s, input, ctx, log);
  return { ok: true, state: s, status: statusOf(s), log };
}

/** Runs exactly one stage, unless the game is at a pause. */
export function stepOnce(state: GameState, ctx: Context): { state: GameState; log: LogEntry[] } {
  const s = structuredClone(state);
  const log: LogEntry[] = [];
  if (!isPaused(s)) STAGES[s.resolution.stage as RunStage](s, ctx, log);
  return { state: s, log };
}

// ------------------------------------------------------------------------------ pause logic

function waitingBattle(s: GameState): BattleState | undefined {
  return sortedValues(s.battles).find((b) => b.awaiting !== null);
}

function isPaused(s: GameState): boolean {
  return s.ended !== null || s.resolution.stage === 'orders' || waitingBattle(s) !== undefined;
}

function runUntilPause(s: GameState, ctx: Context, log: LogEntry[]): void {
  for (let guard = 0; !isPaused(s); guard++) {
    if (guard > 100_000) throw new Error('turn resolution made no progress');
    STAGES[s.resolution.stage as RunStage](s, ctx, log);
  }
}

// --------------------------------------------------------------------------------- inputs

function validate(s: GameState, input: Input, ctx: Context): string | null {
  const status = statusOf(s);
  if (status.kind === 'ended') return 'the campaign has ended';

  if (input.kind === 'orders') {
    if (status.kind !== 'awaitingOrders') return 'the game is not waiting for orders';
    if (input.turn !== status.turn) return `these orders are for turn ${input.turn}, but it is turn ${status.turn}`;
    const seen = new Set<ForceId>();
    for (const o of input.orders) {
      const f = s.forces[o.force];
      if (!f || f.side !== 'fr') return `unknown French force ${o.force}`;
      if (seen.has(o.force)) return `two orders for ${f.name}`;
      seen.add(o.force);
      if (o.pace !== undefined && !PACES.includes(o.pace)) return `unknown pace ${o.pace}`;
      if (o.engagement !== undefined && !ENGAGEMENTS.includes(o.engagement)) return `unknown engagement stance ${o.engagement}`;
      if (o.posture !== undefined && !POSTURES.includes(o.posture)) return `unknown posture ${o.posture}`;
      if (o.posture === 'dispersed' && f.battle !== null) return `${f.name} is engaged in battle and cannot disperse`;
      if (o.route === undefined) continue;
      const stopped = o.route.length === 0 || (f.transit !== null && o.route.length === 1 && o.route[0] === f.transit.to);
      if ((s.halted || input.halt) && !stopped) return 'the army has halted for the season and cannot march on';
      if (f.battle !== null) return `${f.name} is engaged in battle and cannot take movement orders`;
      if (f.transit && o.route[0] !== f.transit.to) return `${f.name} is on the road and must first reach ${f.transit.to}`;
      let prev = f.transit ? f.transit.to : f.at;
      for (const node of f.transit ? o.route.slice(1) : o.route) {
        if (!edgeBetween(ctx.graph, prev, node)) return `there is no road from ${prev} to ${node}`;
        prev = node;
      }
    }
    return input.logistics ? validateLogistics(s, ctx, input.logistics) : null;
  }

  if (status.kind !== 'awaitingBattleInput') return 'no battle is waiting for a decision';
  if (input.battleId !== status.battleId || input.round !== status.round) return 'this decision is for a different battle or round';
  const d = input.decision;
  if (d.kind !== 'delegate' && d.kind !== status.step) return `a ${status.step} decision is expected`;
  if (d.kind === 'round' && !ROUND_ACTIONS.includes(d.action)) return `unknown battle action ${d.action}`;
  if (d.kind === 'nightfall' && !NIGHT_CHOICES.includes(d.choice)) return `unknown nightfall choice ${d.choice}`;
  return null;
}

function validateLogistics(s: GameState, ctx: Context, lg: LogisticsOrders): string | null {
  const ours = new Set(sortedValues(s.depots).filter((d) => d.side === 'fr').map((d) => d.node));
  if (lg.foundDepot !== undefined) {
    const site = lg.foundDepot;
    if (!ctx.graph.nodes.has(site)) return `unknown place ${site}`;
    if (s.depots[site]) return `there is already a depot at ${site}`;
    const held = sortedValues(s.forces).some((f) => f.side === 'fr' && f.men > 0 && f.transit === null && f.at === site);
    if (!held || enemyPresent(s, 'fr', site)) return 'a depot can only be founded where French troops hold the ground';
    ours.add(site);
  }
  const seen = new Set<string>();
  for (const o of lg.convoys ?? []) {
    const c = s.convoys[o.convoy];
    if (!c || c.side !== 'fr') return `unknown French wagon train ${o.convoy}`;
    if (seen.has(o.convoy)) return `two orders for wagon train ${o.convoy}`;
    seen.add(o.convoy);
    if (!ours.has(o.home)) return 'a wagon train can only be based at a French depot';
    if ((o.serves === undefined) === (o.feeds === undefined)) return 'a wagon train supplies either a force or a depot';
    if (o.serves !== undefined && s.forces[o.serves]?.side !== 'fr') return `unknown French force ${o.serves}`;
    if (o.feeds !== undefined && !ours.has(o.feeds)) return 'a line train can only stock a French depot';
  }
  return null;
}

function applyLogistics(s: GameState, lg: LogisticsOrders, log: LogEntry[]): void {
  if (lg.foundDepot !== undefined) {
    s.depots[lg.foundDepot] = { node: lg.foundDepot, side: 'fr', stock: emptySupplies(), incoming: emptySupplies() };
    note(s, log, 'depotFounded', { node: lg.foundDepot });
  }
  for (const o of lg.convoys ?? []) {
    const c = must(s.convoys[o.convoy], o.convoy);
    c.home = o.home;
    c.serves = o.serves ?? null;
    c.feeds = o.feeds ?? null;
    // A train waiting at its old depot sets off for the new one; one on the road finishes its errand first.
    if (c.leg === 'loading' && (c.at !== c.home || c.transit !== null)) c.leg = 'returning';
  }
}

function applyInput(s: GameState, input: Input, ctx: Context, log: LogEntry[]): void {
  if (input.kind === 'orders') {
    for (const o of input.orders) {
      const f = must(s.forces[o.force], o.force);
      if (o.route !== undefined) f.route = [...o.route];
      if (o.pace !== undefined) f.pace = o.pace;
      if (o.engagement !== undefined) f.engagement = o.engagement;
      if (o.posture !== undefined) setPosture(f, o.posture, ctx.rules);
    }
    if (input.logistics) applyLogistics(s, input.logistics, log);
    if (input.halt && !s.halted) {
      s.halted = true;
      // Final for every group, ordered this turn or not: those on the road finish only the stretch they are on.
      for (const f of sortedValues(s.forces)) if (f.side === 'fr' && f.battle === null) f.route = f.transit ? [f.transit.to] : [];
      note(s, log, 'halt');
    }
    // The Russians re-plan only at the start of a turn, as the player does (§3.4).
    ctx.russianCommand(s, ctx, log);
    note(s, log, 'orders', { count: input.orders.length });
    s.resolution.stage = 'activity';
    return;
  }

  const b = must(s.battles[input.battleId], input.battleId);
  const step = b.awaiting;
  b.awaiting = null;
  const d = input.decision;
  if (step === 'deploy') {
    // Rounds begin at the next daylight sub-step; the deployment happens at this boundary (§3.4a step 4).
    b.phase = 'rounds';
    b.startsAt = nextDaylight(s.resolution);
    note(s, log, 'deployed', { battle: b.id });
  } else if (step === 'round') {
    const fr: RoundAction = d.kind === 'round' ? d.action : decideRound(s, b, 'fr');
    const ru = b.hidden as RoundAction;
    b.hidden = null;
    resolveRound(s, ctx, b, { fr, ru }, log);
  } else if (step === 'nightfall') {
    const fr: NightChoice = d.kind === 'nightfall' ? d.choice : decideNightfall(s, b, 'fr');
    const ru = b.hidden as NightChoice;
    b.hidden = null;
    resolveNightfall(s, ctx, b, { fr, ru }, log);
  }
}

// --------------------------------------------------------------------------------- stages

function stageActivity(s: GameState, ctx: Context, log: LogEntry[]): void {
  const res = s.resolution;
  if (res.slot === 0 || res.slot === 2) {
    // Weather is scenario randomness, keyed only by the day: the same for everyone on a seed (§2.12).
    s.rainToday = chance(s.seed, ['weather', dayIndex(res)], ctx.rules.weather.rainPermille);
    if (s.rainToday) note(s, log, 'rain');
  }
  res.battleSeq = 0;
  for (const b of sortedValues(s.battles)) b.roundsThisSlot = 0;
  for (const f of sortedValues(s.forces)) {
    f.movedThisSlot = false;
    f.arrivedAt = null;
    // A dispersed force must assemble before it can march (§2.4b).
    if (f.posture === 'dispersed' && f.gathering === 0 && f.battle === null && f.pace !== 'rest' && nextEdgeOf(ctx, f)) {
      f.gathering = ctx.rules.posture.gatherSlots;
    }
    f.activity = activityFor(ctx, f);
    if (f.activity === 'march' || f.activity === 'cross') leaveBehind(s, ctx, f, log);
  }
  res.stage = 'movement';
}

/**
 * A force can hold any amount in camp but marches only with what its men and horse-drawn wagons can
 * carry (G-019). The rest goes back into its own depot if it stands at one; otherwise it is abandoned.
 */
function leaveBehind(s: GameState, ctx: Context, f: Force, log: LogEntry[]): void {
  const { kept, dropped } = withinCapacity(f.stock, capacityGrams(f, ctx.rules), ctx.rules);
  if (weightGrams(dropped, ctx.rules) === 0) return;
  f.stock = kept;
  const depot = f.transit === null ? s.depots[f.at] : undefined;
  const toDepot = depot !== undefined && depot.side === f.side;
  addInto(toDepot ? depot.stock : s.ledger.abandoned, dropped);
  note(s, log, 'leftBehind', { force: f.id, food: dropped.food, fodder: dropped.fodder, ammo: dropped.ammo, depot: toDepot ? f.at : null });
}

function nextEdgeOf(ctx: Context, f: Force): EdgeDef | undefined {
  const next = f.route[0];
  return f.transit ? ctx.graph.edges.get(f.transit.edge) : next !== undefined ? edgeBetween(ctx.graph, f.at, next) : undefined;
}

/** Exactly one activity per force per sub-step (§3.4a step 2). */
function activityFor(ctx: Context, f: Force): Activity {
  if (f.battle !== null) return 'fight';
  if (f.gathering > 0) return 'gather';
  if (f.men <= 0 || f.pace === 'rest') return 'halt';
  const edge = nextEdgeOf(ctx, f);
  if (!edge) return 'halt';
  return edge.crossing === 'ford' || edge.crossing === 'pontoon' ? 'cross' : 'march';
}

/** Hourly shares of a sub-step's march: forces move together, an hour at a time (§3.4a step 3). */
export const HOURS_PER_SLOT = 6;

/** A force's share of its sub-step's march budget in hour `hour`. */
export function hourlyShare(total: number, hour: number): number {
  return Math.floor((total * (hour + 1)) / HOURS_PER_SLOT) - Math.floor((total * hour) / HOURS_PER_SLOT);
}

/** A force's march budget for a sub-step, set by its pace and its fatigue at the start (§3.4a step 3). */
export function marchBudget(f: Force, rules: Context['rules']): number {
  return Math.floor((rules.march.metresPerSlot[f.pace] * fatiguePermille(f.fatigue, rules)) / 1000);
}

function stageMovement(s: GameState, ctx: Context, log: LogEntry[]): void {
  const movers = sortedValues(s.forces).filter((f) => f.activity === 'march' || f.activity === 'cross');
  // The march budget is set by each force's condition at the start of the sub-step.
  const budgets = movers.map((f) => marchBudget(f, ctx.rules));
  for (let hour = 0; hour < HOURS_PER_SLOT; hour++) marchHour(s, ctx, movers, budgets.map((total) => hourlyShare(total, hour)), hour, log);
  // A column that could not move at all (held up on the road, or too exhausted) rests instead.
  for (const f of movers) if (!f.movedThisSlot) f.activity = 'halt';
  for (const c of sortedValues(s.convoys)) moveConvoy(s, ctx, c, log);
  s.resolution.stage = 'contacts';
}

function stageContacts(s: GameState, ctx: Context, log: LogEntry[]): void {
  const res = s.resolution;
  if (res.encounterQueue === null) {
    joinReinforcements(s, ctx, log);
    res.encounterQueue = findEncounters(s);
  }
  while (res.encounterQueue.length > 0) {
    const enc = res.encounterQueue.shift() as Encounter;
    if (resolveEncounter(s, ctx, enc, log)) return; // pause: the player deploys
  }
  res.encounterQueue = null;
  res.stage = 'battleRounds';
}

function stageBattleRounds(s: GameState, _ctx: Context, _log: LogEntry[]): void {
  const now = slotIndex(s.resolution);
  for (const b of sortedValues(s.battles)) {
    if (b.phase !== 'rounds' || slotIndex(b.startsAt) > now || b.roundsThisSlot >= ROUNDS_PER_SLOT) continue;
    b.awaiting = 'round';
    b.hidden = decideRound(s, b, 'ru');
    return; // pause: the player decides this round
  }
  s.resolution.stage = 'accrual';
}

function stageAccrual(s: GameState, ctx: Context, log: LogEntry[]): void {
  const { fatigue, convoy, gramsPerUnit } = ctx.rules;
  for (const f of sortedValues(s.forces)) {
    const moving = f.activity === 'march' || f.activity === 'cross';
    forage(s, ctx, f);
    // Deliveries made during this sub-step join the stock only now (§3.4a step 6).
    addInto(f.stock, f.incoming);
    f.incoming = emptySupplies();
    const resting = f.activity === 'halt' || f.activity === 'gather';
    const change = moving ? (f.pace === 'forced' ? fatigue.marchForced : fatigue.marchSteady) : resting ? fatigue.halt : 0;
    f.fatigue = Math.max(0, Math.min(1000, f.fatigue + change));
    if (moving) f.marchedToday = true;
    if (f.gathering > 0) {
      f.gathering -= 1;
      if (f.gathering === 0) f.posture = 'concentrated';
    }
  }
  issueFromDepots(s, ctx);
  for (const d of sortedValues(s.depots)) {
    addInto(d.stock, d.incoming);
    d.incoming = emptySupplies();
  }
  for (const c of sortedValues(s.convoys)) {
    const depot = s.depots[c.home];
    if (c.leg !== 'loading' || c.at !== c.home || !depot || depot.side !== c.side) continue;
    if (!deliveryOf(s, c)) {
      // Standing idle at home: anything still on the wagons goes back into the depot.
      addInto(depot.stock, c.cargo);
      c.cargo = emptySupplies();
      continue;
    }
    // Loads are limited by weight: a wagon carries far fewer days of fodder than of bread (L-004),
    // and only wagons with their draught horses are loaded (G-019).
    const payload = usableWagons(c.wagons, c.horses, ctx.rules) * convoy.payloadGrams;
    for (const kind of ['food', 'fodder', 'ammo'] as const) {
      const fits = Math.max(0, Math.floor((payload * convoy.loadPermille[kind]) / 1000 / gramsPerUnit[kind]) - c.cargo[kind]);
      const amount = Math.min(fits, depot.stock[kind]);
      depot.stock[kind] -= amount;
      c.cargo[kind] += amount;
    }
    c.leg = 'outbound';
    note(s, log, 'loaded', { convoy: c.id, food: c.cargo.food, fodder: c.cargo.fodder, ammo: c.cargo.ammo });
  }
  captureDepots(s, ctx, log);
  trackCutOff(s, ctx, log);
  const res = s.resolution;
  if (isAfternoon(res.slot)) res.stage = 'night';
  else {
    res.slot = (res.slot + 1) as Slot;
    res.stage = 'activity';
  }
}

function stageNight(s: GameState, ctx: Context, log: LogEntry[]): void {
  const res = s.resolution;
  const day = dayIndex(res);
  for (const b of sortedValues(s.battles)) {
    if (b.phase === 'rounds' && b.roundsFought > 0 && b.lastNight !== day) {
      b.awaiting = 'nightfall';
      b.hidden = decideNightfall(s, b, 'ru');
      return; // pause: stay or withdraw (§3.4a night step 4)
    }
  }
  for (const f of sortedValues(s.forces)) consume(s, ctx, f, log);
  for (const c of sortedValues(s.convoys)) feedConvoy(s, ctx, c, log);
  for (const id of Object.keys(s.roads).sort()) s.roads[id] = s.rainToday ? 'mud' : 'dry';
  if (res.slot === 3) res.stage = 'endOfTurn';
  else {
    res.slot = 2;
    res.stage = 'activity';
  }
}

function stageEndOfTurn(s: GameState, ctx: Context, log: LogEntry[]): void {
  // Events join here once that system is built.
  updatePressure(s, ctx, log);
  updateIntel(s, ctx);
  const next = s.resolution.turn + 1;
  if (next > ctx.scenario.turns) {
    s.ended = 'scenarioEnd';
    note(s, log, 'ended');
    return;
  }
  s.resolution = { turn: next, slot: 0, stage: 'orders', encounterQueue: null, battleSeq: 0 };
}

const STAGES: Record<RunStage, (s: GameState, ctx: Context, log: LogEntry[]) => void> = {
  activity: stageActivity,
  movement: stageMovement,
  contacts: stageContacts,
  battleRounds: stageBattleRounds,
  accrual: stageAccrual,
  night: stageNight,
  endOfTurn: stageEndOfTurn,
};

// --------------------------------------------------------------------------------- supply

function forageKind(a: Activity): 'halt' | 'gather' | 'march' | null {
  if (a === 'halt' || a === 'gather') return a;
  if (a === 'march' || a === 'cross') return 'march';
  return null;
}

/**
 * Gathering from the countryside (§2.6). A halted, dispersed force gathers more, and reaches the
 * neighbouring districts within its foragers' reach too, except where the enemy stands (G-019): a
 * neighbouring district begins about half-way along the road. Everyone else uses their own district.
 */
function forage(s: GameState, ctx: Context, f: Force): void {
  const kind = forageKind(f.activity);
  if (!kind || f.men <= 0) return;
  const rules = ctx.rules.forage;
  const wide = f.posture === 'dispersed' && kind === 'halt';
  const reachable = neighboursOf(ctx.graph, f.at).filter((n) => n.edge.metres <= 2 * rules.reachMetres && !enemyPresent(s, f.side, n.node));
  const nodes = wide ? [f.at, ...reachable.map((n) => n.node)] : [f.at];
  const bonus = wide ? rules.dispersedPermille : 1000;
  const want = {
    food: Math.floor((Math.floor((f.men * rules.food[kind]) / 1000) * bonus) / 1000),
    fodder: Math.floor((Math.floor(((f.horses + f.draught) * rules.fodder[kind]) / 1000) * bonus) / 1000),
  };
  for (const supply of ['food', 'fodder'] as const) {
    let left = want[supply];
    // Spread evenly over every district in reach first, then make up any shortfall where stocks remain.
    const share = Math.ceil(left / nodes.length);
    for (const cap of [share, Infinity]) {
      for (const node of nodes) {
        const district = s.districts[node];
        if (!district || left <= 0) continue;
        const take = Math.min(left, cap, district[supply]);
        district[supply] -= take;
        f.stock[supply] += take;
        s.ledger.foraged[supply] += take;
        left -= take;
      }
    }
  }
}

/**
 * Forces standing at their own side's depot draw rations directly, without wagons, but only what they could
 * still march with (`takenUp`, G-019). When a depot cannot meet every want it shares each kind in proportion
 * to need, never in the order of the groups' names (D-036).
 */
function issueFromDepots(s: GameState, ctx: Context): void {
  for (const depot of sortedValues(s.depots)) {
    const here = sortedValues(s.forces).filter((f) => f.side === depot.side && f.at === depot.node && f.transit === null && f.men > 0);
    if (here.length === 0) continue;
    // What each would take if the depot had plenty; what it has is then shared in proportion to that.
    const wanted = here.map((f) => takenUp(f, { food: Infinity, fodder: Infinity, ammo: Infinity }, ctx.rules));
    for (const supply of ISSUE_ORDER) {
      const wants = wanted.map((w) => w[supply]);
      const total = wants.reduce((a, b) => a + b, 0);
      if (total === 0) continue;
      const pool = Math.min(total, depot.stock[supply]);
      const gives = wants.map((w) => Math.floor((pool * w) / total));
      // What rounding leaves goes a unit at a time to those still short, in a fixed order.
      let left = pool - gives.reduce((a, b) => a + b, 0);
      for (let i = 0; left > 0 && i < here.length; i++) {
        if ((gives[i] as number) < (wants[i] as number)) {
          gives[i] = (gives[i] as number) + 1;
          left--;
        }
      }
      here.forEach((f, i) => {
        const n = gives[i] as number;
        depot.stock[supply] -= n;
        f.stock[supply] += n;
      });
    }
  }
}

// ------------------------------------------------------------------------------- movement

interface Mover {
  at: NodeId;
  transit: Transit | null;
  route: NodeId[];
}

/** What else on the road limits a mover: whether it may set out along a road, and how far along it it may go. */
function roadFactor(s: GameState, ctx: Context, edge: EdgeDef): number {
  const r = ctx.rules.march;
  let factor: number = r.roadPermille[edge.road];
  if (s.roads[edge.id] === 'mud') factor = Math.floor((factor * r.mudPermille) / 1000);
  if (edge.crossing === 'ford' || edge.crossing === 'pontoon') factor = Math.floor((factor * r.crossingPermille) / 1000);
  return Math.max(1, factor);
}

/**
 * Moves a wagon train along its route on a budget of "ideal" metres; each road converts it at its own speed.
 * Returns whether any distance was covered. Forces march in time order instead (`marchHour`).
 */
function travel(s: GameState, ctx: Context, m: Mover, budget: number, stopAt: (node: NodeId) => boolean, onArrive: (node: NodeId) => void): boolean {
  let moved = false;
  let left = budget;
  while (left > 0) {
    if (!m.transit) {
      const to = m.route[0];
      if (to === undefined) break;
      const edge = must(edgeBetween(ctx.graph, m.at, to), `road ${m.at}–${to}`);
      m.transit = { edge: edge.id, to, metres: 0, seq: s.roadSeq++ };
    }
    const edge = must(ctx.graph.edges.get(m.transit.edge), m.transit.edge);
    const factor = roadFactor(s, ctx, edge);
    const remaining = edge.metres - m.transit.metres;
    const reach = Math.floor((left * factor) / 1000);
    if (reach <= 0 || remaining <= 0) break;
    moved = true;
    if (reach < remaining) {
      m.transit.metres += reach;
      break;
    }
    left -= Math.ceil((remaining * 1000) / factor);
    m.at = m.transit.to;
    m.transit = null;
    if (m.route[0] === m.at) m.route.shift();
    onArrive(m.at);
    if (stopAt(m.at)) break;
  }
  return moved;
}

/** Seconds in an hour: within an hour, arrivals and settings-out are timed to the second (D-038). */
const HOUR = 3_600;
/** Converts a rate (hourly share × road factor) and seconds into metres. */
const PER_HOUR = 1_000 * HOUR;

/** One force's march through one hour. */
interface March {
  f: Force;
  share: number;
  /** Hourly share × road factor on its current road: metres per hour, × 1000. */
  rate: number;
  /** The moment (seconds into the hour) and distance from which it moves at `rate`; for a force standing at a place, when it may set out. */
  t0: number;
  m0: number;
  /** The enemy column it has closed up behind on this road: it moves at that column's pace. */
  behind: Force | null;
  /** Holds its place, or the road, for the rest of the hour. */
  done: boolean;
}

/**
 * One hour's march for every marching force, taken in time order across both sides (§3.4a step 3, D-038).
 * Each force moves at a steady speed set by its hourly share and the road, so its arrivals at places and its
 * settings-out happen at definite moments. At each moment every arrival is placed before anyone sets out
 * again, so forces reaching a place together meet there. A column that catches up with an enemy column
 * ahead of it closes up and follows at its pace, and reaches the next place just after it. Nothing depends on
 * the order of the forces' names, except between forces of one side, which do not block each other.
 */
export function marchHour(s: GameState, ctx: Context, movers: Force[], shares: number[], hour: number, log: LogEntry[]): void {
  const res = s.resolution;
  const lengthOf = (edgeId: string) => must(ctx.graph.edges.get(edgeId), edgeId).metres;
  const runs: March[] = movers.map((f, i) => {
    const share = shares[i] as number;
    const edge = f.transit ? must(ctx.graph.edges.get(f.transit.edge), f.transit.edge) : undefined;
    return { f, share, rate: edge ? share * roadFactor(s, ctx, edge) : 0, t0: 0, m0: f.transit?.metres ?? 0, behind: null, done: share <= 0 };
  });
  const runOf = new Map(runs.map((r) => [r.f.id, r]));
  const start = new Map(movers.map((f) => [f.id, { at: f.at, edge: f.transit?.edge ?? null, metres: f.transit?.metres ?? 0 }]));

  /** Whether `lead` is still on the same road as `f`, going the same way. */
  const sameRoad = (f: Force, lead: Force) => f.transit !== null && lead.transit !== null && lead.transit.edge === f.transit.edge && lead.transit.to === f.transit.to;
  /**
   * Of two columns on one road, whether `a` set out before `b`, and so is ahead of it (D-037). Set-out
   * numbers are unique in play; a hand-built state may repeat one, and then the name decides.
   */
  const earlier = (a: Force, b: Force) => {
    const [x, y] = [must(a.transit, a.id), must(b.transit, b.id)];
    return x.seq < y.seq || (x.seq === y.seq && a.id < b.id);
  };
  /** The enemy columns ahead of a force on its road, going the same way: those that set out before it. */
  const enemiesAhead = (f: Force): Force[] => sortedValues(s.forces).filter((e) => e.side !== f.side && e.men > 0 && sameRoad(f, e) && earlier(e, f));
  /** How far along its road a force is at moment `t`: never past an enemy column that set out before it. */
  const pos = (f: Force, t: number): number => {
    if (!f.transit) return 0;
    const length = lengthOf(f.transit.edge);
    const r = runOf.get(f.id);
    if (!r || r.done) return f.transit.metres;
    // Closed up: at the tail of the column ahead, or at the end of the road once that column has left it.
    if (r.behind) return sameRoad(f, r.behind) ? Math.min(pos(r.behind, t), length) : length;
    return enemiesAhead(f).reduce((m, e) => Math.min(m, pos(e, t)), Math.min(length, r.m0 + Math.floor((r.rate * (t - r.t0)) / PER_HOUR)));
  };
  /** The pace at which a force on the road is moving now: never faster than its own. */
  const rateOf = (f: Force): number => {
    const r = runOf.get(f.id);
    if (!r || r.done || !f.transit) return 0;
    return r.behind && sameRoad(f, r.behind) ? Math.min(r.rate, rateOf(r.behind)) : r.rate;
  };
  /** The nearest enemy column ahead on the same road, going the same way. */
  const aheadOf = (f: Force, t: number): Force | null =>
    enemiesAhead(f).reduce<Force | null>((best, e) => (best === null || pos(e, t) < pos(best, t) ? e : best), null);

  /** The moment of a force's next event, or Infinity: setting out, reaching the end of its road, or closing up. */
  const nextEvent = (r: March, now: number): number => {
    if (r.done) return Infinity;
    const tr = r.f.transit;
    if (!tr) return r.t0;
    if (r.behind) {
      const lead = r.behind;
      // Still on this road ahead of it: it follows, unless the column ahead now pulls away faster than it can
      // march. Once the column ahead has left the road and gone on (or stopped for good), it reaches the end of
      // the road too, just after it.
      if (sameRoad(r.f, lead)) return rateOf(lead) > r.rate ? now : Infinity;
      const leadRun = runOf.get(lead.id);
      if (leadRun && !leadRun.done && !lead.transit && leadRun.t0 === now) return Infinity;
      return now;
    }
    const length = lengthOf(tr.edge);
    const here = pos(r.f, now);
    let t = r.rate > 0 ? Math.max(now, r.t0 + Math.ceil(((length - r.m0) * PER_HOUR) / r.rate)) : Infinity;
    const lead = aheadOf(r.f, now);
    if (lead) {
      const gap = pos(lead, now) - here;
      const closing = r.rate - rateOf(lead);
      if (closing > 0) t = Math.min(t, gap <= 0 ? now : now + Math.ceil((gap * PER_HOUR) / closing));
    }
    return t;
  };

  /** Reaching the end of its road, or closing up behind the column ahead. */
  const onTheRoad = (r: March, now: number) => {
    const f = r.f;
    const tr = must(f.transit, f.id);
    const here = pos(f, now);
    if (r.behind && sameRoad(f, r.behind)) {
      // The column ahead pulls away: it goes on at its own pace from where it is.
      Object.assign(r, { behind: null, t0: now, m0: here });
      tr.metres = here;
      return;
    }
    if (!r.behind && here < lengthOf(tr.edge)) {
      const lead = aheadOf(f, now);
      if (lead) {
        // Closed up: from now on it moves at the pace of the column ahead.
        tr.metres = Math.min(here, pos(lead, now));
        r.behind = lead;
      } else {
        // The column it was closing on has just reached the end of the road: it goes on at its own pace.
        Object.assign(r, { t0: now, m0: here });
        tr.metres = here;
      }
      return;
    }
    // The end of the road: it arrives.
    f.at = tr.to;
    f.transit = null;
    f.arrivedAt = hour * HOUR + now;
    if (f.route[0] === f.at) f.route.shift();
    note(s, log, 'arrived', { force: f.id, node: f.at });
    r.behind = null;
    r.t0 = now;
    // Marching into a place held by the enemy ends the march: that is contact (§3.4a step 4).
    if (enemyPresent(s, f.side, f.at) || f.route.length === 0) r.done = true;
  };

  /** Setting out along the next road of its route, if nothing bars the way. */
  const setOut = (r: March, now: number) => {
    const f = r.f;
    const to = f.route[0];
    const edge = to === undefined ? undefined : must(edgeBetween(ctx.graph, f.at, to), `road ${f.at}–${to}`);
    r.done = true;
    if (!edge || to === undefined) return;
    // Standing where the enemy stands: the contact must be resolved first.
    if (enemyPresent(s, f.side, f.at)) return;
    // An enemy column on this road coming the other way: hold this place and meet it here.
    if (oncoming(s, f.side, edge.id, f.at)) return;
    // An enemy at the far end setting out towards us at this same moment: a draw decides who gets onto the road.
    const rival = runs.some(
      (e) => !e.done && e.f.side !== f.side && e.f.transit === null && e.f.at === to && e.f.route[0] === f.at && e.t0 === now && !enemyPresent(s, e.f.side, to),
    );
    if (rival && chance(s.dice, ['road', res.turn, res.slot, hour, edge.id], 500) !== (f.side === 'fr')) return;
    f.transit = { edge: edge.id, to, metres: 0, seq: s.roadSeq++ };
    f.arrivedAt = null;
    Object.assign(r, { done: false, behind: null, t0: now, m0: 0, rate: r.share * roadFactor(s, ctx, edge) });
  };

  let now = 0;
  for (;;) {
    const at = Math.min(Infinity, ...runs.map((r) => nextEvent(r, now)));
    if (at > HOUR) break;
    now = at;
    // Everything due at this moment: arrivals and closings first, then settings-out; repeat until none is due.
    for (;;) {
      const due = runs.filter((r) => nextEvent(r, now) === now);
      if (due.length === 0) break;
      const onRoad = due.filter((r) => r.f.transit !== null);
      if (onRoad.length > 0) for (const r of onRoad) onTheRoad(r, now);
      else for (const r of due) setOut(r, now);
    }
  }

  // The end of the hour: columns still on the road stand where they have got to.
  const onRoad = runs.filter((r) => r.f.transit !== null && !r.done);
  const reached = new Map(onRoad.map((r) => [r.f.id, pos(r.f, HOUR)]));
  for (const r of onRoad) must(r.f.transit, r.f.id).metres = reached.get(r.f.id) as number;
  for (const r of runs) {
    const was = must(start.get(r.f.id), r.f.id);
    if (r.f.at !== was.at || (r.f.transit?.edge ?? null) !== was.edge || (r.f.transit?.metres ?? 0) > was.metres) r.f.movedThisSlot = true;
  }
}

/** Where a wagon train delivers: its force, or the depot it stocks. Null when it stands idle or its target is gone. */
function deliveryOf(s: GameState, c: Convoy): { node: NodeId; force: Force | null; depot: Depot | null } | null {
  if (c.serves !== null) {
    const f = s.forces[c.serves];
    return f && f.men > 0 ? { node: f.at, force: f, depot: null } : null;
  }
  if (c.feeds !== null && c.feeds !== c.home) {
    const d = s.depots[c.feeds];
    return d && d.side === c.side ? { node: d.node, force: null, depot: d } : null;
  }
  return null;
}

/**
 * A train moves only what its horses can draw (G-019, D-037): with horses lost since it loaded, the
 * excess is unloaded into its own depot if it stands at one, otherwise left by the road.
 */
function shedConvoyLoad(s: GameState, ctx: Context, c: Convoy, log: LogEntry[]): void {
  const payload = usableWagons(c.wagons, c.horses, ctx.rules) * ctx.rules.convoy.payloadGrams;
  const { kept, dropped } = withinCapacity(c.cargo, payload, ctx.rules);
  if (weightGrams(dropped, ctx.rules) === 0) return;
  c.cargo = kept;
  const depot = c.transit === null ? s.depots[c.at] : undefined;
  const toDepot = depot !== undefined && depot.side === c.side;
  addInto(toDepot ? depot.stock : s.ledger.abandoned, dropped);
  note(s, log, 'convoyLeftBehind', { convoy: c.id, food: dropped.food, fodder: dropped.fodder, ammo: dropped.ammo, depot: toDepot ? c.at : null });
}

function moveConvoy(s: GameState, ctx: Context, c: Convoy, log: LogEntry[]): void {
  if (c.leg === 'loading') return;
  shedConvoyLoad(s, ctx, c, log);
  if (usableWagons(c.wagons, c.horses, ctx.rules) === 0) return;
  const delivery = deliveryOf(s, c);
  if (c.leg === 'outbound' && !delivery) c.leg = 'returning';
  const target = c.leg === 'outbound' && delivery ? delivery.node : c.home;
  // Re-planned every sub-step: the force it serves may have moved on.
  c.route = c.transit ? [c.transit.to, ...(shortestPath(ctx.graph, c.transit.to, target) ?? [])] : (shortestPath(ctx.graph, c.at, target) ?? []);
  travel(s, ctx, c, ctx.rules.convoy.metresPerSlot, (node) => node === target, () => {});
  if (c.transit || c.at !== target) return;
  if (c.leg === 'outbound' && delivery) {
    if (delivery.force && (delivery.force.transit !== null || delivery.force.at !== c.at)) return;
    // The train keeps back the fodder its own horses need to get home (G-019); the rest is offered.
    const daysHome = Math.max(1, Math.ceil(roadDistance(ctx.graph, c.at, c.home) / (ctx.rules.convoy.metresPerSlot * 2)));
    const keep = Math.min(c.cargo.fodder, c.horses * ctx.rules.consumption.fodderPerHorse * daysHome);
    const offered = { ...c.cargo, fodder: c.cargo.fodder - keep };
    // A group takes only what it can carry, as from a depot (G-019, D-040); the rest stays on the train.
    const handed = delivery.force ? takenUp(delivery.force, offered, ctx.rules) : offered;
    addInto(delivery.force ? delivery.force.incoming : must(delivery.depot, 'depot').incoming, handed);
    note(s, log, 'delivered', { convoy: c.id, force: delivery.force?.id ?? null, depot: delivery.depot?.node ?? null, food: handed.food, fodder: handed.fodder, ammo: handed.ammo });
    c.cargo = { food: c.cargo.food - handed.food, fodder: c.cargo.fodder - handed.fodder, ammo: c.cargo.ammo - handed.ammo };
    c.leg = 'returning';
  } else {
    c.leg = 'loading';
    note(s, log, 'returned', { convoy: c.id });
  }
}

/**
 * The Russian line of retreat, sub-step by sub-step (§2.13): blocked for long enough once, the Russian
 * main armies count as cut off, and that stands even if the block is later given up.
 */
function trackCutOff(s: GameState, ctx: Context, log: LogEntry[]): void {
  if (!lineOfRetreatBlocked(s, ctx, s.mainArmies)) {
    s.cutOff.held = 0;
    return;
  }
  s.cutOff.held += 1;
  if (s.cutOff.achievedAt === null && s.cutOff.held >= ctx.rules.outcome.cutOffSlots) {
    s.cutOff.achievedAt = { turn: s.resolution.turn, slot: s.resolution.slot };
    note(s, log, 'cutOff');
  }
}

/** A depot left to the enemy changes hands at the end of the sub-step, part of it burned first (§2.6). */
function captureDepots(s: GameState, ctx: Context, log: LogEntry[]): void {
  const res = s.resolution;
  const holders = (side: Side, node: NodeId) => sortedValues(s.forces).some((f) => f.side === side && f.men > 0 && f.transit === null && f.at === node);
  for (const d of sortedValues(s.depots)) {
    const loser = d.side;
    const winner = otherSide(loser);
    if (holders(loser, d.node) || !holders(winner, d.node)) continue;
    const { burnMinPermille, burnMaxPermille } = ctx.rules.capture;
    const burn = drawBetween(s.dice, ['capture', d.node, res.turn, res.slot], burnMinPermille, burnMaxPermille);
    for (const kind of ['food', 'fodder', 'ammo'] as const) {
      const lost = Math.floor((d.stock[kind] * burn) / 1000);
      d.stock[kind] -= lost;
      s.ledger.destroyed[kind] += lost;
    }
    d.side = winner;
    note(s, log, 'depotCaptured', { node: d.node, by: winner, food: d.stock.food, fodder: d.stock.fodder, ammo: d.stock.ammo, burnedPermille: burn });
    // The losing side's wagon trains based or delivering here fall back on its nearest remaining depot.
    const refuge = sortedValues(s.depots)
      .filter((x) => x.side === loser)
      .map((x) => x.node)
      .sort((a, b) => roadDistance(ctx.graph, d.node, a) - roadDistance(ctx.graph, d.node, b))[0];
    for (const c of sortedValues(s.convoys)) {
      if (c.side !== loser) continue;
      if (c.feeds === d.node) c.feeds = refuge ?? c.home;
      if (c.home === d.node && refuge) {
        c.home = refuge;
        if (c.feeds === d.node) c.feeds = refuge;
        if (c.leg === 'loading') c.leg = 'returning';
      }
    }
  }
}

// ------------------------------------------------------------------------------- contacts

/**
 * Reinforcements (§3.4a step 4): a force standing at an active battle's place joins its own side there,
 * in force-ID order. Like a new battle it deploys at this boundary and fights from the next daylight sub-step.
 */
function joinReinforcements(s: GameState, ctx: Context, log: LogEntry[]): void {
  const from = slotIndex(nextDaylight(s.resolution));
  for (const b of sortedValues(s.battles)) {
    if (b.phase === 'over') continue;
    for (const f of sortedValues(s.forces)) {
      if (f.battle !== null || f.transit !== null || f.men <= 0 || f.at !== b.node) continue;
      f.battle = b.id;
      f.route = [];
      b.sides[f.side].push(f.id);
      b.fightsFrom[f.id] = from;
      if (f.posture === 'dispersed' && f.gathering === 0) f.gathering = ctx.rules.posture.gatherSlots;
      if (f.side === 'ru' && f.men >= ctx.rules.russian.mainArmyMen) s.russianCommand.foughtThisTurn = true;
      note(s, log, 'reinforced', { battle: b.id, force: f.id, side: f.side });
    }
  }
}

function findEncounters(s: GameState): Encounter[] {
  const byNode = new Map<NodeId, Encounter>();
  for (const f of sortedValues(s.forces)) {
    if (f.transit || f.battle || f.men <= 0) continue;
    let e = byNode.get(f.at);
    if (!e) {
      e = { node: f.at, fr: [], ru: [] };
      byNode.set(f.at, e);
    }
    e[f.side].push(f.id);
  }
  return [...byNode.values()]
    .filter((e) => e.fr.length > 0 && e.ru.length > 0)
    .sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));
}

function menOf(s: GameState, ids: ForceId[]): number {
  return ids.reduce((n, id) => n + must(s.forces[id], id).men, 0);
}

function leadOf(s: GameState, ids: ForceId[]): Force {
  return ids.map((id) => must(s.forces[id], id)).reduce((a, b) => (b.men > a.men ? b : a));
}

/**
 * The side that marched into a place the enemy already held attacks; of two sides that both arrived during the
 * sub-step, the later. Arriving at the same moment, or neither having marched in, the side seeking battle
 * attacks, then the side not avoiding it; failing that, a draw for the place and sub-step: never a fixed side,
 * never the forces' names (D-038).
 */
function attackerOf(s: GameState, node: NodeId, sides: Record<Side, ForceId[]>): Side {
  const first = (side: Side) => Math.min(...sides[side].map((id) => must(s.forces[id], id).arrivedAt ?? -1));
  if (first('fr') !== first('ru')) return first('fr') > first('ru') ? 'fr' : 'ru';
  const any = (side: Side, test: (f: Force) => boolean) => sides[side].some((id) => test(must(s.forces[id], id)));
  for (const test of [(f: Force) => f.engagement === 'seek', (f: Force) => f.engagement !== 'avoid']) {
    const fr = any('fr', test);
    if (fr !== any('ru', test)) return fr ? 'fr' : 'ru';
  }
  return chance(s.dice, ['attacker', s.resolution.turn, s.resolution.slot, node], 500) ? 'fr' : 'ru';
}

/** Returns true when a major battle was created and resolution must pause for deployment. */
function resolveEncounter(s: GameState, ctx: Context, enc: Encounter, log: LogEntry[]): boolean {
  // An earlier encounter in this sub-step may have moved forces away: no force fights twice (T4).
  const present = (id: ForceId) => {
    const f = must(s.forces[id], id);
    return f.transit === null && f.battle === null && f.men > 0 && f.at === enc.node;
  };
  const sides: Record<Side, ForceId[]> = { fr: enc.fr.filter(present), ru: enc.ru.filter(present) };
  if (sides.fr.length === 0 || sides.ru.length === 0) return false;
  note(s, log, 'encounter', { node: enc.node, forces: [...sides.fr, ...sides.ru].join(',') });

  const men: Record<Side, number> = { fr: menOf(s, sides.fr), ru: menOf(s, sides.ru) };
  if (Math.min(men.fr, men.ru) < ctx.rules.engagement.minorMenThreshold) {
    minorAction(s, ctx, enc.node, sides, men, log);
    return false;
  }

  const attacker = attackerOf(s, enc.node, sides);
  const defender = otherSide(attacker);
  if (leadOf(s, sides[defender]).engagement === 'avoid' && tryWithdraw(s, ctx, enc.node, defender, sides[defender], log)) return false;

  const res = s.resolution;
  const id = `${res.turn}.${res.slot}.${res.battleSeq}`;
  res.battleSeq += 1;
  s.battles[id] = {
    id,
    node: enc.node,
    attacker,
    sides,
    phase: 'deploy',
    startsAt: nextDaylight(res),
    fightsFrom: {},
    losses: {},
    routed: [],
    roundsFought: 0,
    roundsThisSlot: 0,
    awaiting: 'deploy',
    hidden: null,
    lastNight: -1,
    winner: null,
  };
  for (const fid of [...sides.fr, ...sides.ru]) {
    const f = must(s.forces[fid], fid);
    f.battle = id;
    f.route = [];
    // Caught dispersed: the force assembles while the fighting begins (§2.4b).
    if (f.posture === 'dispersed' && f.gathering === 0) f.gathering = ctx.rules.posture.gatherSlots;
  }
  if (sides.ru.some((fid) => must(s.forces[fid], fid).men >= ctx.rules.russian.mainArmyMen)) s.russianCommand.foughtThisTurn = true;
  note(s, log, 'battleJoined', { battle: id, node: enc.node, attacker });
  return true;
}

function tryWithdraw(s: GameState, ctx: Context, node: NodeId, side: Side, ids: ForceId[], log: LogEntry[]): boolean {
  const e = ctx.rules.engagement;
  const forces = ids.map((id) => must(s.forces[id], id));
  const men = forces.reduce((n, f) => n + f.men, 0);
  const fatigue = Math.floor(forces.reduce((n, f) => n + f.fatigue * f.men, 0) / Math.max(1, men));
  const dest = retreatNodeFor(s, ctx, node, side);
  const permille = fatigue > e.withdrawMaxFatigue ? 0 : e.withdrawBasePermille - Math.floor(fatigue / 2);
  const res = s.resolution;
  const success = dest !== null && chance(s.dice, ['withdraw', res.turn, res.slot, node], permille);
  note(s, log, 'withdrawal', { node, side, success, to: success ? dest : null });
  if (!success || dest === null) return false;
  for (const f of forces) {
    loseMen(s, f, Math.floor((f.men * e.withdrawalLossPermille) / 1000), 'withdrawal');
    fallBack(s, ctx, f, dest);
  }
  return true;
}

function minorAction(s: GameState, ctx: Context, node: NodeId, sides: Record<Side, ForceId[]>, men: Record<Side, number>, log: LogEntry[]): void {
  const weaker: Side = men.fr <= men.ru ? 'fr' : 'ru';
  const dest = retreatNodeFor(s, ctx, node, weaker);
  const rate = dest ? ctx.rules.engagement.minorLossPermille : ctx.rules.battle.trappedLossPermille;
  const res = s.resolution;
  for (const id of sides[weaker]) {
    const f = must(s.forces[id], id);
    const noise = drawBetween(s.dice, ['minor', res.turn, res.slot, node, id], 500, 1500);
    loseMen(s, f, Math.floor((Math.floor((f.men * rate) / 1000) * noise) / 1000), 'battle');
    if (dest) fallBack(s, ctx, f, dest);
  }
  note(s, log, 'minorAction', { node, retreated: weaker, to: dest });
}

// ---------------------------------------------------------------------------------- night

/** A day's food and fodder come only from stock on hand (§3.4a night step 1). */
function consume(s: GameState, ctx: Context, f: Force, log: LogEntry[]): void {
  const { consumption, attrition, fatigue } = ctx.rules;
  const foodNeed = f.men * consumption.foodPerMan;
  // Draught horses eat with the saddle and artillery horses, and share their fate when fodder runs short.
  const allHorses = f.horses + f.draught;
  const fodderNeed = allHorses * consumption.fodderPerHorse;
  const food = Math.min(f.stock.food, foodNeed);
  const fodder = Math.min(f.stock.fodder, fodderNeed);
  f.stock.food -= food;
  f.stock.fodder -= fodder;
  s.ledger.consumed.food += food;
  s.ledger.consumed.fodder += fodder;
  const foodShort = foodNeed - food;
  const fodderShort = fodderNeed - fodder;

  loseMen(s, f, Math.floor((f.men * attrition.sicknessPermillePerDay) / 1000), 'sickness');
  if (foodShort > 0) {
    loseMen(s, f, Math.floor((f.men * foodShort * attrition.stragglePermilleAtFullShortfall) / (foodNeed * 1000)), 'straggling');
    f.cohesion = Math.max(0, f.cohesion - Math.floor((foodShort * attrition.cohesionLossAtFullShortfall) / foodNeed));
  } else {
    f.cohesion = Math.min(1000, f.cohesion + attrition.cohesionRecoveryWhenFed);
  }
  let horsesDied = 0;
  if (fodderShort > 0) {
    horsesDied = Math.min(allHorses, Math.floor((allHorses * fodderShort * attrition.horseLossPermilleAtFullShortfall) / (fodderNeed * 1000)));
    const draughtDied = Math.floor((horsesDied * f.draught) / allHorses);
    f.draught -= draughtDied;
    f.horses -= horsesDied - draughtDied;
    s.ledger.horsesLost += horsesDied;
  }
  // Food and fodder shortfalls are reported separately: horses can starve while the men are fed.
  if (foodShort > 0 || fodderShort > 0) note(s, log, 'shortfall', { force: f.id, food: foodShort, fodder: fodderShort, horsesDied });
  f.fatigue = Math.max(0, f.fatigue - (f.marchedToday ? fatigue.nightAfterMarch : fatigue.nightAfterRest));
  f.marchedToday = false;
}

/**
 * Wagon-train horses must eat too (G-019): they graze where they stand (at the halted rate when
 * waiting at their depot, the marching rate otherwise, over two sub-steps), then eat the fodder they
 * carry, then their depot's. On a long haul they eat part of what they were meant to deliver.
 */
function feedConvoy(s: GameState, ctx: Context, c: Convoy, log: LogEntry[]): void {
  if (c.horses <= 0) return;
  const { consumption, forage: rates, attrition } = ctx.rules;
  const need = c.horses * consumption.fodderPerHorse;
  const waiting = c.transit === null && c.leg === 'loading';
  const district = s.districts[c.at];
  const graze = district ? Math.min(district.fodder, Math.floor((c.horses * (waiting ? rates.fodder.halt : rates.fodder.march) * 2) / 1000), need) : 0;
  if (district) district.fodder -= graze;
  s.ledger.foraged.fodder += graze;
  let eaten = graze;
  const fromCargo = Math.min(c.cargo.fodder, need - eaten);
  c.cargo.fodder -= fromCargo;
  eaten += fromCargo;
  const depot = s.depots[c.at];
  if (waiting && c.at === c.home && depot && depot.side === c.side) {
    const fromDepot = Math.min(depot.stock.fodder, need - eaten);
    depot.stock.fodder -= fromDepot;
    eaten += fromDepot;
  }
  s.ledger.consumed.fodder += eaten;
  const short = need - eaten;
  if (short <= 0) return;
  const died = Math.min(c.horses, Math.floor((c.horses * short * attrition.horseLossPermilleAtFullShortfall) / (need * 1000)));
  c.horses -= died;
  s.ledger.horsesLost += died;
  note(s, log, 'convoyShortfall', { convoy: c.id, fodder: short, horsesDied: died });
}
