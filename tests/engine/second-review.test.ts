// Regression tests for the second independent review of commit 58fb761 (docs/reviews). Each failed on
// rules 0.11.0 and reproduces the reviewer's own case where it gave one.

import { describe, expect, it } from 'vitest';
import { RULES, createContext, evaluate, newGame, planDirective, submit } from '../../src/engine';
import type { Axis, BattleState, GameState } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { lineOfRetreatBlocked } from '../../src/engine/outcome';
import { stepUntil } from '../fixtures/driver';
import { forceInit, holdStill, idleField, passiveContext, testGround } from '../fixtures/testGround';

const afterMovement = (s: GameState) => s.resolution.stage === 'contacts' && s.resolution.slot === 0;

describe('1. a column cannot pass an enemy column level with it on the same road', () => {
  const ground = () =>
    createContext(testGround((s) => (forceInit(s, 'fr-main').at = 'G')), RULES, {
      russianCommand: (s: GameState) => {
        holdStill(s);
        if (s.resolution.turn === 1) s.forces['ru-post']!.route = ['C'];
      },
    });

  function race(frenchMetres: number, russianMetres: number, russianFirst: boolean): GameState {
    const ctx = ground();
    const start = newGame(ctx, 3);
    start.roadSeq = 2;
    Object.assign(start.forces['ru-post']!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres: russianMetres, seq: russianFirst ? 0 : 1 } });
    Object.assign(start.forces['fr-flank']!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres: frenchMetres, seq: russianFirst ? 1 : 0 } });
    const r = submit(start, { kind: 'orders', turn: 1, orders: [{ force: 'fr-flank', route: ['C'], pace: 'forced' }] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    return stepUntil(r.state, ctx, afterMovement);
  }

  it("the reviewer's case: level at 1,000 m, the Russians on the road first, the faster French stay behind", () => {
    const s = race(1_000, 1_000, true);
    expect(s.forces['fr-flank']!.transit!.metres).toBeLessThanOrEqual(s.forces['ru-post']!.transit!.metres);
  });

  it('the retreat case: both at the start of the road, the column already on it stays ahead', () => {
    const s = race(0, 0, true);
    expect(s.forces['fr-flank']!.transit!.metres).toBeLessThanOrEqual(s.forces['ru-post']!.transit!.metres);
  });

  it('a column that was on the road first may draw ahead', () => {
    const s = race(1_000, 1_000, false);
    expect(s.forces['fr-flank']!.transit!.metres).toBeGreaterThan(s.forces['ru-post']!.transit!.metres);
  });
});

describe('2. "sustainable" counts each ration once, and only what can arrive in time', () => {
  const ctx = createContext(vitebskDecision());
  const start = newGame(ctx, 1812);
  const endState = (edit: (s: GameState) => void) => {
    const s = structuredClone(start);
    s.ended = 'scenarioEnd';
    s.halted = true;
    edit(s);
    return s;
  };

  it('two groups sharing one district cannot both count all of it', () => {
    const o = evaluate(start, endState((s) => {
      // Two groups of 20,000 at Velizh, empty-handed: 80,000 rations needed for two days, 50,000 in the district.
      for (const id of ['fr-left', 'fr-south']) Object.assign(s.forces[id]!, { at: 'velizh', transit: null, men: 20_000, posture: 'dispersed', stock: { food: 0, fodder: 0, ammo: 0 } });
      s.districts.velizh = { food: 50_000, fodder: 50_000 };
      for (const id of ['cv-vitebsk-left', 'cv-mogilev-south']) s.convoys[id]!.cargo.food = 0;
    }), ctx);
    expect(o.sustainable).toBe(false);
  });

  it('a wagon train too far away to arrive within two days does not count', () => {
    const o = evaluate(start, endState((s) => {
      Object.assign(s.forces['fr-left']!, { stock: { food: 0, fodder: 0, ammo: 0 } });
      for (const id of ['surazh', 'velizh', 'porechye', 'vitebsk']) s.districts[id] = { food: 0, fodder: 0 };
      // Its train is at Mogilev, far beyond two days' haul from Surazh.
      Object.assign(s.convoys['cv-vitebsk-left']!, { at: 'mogilev', transit: null, leg: 'outbound', cargo: { food: 200_000, fodder: 0, ammo: 0 } });
    }), ctx);
    expect(o.sustainable).toBe(false);
  });
});

