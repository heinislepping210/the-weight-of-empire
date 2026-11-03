import { describe, expect, it } from 'vitest';
import { createContext, evaluate, lossPermille, percent, statusOf, when } from '../../src/engine';
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
    expect(summary.verdict).toBeNull();
  });

  it('a run saved in the middle of a turn is dated by the moment it was saved', () => {
    const cut = run.states.findIndex((s) => statusOf(s).kind === 'awaitingBattleInput' && s.resolution.slot > 0);
    expect(cut).toBeGreaterThan(0);
    const summary = summarize(run.states.slice(0, cut + 1), run.logs.slice(0, cut), ctx, 'mid-turn', 1812);
    const dates = summary.series.map((p) => p.date);
    expect(dates.at(-1)).toBe(when(ctx, run.states[cut]!.resolution));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('a finished run reveals the Russian side for the debrief', () => {
    const summary = summarize(run.states, run.logs, ctx, 'finished', 1812);
    expect(summary.ended).toBe(true);
    expect(summary.russianPlans?.length).toBeGreaterThan(0);
    expect(summary.finalPositions?.length).toBeGreaterThan(0);
    for (const point of summary.series) expect(point.ruMen).toBeGreaterThan(0);
  });

  it('a finished run keeps the verdict the end screen gave, with the same figures and rounding (third review)', () => {
    const summary = summarize(run.states, run.logs, ctx, 'finished', 1812);
    const o = evaluate(run.states[0]!, run.final, ctx);
    expect(summary.verdict).toMatchObject({ ending: o.ending, russian: o.russian, holdsKeyGround: o.holdsKeyGround, reasons: o.reasons, russianMainLostPermille: o.russianMainLostPermille });
    // What Compare shows for an unfinished run follows the evaluator's rule, so the two never differ by a rounding.
    const [first, last] = [summary.series[0]!, summary.series.at(-1)!];
    expect(lossPermille(first.frMen, last.frMen)).toBe(o.frenchMenLostPermille);
    expect(lossPermille(first.frHorses, last.frHorses)).toBe(o.frenchHorsesLostPermille);
    expect(o.reasons.some((r) => r.includes(percent(o.frenchMenLostPermille)))).toBe(true);
  });
});
