// Sector battles (§2.10). Three sectors and a reserve on a battlefield template, each force's infantry,
// cavalry and guns allocated across them, rounds resolved simultaneously, four results kept apart, and
// escape graded by the operational situation. The contracts are in TECHNICAL_ARCHITECTURE §3.4b; the
// values in `rules.battle` are placeholders (G-006, G-022).

import { edgeBetween, neighboursOf, pathMetres, roadDistance, shortestPath } from './graph';
import type { Rules } from './rules';
import { chance, drawBetween } from './rng';
import type { Context } from './scenario';
import { dayIndex, slotIndex } from './time';
import type {
  Allocation,
  BattleField,
  BattleState,
  ExitState,
  FieldResult,
  FieldTemplateId,
  Force,
  ForceId,
  GameState,
  KeyDecision,
  LogEntry,
  NightChoice,
  NodeId,
  Placement,
  RoundAction,
  SectorIndex,
  SectorOrder,
  Side,
  Troops,
} from './types';
import { apportion, enemyPresent, fatiguePermille, loseMen, must, note, otherSide, sortedValues, syncAllocation } from './util';

export const SIDES: readonly Side[] = ['fr', 'ru'];
export const SECTORS: readonly SectorIndex[] = [0, 1, 2];

export interface SectorTemplate {
  name: string;
  /** The defender's power here, permille. */
  defencePermille: number;
  /** What a cavalryman is worth here, permille of an infantryman. */
  cavalryPermille: number;
  /** What the guns are worth here, permille. */
  gunsPermille: number;
}

/** Battlefield templates (§2.10). The modifiers are placeholders (G-022). */
export const FIELD_TEMPLATES: Record<FieldTemplateId, { name: string; sectors: [SectorTemplate, SectorTemplate, SectorTemplate] }> = {
  open: {
    name: 'Open field',
    sectors: [
      { name: 'the ridge', defencePermille: 1100, cavalryPermille: 1000, gunsPermille: 1200 },
      { name: 'the village', defencePermille: 1400, cavalryPermille: 500, gunsPermille: 900 },
      { name: 'the woods', defencePermille: 1250, cavalryPermille: 400, gunsPermille: 600 },
    ],
  },
  // The walled Old Town of Smolensk (H-006): the walls, the suburbs outside them, the bridges over the Dnieper.
  smolensk: {
    name: 'Smolensk',
    sectors: [
      { name: 'the walls', defencePermille: 1800, cavalryPermille: 200, gunsPermille: 1000 },
      { name: 'the suburbs', defencePermille: 1400, cavalryPermille: 400, gunsPermille: 800 },
      { name: 'the bridges', defencePermille: 1300, cavalryPermille: 300, gunsPermille: 1100 },
    ],
  },
};

// ------------------------------------------------------------------------------ allocation (A)

export const noTroops = (): Troops => ({ inf: 0, cav: 0, guns: 0 });

/** A force's whole strength in the reserve: how a reinforcement enters the field. */
export const allInReserve = (f: Force): Allocation => ({ sectors: [noTroops(), noTroops(), noTroops()], reserve: { inf: f.men - f.cavalry, cav: f.cavalry, guns: f.guns } });

export function allocationTotals(a: Allocation): Troops {
  const t = noTroops();
  for (const x of [...a.sectors, a.reserve]) {
    t.inf += x.inf;
    t.cav += x.cav;
    t.guns += x.guns;
  }
  return t;
}

/** Cavalry with mounts: the saddle horses left after the gun teams (contract A). */
export function effectiveCavalry(f: Force, rules: Rules): number {
  return Math.min(f.cavalry, Math.max(0, f.horses - f.guns * rules.battle.horsesPerGun));
}

/** The staff's deployment of one side: its allocation, standing orders and main effort (made by the marshal, ai.ts). */
export interface Deployment {
  alloc: Record<ForceId, Allocation>;
  orders: [SectorOrder, SectorOrder, SectorOrder];
  mainEffort: SectorIndex | null;
}

export function newField(template: FieldTemplateId, plans: Record<Side, Deployment>): BattleField {
  return {
    template,
    control: [0, 0, 0],
    alloc: { ...plans.fr.alloc, ...plans.ru.alloc },
    orders: { fr: plans.fr.orders, ru: plans.ru.orders },
    mainEffort: { fr: plans.fr.mainEffort, ru: plans.ru.mainEffort },
    cavalryTask: { fr: 'pursue', ru: 'pursue' },
    charging: { fr: null, ru: null },
    flank: { fr: null, ru: null },
    positionLost: [],
    pursued: false,
    result: { fr: null, ru: null },
    delegated: false,
    decisions: 0,
  };
}

/** A force's whole strength in one sector or the reserve, as the player places it at deployment. */
export function placedAllocation(f: Force, where: SectorIndex | 'reserve'): Allocation {
  const whole = allInReserve(f);
  if (where !== 'reserve') {
    whole.sectors[where] = whole.reserve;
    whole.reserve = noTroops();
  }
  return whole;
}

