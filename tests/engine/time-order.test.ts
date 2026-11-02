// Movement in time order (D-038; second independent review, finding A2 and the equality matrix of finding 1).
// Within an hour, forces arrive and set out at definite moments, taken in time order across both sides, so
// which force's name sorts first makes no difference. Each case below is run under both orders of names.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, submit } from '../../src/engine';
import type { GameState, Pace, Side } from '../../src/engine';
import { stepUntil } from '../fixtures/driver';
import { contactViolations } from '../fixtures/invariants';
import { testGround } from '../fixtures/testGround';

const NAMINGS = [
  { fr: 'aa-fr', ru: 'zz-ru' },
  { fr: 'zz-fr', ru: 'aa-ru' },
] as const;
type Naming = (typeof NAMINGS)[number];

/** The test ground with one force a side, renamed: the French flank corps and the Russian main army. */
function ground(names: Naming, edit: (d: ReturnType<typeof testGround>) => void = () => {}) {
  return testGround((d) => {
    d.forces = d.forces.filter((f) => f.id === 'fr-flank' || f.id === 'ru-main');
    for (const f of d.forces) f.id = f.side === 'fr' ? names.fr : names.ru;
    d.convoys = [];
    edit(d);
  });
}

describe('two columns converging on a junction', () => {
  /** A–B and B–C both 500 m of post road; the French march A → B → C, the Russians C → B → A. */
  function meet(names: Naming, seed: number, paces: Record<Side, Pace> = { fr: 'steady', ru: 'steady' }) {
    const sc = ground(names, (d) => {
      for (const f of d.forces) f.at = f.side === 'fr' ? 'A' : 'C';
      for (const id of ['A-B', 'B-C']) Object.assign(d.edges.find((e) => e.id === id)!, { metres: 500, road: 'post' });
    });
    const ctx = createContext(sc, RULES, {
      russianCommand: (s: GameState) => void Object.assign(s.forces[names.ru]!, { route: ['B', 'A'], pace: paces.ru }),
    });
    const r = advance(newGame(ctx, seed), { kind: 'orders', turn: 1, orders: [{ force: names.fr, route: ['B', 'C'], pace: paces.fr }] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    const b = Object.values(r.state.battles)[0];
    return { node: b?.node ?? null, attacker: b?.attacker ?? null };
  }

  it("the reviewer's case: equal columns meet at the junction, whichever name sorts first", () => {
    let frenchAttacks = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const [a, b] = NAMINGS.map((n) => meet(n, seed));
      expect(a, `seed ${seed}`).toEqual(b);
      expect(a!.node, `seed ${seed}`).toBe('B');
      if (a!.attacker === 'fr') frenchAttacks++;
    }
    // Arriving together, neither side holds the place first: a draw decides the attacker, not a fixed side.
    expect(frenchAttacks).toBeGreaterThan(60);
    expect(frenchAttacks).toBeLessThan(140);
  });

  it('a faster column reaches the junction first and holds it; the later arrival attacks', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const [a, b] = NAMINGS.map((n) => meet(n, seed, { fr: 'forced', ru: 'steady' }));
      expect(a, `seed ${seed}`).toEqual(b);
      expect(a, `seed ${seed}`).toEqual({ node: 'B', attacker: 'ru' });
    }
  });
});

