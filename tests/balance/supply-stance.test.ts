// Paired supply-stance probe (independent review, stage B): the same bots on the same seeds, once
// bringing the depots forward and once keeping them. The bots decide as they go, so their later orders may
// differ as supply changes: a paired comparison of two policies, not a replay of fixed orders (second review, F6).
// Skipped in normal runs; run with
//   BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/supply-stance.test.ts
// It prints a markdown table between SUPPLY-REPORT markers. A diagnostic, not a target.

import { expect, it } from 'vitest';
import { ENDING_NAMES, ENDING_RANK, RULES_VERSION, createContext, evaluate } from '../../src/engine';
import type { EndingId } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { botsWithSupply } from './bots';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = Number(env.BALANCE_SEEDS ?? 1000);

it.skipIf(env.BALANCE !== '1')('paired supply-stance probe', () => {
  const ctx = createContext(vitebskDecision());
  const forward = botsWithSupply('forward');
  const hold = botsWithSupply('hold');
  const names = Object.keys(forward).filter((n) => n !== 'prudent-halt');
  const problems: string[] = [];
  const lines = [
    `# Paired supply-stance probe: rules ${RULES_VERSION}, seeds 1–${SEEDS}`,
    '',
    'Same bots and seeds; only the supply stance differs. The bots decide as they go, so their later orders may differ as supply changes: this compares two policies, not two replays of the same orders. A lower ending rank is better. "Same rank" counts endings of equal rank, which may be different endings (Costly Victory and Operational Success share a rank).',
    '',
    '| Strategy | Forward better | Same rank | Hold better | Mean rank, forward / hold | French men lost, forward / hold | Food days at end, forward / hold | Most common ending, forward / hold |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const name of names) {
    let better = 0;
    let same = 0;
    let worse = 0;
    const sums = { fRank: 0, hRank: 0, fLost: 0, hLost: 0, fFood: 0, hFood: 0 };
    const endings: Record<'f' | 'h', Map<EndingId, number>> = { f: new Map(), h: new Map() };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const runF = play(ctx, seed, forward[name]!(ctx));
      const runH = play(ctx, seed, hold[name]!(ctx));
      for (const v of [...violations(runF), ...violations(runH)]) problems.push(`${name} seed ${seed}: ${v}`);
      const f = evaluate(runF.states[0]!, runF.final, ctx);
      const h = evaluate(runH.states[0]!, runH.final, ctx);
      const rf = ENDING_RANK[f.ending];
      const rh = ENDING_RANK[h.ending];
      if (rf < rh) better++;
      else if (rf === rh) same++;
      else worse++;
      sums.fRank += rf;
      sums.hRank += rh;
      sums.fLost += f.frenchMenLostPermille / 10;
      sums.hLost += h.frenchMenLostPermille / 10;
      sums.fFood += f.frenchFoodDays;
      sums.hFood += h.frenchFoodDays;
      endings.f.set(f.ending, (endings.f.get(f.ending) ?? 0) + 1);
      endings.h.set(h.ending, (endings.h.get(h.ending) ?? 0) + 1);
    }
    const pct = (n: number) => `${((n / SEEDS) * 100).toFixed(1)}%`;
    const mode = (m: Map<EndingId, number>) => {
      const [e, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]!;
      return `${ENDING_NAMES[e]} (${pct(n)})`;
    };
    const avg = (x: number) => (x / SEEDS).toFixed(1);
    lines.push(
      `| ${name} | ${pct(better)} | ${pct(same)} | ${pct(worse)} | ${avg(sums.fRank)} / ${avg(sums.hRank)} | ${avg(sums.fLost)}% / ${avg(sums.hLost)}% | ${avg(sums.fFood)} / ${avg(sums.hFood)} | ${mode(endings.f)} / ${mode(endings.h)} |`,
    );
  }
  lines.push('', `**Invariant violations: ${problems.length}**`);
  console.log(['SUPPLY-REPORT-START', ...lines, 'SUPPLY-REPORT-END'].join('\n'));
  expect(problems.slice(0, 20)).toEqual([]);
}, 3_600_000);
