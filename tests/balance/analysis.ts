// Summaries for the balance experiments (GAMEPLAY_BALANCING.md §7), kept apart from the batch so that each can be
// checked on data whose answer is known (analysis.test.ts). Lower scores are better throughout: an ending rank.
// Third review, finding 5: F3 is mostly ties, and the earlier F4 adjustment assumed dice independent across
// strategies, while the batch gives every strategy the same dice on a scenario's roll (common random numbers).

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const zeros = (families: readonly string[]) => Object.fromEntries(families.map((f) => [f, 0])) as Record<string, number>;

/**
 * Where each family stood on each scenario, as counts of scenarios. Every scenario falls in exactly one place for
 * each family: best alone, best with some but not all others, all equal, between, last with others, or last alone.
 * `credit` is the earlier F3 share: the best result's credit split evenly among the families sharing it.
 */
export interface Standing {
  bestAlone: Record<string, number>;
  bestShared: Record<string, number>;
  middle: Record<string, number>;
  lastShared: Record<string, number>;
  lastAlone: Record<string, number>;
  credit: Record<string, number>;
  allTied: number;
  /** Scenarios on which two or more families share the best result, all-equal ones included. */
  bestTied: number;
}

export function standing(families: readonly string[], score: (f: string, i: number) => number, scenarios: readonly number[]): Standing {
  const out: Standing = { bestAlone: zeros(families), bestShared: zeros(families), middle: zeros(families), lastShared: zeros(families), lastAlone: zeros(families), credit: zeros(families), allTied: 0, bestTied: 0 };
  for (const i of scenarios) {
    const scores = new Map(families.map((f) => [f, score(f, i)]));
    const top = Math.min(...scores.values());
    const bottom = Math.max(...scores.values());
    const best = families.filter((f) => scores.get(f) === top);
    const last = families.filter((f) => scores.get(f) === bottom);
    for (const f of best) out.credit[f]! += 1 / best.length;
    if (best.length > 1) out.bestTied++;
    if (top === bottom) {
      out.allTied++;
      continue;
    }
    for (const f of families) {
      const place = scores.get(f) === top ? (best.length === 1 ? out.bestAlone : out.bestShared) : scores.get(f) === bottom ? (last.length === 1 ? out.lastAlone : out.lastShared) : out.middle;
      place[f]!++;
    }
  }
  return out;
}

/**
 * Among the scenarios on which several families share the best score, which of those does best on a second
 * criterion (lower is better), its credit split on a further tie: what tells tied approaches apart.
 */
export function withinTies(families: readonly string[], score: (f: string, i: number) => number, second: (f: string, i: number) => number, scenarios: readonly number[]): { scenarios: number; credit: Record<string, number> } {
  const credit = zeros(families);
  let tied = 0;
  for (const i of scenarios) {
    const top = Math.min(...families.map((f) => score(f, i)));
    const best = families.filter((f) => score(f, i) === top);
    if (best.length < 2) continue;
    tied++;
    const low = Math.min(...best.map((f) => second(f, i)));
    const winners = best.filter((f) => second(f, i) === low);
    for (const f of winners) credit[f]! += 1 / winners.length;
  }
  return { scenarios: tied, credit };
}

/**
 * Regret on fresh rolls: how many ranks a choice loses, on a scenario's rolls after the first, against the family
 * that did best on those same rolls (in hindsight, so every choice is measured against the same benchmark).
 * "Always" plays one family on every scenario; "first look" plays the family that did best on the scenario's
 * first roll, ties averaged. Null with a single roll.
 */
export function freshRegret(families: readonly string[], rank: (f: string, i: number, r: number) => number, scenarios: readonly number[], dice: number): { always: Record<string, number>; firstLook: number } | null {
  if (dice < 2) return null;
  const always = zeros(families);
  let firstLook = 0;
  for (const i of scenarios) {
    const fresh = new Map(families.map((f) => [f, mean(Array.from({ length: dice - 1 }, (_, r) => rank(f, i, r + 1)))]));
    const hindsight = Math.min(...fresh.values());
    for (const f of families) always[f]! += fresh.get(f)! - hindsight;
    const top = Math.min(...families.map((f) => rank(f, i, 0)));
    firstLook += mean(families.filter((f) => rank(f, i, 0) === top).map((f) => fresh.get(f)!)) - hindsight;
  }
  for (const f of families) always[f]! /= Math.max(1, scenarios.length);
  return { always, firstLook: firstLook / Math.max(1, scenarios.length) };
}

export interface Shares {
  strategy: number;
  scenario: number;
  interaction: number;
  dice: number;
}

