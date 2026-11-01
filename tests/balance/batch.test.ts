// The balance batch (GAMEPLAY_BALANCING.md §7). Skipped in normal runs; run with
//   BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/batch.test.ts
// It prints a markdown report between BALANCE-REPORT markers. The F-targets are diagnostics, not quotas.
//
// What-if runs: BALANCE_OVERRIDES='{"attrition":{"cohesionLossAtFullShortfall":30}}' replaces rule values
// for this run only, to test a researched range before anything is adopted. The report names the overrides.

import { expect, it } from 'vitest';
import { ENDING_NAMES, ENDING_RANK, RULES, RULES_VERSION, createContext, evaluate } from '../../src/engine';
import type { EndingId, GameState, Rules } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { BOTS, FAMILIES } from './bots';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const enabled = env.BALANCE === '1';

/** Share of the French wagon trains' draught horses lost over the game, in permille (G-019). */
function trainHorsesLost(start: GameState, end: GameState): number {
  const horses = (s: GameState) => Object.values(s.convoys).filter((c) => c.side === 'fr').reduce((n, c) => n + c.horses, 0);
  return Math.floor(((horses(start) - horses(end)) * 1000) / Math.max(1, horses(start)));
}
const SEEDS = Number(env.BALANCE_SEEDS ?? 1000);
const OVERRIDES = env.BALANCE_OVERRIDES ? (JSON.parse(env.BALANCE_OVERRIDES) as Record<string, unknown>) : null;

/** Rule values with the overrides laid over them; an unknown key is an error, so a typo cannot pass silently. */
function overridden(base: unknown, over: unknown, path: string): unknown {
  if (over === null || typeof over !== 'object' || Array.isArray(over)) return over;
  if (base === null || typeof base !== 'object') throw new Error(`no rule group at ${path}`);
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (!(k in out)) throw new Error(`unknown rule ${path}.${k}`);
    out[k] = overridden(out[k], v, `${path}.${k}`);
  }
  return out;
}

interface Result {
  ending: EndingId;
  rank: number;
  frMen: number;
  frHorses: number;
  ruMain: number;
  held: boolean;
  battles: number;
  rounds: number;
  frJoins: number;
  ruJoins: number;
  frLostBattles: number;
  cohesion: number;
  foodDays: number;
  founded: number;
  depotsLost: number;
  tookSmolensk: boolean;
  lineFood: number;
  burnedFood: number;
  abandonedFood: number;
  abandonedFodder: number;
  trainHorsesLostPermille: number;
}

