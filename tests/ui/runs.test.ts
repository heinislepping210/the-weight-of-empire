import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { summarize } from '../../src/ui/runs';
import { BOTS } from '../balance/bots';
import { play } from '../fixtures/driver';

describe('saved runs for comparison keep the fog of war (§2.8)', () => {
  const ctx = createContext(vitebskDecision());
  const run = play(ctx, 1812, BOTS['concentrated-push']!(ctx));

  it('an unfinished run stores nothing the French do not know', () => {
    const cut = run.states.findIndex((s) => s.resolution.turn === 3);
    const summary = summarize(run.states.slice(0, cut + 1), run.logs.slice(0, cut), ctx, 'unfinished', 1812);
    expect(summary.ended).toBe(false);
    expect(summary.russianPlans).toBeNull();
    expect(summary.finalPositions).toBeNull();
    for (const point of summary.series) expect(point.ruMen).toBeNull();
  });

  it('a finished run reveals the Russian side for the debrief', () => {
    const summary = summarize(run.states, run.logs, ctx, 'finished', 1812);
    expect(summary.ended).toBe(true);
    expect(summary.russianPlans?.length).toBeGreaterThan(0);
    expect(summary.finalPositions?.length).toBeGreaterThan(0);
    for (const point of summary.series) expect(point.ruMen).toBeGreaterThan(0);
  });
});