/** The player's own placements at deployment: a force's whole strength into a sector or the reserve. */
export function applyPlacements(s: GameState, b: BattleState, placements: Record<ForceId, Placement>): void {
  for (const [id, where] of Object.entries(placements).sort(([a], [c]) => (a < c ? -1 : 1))) {
    if (where === 'staff') continue;
    b.field.alloc[id] = placedAllocation(must(s.forces[id], id), where);
  }
}

// --------------------------------------------------------------------------------- sides

export function sideForces(s: GameState, b: BattleState, side: Side): Force[] {
  return b.sides[side].map((id) => must(s.forces[id], `force ${id}`));
}

/** The side's forces taking part in rounds at sub-step index `at`: a reinforcement only once it has deployed. */
export function activeForces(s: GameState, b: BattleState, side: Side, at: number): Force[] {
  return sideForces(s, b, side).filter((f) => (b.fightsFrom[f.id] ?? 0) <= at);
}

export function sideTotals(s: GameState, b: BattleState, side: Side, at: number): { men: number; cohesion: number; fatigue: number } {
  let men = 0;
  let cohesion = 0;
  let fatigue = 0;
  for (const f of activeForces(s, b, side, at)) {
    men += f.men;
    cohesion += f.cohesion * f.men;
    fatigue += f.fatigue * f.men;
  }
  if (men === 0) return { men: 0, cohesion: 0, fatigue: 1000 };
  return { men, cohesion: Math.floor(cohesion / men), fatigue: Math.floor(fatigue / men) };
}

/** Men a side could still send in from its reserve now: deployed forces only (contract A). */
export function reserveMen(s: GameState, b: BattleState, side: Side, at: number): number {
  return activeForces(s, b, side, at).reduce((n, f) => {
    const r = b.field.alloc[f.id]?.reserve;
    return n + (r ? r.inf + r.cav : 0);
  }, 0);
}

// ---------------------------------------------------------------------------------- exits (D)

/** An enemy column on this road marching towards `node`. */
export function oncoming(s: GameState, side: Side, edgeId: string, node: NodeId): boolean {
  return Object.values(s.forces).some((f) => f.side !== side && f.men > 0 && f.transit !== null && f.transit.edge === edgeId && f.transit.to === node);
}

/**
 * How a side's road out was chosen: the way its attacking main body came, towards its base, towards its own troops,
 * or towards a depot.
 */
export type RetreatBasis = 'line' | 'base' | 'own' | 'depot';

/**
 * Where a side's line of communications runs back to (your decision on the third review): for the Russians the ends
 * of their line of retreat (`exitPlaces`); for the French, and for a side without such places, the depots it started
 * with. A depot founded during the campaign is not a base.
 */
function basesOf(ctx: Context, side: Side): NodeId[] {
  const exits = side === 'ru' ? (ctx.scenario.exitPlaces ?? []) : [];
  return exits.length > 0 ? [...exits] : ctx.scenario.depots.filter((d) => d.side === side).map((d) => d.node);
}

/**
 * Where a side under pressure falls back from `node`, all together, along its line (third review, your decisions;
 * TECHNICAL_ARCHITECTURE §3.4b D). The roads out are those free of the enemy and of enemy columns coming the other
 * way. An attacker goes back by the road its main body (`attacker`) came, if that is open (D-042); a defender
 * passes null. Otherwise the side takes the road towards its base (`basesOf`), by roads that do not go back
 * through `node`; failing that, towards the nearest place its own troops hold; failing that, towards its nearest
 * depot. Neither a depot founded on the way nor a detachment standing off the line pulls it away. Null when no
 * road is open. `avoid` is a place it may not fall back to: the enemy's own road out, when both sides leave at
 * once (`departureRoads`).
 */
export function lineOfRetreat(s: GameState, ctx: Context, node: NodeId, side: Side, attacker: Force | null, avoid: NodeId | null = null): { to: NodeId; basis: RetreatBasis } | null {
  const options = neighboursOf(ctx.graph, node)
    .filter((n) => n.node !== avoid && !enemyPresent(s, side, n.node) && !oncoming(s, side, n.edge.id, node))
    .map((n) => n.node)
    .sort();
  if (options.length === 0) return null;
  if (attacker?.cameFrom && options.includes(attacker.cameFrom)) return { to: attacker.cameFrom, basis: 'line' };
  const around = (from: NodeId, to: NodeId) => {
    const path = from === to ? [] : shortestPath(ctx.graph, from, to, new Set([node]));
    return path === null ? Infinity : pathMetres(ctx.graph, from, path);
  };
  const nearest = (places: NodeId[]) => {
    let best: { to: NodeId; metres: number } | null = null;
    for (const option of options) {
      const metres = Math.min(...places.map((p) => around(option, p)));
      if (Number.isFinite(metres) && (best === null || metres < best.metres)) best = { to: option, metres };
    }
    return best?.to ?? null;
  };
  const towardsBase = nearest(basesOf(ctx, side));
  if (towardsBase !== null) return { to: towardsBase, basis: 'base' };
  const held = [...new Set(sortedValues(s.forces).filter((f) => f.side === side && f.men > 0 && f.transit === null && f.at !== node).map((f) => f.at))];
  const towardsOwn = held.length > 0 ? nearest(held) : null;
  if (towardsOwn !== null) return { to: towardsOwn, basis: 'own' };
  const depots = sortedValues(s.depots).filter((d) => d.side === side).map((d) => d.node);
  return { to: (depots.length > 0 ? nearest(depots) : null) ?? (options[0] as NodeId), basis: 'depot' };
}

