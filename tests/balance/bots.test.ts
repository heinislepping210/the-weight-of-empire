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

  it('the prudent halt declares its halt and never marches on', () => {
    const run = play(ctx, 3, BOTS['prudent-halt']!(ctx));
    expect(run.final.halted).toBe(true);
    expect(run.logs.flat().some((e) => e.kind === 'arrived' && run.final.forces[String(e.detail.force)]?.side === 'fr')).toBe(false);
  });
});
