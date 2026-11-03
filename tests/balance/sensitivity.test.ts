// Sensitivity of the sector battles' placeholder values (G-022; plan checkpoint B). Skipped in normal runs:
//   BALANCE=1 BALANCE_SEEDS=500 npx vitest run tests/balance/sensitivity.test.ts
// Each variant lays one set of rule overrides over the adopted rules. The same bots play the same seeds with
// the same dice under every variant, so the variants differ only by the value changed. SENSITIVITY_VARIANTS
// picks variants by index (to run them in parallel); BALANCE_BOTS picks the bots. It prints a markdown table
// per bot between SENSITIVITY-REPORT markers.

import { it } from 'vitest';
import { ENDING_NAMES, ENDING_RANK, RULES, RULES_VERSION, createContext, evaluate } from '../../src/engine';
import type { EndingId, Rules } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { BOTS } from './bots';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** What-if map: BALANCE_SCENARIO=candidate-roads adds the roads not yet adopted (MAP_AND_GEOGRAPHY.md). */
const WITH_CANDIDATE_ROADS = env.BALANCE_SCENARIO === 'candidate-roads';
const SEEDS = Number(env.BALANCE_SEEDS ?? 500);

const VARIANTS: { name: string; over: Record<string, unknown> }[] = [
  { name: 'adopted', over: {} },
  { name: 'contested exit costs 1.5%', over: { battle: { rearguardPermille: { open: 10, contested: 15 } } } },
  { name: 'contested exit costs 6%', over: { battle: { rearguardPermille: { open: 10, contested: 60 } } } },
  { name: 'pursuit halved', over: { battle: { pursuitPermille: 50, routPursuitPermille: 150 } } },
  { name: 'pursuit doubled', over: { battle: { pursuitPermille: 200, routPursuitPermille: 600 } } },
  { name: 'flank ×1.15', over: { battle: { flankPermille: 1150 } } },
  { name: 'flank ×1.5', over: { battle: { flankPermille: 1500 } } },
  { name: 'lost position shock 40', over: { battle: { positionLossShock: 40 } } },
  { name: 'lost position shock 120', over: { battle: { positionLossShock: 120 } } },
];

const BOT_NAMES = env.BALANCE_BOTS?.split(',') ?? ['concentrated-push', 'southern-envelopment', 'bait-and-converge', 'southern-envelopment-hold', 'southern-envelopment-guard-at-base', 'concentrated-strike'];

/** The rules with `over` laid on top, group by group; an unknown name is an error, not a silent no-op. */
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

it.skipIf(env.BALANCE !== '1')('sector-battle sensitivity', () => {
  const picked = env.SENSITIVITY_VARIANTS ? env.SENSITIVITY_VARIANTS.split(',').map(Number) : VARIANTS.map((_, i) => i);
  const shown: EndingId[] = ['decisiveSuccess', 'costlyVictory', 'operationalSuccess', 'limitedSuccess', 'inconclusive', 'repulse', 'collapse'];
  const rows: string[] = [];
  let problems = 0;
  for (const bot of BOT_NAMES) {
    for (const i of picked) {
      const v = VARIANTS[i]!;
      const ctx = createContext(vitebskDecision({ candidateRoads: WITH_CANDIDATE_ROADS }), overridden(RULES, v.over, 'rules') as Rules);
      const endings: Record<string, number> = {};
      let rank = 0;
      let decisive = 0;
      let mainBroke = 0;
      let frenchRouted = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const run = play(ctx, seed, BOTS[bot]!(ctx), 5_000);
        problems += violations(run).length;
        const o = evaluate(run.states[0]!, run.final, ctx);
        endings[o.ending] = (endings[o.ending] ?? 0) + 1;
        rank += ENDING_RANK[o.ending];
        if (o.russian === 'decisivelyDefeated') decisive++;
        for (const b of Object.values(run.final.battles)) {
          if (b.field.result.ru !== null && b.field.result.ru !== 'withdrew' && b.sides.ru.some((id) => run.final.mainArmies.includes(id))) mainBroke++;
          if (b.field.result.fr !== null && b.field.result.fr !== 'withdrew') frenchRouted++;
        }
      }
      const pct = (n: number) => `${((n * 100) / SEEDS).toFixed(1)}%`;
      rows.push(`ROW|${bot}|${i}|| ${v.name} | ${shown.map((e) => pct(endings[e] ?? 0)).join(' | ')} | ${(rank / SEEDS).toFixed(2)} | ${decisive} | ${Math.round((mainBroke * 100) / SEEDS)} | ${Math.round((frenchRouted * 100) / SEEDS)} |`);
    }
  }
  const header = `| Variant | ${shown.map((e) => ENDING_NAMES[e]).join(' | ')} | Mean rank | Russians decisively defeated (games) | A Russian main army broke (per 100 games) | French routed or trapped (per 100 games) |`;
  console.log(['SENSITIVITY-REPORT', `rules ${RULES_VERSION}, seeds 1–${SEEDS}, one set of dice; invariant violations: ${problems}`, `HEADER${header}`, ...rows, 'SENSITIVITY-REPORT'].join('\n'));
});