/** The side's road out of a battle, taken by every corps of the side: the attacker's main body's way back, or the defender's line. */
export const retreatOfSide = (s: GameState, ctx: Context, b: BattleState, side: Side, avoid: NodeId | null = null) =>
  lineOfRetreat(s, ctx, b.node, side, side === b.attacker ? mainBody(s, b, side) : null, avoid);

/**
 * Each departing side's road, fixed before either moves (third review). When both leave at once, the attacker keeps
 * its road, most often the way it came; the defender does not take the same road while it has another, so the two
 * do not march off down one road together. `aside` is the side turned off it.
 */
function departureRoads(s: GameState, ctx: Context, b: BattleState, sides: Side[]): { roads: Map<Side, ReturnType<typeof lineOfRetreat>>; aside: Side | null } {
  const roads = new Map(sides.map((side) => [side, retreatOfSide(s, ctx, b, side)] as const));
  const defender = otherSide(b.attacker);
  const taken = roads.get(b.attacker)?.to ?? null;
  if (sides.length < 2 || taken === null || roads.get(defender)?.to !== taken) return { roads, aside: null };
  const other = retreatOfSide(s, ctx, b, defender, taken);
  if (other === null) return { roads, aside: null };
  roads.set(defender, other);
  return { roads, aside: defender };
}

/** The side's largest force in the battle: its line of retreat is the side's. */
function mainBody(s: GameState, b: BattleState, side: Side): Force | null {
  return sideForces(s, b, side).reduce<Force | null>((a, f) => (f.men > 0 && (a === null || f.men > a.men) ? f : a), null);
}

/**
 * How the side can leave the field (contract D). Blocked: no neighbouring place free of the enemy. Contested:
 * its retreat road crosses a river, an enemy force stands within `contestMetres` of the retreat place or marches
 * towards it, or an enemy in this battle came along that road. Open otherwise. Political pressure plays no part.
 * `dest` is the road it takes, its line of retreat unless both sides leave at once (`departureRoads`).
 */
export function exitStateFor(s: GameState, ctx: Context, b: BattleState, side: Side, dest: NodeId | null = retreatOfSide(s, ctx, b, side)?.to ?? null): ExitState {
  if (dest === null) return 'blocked';
  if (must(edgeBetween(ctx.graph, b.node, dest), `road ${b.node}–${dest}`).crossing !== null) return 'contested';
  const enemy = otherSide(side);
  for (const f of sortedValues(s.forces)) {
    if (f.side !== enemy || f.men <= 0) continue;
    if (b.sides[enemy].includes(f.id)) {
      if (f.cameFrom === dest) return 'contested';
    } else if (f.transit !== null) {
      if (f.transit.to === dest) return 'contested';
    } else if (f.at !== b.node && roadDistance(ctx.graph, f.at, dest) <= ctx.rules.battle.contestMetres) {
      return 'contested';
    }
  }
  return 'open';
}

// ------------------------------------------------------------------------------- decisions

export function keyLabel(k: KeyDecision): string {
  if (k.kind === 'commitReserve' || k.kind === 'massGuns' || k.kind === 'charge') return `${k.kind}:${k.sector}`;
  return k.kind === 'cavalry' ? `cavalry:${k.task}` : k.kind;
}

/** The old army-wide orders, still accepted (§3.4b). */
export function keyFromAction(action: RoundAction): KeyDecision {
  return action === 'press' ? { kind: 'pressAll' } : action === 'hold' ? { kind: 'holdAll' } : { kind: 'breakOff' };
}

/** A side's key decision changes its standing orders, or sends in its reserve to counter-attack; break-off is handled apart. */
function applyKey(s: GameState, b: BattleState, side: Side, k: KeyDecision, now: number): void {
  const orders = b.field.orders[side];
  if (k.kind === 'pressAll') {
    for (const i of SECTORS) if (orders[i] !== 'assault') orders[i] = 'press';
  } else if (k.kind === 'holdAll') {
    for (const i of SECTORS) orders[i] = 'hold';
  } else if (k.kind === 'commitReserve') {
    // Only forces already deployed can be sent in (contract A).
    for (const f of activeForces(s, b, side, now)) {
      const a = must(b.field.alloc[f.id], `allocation of ${f.id}`);
      const into = a.sectors[k.sector];
      into.inf += a.reserve.inf;
      into.cav += a.reserve.cav;
      into.guns += a.reserve.guns;
      a.reserve = noTroops();
    }
    // Sent in to counter-attack: it presses there, or keeps up the assault.
    if (orders[k.sector] !== 'assault') orders[k.sector] = 'press';
  } else if (k.kind === 'massGuns' || k.kind === 'charge') {
    // Every deployed gun, or the reserve's horsemen, into one sector: each counted once (contract A).
    for (const f of activeForces(s, b, side, now)) {
      const a = must(b.field.alloc[f.id], `allocation of ${f.id}`);
      const into = a.sectors[k.sector];
      if (k.kind === 'charge') {
        into.cav += a.reserve.cav;
        a.reserve = { ...a.reserve, cav: 0 };
        continue;
      }
      for (const from of [...a.sectors, a.reserve]) {
        if (from === into) continue;
        into.guns += from.guns;
        from.guns = 0;
      }
    }
    if (k.kind === 'charge') b.field.charging[side] = k.sector;
  } else if (k.kind === 'cavalry') {
    b.field.cavalryTask[side] = k.task;
  }
}

