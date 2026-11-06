import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RULES_VERSION, createContext, replay, stateHash } from '../../src/engine';
import type { Context, GameState } from '../../src/engine';
import { ROUNDS_PER_SLOT, slotIndex } from '../../src/engine/time';
import { advancePolicy, play, randomPolicy, supplyTotals, type Run } from '../fixtures/driver';
import { contactViolations } from '../fixtures/invariants';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { BOTS } from '../balance/bots';
import { forceInit, testGround, passiveContext } from '../fixtures/testGround';

const open = passiveContext(testGround());
const crowded = passiveContext(
  testGround((s) => {
    forceInit(s, 'ru-main').at = 'B';
    forceInit(s, 'ru-post').at = 'A';
  }),
);
/** The real Russian command, so the invariants also hold while the AI moves. */
const lively = createContext(testGround());

/**
 * Golden replays (§3.3): rules version → final-state hash of the scripted advance on seed 1812.
 * Never edit an existing entry. A change that alters results needs a new rules version and a new entry.
 */
const GOLDEN: Record<string, string> = {
  '0.1.0': '8c8ffd59ea26b2e7',
  '0.2.0': 'c6a24c55ddaa0d93', // weight-based convoy loads; forced march 36 km/day
  '0.3.0': 'b835409fa27a2ceb', // posture and gathering, depot issue, wider foraging, retreat towards home
  '0.4.0': '6b48ca020f71d0ab', // intelligence and the Russian command (run with Russians held still)
  '0.5.0': '2d02fdbd93033054', // halt for the season (state gains `halted`)
  '0.6.0': 'fb9cd183b39e6999', // captured stores, forward depots and line trains (convoys gain `feeds`, ledger gains `destroyed`)
  '0.7.0': '618aa3acc8914520', // hunger costs 30 cohesion a day at a full shortfall, not 100 (G-017)
  // Contacts (D-031): forces move hour by hour, columns cannot pass on a road, retreats take time on the
  // road; battles gain `fightsFrom`. The scripted advance now ends with its beaten side still on the road.
  '0.8.0': '31fe2f88c0aa5ec3',
  // Horses, carrying and foraging reach (G-019): forces gain `draught`, convoys `horses`, the ledger `abandoned`.
  '0.9.0': '229a30ce286dce6b',
  // The outcome model (D-035): battles record each force's losses; the state tracks how long the line of retreat is held.
  '0.10.0': 'f2210a8dc39c26cc',
  // Scenario and dice separated (state gains `dice`); with the dice equal to the seed every draw is unchanged.
  '0.11.0': '070285ad72acd22c',
  // The second review (D-037): road order, traction, fixed main armies, the rout rule; state gains `roadSeq` and `mainArmies`.
  '0.12.0': '471df355d10627e6',
  // Movement in time order (D-038): forces gain `arrivedAt`; a tied attacker is drawn instead of always French.
  '0.13.0': '727f678929cb7de1',
  // What a cut road earns (D-039): only the judging of the end changes; the play is the same as 0.13.0.
  '0.14.0': 'ea8dd47e1440de46',
  // Supply (D-040): food issued up to what a group can carry, by depot or train alike; held fodder never blocks food.
  '0.15.0': 'c5e7de07094cf099',
  // A beaten attacker falls back the way it came (D-042); forces gain `cameFrom`.
  '0.16.0': 'd98588357012dc03',
  // Sector battles (§2.10, D-043): three sectors and a reserve, cavalry and guns, graded exits, pursuit.
  '0.17.0': 'ab33d4c557f65a1f',
  // The Smolensk battlefield, massed guns, cavalry charges and tasks, flanks, the Russian marshal under pressure.
  '0.17.1': '322ab15672e0bec3',
  // The road by the Prudichevo ford from Smolensk's Old Town to Valutino (H-022, D-044).
  '0.17.2': 'e4f859a50da6e294',
  // Third review: a beaten side falls back together along its line (an attacker the way it came, a defender
  // towards its base), both sides breaking off leave at once and never by one road, a stand with an empty line
  // counter-attacks, only deployed cavalry pursues or screens, no column led past a slower enemy (D-046).
  '0.18.0': 'ace0bdbfd267a81a',
  // A group already on a chosen route follows it (D-050). The same game as 0.18.0, which no route enters: with the
  // version label set back to 0.18.0 it reproduces ace0bdbfd267a81a; the state records the rules version.
  '0.18.1': 'ae00ce353d5b3ca1',
  // The test ground has its own roads: the same game, with the rules version recorded in it.
  '0.19.0': 'e0fa7f6f01420b6c',
  // How the ending is judged, and the last battles (D-053). The same game: with the version label set back to 0.19.0
  // it reproduces e0fa7f6f01420b6c.
  '0.20.0': 'a31ef12d3a72c678',
  // A Russian strike stays within reach (D-054). No strike happens here: with the version label set back to 0.20.0
  // it reproduces a31ef12d3a72c678.
  '0.21.0': 'ac6f394a8c2bc287',
  // A real change: columns of one side queue on a road (D-055).
  '0.22.0': 'f9ca3d9b08457fda',
};

