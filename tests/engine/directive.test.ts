import { describe, expect, it } from 'vitest';
import { advance, createContext, newGame, slotIndexOf } from '../../src/engine';
import type { Directive } from '../../src/engine';
import { axesTo, ordersFrom, planDirective } from '../../src/engine/directive';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';

const ctx = createContext(vitebskDecision());
const start = () => newGame(ctx, 1812);
const directive = (over: Partial<Directive>): Directive => ({ objective: null, axis: null, tempo: 'steady', posture: 'dispersed', engagement: 'accept', holdBack: [], logistics: 'hold', ...over });

describe('axes: genuinely different routes to an objective', () => {
  const axes = axesTo(ctx, 'liozno', 'smolensk-north');

  it('finds the Rudnia road, the southern swing and the northern flank, shortest first', () => {
    expect(axes).toHaveLength(3);
    expect(axes.map((a) => a.label)).toEqual([expect.stringContaining('Rudnia'), expect.stringContaining('Rasasna'), expect.stringContaining('Porechye')]);
    for (let i = 1; i < axes.length; i++) expect(axes[i]!.metres).toBeGreaterThan(axes[i - 1]!.metres);
    for (const a of axes) {
      expect(a.places[0]).toBe('liozno');
      expect(a.places.at(-1)).toBe('smolensk-north');
    }
  });

  it('gives each axis a stable id', () => {
    expect(axesTo(ctx, 'liozno', 'smolensk-north').map((a) => a.id)).toEqual(axes.map((a) => a.id));
  });
});

describe('the staff planner (§2.4b)', () => {
  it('sends every group to the objective along the chosen axis, by sensible roads', () => {
    const s = start();
    const southern = axesTo(ctx, 'liozno', 'smolensk').find((a) => a.label.includes('Rasasna'))!;
    const plan = planDirective(s, ctx, directive({ objective: 'smolensk', axis: southern, posture: 'concentrated' }));
    for (const p of plan) expect(p.order.route?.at(-1)).toBe('smolensk');
    expect(plan.find((p) => p.force === 'fr-vanguard')!.order.route).toContain('rasasna');
    // Davout is already south of the Dnieper: he takes the main road, not a detour back to the crossing.
    const davout = plan.find((p) => p.force === 'fr-right')!.order.route!;
    expect(davout).not.toContain('rasasna');
    expect(davout).toContain('krasnyi');
  });

  it('produces orders the engine accepts', () => {
    const s = start();
    const plan = planDirective(s, ctx, directive({ objective: 'smolensk-north', axis: null, tempo: 'forced', engagement: 'seek' }));
    const result = advance(s, { kind: 'orders', turn: 1, orders: ordersFrom(plan) }, ctx);
    expect(result.ok).toBe(true);
  });

  it('holds the line when there is no objective, in the chosen posture', () => {
    const plan = planDirective(start(), ctx, directive({ objective: null, posture: 'dispersed' }));
    for (const p of plan) {
      expect(p.order).toMatchObject({ route: [], posture: 'dispersed' });
      expect(p.reasons[0]).toContain('dispersed to feed');
    }
  });

  it('keeps held-back groups where they are', () => {
    const plan = planDirective(start(), ctx, directive({ objective: 'smolensk-north', holdBack: ['fr-south'] }));
    expect(plan.find((p) => p.force === 'fr-south')!.order.route).toEqual([]);
    expect(plan.find((p) => p.force === 'fr-south')!.reasons[0]).toBe('Held back by your order.');
  });

  it('forecasts arrival with gathering included, and never earlier in mud than on dry roads', () => {
    const plan = planDirective(start(), ctx, directive({ objective: 'smolensk-north' }));
    for (const p of plan) {
      if (!p.arrival) continue;
      expect(slotIndexOf(p.arrival.dry)).toBeGreaterThanOrEqual(2); // dispersed groups gather for two sub-steps first
      expect(slotIndexOf(p.arrival.mud)).toBeGreaterThanOrEqual(slotIndexOf(p.arrival.dry));
      expect(p.reasons.some((r) => r.startsWith('Arrives'))).toBe(true);
      expect(p.reasons).toContain('Gathers first from its cantonments: about a day before it can march.');
    }
  });

  it('reports known enemies from the French picture only', () => {
    const a = start();
    const b = structuredClone(a);
    b.forces['ru-1st']!.men = 1; // the French have not seen the 1st Army
    expect(b.intel.fr['ru-1st']).toBeUndefined();
    const plan = (s: typeof a) => planDirective(s, ctx, directive({ objective: 'smolensk-north' }));
    expect(plan(a)).toEqual(plan(b));
    const vanguard = plan(a).find((p) => p.force === 'fr-vanguard')!;
    expect(vanguard.reasons.some((r) => r.startsWith("Known enemy: Platov's Cossacks reported at Rudnia"))).toBe(true);
  });

  it("lets the player's own order replace the staff's for any group", () => {
    const plan = planDirective(start(), ctx, directive({ objective: 'smolensk-north' }));
    const orders = ordersFrom(plan, [{ force: 'fr-left', route: [], pace: 'rest' }]);
    expect(orders.find((o) => o.force === 'fr-left')).toEqual({ force: 'fr-left', route: [], pace: 'rest' });
    expect(orders.filter((o) => o.force !== 'fr-left')).toEqual(plan.filter((p) => p.force !== 'fr-left').map((p) => p.order));
  });
});
