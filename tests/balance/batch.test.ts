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
import { vitebskDecision, type FrenchStrength } from '../../src/data/vitebsk/scenario';
import { lineOfRetreat } from '../../src/engine/battle';
import { keyHash } from '../../src/engine/rng';
import { play, type Run } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { freshRegret, overridden, standing, varianceSplit, withinTies } from './analysis';
import { BOTS, FAMILIES, PIN_STAGES, pinStages, pinTraceOf } from './bots';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** What-if map: BALANCE_SCENARIO=candidate-roads adds the roads not yet adopted (MAP_AND_GEOGRAPHY.md). */
const WITH_CANDIDATE_ROADS = env.BALANCE_SCENARIO === 'candidate-roads';
/**
 * What-if strength: BALANCE_SCENARIO=french-5-august starts the French at their 5 August strength by the returns,
 * and french-5-august-cavalry with their cavalry from the returns too (HISTORICAL_RESEARCH, the history audit).
 */
const FRENCH: FrenchStrength = env.BALANCE_SCENARIO === 'french-5-august' ? 'returns-5-august' : env.BALANCE_SCENARIO === 'french-5-august-cavalry' ? 'returns-5-august-cavalry' : 'mid-august';
/** What-if roads: BALANCE_SCENARIO=road-audit-lengths uses the lengths the road audit read from the maps (HISTORICAL_RESEARCH). */
const ROAD_READINGS = env.BALANCE_SCENARIO === 'road-audit-lengths';
/** What-if train: BALANCE_PONTOONS=liozno starts the bridging train there, for runs with `pontoons.bridgeSlots` on (G-027). */
const PONTOON_START = env.BALANCE_PONTOONS;
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
  raids: number;
  raidFood: number;
  raidHorses: number;
  russian: RussianResult;
  roadCut: boolean;
  stillCutOff: boolean;
  costlyEscape: boolean;
  /** One French group ends with at least 7.5 days of food in hand while another has under one (second review, B3). */
  uneven: boolean;
  /** Sector battles (§3.4b): how each side left the field ('ru:routed'), and by which exit ('ru:contested'). */
  fieldResults: Record<string, number>;
  exits: Record<string, number>;
  /** Where a side that left the field fell back ('ru:own'): the road it came by, towards its own troops, or towards a depot (D-046). */
  bases: Record<string, number>;
  positionsLost: { fr: number; ru: number };
  /** Battles in which a Russian main army routed or was trapped. */
  mainBroke: number;
  /** In a decisive defeat, the exits of the Russian breaks that counted towards it. */
  decisiveExits: string[];
  /** A Russian main army had no road out at some pause, whether or not it was then trapped (third review). */
  blockedIn: boolean;
  /** A pinning attack's stages (`pinStages`), plans adopted and the most turns one was kept; null for other bots. */
  pin: { stages: Record<(typeof PIN_STAGES)[number], boolean>; plans: number; longest: number } | null;
}

/** A Russian main army standing at a place with no road out, at an order or deployment pause (contract D's "blocked"). */
const blockedIn = (run: Run, ctx: Parameters<typeof lineOfRetreat>[1]) =>
  run.states.some((s) =>
    s.mainArmies.some((id) => {
      const f = s.forces[id];
      return f !== undefined && f.men > 0 && f.transit === null && lineOfRetreat(s, ctx, f.at, 'ru', null) === null;
    }),
  );

/** Sector-battle figures for one game (§3.4b), from the battles and the log. */
function battleFigures(end: GameState, log: LogEntry[], decisive: boolean): Pick<Result, 'fieldResults' | 'exits' | 'bases' | 'positionsLost' | 'mainBroke' | 'decisiveExits'> {
  const fieldResults: Record<string, number> = {};
  const exits: Record<string, number> = {};
  const bases: Record<string, number> = {};
  const positionsLost = { fr: 0, ru: 0 };
  let mainBroke = 0;
  const decisiveExits: string[] = [];
  // Results from the battles themselves, as the evaluator reads them; the exits from the log, where they are recorded.
  const left = log.filter((e) => e.kind === 'fieldResult');
  const exitOf = new Map(left.map((e) => [`${e.detail.battle}:${e.detail.side}`, String(e.detail.exit)] as const));
  for (const e of left) {
    if (e.detail.basis === null || e.detail.result === 'trapped') continue;
    for (const key of [String(e.detail.basis), ...(e.detail.aside === true ? ['aside'] : [])]) bases[`${e.detail.side}:${key}`] = (bases[`${e.detail.side}:${key}`] ?? 0) + 1;
  }
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
  return { fieldResults, exits, bases, positionsLost, mainBroke, decisiveExits };
}

