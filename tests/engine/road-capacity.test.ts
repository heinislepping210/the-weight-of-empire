// Road capacity (G-024, L-013), a what-if: off in the adopted rules, measured before any decision. The contract:
//   1. On one road, going one way, a column stays at least the length of the column of its side ahead of it behind
//      that column, and never passes it.
//   2. A column waits to set out until the road is clear; of columns ready at one moment the shorter goes first.
//   3. Other roads, the other direction and places are not limited: a place is where columns pass one another.
//   4. Enemy columns behave as before. Both sides are under the same rule.
//   5. It keeps no state of its own, so a column that waited a whole sub-step has simply rested.
//   6. With the rule off, nothing changes (the golden games in properties.test.ts).

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, statusOf, submit } from '../../src/engine';
import type { GameState, GroupOrder, Pace, Rules, ScenarioDef } from '../../src/engine';
import { columnMetres } from '../../src/engine/advance';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { BOTS } from '../balance/bots';
import { inputFor, play, stepUntil } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { holdStill, testGround } from '../fixtures/testGround';

const QUEUE: Rules = { ...RULES, march: { ...RULES.march, columnMetresPerThousand: 500 } };

/** Both French columns at B with a long post road to C; the Russians out of the way at F. */
function ground(edit: (d: ScenarioDef) => void = () => {}): ScenarioDef {
  return testGround((d) => {
    d.convoys = [];
    Object.assign(d.edges.find((e) => e.id === 'B-C')!, { metres: 60_000, road: 'post' });
    for (const f of d.forces) f.at = f.side === 'fr' ? 'B' : 'F';
    edit(d);
  });
}

const order = (force: string, route: string[], pace: Pace = 'steady'): GroupOrder => ({ force, route, pace });

/** Plays the first turn, noting where the columns stand after every hour's march. */
function march(rules: Rules, scenario: ScenarioDef, orders: GroupOrder[], prepare: (s: GameState) => void = () => {}) {
  const ctx = createContext(scenario, rules, { russianCommand: holdStill });
  const start = newGame(ctx, 7);
  prepare(start);
  const hours: GameState[] = [];
  const r = advance(start, { kind: 'orders', turn: 1, orders }, ctx, (s, at) => {
    if (at.stage === 'movement') hours.push(structuredClone(s));
  });
  if (!r.ok) throw new Error(r.reason);
  return { final: r.state, hours };
}

const metres = (s: GameState, id: string) => s.forces[id]!.transit?.metres ?? null;

describe('with the rule off, as adopted', () => {
  it('has no road capacity: two columns set out together and march level', () => {
    expect(RULES.march.columnMetresPerThousand).toBe(0);
    const { final } = march(RULES, ground(), [order('fr-main', ['C']), order('fr-flank', ['C'])]);
    expect(metres(final, 'fr-main')).toBe(metres(final, 'fr-flank'));
  });
});