/**
 * The enemy sector a side strikes in the flank: having come along two or more roads, it hits the enemy where
 * the enemy's line is thinnest. Several approach roads block nothing by themselves (contract D).
 */
function flankOf(s: GameState, b: BattleState, side: Side, now: number): SectorIndex | null {
  const roads = new Set(activeForces(s, b, side, now).filter((f) => f.men > 0 && f.cameFrom !== null).map((f) => f.cameFrom));
  if (roads.size < 2) return null;
  const enemyIn = (i: SectorIndex) => activeForces(s, b, otherSide(side), now).reduce((n, f) => n + (b.field.alloc[f.id]?.sectors[i].inf ?? 0) + (b.field.alloc[f.id]?.sectors[i].cav ?? 0), 0);
  const held = SECTORS.filter((i) => enemyIn(i) > 0);
  return held.length === 0 ? null : ([...held].sort((x, y) => enemyIn(x) - enemyIn(y) || x - y)[0] as SectorIndex);
}

// ---------------------------------------------------------------------------------- a round (B)

interface Contingent {
  f: Force;
  inf: number;
  cav: number;
  guns: number;
  /** Fighting worth before the side's order, terrain and ammunition. */
  worth: number;
  ammoNeed: number;
}

interface SectorSide {
  order: SectorOrder;
  men: number;
  power: number;
  contingents: Contingent[];
}

/** The fighting worth of one force's troops in a sector: men, mounted cavalry (more in a charge) and guns, readiness, cohesion, fatigue and quality. */
function worthOf(f: Force, t: Troops, at: SectorTemplate, rules: Rules, charging: boolean): number {
  const mounted = f.cavalry === 0 ? 0 : Math.floor((t.cav * effectiveCavalry(f, rules)) / f.cavalry);
  const horse = Math.floor((Math.floor((mounted * at.cavalryPermille) / 1000) * (charging ? rules.battle.chargePermille : 1000)) / 1000);
  const menWorth = t.inf + (t.cav - mounted) + horse + Math.floor((t.guns * rules.battle.gunValue * at.gunsPermille) / 1000);
  const ready = Math.max(0, 1000 - f.gathering * rules.posture.readinessLossPerSlotPermille);
  const steady = Math.floor((Math.floor((menWorth * ready) / 1000) * (500 + Math.floor(f.cohesion / 2))) / 1000);
  return Math.floor((Math.floor((steady * fatiguePermille(f.fatigue, rules)) / 1000) * f.quality) / 1000);
}

