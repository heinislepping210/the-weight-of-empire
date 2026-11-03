// Sector battles (§2.10): the contracts of TECHNICAL_ARCHITECTURE §3.4b, written before the combat code.
// A: every soldier and gun counted once. B: a round resolves simultaneously. C: four results kept apart.
// D: escape follows the operational situation. The combat values are placeholders; these rules are not.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, newGame, stateHash, statusOf } from '../../src/engine';
import type { BattleDecision, BattleState, Context, GameState, KeyDecision, LogEntry, Rules, ScenarioDef, Side } from '../../src/engine';
import { decideRound } from '../../src/engine/ai';
import { allocationTotals, effectiveCavalry, exitStateFor, keyLabel, resolveRound } from '../../src/engine/battle';
import { loseMen } from '../../src/engine/util';
import { play, randomPolicy } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { forceInit, holdStill, testGround } from '../fixtures/testGround';

type Adjust = (d: ScenarioDef) => void;

/** The test ground with the Russian main army at B, where the French main body stands: a battle from the first sub-step. */
function ground(adjust: Adjust = () => {}, rules: Rules = RULES): Context {
  const sc = testGround((d) => {
    forceInit(d, 'ru-main').at = 'B';
    Object.assign(forceInit(d, 'fr-main'), { cavalry: 9_000, guns: 60, horses: 12_000 });
    Object.assign(forceInit(d, 'ru-main'), { cavalry: 8_250, guns: 60, horses: 12_000 });
    adjust(d);
  });
  return createContext(sc, rules, { russianCommand: holdStill });
}

const withBattle = (over: Record<string, unknown>): Rules => ({ ...RULES, battle: { ...RULES.battle, ...over } }) as unknown as Rules;

