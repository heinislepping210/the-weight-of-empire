// Battle resolution. The round model is a placeholder that already obeys the timeline rules
// (time, ammunition, exclusivity); the sector system of §2.10 replaces its combat maths.

import { edgeBetween, neighboursOf, roadDistance } from './graph';
import { drawBetween } from './rng';
import type { Context } from './scenario';
import { dayIndex, slotIndex } from './time';
import type { BattleState, Force, GameState, LogEntry, NightChoice, NodeId, RoundAction, Side } from './types';
import { enemyPresent, fatiguePermille, loseMen, must, note, otherSide, sortedValues } from './util';

export const SIDES: readonly Side[] = ['fr', 'ru'];

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

/** An enemy column on this road marching towards `node`. */
export function oncoming(s: GameState, side: Side, edgeId: string, node: NodeId): boolean {
  return Object.values(s.forces).some((f) => f.side !== side && f.men > 0 && f.transit !== null && f.transit.edge === edgeId && f.transit.to === node);
}

/**
 * The neighbouring place, free of the enemy, that lies nearest to one of the side's own depots: beaten
 * forces fall back towards home. A road with an enemy column coming the other way is no line of retreat.
 * A force that marched into the place falls back the way it came (`back`) if that road is open, never on
 * through the enemy it attacked (D-042).
 */
export function retreatNodeFor(s: GameState, ctx: Context, node: NodeId, side: Side, back: NodeId | null = null): NodeId | null {
  const options = neighboursOf(ctx.graph, node)
    .filter((n) => !enemyPresent(s, side, n.node) && !oncoming(s, side, n.edge.id, node))
    .map((n) => n.node);
  if (back !== null && options.includes(back)) return back;
  const homes = sortedValues(s.depots)
    .filter((d) => d.side === side)
    .map((d) => d.node);
  let best: NodeId | null = null;
  let bestDistance = Infinity;
  for (const option of options) {
    const distance = homes.length === 0 ? 0 : Math.min(...homes.map((h) => roadDistance(ctx.graph, option, h)));
    if (best === null || distance < bestDistance) {
      best = option;
      bestDistance = distance;
    }
  }
  return best;
}

function spendAmmo(forces: Force[], need: number): number {
  let left = need;
  for (const f of forces) {
    const take = Math.min(f.stock.ammo, left);
    f.stock.ammo -= take;
    left -= take;
  }
  return need - left;
}

/** Men lost in this battle are recorded per force: the outcome counts battle losses, not sickness (§2.13). */
function recordLoss(b: BattleState, f: Force, lost: number): void {
  if (lost > 0) b.losses[f.id] = (b.losses[f.id] ?? 0) + lost;
}

function inflict(s: GameState, b: BattleState, forces: Force[], total: number): void {
  const men = forces.reduce((n, f) => n + f.men, 0);
  if (men === 0 || total <= 0) return;
  const target = Math.min(total, men);
  let left = target;
  for (const f of forces) {
    const before = f.men;
    const lost = loseMen(s, f, Math.min(Math.floor((target * before) / men), left), 'battle');
    recordLoss(b, f, lost);
    left -= lost;
    f.cohesion = Math.max(0, f.cohesion - Math.floor((lost * 2000) / Math.max(1, before)));
  }
  for (const f of forces) {
    if (left <= 0) break;
    const lost = loseMen(s, f, left, 'battle');
    recordLoss(b, f, lost);
    left -= lost;
  }
}

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

function withdrawSide(s: GameState, ctx: Context, b: BattleState, side: Side, log: LogEntry[]): void {
  const { engagement, battle } = ctx.rules;
  for (const f of sideForces(s, b, side)) {
    const dest = retreatNodeFor(s, ctx, b.node, side, side === b.attacker ? f.cameFrom : null);
    if (dest) {
      recordLoss(b, f, loseMen(s, f, Math.floor((f.men * engagement.withdrawalLossPermille) / 1000), 'withdrawal'));
      fallBack(s, ctx, f, dest);
      note(s, log, 'retreated', { force: f.id, to: dest });
    } else {
      recordLoss(b, f, loseMen(s, f, Math.floor((f.men * battle.trappedLossPermille) / 1000), 'battle'));
      if (!b.routed.includes(side)) b.routed.push(side);
      note(s, log, 'trapped', { force: f.id, node: b.node });
    }
  }
}

