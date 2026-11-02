// Contacts between forces (§3.4a step 4): reinforcements, opposing columns on one road, retreats that
// take time, and the halt. Regression tests for the independent review of 31 October 2026.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, statusOf, submit } from '../../src/engine';
import type { Context, GameState, GroupOrder, LogEntry } from '../../src/engine';
import { inputFor, stepUntil, type Policy } from '../fixtures/driver';
import { contactViolations } from '../fixtures/invariants';
import { forceInit, holdStill, testGround } from '../fixtures/testGround';
import type { ScenarioDef } from '../../src/engine';

/** Russians held still, except for routes given here (turn → force → route). */
function withRussianRoutes(scenario: ScenarioDef, routes: Record<number, Record<string, string[]>> = {}): Context {
  return createContext(scenario, RULES, {
    russianCommand: (s: GameState) => {
      holdStill(s);
      for (const [id, route] of Object.entries(routes[s.resolution.turn] ?? {})) s.forces[id]!.route = [...route];
    },
  });
}

function ordered(s: GameState, ctx: Context, orders: GroupOrder[], halt = false): GameState {
  const result = submit(s, { kind: 'orders', turn: s.resolution.turn, orders, ...(halt ? { halt: true } : {}) }, ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

/** Plays through pauses with a policy, keeping every pause and the log, until `until` holds. */
function playUntil(ctx: Context, start: GameState, policy: Policy, until: (s: GameState) => boolean, limit = 300): { states: GameState[]; log: LogEntry[] } {
  const states = [start];
  const log: LogEntry[] = [];
  let s = start;
  for (let i = 0; i < limit && !until(s); i++) {
    const r = advance(s, inputFor(s, statusOf(s), policy), ctx);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
    states.push(s);
    log.push(...r.log);
  }
  if (!until(s)) throw new Error('condition never reached');
  return { states, log };
}

const holdAndStay = (orders: (turn: number) => GroupOrder[] = () => []): Policy => ({ orders: (_s, turn) => orders(turn), round: () => 'hold', nightfall: () => 'stay' });
const roundPause = (slot: number) => (s: GameState) => statusOf(s).kind === 'awaitingBattleInput' && statusOf(s).kind !== 'ended' && s.resolution.slot === slot && (statusOf(s) as { step: string }).step === 'round';

describe('reinforcements (§3.4a step 4)', () => {
  /** A battle at B from the first sub-step; the flank marches in from G and reaches B on the second morning. */
  const ground = (routes?: Record<number, Record<string, string[]>>) =>
    withRussianRoutes(
      testGround((s) => {
        forceInit(s, 'ru-main').at = 'B';
        forceInit(s, 'fr-flank').at = 'G';
      }),
      routes,
    );

  it('a French force arriving at a battle joins it at the end of the sub-step and fights from the next', () => {
    const ctx = ground();
    const policy = holdAndStay((turn) => (turn === 1 ? [{ force: 'fr-flank', route: ['A', 'B'], pace: 'steady' }] : []));
    const { states, log } = playUntil(ctx, newGame(ctx, 11), policy, roundPause(2));
    const s = states[states.length - 1]!;
    const battle = Object.values(s.battles)[0]!;
    expect(s.forces['fr-flank']).toMatchObject({ at: 'B', transit: null, battle: battle.id });
    expect(battle.sides.fr).toEqual(['fr-main', 'fr-flank']);
    expect(log.some((e) => e.kind === 'reinforced' && e.detail.force === 'fr-flank' && e.slot === 2)).toBe(true);

    // Arrived during the morning: no losses, ammunition or fatigue from the morning's rounds, only its march…
    const joined = structuredClone(s.forces['fr-flank']!);
    const { marchSteady, fightRound } = RULES.fatigue;
    const later = playUntil(ctx, s, policy, roundPause(3)).states.at(-1)!;
    expect(Object.values(later.battles)[0]!.roundsFought).toBeGreaterThan(battle.roundsFought);
    expect(later.forces['fr-flank']).toMatchObject({ men: joined.men, fatigue: joined.fatigue + marchSteady, stock: { ammo: joined.stock.ammo } });
    // …and it fights from the afternoon.
    const after = playUntil(ctx, later, policy, (x) => x.resolution.slot === 3 && Object.values(x.battles)[0]!.roundsFought > Object.values(later.battles)[0]!.roundsFought).states.at(-1)!;
    expect(after.forces['fr-flank']!.fatigue).toBe(joined.fatigue + marchSteady + fightRound);
  });

  it('a Russian force arriving at a battle joins the Russian side', () => {
    const ctx = ground({ 1: { 'ru-post': ['B'] } });
    const { states } = playUntil(ctx, newGame(ctx, 11), holdAndStay(), roundPause(2));
    const s = states.at(-1)!;
    const battle = Object.values(s.battles)[0]!;
    expect(s.forces['ru-post']).toMatchObject({ at: 'B', battle: battle.id });
    expect(battle.sides.ru).toContain('ru-post');
  });

  it('no force is left standing outside a battle at its place, at any pause', () => {
    const ctx = ground({ 1: { 'ru-post': ['B'] } });
    const policy = holdAndStay((turn) => (turn === 1 ? [{ force: 'fr-flank', route: ['A', 'B'], pace: 'steady' }] : []));
    const { states } = playUntil(ctx, newGame(ctx, 11), policy, (s) => s.ended !== null);
    for (const s of states) expect(contactViolations(s)).toEqual([]);
  });
});

describe('opposing columns on one road', () => {
  it('two columns marching towards each other on one road meet instead of passing through', () => {
    const ctx = withRussianRoutes(
      testGround((s) => {
        forceInit(s, 'ru-post').at = 'B';
        forceInit(s, 'fr-main').at = 'G';
      }),
      { 1: { 'ru-post': ['A'] } },
    );
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = stepUntil(ordered(newGame(ctx, seed), ctx, [{ force: 'fr-flank', route: ['B'] }]), ctx, (x) => x.resolution.slot === 0 && x.resolution.stage === 'contacts');
      const fr = s.forces['fr-flank']!;
      const ru = s.forces['ru-post']!;
      // Whoever got onto the road first marched on; the other held its place, and they now stand together.
      expect(fr.transit === null && ru.transit === null && fr.at === ru.at, `seed ${seed}`).toBe(true);
      expect(contactViolations(s)).toEqual([]);
    }
  });

  it('a column cannot set out along a road on which an enemy column is coming the other way', () => {
    const ctx = withRussianRoutes(
      testGround((s) => {
        forceInit(s, 'ru-post').at = 'C';
        forceInit(s, 'fr-main').at = 'G';
      }),
      { 1: { 'ru-post': ['B'] } },
    );
    const start = newGame(ctx, 3);
    Object.assign(start.forces['fr-flank']!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres: 5_000, seq: 0 } });
    let s = stepUntil(ordered(start, ctx, [{ force: 'fr-flank', route: ['C'] }]), ctx, (x) => x.resolution.slot === 0 && x.resolution.stage === 'contacts');
    expect(s.forces['ru-post']).toMatchObject({ at: 'C', transit: null });
    expect(s.forces['fr-flank']!.transit?.to).toBe('C');
    s = stepUntil(s, ctx, (x) => x.resolution.slot === 1 && x.resolution.stage === 'contacts');
    expect(s.forces['fr-flank']).toMatchObject({ at: 'C', transit: null });
    expect(s.forces['ru-post']!.at).toBe('C');
  });

  it('a column cannot overtake an enemy column ahead of it on the same road', () => {
    const ctx = withRussianRoutes(
      testGround((s) => {
        forceInit(s, 'fr-main').at = 'G';
      }),
      { 1: { 'ru-post': ['C'] } },
    );
    const start = newGame(ctx, 3);
    start.roadSeq = 1; // the Russian column below set out first
    Object.assign(start.forces['ru-post']!, { at: 'B', transit: { edge: 'B-C', to: 'C', metres: 2_000, seq: 0 } });
    Object.assign(start.forces['fr-flank']!, { at: 'B' });
    const s = stepUntil(ordered(start, ctx, [{ force: 'fr-flank', route: ['C'], pace: 'forced' }]), ctx, (x) => x.resolution.slot === 0 && x.resolution.stage === 'contacts');
    const fr = s.forces['fr-flank']!;
    const ru = s.forces['ru-post']!;
    expect(fr.transit?.edge).toBe('B-C');
    expect(ru.transit?.edge).toBe('B-C');
    expect(fr.transit!.metres).toBeLessThanOrEqual(ru.transit!.metres);
  });
});

