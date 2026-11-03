// Can reading the situation win? (Independent review, stage F.) A fair adaptive policy chooses one
// approach at the first decision from what the French can see then: their own strength and the scouts'
// estimates of the Russians. It learns its choices on the first half of the seeds and is judged on the
// held-out second half, against the best fixed approach and against two oracles (upper bounds, not
// playable policies): one that knows the scenario but not the dice (it chooses on a scenario's other rolls
// and is scored on this one), and one that knows both. Differences come with intervals from a bootstrap
// over the held-out scenarios. Skipped in normal runs; run with
//   BALANCE=1 BALANCE_SEEDS=1000 BALANCE_DICE=3 npx vitest run tests/balance/adaptive.test.ts
// Each scenario is played with BALANCE_DICE sets of dice, and every policy is scored by its mean rank over
// them. It prints a markdown report between ADAPTIVE-REPORT markers. A diagnostic, not a target.

import { it } from 'vitest';
import { ENDING_NAMES, ENDING_RANK, RULES_VERSION, createContext, evaluate, newGame } from '../../src/engine';
import type { EndingId, GameState } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { keyHash } from '../../src/engine/rng';
import { play } from '../fixtures/driver';
import { BOTS } from './bots';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = Number(env.BALANCE_SEEDS ?? 1000);
const DICE = Math.max(1, Number(env.BALANCE_DICE ?? 1));
const BOOT = Math.max(0, Number(env.BALANCE_BOOT ?? 200));
/** The dice for roll `r` of a scenario seed: the seed itself first, then fresh ones (as in the batch). */
const diceFor = (seed: number, r: number) => (r === 0 ? seed : keyHash(seed, ['dice', r]));

/** What the French know before their first orders: their own strength, and the Russians the scouts report. */
function observed(s: GameState): [number, number] {
  const own = Object.values(s.forces).filter((f) => f.side === 'fr').reduce((n, f) => n + f.men, 0);
  const seen = Object.values(s.intel.fr).reduce((n, x) => n + x.men, 0);
  return [own, seen];
}

const tercile = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const high = sorted[Math.floor((2 * sorted.length) / 3)] ?? 0;
  return (v: number) => (v < low ? 0 : v < high ? 1 : 2);
};

