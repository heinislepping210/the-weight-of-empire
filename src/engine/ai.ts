// Placeholder decision rules. The Russian command of §2.9 replaces planRussianTurn; the same
// battle rules also answer "delegate to the marshal" for the French side.

import { sideTotals } from './battle';
import type { Context } from './scenario';
import type { BattleState, GameState, NightChoice, RoundAction, Side } from './types';
import { otherSide, sortedValues } from './util';

/** Runs once at the start of each turn, like the player's orders (§3.4). */
export function planRussianTurn(s: GameState, _ctx: Context): void {
  for (const f of sortedValues(s.forces)) {
    if (f.side !== 'ru') continue;
    f.route = [];
    f.engagement = 'accept';
  }
}

export function decideRound(s: GameState, b: BattleState, side: Side): RoundAction {
  const mine = sideTotals(s, b, side);
  const theirs = sideTotals(s, b, otherSide(side));
  if (mine.cohesion < 350) return 'withdraw';
  if (mine.men * 1000 >= theirs.men * 1300) return 'press';
  return 'hold';
}

export function decideNightfall(s: GameState, b: BattleState, side: Side): NightChoice {
  const mine = sideTotals(s, b, side);
  const theirs = sideTotals(s, b, otherSide(side));
  return mine.cohesion < 450 || mine.men * 1000 < theirs.men * 800 ? 'withdraw' : 'stay';
}