function go(s: GameState, input: Parameters<typeof advance>[1], ctx: Context) {
  const r = advance(s, input, ctx);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

function decide(s: GameState, decision: BattleDecision) {
  const st = statusOf(s);
  if (st.kind !== 'awaitingBattleInput') throw new Error(`no battle decision is awaited (${st.kind})`);
  return { kind: 'battle' as const, battleId: st.battleId, round: st.round, decision };
}

/** The game at the first round's pause, after the deployment. */
function firstRound(ctx: Context, seed = 1, deploy: BattleDecision = { kind: 'deploy' }): { s: GameState; b: BattleState } {
  let r = go(newGame(ctx, seed), { kind: 'orders', turn: 1, orders: [] }, ctx);
  expect(r.status).toMatchObject({ kind: 'awaitingBattleInput', step: 'deploy' });
  r = go(r.state, decide(r.state, deploy), ctx);
  expect(r.status).toMatchObject({ kind: 'awaitingBattleInput', step: 'round' });
  return { s: r.state, b: Object.values(r.state.battles)[0]! };
}

/** One round resolved directly, with both sides' decisions given: no marshal involved. */
function round(s: GameState, ctx: Context, decisions: Record<Side, KeyDecision>): { s: GameState; b: BattleState; log: LogEntry[] } {
  const next = structuredClone(s);
  const b = Object.values(next.battles)[0]!;
  b.awaiting = null;
  b.hidden = null;
  const log: LogEntry[] = [];
  resolveRound(next, ctx, b, decisions, log);
  return { s: next, b, log };
}

const holdAll: KeyDecision = { kind: 'holdAll' };
const pressAll: KeyDecision = { kind: 'pressAll' };
const breakOff: KeyDecision = { kind: 'breakOff' };
const none = { inf: 0, cav: 0, guns: 0 };

describe('A. every soldier and gun counted once', () => {
  it('at deployment each force is allocated whole: infantry, cavalry and guns, across the sectors and the reserve', () => {
    const ctx = ground();
    const { s, b } = firstRound(ctx);
    for (const id of [...b.sides.fr, ...b.sides.ru]) {
      const f = s.forces[id]!;
      expect(allocationTotals(b.field.alloc[id]!), id).toEqual({ inf: f.men - f.cavalry, cav: f.cavalry, guns: f.guns });
    }
  });

  it('losses outside the fighting come off every arm in proportion, and the allocation follows at once', () => {
    const ctx = ground();
    const { s, b } = firstRound(ctx);
    const f = s.forces['fr-main']!;
    const before = { men: f.men, cavalry: f.cavalry };
    loseMen(s, f, 6_000, 'sickness');
    expect(f.men).toBe(before.men - 6_000);
    expect(Math.abs(before.cavalry - f.cavalry - Math.round((6_000 * before.cavalry) / before.men))).toBeLessThanOrEqual(1);
    expect(allocationTotals(b.field.alloc['fr-main']!)).toEqual({ inf: f.men - f.cavalry, cav: f.cavalry, guns: f.guns });
  });

  it("a sector's casualties come out of the troops allocated there", () => {
    const ctx = ground();
    const { s } = firstRound(ctx);
    const b = Object.values(s.battles)[0]!;
    const fr = s.forces['fr-main']!;
    const ru = s.forces['ru-main']!;
    // French cavalry alone in the first sector, French infantry in the second; the Russians all in the second.
    b.field.alloc['fr-main'] = { sectors: [{ inf: 0, cav: fr.cavalry, guns: 0 }, { inf: fr.men - fr.cavalry, cav: 0, guns: fr.guns }, { ...none }], reserve: { ...none } };
    b.field.alloc['ru-main'] = { sectors: [{ ...none }, { inf: ru.men - ru.cavalry, cav: ru.cavalry, guns: ru.guns }, { ...none }], reserve: { ...none } };
    const after = round(s, ctx, { fr: holdAll, ru: pressAll });
    expect(after.s.forces['fr-main']!.cavalry).toBe(fr.cavalry);
    expect(after.s.forces['fr-main']!.men).toBeLessThan(fr.men);
    expect(after.b.field.alloc['fr-main']!.sectors[0]).toEqual({ inf: 0, cav: fr.cavalry, guns: 0 });
  });

  it('cavalry fights only as far as it has mounts, after the gun teams', () => {
    const ctx = ground();
    const { s } = firstRound(ctx);
    const f = structuredClone(s.forces['fr-main']!);
    Object.assign(f, { cavalry: 9_000, horses: 1_000, guns: 0 });
    expect(effectiveCavalry(f, ctx.rules)).toBe(1_000);
    Object.assign(f, { guns: 100 });
    expect(effectiveCavalry(f, ctx.rules)).toBe(Math.max(0, 1_000 - 100 * ctx.rules.battle.horsesPerGun));
    Object.assign(f, { horses: 50_000, guns: 0 });
    expect(effectiveCavalry(f, ctx.rules)).toBe(9_000);
  });

  it('a cavalryman lost in battle costs a horse, recorded as a loss', () => {
    const ctx = ground();
    const { s } = firstRound(ctx);
    const b = Object.values(s.battles)[0]!;
    const fr = s.forces['fr-main']!;
    const ru = s.forces['ru-main']!;
    b.field.alloc['fr-main'] = { sectors: [{ inf: 0, cav: fr.cavalry, guns: 0 }, { ...none }, { ...none }], reserve: { inf: fr.men - fr.cavalry, cav: 0, guns: fr.guns } };
    b.field.alloc['ru-main'] = { sectors: [{ inf: ru.men - ru.cavalry, cav: ru.cavalry, guns: ru.guns }, { ...none }, { ...none }], reserve: { ...none } };
    const after = round(s, ctx, { fr: holdAll, ru: pressAll });
    const lost = fr.cavalry - after.s.forces['fr-main']!.cavalry;
    expect(lost).toBeGreaterThan(0);
    expect(fr.horses - after.s.forces['fr-main']!.horses).toBe(lost);
    expect(after.s.ledger.horsesLost - s.ledger.horsesLost).toBeGreaterThanOrEqual(lost);
  });

  it('guns in a sector that falls are partly captured, and the books record it', () => {
    const ctx = ground();
    const { s } = firstRound(ctx);
    const b = Object.values(s.battles)[0]!;
    const fr = s.forces['fr-main']!;
    const ru = s.forces['ru-main']!;
    b.field.control = [1, 0, 0];
    b.field.alloc['fr-main'] = { sectors: [{ inf: fr.men - fr.cavalry, cav: fr.cavalry, guns: fr.guns }, { ...none }, { ...none }], reserve: { ...none } };
    b.field.alloc['ru-main'] = { sectors: [{ inf: 500, cav: 0, guns: 30 }, { inf: ru.men - ru.cavalry - 500, cav: ru.cavalry, guns: ru.guns - 30 }, { ...none }], reserve: { ...none } };
    const after = round(s, ctx, { fr: pressAll, ru: holdAll });
    expect(after.b.field.control[0]).toBe(2);
    const captured = after.s.ledger.gunsLost.captured - s.ledger.gunsLost.captured;
    expect(captured).toBe(Math.floor((30 * ctx.rules.battle.gunsCapturedPermille) / 1000));
    expect(after.s.forces['ru-main']!.guns).toBe(ru.guns - captured);
    expect(allocationTotals(after.b.field.alloc['ru-main']!).guns).toBe(ru.guns - captured);
  });

  it('a reinforcement enters the reserve, and cannot be committed before it has deployed', () => {
    const ctx = ground((d) => {
      forceInit(d, 'fr-flank').at = 'G';
    });
    let r = go(newGame(ctx, 2), { kind: 'orders', turn: 1, orders: [{ force: 'fr-flank', route: ['A', 'B'], pace: 'forced' }] }, ctx);
    r = go(r.state, decide(r.state, { kind: 'deploy' }), ctx);
    // Hold every round until the flank has joined the battle.
    for (let i = 0; i < 40 && !Object.values(r.state.battles)[0]!.sides.fr.includes('fr-flank'); i++) {
      const st = statusOf(r.state);
      const input = st.kind === 'awaitingOrders' ? { kind: 'orders' as const, turn: st.turn, orders: [] } : decide(r.state, st.kind === 'awaitingBattleInput' && st.step === 'nightfall' ? { kind: 'nightfall', choice: 'stay' } : st.kind === 'awaitingBattleInput' && st.step === 'deploy' ? { kind: 'deploy' } : { kind: 'round', key: holdAll });
      r = go(r.state, input, ctx);
    }
    const b = Object.values(r.state.battles)[0]!;
    expect(b.sides.fr).toContain('fr-flank');
    const flank = r.state.forces['fr-flank']!;
    expect(b.field.alloc['fr-flank']).toEqual({ sectors: [{ ...none }, { ...none }, { ...none }], reserve: { inf: flank.men - flank.cavalry, cav: flank.cavalry, guns: flank.guns } });
    const now = (r.state.resolution.turn - 1) * 4 + r.state.resolution.slot;
    expect(b.fightsFrom['fr-flank']).toBeGreaterThan(now);
    const after = round(r.state, ctx, { fr: { kind: 'commitReserve', sector: 1 }, ru: holdAll });
    expect(after.b.field.alloc['fr-flank']!.sectors[1]).toEqual(none);
    // The main body's reserve, deployed from the start, does go in.
    expect(after.b.field.alloc['fr-main']!.reserve).toEqual(none);
  });
});

describe('B. a round resolves simultaneously', () => {
  it('the losses a side suffers do not depend on the losses it inflicts in the same round', () => {
    for (const [presser, holder] of [['fr', 'ru'], ['ru', 'fr']] as const) {
      const results = [20, 40].map((press) => {
        const ctx = ground(() => {}, withBattle({ hitPermille: { ...RULES.battle.hitPermille, press } }));
        const { s } = firstRound(ctx);
        const decisions = { [presser]: pressAll, [holder]: holdAll } as Record<Side, KeyDecision>;
        const after = round(s, ctx, decisions);
        const lost = (side: Side) => s.forces[`${side}-main`]!.men - after.s.forces[`${side}-main`]!.men;
        return { presser: lost(presser), holder: lost(holder) };
      });
      // A harder-hitting presser inflicts more, but suffers exactly the same.
      expect(results[1]!.holder).toBeGreaterThan(results[0]!.holder);
      expect(results[1]!.presser).toBe(results[0]!.presser);
    }
  });

  it("no marshal reads the other side's current decision; the Russian one is fixed at the pause", () => {
    const ctx = ground();
    const { s, b } = firstRound(ctx);
    expect(b.hidden).not.toBeNull();
    const asIs = decideRound(s, ctx, b, 'fr');
    for (const hidden of [holdAll, pressAll, breakOff, { kind: 'continue' }, { kind: 'commitReserve', sector: 2 }] as KeyDecision[]) {
      const probe = structuredClone(s);
      const pb = probe.battles[b.id]!;
      pb.hidden = hidden;
      expect(decideRound(probe, ctx, pb, 'fr')).toEqual(asIs);
    }
    const r = go(s, decide(s, { kind: 'delegate' }), ctx);
    const entry = r.log.find((e) => e.kind === 'round');
    expect(entry?.detail.ru).toBe(keyLabel(b.hidden as KeyDecision));
  });

  it('ammunition is a side\'s real stock: never more spent than carried, and a shortage weakens the fire', () => {
    const run = (ammo: number) => {
      const ctx = ground((d) => {
        forceInit(d, 'fr-main').stock.ammo = ammo;
      });
      const { s } = firstRound(ctx);
      const after = round(s, ctx, { fr: pressAll, ru: holdAll });
      return { spent: after.s.ledger.ammoSpent.fr - s.ledger.ammoSpent.fr, left: after.s.forces['fr-main']!.stock.ammo, inflicted: s.forces['ru-main']!.men - after.s.forces['ru-main']!.men, had: s.forces['fr-main']!.stock.ammo };
    };
    const scarce = run(50);
    const ample = run(100_000);
    expect(scarce.spent).toBeLessThanOrEqual(scarce.had);
    expect(scarce.left).toBeGreaterThanOrEqual(0);
    expect(scarce.inflicted).toBeLessThan(ample.inflicted);
  });

  /** The Russians low on cohesion with an open road behind them: their marshal breaks off at once. */
  const breakingOff = (adjust: Adjust = () => {}) =>
    ground((d) => {
      forceInit(d, 'ru-main').cohesion = 340;
      adjust(d);
    });

  it('pursuit happens once, and saving and resuming at the pause gives the same result', () => {
    const ctx = breakingOff();
    const { s } = firstRound(ctx);
    const straight = go(s, decide(s, { kind: 'delegate' }), ctx);
    const resumed = go(JSON.parse(JSON.stringify(s)) as GameState, decide(s, { kind: 'delegate' }), ctx);
    expect(stateHash(resumed.state)).toBe(stateHash(straight.state));
    const pursuits = straight.log.filter((e) => e.kind === 'pursuit');
    expect(pursuits).toHaveLength(1);
    expect(Number(pursuits[0]!.detail.men)).toBeGreaterThan(0);
    const b = Object.values(straight.state.battles)[0]!;
    expect(b.field.pursued).toBe(true);
    // Play on: no second pursuit.
    let r = straight;
    const more: LogEntry[] = [];
    for (let i = 0; i < 20 && r.status.kind !== 'ended'; i++) {
      const st = statusOf(r.state);
      const input = st.kind === 'awaitingOrders' ? { kind: 'orders' as const, turn: st.turn, orders: [] } : decide(r.state, { kind: 'delegate' });
      r = go(r.state, input, ctx);
      more.push(...r.log);
    }
    expect(more.filter((e) => e.kind === 'pursuit' && e.detail.battle === b.id)).toHaveLength(0);
  });

  it('pursuit power is fresh, mounted cavalry: tired or unhorsed cavalry pursues weakly', () => {
    const pursuit = (adjust: Adjust) => {
      const ctx = breakingOff(adjust);
      const { s } = firstRound(ctx);
      const r = go(s, decide(s, { kind: 'delegate' }), ctx);
      return Number(r.log.find((e) => e.kind === 'pursuit')?.detail.men ?? 0);
    };
    const fresh = pursuit((d) => {
      forceInit(d, 'fr-main').fatigue = 100;
    });
    const tired = pursuit((d) => {
      forceInit(d, 'fr-main').fatigue = 900;
    });
    const unhorsed = pursuit((d) => {
      Object.assign(forceInit(d, 'fr-main'), { horses: 0 });
    });
    expect(fresh).toBeGreaterThan(tired);
    expect(unhorsed).toBe(0);
  });

  it('integers stay safe at the largest strengths', () => {
    const ctx = ground((d) => {
      for (const id of ['fr-main', 'ru-main']) Object.assign(forceInit(d, id), { men: 1_000_000, horses: 400_000, guns: 2_000, cavalry: 300_000, cohesion: 1000, stock: { food: 10_000_000, fodder: 1_000_000, ammo: 10_000_000 } });
    });
    let { s } = firstRound(ctx);
    for (let i = 0; i < 3 && Object.values(s.battles)[0]!.phase !== 'over'; i++) s = round(s, ctx, { fr: pressAll, ru: pressAll }).s;
    const unsafe: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'number' && !Number.isSafeInteger(v)) unsafe.push(`${path} = ${v}`);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk({ forces: s.forces, battles: s.battles, ledger: s.ledger }, 's');
    expect(unsafe).toEqual([]);
  });
});