/** One snapshot of every sector, both sides, taken before anything is applied (contract B). */
function snapshot(s: GameState, ctx: Context, b: BattleState, orders: Record<Side, SectorOrder[]>, now: number, penalised: Record<Side, boolean>): Record<Side, SectorSide>[] {
  const r = ctx.rules.battle;
  const template = FIELD_TEMPLATES[b.field.template];
  const sectors = SECTORS.map((i) => {
    const at = template.sectors[i];
    const per = {} as Record<Side, SectorSide>;
    for (const side of SIDES) {
      const order = orders[side][i] as SectorOrder;
      const contingents: Contingent[] = [];
      for (const f of activeForces(s, b, side, now)) {
        const t = must(b.field.alloc[f.id], `allocation of ${f.id}`).sectors[i];
        if (t.inf + t.cav + t.guns === 0) continue;
        const ammoNeed = Math.floor(((t.inf + t.cav) * r.ammoPerThousandMen[order]) / 1000) + t.guns * r.ammoPerGun;
        contingents.push({ f, inf: t.inf, cav: t.cav, guns: t.guns, worth: worthOf(f, t, at, ctx.rules, b.field.charging[side] === i), ammoNeed });
      }
      per[side] = { order, men: contingents.reduce((n, c) => n + c.inf + c.cav, 0), power: 0, contingents };
    }
    return per;
  });

  // Ammunition is each force's real stock, spent once across all its sectors (contract B).
  for (const side of SIDES) {
    const need = new Map<ForceId, number>();
    for (const sec of sectors) for (const c of sec[side].contingents) need.set(c.f.id, (need.get(c.f.id) ?? 0) + c.ammoNeed);
    const spentBy = new Map<ForceId, number>();
    for (const [id, n] of [...need.entries()].sort(([a], [c]) => (a < c ? -1 : 1))) {
      const f = must(s.forces[id], id);
      const spent = Math.min(f.stock.ammo, n);
      f.stock.ammo -= spent;
      s.ledger.ammoSpent[side] += spent;
      spentBy.set(id, spent);
    }
    SECTORS.forEach((i) => {
      const sec = (sectors[i] as Record<Side, SectorSide>)[side];
      let needed = 0;
      let got = 0;
      let worth = 0;
      for (const c of sec.contingents) {
        const total = need.get(c.f.id) ?? 0;
        needed += c.ammoNeed;
        got += total === 0 ? 0 : Math.floor(((spentBy.get(c.f.id) ?? 0) * c.ammoNeed) / total);
        worth += c.worth;
      }
      const ammo = needed === 0 ? 1000 : r.noAmmoPowerPermille + Math.floor(((1000 - r.noAmmoPowerPermille) * Math.min(got, needed)) / needed);
      const defence = side === b.attacker ? 1000 : template.sectors[i].defencePermille;
      const ordered = Math.floor((worth * r.orderPowerPermille[sec.order]) / 1000);
      const flanked = b.field.flank[side] === i ? Math.floor((ordered * r.flankPermille) / 1000) : ordered;
      const placed = Math.floor((Math.floor((flanked * defence) / 1000) * ammo) / 1000);
      sec.power = penalised[side] ? Math.floor((placed * (1000 - r.delegatePenaltyPermille)) / 1000) : placed;
    });
  }
  return sectors;
}

/** Casualties a sector's power inflicts on the other side there, before anything is applied. */
function casualties(s: GameState, ctx: Context, b: BattleState, sectors: Record<Side, SectorSide>[]): Record<Side, number[]> {
  const r = ctx.rules.battle;
  const out = { fr: [0, 0, 0], ru: [0, 0, 0] } as Record<Side, number[]>;
  SECTORS.forEach((i) => {
    const sec = sectors[i] as Record<Side, SectorSide>;
    for (const side of SIDES) {
      const enemy = sec[otherSide(side)];
      if (sec[side].men === 0 || enemy.power === 0) continue;
      const hit = Math.floor((enemy.power * r.hitPermille[enemy.order]) / 1000);
      const exposed = Math.floor((hit * r.exposurePermille[sec[side].order]) / 1000);
      const noise = drawBetween(s.dice, ['battle', b.id, b.roundsFought, side, i], 800, 1200);
      (out[side] as number[])[i] = Math.min(sec[side].men, Math.floor((exposed * noise) / 1000));
    }
  });
  return out;
}

/**
 * Men lost in this battle are recorded per force, and by the sub-step they fell in: the outcome counts battle
 * losses, not sickness, over days of fighting, not from the day a battle began (§2.13; second review, D4).
 */
function recordLoss(s: GameState, b: BattleState, f: Force, lost: number): void {
  if (lost <= 0) return;
  b.losses[f.id] = (b.losses[f.id] ?? 0) + lost;
  const at = String(slotIndex(s.resolution));
  const slot = (b.lossesAt[at] ??= {});
  slot[f.id] = (slot[f.id] ?? 0) + lost;
}

const shake = (f: Force, lost: number, before: number, rules: Rules) => {
  f.cohesion = Math.max(0, f.cohesion - Math.floor((lost * rules.battle.cohesionPerLossPermille) / Math.max(1, before)));
};

/** A sector's casualties come out of the infantry and cavalry exposed there; a cavalryman lost costs a horse (contract A). */
function applyCasualties(s: GameState, ctx: Context, b: BattleState, sec: SectorSide, i: SectorIndex, total: number, lostBy: Map<ForceId, number>): void {
  const byForce = apportion(total, sec.contingents.map((c) => c.inf + c.cav));
  sec.contingents.forEach((c, k) => {
    const n = byForce[k] as number;
    if (n === 0) return;
    const [inf, cav] = apportion(n, [c.inf, c.cav]) as [number, number];
    const f = c.f;
    const a = must(b.field.alloc[f.id], `allocation of ${f.id}`).sectors[i];
    const horses = f.cavalry === 0 ? 0 : Math.min(f.horses, Math.floor((cav * effectiveCavalry(f, ctx.rules)) / f.cavalry));
    a.inf -= inf;
    a.cav -= cav;
    f.men -= inf + cav;
    f.cavalry -= cav;
    f.horses -= horses;
    s.ledger.menLost.battle += inf + cav;
    s.ledger.horsesLost += horses;
    recordLoss(s, b, f, inf + cav);
    lostBy.set(f.id, (lostBy.get(f.id) ?? 0) + inf + cav);
  });
}

/** The side whose end of the track a sector has reached: +2 the French have it, −2 the Russians (contract C). */
const loserOf = (control: number): Side | null => (control >= 2 ? 'ru' : control <= -2 ? 'fr' : null);

