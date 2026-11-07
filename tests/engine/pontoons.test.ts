// The Dnieper needs a bridge or the pontoon train (G2, G-027, D-056). The contract:
//   1. A pontoon road is shut until the French have bridged it, and always shut to the Russians.
//   2. The train goes by itself to the first shut road a French column means to cross, at a wagon train's speed, by
//      roads open to it, and works there for `bridgeSlots` sub-steps. It stays put when nobody wants a bridge.
//   3. A column reaching the bank first waits there. Once bridged the road stays open to the French.
//   4. Retreats and wagon trains go only by roads open to them.
//   5. The train keeps out of a place the enemy holds, and cannot work with the enemy at the bank.
//   6. The forecast is the march: the plan says when the bridge will be ready, and the columns cross when it said.
//   7. At 0 the rule is off: no train, and the road is open to all.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, statusOf, supplyLines } from '../../src/engine';
import type { Context, Directive, GameState, Rules, ScenarioDef } from '../../src/engine';
import { lineOfRetreat } from '../../src/engine/battle';
import { ordersFrom, planDirective, previewRoutes, summarizePlan } from '../../src/engine/directive';
import { slotIndex } from '../../src/engine/time';
import { closedRoads } from '../../src/engine/util';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { BOTS } from '../balance/bots';
import { inputFor, play, type Policy } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { holdStill, testGround } from '../fixtures/testGround';

const ON = { ...RULES, weather: { rainPermille: 0 } } as unknown as Rules;
const OFF = { ...RULES, weather: { rainPermille: 0 }, pontoons: { bridgeSlots: 0 } } as unknown as Rules;

const directive = (over: Partial<Directive> = {}): Directive => ({ objective: 'C', axis: null, tempo: 'steady', posture: 'concentrated', engagement: 'accept', holdBack: ['fr-flank'], logistics: 'hold', ...over });

/** B–C is a pontoon road and the shortest way to C. The main body stands at B and the train starts at A, 8 km off. */
function ground(edit: (d: ScenarioDef) => void = () => {}): ScenarioDef {
  return testGround((d) => {
    d.turns = 6;
    d.convoys = [];
    d.pontoonStart = 'A';
    Object.assign(d.edges.find((e) => e.id === 'B-C')!, { road: 'post', crossing: 'pontoon' });
    for (const f of d.forces) f.at = f.side === 'ru' ? 'F' : f.id === 'fr-main' ? 'B' : 'A';
    edit(d);
  });
}

const contextFor = (scenario: ScenarioDef, rules: Rules = ON): Context => createContext(scenario, rules, { russianCommand: holdStill });
const once = (orders: () => ReturnType<typeof ordersFrom>): Policy => {
  let given = false;
  return {
    orders: () => {
      if (given) return [];
      given = true;
      return orders();
    },
    round: () => 'delegate',
    nightfall: () => 'delegate',
  };
};

describe('with the rule off', () => {
  it('there is no train, and the road is open to all', () => {
    const ctx = contextFor(ground(), OFF);
    const s = newGame(ctx, 7);
    expect(s.pontoons).toBeUndefined();
    expect(closedRoads(s, ctx, 'fr').size).toBe(0);
    expect(closedRoads(s, ctx, 'ru').size).toBe(0);
  });

  it('and a scenario with no train has none, with the rule on', () => {
    const ctx = contextFor(ground((d) => delete d.pontoonStart));
    expect(newGame(ctx, 7).pontoons).toBeUndefined();
  });
});