describe('C. four results, kept apart', () => {
  /** French all in the first two sectors; the Russians thin there, their weight in the third and the reserve. */
  function thinRussianFlanks(ctx: Context) {
    const { s } = firstRound(ctx);
    const b = Object.values(s.battles)[0]!;
    const fr = s.forces['fr-main']!;
    const ru = s.forces['ru-main']!;
    b.field.control = [1, 1, 0];
    const half = Math.floor((fr.men - fr.cavalry) / 2);
    b.field.alloc['fr-main'] = { sectors: [{ inf: half, cav: fr.cavalry, guns: fr.guns }, { inf: fr.men - fr.cavalry - half, cav: 0, guns: 0 }, { ...none }], reserve: { ...none } };
    const rest = ru.men - ru.cavalry - 1_000;
    b.field.alloc['ru-main'] = { sectors: [{ inf: 500, cav: 0, guns: 0 }, { inf: 500, cav: 0, guns: 0 }, { inf: Math.floor(rest / 2), cav: 0, guns: ru.guns }], reserve: { inf: rest - Math.floor(rest / 2), cav: ru.cavalry, guns: 0 } };
    return s;
  }

  it('losing two sectors is a lost position: a cohesion shock, but no rout', () => {
    const ctx = ground();
    const s = thinRussianFlanks(ctx);
    const after = round(s, ctx, { fr: pressAll, ru: holdAll });
    expect(after.b.field.control.slice(0, 2)).toEqual([2, 2]);
    expect(after.b.field.positionLost).toContain('ru');
    expect(s.forces['ru-main']!.cohesion - after.s.forces['ru-main']!.cohesion).toBeGreaterThanOrEqual(ctx.rules.battle.positionLossShock);
    expect(after.b.routed).not.toContain('ru');
    expect(after.b.phase).toBe('rounds');
  });

  it('Borodino, the negative control: a cohesive army that has lost two sectors, with a reserve and an open road, withdraws in order', () => {
    const ctx = ground();
    const s = thinRussianFlanks(ctx);
    const lost = round(s, ctx, { fr: pressAll, ru: holdAll });
    expect(lost.b.field.positionLost).toContain('ru');
    expect(exitStateFor(lost.s, ctx, lost.b, 'ru')).toBe('open');
    // The Russian marshal decides from the state; the French let theirs decide.
    lost.b.awaiting = 'round';
    lost.b.hidden = decideRound(lost.s, ctx, lost.b, 'ru');
    expect(lost.b.hidden).toEqual(breakOff);
    const r = go(lost.s, decide(lost.s, { kind: 'delegate' }), ctx);
    const b = r.state.battles[lost.b.id]!;
    expect(b.field.result.ru).toBe('withdrew');
    expect(b.routed).not.toContain('ru');
  });

  it('an orderly withdrawal is not a rout', () => {
    const ctx = ground();
    const { s } = firstRound(ctx);
    const after = round(s, ctx, { fr: holdAll, ru: breakOff });
    expect(after.b.field.result.ru).toBe('withdrew');
    expect(after.b.routed).toEqual([]);
    expect(after.s.forces['ru-main']!.transit?.to).toBe('C');
  });

  it('a rout comes from a breakdown of cohesion', () => {
    const ctx = ground((d) => {
      forceInit(d, 'ru-main').cohesion = 262;
    });
    const { s } = firstRound(ctx);
    const after = round(s, ctx, { fr: pressAll, ru: holdAll });
    expect(after.s.forces['ru-main']!.cohesion).toBeLessThan(ctx.rules.battle.breakCohesion);
    expect(after.b.field.result.ru).toBe('routed');
    expect(after.b.routed).toContain('ru');
  });

  it('with no usable exit, breaking off traps the army: heavy losses, guns abandoned', () => {
    const ctx = ground((d) => {
      d.forces = d.forces.filter((f) => f.id !== 'ru-post');
      d.forces.push({ id: 'fr-c', side: 'fr', name: 'Corps at C', at: 'C', men: 8_000, horses: 500, wagons: 0, stock: { food: 16_000, fodder: 1_000, ammo: 500 } });
      d.forces.push({ id: 'fr-e', side: 'fr', name: 'Corps at E', at: 'E', men: 8_000, horses: 500, wagons: 0, stock: { food: 16_000, fodder: 1_000, ammo: 500 } });
    });
    const { s, b } = firstRound(ctx);
    expect(exitStateFor(s, ctx, b, 'ru')).toBe('blocked');
    const guns = s.forces['ru-main']!.guns;
    const after = round(s, ctx, { fr: holdAll, ru: breakOff });
    expect(after.b.field.result.ru).toBe('trapped');
    expect(after.b.routed).toContain('ru');
    expect(after.s.ledger.gunsLost.abandoned - s.ledger.gunsLost.abandoned).toBe(guns);
  });
});

