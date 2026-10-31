import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, statusOf, stepOnce, submit } from '../../src/engine';
import type { Context, GameState, GroupOrder } from '../../src/engine';
import { ROUNDS_PER_SLOT, slotIndex } from '../../src/engine/time';
import { inputFor, play, stepUntil, type Policy } from '../fixtures/driver';
import { forceInit, testGround } from '../fixtures/testGround';

/** Both armies start in the same place, so a battle is set up in the very first sub-step. */
function battleGround(): Context {
  return createContext(
    testGround((s) => {
      forceInit(s, 'ru-main').at = 'B';
      forceInit(s, 'ru-main').men = 60_000;
      forceInit(s, 'fr-main').stock.ammo = 0;
      forceInit(s, 'fr-main').engagement = 'seek';
    }),
  );
}

const holdAndStay: Policy = { orders: () => [], round: () => 'hold', nightfall: () => 'stay' };

function next(s: GameState, ctx: Context, policy: Policy = holdAndStay): GameState {
  const result = advance(s, inputFor(s, statusOf(s), policy), ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function advanceUntil(s: GameState, ctx: Context, until: (x: GameState) => boolean, limit = 100): GameState {
  let current = s;
  for (let i = 0; i < limit && !until(current); i++) current = next(current, ctx);
  if (!until(current)) throw new Error('condition never reached');
  return current;
}

const atStep = (step: string) => (s: GameState) => {
  const status = statusOf(s);
  return status.kind === 'awaitingBattleInput' && status.step === step;
};

function ordersOnly(s: GameState, ctx: Context, orders: GroupOrder[]): GameState {
  const result = submit(s, { kind: 'orders', turn: s.resolution.turn, orders }, ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe('turn timeline (§3.4a)', () => {
  it('T1: a delivery cannot be used in the sub-step it arrives, and is on hand from its end', () => {
    const ctx = battleGround();
    const s = advanceUntil(newGame(ctx, 7), ctx, atStep('round'));
    expect(s.resolution.slot).toBe(1);
    const fr = s.forces['fr-main'];
    expect(fr?.incoming.ammo).toBeGreaterThan(0); // the convoy has just arrived…
    expect(fr?.stock.ammo).toBe(0); // …but its load cannot be used in this sub-step
  });

  it('T2: consumption never exceeds stock on hand; the shortfall is recorded and has effects', () => {
    const ctx = createContext(
      testGround((s) => {
        forceInit(s, 'fr-main').stock.food = 10_000;
        s.convoys = [];
        s.districts.B = { food: 0, fodder: 15_000 };
      }),
    );
    const atNight = stepUntil(ordersOnly(newGame(ctx, 3), ctx, []), ctx, (x) => x.resolution.stage === 'night');
    const before = structuredClone(atNight.forces['fr-main']!);
    const { state, log } = stepOnce(atNight, ctx);
    const after = state.forces['fr-main']!;
    const need = before.men * RULES.consumption.foodPerMan;
    expect(before.stock.food).toBeLessThan(need);
    expect(after.stock.food).toBe(0);
    expect(log).toContainEqual(expect.objectContaining({ kind: 'shortfall', detail: expect.objectContaining({ force: 'fr-main', food: need - before.stock.food }) }));
    const sickness = Math.floor((before.men * RULES.attrition.sicknessPermillePerDay) / 1000);
    expect(after.men).toBeLessThan(before.men - sickness); // straggling on top of sickness
    expect(after.cohesion).toBeLessThan(before.cohesion);
  });

  it('T3: a force in battle neither moves nor forages while the battle lasts', () => {
    const ctx = battleGround();
    let s = advanceUntil(newGame(ctx, 7), ctx, atStep('round'));
    const district = { ...s.districts.B! };
    let pauses = 0;
    while (s.forces['fr-main']!.battle !== null && pauses < 40) {
      expect(s.forces['fr-main']).toMatchObject({ at: 'B', transit: null, activity: 'fight' });
      expect(s.districts.B).toEqual(district);
      s = next(s, ctx);
      pauses++;
    }
    expect(pauses).toBeGreaterThan(3);
  });

  it('T5: rounds use only ammunition carried at that moment', () => {
    const ctx = battleGround();
    let s = advanceUntil(newGame(ctx, 7), ctx, atStep('nightfall'));
    expect(s.resolution).toMatchObject({ turn: 1, slot: 1 });
    expect(s.ledger.ammoSpent.fr).toBe(0); // three rounds fought with empty ammunition wagons
    const carried = s.forces['fr-main']!.stock.ammo;
    expect(carried).toBeGreaterThan(0); // the delivery joined the stock at the end of the sub-step
    s = next(next(s, ctx), ctx); // stay for the night, then fight round 4 at dawn
    expect(s.ledger.ammoSpent.fr).toBeGreaterThan(0);
    expect(s.forces['fr-main']!.stock.ammo).toBe(carried - s.ledger.ammoSpent.fr);
  });

  it('T6: rounds take simulated time — at most 3 per sub-step, and only after the battle is set up', () => {
    const run = play(battleGround(), 7, holdAndStay);
    const entries = run.logs.flat();
    const joined = entries.find((e) => e.kind === 'battleJoined');
    expect(joined).toMatchObject({ turn: 1, slot: 0 });
    const perSlot = new Map<number, number>();
    for (const e of entries.filter((x) => x.kind === 'round' && x.detail.battle === joined?.detail.battle)) {
      expect(slotIndex(e)).toBeGreaterThan(slotIndex(joined!));
      perSlot.set(slotIndex(e), (perSlot.get(slotIndex(e)) ?? 0) + 1);
    }
    expect(perSlot.get(1)).toBe(ROUNDS_PER_SLOT); // a full afternoon, then nightfall
    for (const n of perSlot.values()) expect(n).toBeLessThanOrEqual(ROUNDS_PER_SLOT);
    const firstNight = entries.findIndex((e) => e.kind === 'nightfall');
    expect(entries.slice(0, firstNight).filter((e) => e.kind === 'round')).toHaveLength(ROUNDS_PER_SLOT);
  });

  it('T7: a battle that runs through the night across the turn boundary locks its forces and resumes at dawn', () => {
    const ctx = battleGround();
    const s = advanceUntil(newGame(ctx, 7), ctx, (x) => statusOf(x).kind === 'awaitingOrders' && x.resolution.turn === 2);
    expect(s.forces['fr-main']!.battle).not.toBeNull();
    expect(advance(s, { kind: 'orders', turn: 2, orders: [{ force: 'fr-main', route: ['A'] }] }, ctx).ok).toBe(false);
    const holding = advance(s, { kind: 'orders', turn: 2, orders: [{ force: 'fr-main', pace: 'steady' }] }, ctx);
    if (!holding.ok) throw new Error(holding.reason);
    expect(holding.status).toMatchObject({ kind: 'awaitingBattleInput', step: 'round' });
    expect(holding.state.resolution).toMatchObject({ turn: 2, slot: 0 });
    expect(holding.state.forces['fr-main']!.activity).toBe('fight');
  });

  it('a defender avoiding battle tries to withdraw before it starts, with a seeded outcome', () => {
    const ctx = createContext(testGround((s) => (forceInit(s, 'ru-main').at = 'B')));
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 40; seed++) {
      const s = ordersOnly(newGame(ctx, seed), ctx, [{ force: 'fr-main', engagement: 'avoid' }]);
      const atContact = stepUntil(s, ctx, (x) => x.resolution.stage === 'contacts');
      const { state, log } = stepOnce(atContact, ctx);
      const attempt = log.find((e) => e.kind === 'withdrawal');
      expect(attempt?.detail).toMatchObject({ side: 'fr', node: 'B' });
      const escaped = attempt?.detail.success === true;
      outcomes.add(escaped);
      expect(state.forces['fr-main']!.at).toBe(escaped ? 'A' : 'B');
      expect(Object.keys(state.battles)).toHaveLength(escaped ? 0 : 1);
    }
    expect(outcomes).toEqual(new Set([true, false]));
  });

  it('a force that withdraws falls back towards its own depots, not just to the first free place', () => {
    // With the French depot moved to C, the escape route is C, although A comes first alphabetically.
    const ctx = createContext(
      testGround((s) => {
        forceInit(s, 'ru-main').at = 'B';
        s.depots = [{ node: 'C', side: 'fr', stock: { food: 100_000, fodder: 50_000, ammo: 5_000 } }, ...s.depots.filter((d) => d.side === 'ru')];
        s.convoys = [];
      }),
    );
    for (let seed = 0; seed < 40; seed++) {
      const s = ordersOnly(newGame(ctx, seed), ctx, [{ force: 'fr-main', engagement: 'avoid' }]);
      const { state, log } = stepOnce(stepUntil(s, ctx, (x) => x.resolution.stage === 'contacts'), ctx);
      if (log.find((e) => e.kind === 'withdrawal')?.detail.success === true) {
        expect(state.forces['fr-main']!.at).toBe('C');
        return;
      }
    }
    throw new Error('no successful withdrawal in 40 seeds');
  });

  it('T9: fatigue rises with the march during a sub-step and recovers at night', () => {
    const ctx = createContext(testGround());
    const start = newGame(ctx, 5);
    const f0 = start.forces['fr-flank']!.fatigue;
    const { marchSteady, halt, nightAfterMarch } = RULES.fatigue;
    let s = ordersOnly(start, ctx, [{ force: 'fr-flank', route: ['B'], pace: 'steady' }]);
    s = stepUntil(s, ctx, (x) => x.resolution.slot === 1);
    expect(s.forces['fr-flank']).toMatchObject({ at: 'B', fatigue: f0 + marchSteady });
    s = stepUntil(s, ctx, (x) => x.resolution.stage === 'night');
    expect(s.forces['fr-flank']!.fatigue).toBe(f0 + marchSteady + halt);
    s = stepOnce(s, ctx).state;
    expect(s.forces['fr-flank']!.fatigue).toBe(f0 + marchSteady + halt - nightAfterMarch);
  });
});
