// The experiment summaries checked on data whose answer is known (third review, finding 5).

import { describe, expect, it } from 'vitest';
import { keyHash } from '../../src/engine/rng';
import { freshRegret, standing, varianceSplit, withinTies } from './analysis';

describe('F3: who is best, who shares it, who is last', () => {
  // Three families on five scenarios (lower is better).
  const table: Record<string, number[]> = {
    a: [1, 3, 3, 2, 1],
    b: [1, 3, 2, 3, 2],
    c: [2, 3, 1, 1, 3],
  };
  const score = (f: string, i: number) => table[f]![i]!;
  const all = [0, 1, 2, 3, 4];

  it('puts every scenario in one place for each family', () => {
    const st = standing(['a', 'b', 'c'], score, all);
    expect(st.allTied).toBe(1); // scenario 1
    expect(st.bestTied).toBe(2); // scenarios 0 and 1
    expect(st.bestShared).toEqual({ a: 1, b: 1, c: 0 }); // scenario 0
    expect(st.lastAlone).toEqual({ a: 1, b: 1, c: 2 }); // 2; 3; 0 and 4
    expect(st.bestAlone).toEqual({ a: 1, b: 0, c: 2 }); // 4; 2 and 3
    expect(st.lastShared).toEqual({ a: 0, b: 0, c: 0 });
    expect(st.middle).toEqual({ a: 1, b: 2, c: 0 });
    for (const f of ['a', 'b', 'c']) expect(st.bestAlone[f]! + st.bestShared[f]! + st.middle[f]! + st.lastShared[f]! + st.lastAlone[f]! + st.allTied).toBe(all.length);
    // The earlier fractional share: ties split evenly.
    expect(st.credit.a).toBeCloseTo(0.5 + 1 / 3 + 1);
    expect(st.credit.c).toBeCloseTo(1 / 3 + 2);
  });

  it('within a tie, credits the family best on the second criterion', () => {
    const lost: Record<string, number[]> = { a: [20, 15, 0, 0, 0], b: [18, 15, 0, 0, 0], c: [0, 30, 0, 0, 0] };
    const w = withinTies(['a', 'b', 'c'], score, (f, i) => lost[f]![i]!, all);
    expect(w.scenarios).toBe(2);
    // Scenario 0: b (18) beats a (20); c is not in the tie. Scenario 1: a and b share it at 15.
    expect(w.credit).toEqual({ a: 0.5, b: 1.5, c: 0 });
  });

  it('measures regret on the rolls after the first, against the best on those rolls', () => {
    // rank[f][i][r]: on scenario 0 the first roll favours a, the fresh rolls b; on scenario 1 a tie on the first roll.
    const rank: Record<string, number[][]> = {
      a: [[1, 3, 3], [2, 2, 2]],
      b: [[2, 1, 1], [2, 3, 3]],
    };
    const r = freshRegret(['a', 'b'], (f, i, k) => rank[f]![i]![k]!, [0, 1], 3)!;
    expect(r.always.a).toBeCloseTo((2 + 0) / 2);
    expect(r.always.b).toBeCloseTo((0 + 1) / 2);
    // First look picks a on scenario 0 (2 ranks lost) and both on scenario 1 (mean of 0 and 1).
    expect(r.firstLook).toBeCloseTo((2 + 0.5) / 2);
    expect(freshRegret(['a', 'b'], () => 1, [0], 1)).toBeNull();
  });
});

describe('F4: splitting the variance with the dice shared across strategies', () => {
  /** A standard normal draw, deterministic in its key. */
  const normal = (key: (string | number)[]) => {
    const u = (keyHash(4242, [...key, 'u']) + 0.5) / 2 ** 32;
    const v = (keyHash(4242, [...key, 'v']) + 0.5) / 2 ** 32;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const A = 3;
  const N = 3;
  const scenarios = Array.from({ length: 4_000 }, (_, i) => i);
  const alpha = [0, 0.6, -0.6];

  /** Scores with known parts: strategy, scenario, interaction drawn per cell, dice shared on a roll, dice of each strategy. */
  function synthetic(sd: { scenario: number; interaction: number; shared: number; own: number }) {
    const x = (s: number, i: number, r: number) => alpha[s]! + sd.scenario * normal(['scenario', i]) + sd.interaction * normal(['cell', s, i]) + sd.shared * normal(['roll', i, r]) + sd.own * normal(['own', s, i, r]);
    // The interaction is drawn per cell; measured from the scenario's mean over the strategies, (A − 1)/A of its
    // variance is interaction and 1/A joins the scenario.
    const truth = {
      strategy: alpha.reduce((n, v) => n + v * v, 0) / A,
      scenario: sd.scenario ** 2 + sd.interaction ** 2 / A,
      interaction: (sd.interaction ** 2 * (A - 1)) / A,
      sharedDice: sd.shared ** 2,
      ownDice: sd.own ** 2,
    };
    const sum = Object.values(truth).reduce((n, v) => n + v, 0);
    const shares = Object.fromEntries(Object.entries(truth).map(([k, v]) => [k, v / sum])) as typeof truth;
    return { split: varianceSplit(x, A, scenarios, N), shares };
  }

  it('the sums of squares add up to the total', () => {
    const { split } = synthetic({ scenario: 0.5, interaction: 0.7, shared: 0.6, own: 0.5 });
    const r = split.raw;
    expect(r.strategy + r.scenario + r.interaction + r.dice).toBeCloseTo(1, 9);
  });

  it('recovers known components when the dice are shared, where the pooled adjustment does not', () => {
    const { split, shares } = synthetic({ scenario: 0.5, interaction: 0.7, shared: 0.9, own: 0.5 });
    const c = split.components!;
    for (const k of ['strategy', 'scenario', 'interaction', 'sharedDice', 'ownDice'] as const) expect(Math.abs(c[k] - shares[k]), k).toBeLessThan(0.025);
    // The pooled adjustment takes the shared dice out of the interaction and leaves them in the scenario; here
    // each by about (A − 1)/A × 0.81/N of a variance of 2.04, some 9 points.
    expect(shares.interaction - split.pooled.interaction).toBeGreaterThan(0.05);
    expect(split.pooled.scenario - shares.scenario).toBeGreaterThan(0.05);
  });

  it('agrees with the pooled adjustment when the dice are independent across strategies', () => {
    const { split, shares } = synthetic({ scenario: 0.5, interaction: 0.7, shared: 0, own: 0.8 });
    const c = split.components!;
    expect(c.sharedDice).toBeLessThan(0.01);
    for (const k of ['strategy', 'scenario', 'interaction'] as const) {
      expect(Math.abs(c[k] - shares[k]), k).toBeLessThan(0.025);
      expect(Math.abs(split.pooled[k] - shares[k]), `pooled ${k}`).toBeLessThan(0.025);
    }
  });

  it('finds no strategy or interaction where there is none', () => {
    const x = (_s: number, i: number, r: number) => normal(['scenario', i]) + normal(['roll', i, r]);
    const c = varianceSplit(x, A, scenarios, N).components!;
    expect(c.strategy).toBeLessThan(0.01);
    expect(c.interaction).toBeLessThan(0.01);
    expect(c.ownDice).toBeLessThan(0.01);
    expect(varianceSplit(x, A, scenarios, 1).components).toBeNull();
  });
});