describe('D. escape follows the operational situation', () => {
  const exitOfRussians = (adjust: Adjust, edit: (s: GameState) => void = () => {}) => {
    const ctx = ground(adjust);
    const { s, b } = firstRound(ctx);
    edit(s);
    return exitStateFor(s, ctx, b, 'ru');
  };

  it('open: a free road behind, no river, no enemy near it', () => {
    expect(exitOfRussians(() => {})).toBe('open');
  });

  it('contested: the retreat road crosses a river', () => {
    expect(exitOfRussians((d) => void (d.edges.find((e) => e.id === 'B-C')!.crossing = 'ford'))).toBe('contested');
  });

  it('contested: an enemy stands near the retreat place, or marches towards it', () => {
    const near = exitOfRussians((d) => {
      forceInit(d, 'fr-flank').at = 'D';
      d.edges.find((e) => e.id === 'C-D')!.metres = 12_000;
    });
    expect(near).toBe('contested');
    const marching = exitOfRussians(() => {}, (s) => {
      Object.assign(s.forces['fr-flank']!, { at: 'D', transit: { edge: 'C-D', to: 'C', metres: 2_000, seq: 99 } });
    });
    expect(marching).toBe('contested');
  });

  it('contested: an enemy in this battle came along the retreat road', () => {
    expect(exitOfRussians(() => {}, (s) => void (s.forces['fr-main']!.cameFrom = 'C'))).toBe('contested');
  });

  it('political pressure never closes a road', () => {
    const calm = exitOfRussians(() => {}, (s) => void (s.russianCommand.pressure = 0));
    const pressed = exitOfRussians(() => {}, (s) => void (s.russianCommand.pressure = 100));
    expect(pressed).toBe(calm);
  });

  it('contested: breaking off takes a disengagement round and costs more than an open road', () => {
    const lost = (adjust: Adjust) => {
      const ctx = ground(adjust);
      const { s } = firstRound(ctx);
      const after = round(s, ctx, { fr: holdAll, ru: breakOff });
      expect(after.b.field.result.ru).toBe('withdrew');
      return { men: s.forces['ru-main']!.men - after.s.forces['ru-main']!.men, fought: after.log.some((e) => e.kind === 'sectors') };
    };
    const open = lost(() => {});
    const contested = lost((d) => void (d.edges.find((e) => e.id === 'B-C')!.crossing = 'ford'));
    expect(open.fought).toBe(false);
    expect(contested.fought).toBe(true);
    expect(contested.men).toBeGreaterThan(open.men);
  });
});