/** The sectors a side has lost now, from the tracks; losing two loses the position, a shock taken once (contract C). */
export const sectorsLost = (b: BattleState, side: Side): number => b.field.control.filter((c) => loserOf(c) === side).length;

/**
 * One 2-hour round (§3.4a step 5, contracts B–D). Both sides' decisions are given: the Russian one was fixed at
 * the pause, the French one is the player's or the marshal's (`marshal`), neither knowing the other.
 */
export function resolveRound(s: GameState, ctx: Context, b: BattleState, decisions: Record<Side, KeyDecision>, log: LogEntry[], marshal: Record<Side, boolean> = { fr: false, ru: true }): void {
  const r = ctx.rules.battle;
  const now = slotIndex(s.resolution);
  b.roundsFought += 1;
  b.roundsThisSlot += 1;
  note(s, log, 'round', { battle: b.id, round: b.roundsFought, fr: keyLabel(decisions.fr), ru: keyLabel(decisions.ru), frBy: marshal.fr ? 'marshal' : 'player' });

  // Breaking off: with an open or blocked exit at once, with a contested one after a round of falling back (D).
  const exits = { fr: exitStateFor(s, ctx, b, 'fr'), ru: exitStateFor(s, ctx, b, 'ru') };
  // When both sides break off, neither presses the other: both leave at once, each at its own road's cost (D-046).
  const breaking = SIDES.filter((side) => decisions[side].kind === 'breakOff');
  const leavingNow = breaking.length === 2 || breaking.some((side) => exits[side] !== 'contested');
  if (leavingNow) return endWith(s, ctx, b, breaking.map((side) => ({ side, how: 'withdrew' as const })), exits, false, log);
  b.field.charging = { fr: null, ru: null };
  for (const side of SIDES) if (!breaking.includes(side)) applyKey(s, b, side, decisions[side], now);
  b.field.flank = { fr: flankOf(s, b, 'fr', now), ru: flankOf(s, b, 'ru', now) };
  const orders = { fr: [...b.field.orders.fr], ru: [...b.field.orders.ru] } as Record<Side, SectorOrder[]>;
  for (const side of breaking) orders[side] = ['fallBack', 'fallBack', 'fallBack'];

  // Everything below is computed from one snapshot, then applied together (B).
  const before = new Map(SIDES.flatMap((side) => sideForces(s, b, side).map((f) => [f.id, f.men] as const)));
  const sectors = snapshot(s, ctx, b, orders, now, { fr: marshal.fr, ru: false });
  const losses = casualties(s, ctx, b, sectors);
  const steps = SECTORS.map((i) => controlStep(sectors[i] as Record<Side, SectorSide>, ctx.rules, (side, permille) => chance(s.dice, ['control', b.id, b.roundsFought, i, side], permille)));

  const lossesBy = new Map<ForceId, number>();
  for (const side of SIDES) SECTORS.forEach((i) => applyCasualties(s, ctx, b, (sectors[i] as Record<Side, SectorSide>)[side], i, (losses[side] as number[])[i] as number, lossesBy));
  for (const side of SIDES) {
    for (const f of sideForces(s, b, side)) shake(f, lossesBy.get(f.id) ?? 0, before.get(f.id) ?? f.men, ctx.rules);
    for (const f of activeForces(s, b, side, now)) f.fatigue = Math.min(1000, f.fatigue + ctx.rules.fatigue.fightRound);
  }

  // The control track; a sector that falls costs a share of its guns and a shock (C).
  SECTORS.forEach((i) => {
    const was = b.field.control[i];
    const is = Math.max(-2, Math.min(2, was + (steps[i] as number)));
    b.field.control[i] = is;
    const loser = loserOf(is);
    if (loser === null) return;
    for (const f of sideForces(s, b, loser)) {
      const a = must(b.field.alloc[f.id], `allocation of ${f.id}`);
      const there = a.sectors[i];
      if (loserOf(was) !== loser) {
        const taken = Math.floor((there.guns * r.gunsCapturedPermille) / 1000);
        there.guns -= taken;
        f.guns -= taken;
        s.ledger.gunsLost.captured += taken;
        f.cohesion = Math.max(0, f.cohesion - r.sectorLossShock);
      }
      // What is left there falls back into the reserve.
      a.reserve = { inf: a.reserve.inf + there.inf, cav: a.reserve.cav + there.cav, guns: a.reserve.guns + there.guns };
      a.sectors[i] = noTroops();
    }
    if (loserOf(was) !== loser) note(s, log, 'sectorLost', { battle: b.id, side: loser, sector: i });
  });
  note(s, log, 'sectors', { battle: b.id, round: b.roundsFought, control: b.field.control.join(','), frLost: (losses.fr as number[]).reduce((n, x) => n + x, 0), ruLost: (losses.ru as number[]).reduce((n, x) => n + x, 0) });
  for (const side of SIDES) {
    if (b.field.positionLost.includes(side) || sectorsLost(b, side) < 2) continue;
    b.field.positionLost.push(side);
    for (const f of sideForces(s, b, side)) f.cohesion = Math.max(0, f.cohesion - r.positionLossShock);
    note(s, log, 'positionLost', { battle: b.id, side });
  }

  // A rout is a breakdown of cohesion, never a label (C); a side that broke off leaves at the round's end (D).
  const departures: { side: Side; how: 'withdrew' | 'routed' }[] = [];
  for (const side of SIDES) {
    if (sideTotals(s, b, side, now).cohesion < r.breakCohesion) departures.push({ side, how: 'routed' });
    else if (breaking.includes(side)) departures.push({ side, how: 'withdrew' });
  }
  if (departures.length > 0) endWith(s, ctx, b, departures, exits, false, log);
}

