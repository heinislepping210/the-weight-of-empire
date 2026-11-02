// Supply and forecasts (second independent review, findings B3, C3 and the time-aware part of finding 2).
// Each case failed on rules 0.14.0.

import { describe, expect, it } from 'vitest';
import { RULES, createContext, evaluate, newGame, planDirective, submit } from '../../src/engine';
import type { Directive, GameState, Pace, Rules } from '../../src/engine';
import { capacityGrams, weightGrams } from '../../src/engine/carriage';
import { play, stepUntil } from '../fixtures/driver';
import { forceInit, holdStill, passiveContext, testGround } from '../fixtures/testGround';

const afterMovement = (s: GameState) => s.resolution.stage === 'contacts' && s.resolution.slot === 0;

describe('B3. a wagon train hands over only what the group can carry', () => {
  it('as from a depot, only what the group could still march with; the rest stays on the train, and nothing is lost', () => {
    const ctx = passiveContext(testGround());
    const start = newGame(ctx, 1);
    // The main body at B, 8 km from the depot, can carry 276 t; with 340,000 rations (255 t) and its ammunition
    // (3 t) it has room for 18 t more, 24,000 rations. The fodder it holds would be left first.
    start.forces['fr-main']!.stock.food = 340_000;
    Object.assign(start.convoys['cv-fr-1']!, { leg: 'outbound', cargo: { food: 64_000, fodder: 0, ammo: 0 } });
    const r = submit(start, { kind: 'orders', turn: 1, orders: [] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    const s = stepUntil(r.state, ctx, afterMovement);
    expect(s.forces['fr-main']!.incoming.food).toBe(24_000);
    expect(s.convoys['cv-fr-1']).toMatchObject({ leg: 'returning', cargo: { food: 40_000 } });
  });

  it('a group takes no more than it could march with', () => {
    // Packs for 45 t, and 15 t of ammunition already in them: room for 30 t of food, 40,000 rations.
    const ctx = passiveContext(testGround((d) => Object.assign(forceInit(d, 'fr-main'), { wagons: 0, draught: 0, stock: { food: 0, fodder: 0, ammo: 15_000 } })));
    const start = newGame(ctx, 1);
    Object.assign(start.convoys['cv-fr-1']!, { leg: 'outbound', cargo: { food: 64_000, fodder: 0, ammo: 0 } });
    start.forces['fr-main']!.men = 15_000;
    const r = submit(start, { kind: 'orders', turn: 1, orders: [] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    const f = stepUntil(r.state, ctx, afterMovement).forces['fr-main']!;
    expect(f.incoming.food).toBe(40_000);
    expect(weightGrams({ food: f.incoming.food, fodder: 0, ammo: f.stock.ammo }, RULES)).toBe(capacityGrams(f, RULES));
  });
});

describe('2 (time-aware). "sustainable" counts a delivery only for the days after it arrives', () => {
  /** The flank corps at G, its wagon train at the depot at A, 30 km away: it arrives on the second day. */
  function judged(foodDaysInHand: number) {
    const sc = testGround((d) => {
      d.forces = d.forces.filter((f) => f.id === 'fr-flank');
      Object.assign(forceInit(d, 'fr-flank'), { at: 'G' });
      d.convoys = [{ id: 'cv-fr-1', side: 'fr', home: 'A', serves: 'fr-flank', wagons: 60 }];
      d.edges.find((e) => e.id === 'A-G')!.metres = 30_000;
      for (const id of Object.keys(d.districts)) d.districts[id] = { food: 0, fodder: 100_000 };
    });
    const ctx = passiveContext(sc);
    const s = newGame(ctx, 7);
    s.halted = true;
    s.ended = 'scenarioEnd';
    const f = s.forces['fr-flank']!;
    f.stock.food = f.men * foodDaysInHand;
    Object.assign(s.convoys['cv-fr-1']!, { leg: 'outbound', cargo: { food: 40_000, fodder: 0, ammo: 0 } });
    return evaluate(s, s, ctx);
  }

  it('nothing to eat on the first day: not sustainable, though the train brings enough on the second', () => {
    expect(judged(0).sustainable).toBe(false);
  });

  it("a day's food in hand bridges the gap until the train arrives", () => {
    expect(judged(1).sustainable).toBe(true);
  });
});

describe('C3. the arrival forecast follows the movement rules', () => {
  /** The flank corps alone at G, marching to F; dry weather throughout, so the forecast can be exact. */
  function forecastAndActual(setup: { fatigue: number; posture: 'dispersed' | 'concentrated'; tempo: Pace }) {
    const sc = testGround((d) => {
      d.forces = d.forces.filter((f) => f.id === 'fr-flank');
      Object.assign(forceInit(d, 'fr-flank'), { at: 'G', fatigue: setup.fatigue, posture: setup.posture });
      d.convoys = [];
      d.turns = 10;
    });
    const ctx = createContext(sc, { ...RULES, weather: { rainPermille: 0 } } as unknown as Rules, { russianCommand: holdStill });
    const d: Directive = { objective: 'F', axis: null, tempo: setup.tempo, posture: 'concentrated', engagement: 'accept', holdBack: [], logistics: 'hold' };
    const forecast = planDirective(newGame(ctx, 7), ctx, d)[0]!.arrival!.dry;
    const run = play(ctx, 7, { orders: (s) => planDirective(s, ctx, d).map((p) => p.order) });
    const arrived = run.logs.flat().find((e) => e.kind === 'arrived' && e.detail.node === 'F')!;
    return { forecast, actual: { turn: arrived.turn, slot: arrived.slot } };
  }

  it("the reviewer's case: a tired, dispersed corps arrives when forecast, not a sub-step later", () => {
    const { forecast, actual } = forecastAndActual({ fatigue: 900, posture: 'dispersed', tempo: 'steady' });
    expect(forecast).toEqual(actual);
  });

  it('so does a fresh corps on a forced march', () => {
    const { forecast, actual } = forecastAndActual({ fatigue: 200, posture: 'concentrated', tempo: 'forced' });
    expect(forecast).toEqual(actual);
  });
});