/**
 * Golden replays on the real scenario with the real Russian command (from rules 0.8.0): the methodical
 * bot on seed 1812, the run in which the independent review found reinforcements left outside battle 7.2.0.
 */
const GOLDEN_VITEBSK: Record<string, string> = {
  '0.8.0': 'a4eba27f22269f08',
  // G-019, and the Russian armies' starting fodder trimmed to what they can carry.
  '0.9.0': 'fe2e22e26628a01e',
  '0.10.0': '213ae2dc28f8cfca',
  '0.11.0': '4ceff6b3eb9f0efc',
  // Also the foraging reach at 11 km (G-019, D-037).
  '0.12.0': '5cfa601d92d3f681',
  '0.13.0': '5c2bfdd2ba3e3f21',
  '0.14.0': 'e9543230ca011152',
  '0.15.0': '4a00d5639b4bd561',
  '0.16.0': '78b60ad66e0f73a5',
  '0.17.0': '4e36c8f97b470641',
  '0.17.1': '85c3bf612566b3ff',
  '0.17.2': '6b6b838b705d899c',
  '0.18.0': '78bd0b273d8bc56e',
  // The same game as 0.18.0 (it reproduces 78bd0b273d8bc56e with the version label set back): D-050.
  '0.18.1': 'b8fd258c60f4a523',
  // The road audit's classes and crossings, and the road from Liozno to Liubavichi (D-052).
  '0.19.0': 'e524b9bf1bf1ca6d',
  // As above, the same game with a new version label: 0.19.0 reproduces e524b9bf1bf1ca6d.
  '0.20.0': '1382a748cbfbf44f',
  // A real change: the Russians strike no further than Rudnia (D-054).
  '0.21.0': '5b9201b2b685d979',
  // A real change: columns of one side queue on a road (D-055).
  '0.22.0': '304bdefc00f226e7',
};

/** T8: men, horses, wagons, food, fodder and ammunition are conserved, stores burned on capture included; nothing goes negative. */
function checkConservation(run: Run): void {
  const a = supplyTotals(run.states[0]!);
  for (const s of run.states) {
    const t = supplyTotals(s);
    const lost = Object.values(s.ledger.menLost).reduce((n, x) => n + x, 0);
    // Burned on capture or abandoned on the march: the two ways stores leave the books besides use.
    const gone = (k: 'food' | 'fodder' | 'ammo') => s.ledger.destroyed[k] + s.ledger.abandoned[k];
    expect(t.men + lost).toBe(a.men);
    expect(t.horses + s.ledger.horsesLost).toBe(a.horses);
    expect(t.wagons).toBe(a.wagons);
    expect(t.food + s.ledger.consumed.food + gone('food')).toBe(a.food + s.ledger.foraged.food);
    expect(t.fodder + s.ledger.consumed.fodder + gone('fodder')).toBe(a.fodder + s.ledger.foraged.fodder);
    expect(t.ammo + s.ledger.ammoSpent.fr + s.ledger.ammoSpent.ru + gone('ammo')).toBe(a.ammo);
    expect(t.districtFood + s.ledger.foraged.food).toBe(a.districtFood);
    expect(t.districtFodder + s.ledger.foraged.fodder).toBe(a.districtFodder);
    for (const f of Object.values(s.forces)) {
      for (const v of [f.men, f.horses, f.stock.food, f.stock.fodder, f.stock.ammo, f.fatigue, f.cohesion]) expect(v).toBeGreaterThanOrEqual(0);
    }
    for (const d of Object.values(s.depots)) for (const v of [d.stock.food, d.stock.fodder, d.stock.ammo]) expect(v).toBeGreaterThanOrEqual(0);
    // Every wagon train has exactly one task: a force to supply, or a depot to stock.
    for (const c of Object.values(s.convoys)) expect(c.serves === null, c.id).not.toBe(c.feeds === null);
  }
}

