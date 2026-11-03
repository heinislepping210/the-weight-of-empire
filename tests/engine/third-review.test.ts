// Regression tests for the third independent review of f489efb (docs/reviews/2026-11-02-third-review.md).
// Each failed on rules 0.17.2 and reproduces the reviewer's own case where it gave one.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, evaluate, newGame, slotIndexOf, statusOf } from '../../src/engine';
import type { BattleState, Context, GameState, KeyDecision, LogEntry, ScenarioDef, Side } from '../../src/engine';
import { decideRound } from '../../src/engine/ai';
import { allInReserve, exitStateFor, resolveRound, retreatOfSide } from '../../src/engine/battle';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { forceInit, holdStill, idleField, testGround } from '../fixtures/testGround';
import { botsWithSupply } from '../balance/bots';

type Adjust = (d: ScenarioDef) => void;

/** The reviewer's fixture: the Russian main army at B with the French main body, a battle from the first sub-step. */
function ground(adjust: Adjust = () => {}): Context {
  return createContext(
    testGround((d) => {
      Object.assign(forceInit(d, 'ru-main'), { at: 'B', cavalry: 0 });
      adjust(d);
    }),
    RULES,
    { russianCommand: holdStill },
  );
}

function first(ctx: Context): GameState {
  let r = advance(newGame(ctx, 1), { kind: 'orders', turn: 1, orders: [] }, ctx);
  if (!r.ok) throw new Error(r.reason);
  const st = r.status as { battleId: string; round: number };
  r = advance(r.state, { kind: 'battle', battleId: st.battleId, round: st.round, decision: { kind: 'deploy' } }, ctx);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

const battleOf = (s: GameState) => Object.values(s.battles)[0] as BattleState;
const breakOff: KeyDecision = { kind: 'breakOff' };
const holdAll: KeyDecision = { kind: 'holdAll' };

function round(s: GameState, ctx: Context, decisions: Record<Side, KeyDecision>): { s: GameState; b: BattleState; log: LogEntry[] } {
  const next = structuredClone(s);
  const b = battleOf(next);
  const log: LogEntry[] = [];
  resolveRound(next, ctx, b, decisions, log);
  return { s: next, b, log };
}

describe('1. a beaten side falls back along its line, together (your decisions)', () => {
  it('a defender falls back towards its base, not towards a detachment standing off its line', () => {
    // The Russians at B defend; their base is their depot at F, by way of C; their Cossack post holds E.
    const ctx = ground();
    const s = first(ctx);
    battleOf(s).attacker = 'fr';
    const after = round(s, ctx, { fr: holdAll, ru: breakOff });
    expect(after.s.forces['ru-main']!.transit?.to).toBe('C');
  });

  it('with no base it can reach, it falls back towards its own troops', () => {
    const ctx = ground((d) => (d.depots = d.depots.filter((x) => x.side === 'fr')));
    const s = first(ctx);
    battleOf(s).attacker = 'fr';
    const after = round(s, ctx, { fr: holdAll, ru: breakOff });
    expect(after.s.forces['ru-main']!.transit?.to).toBe('E');
  });

  it('an attacker goes back the way its main body came, and every corps of the side takes that road', () => {
    const ctx = ground((d) => {
      Object.assign(forceInit(d, 'ru-post'), { at: 'B', men: 3_500 });
    });
    const s = first(ctx);
    battleOf(s).attacker = 'ru';
    s.forces['ru-main']!.cameFrom = 'E';
    s.forces['ru-post']!.cameFrom = 'C';
    const after = round(s, ctx, { fr: holdAll, ru: breakOff });
    expect(after.s.forces['ru-main']!.transit?.to).toBe('E');
    expect(after.s.forces['ru-post']!.transit?.to).toBe('E');
  });

  it('seed 13: founding a depot elsewhere does not pull a retreat off its line', () => {
    const ctx = createContext(vitebskDecision());
    const run = play(ctx, 13, botsWithSupply('forward')['pinning-attack']!(ctx), 5_000, 13);
    let checked = 0;
    for (const z of run.states) {
      const st = statusOf(z);
      if (st.kind !== 'awaitingBattleInput' || st.step !== 'nightfall') continue;
      const b = z.battles[st.battleId]!;
      const without = structuredClone(z);
      for (const node of Object.keys(without.depots)) if (without.depots[node]!.side === 'fr' && node !== 'vitebsk' && node !== 'orsha') delete without.depots[node];
      expect(retreatOfSide(without, ctx, without.battles[b.id]!, 'fr')?.to, `turn ${z.resolution.turn} at ${b.node}`).toBe(retreatOfSide(z, ctx, b, 'fr')?.to);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('in a two-sided departure each side\'s road is fixed before either moves', () => {
    const ctx = ground();
    const s = first(ctx);
    const b = battleOf(s);
    const expected = (['fr', 'ru'] as const).map((side) => retreatOfSide(s, ctx, b, side)?.to);
    const after = round(s, ctx, { fr: breakOff, ru: breakOff });
    expect([after.s.forces['fr-main']!.transit?.to, after.s.forces['ru-main']!.transit?.to]).toEqual(expected);
  });
});

describe('2. when both sides break off, both leave at once (your decision)', () => {
  /** Each side's exit open, or contested by a ford on the road to its base: A for the French, C (towards F) for the Russians. */
  const exits = (russianFord: boolean, frenchFord: boolean) =>
    ground((d) => {
      if (russianFord) d.edges.find((e) => e.id === 'B-C')!.crossing = 'ford';
      if (frenchFord) d.edges.find((e) => e.id === 'A-B')!.crossing = 'ford';
    });

  for (const [russianFord, frenchFord] of [[false, false], [true, false], [false, true], [true, true]] as const) {
    it(`French ${frenchFord ? 'contested' : 'open'}, Russians ${russianFord ? 'contested' : 'open'}: both leave without a round of fighting, each at its own road's cost`, () => {
      const ctx = exits(russianFord, frenchFord);
      const s = first(ctx);
      const b = battleOf(s);
      expect([exitStateFor(s, ctx, b, 'fr'), exitStateFor(s, ctx, b, 'ru')]).toEqual([frenchFord ? 'contested' : 'open', russianFord ? 'contested' : 'open']);
      const after = round(s, ctx, { fr: breakOff, ru: breakOff });
      expect(after.log.some((e) => e.kind === 'sectors')).toBe(false);
      expect(after.b.field.result).toEqual({ fr: 'withdrew', ru: 'withdrew' });
      const rate = (side: Side, ford: boolean) => Math.floor((s.forces[`${side}-main`]!.men * RULES.battle.rearguardPermille[ford ? 'contested' : 'open']) / 1000);
      expect(s.forces['fr-main']!.men - after.s.forces['fr-main']!.men).toBe(rate('fr', frenchFord));
      expect(s.forces['ru-main']!.men - after.s.forces['ru-main']!.men).toBe(rate('ru', russianFord));
    });
  }

  it('the two do not march off down one road together: the side going back the way it came keeps it', () => {
    // Found measuring the retreat rule (rush, seed 498): both sides left Smolensk's north bank for Rudnia.
    const ctx = ground((d) => (d.forces = d.forces.filter((f) => f.id !== 'fr-flank')));
    const s = first(ctx);
    const b = battleOf(s);
    b.attacker = 'ru';
    s.forces['ru-main']!.cameFrom = 'A';
    // Alone, each would fall back to A: the Russians the way they came, the French towards their base, the depot there.
    expect([retreatOfSide(s, ctx, b, 'fr')?.to, retreatOfSide(s, ctx, b, 'ru')?.to]).toEqual(['A', 'A']);
    const turned = retreatOfSide(s, ctx, b, 'fr', 'A')!.to;
    const cost = Math.floor((s.forces['fr-main']!.men * RULES.battle.rearguardPermille[exitStateFor(s, ctx, b, 'fr', turned) === 'contested' ? 'contested' : 'open']) / 1000);
    const after = round(s, ctx, { fr: breakOff, ru: breakOff });
    expect(after.s.forces['ru-main']!.transit?.to).toBe('A');
    expect(after.s.forces['fr-main']!.transit?.to).toBe(turned);
    expect(turned).not.toBe('A');
    // The French pay the cost of the road they take.
    expect(s.forces['fr-main']!.men - after.s.forces['fr-main']!.men).toBe(cost);
    expect(after.log.find((e) => e.kind === 'fieldResult' && e.detail.side === 'fr')?.detail).toMatchObject({ to: turned, aside: true });
  });

  it('one side breaking off by a contested road still fights its round of falling back', () => {
    const ctx = exits(true, false);
    const after = round(first(ctx), ctx, { fr: holdAll, ru: breakOff });
    expect(after.log.some((e) => e.kind === 'sectors')).toBe(true);
    expect(after.b.field.result.ru).toBe('withdrew');
  });
});

describe('3. standing with an empty line: the reserve counter-attacks', () => {
  /** The reviewer's fixture: the French standing at cohesion 900, every sector lost, all troops in reserve. */
  function emptyLine(controls: [number, number, number]) {
    const ctx = ground();
    const s = first(ctx);
    const b = battleOf(s);
    const f = s.forces['fr-main']!;
    Object.assign(f, { engagement: 'stand', cohesion: 900 });
    b.field.control = controls;
    b.field.positionLost = ['fr'];
    b.field.alloc[f.id] = allInReserve(f);
    return { ctx, s, b, f };
  }

  it('the marshal sends the reserve in rather than waiting with nobody in the line', () => {
    const { ctx, s, b } = emptyLine([-2, -2, -2]);
    expect(decideRound(s, ctx, b, 'fr')).toEqual({ kind: 'commitReserve', sector: 0 });
  });

  it('delegated, the battle makes tactical progress or records a departure within four rounds', () => {
    for (const controls of [[-2, -2, -2], [-1, -2, -2]] as [number, number, number][]) {
      const { ctx, s, b, f } = emptyLine(controls);
      let progressed = false;
      for (let i = 0; i < 4 && b.phase !== 'over' && !progressed; i++) {
        resolveRound(s, ctx, b, { fr: decideRound(s, ctx, b, 'fr'), ru: decideRound(s, ctx, b, 'ru') }, []);
        progressed = (b.losses[f.id] ?? 0) > 0 || b.field.control.join() !== controls.join();
      }
      expect(progressed || b.phase === 'over', `controls ${controls}`).toBe(true);
    }
  });
});

describe('4. only cavalry that has deployed pursues or screens', () => {
  /** The reviewer's fixture: the flank corps in the French reserve with 10,000 cavalry, the only French horse. */
  function withFlank(delay: number) {
    const ctx = ground((d) => {
      Object.assign(forceInit(d, 'fr-main'), { cavalry: 0 });
      Object.assign(forceInit(d, 'fr-flank'), { cavalry: 10_000, horses: 12_000 });
    });
    const s = first(ctx);
    const b = battleOf(s);
    const f = s.forces['fr-flank']!;
    Object.assign(f, { at: 'B', battle: b.id });
    b.sides.fr.push(f.id);
    b.field.alloc[f.id] = allInReserve(f);
    b.fightsFrom[f.id] = slotIndexOf(s.resolution) + delay;
    const after = round(s, ctx, { fr: holdAll, ru: breakOff });
    return Number(after.log.find((e) => e.kind === 'pursuit')?.detail.men ?? 0);
  }

  it('cavalry one sub-step short of deploying does not pursue; the same cavalry deployed does', () => {
    expect(withFlank(0)).toBeGreaterThan(0);
    expect(withFlank(1)).toBe(0);
  });
});

describe('5. battle losses are counted when they happen, not on the day a battle began (second review, D4)', () => {
  const ctx = createContext(vitebskDecision(), RULES, { russianCommand: holdStill });
  const start = newGame(ctx, 1812);
  const mainStart = start.forces['ru-1st']!.men + start.forces['ru-2nd']!.men;
  /** A finished battle the French won and the Russians broke in, begun on `beganDay`, its losses on the given days. */
  function battle(id: string, beganDay: number, lossesByDay: Record<number, number>): BattleState {
    const lossesAt: Record<string, Record<string, number>> = {};
    let total = 0;
    for (const [day, lost] of Object.entries(lossesByDay)) {
      lossesAt[String(Number(day) * 2)] = { 'ru-1st': lost };
      total += lost;
    }
    return {
      id, node: 'smolensk-north', attacker: 'fr', sides: { fr: ['fr-vanguard'], ru: ['ru-1st', 'ru-2nd'] }, phase: 'over',
      startsAt: { turn: Math.floor(beganDay / 2) + 1, slot: beganDay % 2 === 0 ? 0 : 2 }, fightsFrom: {}, roundsFought: 9, roundsThisSlot: 0,
      awaiting: null, hidden: null, lastNight: beganDay, winner: 'fr', losses: { 'ru-1st': total }, lossesAt, routed: ['ru'], field: idleField(),
    };
  }
  const judged = (battles: BattleState[]) => {
    const s = structuredClone(start);
    s.ended = 'scenarioEnd';
    for (const b of battles) {
      s.battles[b.id] = b;
      s.forces['ru-1st']!.men -= b.losses['ru-1st'] ?? 0;
    }
    return evaluate(start, s, ctx).russian;
  };

  it('a long battle begun early still counts the losses of its last days with a battle that follows', () => {
    const lost = Math.floor(mainStart * 0.17);
    // Begun on day 0 but fought out on day 4; the next battle on day 6: within four days of each other.
    expect(judged([battle('a', 0, { 4: lost }), battle('b', 6, { 6: lost })])).toBe('decisivelyDefeated');
  });

  it('losses spread over more than four days still are not a decisive defeat', () => {
    const lost = Math.floor(mainStart * 0.17);
    expect(judged([battle('a', 0, { 0: lost }), battle('b', 6, { 6: lost })])).not.toBe('decisivelyDefeated');
  });

  it('every battle\'s losses by sub-step add up to its losses by force, in a played campaign', () => {
    const run = play(ctx, 7, botsWithSupply('forward')['southern-envelopment-hold']!(ctx), 5_000);
    for (const b of Object.values(run.final.battles)) {
      const summed: Record<string, number> = {};
      for (const at of Object.values(b.lossesAt)) for (const [id, n] of Object.entries(at)) summed[id] = (summed[id] ?? 0) + n;
      expect(summed, b.id).toEqual(Object.fromEntries(Object.entries(b.losses).filter(([, n]) => n > 0)));
    }
  });
});