describe('two columns heading the same way on one road', () => {
  /**
   * Both on the 20 km road from B to C at `metres`; the leader set out first and marches steady, the
   * follower behind it forced. Returns the state after the first sub-step's movement.
   */
  function follow(names: Naming, leader: Side, metres: number, routes: { leader: string[]; follower: string[] } = { leader: ['C'], follower: ['C'] }) {
    const follower: Side = leader === 'fr' ? 'ru' : 'fr';
    const pace: Record<Side, Pace> = { [leader]: 'steady', [follower]: 'forced' } as Record<Side, Pace>;
    const route: Record<Side, string[]> = { [leader]: routes.leader, [follower]: routes.follower } as Record<Side, string[]>;
    const ctx = createContext(ground(names), RULES, {
      russianCommand: (s: GameState) => void Object.assign(s.forces[names.ru]!, { route: [...route.ru], pace: pace.ru }),
    });
    const start = newGame(ctx, 3);
    start.roadSeq = 2;
    for (const side of ['fr', 'ru'] as const) Object.assign(start.forces[names[side]]!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres, seq: side === leader ? 0 : 1 } });
    const r = submit(start, { kind: 'orders', turn: 1, orders: [{ force: names.fr, route: [...route.fr], pace: pace.fr }] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    const s = stepUntil(r.state, ctx, (x) => x.resolution.stage === 'contacts' && x.resolution.slot === 0);
    return { s, lead: s.forces[names[leader]]!, behind: s.forces[names[follower]]! };
  }

  /** How far the leader gets on its own in the same sub-step. */
  function alone(names: Naming, leader: Side, metres: number) {
    const ctx = createContext(
      ground(names, (d) => (d.forces = d.forces.filter((f) => f.side === leader))),
      RULES,
      { russianCommand: (s: GameState) => void (s.forces[names.ru] && Object.assign(s.forces[names.ru]!, { route: ['C'], pace: 'steady' })) },
    );
    const start = newGame(ctx, 3);
    Object.assign(start.forces[names[leader]]!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres, seq: 0 } });
    const orders = leader === 'fr' ? [{ force: names.fr, route: ['C'], pace: 'steady' as Pace }] : [];
    const r = submit(start, { kind: 'orders', turn: 1, orders }, ctx);
    if (!r.ok) throw new Error(r.reason);
    return stepUntil(r.state, ctx, (x) => x.resolution.stage === 'contacts' && x.resolution.slot === 0).forces[names[leader]]!.transit!.metres;
  }

  for (const metres of [0, 1_000, 2_000]) {
    for (const leader of ['ru', 'fr'] as const) {
      it(`level at ${metres.toLocaleString('en-GB')} m, ${leader === 'ru' ? 'Russians' : 'French'} ahead: the follower closes up and follows, and never passes`, () => {
        const runs = NAMINGS.map((n) => follow(n, leader, metres));
        for (const { lead, behind, s } of runs) {
          // The leader is not held up by the column behind it…
          expect(lead.transit!.metres).toBe(alone(NAMINGS[0], leader, metres));
          // …and the faster follower catches up and stays closed up behind it.
          expect(behind.transit!.metres).toBe(lead.transit!.metres);
          expect(contactViolations(s)).toEqual([]);
        }
        expect(runs[0]!.lead.transit).toEqual({ ...runs[1]!.lead.transit, seq: runs[0]!.lead.transit!.seq });
      });
    }
  }

  it('a closed-up follower reaches the next place just after the column ahead, and follows it on if it marches on', () => {
    for (const leader of ['ru', 'fr'] as const) {
      for (const names of NAMINGS) {
        const { s, lead, behind } = follow(names, leader, 19_000, { leader: ['C', 'D'], follower: ['C', 'D'] });
        expect(Object.keys(s.battles)).toEqual([]);
        expect(lead.transit?.edge).toBe('C-D');
        expect(behind.transit?.edge).toBe('C-D');
        expect(behind.transit!.metres).toBeLessThanOrEqual(lead.transit!.metres);
        expect(contactViolations(s)).toEqual([]);
      }
    }
  });

  it('if the column ahead stops at the next place, the follower meets it there', () => {
    for (const leader of ['ru', 'fr'] as const) {
      for (const names of NAMINGS) {
        const { s, lead, behind } = follow(names, leader, 19_000, { leader: ['C'], follower: ['C', 'D'] });
        expect(lead).toMatchObject({ at: 'C', transit: null });
        expect(behind).toMatchObject({ at: 'C', transit: null });
        expect(contactViolations(s)).toEqual([]);
      }
    }
  });
});

describe('the road-order invariant', () => {
  it('flags a column that set out later yet stands further along than an enemy column on the same road', () => {
    const ctx = createContext(ground(NAMINGS[0]));
    const s = newGame(ctx, 1);
    Object.assign(s.forces['aa-fr']!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres: 5_000, seq: 1 } });
    Object.assign(s.forces['zz-ru']!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres: 4_000, seq: 0 } });
    expect(contactViolations(s)).toEqual(['aa-fr set out along road B-C after zz-ru but is further along it']);
  });
});
