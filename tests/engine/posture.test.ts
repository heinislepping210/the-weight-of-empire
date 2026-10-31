import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, statusOf, stepOnce, submit } from '../../src/engine';
import type { Context, GameState, GroupOrder, Posture } from '../../src/engine';
import { inputFor, stepUntil } from '../fixtures/driver';
import { forceInit, testGround } from '../fixtures/testGround';

function ordered(s: GameState, ctx: Context, orders: GroupOrder[]): GameState {
  const result = submit(s, { kind: 'orders', turn: s.resolution.turn, orders }, ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const afterAccrual = (slot: number) => (s: GameState) => s.resolution.slot === slot && s.resolution.stage === 'activity';

describe('posture: dispersed or concentrated (§2.4b)', () => {
  function foragingGround(posture: Posture): Context {
    return createContext(
      testGround((s) => {
        forceInit(s, 'fr-main').posture = posture;
        s.convoys = [];
        s.districts.B = { food: 1_000, fodder: 1_000 };
      }),
    );
  }

  it('a halted, dispersed force forages its neighbouring districts too, but never where the enemy stands', () => {
    const ctx = foragingGround('dispersed');
    const start = newGame(ctx, 1);
    const s = stepUntil(ordered(start, ctx, []), ctx, afterAccrual(1));
    expect(s.districts.B!.food).toBe(0);
    // Nobody stands at C, so anything gone from it was taken by the dispersed main body.
    expect(s.districts.C!.food).toBeLessThan(start.districts.C!.food);
    // E is held by the Russian post: it loses only what the post itself forages.
    const post = start.forces['ru-post']!;
    expect(start.districts.E!.food - s.districts.E!.food).toBe(Math.floor((post.men * RULES.forage.food.halt) / 1000));
  });

  it('a concentrated force forages only its own district, and gathers less', () => {
    const dispersed = foragingGround('dispersed');
    const concentrated = foragingGround('concentrated');
    const d = stepUntil(ordered(newGame(dispersed, 1), dispersed, []), dispersed, afterAccrual(1));
    const c = stepUntil(ordered(newGame(concentrated, 1), concentrated, []), concentrated, afterAccrual(1));
    expect(c.districts.C).toEqual(newGame(concentrated, 1).districts.C);
    expect(d.ledger.foraged.food).toBeGreaterThan(c.ledger.foraged.food);
  });

  it('a dispersed force ordered to march first gathers for two sub-steps, then marches concentrated', () => {
    const ctx = createContext(testGround((s) => (forceInit(s, 'fr-flank').posture = 'dispersed')));
    let s = ordered(newGame(ctx, 2), ctx, [{ force: 'fr-flank', route: ['B'], pace: 'steady' }]);
    for (const slot of [0, 1]) {
      s = stepUntil(s, ctx, (x) => x.resolution.slot === slot && x.resolution.stage === 'movement');
      expect(s.forces['fr-flank']).toMatchObject({ activity: 'gather', at: 'A', posture: 'dispersed' });
    }
    s = stepUntil(s, ctx, (x) => x.resolution.slot === 2 && x.resolution.stage === 'contacts');
    expect(s.forces['fr-flank']).toMatchObject({ activity: 'march', at: 'B', posture: 'concentrated', gathering: 0 });
  });

  it('a force caught dispersed fights below full strength while it gathers', () => {
    const lossesInRoundOne = (posture: Posture) => {
      const ctx = createContext(
        testGround((s) => {
          forceInit(s, 'ru-main').at = 'B';
          forceInit(s, 'fr-main').posture = posture;
        }),
      );
      let s = newGame(ctx, 9);
      for (let i = 0; i < 3; i++) {
        const r = advance(s, inputFor(s, statusOf(s), { orders: () => [], round: () => 'hold' }), ctx);
        if (!r.ok) throw new Error(r.reason);
        s = r.state;
      }
      expect(s.battles[Object.keys(s.battles)[0]!]!.roundsFought).toBe(1);
      return s.ledger.menLost.battle;
    };
    expect(lossesInRoundOne('dispersed')).toBeLessThan(lossesInRoundOne('concentrated'));
  });

  it('a force cannot be ordered to disperse while engaged in battle', () => {
    const ctx = createContext(testGround((s) => (forceInit(s, 'ru-main').at = 'B')));
    let s = newGame(ctx, 3);
    while (statusOf(s).kind !== 'awaitingOrders' || s.resolution.turn === 1) {
      const r = advance(s, inputFor(s, statusOf(s), { orders: () => [], round: () => 'hold', nightfall: () => 'stay' }), ctx);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
      if (s.ended) break;
    }
    if (s.forces['fr-main']!.battle === null) return; // battle already decided; nothing to check
    expect(advance(s, { kind: 'orders', turn: s.resolution.turn, orders: [{ force: 'fr-main', posture: 'dispersed' }] }, ctx).ok).toBe(false);
  });
});

describe('depots issue supplies directly (§2.6)', () => {
  it('a force at its own depot tops up at the end of the sub-step, and the depot pays for it', () => {
    const ctx = createContext(
      testGround((s) => {
        forceInit(s, 'fr-flank').stock = { food: 0, fodder: 0, ammo: 0 };
        s.convoys = [];
        s.districts.A = { food: 0, fodder: 0 };
      }),
    );
    const start = ordered(newGame(ctx, 4), ctx, []);
    const s = stepOnce(stepOnce(stepOnce(stepOnce(stepOnce(start, ctx).state, ctx).state, ctx).state, ctx).state, ctx).state;
    expect(s.resolution).toMatchObject({ slot: 1, stage: 'activity' });
    const f = s.forces['fr-flank']!;
    expect(f.stock.food).toBe(f.men * RULES.depotIssue.foodDays);
    expect(f.stock.fodder).toBe(f.horses * RULES.depotIssue.fodderDays);
    expect(s.depots.A!.stock.food).toBe(start.depots.A!.stock.food - f.stock.food);
  });
});
