import { describe, expect, it } from 'vitest';
import { createContext, newGame, stateHash } from '../../src/engine';
import type { GameState, Side } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play, randomPolicy, supplyTotals } from '../fixtures/driver';
import { capacityGrams, weightGrams } from '../../src/engine/carriage';

const ctx = createContext(vitebskDecision());

function menOf(s: GameState, side: Side): number {
  return Object.values(s.forces)
    .filter((f) => f.side === side)
    .reduce((n, f) => n + f.men, 0);
}

describe('The Vitebsk Decision: starting situation', () => {
  it('starts on 5 August 1812 with every force, depot and convoy on the map', () => {
    expect(ctx.scenario.startDate).toBe('1812-08-05');
    const s = newGame(ctx, 1812);
    for (const f of Object.values(s.forces)) expect(ctx.graph.nodes.has(f.at), f.id).toBe(true);
    for (const d of Object.values(s.depots)) expect(ctx.graph.nodes.has(d.node), d.node).toBe(true);
    for (const c of Object.values(s.convoys)) {
      // Each train supplies a force of its own side, or stands idle at its home depot as a line train.
      if (c.serves !== null) expect(s.forces[c.serves]?.side, c.id).toBe(c.side);
      else expect([c.feeds, s.depots[c.home]?.side], c.id).toEqual([c.home, c.side]);
    }
  });

  it('keeps army totals inside the researched ranges for every seed (H-009)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = newGame(ctx, seed * 2654435761 >>> 0);
      expect(menOf(s, 'fr')).toBeGreaterThanOrEqual(160_000);
      expect(menOf(s, 'fr')).toBeLessThanOrEqual(215_000);
      expect(menOf(s, 'ru')).toBeGreaterThanOrEqual(120_000);
      expect(menOf(s, 'ru')).toBeLessThanOrEqual(145_000);
    }
  });

  it('every group starts within what it can carry, for every seed (G-019)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = newGame(ctx, seed * 2654435761 >>> 0);
      for (const f of Object.values(s.forces)) expect(weightGrams(f.stock, ctx.rules), `${f.id}, seed ${seed}`).toBeLessThanOrEqual(capacityGrams(f, ctx.rules));
    }
  });

  it('draws strengths from the seed: reproducible, and different between seeds', () => {
    expect(stateHash(newGame(ctx, 7))).toBe(stateHash(newGame(ctx, 7)));
    const totals = new Set(Array.from({ length: 20 }, (_, i) => menOf(newGame(ctx, i), 'fr')));
    expect(totals.size).toBeGreaterThan(15);
  });

  it('plays to the end under random orders with men and supplies conserved', () => {
    for (const seed of [1, 2, 3]) {
      const run = play(ctx, seed, randomPolicy(ctx, seed * 31));
      expect(run.final.ended).toBe('scenarioEnd');
      const a = supplyTotals(run.states[0]!);
      const z = supplyTotals(run.final);
      const lost = Object.values(run.final.ledger.menLost).reduce((n, x) => n + x, 0);
      expect(z.men + lost).toBe(a.men);
      const { consumed, destroyed, abandoned, foraged } = run.final.ledger;
      expect(z.food + consumed.food + destroyed.food + abandoned.food).toBe(a.food + foraged.food);
    }
  });
});
