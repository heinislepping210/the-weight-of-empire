// What the campaign leaves on the map (M2, V5), as the French know it.

import { describe, expect, it } from 'vitest';
import { createContext, newGame } from '../../src/engine';
import type { Frame, LogEntry, Mark } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { battleText, burnedText, districtText, dustOf, lastSeenDistricts, scarsOf, strippingOf } from '../../src/ui/consequences';
import { FOCUS_MS, focusWeight, focusesOf, timesOf } from '../../src/ui/playbackModel';
import { advancePolicy, play } from '../fixtures/driver';
import { forceInit, passiveContext, testGround } from '../fixtures/testGround';

// Groups that see 15 km by road, as in the playback tests: from A and B, the places A, B, E and G.
const blind = passiveContext(
  testGround((sc) => {
    forceInit(sc, 'fr-main').horses = 0;
    forceInit(sc, 'fr-flank').horses = 0;
  }),
);

const mark = (over: Partial<Mark>): Mark => ({ id: 'g', kind: 'group', at: 'A', to: null, metres: 0, via: [], strength: 1000, activity: 'march', ...over });
const frame = (hour: number, marks: Mark[], over: Partial<Frame> = {}): Frame => ({ turn: 1, slot: 0, hour, marks, events: [], rain: false, mud: [], ...over });

describe('districts as the French last saw them', () => {
  it('only places within their range, and a place they left keeps what they saw there', () => {
    const first = newGame(blind, 3);
    const later = structuredClone(first);
    later.resolution.turn = 2;
    // Both groups gone east to F, out of sight of B, and B stripped since.
    later.forces['fr-main']!.at = 'F';
    later.forces['fr-flank']!.at = 'F';
    later.districts.B = { food: 0, fodder: 0 };
    const seen = lastSeenDistricts([first, later], blind);
    expect([...seen.keys()].sort()).toEqual(['A', 'B', 'E', 'F', 'G']);
    expect(seen.get('B')).toEqual({ food: 40_000, fodder: 15_000, turn: 1 });
    expect(seen.get('F')!.turn).toBe(2);
    expect(seen.has('C')).toBe(false);
  });

  it('is judged by the scarcer of food and fodder against what the district held at the start', () => {
    const at = (food: number, fodder: number) => strippingOf(blind, 'B', { food, fodder, turn: 1 }).stripping;
    expect(at(40_000, 15_000)).toBe('untouched');
    expect(at(40_000, 12_000)).toBe('foraged');
    expect(at(10_000, 15_000)).toBe('stripped');
    expect(at(40_000, 2_000)).toBe('bare');
    expect(districtText(blind, 'B', { food: 20_000, fodder: 3_000, turn: 1 }, 1)).toBe('The district of Node B, now: about 50% of its food and 20% of its fodder left.');
    expect(districtText(blind, 'B', { food: 20_000, fodder: 3_000, turn: 1 }, 3)).toMatch(/^The district of Node B, as last seen on 5 Aug:/);
  });

  it('on the real scenario, the districts the French forage show as they strip them', () => {
    const ctx = createContext(vitebskDecision());
    const run = play(ctx, 1812, { orders: () => [] });
    const seen = lastSeenDistricts(run.states.slice(0, 6), ctx);
    expect([...seen].some(([node, d]) => strippingOf(ctx, node, d).stripping !== 'untouched')).toBe(true);
    // Smolensk, where only the Russians forage, is out of the French groups' sight at the start.
    expect(seen.has('smolensk')).toBe(false);
  });
});

describe('burned stores and battlefields', () => {
  it('a depot that changed hands keeps its mark, with the share burned', () => {
    const logs: LogEntry[] = [{ turn: 2, slot: 1, stage: 'accrual', kind: 'depotCaptured', detail: { node: 'F', by: 'fr', food: 120_000, fodder: 30_000, ammo: 6_000, burnedPermille: 700 } }];
    const s = newGame(blind, 3);
    const { burned } = scarsOf(logs, s);
    expect(burned).toEqual([{ node: 'F', when: { turn: 2, slot: 1 }, by: 'fr', permille: 700 }]);
    expect(burnedText(blind, burned[0]!)).toBe('The depot at Node F changed hands on 7 Aug: about 70% of its stores burned when we took it.');
  });

  it('a battle fought to its end is marked where it was fought, with its result and our losses', () => {
    const run = play(blind, 1812, advancePolicy);
    const { battles } = scarsOf(run.logs.flat(), run.final);
    const over = Object.values(run.final.battles).filter((b) => b.phase === 'over');
    expect(over.length).toBeGreaterThan(0);
    expect(battles).toHaveLength(over.length);
    const b = over[0]!;
    const ours = b.sides.fr.reduce((n, id) => n + (b.losses[id] ?? 0), 0);
    expect(battles[0]).toEqual({ node: b.node, when: b.startsAt, winner: b.winner, ourLosses: ours });
    expect(battleText(blind, battles[0]!)).toMatch(new RegExp(`^Battle at Node ${b.node}, \\d+ Aug: .+\\. Our losses: about .+ men\\.$`));
  });
});

describe('dust', () => {
  const moved = [frame(0, [mark({})]), frame(1, [mark({ at: 'B', to: 'C', metres: 1_000, via: ['B'] })])];

  it('rises on the dry roads a column marched along', () => {
    expect(dustOf(blind, moved)).toEqual(['A-B', 'B-C']);
  });

  it('not on a road in mud, nor while it rains, nor where nothing moved', () => {
    expect(dustOf(blind, [moved[0]!, { ...moved[1]!, mud: ['B-C'] }])).toEqual(['A-B']);
    expect(dustOf(blind, [moved[0]!, { ...moved[1]!, rain: true }])).toEqual([]);
    expect(dustOf(blind, [moved[0]!, frame(1, [mark({})])])).toEqual([]);
  });
});

describe("the camera's focus moments (V7)", () => {
  const contact = (hour: number, node = 'B'): Frame => frame(hour, [], { events: [{ kind: 'contact', node, detail: {} }] });

  it('one at a time, passing over a moment that would wait too long, and easing in and out', () => {
    const frames = [frame(0, []), contact(1), contact(2, 'C'), ...Array.from({ length: 12 }, (_, k) => frame(3 + k, [])), contact(15, 'D')];
    const times = timesOf(frames);
    const focuses = focusesOf(frames, times);
    // The second contact comes 140 ms after the first and would wait 1.4 s: passed over.
    expect(focuses.map((f) => f.start)).toEqual([times[1], times[15]]);
    const f = focuses[0]!;
    expect(f.end - f.start).toBe(FOCUS_MS);
    expect(focusWeight(f.start - 1, f)).toBe(0);
    expect(focusWeight(f.start, f)).toBe(0);
    expect(focusWeight(f.start + FOCUS_MS / 2, f)).toBe(1);
    expect(focusWeight(f.start + FOCUS_MS / 8, f)).toBeCloseTo(0.5);
    expect(focusWeight(f.end + 1, f)).toBe(0);
    // Deliveries and skirmishes are not moments the camera moves for.
    expect(focusesOf([frame(0, []), frame(1, [], { events: [{ kind: 'delivery', node: 'B', detail: {} }] })], [0, 140])).toEqual([]);
  });
});