/**
 * How far a sector's control moves this round, towards the French positive (contract C). An attacking side
 * gains ground by chance, likelier the more power it has there; the draw is the dice's, keyed by sector and side.
 */
function controlStep(sec: Record<Side, SectorSide>, rules: Rules, draw: (side: Side, permille: number) => boolean): number {
  const { advanceFromPermille: from, advanceSurePermille: sure } = rules.battle;
  const gains = (x: Side): number => {
    const mine = sec[x];
    const theirs = sec[otherSide(x)];
    if (mine.men === 0 || (mine.order !== 'assault' && mine.order !== 'press')) return 0;
    const ratio = theirs.men === 0 || theirs.power === 0 ? Infinity : Math.floor((mine.power * 1000) / theirs.power);
    if (ratio >= sure) return mine.order === 'assault' ? 2 : 1;
    if (ratio <= from) return 0;
    return draw(x, Math.floor(((ratio - from) * 1000) / (sure - from))) ? 1 : 0;
  };
  const yields = (x: Side) => (sec[x].order === 'fallBack' && sec[x].men > 0 ? 1 : 0);
  return gains('fr') + yields('ru') - gains('ru') - yields('fr');
}

// ----------------------------------------------------------------------------- leaving the field

/**
 * Falling back takes time (§3.4a step 4): the force leaves the place at once, as a body, onto the road
 * towards `dest`, and marches the rest of the way in later sub-steps.
 */
export function fallBack(s: GameState, ctx: Context, f: Force, dest: NodeId): void {
  const edge = must(edgeBetween(ctx.graph, f.at, dest), `road ${f.at}–${dest}`);
  f.transit = { edge: edge.id, to: dest, metres: 0, seq: s.roadSeq++ };
  f.arrivedAt = null;
  f.route = [dest];
  f.posture = 'concentrated';
  f.gathering = 0;
  if (f.pace === 'rest') f.pace = 'steady';
}

function abandonGuns(s: GameState, f: Force, permille: number): void {
  const left = Math.floor((f.guns * permille) / 1000);
  f.guns -= left;
  s.ledger.gunsLost.abandoned += left;
  syncAllocation(s, f);
}

/** A side leaves the field: in order with a rearguard, routed, or trapped where no road is open (contracts C, D). */
function leaveField(s: GameState, ctx: Context, b: BattleState, side: Side, how: 'withdrew' | 'routed', exit: ExitState, dest: NodeId | null, night: boolean, log: LogEntry[]): Force[] {
  const r = ctx.rules.battle;
  const gone: Force[] = [];
  let trapped = false;
  // Every corps of the side takes the one road out, at that road's cost (contract D).
  for (const f of sideForces(s, b, side)) {
    if (dest === null) {
      trapped = true;
      recordLoss(s, b, f, loseMen(s, f, Math.floor((f.men * r.trappedLossPermille) / 1000), 'battle'));
      abandonGuns(s, f, 1000);
      note(s, log, 'trapped', { force: f.id, node: b.node });
      continue;
    }
    if (how === 'routed') abandonGuns(s, f, r.routGunsAbandonedPermille);
    else {
      const rate = Math.floor((r.rearguardPermille[exit === 'contested' ? 'contested' : 'open'] * (night ? r.nightWithdrawalPermille : 1000)) / 1000);
      recordLoss(s, b, f, loseMen(s, f, Math.floor((f.men * rate) / 1000), 'withdrawal'));
    }
    fallBack(s, ctx, f, dest);
    gone.push(f);
    note(s, log, 'retreated', { force: f.id, to: dest });
  }
  setResult(b, side, trapped ? 'trapped' : how);
  return gone;
}

function setResult(b: BattleState, side: Side, result: FieldResult): void {
  b.field.result[side] = result;
  if (result !== 'withdrew' && !b.routed.includes(side)) b.routed.push(side);
}

/**
 * Pursuit, once per battle (contract B): the staying side's fresh, mounted cavalry against the leaving side's
 * screen. A routed side has no screen; a contested road makes the screen count for more.
 */
