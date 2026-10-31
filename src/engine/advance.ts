// Resumable turn resolution (§3.4) on the fixed turn timeline (§3.4a).
//
// Where resolution stands is part of the GameState. `advance` applies one player input, then runs
// stages until the next point that needs the player. Nothing here waits on the UI or keeps hidden
// state outside the GameState, so a saved pause can be resumed exactly.

import { decideNightfall, decideRound, planRussianTurn } from './ai';
import { resolveNightfall, resolveRound, retreatNodeFor } from './battle';
import { edgeBetween, neighboursOf, shortestPath, type EdgeDef } from './graph';
import { chance, drawBetween } from './rng';
import type { Context } from './scenario';
import { ROUNDS_PER_SLOT, dayIndex, isAfternoon, nextDaylight, slotIndex } from './time';
import type {
  Activity,
  BattleState,
  Convoy,
  Encounter,
  Force,
  ForceId,
  GameState,
  Input,
  LogEntry,
  NightChoice,
  NodeId,
  RoundAction,
  Side,
  Slot,
  Stage,
  Status,
  Transit,
} from './types';
import { addInto, emptySupplies, enemyPresent, fatiguePermille, loseMen, must, note, otherSide, place, sortedValues } from './util';

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
      if (f.battle !== null) return `${f.name} is engaged in battle and cannot take movement orders`;
      if (f.transit && o.route[0] !== f.transit.to) return `${f.name} is on the road and must first reach ${f.transit.to}`;
      let prev = f.transit ? f.transit.to : f.at;
      for (const node of f.transit ? o.route.slice(1) : o.route) {
        if (!edgeBetween(ctx.graph, prev, node)) return `there is no road from ${prev} to ${node}`;
        prev = node;
      }
    }
    return null;
  }

  if (status.kind !== 'awaitingBattleInput') return 'no battle is waiting for a decision';
  if (input.battleId !== status.battleId || input.round !== status.round) return 'this decision is for a different battle or round';
  const d = input.decision;
  if (d.kind !== 'delegate' && d.kind !== status.step) return `a ${status.step} decision is expected`;
  if (d.kind === 'round' && !ROUND_ACTIONS.includes(d.action)) return `unknown battle action ${d.action}`;
  if (d.kind === 'nightfall' && !NIGHT_CHOICES.includes(d.choice)) return `unknown nightfall choice ${d.choice}`;
  return null;
}

function applyInput(s: GameState, input: Input, ctx: Context, log: LogEntry[]): void {
  if (input.kind === 'orders') {
    for (const o of input.orders) {
      const f = must(s.forces[o.force], o.force);
      if (o.route !== undefined) f.route = [...o.route];
      if (o.pace !== undefined) f.pace = o.pace;
      if (o.engagement !== undefined) f.engagement = o.engagement;
      if (o.posture === 'dispersed') {
        f.posture = 'dispersed';
        f.gathering = 0;
      } else if (o.posture === 'concentrated' && f.posture === 'dispersed' && f.gathering === 0) {
        f.gathering = ctx.rules.posture.gatherSlots;
      }
    }
    // The Russians re-plan only at the start of a turn, as the player does (§3.4).
    planRussianTurn(s, ctx);
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
    // A dispersed force must assemble before it can march (§2.4b).
    if (f.posture === 'dispersed' && f.gathering === 0 && f.battle === null && f.pace !== 'rest' && nextEdgeOf(ctx, f)) {
      f.gathering = ctx.rules.posture.gatherSlots;
    }
    f.activity = activityFor(ctx, f);
  }
  res.stage = 'movement';
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

function stageMovement(s: GameState, ctx: Context, log: LogEntry[]): void {
  for (const f of sortedValues(s.forces)) if (f.activity === 'march' || f.activity === 'cross') moveForce(s, ctx, f, log);
  for (const c of sortedValues(s.convoys)) moveConvoy(s, ctx, c, log);
  s.resolution.stage = 'contacts';
}

function stageContacts(s: GameState, ctx: Context, log: LogEntry[]): void {
  const res = s.resolution;
  if (res.encounterQueue === null) res.encounterQueue = findEncounters(s);
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
    issueFromDepot(s, ctx, f);
    const resting = f.activity === 'halt' || f.activity === 'gather';
    const change = moving ? (f.pace === 'forced' ? fatigue.marchForced : fatigue.marchSteady) : resting ? fatigue.halt : 0;
    f.fatigue = Math.max(0, Math.min(1000, f.fatigue + change));
    if (moving) f.marchedToday = true;
    if (f.gathering > 0) {
      f.gathering -= 1;
      if (f.gathering === 0) f.posture = 'concentrated';
    }
  }
  for (const d of sortedValues(s.depots)) {
    addInto(d.stock, d.incoming);
    d.incoming = emptySupplies();
  }
  for (const c of sortedValues(s.convoys)) {
    const depot = s.depots[c.home];
    if (c.leg !== 'loading' || c.at !== c.home || !depot) continue;
    // Loads are limited by weight: a wagon carries far fewer days of fodder than of bread (L-004).
    const payload = c.wagons * convoy.payloadGrams;
    for (const kind of ['food', 'fodder', 'ammo'] as const) {
      const fits = Math.floor((payload * convoy.loadPermille[kind]) / 1000 / gramsPerUnit[kind]);
      const amount = Math.min(fits, depot.stock[kind]);
      depot.stock[kind] -= amount;
      c.cargo[kind] += amount;
    }
    c.leg = 'outbound';
    note(s, log, 'loaded', { convoy: c.id, food: c.cargo.food, fodder: c.cargo.fodder, ammo: c.cargo.ammo });
  }
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
  for (const id of Object.keys(s.roads).sort()) s.roads[id] = s.rainToday ? 'mud' : 'dry';
  if (res.slot === 3) res.stage = 'endOfTurn';
  else {
    res.slot = 2;
    res.stage = 'activity';
  }
}