function endBattle(s: GameState, b: BattleState, winner: Side | null, log: LogEntry[]): void {
  b.phase = 'over';
  b.winner = winner;
  b.awaiting = null;
  b.hidden = null;
  for (const side of SIDES) for (const f of sideForces(s, b, side)) f.battle = null;
  note(s, log, 'battleEnded', { battle: b.id, winner });
}

function endByWithdrawal(s: GameState, ctx: Context, b: BattleState, withdrawing: Side[], log: LogEntry[]): void {
  for (const side of withdrawing) withdrawSide(s, ctx, b, side, log);
  endBattle(s, b, withdrawing.length === 2 ? null : otherSide(withdrawing[0] as Side), log);
}

/** One 2-hour round (§3.4a step 5): uses only ammunition carried at this moment. */
export function resolveRound(s: GameState, ctx: Context, b: BattleState, acts: Record<Side, RoundAction>, log: LogEntry[]): void {
  const r = ctx.rules.battle;
  b.roundsFought += 1;
  b.roundsThisSlot += 1;
  note(s, log, 'round', { battle: b.id, round: b.roundsFought, fr: acts.fr, ru: acts.ru });

  const withdrawing = SIDES.filter((side) => acts[side] === 'withdraw');
  if (withdrawing.length > 0) return endByWithdrawal(s, ctx, b, withdrawing, log);

  // Reinforcements still deploying take no part: no losses, ammunition or fatigue from this round.
  const now = slotIndex(s.resolution);
  const power: Record<Side, number> = { fr: 0, ru: 0 };
  for (const side of SIDES) {
    const t = sideTotals(s, b, side, now);
    // Men of a force still gathering from dispersal are not yet all on the field (§2.4b).
    const ready = activeForces(s, b, side, now).reduce(
      (n, f) => n + Math.floor((f.men * Math.max(0, 1000 - f.gathering * ctx.rules.posture.readinessLossPerSlotPermille)) / 1000),
      0,
    );
    const need = Math.floor((ready * r.ammoPerThousandMen[acts[side]]) / 1000);
    const spent = spendAmmo(activeForces(s, b, side, now), need);
    s.ledger.ammoSpent[side] += spent;
    const base = Math.floor((ready * (500 + Math.floor(t.cohesion / 2))) / 1000);
    const tired = Math.floor((base * fatiguePermille(t.fatigue, ctx.rules)) / 1000);
    power[side] = spent < need ? Math.floor((tired * r.noAmmoPowerPermille) / 1000) : tired;
  }

  for (const side of SIDES) {
    const enemy = otherSide(side);
    const rate = r.casualtyPermille[acts[enemy]] + (acts[side] === 'press' ? r.pressExposurePermille : 0);
    let losses = Math.floor((power[enemy] * rate) / 1000);
    if (side !== b.attacker && acts[side] === 'hold') losses = Math.floor((losses * r.defenderHoldPermille) / 1000);
    losses = Math.floor((losses * drawBetween(s.dice, ['battle', b.id, b.roundsFought, side], 800, 1200)) / 1000);
    inflict(s, b, activeForces(s, b, side, now), losses);
  }

  for (const side of SIDES) for (const f of activeForces(s, b, side, now)) f.fatigue = Math.min(1000, f.fatigue + ctx.rules.fatigue.fightRound);

  // A side whose cohesion gives way breaks: a rout, not an orderly withdrawal (§2.13).
  const broken = SIDES.filter((side) => sideTotals(s, b, side, now).cohesion < r.breakCohesion);
  for (const side of broken) if (!b.routed.includes(side)) b.routed.push(side);
  if (broken.length > 0) endByWithdrawal(s, ctx, b, broken, log);
}

export function resolveNightfall(s: GameState, ctx: Context, b: BattleState, choices: Record<Side, NightChoice>, log: LogEntry[]): void {
  b.lastNight = dayIndex(s.resolution);
  note(s, log, 'nightfall', { battle: b.id, fr: choices.fr, ru: choices.ru });
  const withdrawing = SIDES.filter((side) => choices[side] === 'withdraw');
  if (withdrawing.length > 0) endByWithdrawal(s, ctx, b, withdrawing, log);
}
