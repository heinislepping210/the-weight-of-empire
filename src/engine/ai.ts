// Battle decisions for the computer side, and for any French decision left to the marshal: the same rules,
// reading only the state, never the other side's hidden decision (contract B, TECHNICAL_ARCHITECTURE §3.4b).
// Strategic Russian decisions live in russian.ts.

import { FIELD_TEMPLATES, SECTORS, allInReserve, exitStateFor, reserveMen, sideTotals, type Deployment } from './battle';
import type { Context } from './scenario';
import { nextDaylight, slotIndex } from './time';
import type { Allocation, BattleState, FieldTemplateId, ForceId, GameState, KeyDecision, NightChoice, SectorIndex, SectorOrder, Side } from './types';
import { apportion, must, otherSide } from './util';

/**
 * The staff's deployment (§2.10): an attack goes in where the ground favours the defender least, with half
 * the line there; a defence holds every sector alike, its guns where they tell most. The cavalry stands on the
 * ground best for horses, half of it in reserve for the pursuit or the screen. A quarter of the infantry is
 * held back, and the Guard is kept in reserve whole while the side has other troops.
 */
export function deploymentFor(s: GameState, ctx: Context, b: Pick<BattleState, 'sides' | 'attacker'>, side: Side, template: FieldTemplateId): Deployment {
  const r = ctx.rules.battle;
  const sectors = FIELD_TEMPLATES[template].sectors;
  const best = (score: (i: SectorIndex) => number) => [...SECTORS].sort((x, y) => score(y) - score(x) || x - y)[0] as SectorIndex;
  const attacking = side === b.attacker;
  const mainEffort = attacking ? best((i) => -sectors[i].defencePermille) : null;
  const horseGround = best((i) => sectors[i].cavalryPermille);
  const lineWeights = SECTORS.map((i) => (i === mainEffort ? 2 : 1));
  const gunWeights = SECTORS.map((i) => (attacking ? (lineWeights[i] as number) : sectors[i].gunsPermille));

  const forces = b.sides[side].map((id) => must(s.forces[id], id));
  const hasLine = forces.some((f) => f.quality <= 1000);
  const alloc: Record<ForceId, Allocation> = {};
  for (const f of forces) {
    if (f.quality > 1000 && hasLine) {
      alloc[f.id] = allInReserve(f);
      continue;
    }
    const inf = f.men - f.cavalry;
    const heldInf = Math.floor((inf * r.reservePermille) / 1000);
    const heldCav = Math.floor(f.cavalry / 2);
    const line = apportion(inf - heldInf, lineWeights);
    const guns = apportion(f.guns, gunWeights);
    const at = (i: SectorIndex) => ({ inf: line[i] as number, cav: i === horseGround ? f.cavalry - heldCav : 0, guns: guns[i] as number });
    alloc[f.id] = { sectors: [at(0), at(1), at(2)], reserve: { inf: heldInf, cav: heldCav, guns: 0 } };
  }
  const orders = SECTORS.map((i): SectorOrder => (!attacking ? 'hold' : i === mainEffort ? 'assault' : 'press')) as [SectorOrder, SectorOrder, SectorOrder];
  return { alloc, orders, mainEffort };
}

/**
 * The marshal's key decision for a round. He breaks off once the position is lost or cohesion runs low, if a
 * road is open; sends the reserve to counter-attack where the line is giving way, never into a sector already lost; presses with clearly more men, and stops
 * attacking with clearly fewer.
 */
export function decideRound(s: GameState, ctx: Context, b: BattleState, side: Side): KeyDecision {
  const r = ctx.rules.battle;
  const now = slotIndex(s.resolution);
  const mine = sideTotals(s, b, side, now);
  const theirs = sideTotals(s, b, otherSide(side), now);
  if (exitStateFor(s, ctx, b, side) !== 'blocked' && (b.field.positionLost.includes(side) || mine.cohesion < r.withdrawCohesion)) return { kind: 'breakOff' };
  // How far each sector has gone against this side: positive is bad.
  const against = (i: SectorIndex) => (side === 'fr' ? -b.field.control[i] : b.field.control[i]);
  // A sector already lost is given up; one giving way gets the reserve.
  const wavering = SECTORS.filter((i) => against(i) === 1);
  if (reserveMen(s, b, side, now) > 0 && wavering.length > 0) return { kind: 'commitReserve', sector: wavering[0] as SectorIndex };
  if (mine.men * 1000 >= theirs.men * r.pressOddsPermille) return { kind: 'pressAll' };
  if (side === b.attacker && theirs.men * 1000 >= mine.men * r.pressOddsPermille) return { kind: 'holdAll' };
  return { kind: 'continue' };
}

/** At nightfall the marshal weighs everyone on the field at dawn, reinforcements just arrived included. */
export function decideNightfall(s: GameState, ctx: Context, b: BattleState, side: Side): NightChoice {
  const r = ctx.rules.battle;
  if (exitStateFor(s, ctx, b, side) === 'blocked') return 'stay';
  if (b.field.positionLost.includes(side)) return 'withdraw';
  const dawn = slotIndex(nextDaylight(s.resolution));
  const mine = sideTotals(s, b, side, dawn);
  const theirs = sideTotals(s, b, otherSide(side), dawn);
  return mine.cohesion < r.nightWithdrawCohesion || mine.men * 1000 < theirs.men * r.nightOddsPermille ? 'withdraw' : 'stay';
}
