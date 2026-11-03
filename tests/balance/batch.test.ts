// The balance batch (GAMEPLAY_BALANCING.md §7). Skipped in normal runs; run with
//   BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/batch.test.ts
// It prints a markdown report between BALANCE-REPORT markers. The F-targets are diagnostics, not quotas.
//
// Fresh dice: BALANCE_DICE=3 replays every scenario seed with 3 sets of dice (the first is the seed itself,
// comparable with earlier reports), so the variance of the ending can be split into strategy, scenario,
// their interaction and the dice (review stage F). The dice decide battles, withdrawals, road priority and
// burned stores; weather and scouting errors belong to the scenario. Intervals come from a bootstrap over
// scenarios (BALANCE_BOOT replicates, default 200), keeping every strategy and roll of a scenario together.
//
// What-if runs: BALANCE_OVERRIDES='{"attrition":{"cohesionLossAtFullShortfall":30}}' replaces rule values
// for this run only, to test a researched range before anything is adopted. The report names the overrides.

import { expect, it } from 'vitest';
import { ENDING_NAMES, ENDING_RANK, RULES, RULES_VERSION, createContext, evaluate } from '../../src/engine';
import type { EndingId, GameState, LogEntry, Rules, RussianResult } from '../../src/engine';
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
const BOOT = Math.max(0, Number(env.BALANCE_BOOT ?? 200));
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
  russian: RussianResult;
  roadCut: boolean;
  stillCutOff: boolean;
  costlyEscape: boolean;
  /** One French group ends with at least 7.5 days of food in hand while another has under one (second review, B3). */
  uneven: boolean;
  /** Sector battles (§3.4b): how each side left the field ('ru:routed'), and by which exit ('ru:contested'). */
  fieldResults: Record<string, number>;
  exits: Record<string, number>;
  positionsLost: { fr: number; ru: number };
  /** Battles in which a Russian main army routed or was trapped. */
  mainBroke: number;
  /** In a decisive defeat, the exits of the Russian breaks that counted towards it. */
  decisiveExits: string[];
}