describe('decisions', () => {
  it('the old round input still works: withdraw breaks off', () => {
    const ctx = ground();
    const { s, b } = firstRound(ctx);
    const r = go(s, decide(s, { kind: 'round', action: 'withdraw' }), ctx);
    expect(r.state.battles[b.id]!.field.result.fr).toBe('withdrew');
  });

  it('a battle left to the marshal resolves its rounds without stopping, and command comes back at nightfall', () => {
    const ctx = ground((d) => {
      forceInit(d, 'ru-main').men = 70_000;
    });
    let r = go(newGame(ctx, 3), { kind: 'orders', turn: 1, orders: [] }, ctx);
    r = go(r.state, decide(r.state, { kind: 'deploy', delegateBattle: true }), ctx);
    const b = Object.values(r.state.battles)[0]!;
    expect(r.status).toMatchObject({ kind: 'awaitingBattleInput', step: 'nightfall' });
    expect(r.state.battles[b.id]!.roundsFought).toBe(3);
    const back = go(r.state, decide(r.state, { kind: 'nightfall', choice: 'stay', delegateBattle: false }), ctx);
    expect(back.status).toMatchObject({ kind: 'awaitingBattleInput', step: 'round' });
  });

  it("the player's decisions are counted apart from the rounds fought", () => {
    const ctx = ground();
    const { s, b } = firstRound(ctx);
    const own = go(s, decide(s, { kind: 'round', key: holdAll }), ctx);
    expect(own.state.battles[b.id]!.field.decisions).toBe(1);
    const left = go(s, decide(s, { kind: 'delegate' }), ctx);
    expect(left.state.battles[b.id]!.field.decisions).toBe(0);
  });

  it('random play keeps every contract, battles included', () => {
    const ctx = createContext(testGround((d) => {
      Object.assign(forceInit(d, 'fr-main'), { cavalry: 9_000, guns: 60 });
      Object.assign(forceInit(d, 'ru-main'), { cavalry: 8_250, guns: 60 });
    }));
    for (let seed = 1; seed <= 25; seed++) {
      const run = play(ctx, seed, randomPolicy(ctx, seed, true));
      expect(violations(run), `seed ${seed}`).toEqual([]);
    }
  });
});

