// Saved runs for side-by-side comparison (M1). Kept in this browser only; storage may be unavailable,
// so every access is guarded and the game works without it.

import { RULES_VERSION, evaluate, statusOf, when } from '../engine';
import type { Context, EndingId, GameState, LogEntry, RussianResult, Side } from '../engine';

export interface RunPoint {
  turn: number;
  date: string;
  frMen: number;
  frHorses: number;
  frFoodDays: number;
  /** True Russian strength: recorded only for a run saved after the campaign ended (§2.8). */
  ruMen: number | null;
}

/** The verdict as the evaluator gives it at the end of the campaign, so Compare says what the end screen said (third review). */
export interface RunVerdict {
  ending: EndingId;
  russian: RussianResult;
  holdsKeyGround: boolean;
  /** The first of the three tests of the army's state it failed, or null when it met all three. */
  firstFailing: 'capable' | 'sustainable' | 'secure' | null;
  frenchMenLostPermille: number;
  frenchHorsesLostPermille: number;
  /** Of the Russian main armies' strength at the start. */
  russianMainLostPermille: number;
  reasons: string[];
}

export interface SavedRun {
  id: string;
  label: string;
  seed: number;
  rules: string;
  ended: boolean;
  series: RunPoint[];
  battles: string[];
  /** Battle decisions the player took, apart from the rounds fought: what playing a battle costs in clicks (§3.4b). Absent in older saves. */
  battleDecisions?: number;
  battleRounds?: number;
  /** Null while the campaign is still being played; absent in saves from before rules 0.18.0. */
  verdict?: RunVerdict | null;
  /** Hidden information, revealed only for a finished campaign: null while it is still being played. */
  russianPlans: string[] | null;
  finalPositions: string[] | null;
}

const KEY = 'twoe.runs.v1';

/** Men, or all horses: saddle, artillery and draught. */
const total = (s: GameState, side: Side, k: 'men' | 'horses') =>
  Object.values(s.forces)
    .filter((f) => f.side === side)
    .reduce((n, f) => n + (k === 'men' ? f.men : f.horses + f.draught), 0);

export function summarize(states: readonly GameState[], logs: readonly LogEntry[][], ctx: Context, label: string, seed: number): SavedRun {
  const place = (id: unknown) => ctx.graph.nodes.get(String(id))?.name ?? String(id);
  // A campaign still in play keeps its fog of war: nothing the French do not know is stored (§2.8).
  const ended = states[states.length - 1]?.ended != null;
  const checkpoints = states.filter((s, i) => i === states.length - 1 || statusOf(s).kind === 'awaitingOrders');
  const series = checkpoints.map((s) => {
    const men = total(s, 'fr', 'men');
    const food = Object.values(s.forces)
      .filter((f) => f.side === 'fr')
      .reduce((n, f) => n + f.stock.food, 0);
    // A run saved in the middle of a turn is dated by the moment it was saved, not by the turn's first morning.
    const date = s.ended ? 'End of campaign' : statusOf(s).kind === 'awaitingOrders' ? when(ctx, { turn: s.resolution.turn, slot: 0 }) : when(ctx, s.resolution);
    return { turn: s.resolution.turn, date, frMen: men, frHorses: total(s, 'fr', 'horses'), frFoodDays: Math.round((food / Math.max(1, men)) * 10) / 10, ruMen: ended ? total(s, 'ru', 'men') : null };
  });
  const entries = logs.flat();
  const final = states[states.length - 1] as GameState;
  const o = ended ? evaluate(states[0] as GameState, final, ctx) : null;
  const verdict: RunVerdict | null = o && {
    ending: o.ending,
    russian: o.russian,
    holdsKeyGround: o.holdsKeyGround,
    firstFailing: !o.capable ? 'capable' : !o.sustainable ? 'sustainable' : !o.secure ? 'secure' : null,
    frenchMenLostPermille: o.frenchMenLostPermille,
    frenchHorsesLostPermille: o.frenchHorsesLostPermille,
    russianMainLostPermille: o.russianMainLostPermille,
    reasons: o.reasons,
  };
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    label,
    seed,
    rules: RULES_VERSION,
    ended,
    series,
    battles: entries.filter((e) => e.kind === 'battleJoined').map((e) => `${place(e.detail.node)} (${when(ctx, e)})`),
    battleDecisions: Object.values(final.battles).reduce((n, b) => n + b.field.decisions, 0),
    battleRounds: Object.values(final.battles).reduce((n, b) => n + b.roundsFought, 0),
    verdict,
    russianPlans: !ended ? null : entries.filter((e) => e.kind === 'russianPlan').map((e) => `${when(ctx, e)}: ${e.detail.plan}${e.detail.target ? ` → ${place(e.detail.target)}` : ''}`),
    finalPositions: !ended ? null : Object.values(final.forces).map((f) => `${f.name}: ${place(f.at)}`),
  };
}

export function loadRuns(): SavedRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedRun[]) : [];
  } catch {
    return [];
  }
}

export function storeRuns(runs: SavedRun[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs.slice(-8)));
  } catch {
    // Storage unavailable (private window, blocked site data): comparison works for this session only.
  }
}
