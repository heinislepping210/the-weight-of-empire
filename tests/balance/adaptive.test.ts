// Can reading the situation win? (Independent review, stage F.) A fair adaptive policy chooses one
// approach at the first decision from what the French can see then: their own strength and the scouts'
// estimates of the Russians. It learns its choices on the first half of the seeds and is judged on the
// held-out second half, against the best fixed approach and against an oracle that knows each ending
// in advance (an upper bound, not a playable policy). Skipped in normal runs; run with
//   BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/adaptive.test.ts
// It prints a markdown report between ADAPTIVE-REPORT markers. A diagnostic, not a target.

import { it } from 'vitest';
import { ENDING_NAMES, ENDING_RANK, RULES_VERSION, createContext, evaluate, newGame } from '../../src/engine';
import type { EndingId, GameState } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { BOTS } from './bots';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = Number(env.BALANCE_SEEDS ?? 1000);

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
  const ending: Record<string, EndingId[]> = Object.fromEntries(candidates.map((n) => [n, []]));
  const features: [number, number][] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    features.push(observed(newGame(ctx, seed)));
    for (const n of candidates) {
      const run = play(ctx, seed, BOTS[n]!(ctx));
      ending[n]!.push(evaluate(run.states[0]!, run.final, ctx).ending);
    }
  }
  const rank = (n: string, i: number) => ENDING_RANK[ending[n]![i]!];
  const half = Math.floor(SEEDS / 2);
  const train = Array.from({ length: half }, (_, i) => i);
  const test = Array.from({ length: SEEDS - half }, (_, i) => half + i);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

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
  const oracle = test.map((i) => Math.min(...candidates.map((n) => rank(n, i))));
  const winShare = (ranks: number[]) => `${((ranks.filter((r) => r <= 2).length / ranks.length) * 100).toFixed(1)}%`;
  const lines = [
    `# Adaptive policy on held-out seeds: rules ${RULES_VERSION}, seeds 1–${SEEDS}`,
    '',
    `Candidates: ${candidates.join(', ')}. The adaptive policy picks one at the first decision from two things the French see: their own strength and the Russians their scouts report (each in thirds), learned on seeds 1–${half} and judged on seeds ${half + 1}–${SEEDS}. A lower rank is better; "won" means Decisive Success, Costly Victory or Operational Success.`,
    '',
    '| Policy on the held-out seeds | Mean ending rank | Won |',
    '|---|---|---|',
    `| Best fixed approach, chosen on the training seeds (${fixed}) | ${mean(fixedRanks).toFixed(2)} | ${winShare(fixedRanks)} |`,
    `| Adaptive: reads strength and scouting reports | ${mean(adaptive).toFixed(2)} | ${winShare(adaptive)} |`,
    `| Oracle: knows each ending in advance (upper bound) | ${mean(oracle).toFixed(2)} | ${winShare(oracle)} |`,
    '',
    '| Each approach on the held-out seeds | Mean ending rank | Most common ending |',
    '|---|---|---|',
    ...candidates.map((n) => {
      const counts = new Map<EndingId, number>();
      for (const i of test) counts.set(ending[n]![i]!, (counts.get(ending[n]![i]!) ?? 0) + 1);
      const [top, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
      return `| ${n} | ${mean(test.map((i) => rank(n, i))).toFixed(2)} | ${ENDING_NAMES[top]} (${((count / test.length) * 100).toFixed(1)}%) |`;
    }),
    '',
    `Choices learned per cell (own strength third × scouted Russian strength third): ${choice.map((c, k) => `${Math.floor(k / 3)}${k % 3}: ${c}`).join('; ')}.`,
    '',
    `**Reading:** a perfect reader of the situation could improve on the best fixed approach by ${(mean(fixedRanks) - mean(oracle)).toFixed(2)} ranks on average; the adaptive policy captures ${(mean(fixedRanks) - mean(adaptive)).toFixed(2)} of that from what the French can actually see.`,
  ];
  console.log(['ADAPTIVE-REPORT-START', ...lines, 'ADAPTIVE-REPORT-END'].join('\n'));
}, 3_600_000);
