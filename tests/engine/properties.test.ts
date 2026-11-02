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
  });
});