describe('3. a group finishing its last stretch into the objective stops there', () => {
  it('no route back out of the objective to rejoin the kept route', () => {
    const ctx = passiveContext(testGround());
    const s = newGame(ctx, 1);
    Object.assign(s.forces['fr-flank']!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres: 5_000, seq: 0 } });
    const axis: Axis = { id: 'via:b', label: 'Via Node B', places: ['A', 'B', 'C'], metres: 28_000 };
    const plan = planDirective(s, ctx, { objective: 'C', axis, tempo: 'steady', posture: 'concentrated', engagement: 'accept', holdBack: [], logistics: 'hold' });
    expect(plan.find((p) => p.force === 'fr-flank')!.order.route).toEqual(['C']);
  });
});

describe('4. a wagon train moves only with horses to draw it', () => {
  /** A loaded train on its way to the main body, at G, away from any depot. */
  function loaded(horses: number, at = 'G') {
    const ctx = passiveContext(testGround());
    const start = newGame(ctx, 1);
    Object.assign(start.convoys['cv-fr-1']!, { at, leg: 'outbound', horses, cargo: { food: 40_000, fodder: 0, ammo: 0 } });
    const r = submit(start, { kind: 'orders', turn: 1, orders: [] }, ctx);
    if (!r.ok) throw new Error(r.reason);
    return stepUntil(r.state, ctx, afterMovement);
  }

  it("the reviewer's case: no horses, no movement; the load is left by the road and the wagons stay", () => {
    const s = loaded(0);
    expect(s.forces['fr-main']!.incoming.food).toBe(0);
    expect(s.convoys['cv-fr-1']).toMatchObject({ at: 'G', transit: null, wagons: 60, cargo: { food: 0 } });
    expect(s.ledger.abandoned.food).toBe(40_000);
  });

  it('a train with half the horses it needs carries on only what half its wagons can take', () => {
    const s = loaded(60); // 60 wagons need 120 horses: 30 wagons can be drawn
    const canCarry = Math.floor((30 * RULES.convoy.payloadGrams) / RULES.gramsPerUnit.food);
    expect(s.convoys['cv-fr-1']!.cargo.food).toBe(canCarry);
    expect(s.ledger.abandoned.food).toBe(40_000 - canCarry);
    expect(s.convoys['cv-fr-1']!.transit ?? s.convoys['cv-fr-1']!.at).not.toBe('G');
  });

  it('at its own depot, what the train cannot draw goes back into the depot', () => {
    const s = loaded(0, 'A');
    expect(s.ledger.abandoned.food).toBe(0);
    expect(s.convoys['cv-fr-1']!.cargo.food).toBe(0);
  });
});

describe('5. the Russian main armies are the same throughout the game', () => {
  it('a weakened main army that has escaped still counts: no cut-off while it stands at Dorogobuzh', () => {
    const ctx = createContext(vitebskDecision());
    const s = newGame(ctx, 1812);
    expect(s.mainArmies).toEqual(['ru-1st', 'ru-2nd']);
    s.forces['ru-2nd']!.men = 15_000;
    Object.assign(s.forces['ru-2nd']!, { at: 'dorogobuzh', transit: null });
    Object.assign(s.forces['fr-right']!, { at: 'valutino', transit: null });
    expect(lineOfRetreatBlocked(s, ctx, s.mainArmies)).toBe(false);
  });
});

describe('6. a decisive defeat means the Russians broke, not that they withdrew in order (the Borodino control)', () => {
  const ctx = createContext(vitebskDecision());
  const start = newGame(ctx, 1812);
  const mainStart = start.forces['ru-1st']!.men + start.forces['ru-2nd']!.men;
  const withBattle = (routed: ('fr' | 'ru')[]) => {
    const s = structuredClone(start);
    s.ended = 'scenarioEnd';
    const lost = Math.floor(mainStart * 0.34);
    s.forces['ru-1st']!.men -= lost;
    const b: BattleState = {
      id: '8.0.0', node: 'smolensk-north', attacker: 'fr', sides: { fr: ['fr-vanguard'], ru: ['ru-1st', 'ru-2nd'] }, phase: 'over',
      startsAt: { turn: 8, slot: 0 }, fightsFrom: {}, roundsFought: 9, roundsThisSlot: 0, awaiting: null, hidden: null, lastNight: 14,
      winner: 'fr', losses: { 'ru-1st': lost }, lossesAt: { '28': { 'ru-1st': lost } }, routed, field: idleField(),
    };
    s.battles[b.id] = b;
    return evaluate(start, s, ctx);
  };

  it('a third of the army lost, but an orderly withdrawal: not a decisive defeat', () => {
    expect(withBattle([]).russian).not.toBe('decisivelyDefeated');
  });

  it('the same losses with the Russian army broken: a decisive defeat', () => {
    expect(withBattle(['ru']).russian).toBe('decisivelyDefeated');
  });
});
