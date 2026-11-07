// Raids on the wagon trains (V4, G-028, D-057). The contract:
//   1. A raider rides out from where it stands, by roads free of the enemy's troops, as far as `reachMetres`. A wagon
//      train is exposed on a road with none of its side's groups at either end, if a raider can reach that road.
//   2. Each sub-step a raider may fall on the nearest exposed train, with chance `permille`: one train, no more.
//   3. A raid burns a share of the cargo and drives off a share of the horses. All of it stays accounted for.
//   4. A train at a place, a raider in battle or gone, and a road shut to the raider's side are all out of it.
//   5. The dice are keyed: a raid that does not happen changes nothing else in the game.
//   6. The French fear only what they know: the roads open to the raiders as last seen, never as they stand.
//   7. A raid shows where it happens: in the dispatches, in playback and on the map afterwards.
//   8. At 0 the rule is off.

import { describe, expect, it } from 'vitest';
import { RULES, advance, advanceWithPlayback, createContext, newGame, stateHash, statusOf, supplyLines } from '../../src/engine';
import type { Context, GameState, LogEntry, Rules, ScenarioDef } from '../../src/engine';
import { exposedRoads, raidConvoys } from '../../src/engine/raids';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { scarsOf } from '../../src/ui/consequences';
import { dispatches } from '../../src/ui/dispatches';
import { eventText, focusesOf, supplyText, timesOf } from '../../src/ui/playbackModel';
import { BOTS } from '../balance/bots';
import { inputFor, play, type Policy } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { holdStill, testGround } from '../fixtures/testGround';

const raids = (over: Partial<Rules['raids']>): Rules => ({ ...RULES, weather: { rainPermille: 0 }, raids: { ...RULES.raids, ...over } }) as unknown as Rules;
const CERTAIN = raids({ permille: 1000 });

/**
 * The raider at E, 15 km from B. The main body at C, the flank corps at G, and a loaded train on the road from A to B
 * with neither end held.
 */
function ground(edit: (d: ScenarioDef) => void = () => {}): ScenarioDef {
  return testGround((d) => {
    d.raiders = ['ru-post'];
    for (const f of d.forces) f.at = f.id === 'ru-post' ? 'E' : f.side === 'ru' ? 'F' : f.id === 'fr-main' ? 'C' : 'G';
    edit(d);
  });
}

const contextFor = (scenario: ScenarioDef, rules: Rules = CERTAIN): Context => createContext(scenario, rules, { russianCommand: holdStill });

/** A new game with the train on the road from A to B, carrying a full load. */
function onTheRoad(ctx: Context, edge = 'A-B', to = 'B'): GameState {
  const s = newGame(ctx, 7);
  Object.assign(s.convoys['cv-fr-1']!, { leg: 'outbound', at: 'A', transit: { edge, to, metres: 2_000, seq: 0 }, cargo: { food: 10_000, fodder: 2_000, ammo: 500 }, horses: 100 });
  return s;
}

const raided = (log: readonly LogEntry[]) => log.filter((e) => e.kind === 'raided');

function raid(ctx: Context, s: GameState): LogEntry[] {
  const log: LogEntry[] = [];
  raidConvoys(s, ctx, log);
  return log;
}

describe('with the rule off', () => {
  it('no train is raided', () => {
    const ctx = contextFor(ground(), raids({ permille: 0 }));
    const s = onTheRoad(ctx);
    expect(raid(ctx, s)).toEqual([]);
    expect(exposedRoads(s, ctx).size).toBe(0);
  });

  it('nor in a scenario with no raiders, with the rule on', () => {
    const ctx = contextFor(ground((d) => delete d.raiders));
    expect(raid(ctx, onTheRoad(ctx))).toEqual([]);
  });
});

