// Battle decisions for the computer side. The same rules answer "delegate to the marshal" for the
// French. Strategic Russian decisions live in russian.ts.

import { sideTotals } from './battle';
import { nextDaylight, slotIndex } from './time';
import type { BattleState, GameState, NightChoice, RoundAction, Side } from './types';
import { otherSide } from './util';

export function decideRound(s: GameState, b: BattleState, side: Side): RoundAction {
  const now = slotIndex(s.resolution);
  const mine = sideTotals(s, b, side, now);
  const theirs = sideTotals(s, b, otherSide(side), now);
  if (mine.cohesion < 350) return 'withdraw';
  if (mine.men * 1000 >= theirs.men * 1300) return 'press';
  return 'hold';
}

/** Weighs everyone who will be on the field at dawn, reinforcements that have just arrived included. */
export function decideNightfall(s: GameState, b: BattleState, side: Side): NightChoice {
  const dawn = slotIndex(nextDaylight(s.resolution));
  const mine = sideTotals(s, b, side, dawn);
  const theirs = sideTotals(s, b, otherSide(side), dawn);
  return mine.cohesion < 450 || mine.men * 1000 < theirs.men * 800 ? 'withdraw' : 'stay';
}