export interface VarianceSplit {
  /** Sums of squares over the total: descriptive. A cell's mean over a few rolls still carries dice noise. */
  raw: Shares;
  /**
   * The earlier adjustment: the variance within a cell, pooled, taken as the noise in every term. It assumes the
   * dice independent across strategies; with dice shared it takes too much from the interaction and too little
   * from the scenario.
   */
  pooled: Shares;
  /**
   * Shares of one game's variance under a model with the dice shared by every strategy on a scenario's roll:
   * model-dependent. `sharedDice` moves every strategy alike on a roll; `ownDice` is the rest of the dice. Null
   * with a single roll, a single strategy or a single scenario.
   */
  components: { strategy: number; scenario: number; interaction: number; sharedDice: number; ownDice: number } | null;
}

/**
 * Splits the variance of a score over strategies × scenarios × rolls, where roll r of a scenario uses the same dice
 * for every strategy. Sums of squares: strategy, scenario, strategy × scenario, the roll within its scenario (as
 * the strategies' mean on it) and the residual; they add up to the total. The components come from the expected
 * mean squares with the scenario and the dice random and the strategies fixed, the interaction summing to zero
 * over the strategies, negative estimates set to zero. `scenarios` may repeat (a bootstrap sample).
 */
export function varianceSplit(x: (s: number, i: number, r: number) => number, strategies: number, scenarios: readonly number[], dice: number): VarianceSplit {
  const [a, b, n] = [strategies, scenarios.length, dice];
  const v = scenarios.map((i) => Array.from({ length: a }, (_, s) => Array.from({ length: n }, (_, r) => x(s, i, r))));
  const cell = v.map((row) => row.map((rolls) => mean(rolls)));
  const ofScenario = cell.map((row) => mean(row));
  const ofStrategy = Array.from({ length: a }, (_, s) => mean(cell.map((row) => row[s]!)));
  const ofRoll = v.map((row) => Array.from({ length: n }, (_, r) => mean(row.map((rolls) => rolls[r]!))));
  const grand = mean(ofScenario);
  const ss = { strategy: 0, scenario: 0, interaction: 0, roll: 0, residual: 0 };
  for (let s = 0; s < a; s++) ss.strategy += b * n * (ofStrategy[s]! - grand) ** 2;
  for (let k = 0; k < b; k++) {
    ss.scenario += a * n * (ofScenario[k]! - grand) ** 2;
    for (let r = 0; r < n; r++) ss.roll += a * (ofRoll[k]![r]! - ofScenario[k]!) ** 2;
    for (let s = 0; s < a; s++) {
      ss.interaction += n * (cell[k]![s]! - ofStrategy[s]! - ofScenario[k]! + grand) ** 2;
      for (let r = 0; r < n; r++) ss.residual += (v[k]![s]![r]! - cell[k]![s]! - ofRoll[k]![r]! + ofScenario[k]!) ** 2;
    }
  }
  const total = Math.max(1e-12, ss.strategy + ss.scenario + ss.interaction + ss.roll + ss.residual);
  const within = ss.roll + ss.residual;
  const raw = { strategy: ss.strategy / total, scenario: ss.scenario / total, interaction: ss.interaction / total, dice: within / total };

  const noise = n > 1 ? within / (a * b * (n - 1)) : 0;
  const adj = { strategy: Math.max(0, ss.strategy - (a - 1) * noise), scenario: Math.max(0, ss.scenario - (b - 1) * noise), interaction: Math.max(0, ss.interaction - (a - 1) * (b - 1) * noise) };
  const pooled = { strategy: adj.strategy / total, scenario: adj.scenario / total, interaction: adj.interaction / total, dice: 1 - (adj.strategy + adj.scenario + adj.interaction) / total };

  if (n < 2 || a < 2 || b < 2) return { raw, pooled, components: null };
  const ms = {
    strategy: ss.strategy / (a - 1),
    scenario: ss.scenario / (b - 1),
    interaction: ss.interaction / ((a - 1) * (b - 1)),
    roll: ss.roll / (b * (n - 1)),
    residual: ss.residual / ((a - 1) * b * (n - 1)),
  };
  const c = {
    strategy: (Math.max(0, ms.strategy - ms.interaction) / (b * n)) * ((a - 1) / a),
    scenario: Math.max(0, ms.scenario - ms.roll) / (a * n),
    interaction: (Math.max(0, ms.interaction - ms.residual) / n) * ((a - 1) / a),
    sharedDice: Math.max(0, ms.roll - ms.residual) / a,
    ownDice: ms.residual,
  };
  const sum = Math.max(1e-12, c.strategy + c.scenario + c.interaction + c.sharedDice + c.ownDice);
  return { raw, pooled, components: { strategy: c.strategy / sum, scenario: c.scenario / sum, interaction: c.interaction / sum, sharedDice: c.sharedDice / sum, ownDice: c.ownDice / sum } };
}
