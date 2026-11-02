// Horses, carrying and foraging reach (G-019): regression tests for stage B of the independent review.

import { describe, expect, it } from 'vitest';
import { RULES, newGame, planDirective, submit } from '../../src/engine';
import type { Context, GameState, GroupOrder, Supplies } from '../../src/engine';
import { withinCapacity } from '../../src/engine/carriage';
import { stepUntil } from '../fixtures/driver';
import { forceInit, passiveContext, testGround } from '../fixtures/testGround';

function ordered(s: GameState, ctx: Context, orders: GroupOrder[]): GameState {
  const result = submit(s, { kind: 'orders', turn: s.resolution.turn, orders }, ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const at = (slot: number, stage: string) => (s: GameState) => s.resolution.slot === slot && s.resolution.stage === stage;
const grams = (x: Supplies) => x.food * RULES.gramsPerUnit.food + x.fodder * RULES.gramsPerUnit.fodder + x.ammo * RULES.gramsPerUnit.ammo;
const foodLoad = (wagons: number) => Math.floor((wagons * RULES.convoy.payloadGrams * RULES.convoy.loadPermille.food) / 1000 / RULES.gramsPerUnit.food);

describe('draught horses', () => {
  it('a wagon train with half its draught horses carries half the load', () => {
    const load = (horses?: number) => {
      const ctx = passiveContext(
        testGround((s) => {
          if (horses !== undefined) s.convoys[0]!.horses = horses;
        }),
      );
      return stepUntil(ordered(newGame(ctx, 1), ctx, []), ctx, at(1, 'activity')).convoys['cv-fr-1']!.cargo.food;
    };
    expect(load()).toBe(foodLoad(60));
    expect(load(60 * RULES.draught.horsesPerWagon / 2)).toBe(foodLoad(30));
  });

  it('wagon-train horses graze, then eat what they carry, and die when there is nothing', () => {
    const night = (barren: boolean) => {
      const ctx = passiveContext(
        testGround((s) => {
          if (!barren) return;
          for (const d of s.depots) d.stock.fodder = 0;
          for (const id of Object.keys(s.districts)) s.districts[id] = { food: 40_000, fodder: 0 };
        }),
      );
      const start = newGame(ctx, 1);
      const s = stepUntil(ordered(start, ctx, []), ctx, (x) => x.resolution.slot === 2 && x.resolution.stage === 'activity');
      return { horses: s.convoys['cv-fr-1']!.horses, grazed: s.ledger.foraged.fodder > start.ledger.foraged.fodder };
    };
    const full = 60 * RULES.draught.horsesPerWagon;
    // With grass along the road and fodder on the wagons, the horses live; with neither, some die.
    expect(night(false).horses).toBe(full);
    expect(night(true).horses).toBeLessThan(full);
  });

  it("a group's draught horses eat with its other horses, and starve with them", () => {
    const ctx = passiveContext(
      testGround((s) => {
        forceInit(s, 'fr-main').stock.fodder = 0;
        s.convoys = [];
        for (const id of Object.keys(s.districts)) s.districts[id] = { food: 40_000, fodder: 0 };
      }),
    );
    const start = newGame(ctx, 1);
    const s = stepUntil(ordered(start, ctx, [{ force: 'fr-main', posture: 'concentrated' }]), ctx, (x) => x.resolution.slot === 2 && x.resolution.stage === 'activity');
    expect(start.forces['fr-main']!.draught).toBe(120 * RULES.draught.horsesPerWagon);
    expect(s.forces['fr-main']!.draught).toBeLessThan(start.forces['fr-main']!.draught);
  });
});

describe('what a group can carry', () => {
  /** The flank at G, away from any depot, with 600,000 rations and no wagons unless given some. */
  const heavyGround = (wagons: number, draught?: number, at = 'G') =>
    passiveContext(
      testGround((s) => {
        const f = forceInit(s, 'fr-flank');
        f.at = at;
        f.wagons = wagons;
        if (draught !== undefined) f.draught = draught;
        f.stock = { food: 600_000, fodder: 9_000, ammo: 1_000 };
      }),
    );

  it('setting out, a group with no wagons keeps only what its men can carry and abandons the rest', () => {
    const ctx = heavyGround(0);
    const start = newGame(ctx, 1);
    const s = stepUntil(ordered(start, ctx, [{ force: 'fr-flank', route: ['A'] }]), ctx, at(0, 'contacts'));
    const f = s.forces['fr-flank']!;
    const capacity = 20_000 * RULES.carrying.manGrams;
    expect(grams(f.stock)).toBeLessThanOrEqual(capacity);
    expect(grams(f.stock)).toBeGreaterThan(capacity - RULES.gramsPerUnit.food);
    // Fodder goes first, ammunition last.
    expect(f.stock).toMatchObject({ fodder: 0, ammo: 1_000 });
    expect(s.ledger.abandoned).toEqual({ food: 600_000 - f.stock.food, fodder: 9_000, ammo: 0 });
  });

  it('wagons with their horses carry more; wagons without horses carry nothing', () => {
    const kept = (draught?: number) => {
      const ctx = heavyGround(40, draught);
      return stepUntil(ordered(newGame(ctx, 1), ctx, [{ force: 'fr-flank', route: ['A'] }]), ctx, at(0, 'contacts')).forces['fr-flank']!.stock.food;
    };
    expect(kept()).toBeGreaterThan(kept(0));
    expect(kept(0)).toBe(Math.floor((20_000 * RULES.carrying.manGrams - 1_000 * RULES.gramsPerUnit.ammo) / RULES.gramsPerUnit.food));
  });

  it('at its own depot, what a group cannot carry goes back into the depot', () => {
    const ctx = heavyGround(0, undefined, 'A');
    const start = newGame(ctx, 1);
    const s = stepUntil(ordered(start, ctx, [{ force: 'fr-flank', route: ['B'] }]), ctx, at(0, 'contacts'));
    const back = 600_000 - s.forces['fr-flank']!.stock.food;
    expect(back).toBeGreaterThan(0);
    expect(s.depots.A!.stock.food).toBe(start.depots.A!.stock.food + back);
    expect(s.ledger.abandoned).toEqual({ food: 0, fodder: 0, ammo: 0 });
  });

  it('the staff says before you commit what a group will leave behind, and forecasts from what it keeps', () => {
    const ctx = heavyGround(0);
    const plan = planDirective(newGame(ctx, 1), ctx, { objective: 'A', axis: null, tempo: 'steady', posture: 'concentrated', engagement: 'accept', holdBack: [], logistics: 'hold' });
    const flank = plan.find((p) => p.force === 'fr-flank')!;
    expect(flank.reasons.some((r) => r.startsWith('Can carry only 60 t of its 532 t of stores') && r.endsWith(', lost.'))).toBe(true);
    expect(flank.foodDaysOnArrival).toBeLessThan(4);
  });

  it('at a depot, the staff draws only what the group could march with', () => {
    const ctx = passiveContext(
      testGround((s) => {
        const f = forceInit(s, 'fr-flank');
        f.wagons = 0;
        f.stock = { food: 0, fodder: 0, ammo: 0 };
      }),
    );
    const s = stepUntil(ordered(newGame(ctx, 1), ctx, []), ctx, at(1, 'activity'));
    const f = s.forces['fr-flank']!;
    // It may hold more in camp (fodder it foraged), but setting out it would keep every ration it drew (D-040).
    expect(withinCapacity(f.stock, 20_000 * RULES.carrying.manGrams, RULES).kept.food).toBe(f.stock.food);
    expect(grams({ ...f.stock, fodder: 0 })).toBeLessThanOrEqual(20_000 * RULES.carrying.manGrams);
    // …and it fills its packs with food.
    expect(20_000 * RULES.carrying.manGrams - grams({ ...f.stock, fodder: 0 })).toBeLessThan(RULES.gramsPerUnit.food);
  });
});

describe('foraging reach', () => {
  it('a dispersed group forages a neighbouring district only if it lies within reach by road', () => {
    const drained = (metres: number) => {
      const ctx = passiveContext(
        testGround((s) => {
          forceInit(s, 'fr-main').posture = 'dispersed';
          s.edges = s.edges.map((e) => (e.id === 'B-C' ? { ...e, metres } : e));
        }),
      );
      const start = newGame(ctx, 1);
      const s = stepUntil(ordered(start, ctx, []), ctx, at(1, 'activity'));
      return start.districts.C!.food - s.districts.C!.food;
    };
    expect(drained(12_000)).toBeGreaterThan(0);
    expect(drained(120_000)).toBe(0);
  });
});
