// Battle decisions for the computer side. The same rules answer "delegate to the marshal" for the
// French. Strategic Russian decisions live in russian.ts.

import { sideTotals } from './battle';
import type { BattleState, GameState, NightChoice, RoundAction, Side } from './types';
import { otherSide } from './util';

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
