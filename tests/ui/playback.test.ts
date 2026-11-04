import { describe, expect, it } from 'vitest';
import { advanceWithPlayback, createContext, newGame, ordersFrom, planDirective, supplyLines } from '../../src/engine';
import type { Directive, Frame } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { HOUR_MS, NIGHT_MS, clockOf, eventful, isShort, pointOf, sample, supplyText, timesOf, tracksOf, trailsOf } from '../../src/ui/playbackModel';
import { POSITION } from '../../src/ui/projection';

const ctx = createContext(vitebskDecision());
const march: Directive = { objective: 'smolensk', axis: null, tempo: 'steady', posture: 'concentrated', engagement: 'accept', holdBack: [], logistics: 'hold' };

function firstTurn(d: Directive): Frame[] {
  const s = newGame(ctx, 1812);
  const { result, frames } = advanceWithPlayback(s, { kind: 'orders', turn: 1, orders: ordersFrom(planDirective(s, ctx, d)) }, ctx);
  if (!result.ok) throw new Error(result.reason);
  return frames;
}

describe('turn playback on the map', () => {
  const frames = firstTurn(march);

  it('takes an hour each, with a pause for each night: a whole turn in about four seconds', () => {
    const times = timesOf(frames);
    expect(frames).toHaveLength(25);
    expect(times[1]).toBe(HOUR_MS);
    // Day one's evening to day two's morning.
    const dawn = frames.findIndex((f) => f.slot === 2);
    expect(times[dawn]! - times[dawn - 1]!).toBe(HOUR_MS + NIGHT_MS);
    expect(times[times.length - 1]).toBe(24 * HOUR_MS + NIGHT_MS);
    expect(times[times.length - 1]).toBeGreaterThanOrEqual(2_000);
    expect(times[times.length - 1]).toBeLessThanOrEqual(6_000);
  });

  it('keeps the clock in step with the turn: 06:00 to 18:00 each day', () => {
    expect(clockOf(ctx, frames[0]!)).toBe('5 Aug 06:00');
    expect(clockOf(ctx, frames[6]!)).toBe('5 Aug 12:00');
    expect(clockOf(ctx, frames[12]!)).toBe('5 Aug 18:00');
    expect(clockOf(ctx, frames[13]!)).toBe('6 Aug 07:00');
    expect(clockOf(ctx, frames[24]!)).toBe('6 Aug 18:00');
  });

  it('moves a marker along the roads it took, through each place it reached', () => {
    const tracks = tracksOf(ctx, frames);
    const reached = tracks.flatMap((t) => t.paths.map((p, i) => ({ t, p, i }))).find(({ p }) => p !== null && p.length > 2);
    expect(reached).toBeDefined();
    const { t, p, i } = reached!;
    expect(p![0]).toEqual(t.points[i - 1]);
    expect(p![p!.length - 1]).toEqual(t.points[i]);
    for (const q of p!.slice(1, -1)) expect(Object.values(POSITION)).toContainEqual(q);
  });

  it('samples a path by its length', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    expect(sample(path, 0)).toEqual({ x: 0, y: 0 });
    expect(sample(path, 0.25)).toEqual({ x: 10, y: 0 });
    expect(sample(path, 0.625)).toEqual({ x: 10, y: 15 });
    expect(sample(path, 1)).toEqual({ x: 10, y: 30 });
  });

  it('draws where each group went, and plays only what moved or happened', () => {
    expect(eventful(frames)).toBe(true);
    expect(trailsOf(ctx, frames).length).toBeGreaterThan(0);
    const still = firstTurn({ ...march, objective: null });
    // Holding the line: wagon trains still go out, but no group moves.
    expect(trailsOf(ctx, still)).toEqual([]);
    const start = frames[0]!.marks.find((m) => m.kind === 'group')!;
    expect(pointOf(ctx, start)).toEqual(POSITION[start.at]);
  });

  it('names a supply line, and calls it short when its train brings less than its group eats', () => {
    const s = newGame(ctx, 1812);
    const lines = supplyLines(s, ctx);
    const short = lines.find(isShort);
    const enough = lines.find((l) => l.need !== null && !isShort(l));
    if (short) expect(supplyText(short, s, ctx)).toMatch(/Short: the rest must come from what it carries and forages\.$/);
    if (enough) expect(supplyText(enough, s, ctx)).not.toMatch(/Short/);
    expect(short ?? enough).toBeDefined();
    for (const l of lines) expect(supplyText(l, s, ctx)).toMatch(/rations a day|no draught horses|nothing left to load/);
  });
});