function stageEndOfTurn(s: GameState, ctx: Context, log: LogEntry[]): void {
  // Events, political pressure and intelligence reports are added here as those systems are built.
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
 * Gathering from the countryside (§2.6). A halted, dispersed force reaches its neighbouring
 * districts too, except where the enemy stands, and gathers more; everyone else uses their own district.
 */
function forage(s: GameState, ctx: Context, f: Force): void {
  const kind = forageKind(f.activity);
  if (!kind || f.men <= 0) return;
  const rules = ctx.rules.forage;
  const wide = f.posture === 'dispersed' && kind === 'halt';
  const nodes = wide ? [f.at, ...neighboursOf(ctx.graph, f.at).map((n) => n.node).filter((n) => !enemyPresent(s, f.side, n))] : [f.at];
  const bonus = wide ? rules.dispersedPermille : 1000;
  const want = {
    food: Math.floor((Math.floor((f.men * rules.food[kind]) / 1000) * bonus) / 1000),
    fodder: Math.floor((Math.floor((f.horses * rules.fodder[kind]) / 1000) * bonus) / 1000),
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

/** A force standing at its own side's depot draws rations directly, without wagons. */
function issueFromDepot(s: GameState, ctx: Context, f: Force): void {
  const depot = s.depots[f.at];
  if (!depot || depot.side !== f.side || f.transit || f.men <= 0) return;
  const { depotIssue, consumption } = ctx.rules;
  const target = {
    food: f.men * consumption.foodPerMan * depotIssue.foodDays,
    fodder: f.horses * consumption.fodderPerHorse * depotIssue.fodderDays,
    ammo: Math.floor((f.men * depotIssue.ammoPerThousandMen) / 1000),
  };
  for (const supply of ['food', 'fodder', 'ammo'] as const) {
    const take = Math.min(Math.max(0, target[supply] - f.stock[supply]), depot.stock[supply]);
    depot.stock[supply] -= take;
    f.stock[supply] += take;
  }
}

// ------------------------------------------------------------------------------- movement

interface Mover {
  at: NodeId;
  transit: Transit | null;
  route: NodeId[];
}

function roadFactor(s: GameState, ctx: Context, edge: EdgeDef): number {
  const r = ctx.rules.march;
  let factor: number = r.roadPermille[edge.road];
  if (s.roads[edge.id] === 'mud') factor = Math.floor((factor * r.mudPermille) / 1000);
  if (edge.crossing === 'ford' || edge.crossing === 'pontoon') factor = Math.floor((factor * r.crossingPermille) / 1000);
  return Math.max(1, factor);
}

/**
 * Moves along the route on a budget of "ideal" metres; each road converts it at its own speed.
 * Returns whether any distance was covered. Opposing columns on the same road do not yet meet
 * mid-road; contact happens at places.
 */
function travel(s: GameState, ctx: Context, m: Mover, budget: number, stopAt: (node: NodeId) => boolean, onArrive: (node: NodeId) => void): boolean {
  let moved = false;
  let left = budget;
  while (left > 0) {
    if (!m.transit) {
      const to = m.route[0];
      if (to === undefined) break;
      const edge = must(edgeBetween(ctx.graph, m.at, to), `road ${m.at}–${to}`);
      m.transit = { edge: edge.id, to, metres: 0 };
    }
    const edge = must(ctx.graph.edges.get(m.transit.edge), m.transit.edge);
    const factor = roadFactor(s, ctx, edge);
    const remaining = edge.metres - m.transit.metres;
    const reach = Math.floor((left * factor) / 1000);
    if (reach <= 0) break;
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

function moveForce(s: GameState, ctx: Context, f: Force, log: LogEntry[]): void {
  const budget = Math.floor((ctx.rules.march.metresPerSlot[f.pace] * fatiguePermille(f.fatigue, ctx.rules)) / 1000);
  // Marching into a place held by the enemy ends the march: that is contact (§3.4a step 4).
  f.movedThisSlot = travel(
    s,
    ctx,
    f,
    budget,
    (node) => enemyPresent(s, f.side, node),
    (node) => note(s, log, 'arrived', { force: f.id, node }),
  );
}

function moveConvoy(s: GameState, ctx: Context, c: Convoy, log: LogEntry[]): void {
  if (c.leg === 'loading') return;
  const served = must(s.forces[c.serves], c.serves);
  const target = c.leg === 'outbound' ? served.at : c.home;
  // Re-planned every sub-step: the force it serves may have moved on.
  c.route = c.transit ? [c.transit.to, ...(shortestPath(ctx.graph, c.transit.to, target) ?? [])] : (shortestPath(ctx.graph, c.at, target) ?? []);
  travel(s, ctx, c, ctx.rules.convoy.metresPerSlot, (node) => node === target, () => {});
  if (c.transit || c.at !== target) return;
  if (c.leg === 'outbound') {
    if (served.transit !== null || served.at !== c.at) return;
    addInto(served.incoming, c.cargo);
    note(s, log, 'delivered', { convoy: c.id, force: served.id, food: c.cargo.food, fodder: c.cargo.fodder, ammo: c.cargo.ammo });
    c.cargo = emptySupplies();
    c.leg = 'returning';
  } else {
    c.leg = 'loading';
    note(s, log, 'returned', { convoy: c.id });
  }
}

// ------------------------------------------------------------------------------- contacts

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

/** The side that marched in attacks; failing that, the side seeking battle; failing that, whoever is not avoiding it. */
function attackerOf(s: GameState, sides: Record<Side, ForceId[]>): Side {
  const any = (side: Side, test: (f: Force) => boolean) => sides[side].some((id) => test(must(s.forces[id], id)));
  for (const test of [(f: Force) => f.movedThisSlot, (f: Force) => f.engagement === 'seek', (f: Force) => f.engagement !== 'avoid']) {
    const fr = any('fr', test);
    if (fr !== any('ru', test)) return fr ? 'fr' : 'ru';
  }
  return 'fr';
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

  const attacker = attackerOf(s, sides);
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
  const success = dest !== null && chance(s.seed, ['withdraw', res.turn, res.slot, node], permille);
  note(s, log, 'withdrawal', { node, side, success });
  if (!success || dest === null) return false;
  for (const f of forces) {
    loseMen(s, f, Math.floor((f.men * e.withdrawalLossPermille) / 1000), 'withdrawal');
    place(f, dest);
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
    const noise = drawBetween(s.seed, ['minor', res.turn, res.slot, node, id], 500, 1500);
    loseMen(s, f, Math.floor((Math.floor((f.men * rate) / 1000) * noise) / 1000), 'battle');
    if (dest) place(f, dest);
  }
  note(s, log, 'minorAction', { node, retreated: weaker, to: dest });
}

// ---------------------------------------------------------------------------------- night

/** A day's food and fodder come only from stock on hand (§3.4a night step 1). */
function consume(s: GameState, ctx: Context, f: Force, log: LogEntry[]): void {
  const { consumption, attrition, fatigue } = ctx.rules;
  const foodNeed = f.men * consumption.foodPerMan;
  const fodderNeed = f.horses * consumption.fodderPerHorse;
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
    note(s, log, 'shortfall', { force: f.id, food: foodShort, fodder: fodderShort });
  } else {
    f.cohesion = Math.min(1000, f.cohesion + attrition.cohesionRecoveryWhenFed);
  }
  if (fodderShort > 0) {
    const dead = Math.min(f.horses, Math.floor((f.horses * fodderShort * attrition.horseLossPermilleAtFullShortfall) / (fodderNeed * 1000)));
    f.horses -= dead;
    s.ledger.horsesLost += dead;
  }
  f.fatigue = Math.max(0, f.fatigue - (f.marchedToday ? fatigue.nightAfterMarch : fatigue.nightAfterRest));
  f.marchedToday = false;
}
