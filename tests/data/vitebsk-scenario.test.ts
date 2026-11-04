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

describe('What-if: the French at their 5 August strength (third review, history audit; not adopted)', () => {
  const plain = vitebskDecision();
  const grown = vitebskDecision({ frenchStrength: 'returns-5-august' });
  const mounted = vitebskDecision({ frenchStrength: 'returns-5-august-cavalry' });
  const force = (sc: typeof plain, id: string) => sc.forces.find((f) => f.id === id)!;
  const mid = (s: unknown) => (Array.isArray(s) ? (s[0] + s[1]) / 2 : Number(s));

  it('is a separate scenario, and leaves the Russians, the depots and the line trains as they are', () => {
    expect(plain.id).toBe('vitebsk-decision');
    expect(grown.id).toBe('vitebsk-decision+returns-5-august');
    for (const f of plain.forces.filter((x) => x.side === 'ru')) expect(force(grown, f.id)).toEqual(f);
    expect(grown.depots).toEqual(plain.depots);
    for (const c of plain.convoys.filter((x) => !x.serves || x.side === 'ru')) expect(grown.convoys.find((x) => x.id === c.id)).toEqual(c);
  });

  it('grows each French group with the same days of food and horses per man, its guns unchanged', () => {
    for (const f of plain.forces.filter((x) => x.side === 'fr')) {
      const g = force(grown, f.id);
      const factor = mid(g.men) / mid(f.men);
      expect(factor, f.id).toBeGreaterThan(1.1);
      expect(g.stock.food / mid(g.men)).toBeCloseTo(f.stock.food / mid(f.men), 2);
      expect(mid(g.horses) / mid(g.men)).toBeCloseTo(mid(f.horses) / mid(f.men), 2);
      expect(mid(g.cavalry) / mid(g.men)).toBeCloseTo(mid(f.cavalry) / mid(f.men), 2);
      expect(g.guns).toEqual(f.guns);
      const train = (sc: typeof plain) => sc.convoys.find((c) => c.serves === f.id)!.wagons;
      expect(train(grown) / train(plain)).toBeCloseTo(factor, 1);
    }
  });

  it('with the cavalry from the returns, every extra horseman has a mount', () => {
    for (const f of grown.forces.filter((x) => x.side === 'fr')) {
      const m = force(mounted, f.id);
      expect(m.men).toEqual(f.men);
      expect(mid(m.horses) - mid(f.horses)).toBeCloseTo(mid(m.cavalry) - mid(f.cavalry), 6);
    }
    // The vanguard's cavalry nearly doubles from the adopted scenario's.
    expect(mid(force(mounted, 'fr-vanguard').cavalry) / mid(force(plain, 'fr-vanguard').cavalry)).toBeGreaterThan(1.8);
  });

  it('every group still starts within what it can carry, and the game plays to the end', () => {
    for (const sc of [grown, mounted]) {
      const c = createContext(sc);
      for (let seed = 0; seed < 50; seed++) {
        const s = newGame(c, seed * 2654435761 >>> 0);
        for (const f of Object.values(s.forces)) expect(weightGrams(f.stock, c.rules), `${sc.id} ${f.id}, seed ${seed}`).toBeLessThanOrEqual(capacityGrams(f, c.rules));
      }
      expect(play(c, 7, randomPolicy(c, 7)).final.ended).toBe('scenarioEnd');
    }
  });
});
