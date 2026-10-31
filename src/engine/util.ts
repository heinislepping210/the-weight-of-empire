import type { Rules } from './rules';
import type { Force, GameState, LogEntry, LossCause, NodeId, Posture, Side, Supplies } from './types';

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

export function loseMen(s: GameState, f: Force, n: number, cause: LossCause): number {
  const lost = Math.max(0, Math.min(n, f.men));
  f.men -= lost;
  s.ledger.menLost[cause] += lost;
  return lost;
}