describe('the train and the bridge', () => {
  const ctx = contextFor(ground());

  it('a pontoon road starts shut to both sides', () => {
    const s = newGame(ctx, 7);
    expect([...closedRoads(s, ctx, 'fr')]).toEqual(['B-C']);
    expect([...closedRoads(s, ctx, 'ru')]).toEqual(['B-C']);
  });

  it('the train stays where it is while nobody wants a bridge', () => {
    const run = play(ctx, 7, once(() => [{ force: 'fr-main', route: [], pace: 'steady' }]));
    expect(run.final.pontoons).toMatchObject({ at: 'A', transit: null, work: 0, bridged: [] });
  });

  it('a column reaching the bank waits; the train comes, bridges the road, and the column crosses', () => {
    const run = play(ctx, 7, once(() => [{ force: 'fr-main', route: ['C'], pace: 'steady' }]));
    const log = run.logs.flat();
    const bridged = log.find((e) => e.kind === 'bridged')!;
    const arrived = log.find((e) => e.kind === 'arrived' && e.detail.force === 'fr-main' && e.detail.node === 'C')!;
    expect(bridged).toMatchObject({ detail: { road: 'B-C' } });
    // At A by the first sub-step's end, then two of work; the column sets out the sub-step after.
    expect(slotIndex({ turn: bridged.turn, slot: bridged.slot })).toBe(slotIndex({ turn: 1, slot: 2 }));
    expect(slotIndex({ turn: arrived.turn, slot: arrived.slot })).toBeGreaterThan(slotIndex({ turn: bridged.turn, slot: bridged.slot }));
    expect(run.final.pontoons!.bridged).toEqual(['B-C']);
    expect(violations(run)).toEqual([]);
  });

  it('once bridged the road stays open to the French and shut to the Russians', () => {
    const s = newGame(ctx, 7);
    s.pontoons!.bridged = ['B-C'];
    expect(closedRoads(s, ctx, 'fr').size).toBe(0);
    expect([...closedRoads(s, ctx, 'ru')]).toEqual(['B-C']);
  });

  it('with the rule off, the same column sets out at once and arrives sooner', () => {
    const arrival = (rules: Rules) => {
      const c = contextFor(ground(), rules);
      const e = play(c, 7, once(() => [{ force: 'fr-main', route: ['C'], pace: 'steady' }])).logs.flat().find((x) => x.kind === 'arrived' && x.detail.node === 'C')!;
      return slotIndex({ turn: e.turn, slot: e.slot });
    };
    expect(arrival(OFF)).toBeLessThan(arrival(ON));
  });

  it('the train keeps out of a place the enemy holds', () => {
    const blocked = contextFor(
      ground((d) => {
        d.forces.find((f) => f.id === 'ru-post')!.at = 'B';
        d.forces.find((f) => f.id === 'fr-main')!.at = 'A';
      }),
    );
    const run = play(blocked, 7, once(() => [{ force: 'fr-main', route: ['B', 'C'], pace: 'rest' }]));
    expect(run.final.pontoons).toMatchObject({ at: 'A', transit: null, bridged: [] });
  });
});