describe('retreats take time', () => {
  it('a force that withdraws before battle falls back along the road, and arrives later', () => {
    const ctx = withRussianRoutes(testGround((s) => (forceInit(s, 'ru-main').at = 'B')));
    for (let seed = 0; seed < 40; seed++) {
      const s = stepUntil(ordered(newGame(ctx, seed), ctx, [{ force: 'fr-main', engagement: 'avoid' }]), ctx, (x) => x.resolution.stage === 'battleRounds');
      const f = s.forces['fr-main']!;
      if (f.battle !== null) continue;
      // Left the field, but on the road, not already at A.
      expect(f).toMatchObject({ at: 'B', transit: { to: 'A', metres: 0 } });
      const next = stepUntil(s, ctx, (x) => x.resolution.slot === 1 && x.resolution.stage === 'contacts');
      expect(next.forces['fr-main']).toMatchObject({ at: 'A', transit: null });
      return;
    }
    throw new Error('no successful withdrawal in 40 seeds');
  });
});

describe('a beaten attacker falls back the way it came (D-042)', () => {
  /**
   * The French hold B in strength; a Russian army marches from A through B towards C, D and its depot at F,
   * as the Russians at Smolensk marched for the Moscow road past a French block. Beaten at B, it must fall
   * back towards A, not on along the road to its depot through the French it attacked.
   */
  it('a Russian army repulsed by a French block does not escape through it', () => {
    const ctx = withRussianRoutes(
      testGround((s) => {
        s.depots = s.depots.filter((d) => d.side === 'ru');
        forceInit(s, 'fr-flank').at = 'B';
        Object.assign(forceInit(s, 'ru-main'), { at: 'A', men: 40_000 });
        s.convoys = [];
      }),
      { 1: { 'ru-main': ['B', 'C', 'D', 'F'] } },
    );
    const policy = holdAndStay();
    let retreats = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { log } = playUntil(ctx, newGame(ctx, seed), policy, (s) => s.ended !== null || Object.values(s.battles).some((b) => b.phase === 'over'));
      const retreat = log.find((e) => e.kind === 'retreated' && e.detail.force === 'ru-main');
      if (!retreat) continue;
      retreats++;
      expect(retreat.detail.to, `seed ${seed}`).toBe('A');
    }
    expect(retreats).toBeGreaterThan(0);
  });
});

describe('the halt', () => {
  it('stops every standing march, including groups given no new orders', () => {
    const ctx = withRussianRoutes(testGround());
    let s = ordered(newGame(ctx, 1), ctx, [{ force: 'fr-flank', route: ['B', 'C'], pace: 'rest' }]);
    s = stepUntil(s, ctx, (x) => x.resolution.stage === 'orders' && x.resolution.turn === 2);
    s = ordered(s, ctx, [{ force: 'fr-flank', pace: 'steady' }], true);
    expect(s.forces['fr-flank']!.route).toEqual([]);
    s = stepUntil(s, ctx, (x) => x.resolution.stage === 'orders' && x.resolution.turn === 3);
    expect(s.forces['fr-flank']!.at).toBe('A');
  });
});
