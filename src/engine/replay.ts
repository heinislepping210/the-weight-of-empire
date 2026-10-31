import { advance } from './advance';
import type { Context } from './scenario';
import type { GameState, Input } from './types';

/**
 * Replays an input log from a starting state. Each input must fit the pause it was recorded at;
 * a mismatch means a corrupted log or a different rules version (§3.4).
 */
export function replay(start: GameState, inputs: readonly Input[], ctx: Context): GameState {
  let s = start;
  inputs.forEach((input, i) => {
    const result = advance(s, input, ctx);
    if (!result.ok) throw new Error(`input ${i + 1} of ${inputs.length} does not fit this game: ${result.reason}`);
    s = result.state;
  });
  return s;
}
