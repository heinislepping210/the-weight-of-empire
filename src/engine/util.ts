import type { Rules } from './rules';
import type { Allocation, Force, GameState, LogEntry, LossCause, NodeId, Posture, Side, Supplies, Troops } from './types';

/** Values in key order — every iteration over state goes through this, so results never depend on insertion order. */
export function sortedValues<T>(record: Record<string, T>): T[] {
  return Object.keys(record)
    .sort()
    .map((key) => record[key] as T);
}

export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`missing ${what}`);
  return value;
}

export const otherSide = (side: Side): Side => (side === 'fr' ? 'ru' : 'fr');

export const emptySupplies = (): Supplies => ({ food: 0, fodder: 0, ammo: 0 });

export function addInto(target: Supplies, extra: Supplies): void {
  target.food += extra.food;
  target.fodder += extra.fodder;
  target.ammo += extra.ammo;
}

export function note(s: GameState, log: LogEntry[], kind: string, detail: LogEntry['detail'] = {}): void {
  const { turn, slot, stage } = s.resolution;
  log.push({ turn, slot, stage, kind, detail });
}

/** Speed and fighting power fall once fatigue passes the threshold, down to half at exhaustion. */
export function fatiguePermille(fatigue: number, rules: Rules): number {
  const from = rules.march.fatigueSlowdownFrom;
  return fatigue <= from ? 1000 : Math.max(500, 1000 - (fatigue - from));
}

export function enemyPresent(s: GameState, side: Side, node: NodeId): boolean {
  return Object.values(s.forces).some((f) => f.side !== side && f.at === node && f.transit === null && f.men > 0);
}

export function place(f: Force, node: NodeId): void {
  f.at = node;
  f.transit = null;
  f.route = [];
}

/** Posture changes follow the same rule for both sides: dispersing is immediate, concentrating takes gathering time (§2.4b). */
export function setPosture(f: Force, posture: Posture, rules: Rules): void {
  if (posture === 'dispersed') {
    f.posture = 'dispersed';
    f.gathering = 0;
  } else if (f.posture === 'dispersed' && f.gathering === 0) {
    f.gathering = rules.posture.gatherSlots;
  }
}

/**
 * Men lost to any cause outside the fighting in a sector: every arm loses in proportion, and a force in
 * battle has its allocation rescaled at once, so every man stays counted once (contract A, §3.4b).
 */
export function loseMen(s: GameState, f: Force, n: number, cause: LossCause): number {
  const lost = Math.max(0, Math.min(n, f.men));
  if (lost === 0) return 0;
  const cavalryLost = Math.min(f.cavalry, Math.round((lost * f.cavalry) / f.men));
  f.men -= lost;
  f.cavalry = Math.min(f.cavalry - cavalryLost, f.men);
  s.ledger.menLost[cause] += lost;
  syncAllocation(s, f);
  return lost;
}

/** Fits a force's battle allocation to its present infantry, cavalry and guns. */
export function syncAllocation(s: GameState, f: Force): void {
  const field = f.battle === null ? undefined : s.battles[f.battle]?.field;
  const a = field?.alloc[f.id];
  if (field && a) field.alloc[f.id] = fitAllocation(a, { inf: f.men - f.cavalry, cav: f.cavalry, guns: f.guns });
}

/**
 * Splits `total` in proportion to `weights` by the largest remainder, ties to the earlier slot; with no
 * weight anywhere, all of it to the last slot. Integer and deterministic.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((n, w) => n + w, 0);
  if (sum === 0) return weights.map((_, i) => (i === weights.length - 1 ? total : 0));
  const out = weights.map((w) => Math.floor((total * w) / sum));
  // What flooring left over is less than one per slot: it goes to the largest remainders.
  let left = total - out.reduce((n, x) => n + x, 0);
  const order = weights.map((w, i) => ({ i, rest: (total * w) % sum })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left === 0) break;
    out[i] = (out[i] as number) + 1;
    left -= 1;
  }
  return out;
}

/** The allocation rescaled to new totals, each arm in proportion to where it stood (contract A). */
export function fitAllocation(a: Allocation, to: Troops): Allocation {
  const places = [...a.sectors, a.reserve];
  const arm = (k: keyof Troops) => apportion(to[k], places.map((t) => t[k]));
  const [inf, cav, guns] = [arm('inf'), arm('cav'), arm('guns')];
  const at = (i: number): Troops => ({ inf: inf[i] as number, cav: cav[i] as number, guns: guns[i] as number });
  return { sectors: [at(0), at(1), at(2)], reserve: at(3) };
}
