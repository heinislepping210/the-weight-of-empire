// Playback (M2, G4, G6, V4): the frames are recorded while the turn resolves, change nothing, follow the roads, and
// show only what the French would know.

import { describe, expect, it } from 'vitest';
import { RULES, advance, advanceWithPlayback, createContext, newGame, observedPlaces, stateHash, statusOf } from '../../src/engine';
import type { Context, Frame, GameState, GroupOrder, Input, Mark } from '../../src/engine';
import { edgeBetween } from '../../src/engine/graph';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { BOTS } from '../balance/bots';
import { advancePolicy, play } from '../fixtures/driver';
import { forceInit, holdStill, passiveContext, testGround } from '../fixtures/testGround';

const vitebsk = createContext(vitebskDecision());
const open = passiveContext(testGround());
const time = (f: Frame) => ((f.turn - 1) * 4 + f.slot) * 6 + f.hour;
const orders = (s: GameState, list: GroupOrder[] = []): Input => ({ kind: 'orders', turn: s.resolution.turn, orders: list });

/** Plays the inputs of a recorded game again with playback, checking each step against `advance`. */
function replayWithPlayback(ctx: Context, start: GameState, inputs: readonly Input[]): Frame[][] {
  let s = start;
  const all: Frame[][] = [];
  for (const input of inputs) {
    const plain = advance(s, input, ctx);
    const { result, frames } = advanceWithPlayback(s, input, ctx);
    if (!plain.ok || !result.ok) throw new Error('a recorded input was refused');
    expect(stateHash(result.state)).toBe(stateHash(plain.state));
    expect(result.log).toEqual(plain.log);
    all.push(frames);
    s = result.state;
  }
  return all;
}

/** Whether `b` follows from `a` by road: through the places it reached, in order, to where it stands. */
function byRoad(ctx: Context, a: Mark, b: Mark): boolean {
  const adjacent = (x: string, y: string) => edgeBetween(ctx.graph, x, y) !== undefined;
  let node = a.at;
  let onRoad = a.to;
  for (const v of b.via) {
    if (onRoad !== null ? v !== onRoad : !adjacent(node, v)) return false;
    node = v;
    onRoad = null;
  }
  if (b.via.length === 0 && onRoad !== null) return b.at === a.at && b.to === a.to && b.metres >= a.metres;
  return b.at === node && (b.to === null || adjacent(node, b.to));
}

describe('playback records the turn without changing it', () => {
  it('a game advanced with playback is the same game, step by step, on the real scenario', () => {
    const run = play(vitebsk, 1812, BOTS.methodical!(vitebsk));
    const frames = replayWithPlayback(vitebsk, run.states[0]!, run.inputs);
    expect(frames.flat().length).toBeGreaterThan(100);
  });

  it('and on the test ground, with battles fought and left to the marshal', () => {
    const run = play(open, 1812, advancePolicy);
    replayWithPlayback(open, run.states[0]!, run.inputs);
  });
});

