// Supply lines (M2, G5): what each French wagon train can bring a day, against what its group eats. The round trip
// the forecast assumes is the one the trains make in play.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, slotIndexOf, supplyLines } from '../../src/engine';
import type { GameState, LogEntry, Rules } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { forceInit, holdStill, testGround } from '../fixtures/testGround';

/** No rain, so the roads stay as they are; Russians who hold still. */
const dry = { ...RULES, weather: { rainPermille: 0 } } as unknown as Rules;
const at = (place: string, wagons = 200) =>
  createContext(
    testGround((sc) => {
      forceInit(sc, 'fr-main').at = place;
      sc.convoys[0]!.wagons = wagons;
      sc.turns = 8;
    }),
    dry,
    { russianCommand: holdStill },
  );
const line = (s: GameState, ctx: ReturnType<typeof at>) => supplyLines(s, ctx).find((l) => l.convoy === 'cv-fr-1')!;

describe('supply lines', () => {
  it('a train brings less a day the farther its group stands', () => {
    const near = at('B');
    const far = at('C');
    const a = line(newGame(near, 1), near);
    const b = line(newGame(far, 1), far);
    expect(a.path).toEqual(['A', 'B']);
    expect(b.path).toEqual(['A', 'B', 'C']);
    // 8 km of post road is one sub-step out and one back; 8 km more plus 20 km of secondary road (23.5 km of
    // ideal distance) is four each way.
    expect([a.cycleDays, b.cycleDays]).toEqual([1, 4]);
    expect(a.load).toBe(b.load);
    expect(b.perDay).toBe(Math.floor(a.load / 4));
    expect(a.need).toBe(newGame(near, 1).forces['fr-main']!.men);
  });

  it('the round trip it assumes is the one the train makes: a delivery every two days for each day of the cycle', () => {
    for (const place of ['B', 'C']) {
      const ctx = at(place);
      let s = newGame(ctx, 2);
      const forecast = line(s, ctx).cycleDays;
      const log: LogEntry[] = [];
      while (s.ended === null) {
        const r = advance(s, { kind: 'orders', turn: s.resolution.turn, orders: [] }, ctx);
        if (!r.ok) throw new Error(r.reason);
        log.push(...r.log);
        s = r.state;
      }
      const when = log.filter((e) => e.kind === 'delivered' && e.detail.convoy === 'cv-fr-1').map((e) => slotIndexOf(e));
      expect(when.length, place).toBeGreaterThanOrEqual(2);
      // Out in `cycleDays` sub-steps, back in as many: two sub-steps a day.
      for (let i = 1; i < when.length; i++) expect(when[i]! - when[i - 1]!, place).toBe(2 * forecast);
    }
  });

  it('shows a bottleneck where a train brings less than its group eats, and it clears with a depot nearer', () => {
    // 300 wagons hold 224,000 rations: from A, four days for the round trip, short of the 60,000 a day the Main body eats.
    const ctx = at('C', 300);
    const s = newGame(ctx, 1);
    const before = line(s, ctx);
    expect(before.cycleDays).toBe(4);
    expect(before.perDay).toBeLessThan(before.need!);
    // A depot at B, stocked, and the train loading there: three days, which is enough.
    s.depots.B = { node: 'B', side: 'fr', stock: { food: 400_000, fodder: 0, ammo: 0 }, incoming: { food: 0, fodder: 0, ammo: 0 } };
    s.convoys['cv-fr-1']!.home = 'B';
    const after = line(s, ctx);
    expect(after.path).toEqual(['B', 'C']);
    expect(after.cycleDays).toBe(3);
    expect(after.perDay).toBeGreaterThanOrEqual(after.need!);
  });

  it('mud slows it, a train without draught horses brings nothing, and an empty depot sends nothing', () => {
    const ctx = at('C');
    const s = newGame(ctx, 1);
    const dryLine = line(s, ctx);
    const wet = structuredClone(s);
    for (const id of Object.keys(wet.roads)) wet.roads[id] = 'mud';
    expect(line(wet, ctx).cycleDays).toBeGreaterThan(dryLine.cycleDays);
    const unhorsed = structuredClone(s);
    unhorsed.convoys['cv-fr-1']!.horses = 0;
    expect(line(unhorsed, ctx)).toMatchObject({ wagons: 0, perDay: 0 });
    const empty = structuredClone(s);
    empty.depots.A!.stock.food = 0;
    expect(line(empty, ctx)).toMatchObject({ load: 0, perDay: 0 });
  });

  it('lists the French trains at work only: no Russian train, and no line train standing idle', () => {
    const ctx = createContext(vitebskDecision());
    const s = newGame(ctx, 1812);
    const lines = supplyLines(s, ctx);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      const c = s.convoys[l.convoy]!;
      expect(c.side).toBe('fr');
      expect(c.serves !== null || (c.feeds !== null && c.feeds !== c.home)).toBe(true);
      expect(l.path[0]).toBe(c.home);
      expect(l.path[l.path.length - 1]).toBe(l.to);
    }
  });
});
