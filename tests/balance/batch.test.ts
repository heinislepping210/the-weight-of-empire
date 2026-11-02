// The balance batch (GAMEPLAY_BALANCING.md §7). Skipped in normal runs; run with
//   BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/batch.test.ts
// It prints a markdown report between BALANCE-REPORT markers. The F-targets are diagnostics, not quotas.
//
// Fresh dice: BALANCE_DICE=3 replays every scenario seed with 3 sets of dice (the first is the seed itself,
// comparable with earlier reports), so the variance of the ending can be split into strategy, scenario,
// their interaction and pure battle luck (review stage F).
//
// What-if runs: BALANCE_OVERRIDES='{"attrition":{"cohesionLossAtFullShortfall":30}}' replaces rule values
// for this run only, to test a researched range before anything is adopted. The report names the overrides.

import { expect, it } from 'vitest';
import { ENDING_NAMES, ENDING_RANK, RULES, RULES_VERSION, createContext, evaluate } from '../../src/engine';
import type { EndingId, GameState, Rules } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { keyHash } from '../../src/engine/rng';
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
const DICE = Math.max(1, Number(env.BALANCE_DICE ?? 1));
/** The dice for roll `r` of a scenario seed: the seed itself first, then fresh ones. */
const diceFor = (seed: number, r: number) => (r === 0 ? seed : keyHash(seed, ['dice', r]));
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
    for (let seed = 1; seed <= SEEDS; seed++) for (let roll = 0; roll < DICE; roll++) {
      const run = play(ctx, seed, (BOTS[name] as (c: typeof ctx) => ReturnType<(typeof BOTS)[string]>)(ctx), 5_000, diceFor(seed, roll));
      for (const v of violations(run)) problems.push(`${name} seed ${seed} roll ${roll}: ${v}`);
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
  lines.push(`# Balance report: rules ${RULES_VERSION}${OVERRIDES ? ' (what-if)' : ''}, The Vitebsk Decision, seeds 1–${SEEDS}${DICE > 1 ? `, ${DICE} sets of dice each` : ''}`, '');
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

  // F1/F2/F3 on the first roll of each seed (the seed's own dice), comparable with earlier reports.
  const first = (name: string, seed: number) => results[name]![seed * DICE]!;
  const decisive = (name: string, seed: number) => first(name, seed).ending === 'decisiveSuccess';
  let anyFamilyDecisive = 0;
  const bestShare: Record<string, number> = Object.fromEntries(FAMILIES.map((f) => [f, 0]));
  for (let i = 0; i < SEEDS; i++) {
    if (FAMILIES.some((f) => decisive(f, i))) anyFamilyDecisive++;
    const best = Math.min(...FAMILIES.map((f) => first(f, i).rank));
    const winners = FAMILIES.filter((f) => first(f, i).rank === best);
    for (const w of winners) bestShare[w]! += 1 / winners.length;
  }

  // F4: two-way analysis of variance with replication (strategy × scenario seed, DICE rolls per cell).
  const strategies = names.filter((n) => n !== 'random');
  const split = (rankOf: (e: EndingId) => number) => {
    const x = (n: string, seed: number, roll: number) => rankOf(results[n]![seed * DICE + roll]!.ending);
    const cell = (n: string, seed: number) => mean(Array.from({ length: DICE }, (_, r) => x(n, seed, r)));
    const grand = mean(strategies.flatMap((n) => results[n]!.map((r) => rankOf(r.ending))));
    const ss = { strategy: 0, scenario: 0, cells: 0, dice: 0 };
    for (const n of strategies) ss.strategy += SEEDS * DICE * (mean(results[n]!.map((r) => rankOf(r.ending))) - grand) ** 2;
    for (let i = 0; i < SEEDS; i++) ss.scenario += strategies.length * DICE * (mean(strategies.map((n) => cell(n, i))) - grand) ** 2;
    for (const n of strategies) for (let i = 0; i < SEEDS; i++) {
      const c = cell(n, i);
      ss.cells += DICE * (c - grand) ** 2;
      for (let r = 0; r < DICE; r++) ss.dice += (x(n, i, r) - c) ** 2;
    }
    const total = ss.cells + ss.dice;
    return { strategy: ss.strategy / total, scenario: ss.scenario / total, interaction: (ss.cells - ss.strategy - ss.scenario) / total, dice: ss.dice / total };
  };
  const f4 = split((e) => ENDING_RANK[e]);
  // The same split with Costly Victory and Operational Success no longer tied: how much the ranks' spacing matters.
  const SPREAD: Record<EndingId, number> = { decisiveSuccess: 1, costlyVictory: 2, operationalSuccess: 3, limitedSuccess: 4, successfulConsolidation: 4, inconclusive: 5, precariousHalt: 5, repulse: 6, collapse: 7 };
  const f4spread = split((e) => SPREAD[e]);
  // With fresh dice: is the best approach for a scenario the same as on its first roll?
  let stableBest = 0;
  if (DICE > 1) {
    for (let i = 0; i < SEEDS; i++) {
      const meanRank = (f: string) => mean(Array.from({ length: DICE }, (_, r) => results[f]![i * DICE + r]!.rank));
      const bestMean = Math.min(...FAMILIES.map(meanRank));
      const bestFirst = Math.min(...FAMILIES.map((f) => first(f, i).rank));
      if (FAMILIES.some((f) => meanRank(f) === bestMean && first(f, i).rank === bestFirst)) stableBest++;
    }
  }

  const halt = results['prudent-halt']!;
  const random = results.random!;
  lines.push('', '## Fairness diagnostics (targets are diagnostics, not quotas)', '');
  lines.push(`- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on ${pct(anyFamilyDecisive, SEEDS)} of seeds (target ≥ 60%). No oracle search yet.`);
  lines.push(`- **F2:** Decisive Success rate per family: ${FAMILIES.map((f) => `${f} ${pct(results[f]!.filter((r) => r.ending === 'decisiveSuccess').length, results[f]!.length)}`).join(', ')} (target ≈ 25% each).`);
  lines.push(`- **F3:** share of seeds on which each family does best: ${FAMILIES.map((f) => `${f} ${pct(bestShare[f]!, SEEDS)}`).join(', ')} (target: none above 50%).`);
  const share = (v: number) => `${(v * 100).toFixed(1)}%`;
  lines.push(
    DICE > 1
      ? `- **F4:** variance of the ending rank explained by the strategy ${share(f4.strategy)}, by the scenario ${share(f4.scenario)}, by which strategy suits which scenario ${share(f4.interaction)}, and by the battle dice alone ${share(f4.dice)} (${DICE} sets of dice per scenario; target: strategy above scenario). With the ranks spread out (Costly Victory above Operational Success): strategy ${share(f4spread.strategy)}, scenario ${share(f4spread.scenario)}, interaction ${share(f4spread.interaction)}, dice ${share(f4spread.dice)}. The best approach for a scenario stays the best under fresh dice on ${pct(stableBest, SEEDS)} of scenarios.`
      : `- **F4:** variance of the ending rank explained by the strategy ${share(f4.strategy)}, by the seed ${share(f4.scenario)}, interaction and dice together ${share(f4.interaction)} (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.`,
  );
  lines.push(`- **F5:** the prudent halt, declared on the first turn before any victory, ends in: ${endings.filter((e) => halt.some((r) => r.ending === e)).map((e) => `${ENDING_NAMES[e]} ${pct(halt.filter((r) => r.ending === e).length, halt.length)}`).join(', ')} (target: never Decisive Success; a victory won before a later halt stands, D-035).`);
  lines.push(`- **F6:** random play reaches Decisive Success in ${pct(random.filter((r) => r.ending === 'decisiveSuccess').length, random.length)} of games (target < 5%).`);
  lines.push('', `*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: ${names.join(', ')}.*`);

  console.log(['BALANCE-REPORT-START', ...lines, 'BALANCE-REPORT-END'].join('\n'));
  // Integrity is a gate; the fairness diagnostics above are not.
  expect(problems.slice(0, 20)).toEqual([]);
}, 3_600_000);