describe('the frames', () => {
  const run = play(vitebsk, 1812, BOTS.methodical!(vitebsk));
  const frames = replayWithPlayback(vitebsk, run.states[0]!, run.inputs);

  it('run in time order: the moment before, then one for each hour of movement', () => {
    frames.forEach((list, k) => {
      const before = run.states[k]!;
      expect(list[0]!.hour).toBe(0);
      expect([list[0]!.turn, list[0]!.slot]).toEqual([before.resolution.turn, before.resolution.slot]);
      for (let i = 1; i < list.length; i++) expect(time(list[i]!)).toBeGreaterThan(time(list[i - 1]!));
      for (const f of list.slice(1)) expect(f.hour).toBeGreaterThanOrEqual(1);
    });
    // A turn with no battle to stop it has its four daylight sub-steps of six hours each.
    const quiet = frames.find((_, k) => statusOf(run.states[k]!).kind === 'awaitingOrders' && statusOf(run.states[k + 1]!).kind === 'awaitingOrders');
    expect(quiet).toBeDefined();
    expect(quiet!.length).toBe(1 + 24);
  });

  it('move every group and train by road, through the places it reached', () => {
    let checked = 0;
    for (const list of frames) {
      for (let i = 1; i < list.length; i++) {
        const before = new Map(list[i - 1]!.marks.map((m) => [m.id, m]));
        for (const m of list[i]!.marks) {
          const a = before.get(m.id);
          if (!a) continue;
          expect(byRoad(vitebsk, a, m), `${m.id} at frame ${i}: ${JSON.stringify(a)} → ${JSON.stringify(m)}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('end where the turn left each French group', () => {
    const where = (at: string, to: string | null, metres: number) => (to === null || metres === 0 ? at : `${at}>${to}@${metres}`);
    frames.forEach((list, k) => {
      const after = run.states[k + 1]!;
      const last = list[list.length - 1]!;
      if (list.length === 1) return;
      for (const m of last.marks.filter((x) => x.kind === 'group')) {
        const f = after.forces[m.id]!;
        expect(where(m.at, m.to, m.metres), m.id).toBe(where(f.at, f.transit?.to ?? null, f.transit?.metres ?? 0));
      }
    });
  });

  it('never show a Russian wagon train, and show deliveries by French trains only', () => {
    const french = new Set(Object.values(run.states[0]!.convoys).filter((c) => c.side === 'fr').map((c) => c.id));
    const all = frames.flat();
    for (const f of all) for (const m of f.marks.filter((x) => x.kind === 'train')) expect(french.has(m.id)).toBe(true);
    const deliveries = all.flatMap((f) => f.events.filter((e) => e.kind === 'delivery'));
    expect(deliveries.length).toBeGreaterThan(0);
    for (const e of deliveries) expect(french.has(String(e.detail.convoy))).toBe(true);
  });
});

describe('the weather in the frames', () => {
  it('is the day\'s rain and the roads as they stand at each hour: mud comes overnight after rain', () => {
    const run = play(vitebsk, 1812, BOTS.methodical!(vitebsk));
    let rained = false;
    let muddy = false;
    run.inputs.forEach((input, k) => {
      const s = run.states[k]!;
      // What the state held at each hour, watched directly.
      const hours: { rain: boolean; mud: string[] }[] = [{ rain: s.rainToday, mud: Object.keys(s.roads).filter((id) => s.roads[id] === 'mud').sort() }];
      advance(s, input, vitebsk, (live, at) => {
        if (at.stage === 'movement' && at.hour !== null) hours.push({ rain: live.rainToday, mud: Object.keys(live.roads).filter((id) => live.roads[id] === 'mud').sort() });
      });
      const { frames } = advanceWithPlayback(s, input, vitebsk);
      expect(frames.map((f) => ({ rain: f.rain, mud: f.mud }))).toEqual(hours);
      rained ||= frames.some((f) => f.rain);
      muddy ||= frames.some((f) => f.mud.length > 0);
    });
    expect([rained, muddy]).toEqual([true, true]);
  });
});

describe('what the French see (§2.8)', () => {
  // No horses to scout with: each group sees 15 km by road. The Cossack post at E is 15 km from B; the Russian
  // main army at D is 37 km away.
  const blind = passiveContext(
    testGround((sc) => {
      forceInit(sc, 'fr-main').horses = 0;
      forceInit(sc, 'fr-flank').horses = 0;
    }),
  );

  it('an enemy force appears only within detection range, at the estimate the scouts report', () => {
    const s = newGame(blind, 7);
    const { result, frames } = advanceWithPlayback(s, orders(s), blind);
    if (!result.ok) throw new Error(result.reason);
    const enemies = frames.flatMap((f) => f.marks.filter((m) => m.kind === 'enemy'));
    expect(enemies.some((m) => m.id === 'ru-post')).toBe(true);
    expect(enemies.some((m) => m.id === 'ru-main')).toBe(false);
    // The estimate is the one the intelligence report records for this turn, never the true strength.
    const seen = result.state.intel.fr['ru-post']!;
    for (const m of enemies) expect(m.strength).toBe(seen.men);
    expect(enemies[0]!.strength % 100).toBe(0);
  });

  it('the places they can see are those within the same range: A, B and E from the Main body at B, G from the Flank corps at A; not C or D', () => {
    const s = newGame(blind, 7);
    expect(observedPlaces(s, blind, 'fr')).toEqual(['A', 'B', 'E', 'G']);
  });
});

describe('wagon trains', () => {
  // The Main body three stages out, at C: its train from A has 31.5 km to go by post road and secondary road.
  const far = passiveContext(testGround((sc) => (forceInit(sc, 'fr-main').at = 'C')));

  it('move at their simulated speed, hour by hour, and end each sub-step where they stopped', () => {
    let s = newGame(far, 3);
    // The first sub-step's accrual loads the train; it sets out in the second.
    const { result, frames } = advanceWithPlayback(s, orders(s), far);
    if (!result.ok) throw new Error(result.reason);
    s = result.state;
    const train = frames.map((f) => f.marks.find((m) => m.id === 'cv-fr-1'));
    const out = train.findIndex((m) => m !== undefined);
    expect(out).toBeGreaterThan(0);
    // 9 km of ideal distance a sub-step: 1.5 km an hour on the post road from A.
    expect(train[out]).toMatchObject({ at: 'A', to: 'B', metres: 1_500 });
    expect(train[out + 1]).toMatchObject({ at: 'A', to: 'B', metres: 3_000 });
    // It reaches B within the sub-step, and goes on along the secondary road to C at 85% of the pace.
    const reached = train.findIndex((m) => m?.via.includes('B'));
    expect(reached).toBeGreaterThan(out);
    expect(train[reached]!.at).toBe('B');
  });

  it('a train that delivers shows where it did, as the French saw it', () => {
    let s = newGame(far, 3);
    const events = [];
    for (let k = 0; k < 4; k++) {
      const { result, frames } = advanceWithPlayback(s, orders(s), far);
      if (!result.ok) throw new Error(result.reason);
      events.push(...frames.flatMap((f) => f.events));
      s = result.state;
    }
    expect(events).toContainEqual(expect.objectContaining({ kind: 'delivery', node: 'C' }));
  });
});

describe('events', () => {
  it('a contact and a battle show at the place they happen', () => {
    const lively = createContext(testGround(), RULES, { russianCommand: holdStill });
    const run = play(lively, 1812, advancePolicy);
    const frames = replayWithPlayback(lively, run.states[0]!, run.inputs).flat();
    const kinds = new Set(frames.flatMap((f) => f.events.map((e) => `${e.kind}@${e.node}`)));
    expect(kinds.has('contact@D')).toBe(true);
    expect([...kinds].some((k) => k.startsWith('battle@') || k.startsWith('skirmish@') || k.startsWith('withdrawal@'))).toBe(true);
  });
});
