// The last battles are fought out (G-025). A contact on the last afternoon used to leave a battle unfought when the
// clock stopped, and the ending was judged as if it had never been offered. The contract:
//   1. A campaign with no battle open ends with its last turn, as before.
//   2. With a battle open it goes on, without new orders, until that battle is over, and ends at once.
//   3. Only the battle goes on: everyone else stands where they are, on the road too, and nobody else marches.
//   4. It is limited: past `outcome.lastBattleTurns` the campaign ends all the same, so a game always ends.
//   5. At 0 the rule is off, and the battle is left unfought as it was.

import { describe, expect, it } from 'vitest';
import { RULES, advance, createContext, evaluate, newGame, statusOf } from '../../src/engine';
import type { GameState, Rules, ScenarioDef } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { dispatches } from '../../src/ui/dispatches';
import { BOTS } from '../balance/bots';
import { inputFor, play, type Policy } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { holdStill, testGround } from '../fixtures/testGround';

const NO_LAST_BATTLE: Rules = { ...RULES, outcome: { ...RULES.outcome, lastBattleTurns: 0 } };

/** One turn long. The main body reaches the Russians at C on the last afternoon; the flank corps is on a long road. */
function lastAfternoon(edit: (d: ScenarioDef) => void = () => {}): ScenarioDef {
  return testGround((d) => {
    d.turns = 1;
    d.convoys = [];
    Object.assign(d.edges.find((e) => e.id === 'B-C')!, { metres: 40_000, road: 'post' });
    Object.assign(d.edges.find((e) => e.id === 'A-G')!, { metres: 90_000, road: 'post' });
    for (const f of d.forces) if (f.side === 'ru') f.at = 'C';
    // Outnumbered four to one, so that the battle is decided quickly.
    d.forces.find((f) => f.id === 'ru-main')!.men = 15_000;
    edit(d);
  });
}

const marchOn = (): Policy => ({
  orders: (s) => (s.resolution.turn === 1 ? [{ force: 'fr-main', route: ['C'], pace: 'steady' }, { force: 'fr-flank', route: ['G'], pace: 'steady' }] : []),
  round: () => 'delegate',
  nightfall: () => 'delegate',
});

const contextFor = (scenario: ScenarioDef, rules: Rules = RULES) => createContext(scenario, rules, { russianCommand: holdStill });

describe('a campaign that ends with a battle open', () => {
  it('fights it out, and asks for no new orders', () => {
    const ctx = contextFor(lastAfternoon());
    const run = play(ctx, 7, marchOn());
    const battles = Object.values(run.final.battles);
    expect(battles).toHaveLength(1);
    expect(battles[0]!.phase).toBe('over');
    expect(battles[0]!.roundsFought).toBeGreaterThan(0);
    expect(run.final.resolution.turn).toBe(2);
    expect(run.inputs.filter((i) => i.kind === 'orders')).toHaveLength(1);
    expect(run.logs.flat().some((e) => e.kind === 'lastBattles')).toBe(true);
    expect(dispatches(run.logs.flat(), run.final, ctx, ctx.scenario.startDate).map((d) => d.text)).toContainEqual(expect.stringContaining('a battle has still to be fought out'));
    expect(violations(run)).toEqual([]);
  });

  it('with the rule off, the battle is left unfought', () => {
    const ctx = contextFor(lastAfternoon(), NO_LAST_BATTLE);
    const run = play(ctx, 7, marchOn());
    const b = Object.values(run.final.battles)[0]!;
    expect(b.phase).not.toBe('over');
    expect(b.roundsFought).toBe(0);
    expect(run.final.resolution.turn).toBe(1);
  });

  it('only the battle goes on: a column on the road stands where it was when the last turn ended', () => {
    const ctx = contextFor(lastAfternoon());
    const policy = marchOn();
    let s = newGame(ctx, 7);
    const after: (number | null)[] = [];
    let atTheEnd: number | null = null;
    for (let i = 0; i < 200 && statusOf(s).kind !== 'ended'; i++) {
      const r = advance(s, inputFor(s, statusOf(s), policy), ctx, (x, at) => {
        const metres = x.forces['fr-flank']!.transit?.metres ?? null;
        if (x.resolution.turn === 1) atTheEnd = metres;
        if (x.resolution.turn === 2 && at.stage !== 'endOfTurn') after.push(metres);
      });
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(atTheEnd).not.toBeNull();
    expect(after.length).toBeGreaterThan(0);
    for (const m of after) expect(m).toBe(atTheEnd);
  });

  it('ends even if the battle cannot be finished within the limit', () => {
    const ctx = contextFor(lastAfternoon());
    const policy = marchOn();
    let s = newGame(ctx, 7);
    for (let i = 0; i < 200 && statusOf(s).kind !== 'ended'; i++) {
      // A battle put off for ever, as a stand-in for one that never decides.
      const r = advance(s, inputFor(s, statusOf(s), policy), ctx, (x) => {
        for (const b of Object.values(x.battles)) b.startsAt = { turn: 99, slot: 0 };
      });
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(statusOf(s).kind).toBe('ended');
    expect(s.resolution.turn).toBe(1 + RULES.outcome.lastBattleTurns);
    expect(Object.values(s.battles)[0]!.phase).not.toBe('over');
  });
});

describe('a campaign with no battle open', () => {
  it('ends with its last turn, as before', () => {
    const ctx = contextFor(lastAfternoon((d) => Object.assign(d.edges.find((e) => e.id === 'B-C')!, { metres: 60_000 })));
    const run = play(ctx, 7, marchOn());
    expect(Object.values(run.final.battles)).toHaveLength(0);
    expect(run.final.resolution.turn).toBe(1);
    expect(run.logs.flat().some((e) => e.kind === 'lastBattles')).toBe(false);
  });
});

describe('over whole games on the real map', () => {
  const ctx = createContext(vitebskDecision());

  it('no game ends with a battle not even begun, and no invariant breaks', () => {
    for (const bot of ['southern-envelopment-hold', 'concentrated-strike']) {
      for (let seed = 1; seed <= 12; seed++) {
        const run = play(ctx, seed, BOTS[bot]!(ctx));
        expect(violations(run), `${bot} ${seed}`).toEqual([]);
        expect(Object.values(run.final.battles).filter((b) => b.phase !== 'over' && b.roundsFought === 0), `${bot} ${seed}`).toEqual([]);
      }
    }
  });

  it('the Russians beaten back from the block on the last morning are still cut off (seed 13)', () => {
    const run = play(ctx, 13, BOTS['southern-envelopment-hold']!(ctx));
    expect(run.final.resolution.turn).toBe(ctx.scenario.turns + 1);
    expect(evaluate(run.states[0] as GameState, run.final, ctx).russian).toBe('cutOff');
  });
});