it.skipIf(!enabled)('balance batch', () => {
  const rules = OVERRIDES ? (overridden(RULES, OVERRIDES, 'rules') as Rules) : RULES;
  const ctx = createContext(vitebskDecision({ candidateRoads: WITH_CANDIDATE_ROADS, frenchStrength: FRENCH, roadReadings: ROAD_READINGS, ...(PONTOON_START ? { pontoonStart: PONTOON_START } : {}) }), rules);
  const names = Object.keys(BOTS);
  const results: Record<string, Result[]> = {};
  const problems: string[] = [];
  for (const name of names) {
    results[name] = [];
    for (let seed = 1; seed <= SEEDS; seed++) for (let roll = 0; roll < DICE; roll++) {
      const policy = (BOTS[name] as (c: typeof ctx) => ReturnType<(typeof BOTS)[string]>)(ctx);
      const run = play(ctx, seed, policy, 5_000, diceFor(seed, roll));
      const trace = pinTraceOf(policy);
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
        raids: log.filter((e) => e.kind === 'raided').length,
        raidFood: log.filter((e) => e.kind === 'raided').reduce((n, e) => n + Number(e.detail.food), 0),
        raidHorses: log.filter((e) => e.kind === 'raided').reduce((n, e) => n + Number(e.detail.horses), 0),
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
        blockedIn: blockedIn(run, ctx),
        pin: trace ? { stages: pinStages(run, trace), plans: trace.plans, longest: trace.longest } : null,
      });
    }
  }

  const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const endings = Object.keys(ENDING_NAMES) as EndingId[];
  const lines: string[] = [];
  lines.push(`# Balance report: rules ${RULES_VERSION}${OVERRIDES || WITH_CANDIDATE_ROADS || FRENCH !== 'mid-august' ? ' (what-if)' : ''}, The Vitebsk Decision, seeds 1–${SEEDS}${DICE > 1 ? `, ${DICE} sets of dice each` : ''}`, '');
  if (OVERRIDES) lines.push(`**What-if run, not the adopted rules.** Overrides: \`${JSON.stringify(OVERRIDES)}\``, '');
  if (WITH_CANDIDATE_ROADS) lines.push('**What-if map, not the adopted network:** with the candidate roads (MAP_AND_GEOGRAPHY.md, "Missing").', '');
  if (ROAD_READINGS) lines.push('**What-if map, not the adopted network:** with the lengths of the road audit (HISTORICAL_RESEARCH, "The road audit").', '');
  if (FRENCH !== 'mid-august') lines.push(`**What-if strength, not the adopted scenario:** the French start at their 5 August strength by Nafziger's returns of 1 and 15 August, each group's horses, wagons and carried stocks grown with it${FRENCH === 'returns-5-august-cavalry' ? ', and its cavalry from the returns' : ', its cavalry in the same proportion'}; guns, depots and the Russians as adopted (HISTORICAL_RESEARCH, the history audit).`, '');
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
    `Cut-off credit: \`${rules.outcome.cutOffCredit}\`. "Road cut" counts games in which the line of retreat was held long enough at some point; of those, still cut off at the end, or broken out after losing at least ${rules.outcome.damagedLossPermille / 10}% of their strength in battle after the cut. "Blocked in" counts games in which a main army stood, at some order or deployment pause, at a place with no road out free of the French (contract D), whether or not it was then trapped in battle (third review).`,
    '',
    '| Strategy | Decisively defeated | Cut off | Forced out | Damaged | Intact | Road cut | Still cut off at the end | Broke out at a heavy cost | Blocked in at a pause |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const name of names) {
    const rs = results[name]!;
    const share = (test: (r: Result) => boolean) => pct(rs.filter(test).length, rs.length);
    lines.push(
      `| ${name} | ${(['decisivelyDefeated', 'cutOff', 'forcedOut', 'damaged', 'intact'] as const).map((x) => share((r) => r.russian === x)).join(' | ')} | ${share((r) => r.roadCut)} | ${share((r) => r.stillCutOff)} | ${share((r) => r.costlyEscape)} | ${share((r) => r.blockedIn)} |`,
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

  if (rules.raids.permille > 0) {
    lines.push('', '## Raids (means)', '', '| Strategy | Raids | Rations burned | Horses driven off |', '|---|---|---|---|');
    for (const name of names) {
      const rs = results[name]!;
      lines.push(`| ${name} | ${mean(rs.map((r) => r.raids)).toFixed(2)} | ${Math.round(mean(rs.map((r) => r.raidFood))).toLocaleString('en-GB')} | ${Math.round(mean(rs.map((r) => r.raidHorses))).toLocaleString('en-GB')} |`);
    }
  }

  lines.push(
    '',
    '## Sector battles (§2.10; per 100 games)',
    '',
    'How each side left the field, and by which road (TECHNICAL_ARCHITECTURE §3.4b): back the way an attacker came (line), towards the base, towards its own troops or towards a depot; "turned aside" counts defenders kept off the road the attacker took when both left at once (D-046). A lost position is a tactical defeat, not a rout; only routs and traps count towards a decisive defeat.',
    '',
    '| Strategy | Battles | Rounds per battle | Positions lost, French / Russian | Russians withdrew / routed / trapped | French withdrew / routed / trapped | Russian exits open / contested / blocked | Russians fell back by line / base / own / depot; turned aside | French fell back by line / base / own / depot; turned aside | A Russian main army broke |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  const per100 = (rs: Result[], f: (r: Result) => number) => Math.round((rs.reduce((n, r) => n + f(r), 0) * 100) / Math.max(1, rs.length));
  for (const name of names) {
    const rs = results[name]!;
    const n = (key: string, from: 'fieldResults' | 'exits' | 'bases') => per100(rs, (r) => r[from][key] ?? 0);
    const battles = rs.reduce((x, r) => x + r.battles, 0);
    const rounds = rs.reduce((x, r) => x + r.rounds, 0);
    lines.push(
      `| ${name} | ${per100(rs, (r) => r.battles)} | ${(rounds / Math.max(1, battles)).toFixed(1)} | ${per100(rs, (r) => r.positionsLost.fr)} / ${per100(rs, (r) => r.positionsLost.ru)} | ${n('ru:withdrew', 'fieldResults')} / ${n('ru:routed', 'fieldResults')} / ${n('ru:trapped', 'fieldResults')} | ${n('fr:withdrew', 'fieldResults')} / ${n('fr:routed', 'fieldResults')} / ${n('fr:trapped', 'fieldResults')} | ${n('ru:open', 'exits')} / ${n('ru:contested', 'exits')} / ${n('ru:blocked', 'exits')} | ${n('ru:line', 'bases')} / ${n('ru:base', 'bases')} / ${n('ru:own', 'bases')} / ${n('ru:depot', 'bases')}; ${n('ru:aside', 'bases')} | ${n('fr:line', 'bases')} / ${n('fr:base', 'bases')} / ${n('fr:own', 'bases')} / ${n('fr:depot', 'bases')}; ${n('fr:aside', 'bases')} | ${per100(rs, (r) => r.mainBroke)} |`,
    );
  }
  const decisiveExits = names.flatMap((name) => results[name]!.flatMap((r) => r.decisiveExits));
  const count = (e: string) => decisiveExits.filter((x) => x === e).length;
  lines.push(
    '',
    `**Decisive defeats in battle:** ${names.map((name) => `${name} ${results[name]!.filter((r) => r.russian === 'decisivelyDefeated').length}`).filter((x) => !x.endsWith(' 0')).join(', ') || 'none'}. The Russian breaks that counted towards them left by an open road ${count('open')} times, a contested one ${count('contested')} times, and were trapped with no road ${count('blocked')} times.`,
  );

  // The pinning attacks stage by stage (third review): where a trap is lost, not only whether it was won.
  const pinners = names.filter((name) => results[name]!.some((r) => r.pin !== null));
  if (pinners.length > 0) {
    lines.push(
      '',
      '## Pinning attacks, stage by stage (share of games)',
      '',
      'Each stage counts only games that reached the one before: a complete plan (a corps on every road out of a place where an army was seen, and one left to strike); every road held at once; a Russian main army really there then; a striker in a battle there, going on then or begun later; the Russians leaving that battle (withdrawn, routed or trapped); their road out blocked then. The first bot re-plans every turn; the other two keep a plan while the army is still seen there.',
      '',
      '| Bot | Complete plan | Every road held at once | A main army there then | A striker in battle there | The Russians left that battle | Their road out blocked | Decisive defeat | Plans adopted per game; most turns one was kept |',
      '|---|---|---|---|---|---|---|---|---|',
    );
    for (const name of pinners) {
      const rs = results[name]!;
      const reached = (stage: (typeof PIN_STAGES)[number]) => pct(rs.filter((r) => r.pin!.stages[stage]).length, rs.length);
      const kept = rs.some((r) => r.pin!.plans > 0) ? `${mean(rs.map((r) => r.pin!.plans)).toFixed(2)}; ${Math.max(...rs.map((r) => r.pin!.longest))}` : '—';
      lines.push(`| ${name} | ${PIN_STAGES.map(reached).join(' | ')} | ${pct(rs.filter((r) => r.russian === 'decisivelyDefeated').length, rs.length)} | ${kept} |`);
    }
  }

  // F1/F2/F3 on the first roll of each seed (the seed's own dice), comparable with earlier reports.
  const first = (name: string, seed: number) => results[name]![seed * DICE]!;
  const allSeeds = Array.from({ length: SEEDS }, (_, i) => i);
  // The three families of §2.13 apart from the other purposeful bots, variants of them and later approaches, and
  // apart from the controls (third review).
  const CONTROLS = ['prudent-halt', 'supplied-halt', 'random'];
  const otherBots = names.filter((n) => !FAMILIES.includes(n) && !CONTROLS.includes(n));
  const decisiveOn = (group: string[]) => allSeeds.filter((i) => group.some((n) => first(n, i).ending === 'decisiveSuccess')).length;
  // F3: who was best alone, who shared it and who was last, beside the earlier share with ties split (third review).
  const byRank = (f: string, i: number) => first(f, i).rank;
  const st = standing(FAMILIES, byRank, allSeeds);
  const fewestLost = withinTies(FAMILIES, byRank, (f, i) => first(f, i).frMen, allSeeds);
  const mostInflicted = withinTies(FAMILIES, byRank, (f, i) => -first(f, i).ruMain, allSeeds);
  const fresh = freshRegret(FAMILIES, (f, i, r) => results[f]![i * DICE + r]!.rank, allSeeds, DICE);

  // F4 over every purposeful bot (the random control left out): roll r of a scenario gives every bot the same
  // dice, so the split separates the dice shared by all bots on a roll from each bot's own (`varianceSplit`).
  const strategies = names.filter((n) => n !== 'random');
  const split = (rankOf: (e: EndingId) => number, seeds: number[] = allSeeds) => varianceSplit((k, i, r) => rankOf(results[strategies[k]!]![i * DICE + r]!.ending), strategies.length, seeds, DICE);
  const f4 = split((e) => ENDING_RANK[e]);
  // The same split with Costly Victory and Operational Success no longer tied: how much the ranks' spacing matters.
  const SPREAD: Record<EndingId, number> = { decisiveSuccess: 1, costlyVictory: 2, operationalSuccess: 3, limitedSuccess: 4, successfulConsolidation: 4, inconclusive: 5, precariousHalt: 5, repulse: 6, collapse: 7 };
  const f4spread = split((e) => SPREAD[e]);
  // With fresh dice: does the best approach on a scenario's first roll stay best on its other rolls? The
  // other rolls are held apart from the first, and scenarios with a tie on either side are counted on their
  // own, so that neither shared rolls nor ties make the best look more stable than it is (second review).
  const stability = { agree: 0, differ: 0, tied: 0, overlap: 0 };
  if (DICE > 1) {
    const bestOf = (score: (f: string) => number) => {
      const top = Math.min(...FAMILIES.map(score));
      return FAMILIES.filter((f) => score(f) === top);
    };
    for (let i = 0; i < SEEDS; i++) {
      const onFirst = bestOf((f) => first(f, i).rank);
      const onOthers = bestOf((f) => mean(Array.from({ length: DICE - 1 }, (_, r) => results[f]![i * DICE + r + 1]!.rank)));
      if (onFirst.some((f) => onOthers.includes(f))) stability.overlap++;
      if (onFirst.length > 1 || onOthers.length > 1) stability.tied++;
      else if (onFirst[0] === onOthers[0]) stability.agree++;
      else stability.differ++;
    }
  }
  const untied = stability.agree + stability.differ;

  // Uncertainty: a bootstrap over scenarios, keeping each scenario's strategies and rolls together (second
  // review, F5). The games are not independent results: they are 1,000 scenarios, each played many ways.
  const COMPONENTS = ['strategy', 'scenario', 'interaction', 'sharedDice', 'ownDice'] as const;
  const boot: { meanRank: Record<string, number[]>; best: Record<string, number[]>; raw: Record<string, number[]>; components: Record<string, number[]> } = {
    meanRank: Object.fromEntries(FAMILIES.map((f) => [f, []])),
    best: Object.fromEntries(FAMILIES.map((f) => [f, []])),
    raw: { strategy: [], scenario: [], interaction: [], dice: [] },
    components: Object.fromEntries(COMPONENTS.map((k) => [k, []])),
  };
  for (let b = 0; b < BOOT; b++) {
    const sample = allSeeds.map((k) => keyHash(1812, ['boot', b, k]) % SEEDS);
    for (const f of FAMILIES) boot.meanRank[f]!.push(mean(sample.flatMap((i) => Array.from({ length: DICE }, (_, r) => results[f]![i * DICE + r]!.rank))));
    const shares = standing(FAMILIES, byRank, sample).credit;
    for (const f of FAMILIES) boot.best[f]!.push(shares[f]! / SEEDS);
    if (DICE > 1) {
      const s = split((e) => ENDING_RANK[e], sample);
      for (const k of ['strategy', 'scenario', 'interaction', 'dice'] as const) boot.raw[k]!.push(s.raw[k]);
      for (const k of COMPONENTS) boot.components[k]!.push(s.components![k]);
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
  const share = (v: number) => `${(v * 100).toFixed(1)}%`;
  const list = (credit: Record<string, number>, of: number) => FAMILIES.map((f) => `${f} ${pct(credit[f]!, of)}`).join(', ');
  const othersDecisive = otherBots.map((n) => [n, results[n]!.filter((r) => r.ending === 'decisiveSuccess').length / results[n]!.length] as const).filter(([, v]) => v > 0);
  lines.push(
    `- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on ${pct(decisiveOn(FAMILIES), SEEDS)} of seeds (target ≥ 60%); with the other purposeful bots as well (variants of the families and later approaches), ${pct(decisiveOn([...FAMILIES, ...otherBots]), SEEDS)}. These are fixed bots, chosen with every seed in view; a selection judged on held-out seeds is in the adaptive report. No oracle search yet.`,
  );
  lines.push(
    `- **F2:** Decisive Success rate per family: ${FAMILIES.map((f) => `${f} ${pct(results[f]!.filter((r) => r.ending === 'decisiveSuccess').length, results[f]!.length)}`).join(', ')} (target ≈ 25% each). Among the other purposeful bots: ${othersDecisive.map(([n, v]) => `${n} ${share(v)}`).join(', ') || 'none'}.`,
  );
  lines.push(
    `- **F3:** share of seeds on which each family does best, ties split evenly: ${list(st.credit, SEEDS)} (target: none above 50%). Two or more share the best on ${pct(st.bestTied, SEEDS)} of seeds, all three on ${pct(st.allTied, SEEDS)}; who is best alone, who shares it and who is last are under "F3 in detail".`,
  );
  if (DICE > 1) {
    const c = f4.components!;
    lines.push(
      `- **F4:** variance of the ending rank over the ${strategies.length} purposeful bots, ${DICE} sets of dice per scenario (target: strategy above scenario). *Raw, descriptive* (sums of squares; a cell's mean over ${DICE} rolls still carries dice noise): strategy ${share(f4.raw.strategy)}, scenario ${share(f4.raw.scenario)}, which strategy suits which scenario ${share(f4.raw.interaction)}, dice ${share(f4.raw.dice)}. *Components, model-dependent* (every bot gets the same dice on a roll, so the dice shared by all bots on a roll are split from each bot's own; checked on data with known parts in analysis.test.ts): strategy ${share(c.strategy)}, scenario ${share(c.scenario)}, interaction ${share(c.interaction)}, dice shared by all bots ${share(c.sharedDice)}, each bot's own dice ${share(c.ownDice)}. The earlier adjustment, which took the dice as independent across bots, gives strategy ${share(f4.pooled.strategy)}, scenario ${share(f4.pooled.scenario)}, interaction ${share(f4.pooled.interaction)}, dice ${share(f4.pooled.dice)}: with shared dice it takes them out of the interaction and leaves them in the scenario. With the ranks spread out (Costly Victory above Operational Success), raw: strategy ${share(f4spread.raw.strategy)}, scenario ${share(f4spread.raw.scenario)}, interaction ${share(f4spread.raw.interaction)}, dice ${share(f4spread.raw.dice)}. Where one family is best on a scenario's first roll and one is best on its other ${DICE - 1} rolls, they are the same on ${pct(stability.agree, untied)} of ${untied} scenarios; ${pct(stability.tied, SEEDS)} of scenarios have a tie for best on one side or both.`,
    );
  } else {
    lines.push(`- **F4:** variance of the ending rank explained by the strategy ${share(f4.raw.strategy)}, by the seed ${share(f4.raw.scenario)}, interaction and dice together ${share(f4.raw.interaction)} (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.`);
  }
  lines.push(`- **F5:** the prudent halt, declared on the first turn before any victory, ends in: ${endings.filter((e) => halt.some((r) => r.ending === e)).map((e) => `${ENDING_NAMES[e]} ${pct(halt.filter((r) => r.ending === e).length, halt.length)}`).join(', ')} (target: never Decisive Success; a victory won before a later halt stands, D-035).`);
  lines.push(`- **F6:** random play reaches Decisive Success in ${pct(random.filter((r) => r.ending === 'decisiveSuccess').length, random.length)} of games (target < 5%).`);
  lines.push('', `*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. "The dice" decide battles, withdrawals, road priority and burned stores; weather and scouting errors are part of the scenario. Bots: ${names.join(', ')}.*`);

  // F3 in detail (third review): ties split evenly cannot say which family to choose.
  lines.push(
    '',
    '## F3 in detail (first roll of each seed; a lower rank is better)',
    '',
    `Each seed counts once for each family, in one column. Regret: ranks lost on the seed's other ${Math.max(0, DICE - 1)} rolls against the family that did best on those same rolls.`,
    '',
    '| Family | Best alone | Best, shared | All three equal | Between | Last, shared | Last alone | F3 share (ties split) | Regret on fresh rolls |',
    '|---|---|---|---|---|---|---|---|---|',
    ...FAMILIES.map((f) => `| ${f} | ${pct(st.bestAlone[f]!, SEEDS)} | ${pct(st.bestShared[f]!, SEEDS)} | ${pct(st.allTied, SEEDS)} | ${pct(st.middle[f]!, SEEDS)} | ${pct(st.lastShared[f]!, SEEDS)} | ${pct(st.lastAlone[f]!, SEEDS)} | ${pct(st.credit[f]!, SEEDS)} | ${fresh ? fresh.always[f]!.toFixed(2) : 'n/a'} |`),
    '',
    `Where two or more families share the best ending (${fewestLost.scenarios} seeds), the one that loses the fewest French men: ${list(fewestLost.credit, fewestLost.scenarios)}; the one that costs the Russian main armies most: ${list(mostInflicted.credit, mostInflicted.scenarios)} (ties split).${fresh ? ` Choosing on each seed the family best on its first roll loses ${fresh.firstLook.toFixed(2)} ranks on the fresh rolls, against ${FAMILIES.map((f) => `${fresh.always[f]!.toFixed(2)} for always ${f}`).join(', ')}.` : ''}`,
  );

  // Which mechanisms each bot reached, and whether it reached them again on the same scenario with fresh dice (third
  // review): a mechanism a scenario allows comes back on fresh rolls; one the dice gave does not.
  if (DICE > 1) {
    const won = (r: Result) => r.rank <= ENDING_RANK.operationalSuccess;
    lines.push(
      '',
      '## Mechanisms reached, and again on fresh rolls',
      '',
      `For each bot: the share of seeds on which its first roll cut the Russian road or won (Decisive Success, Costly Victory or Operational Success), and, on those seeds, how often its other ${DICE - 1} rolls did the same. Bots whose first rolls did neither are listed below the table.`,
      '',
      '| Bot | Road cut, first roll | Then road cut on fresh rolls | Then won on fresh rolls | Won, first roll | Then won on fresh rolls |',
      '|---|---|---|---|---|---|',
    );
    const neither: string[] = [];
    for (const name of names.filter((n) => n !== 'random')) {
      const freshOf = (i: number) => Array.from({ length: DICE - 1 }, (_, r) => results[name]![i * DICE + r + 1]!);
      const cut = allSeeds.filter((i) => first(name, i).roadCut);
      const wins = allSeeds.filter((i) => won(first(name, i)));
      if (cut.length === 0 && wins.length === 0) {
        neither.push(name);
        continue;
      }
      const again = (seeds: number[], test: (r: Result) => boolean) => (seeds.length === 0 ? '—' : pct(seeds.flatMap(freshOf).filter(test).length, seeds.length * (DICE - 1)));
      lines.push(`| ${name} | ${pct(cut.length, SEEDS)} | ${again(cut, (r) => r.roadCut)} | ${again(cut, won)} | ${pct(wins.length, SEEDS)} | ${again(wins, won)} |`);
    }
    if (neither.length > 0) lines.push('', `Neither on any first roll: ${neither.join(', ')}.`);
  }

  if (BOOT > 1) {
    const rank = (v: number) => v.toFixed(2);
    lines.push(
      '',
      `## Uncertainty (bootstrap over scenarios, ${BOOT} replicates, middle 95%)`,
      '',
      'Each replicate redraws the scenarios with replacement, keeping every strategy and every roll of a scenario together.',
      '',
      '| Family | Mean ending rank | Share of seeds on which it does best (F3, ties split) |',
      '|---|---|---|',
      ...FAMILIES.map((f) => `| ${f} | ${rank(mean(results[f]!.map((r) => r.rank)))} (${interval(boot.meanRank[f]!, rank)}) | ${pct(st.credit[f]!, SEEDS)} (${interval(boot.best[f]!, share)}) |`),
    );
    if (DICE > 1) {
      const c = f4.components!;
      const both = (k: 'strategy' | 'scenario' | 'interaction') => `| ${k} | ${share(f4.raw[k])} (${interval(boot.raw[k]!, share)}) | ${share(c[k])} (${interval(boot.components[k]!, share)}) |`;
      const diceAll = boot.components.sharedDice!.map((v, k) => v + boot.components.ownDice![k]!);
      lines.push(
        '',
        '| Variance share (F4) | Raw, descriptive | Components, model-dependent |',
        '|---|---|---|',
        both('strategy'),
        both('scenario'),
        both('interaction'),
        `| dice | ${share(f4.raw.dice)} (${interval(boot.raw.dice!, share)}) | ${share(c.sharedDice + c.ownDice)} (${interval(diceAll, share)}) |`,
        `| of which shared by every bot on a roll | — | ${share(c.sharedDice)} (${interval(boot.components.sharedDice!, share)}) |`,
        `| of which each bot's own | — | ${share(c.ownDice)} (${interval(boot.components.ownDice!, share)}) |`,
      );
    }
  }

  console.log(['BALANCE-REPORT-START', ...lines, 'BALANCE-REPORT-END'].join('\n'));
  // Integrity is a gate; the fairness diagnostics above are not.
  expect(problems.slice(0, 20)).toEqual([]);
  // 48,000 games ran just over an hour beside the other probes (third review); a time limit is not a result.
}, 10_800_000);