describe('a raid', () => {
  const ctx = contextFor(ground());

  it('burns a share of the cargo and drives off a share of the horses, and says where', () => {
    const s = onTheRoad(ctx);
    const [e] = raided(raid(ctx, s));
    expect(s.convoys['cv-fr-1']).toMatchObject({ cargo: { food: 5_000, fodder: 1_000, ammo: 250 }, horses: 80 });
    expect(e!.detail).toMatchObject({ convoy: 'cv-fr-1', by: 'ru-post', edge: 'A-B', food: 5_000, fodder: 1_000, ammo: 250, horses: 20 });
  });

  it('leaves it all accounted for', () => {
    const s = onTheRoad(ctx);
    const before = structuredClone(s.ledger);
    raid(ctx, s);
    expect(s.ledger.destroyed).toEqual({ food: before.destroyed.food + 5_000, fodder: before.destroyed.fodder + 1_000, ammo: before.destroyed.ammo + 250 });
    expect(s.ledger.horsesLost).toBe(before.horsesLost + 20);
  });

  it('needs the train on the road', () => {
    const s = newGame(ctx, 7);
    expect(raid(ctx, s)).toEqual([]);
  });

  it('cannot touch a road with a French group at either end', () => {
    const covered = contextFor(ground((d) => (d.forces.find((f) => f.id === 'fr-flank')!.at = 'A')));
    expect(raid(covered, onTheRoad(covered))).toEqual([]);
  });

  it('cannot ride through a place the French hold', () => {
    // A–G is reached only through B and A: with the flank corps at B the raider has no way round.
    const open = contextFor(ground((d) => (d.forces.find((f) => f.id === 'fr-flank')!.at = 'C')));
    const barred = contextFor(ground((d) => (d.forces.find((f) => f.id === 'fr-flank')!.at = 'B')));
    expect(raided(raid(open, onTheRoad(open, 'A-G', 'G')))).toHaveLength(1);
    expect(raid(barred, onTheRoad(barred, 'A-G', 'G'))).toEqual([]);
  });

  it('reaches only so far', () => {
    const near = contextFor(ground(), raids({ permille: 1000, reachMetres: 10_000 }));
    expect(raid(near, onTheRoad(near))).toEqual([]);
  });

  it('cannot be made from a battle, or by a force that is gone', () => {
    const fighting = onTheRoad(ctx);
    fighting.forces['ru-post']!.battle = 'b1';
    expect(raid(ctx, fighting)).toEqual([]);
    const gone = onTheRoad(ctx);
    gone.forces['ru-post']!.men = 0;
    expect(raid(ctx, gone)).toEqual([]);
  });

  it('cannot cross a road shut to the raiders', () => {
    // The pontoon road is shut to the Russians: the way round by D, C and B is 60 km, out of a reach of 30.
    const scenario = ground((d) => {
      d.pontoonStart = 'A';
      Object.assign(d.edges.find((e) => e.id === 'B-E')!, { crossing: 'pontoon' });
      d.forces.find((f) => f.id === 'fr-main')!.at = 'G';
    });
    const shut = contextFor(scenario, raids({ permille: 1000, reachMetres: 30_000 }));
    expect(raid(shut, onTheRoad(shut))).toEqual([]);
  });

  it('falls on one train a sub-step, the nearest', () => {
    const two = contextFor(
      ground((d) => {
        d.convoys = [
          { id: 'cv-far', side: 'fr', home: 'A', serves: 'fr-main', wagons: 60 },
          { id: 'cv-near', side: 'fr', home: 'A', serves: 'fr-flank', wagons: 60 },
        ];
      }),
    );
    const s = newGame(two, 7);
    Object.assign(s.convoys['cv-far']!, { leg: 'outbound', at: 'A', transit: { edge: 'A-G', to: 'G', metres: 2_000, seq: 0 }, horses: 100 });
    Object.assign(s.convoys['cv-near']!, { leg: 'outbound', at: 'A', transit: { edge: 'A-B', to: 'B', metres: 2_000, seq: 0 }, horses: 100 });
    expect(raided(raid(two, s)).map((e) => e.detail.convoy)).toEqual(['cv-near']);
  });

  it('never touches the raiders\' own side', () => {
    const own = contextFor(ground((d) => (d.convoys = [{ id: 'cv-ru', side: 'ru', home: 'F', serves: 'ru-main', wagons: 60 }])));
    const s = newGame(own, 7);
    Object.assign(s.convoys['cv-ru']!, { leg: 'outbound', at: 'D', transit: { edge: 'D-F', to: 'F', metres: 2_000, seq: 0 }, horses: 100 });
    expect(raid(own, s)).toEqual([]);
  });
});