/** T4: no force belongs to two encounters in one sub-step, or to two battles at once. */
function checkExclusivity(run: Run): void {
  const seen = new Map<number, Set<string>>();
  for (const e of run.logs.flat()) {
    if (e.kind !== 'encounter') continue;
    const set = seen.get(slotIndex(e)) ?? new Set<string>();
    for (const id of String(e.detail.forces).split(',')) {
      expect(set.has(id)).toBe(false);
      set.add(id);
    }
    seen.set(slotIndex(e), set);
  }
  for (const s of run.states) {
    for (const f of Object.values(s.forces)) {
      const active = Object.values(s.battles).filter((b) => b.phase !== 'over' && (b.sides.fr.includes(f.id) || b.sides.ru.includes(f.id)));
      expect(active.length).toBeLessThanOrEqual(1);
      expect(f.battle).toBe(active[0]?.id ?? null);
    }
    // Arrivals at a battle are in it; opposing columns never share a road heading towards each other.
    expect(contactViolations(s)).toEqual([]);
  }
}

/** T6: rounds only after the battle is set up, never more than 3 in a sub-step. */
function checkRoundTiming(run: Run): void {
  const joined = new Map<string, number>();
  const perSlot = new Map<string, number>();
  for (const e of run.logs.flat()) {
    const id = String(e.detail.battle);
    if (e.kind === 'battleJoined') joined.set(id, slotIndex(e));
    if (e.kind !== 'round') continue;
    expect(slotIndex(e)).toBeGreaterThan(joined.get(id) ?? Infinity);
    const key = `${id}@${slotIndex(e)}`;
    perSlot.set(key, (perSlot.get(key) ?? 0) + 1);
    expect(perSlot.get(key)).toBeLessThanOrEqual(ROUNDS_PER_SLOT);
  }
}

/** T10: a save is the state as JSON; loading it at any pause and replaying the rest changes nothing. */
function checkResumption(run: Run, ctx: Context): void {
  const finalHash = stateHash(run.final);
  expect(stateHash(replay(run.states[0]!, run.inputs, ctx))).toBe(finalHash);
  const n = run.inputs.length;
  for (const k of new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1])) {
    const loaded = JSON.parse(JSON.stringify(run.states[k])) as GameState;
    expect(stateHash(replay(loaded, run.inputs.slice(k), ctx))).toBe(finalHash);
  }
}

describe('determinism, conservation and resumption', () => {
  it('the same seed and inputs reproduce the same game, pause by pause', () => {
    const a = play(open, 1812, advancePolicy);
    const b = play(open, 1812, advancePolicy);
    expect(a.states.map(stateHash)).toEqual(b.states.map(stateHash));
  });

  it('golden replay: results change only with the rules version', () => {
    expect(stateHash(play(open, 1812, advancePolicy).final)).toBe(GOLDEN[RULES_VERSION]);
  });

  it('golden replay on the real scenario, with the Russian command and reinforcements', () => {
    const ctx = createContext(vitebskDecision());
    const run = play(ctx, 1812, BOTS.methodical!(ctx));
    expect(run.logs.flat().some((e) => e.kind === 'reinforced')).toBe(true);
    for (const s of run.states) expect(contactViolations(s)).toEqual([]);
    expect(stateHash(run.final)).toBe(GOLDEN_VITEBSK[RULES_VERSION]);
  });

  it('T10: saving and loading at every pause, mid-battle included, gives an identical final state', () => {
    const run = play(open, 1812, advancePolicy);
    expect(run.states.some((s) => Object.values(s.battles).some((b) => b.phase === 'rounds' && b.roundsFought > 0))).toBe(true);
    const finalHash = stateHash(run.final);
    run.states.slice(0, -1).forEach((state, k) => {
      const loaded = JSON.parse(JSON.stringify(state)) as GameState;
      expect(stateHash(replay(loaded, run.inputs.slice(k), open))).toBe(finalHash);
    });
  });

  it('random play keeps every invariant (T4, T6, T8, T10)', () => {
    fc.assert(
      fc.property(fc.constantFrom(open, crowded, lively), fc.integer({ min: 0, max: 0xffffffff }), fc.integer({ min: 0, max: 0xffffffff }), (ctx, seed, choices) => {
        const run = play(ctx, seed, randomPolicy(ctx, choices));
        checkConservation(run);
        checkExclusivity(run);
        checkRoundTiming(run);
        checkResumption(run, ctx);
      }),
      { numRuns: 60 },
    );
  }, 30_000); // sixty whole games: well past the 5-second default under a busy machine
});