it.skipIf(!enabled)('balance batch', () => {
  const rules = OVERRIDES ? (overridden(RULES, OVERRIDES, 'rules') as Rules) : RULES;
  const ctx = createContext(vitebskDecision(), rules);
  const names = Object.keys(BOTS);
  const results: Record<string, Result[]> = {};
  const problems: string[] = [];
  for (const name of names) {
    results[name] = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const run = play(ctx, seed, (BOTS[name] as (c: typeof ctx) => ReturnType<(typeof BOTS)[string]>)(ctx));
      for (const v of violations(run)) problems.push(`${name} seed ${seed}: ${v}`);
      const o = evaluate(run.states[0]!, run.final, ctx);
      const log = run.logs.flat();
      const captured = log.filter((e) => e.kind === 'depotCaptured');
      results[name]!.push({
        founded: log.filter((e) => e.kind === 'depotFounded').length,
        depotsLost: captured.filter((e) => e.detail.by === 'ru').length,
        tookSmolensk: captured.some((e) => e.detail.by === 'fr' && e.detail.node === 'smolensk'),
        lineFood: log.filter((e) => e.kind === 'delivered' && e.detail.depot !== null && run.final.convoys[String(e.detail.convoy)]?.side === 'fr').reduce((n, e) => n + Number(e.detail.food), 0),
        burnedFood: run.final.ledger.destroyed.food,
        abandonedFood: run.final.ledger.abandoned.food,
        abandonedFodder: run.final.ledger.abandoned.fodder,
        trainHorsesLostPermille: trainHorsesLost(run.states[0]!, run.final),
        ending: o.ending,
        rank: ENDING_RANK[o.ending],
        frMen: o.frenchMenLostPermille / 10,
        frHorses: o.frenchHorsesLostPermille / 10,
        ruMain: o.russianMainLostPermille / 10,
        held: o.holdsKeyGround,
        battles: run.logs.flat().filter((e) => e.kind === 'battleJoined').length,
        rounds: Object.values(run.final.battles).reduce((n, b) => n + b.roundsFought, 0),
        frJoins: log.filter((e) => e.kind === 'reinforced' && e.detail.side === 'fr').length,
        ruJoins: log.filter((e) => e.kind === 'reinforced' && e.detail.side === 'ru').length,
        frLostBattles: Object.values(run.final.battles).filter((b) => b.winner === 'ru').length,
        cohesion: o.frenchCohesion,
        foodDays: o.frenchFoodDays,
      });
    }
  }

  const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const endings = Object.keys(ENDING_NAMES) as EndingId[];
  const lines: string[] = [];
  lines.push(`# Balance report: rules ${RULES_VERSION}${OVERRIDES ? ' (what-if)' : ''}, The Vitebsk Decision, seeds 1–${SEEDS}`, '');
  if (OVERRIDES) lines.push(`**What-if run, not the adopted rules.** Overrides: \`${JSON.stringify(OVERRIDES)}\``, '');
  lines.push(`Bots: ${names.join(', ')}. Approach families: ${FAMILIES.join(', ')}. Battles are left to the marshal.`, '');
  lines.push(`**Invariant violations: ${problems.length}**${problems.length ? ` (first: ${problems.slice(0, 5).join('; ')})` : ''}`, '');

  lines.push('## Endings by strategy', '');
  lines.push(`| Strategy | ${endings.map((e) => ENDING_NAMES[e]).join(' | ')} |`, `|---|${endings.map(() => '---').join('|')}|`);
  for (const name of names) {
    const rs = results[name]!;
    lines.push(`| ${name} | ${endings.map((e) => pct(rs.filter((r) => r.ending === e).length, rs.length)).join(' | ')} |`);
  }

  lines.push('', '## Costs and gains (means)', '', '| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |', '|---|---|---|---|---|---|---|---|');
  for (const name of names) {
    const rs = results[name]!;
    lines.push(
      `| ${name} | ${mean(rs.map((r) => r.frMen)).toFixed(1)}% | ${mean(rs.map((r) => r.frHorses)).toFixed(1)}% | ${mean(rs.map((r) => r.ruMain)).toFixed(1)}% | ${pct(rs.filter((r) => r.held).length, rs.length)} | ${mean(rs.map((r) => r.battles)).toFixed(1)} | ${mean(rs.map((r) => r.cohesion)).toFixed(0)} | ${mean(rs.map((r) => r.foodDays)).toFixed(1)} |`,
    );
  }

  lines.push('', '## Contacts (means)', '', '| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |', '|---|---|---|---|---|---|');
  for (const name of names) {
    const rs = results[name]!;
    lines.push(
      `| ${name} | ${mean(rs.map((r) => r.battles)).toFixed(1)} | ${mean(rs.map((r) => r.rounds)).toFixed(1)} | ${mean(rs.map((r) => r.frJoins)).toFixed(2)} | ${mean(rs.map((r) => r.ruJoins)).toFixed(2)} | ${mean(rs.map((r) => r.frLostBattles)).toFixed(2)} |`,
    );
  }

  lines.push(
    '',
    '## Supply (means)',
    '',
    '| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const name of names) {
    const rs = results[name]!;
    lines.push(
      `| ${name} | ${mean(rs.map((r) => r.founded)).toFixed(2)} | ${mean(rs.map((r) => r.depotsLost)).toFixed(2)} | ${pct(rs.filter((r) => r.tookSmolensk).length, rs.length)} | ${Math.round(mean(rs.map((r) => r.lineFood))).toLocaleString('en-GB')} | ${Math.round(mean(rs.map((r) => r.burnedFood))).toLocaleString('en-GB')} | ${Math.round(mean(rs.map((r) => r.abandonedFood))).toLocaleString('en-GB')} / ${Math.round(mean(rs.map((r) => r.abandonedFodder))).toLocaleString('en-GB')} | ${(mean(rs.map((r) => r.trainHorsesLostPermille)) / 10).toFixed(1)}% |`,
    );
  }

  // F1/F2/F3: achievability, several ways to win, no dominant approach (families only).
  const decisive = (name: string, seed: number) => results[name]![seed]!.ending === 'decisiveSuccess';
  let anyFamilyDecisive = 0;
  const bestShare: Record<string, number> = Object.fromEntries(FAMILIES.map((f) => [f, 0]));
  for (let i = 0; i < SEEDS; i++) {
    if (FAMILIES.some((f) => decisive(f, i))) anyFamilyDecisive++;
    const best = Math.min(...FAMILIES.map((f) => results[f]![i]!.rank));
    const winners = FAMILIES.filter((f) => results[f]![i]!.rank === best);
    for (const w of winners) bestShare[w]! += 1 / winners.length;
  }

  // F4: how much of the ending is explained by the strategy, and how much by the seed.
  const strategies = names.filter((n) => n !== 'random');
  const grand = mean(strategies.flatMap((n) => results[n]!.map((r) => r.rank)));
  const byStrategy = strategies.map((n) => mean(results[n]!.map((r) => r.rank)));
  const bySeed = Array.from({ length: SEEDS }, (_, i) => mean(strategies.map((n) => results[n]![i]!.rank)));
  const ssTotal = strategies.reduce((acc, n) => acc + results[n]!.reduce((a, r) => a + (r.rank - grand) ** 2, 0), 0);
  const ssStrategy = SEEDS * byStrategy.reduce((a, m) => a + (m - grand) ** 2, 0);
  const ssSeed = strategies.length * bySeed.reduce((a, m) => a + (m - grand) ** 2, 0);

  const halt = results['prudent-halt']!;
  const random = results.random!;
  lines.push('', '## Fairness diagnostics (targets are diagnostics, not quotas)', '');
  lines.push(`- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on ${pct(anyFamilyDecisive, SEEDS)} of seeds (target ≥ 60%). No oracle search yet.`);
  lines.push(`- **F2:** Decisive Success rate per family: ${FAMILIES.map((f) => `${f} ${pct(results[f]!.filter((r) => r.ending === 'decisiveSuccess').length, SEEDS)}`).join(', ')} (target ≈ 25% each).`);
  lines.push(`- **F3:** share of seeds on which each family does best: ${FAMILIES.map((f) => `${f} ${pct(bestShare[f]!, SEEDS)}`).join(', ')} (target: none above 50%).`);
  lines.push(
    `- **F4:** variance of the ending rank explained by the strategy ${pct(ssStrategy, ssTotal)}, by the seed ${pct(ssSeed, ssTotal)}, interaction and noise ${pct(ssTotal - ssStrategy - ssSeed, ssTotal)} (target: strategy above seed). Re-rolling battle dice alone is not yet possible.`,
  );
  lines.push(`- **F5:** prudent halt endings: ${endings.filter((e) => halt.some((r) => r.ending === e)).map((e) => `${ENDING_NAMES[e]} ${pct(halt.filter((r) => r.ending === e).length, SEEDS)}`).join(', ')} (target: never Decisive Success).`);
  lines.push(`- **F6:** random play reaches Decisive Success on ${pct(random.filter((r) => r.ending === 'decisiveSuccess').length, SEEDS)} of seeds (target < 5%).`);

  console.log(['BALANCE-REPORT-START', ...lines, 'BALANCE-REPORT-END'].join('\n'));
  // Integrity is a gate; the fairness diagnostics above are not.
  expect(problems.slice(0, 20)).toEqual([]);
}, 3_600_000);