describe('the dice', () => {
  const hold: Policy = { orders: () => [], round: () => 'delegate', nightfall: () => 'delegate' };
  const hash = (rules: Rules) => {
    const ctx = contextFor(ground(), rules);
    let s = newGame(ctx, 7);
    for (let i = 0; i < 3 && statusOf(s).kind !== 'ended'; i++) {
      const r = advance(s, inputFor(s, statusOf(s), hold), ctx);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    return stateHash(s);
  };

  it('a raid that does not happen changes nothing else', () => {
    expect(hash(raids({ permille: 1 }))).toBe(hash(raids({ permille: 0 })));
  });

  it('the same seed gives the same raids', () => {
    const ctx = contextFor(ground(), raids({ permille: 500 }));
    const [a, b] = [onTheRoad(ctx), onTheRoad(ctx)];
    expect(raid(ctx, a)).toEqual(raid(ctx, b));
  });
});

describe('what the French know', () => {
  const ctx = contextFor(ground());

  it('fears nothing from raiders it has not seen', () => {
    const s = onTheRoad(ctx);
    s.intel.fr = {};
    expect(exposedRoads(s, ctx).size).toBe(0);
  });

  it('fears the roads open to them where they were last seen, not where they are', () => {
    const s = onTheRoad(ctx);
    s.intel.fr = { 'ru-post': { at: 'G', men: 2_000, turn: 1 } };
    // Seen at G, with the flank corps gone: the roads from there. The raider truly stands at E.
    s.forces['fr-flank']!.at = 'C';
    expect([...exposedRoads(s, ctx)]).toContain('A-G');
    s.intel.fr = { 'ru-post': { at: 'E', men: 2_000, turn: 1 } };
    expect([...exposedRoads(s, ctx)]).toContain('B-E');
  });

  it('the supply line says which of its roads are exposed', () => {
    const open = contextFor(ground((d) => (d.convoys = [{ id: 'cv-fr-1', side: 'fr', home: 'A', serves: 'fr-flank', wagons: 60 }])));
    const s = newGame(open, 7);
    s.intel.fr = { 'ru-post': { at: 'E', men: 2_000, turn: 1 } };
    s.forces['fr-flank']!.at = 'D';
    const line = supplyLines(s, open)[0]!;
    expect(line.exposed.length).toBeGreaterThan(0);
    expect(supplyText(line, s, open)).toContain('Exposed to raids');
    s.intel.fr = {};
    expect(supplyLines(s, open)[0]!.exposed).toEqual([]);
  });
});

describe('a raid on the map and in the news', () => {
  const ctx = contextFor(ground());
  const s = onTheRoad(ctx);
  const log = raid(ctx, s);

  it('is in the dispatches, without saying where the raiders stand', () => {
    const [d] = dispatches(log, s, ctx, ctx.scenario.startDate);
    expect(d!.text).toContain('Cossacks fell on a wagon train between Node A and Node B');
    expect(d!.text).toContain('5,000 rations');
    expect(d!.text).not.toContain('Node E');
  });

  it('plays back where it happens, and the camera goes there', () => {
    const open = contextFor(
      ground((d) => {
        d.forces.find((f) => f.id === 'fr-flank')!.at = 'D';
        d.convoys = [{ id: 'cv-fr-1', side: 'fr', home: 'A', serves: 'fr-flank', wagons: 60 }];
      }),
    );
    const s0 = newGame(open, 7);
    Object.assign(s0.convoys['cv-fr-1']!, { leg: 'outbound', cargo: { food: 10_000, fodder: 2_000, ammo: 500 } });
    const { frames } = advanceWithPlayback(s0, { kind: 'orders', turn: 1, orders: [] }, open);
    const event = frames.flatMap((f) => f.events).find((e) => e.kind === 'raid')!;
    expect(eventText(event, s0, open)).toContain(`Cossacks raid a wagon train near Node ${event.node}`);
    expect(focusesOf(frames, timesOf(frames)).length).toBeGreaterThan(0);
  });

  it('leaves a mark on its road', () => {
    expect(scarsOf(log, s).raids).toEqual([{ edge: 'A-B', when: { turn: 1, slot: 0 }, food: 5_000, horses: 20 }]);
  });
});

describe('over whole games on the real map', () => {
  const ctx = createContext(vitebskDecision(), raids({ permille: 200 }));

  it('names the Cossacks as raiders, breaks no invariant, and raids happen', () => {
    expect(vitebskDecision().raiders).toEqual(['ru-cossacks']);
    let seen = 0;
    for (const bot of ['southern-envelopment-hold', 'concentrated-push', 'random']) {
      for (let seed = 1; seed <= 6; seed++) {
        const run = play(ctx, seed, BOTS[bot]!(ctx));
        expect(violations(run), `${bot} ${seed}`).toEqual([]);
        const hits = run.logs.flat().filter((e) => e.kind === 'raided');
        seen += hits.length;
        for (const e of hits) expect(run.final.convoys[String(e.detail.convoy)]?.side).toBe('fr');
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 30_000); // eighteen whole games: close to the 5-second default on a busy machine
});