it.skipIf(env.BALANCE !== '1')('adaptive policy on held-out seeds', () => {
  const ctx = createContext(vitebskDecision());
  const candidates = Object.keys(BOTS).filter((n) => n !== 'random');
  // Endings per approach, scenario and roll of the dice.
  const ending: Record<string, EndingId[][]> = Object.fromEntries(candidates.map((n) => [n, []]));
  const features: [number, number][] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    features.push(observed(newGame(ctx, seed)));
    for (const n of candidates) {
      ending[n]!.push(
        Array.from({ length: DICE }, (_, r) => {
          const run = play(ctx, seed, BOTS[n]!(ctx), 5_000, diceFor(seed, r));
          return evaluate(run.states[0]!, run.final, ctx).ending;
        }),
      );
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const rolls = Array.from({ length: DICE }, (_, r) => r);
  /** An approach's mean rank on a scenario, over its rolls of the dice. */
  const rank = (n: string, i: number) => mean(rolls.map((r) => ENDING_RANK[ending[n]![i]![r]!]));
  const half = Math.floor(SEEDS / 2);
  const train = Array.from({ length: half }, (_, i) => i);
  const test = Array.from({ length: SEEDS - half }, (_, i) => half + i);

  // Learn on the training seeds only: terciles of each observation, and the best approach per cell.
  const t0 = tercile(train.map((i) => features[i]![0]));
  const t1 = tercile(train.map((i) => features[i]![1]));
  const cellOf = (i: number) => t0(features[i]![0]) * 3 + t1(features[i]![1]);
  const bestOn = (seeds: number[]) => candidates.reduce((best, n) => (mean(seeds.map((i) => rank(n, i))) < mean(seeds.map((i) => rank(best, i))) ? n : best));
  const fixed = bestOn(train);
  const choice = Array.from({ length: 9 }, (_, c) => {
    const inCell = train.filter((i) => cellOf(i) === c);
    return inCell.length >= 10 ? bestOn(inCell) : fixed;
  });

  // Judge on the held-out seeds.
  const adaptive = test.map((i) => rank(choice[cellOf(i)]!, i));
  const fixedRanks = test.map((i) => rank(fixed, i));
  // Knows which approach suits the scenario, but not how the battles will fall: for each roll it takes the
  // approach best on the scenario's other rolls, and is scored on this one, so it never picks with hindsight
  // of the dice it is judged on (second review, F4). It needs more than one set of dice.
  const onOthers = (n: string, i: number, r: number) => mean(rolls.filter((q) => q !== r).map((q) => ENDING_RANK[ending[n]![i]![q]!]));
  const crossPick = (i: number, r: number) => candidates.reduce((best, n) => (onOthers(n, i, r) < onOthers(best, i, r) ? n : best));
  const scenarioOracle = test.map((i) => mean(rolls.map((r) => ENDING_RANK[ending[crossPick(i, r)]![i]![r]!])));
  // Knows the dice too: the best ending on every roll.
  const fullOracle = test.map((i) => mean(rolls.map((r) => Math.min(...candidates.map((n) => ENDING_RANK[ending[n]![i]![r]!])))));
  /** Share of games won, over every roll. */
  const winsOf = (pick: (i: number, r: number) => EndingId) => {
    const games = test.flatMap((i) => rolls.map((r) => ENDING_RANK[pick(i, r)]));
    return `${((games.filter((x) => x <= 2).length / games.length) * 100).toFixed(1)}%`;
  };
  /** Middle 95% of the mean difference from the best fixed approach, over bootstrap redraws of the held-out scenarios. */
  const versusFixed = (ranks: number[]) => {
    const diffs = ranks.map((x, k) => x - (fixedRanks[k] as number));
    const reps = Array.from({ length: BOOT }, (_, b) => mean(diffs.map((_, k) => diffs[keyHash(1812, ['adaptive-boot', b, k]) % diffs.length]!))).sort((x, y) => x - y);
    const at = (q: number) => reps[Math.round(q * (reps.length - 1))]!;
    return `${mean(diffs) >= 0 ? '+' : ''}${mean(diffs).toFixed(2)}${reps.length > 1 ? ` (${at(0.025).toFixed(2)} to ${at(0.975).toFixed(2)})` : ''}`;
  };
  const bestEnding = (i: number, r: number) => candidates.map((n) => ending[n]![i]![r]!).reduce((a, b) => (ENDING_RANK[b] < ENDING_RANK[a] ? b : a));
  const lines = [
    `# Adaptive policy on held-out seeds: rules ${RULES_VERSION}, seeds 1–${SEEDS}`,
    '',
    `Candidates: ${candidates.join(', ')}. The adaptive policy picks one at the first decision from two things the French see: their own strength and the Russians their scouts report (each in thirds), learned on seeds 1–${half} and judged on seeds ${half + 1}–${SEEDS}. Each scenario is played with ${DICE} set${DICE === 1 ? '' : 's'} of dice and scored by its mean rank over them. A lower rank is better; "won" means Decisive Success, Costly Victory or Operational Success, over every game.`,
    '',
    `| Policy on the held-out seeds | Mean ending rank | Against the best fixed approach (middle 95% of ${BOOT} bootstrap redraws) | Won |`,
    '|---|---|---|---|',
    `| Best fixed approach, chosen on the training seeds (${fixed}) | ${mean(fixedRanks).toFixed(2)} | — | ${winsOf((i, r) => ending[fixed]![i]![r]!)} |`,
    `| Adaptive: reads strength and scouting reports | ${mean(adaptive).toFixed(2)} | ${versusFixed(adaptive)} | ${winsOf((i, r) => ending[choice[cellOf(i)]!]![i]![r]!)} |`,
    ...(DICE > 1 ? [`| Scenario oracle: chooses on a scenario's other rolls, so it knows the scenario but not the dice it is scored on | ${mean(scenarioOracle).toFixed(2)} | ${versusFixed(scenarioOracle)} | ${winsOf((i, r) => ending[crossPick(i, r)]![i]![r]!)} |`] : []),
    `| Full oracle: knows the dice too (includes luck no player can read) | ${mean(fullOracle).toFixed(2)} | ${versusFixed(fullOracle)} | ${winsOf(bestEnding)} |`,
    '',
    '| Each approach on the held-out seeds | Mean ending rank | Most common ending |',
    '|---|---|---|',
    ...candidates.map((n) => {
      const counts = new Map<EndingId, number>();
      for (const i of test) for (const e of ending[n]![i]!) counts.set(e, (counts.get(e) ?? 0) + 1);
      const [top, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
      return `| ${n} | ${mean(test.map((i) => rank(n, i))).toFixed(2)} | ${ENDING_NAMES[top]} (${((count / (test.length * DICE)) * 100).toFixed(1)}%) |`;
    }),
    '',
    `Choices learned per cell (own strength third × scouted Russian strength third): ${choice.map((c, k) => `${Math.floor(k / 3)}${k % 3}: ${c}`).join('; ')}.`,
    '',
    DICE > 1
      ? `**Reading:** a perfect reader of the scenario could improve on the best fixed approach by ${(mean(fixedRanks) - mean(scenarioOracle)).toFixed(2)} ranks on average (knowing the dice as well, by ${(mean(fixedRanks) - mean(fullOracle)).toFixed(2)}); this adaptive policy, reading two figures at the first decision, captures ${(mean(fixedRanks) - mean(adaptive)).toFixed(2)}. That bounds what this policy can read, not what a player can.`
      : '**Reading:** with one set of dice the scenario oracle cannot be separated from luck; run with BALANCE_DICE=3.',
    '',
    '*The intervals redraw the held-out scenarios only; they do not repeat the learning on the training seeds, so they understate the uncertainty of the learned choices.*',
  ];
  console.log(['ADAPTIVE-REPORT-START', ...lines, 'ADAPTIVE-REPORT-END'].join('\n'));
  // 45,000 games ran just over an hour beside the other probes (third review); a time limit is not a result.
}, 10_800_000);