function pursue(s: GameState, ctx: Context, b: BattleState, by: Side, side: Side, routed: boolean, exit: ExitState, gone: Force[], log: LogEntry[]): void {
  const r = ctx.rules.battle;
  b.field.pursued = true;
  const fresh = (f: Force) => Math.floor((Math.floor((effectiveCavalry(f, ctx.rules) * fatiguePermille(f.fatigue, ctx.rules)) / 1000) * f.cohesion) / 1000);
  // Cavalry kept to screen pursues less, and covers its own side's withdrawal better (§2.10).
  const task = (who: Side, screening: number) => (b.field.cavalryTask[who] === 'screen' ? screening : 1000);
  // Only cavalry that has deployed pursues, or screens (contract B; third review).
  const now = slotIndex(s.resolution);
  const deployed = (f: Force) => (b.fightsFrom[f.id] ?? 0) <= now;
  const power = Math.floor((activeForces(s, b, by, now).reduce((n, f) => n + fresh(f), 0) * task(by, r.screeningPursuitPermille)) / 1000);
  const cover = Math.floor((gone.filter(deployed).reduce((n, f) => n + fresh(f), 0) * task(side, r.screeningCoverPermille)) / 1000);
  const screen = routed ? 0 : Math.floor((cover * r.screenPermille[exit === 'contested' ? 'contested' : 'open']) / 1000);
  const men = gone.reduce((n, f) => n + f.men, 0);
  const raw = Math.floor((Math.max(0, power - screen) * (routed ? r.routPursuitPermille : r.pursuitPermille)) / 1000);
  const total = Math.min(raw, Math.floor((men * r.maxPursuitPermille) / 1000));
  const shares = apportion(total, gone.map((f) => f.men));
  gone.forEach((f, k) => {
    const before = f.men;
    const lost = loseMen(s, f, shares[k] as number, 'battle');
    recordLoss(s, b, f, lost);
    shake(f, lost, before, ctx.rules);
  });
  note(s, log, 'pursuit', { battle: b.id, side, by, men: total });
  // Cut down while withdrawing, an orderly retreat can still turn into a rout (C).
  if (!routed && b.field.result[side] === 'withdrew') {
    const left = gone.reduce((n, f) => n + f.men, 0);
    const cohesion = left === 0 ? 0 : Math.floor(gone.reduce((n, f) => n + f.cohesion * f.men, 0) / left);
    if (cohesion < r.breakCohesion) setResult(b, side, 'routed');
  }
}

function endWith(s: GameState, ctx: Context, b: BattleState, departures: { side: Side; how: 'withdrew' | 'routed' }[], exits: Record<Side, ExitState>, night: boolean, log: LogEntry[]): void {
  const stays = SIDES.filter((side) => !departures.some((d) => d.side === side));
  // Each side's road is fixed before either moves; a side turned aside pays the cost of the road it takes.
  const { roads, aside } = departureRoads(s, ctx, b, departures.map((d) => d.side));
  const exit = { ...exits };
  if (aside !== null) exit[aside] = exitStateFor(s, ctx, b, aside, roads.get(aside)?.to ?? null);
  const gone = new Map(departures.map((d) => [d.side, leaveField(s, ctx, b, d.side, d.how, exit[d.side], roads.get(d.side)?.to ?? null, night, log)] as const));
  const winner = stays.length === 1 ? (stays[0] as Side) : null;
  if (winner !== null && !night && !b.field.pursued) {
    const d = departures[0] as { side: Side; how: 'withdrew' | 'routed' };
    pursue(s, ctx, b, winner, d.side, d.how === 'routed', exit[d.side], gone.get(d.side) ?? [], log);
  }
  // Recorded after the pursuit, which can turn a withdrawal into a rout (contract C).
  for (const d of departures) {
    note(s, log, 'fieldResult', { battle: b.id, side: d.side, result: b.field.result[d.side], exit: exit[d.side], to: roads.get(d.side)?.to ?? null, basis: roads.get(d.side)?.basis ?? null, ...(d.side === aside ? { aside: true } : {}) });
  }
  endBattle(s, b, winner, log);
}

function endBattle(s: GameState, b: BattleState, winner: Side | null, log: LogEntry[]): void {
  b.phase = 'over';
  b.winner = winner;
  b.awaiting = null;
  b.hidden = null;
  for (const side of SIDES) for (const f of sideForces(s, b, side)) f.battle = null;
  note(s, log, 'battleEnded', { battle: b.id, winner });
}

/** Nightfall (§3.4a night step 4): a side may slip away in the dark, unpursued; with no road open it is trapped. */
export function resolveNightfall(s: GameState, ctx: Context, b: BattleState, choices: Record<Side, NightChoice>, log: LogEntry[]): void {
  b.lastNight = dayIndex(s.resolution);
  note(s, log, 'nightfall', { battle: b.id, fr: choices.fr, ru: choices.ru });
  const withdrawing = SIDES.filter((side) => choices[side] === 'withdraw');
  if (withdrawing.length === 0) return;
  const exits = { fr: exitStateFor(s, ctx, b, 'fr'), ru: exitStateFor(s, ctx, b, 'ru') };
  endWith(s, ctx, b, withdrawing.map((side) => ({ side, how: 'withdrew' as const })), exits, true, log);
}
