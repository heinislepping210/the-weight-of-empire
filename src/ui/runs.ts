// Saved runs for side-by-side comparison (M1). Kept in this browser only; storage may be unavailable,
// so every access is guarded and the game works without it.

import { RULES_VERSION, statusOf, when } from '../engine';
import type { Context, GameState, LogEntry, Side } from '../engine';

export interface RunPoint {
  turn: number;
  date: string;
  frMen: number;
  frHorses: number;
  frFoodDays: number;
  ruMen: number;
}

export interface SavedRun {
  id: string;
  label: string;
  seed: number;
  rules: string;
  ended: boolean;
  series: RunPoint[];
  battles: string[];
  russianPlans: string[];
  finalPositions: string[];
}

const KEY = 'twoe.runs.v1';

const total = (s: GameState, side: Side, k: 'men' | 'horses') =>
  Object.values(s.forces)
    .filter((f) => f.side === side)
    .reduce((n, f) => n + f[k], 0);

export function summarize(states: readonly GameState[], logs: readonly LogEntry[][], ctx: Context, label: string, seed: number): SavedRun {
  const place = (id: unknown) => ctx.graph.nodes.get(String(id))?.name ?? String(id);
  const checkpoints = states.filter((s, i) => i === states.length - 1 || statusOf(s).kind === 'awaitingOrders');
  const series = checkpoints.map((s) => {
    const men = total(s, 'fr', 'men');
    const food = Object.values(s.forces)
      .filter((f) => f.side === 'fr')
      .reduce((n, f) => n + f.stock.food, 0);
    const date = s.ended ? 'End of campaign' : when(ctx, { turn: s.resolution.turn, slot: 0 });
    return { turn: s.resolution.turn, date, frMen: men, frHorses: total(s, 'fr', 'horses'), frFoodDays: Math.round((food / Math.max(1, men)) * 10) / 10, ruMen: total(s, 'ru', 'men') };
  });
  const entries = logs.flat();
  const final = states[states.length - 1] as GameState;
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    label,
    seed,
    rules: RULES_VERSION,
    ended: final.ended !== null,
    series,
    battles: entries.filter((e) => e.kind === 'battleJoined').map((e) => `${place(e.detail.node)} (${when(ctx, e)})`),
    russianPlans: entries.filter((e) => e.kind === 'russianPlan').map((e) => `${when(ctx, e)}: ${e.detail.plan}${e.detail.target ? ` → ${place(e.detail.target)}` : ''}`),
    finalPositions: Object.values(final.forces).map((f) => `${f.name}: ${place(f.at)}`),
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