describe('who may use the road', () => {
  const ctx = contextFor(ground());

  it('a Russian army goes round, even when the pontoon road is the shortest way', () => {
    const scenario = ground((d) => {
      d.forces = d.forces.filter((f) => f.id !== 'ru-post');
      d.forces.find((f) => f.id === 'ru-main')!.at = 'C';
      d.forces.find((f) => f.id === 'fr-main')!.at = 'A';
    });
    const real = createContext(scenario, ON);
    const s = newGame(real, 7);
    const path = closedRoads(s, real, 'ru');
    expect(path.has('B-C')).toBe(true);
    const left = lineOfRetreat(s, real, 'C', 'ru', null);
    expect(left?.to).toBe('D');
  });

  it('a beaten French force may not fall back over an unbridged road, and may once it is bridged', () => {
    const s = newGame(ctx, 7);
    for (const f of Object.values(s.forces)) if (f.side === 'ru') f.at = 'F';
    const shut = lineOfRetreat(s, ctx, 'C', 'fr', null);
    expect(shut?.to).not.toBe('B');
    s.pontoons!.bridged = ['B-C'];
    expect(lineOfRetreat(s, ctx, 'C', 'fr', null)?.to).toBe('B');
  });

  it('a wagon train goes round until the road is bridged', () => {
    const wagons = contextFor(
      ground((d) => {
        d.depots = [{ node: 'B', side: 'fr', stock: { food: 400_000, fodder: 100_000, ammo: 20_000 } }];
        d.forces.find((f) => f.id === 'fr-main')!.at = 'C';
        d.convoys = [{ id: 'cv', side: 'fr', home: 'B', serves: 'fr-main', wagons: 60 }];
      }),
    );
    let s = newGame(wagons, 7);
    const seen = new Set<string>();
    const policy = once(() => []);
    for (let i = 0; i < 6 && statusOf(s).kind !== 'ended'; i++) {
      const r = advance(s, inputFor(s, statusOf(s), policy), wagons, (x) => {
        const edge = x.convoys['cv']!.transit?.edge;
        if (edge) seen.add(edge);
      });
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(seen.size).toBeGreaterThan(0);
    expect(seen.has('B-C')).toBe(false);
  });

  it('and the supply line on the map goes round with it', () => {
    const wagons = contextFor(
      ground((d) => {
        d.depots = [{ node: 'B', side: 'fr', stock: { food: 400_000, fodder: 100_000, ammo: 20_000 } }];
        d.forces.find((f) => f.id === 'fr-main')!.at = 'C';
        d.convoys = [{ id: 'cv', side: 'fr', home: 'B', serves: 'fr-main', wagons: 60 }];
      }),
    );
    const s = newGame(wagons, 7);
    expect(supplyLines(s, wagons)[0]!.path).not.toEqual(['B', 'C']);
    s.pontoons!.bridged = ['B-C'];
    expect(supplyLines(s, wagons)[0]!.path).toEqual(['B', 'C']);
  });
});

describe('the forecast is the march', () => {
  const ctx = contextFor(ground());

  it('the plan says when the bridge will be ready, and the column arrives when it said', () => {
    const plan = planDirective(newGame(ctx, 7), ctx, directive());
    const main = plan.find((p) => p.force === 'fr-main')!;
    expect(main.bridge).toMatchObject({ between: 'Node B and Node C', ready: { turn: 1, slot: 3 } });
    expect(main.reasons.join(' ')).toContain('the bridge between Node B and Node C');
    const run = play(ctx, 7, once(() => ordersFrom(plan)));
    const arrived = run.logs.flat().find((e) => e.kind === 'arrived' && e.detail.force === 'fr-main' && e.detail.node === 'C')!;
    expect(slotIndex({ turn: arrived.turn, slot: arrived.slot })).toBe(slotIndex(main.arrival!.dry));
  });

  it('the route cards and the summary say it', () => {
    const s = newGame(ctx, 7);
    const plan = planDirective(s, ctx, directive());
    const lines = summarizePlan(s, ctx, plan).lines.join(' ');
    expect(lines).toContain('Bridge between Node B and Node C');
    expect(previewRoutes(s, ctx, directive(), [null])[0]!.bridges).toEqual([{ between: 'Node B and Node C', ready: { turn: 1, slot: 3 } }]);
  });

  it('a road already bridged needs no word, and planning changes nothing', () => {
    const s = newGame(ctx, 7);
    s.pontoons!.bridged = ['B-C'];
    const before = JSON.stringify(s.pontoons);
    const main = planDirective(s, ctx, directive()).find((p) => p.force === 'fr-main')!;
    expect(main.bridge).toBeNull();
    expect(JSON.stringify(s.pontoons)).toBe(before);
  });
});

describe('over whole games on the real map', () => {
  const ctx = createContext(vitebskDecision());

  it('starts the train at Orsha, breaks no invariant, and nobody stands on a shut road', () => {
    expect(newGame(ctx, 1).pontoons).toMatchObject({ at: 'orsha' });
    let bridged = 0;
    for (const bot of ['southern-envelopment-hold', 'concentrated-push', 'pinning-attack', 'random']) {
      for (let seed = 1; seed <= 6; seed++) {
        const run = play(ctx, seed, BOTS[bot]!(ctx));
        expect(violations(run), `${bot} ${seed}`).toEqual([]);
        for (const s of run.states as GameState[]) {
          for (const f of Object.values(s.forces)) {
            if (f.transit) expect(closedRoads(s, ctx, f.side).has(f.transit.edge), `${bot} ${seed} ${f.id}`).toBe(false);
          }
        }
        bridged += run.final.pontoons!.bridged.length;
      }
    }
    expect(bridged).toBeGreaterThan(0);
  }, 30_000); // twenty-four whole games: close to the 5-second default on a busy machine
});
