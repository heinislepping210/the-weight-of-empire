import { describe, expect, it } from 'vitest';
import { ENDING_NAMES, createContext, evaluate } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { BOTS } from './bots';

const ctx = createContext(vitebskDecision());

describe('strategy bots (smoke test; the full batch runs with BALANCE=1)', () => {
  for (const [name, make] of Object.entries(BOTS)) {
    it(`${name} plays the scenario to an evaluated end without breaking any invariant`, () => {
      for (const seed of [1, 2]) {
        const run = play(ctx, seed, make(ctx));
        expect(run.final.ended).toBe('scenarioEnd');
        expect(violations(run)).toEqual([]);
        expect(Object.keys(ENDING_NAMES)).toContain(evaluate(run.states[0]!, run.final, ctx).ending);
      }
    });
  }

  it('the prudent halt declares its halt and never advances: its groups move only when forced to fall back', () => {
    const run = play(ctx, 3, BOTS['prudent-halt']!(ctx));
    expect(run.final.halted).toBe(true);
    const entries = run.logs.flat();
    const french = (id: unknown) => run.final.forces[String(id)]?.side === 'fr';
    // Places French groups were driven back to: after a battle, a skirmish or a withdrawal.
    const fellBackTo = new Set(
      entries.flatMap((e) =>
        (e.kind === 'retreated' && french(e.detail.force)) || (e.kind === 'minorAction' && e.detail.retreated === 'fr') || (e.kind === 'withdrawal' && e.detail.side === 'fr' && e.detail.success)
          ? [String(e.detail.to)]
          : [],
      ),
    );
    for (const e of entries.filter((x) => x.kind === 'arrived' && french(x.detail.force))) expect(fellBackTo.has(String(e.detail.node)), String(e.detail.node)).toBe(true);
  });
});