describe('extensions (step 5): Smolensk, the guns, the cavalry, flanks and pressure', () => {
  it('a place with its own battlefield uses it: Smolensk has walls, suburbs and bridges, and the walls hold better than open ground', () => {
    const lossAt = (template: 'open' | 'smolensk') => {
      const ctx = ground((d) => {
        if (template === 'smolensk') d.battlefields = { B: 'smolensk' };
      });
      const { s, b } = firstRound(ctx);
      expect(b.field.template).toBe(template);
      const defender = b.attacker === 'fr' ? 'ru' : 'fr';
      const after = round(s, ctx, { [b.attacker]: pressAll, [defender]: holdAll } as Record<Side, KeyDecision>);
      return s.forces[`${defender}-main`]!.men - after.s.forces[`${defender}-main`]!.men;
    };
    expect(lossAt('smolensk')).toBeLessThan(lossAt('open'));
  });

  it('massing the guns puts every deployed gun of the side into one sector, each gun still counted once', () => {
    const ctx = ground();
    const { s } = firstRound(ctx);
    const after = round(s, ctx, { fr: { kind: 'massGuns', sector: 2 }, ru: holdAll });
    const a = after.b.field.alloc['fr-main']!;
    expect([a.sectors[0].guns, a.sectors[1].guns, a.reserve.guns]).toEqual([0, 0, 0]);
    expect(a.sectors[2].guns).toBe(after.s.forces['fr-main']!.guns);
  });

  it('a charge sends the reserve cavalry into a sector, where it strikes harder than the same horsemen merely sent in', () => {
    const ctx = ground();
    const { s } = firstRound(ctx);
    const reserveCav = Object.values(s.battles)[0]!.field.alloc['fr-main']!.reserve.cav;
    expect(reserveCav).toBeGreaterThan(0);
    const charged = round(s, ctx, { fr: { kind: 'charge', sector: 0 }, ru: holdAll });
    expect(charged.b.field.alloc['fr-main']!.reserve.cav).toBe(0);
    // The same horsemen sent in without the shock of a charge.
    const probe = structuredClone(s);
    const pa = Object.values(probe.battles)[0]!.field.alloc['fr-main']!;
    pa.sectors[0].cav += pa.reserve.cav;
    pa.reserve.cav = 0;
    const walked = round(probe, ctx, { fr: { kind: 'continue' }, ru: holdAll });
    const ruLost = (x: { s: GameState }) => s.forces['ru-main']!.men - x.s.forces['ru-main']!.men;
    expect(ruLost(charged)).toBeGreaterThan(ruLost(walked));
  });

  it('cavalry set to screen pursues less but covers its own retreat better than cavalry set to pursue', () => {
    const pursuitBy = (task: 'pursue' | 'screen') => {
      const ctx = ground((d) => {
        forceInit(d, 'ru-main').cohesion = 340;
      });
      const { s } = firstRound(ctx);
      Object.values(s.battles)[0]!.field.cavalryTask.fr = task;
      const r = go(s, decide(s, { kind: 'delegate' }), ctx);
      return Number(r.log.find((e) => e.kind === 'pursuit')?.detail.men ?? 0);
    };
    expect(pursuitBy('screen')).toBeLessThan(pursuitBy('pursue'));
    const screened = (task: 'pursue' | 'screen') => {
      const ctx = ground();
      const { s } = firstRound(ctx);
      Object.values(s.battles)[0]!.field.cavalryTask.ru = task;
      const after = round(s, ctx, { fr: holdAll, ru: breakOff });
      return Number(after.log.find((e) => e.kind === 'pursuit')?.detail.men ?? 0);
    };
    expect(screened('screen')).toBeLessThan(screened('pursue'));
  });

  it('a side that came along two roads strikes the enemy\'s thinnest sector in the flank', () => {
    const inflicted = (twoRoads: boolean) => {
      const ctx = ground((d) => {
        forceInit(d, 'fr-flank').at = 'B';
      });
      const { s } = firstRound(ctx);
      s.forces['fr-main']!.cameFrom = 'A';
      s.forces['fr-flank']!.cameFrom = twoRoads ? 'C' : 'A';
      const after = round(s, ctx, { fr: pressAll, ru: holdAll });
      return { lost: s.forces['ru-main']!.men - after.s.forces['ru-main']!.men, flank: after.b.field.flank.fr };
    };
    const one = inflicted(false);
    const two = inflicted(true);
    expect(one.flank).toBeNull();
    expect(two.flank).not.toBeNull();
    expect(two.lost).toBeGreaterThan(one.lost);
  });

  it('under political pressure at a key place the Russian marshal holds on after losing the position, while cohesion lasts', () => {
    const decision = (pressure: number) => {
      const ctx = ground((d) => {
        d.keyPlaces = ['B'];
      });
      const { s, b } = firstRound(ctx);
      s.russianCommand.pressure = pressure;
      b.field.positionLost = ['ru'];
      s.forces['ru-main']!.cohesion = 600;
      return { round: decideRound(s, ctx, b, 'ru'), exit: exitStateFor(s, ctx, b, 'ru') };
    };
    expect(decision(0).round).toEqual(breakOff);
    expect(decision(100).round).not.toEqual(breakOff);
    // Willingness only: the road is the same either way.
    expect(decision(100).exit).toBe(decision(0).exit);
  });
});