describe('columns of one side on one road', () => {
  it('measures a column by its men', () => {
    expect(columnMetres({ men: 40_000 } as never, QUEUE)).toBe(20_000);
    expect(columnMetres({ men: 40_000 } as never, RULES)).toBe(0);
  });

  it('sends the shorter column first, and the longer waits until it has gone its length', () => {
    const { final, hours } = march(QUEUE, ground(), [order('fr-main', ['C']), order('fr-flank', ['C'])]);
    const alone = march(RULES, ground(), [order('fr-flank', ['C'])]).final;
    // The shorter column is not held up at all.
    expect(metres(final, 'fr-flank')).toBe(metres(alone, 'fr-flank'));
    expect(metres(final, 'fr-flank')! - metres(final, 'fr-main')!).toBeGreaterThanOrEqual(10_000);
    expect(metres(final, 'fr-flank')! - metres(final, 'fr-main')!).toBeLessThan(10_100);
    // The longer one has not set out in the first hours.
    expect(hours[0]!.forces['fr-main']!.transit).toBeNull();
    expect(hours[4]!.forces['fr-main']!.transit).toBeNull();
    expect(hours[5]!.forces['fr-main']!.transit).not.toBeNull();
  });

  it('never closes on the column ahead, however fast it marches, and never passes it', () => {
    const { hours } = march(QUEUE, ground(), [order('fr-main', ['C'], 'forced'), order('fr-flank', ['C'])], (s) => {
      s.roadSeq = 2;
      Object.assign(s.forces['fr-flank']!, { transit: { edge: 'B-C', to: 'C', metres: 15_000, seq: 0 } });
      Object.assign(s.forces['fr-main']!, { transit: { edge: 'B-C', to: 'C', metres: 0, seq: 1 } });
    });
    // The column ahead shortens a little as it loses stragglers.
    for (const h of hours) expect(metres(h, 'fr-flank')! - metres(h, 'fr-main')!).toBeGreaterThanOrEqual(columnMetres(h.forces['fr-flank']!, QUEUE));
    // It closes up and then keeps the pace of the column ahead.
    const last = hours.at(-1)!;
    expect(metres(last, 'fr-flank')! - metres(last, 'fr-main')!).toBeLessThan(10_100);
  });

  it('goes on at its own pace when the column ahead pulls away', () => {
    const { hours } = march(QUEUE, ground(), [order('fr-main', ['C']), order('fr-flank', ['C'], 'forced')], (s) => {
      s.roadSeq = 2;
      Object.assign(s.forces['fr-flank']!, { transit: { edge: 'B-C', to: 'C', metres: 10_000, seq: 0 } });
      Object.assign(s.forces['fr-main']!, { transit: { edge: 'B-C', to: 'C', metres: 0, seq: 1 } });
    });
    const gaps = hours.filter((h) => h.forces['fr-flank']!.transit).map((h) => metres(h, 'fr-flank')! - metres(h, 'fr-main')!);
    expect(gaps.at(-1)!).toBeGreaterThan(gaps[0]!);
    // Nothing has held it back: four sub-steps at a steady pace, on a post road.
    expect(metres(hours.at(-1)!, 'fr-main')).toBe(metres(march(RULES, ground(), [order('fr-main', ['C'])]).final, 'fr-main'));
  });

  it('a column on the road that has stopped holds up those behind it, and a column that waits a whole sub-step rests', () => {
    const { hours, final } = march(QUEUE, ground(), [order('fr-main', ['C'])], (s) => {
      s.roadSeq = 1;
      Object.assign(s.forces['fr-flank']!, { pace: 'rest', route: ['C'], transit: { edge: 'B-C', to: 'C', metres: 2_000, seq: 0 } });
      s.forces['fr-main']!.fatigue = 300;
    });
    for (const h of hours) expect(h.forces['fr-main']!.transit).toBeNull();
    expect(final.forces['fr-main']!.activity).toBe('halt');
    expect(final.forces['fr-main']!.fatigue).toBeLessThan(300);
  });

  it('does not depend on the names: the shorter column goes first whichever name sorts first', () => {
    const named = (big: string, small: string) =>
      ground((d) => {
        d.forces.find((f) => f.id === 'fr-main')!.id = big;
        d.forces.find((f) => f.id === 'fr-flank')!.id = small;
      });
    const [a, b] = [march(QUEUE, named('aa', 'zz'), [order('aa', ['C']), order('zz', ['C'])]).final, march(QUEUE, named('zz', 'aa'), [order('aa', ['C']), order('zz', ['C'])]).final];
    expect([metres(a, 'aa'), metres(a, 'zz')]).toEqual([metres(b, 'zz'), metres(b, 'aa')]);
  });

  it('holds for the Russians too', () => {
    const scenario = ground((d) => {
      Object.assign(d.edges.find((e) => e.id === 'D-F')!, { metres: 60_000 });
      d.forces = d.forces.filter((f) => f.id !== 'fr-main');
      d.forces.find((f) => f.id === 'fr-flank')!.at = 'A';
    });
    const ctx = createContext(scenario, QUEUE, {
      russianCommand: (s: GameState) => {
        for (const id of ['ru-main', 'ru-post']) Object.assign(s.forces[id]!, { route: s.forces[id]!.transit ? ['D'] : ['D'], pace: 'steady' });
      },
    });
    const r = submit(newGame(ctx, 7), { kind: 'orders', turn: 1, orders: [] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    const s = stepUntil(r.state, ctx, (x) => x.resolution.slot === 2);
    // The short post goes first; the army of 55,000 waits until the post's 1,000 m of road are clear.
    expect(metres(s, 'ru-post')! - metres(s, 'ru-main')!).toBeGreaterThanOrEqual(1_000);
    expect(metres(s, 'ru-post')! - metres(s, 'ru-main')!).toBeLessThan(1_100);
  });
});

describe('what road capacity leaves alone', () => {
  it('columns on different roads', () => {
    const orders = [order('fr-main', ['C']), order('fr-flank', ['E'])];
    const [on, off] = [march(QUEUE, ground(), orders).final, march(RULES, ground(), orders).final];
    expect(metres(on, 'fr-main')).toBe(metres(off, 'fr-main'));
    expect(on.forces['fr-flank']!.at).toBe(off.forces['fr-flank']!.at);
  });

  it('columns going opposite ways', () => {
    const scenario = ground((d) => (d.forces.find((f) => f.id === 'fr-flank')!.at = 'C'));
    const orders = [order('fr-main', ['C']), order('fr-flank', ['B'])];
    const [on, off] = [march(QUEUE, scenario, orders).final, march(RULES, scenario, orders).final];
    expect(metres(on, 'fr-main')).toBe(metres(off, 'fr-main'));
    expect(metres(on, 'fr-flank')).toBe(metres(off, 'fr-flank'));
  });

  it('a place: a column that halts there does not hold up those going through', () => {
    const scenario = ground((d) => Object.assign(d.edges.find((e) => e.id === 'B-C')!, { metres: 12_000 }));
    const { final } = march(QUEUE, scenario, [order('fr-flank', ['C']), order('fr-main', ['C', 'D'])]);
    expect(final.forces['fr-flank']!.at).toBe('C');
    // It waited for the 10 km of the column ahead, and then marched on past it.
    expect(final.forces['fr-main']!.at).toBe('D');
  });

  it('enemy columns: one column a side gives the same game with or without it', () => {
    const scenario = ground((d) => {
      d.forces = d.forces.filter((f) => f.id === 'fr-main' || f.id === 'ru-main');
      d.forces.find((f) => f.id === 'ru-main')!.at = 'B';
    });
    const rush = (s: GameState) => void Object.assign(s.forces['ru-main']!, { route: ['C'], pace: 'steady' });
    const play1 = (rules: Rules) => {
      const ctx = createContext(scenario, rules, { russianCommand: rush });
      const s = newGame(ctx, 7);
      const r = advance(s, { kind: 'orders', turn: 1, orders: [order('fr-main', ['C'], 'forced')] }, ctx);
      if (!r.ok) throw new Error(r.reason);
      return r.state;
    };
    expect(play1(QUEUE).forces).toEqual(play1(RULES).forces);
  });
});

describe('over whole games', () => {
  const ctx = createContext(vitebskDecision(), QUEUE);

  it('breaks no invariant, ends every game, and keeps no state of its own', () => {
    const plain = createContext(vitebskDecision());
    for (const bot of ['concentrated-push', 'southern-envelopment-guard-at-base', 'random']) {
      for (let seed = 1; seed <= 6; seed++) {
        const run = play(ctx, seed, BOTS[bot]!(ctx));
        expect(violations(run), `${bot} ${seed}`).toEqual([]);
        expect(Object.keys(run.final)).toEqual(Object.keys(newGame(plain, seed)));
      }
    }
  });

  it('a column that set out behind another of its side stays that far behind it, hour by hour', () => {
    const policy = BOTS['concentrated-push']!(ctx);
    let seen = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let s = newGame(ctx, seed);
      for (let i = 0; i < 500; i++) {
        const status = statusOf(s);
        if (status.kind === 'ended') break;
        const r = advance(s, inputFor(s, status, policy), ctx, (x, at) => {
          if (at.stage !== 'movement') return;
          for (const a of Object.values(x.forces)) {
            for (const b of Object.values(x.forces)) {
              if (a.side !== b.side || !a.transit || !b.transit || a.transit.edge !== b.transit.edge || a.transit.to !== b.transit.to || a.transit.seq >= b.transit.seq) continue;
              // A beaten column is thrown onto the road where it stands, so only one already moving is held to it.
              if (b.transit.metres === 0) continue;
              seen++;
              expect(a.transit.metres - b.transit.metres, `${a.id} ahead of ${b.id}, seed ${seed}`).toBeGreaterThanOrEqual(columnMetres(a, QUEUE));
            }
          }
        });
        if (!r.ok) throw new Error(r.reason);
        s = r.state;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