/** Sector-battle figures for one game (§3.4b), from the battles and the log. */
function battleFigures(end: GameState, log: LogEntry[], decisive: boolean): Pick<Result, 'fieldResults' | 'exits' | 'positionsLost' | 'mainBroke' | 'decisiveExits'> {
  const fieldResults: Record<string, number> = {};
  const exits: Record<string, number> = {};
  const positionsLost = { fr: 0, ru: 0 };
  let mainBroke = 0;
  const decisiveExits: string[] = [];
  // Results from the battles themselves, as the evaluator reads them; the exits from the log, where they are recorded.
  const exitOf = new Map(log.filter((e) => e.kind === 'fieldResult').map((e) => [`${e.detail.battle}:${e.detail.side}`, String(e.detail.exit)] as const));
  for (const b of Object.values(end.battles)) {
    for (const side of b.field.positionLost) positionsLost[side]++;
    for (const side of ['fr', 'ru'] as const) {
      const result = b.field.result[side];
      if (result === null) continue;
      fieldResults[`${side}:${result}`] = (fieldResults[`${side}:${result}`] ?? 0) + 1;
      const exit = exitOf.get(`${b.id}:${side}`) ?? 'unknown';
      exits[`${side}:${exit}`] = (exits[`${side}:${exit}`] ?? 0) + 1;
      if (side === 'ru' && result !== 'withdrew' && b.sides.ru.some((id) => end.mainArmies.includes(id))) {
        mainBroke++;
        if (decisive && b.winner === 'fr') decisiveExits.push(exit);
      }
    }
  }
  return { fieldResults, exits, positionsLost, mainBroke, decisiveExits };
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
        russian: o.russian,
        roadCut: o.roadCut,
        stillCutOff: o.stillCutOff,
        costlyEscape: o.roadCut && !o.stillCutOff && o.lostSinceCutPermille >= rules.outcome.damagedLossPermille,
        uneven: (() => {
          const days = Object.values(run.final.forces).filter((f) => f.side === 'fr' && f.men > 0).map((f) => f.stock.food / f.men);
          return Math.max(...days) >= 7.5 && Math.min(...days) < 1;
        })(),
        ...battleFigures(run.final, log, o.russian === 'decisivelyDefeated'),
      });
    }
  }

  const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
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

  // What happened to the Russian main armies, and how often their road was cut (§2.13; the second review's D3).
  lines.push(
    '',
    '## The Russian main armies (share of games)',
    '',
    `Cut-off credit: \`${rules.outcome.cutOffCredit}\`. "Road cut" counts games in which the line of retreat was held long enough at some point; of those, still cut off at the end, or broken out after losing at least ${rules.outcome.damagedLossPermille / 10}% of their strength in battle after the cut.`,
    '',
    '| Strategy | Decisively defeated | Cut off | Forced out | Damaged | Intact | Road cut | Still cut off at the end | Broke out at a heavy cost |',
    '|---|---|---|---|---|---|---|---|---|',
  );
  for (const name of names) {
    const rs = results[name]!;
    const share = (test: (r: Result) => boolean) => pct(rs.filter(test).length, rs.length);
    lines.push(
      `| ${name} | ${(['decisivelyDefeated', 'cutOff', 'forcedOut', 'damaged', 'intact'] as const).map((x) => share((r) => r.russian === x)).join(' | ')} | ${share((r) => r.roadCut)} | ${share((r) => r.stillCutOff)} | ${share((r) => r.costlyEscape)} |`,
    );
  }

  lines.push(
    '',
    '## Supply (means)',
    '',
    '| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost | Uneven stocks at the end |',
    '|---|---|---|---|---|---|---|---|---|',
  );
  for (const name of names) {
    const rs = results[name]!;
    lines.push(
      `| ${name} | ${mean(rs.map((r) => r.founded)).toFixed(2)} | ${mean(rs.map((r) => r.depotsLost)).toFixed(2)} | ${pct(rs.filter((r) => r.tookSmolensk).length, rs.length)} | ${Math.round(mean(rs.map((r) => r.lineFood))).toLocaleString('en-GB')} | ${Math.round(mean(rs.map((r) => r.burnedFood))).toLocaleString('en-GB')} | ${Math.round(mean(rs.map((r) => r.abandonedFood))).toLocaleString('en-GB')} / ${Math.round(mean(rs.map((r) => r.abandonedFodder))).toLocaleString('en-GB')} | ${(mean(rs.map((r) => r.trainHorsesLostPermille)) / 10).toFixed(1)}% | ${pct(rs.filter((r) => r.uneven).length, rs.length)} |`,
    );
  }

  lines.push(
    '',
    '## Sector battles (§2.10; per 100 games)',
    '',
    'How each side left the field, and by which road (TECHNICAL_ARCHITECTURE §3.4b). A lost position is a tactical defeat, not a rout; only routs and traps count towards a decisive defeat.',
    '',
    '| Strategy | Battles | Rounds per battle | Positions lost, French / Russian | Russians withdrew / routed / trapped | French withdrew / routed / trapped | Russian exits open / contested / blocked | A Russian main army broke |',
    '|---|---|---|---|---|---|---|---|',
  );
  const per100 = (rs: Result[], f: (r: Result) => number) => Math.round((rs.reduce((n, r) => n + f(r), 0) * 100) / Math.max(1, rs.length));
  for (const name of names) {
    const rs = results[name]!;
    const n = (key: string, from: 'fieldResults' | 'exits') => per100(rs, (r) => r[from][key] ?? 0);
    const battles = rs.reduce((x, r) => x + r.battles, 0);
    const rounds = rs.reduce((x, r) => x + r.rounds, 0);
    lines.push(
      `| ${name} | ${per100(rs, (r) => r.battles)} | ${(rounds / Math.max(1, battles)).toFixed(1)} | ${per100(rs, (r) => r.positionsLost.fr)} / ${per100(rs, (r) => r.positionsLost.ru)} | ${n('ru:withdrew', 'fieldResults')} / ${n('ru:routed', 'fieldResults')} / ${n('ru:trapped', 'fieldResults')} | ${n('fr:withdrew', 'fieldResults')} / ${n('fr:routed', 'fieldResults')} / ${n('fr:trapped', 'fieldResults')} | ${n('ru:open', 'exits')} / ${n('ru:contested', 'exits')} / ${n('ru:blocked', 'exits')} | ${per100(rs, (r) => r.mainBroke)} |`,
    );
  }
  const decisiveExits = names.flatMap((name) => results[name]!.flatMap((r) => r.decisiveExits));
  const count = (e: string) => decisiveExits.filter((x) => x === e).length;
  lines.push(
    '',
    `**Decisive defeats in battle:** ${names.map((name) => `${name} ${results[name]!.filter((r) => r.russian === 'decisivelyDefeated').length}`).filter((x) => !x.endsWith(' 0')).join(', ') || 'none'}. The Russian breaks that counted towards them left by an open road ${count('open')} times, a contested one ${count('contested')} times, and were trapped with no road ${count('blocked')} times.`,
  );

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
  const allSeeds = Array.from({ length: SEEDS }, (_, i) => i);
  /**
   * Shares of the ending's variance, over a sample of scenarios (with repeats, for the bootstrap). The raw
   * shares are descriptive: each cell's mean over a few rolls still carries dice noise, which inflates the
   * strategy, scenario and above all the interaction terms. The adjusted shares take out what that noise
   * is expected to add (two-way analysis with replication) and count it with the dice (second review, F1).
   */
  const split = (rankOf: (e: EndingId) => number, seeds: number[] = allSeeds) => {
    const x = (n: string, seed: number, roll: number) => rankOf(results[n]![seed * DICE + roll]!.ending);
    const cell = (n: string, seed: number) => mean(Array.from({ length: DICE }, (_, r) => x(n, seed, r)));
    const cells = new Map(strategies.map((n) => [n, seeds.map((i) => cell(n, i))]));
    const grand = mean(strategies.flatMap((n) => cells.get(n)!));
    const ss = { strategy: 0, scenario: 0, cells: 0, dice: 0 };
    for (const n of strategies) ss.strategy += seeds.length * DICE * (mean(cells.get(n)!) - grand) ** 2;
    seeds.forEach((_, k) => (ss.scenario += strategies.length * DICE * (mean(strategies.map((n) => cells.get(n)![k]!)) - grand) ** 2));
    for (const n of strategies) seeds.forEach((i, k) => {
      const c = cells.get(n)![k]!;
      ss.cells += DICE * (c - grand) ** 2;
      for (let r = 0; r < DICE; r++) ss.dice += (x(n, i, r) - c) ** 2;
    });
    const total = Math.max(1e-12, ss.cells + ss.dice);
    const interaction = ss.cells - ss.strategy - ss.scenario;
    const [a, b] = [strategies.length, seeds.length];
    const noise = DICE > 1 ? ss.dice / (a * b * (DICE - 1)) : 0;
    const adj = { strategy: Math.max(0, ss.strategy - (a - 1) * noise), scenario: Math.max(0, ss.scenario - (b - 1) * noise), interaction: Math.max(0, interaction - (a - 1) * (b - 1) * noise) };
    return {
      strategy: ss.strategy / total,
      scenario: ss.scenario / total,
      interaction: interaction / total,
      dice: ss.dice / total,
      adjusted: { strategy: adj.strategy / total, scenario: adj.scenario / total, interaction: adj.interaction / total, dice: 1 - (adj.strategy + adj.scenario + adj.interaction) / total },
    };
  };
  const f4 = split((e) => ENDING_RANK[e]);
  // The same split with Costly Victory and Operational Success no longer tied: how much the ranks' spacing matters.
  const SPREAD: Record<EndingId, number> = { decisiveSuccess: 1, costlyVictory: 2, operationalSuccess: 3, limitedSuccess: 4, successfulConsolidation: 4, inconclusive: 5, precariousHalt: 5, repulse: 6, collapse: 7 };
  const f4spread = split((e) => SPREAD[e]);
  // With fresh dice: does the best approach on a scenario's first roll stay best on its other rolls? The
  // other rolls are held apart from the first, and scenarios with a tie on either side are counted on their
  // own, so that neither shared rolls nor ties make the best look more stable than it is (second review).
  const stability = { agree: 0, differ: 0, tied: 0, overlap: 0 };
  // Regret: how many ranks worse, on the other rolls, the approach best on the first roll does than the
  // approach best on those other rolls (ties on the first roll averaged).
  let regret = 0;
  if (DICE > 1) {
    const bestOf = (score: (f: string) => number) => {
      const top = Math.min(...FAMILIES.map(score));
      return FAMILIES.filter((f) => score(f) === top);
    };
    for (let i = 0; i < SEEDS; i++) {
      const onFirst = bestOf((f) => first(f, i).rank);
      const others = (f: string) => mean(Array.from({ length: DICE - 1 }, (_, r) => results[f]![i * DICE + r + 1]!.rank));
      const onOthers = bestOf(others);
      regret += mean(onFirst.map(others)) - Math.min(...FAMILIES.map(others));
      if (onFirst.some((f) => onOthers.includes(f))) stability.overlap++;
      if (onFirst.length > 1 || onOthers.length > 1) stability.tied++;
      else if (onFirst[0] === onOthers[0]) stability.agree++;
      else stability.differ++;
    }
  }
  const untied = stability.agree + stability.differ;

  // Uncertainty: a bootstrap over scenarios, keeping each scenario's strategies and rolls together (second
  // review, F5). The 27,000 games are not independent results: they are 1,000 scenarios, each played many ways.
  const boot: { meanRank: Record<string, number[]>; best: Record<string, number[]>; raw: Record<string, number[]>; adjusted: Record<string, number[]> } = {
    meanRank: Object.fromEntries(FAMILIES.map((f) => [f, []])),
    best: Object.fromEntries(FAMILIES.map((f) => [f, []])),
    raw: { strategy: [], scenario: [], interaction: [], dice: [] },
    adjusted: { strategy: [], scenario: [], interaction: [], dice: [] },
  };
  for (let b = 0; b < BOOT; b++) {
    const sample = allSeeds.map((k) => keyHash(1812, ['boot', b, k]) % SEEDS);
    for (const f of FAMILIES) boot.meanRank[f]!.push(mean(sample.flatMap((i) => Array.from({ length: DICE }, (_, r) => results[f]![i * DICE + r]!.rank))));
    const shares: Record<string, number> = Object.fromEntries(FAMILIES.map((f) => [f, 0]));
    for (const i of sample) {
      const top = Math.min(...FAMILIES.map((f) => first(f, i).rank));
      const winners = FAMILIES.filter((f) => first(f, i).rank === top);
      for (const w of winners) shares[w]! += 1 / winners.length;
    }
    for (const f of FAMILIES) boot.best[f]!.push(shares[f]! / SEEDS);
    if (DICE > 1) {
      const s = split((e) => ENDING_RANK[e], sample);
      for (const k of ['strategy', 'scenario', 'interaction', 'dice'] as const) {
        boot.raw[k]!.push(s[k]);
        boot.adjusted[k]!.push(s.adjusted[k]);
      }
    }
  }
  /** The middle 95% of the bootstrap replicates. */
  const interval = (xs: number[], show: (v: number) => string) => {
    if (xs.length < 2) return 'n/a';
    const sorted = [...xs].sort((p, q) => p - q);
    return `${show(sorted[Math.floor(0.025 * (sorted.length - 1))]!)}–${show(sorted[Math.ceil(0.975 * (sorted.length - 1))]!)}`;
  };

  const halt = results['prudent-halt']!;
  const random = results.random!;
  lines.push('', '## Fairness diagnostics (targets are diagnostics, not quotas)', '');
  lines.push(`- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on ${pct(anyFamilyDecisive, SEEDS)} of seeds (target ≥ 60%). No oracle search yet.`);
  lines.push(`- **F2:** Decisive Success rate per family: ${FAMILIES.map((f) => `${f} ${pct(results[f]!.filter((r) => r.ending === 'decisiveSuccess').length, results[f]!.length)}`).join(', ')} (target ≈ 25% each).`);
  lines.push(`- **F3:** share of seeds on which each family does best: ${FAMILIES.map((f) => `${f} ${pct(bestShare[f]!, SEEDS)}`).join(', ')} (target: none above 50%).`);
  const share = (v: number) => `${(v * 100).toFixed(1)}%`;
  lines.push(
    DICE > 1
      ? `- **F4:** variance of the ending rank explained by the strategy ${share(f4.strategy)}, by the scenario ${share(f4.scenario)}, by which strategy suits which scenario ${share(f4.interaction)}, and by the dice ${share(f4.dice)} (${DICE} sets of dice per scenario; target: strategy above scenario). These raw shares carry dice noise in the cell means; with that noise counted with the dice: strategy ${share(f4.adjusted.strategy)}, scenario ${share(f4.adjusted.scenario)}, interaction ${share(f4.adjusted.interaction)}, dice ${share(f4.adjusted.dice)}. With the ranks spread out (Costly Victory above Operational Success), raw: strategy ${share(f4spread.strategy)}, scenario ${share(f4spread.scenario)}, interaction ${share(f4spread.interaction)}, dice ${share(f4spread.dice)}. Where one approach is best on a scenario's first roll and one is best on its other ${DICE - 1} rolls, they are the same on ${pct(stability.agree, untied)} of ${untied} scenarios; ${pct(stability.tied, SEEDS)} of scenarios have a tie for best on one side or both, and the approaches best on each side overlap on ${pct(stability.overlap, SEEDS)}. Choosing on the first roll costs on average ${(regret / SEEDS).toFixed(2)} ranks on the other rolls (regret).`
      : `- **F4:** variance of the ending rank explained by the strategy ${share(f4.strategy)}, by the seed ${share(f4.scenario)}, interaction and dice together ${share(f4.interaction)} (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.`,
  );
  lines.push(`- **F5:** the prudent halt, declared on the first turn before any victory, ends in: ${endings.filter((e) => halt.some((r) => r.ending === e)).map((e) => `${ENDING_NAMES[e]} ${pct(halt.filter((r) => r.ending === e).length, halt.length)}`).join(', ')} (target: never Decisive Success; a victory won before a later halt stands, D-035).`);
  lines.push(`- **F6:** random play reaches Decisive Success in ${pct(random.filter((r) => r.ending === 'decisiveSuccess').length, random.length)} of games (target < 5%).`);
  lines.push('', `*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. "The dice" decide battles, withdrawals, road priority and burned stores; weather and scouting errors are part of the scenario. Bots: ${names.join(', ')}.*`);
  if (BOOT > 1) {
    const rank = (v: number) => v.toFixed(2);
    lines.push(
      '',
      `## Uncertainty (bootstrap over scenarios, ${BOOT} replicates, middle 95%)`,
      '',
      'Each replicate redraws the scenarios with replacement, keeping every strategy and every roll of a scenario together.',
      '',
      '| Family | Mean ending rank | Share of seeds on which it does best (F3) |',
      '|---|---|---|',
      ...FAMILIES.map((f) => `| ${f} | ${rank(mean(results[f]!.map((r) => r.rank)))} (${interval(boot.meanRank[f]!, rank)}) | ${pct(bestShare[f]!, SEEDS)} (${interval(boot.best[f]!, share)}) |`),
    );
    if (DICE > 1) {
      lines.push(
        '',
        '| Variance share (F4) | Raw | Noise-adjusted |',
        '|---|---|---|',
        ...(['strategy', 'scenario', 'interaction', 'dice'] as const).map((k) => `| ${k} | ${share(f4[k])} (${interval(boot.raw[k]!, share)}) | ${share(f4.adjusted[k])} (${interval(boot.adjusted[k]!, share)}) |`),
      );
    }
  }

  console.log(['BALANCE-REPORT-START', ...lines, 'BALANCE-REPORT-END'].join('\n'));
  // Integrity is a gate; the fairness diagnostics above are not.
  expect(problems.slice(0, 20)).toEqual([]);
}, 3_600_000);
