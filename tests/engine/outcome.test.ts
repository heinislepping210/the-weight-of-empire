// The outcome evaluator against a table of campaign states (§2.13; independent review, stage D).
// Each case builds an end state by hand and names the ending it must receive, so the meaning of the
// endings is fixed by tests rather than by whatever the batch happens to produce.

import { describe, expect, it } from 'vitest';
import { RULES, createContext, evaluate, newGame, submit } from '../../src/engine';
import type { CutOffCredit } from '../../src/engine/rules';
import type { BattleState, GameState } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { lineOfRetreatBlocked } from '../../src/engine/outcome';
import { stepUntil } from '../fixtures/driver';
import { holdStill, idleField } from '../fixtures/testGround';

const ctx = createContext(vitebskDecision());
const start = newGame(ctx, 1812);
const mainStart = start.forces['ru-1st']!.men + start.forces['ru-2nd']!.men;

function endState(edit: (s: GameState) => void = () => {}): GameState {
  const s = structuredClone(start);
  s.resolution = { turn: 10, slot: 3, stage: 'endOfTurn', encounterQueue: null, battleSeq: 0 };
  s.ended = 'scenarioEnd';
  edit(s);
  return s;
}

/** A finished battle on `day` (0-based) in which the Russian main armies lost the given share of their starting strength. */
function battle(s: GameState, id: string, day: number, lossPermille: number, winner: 'fr' | 'ru'): void {
  const lost = Math.floor((mainStart * lossPermille) / 1000);
  const first = Math.floor(lost / 2);
  const losses = { 'ru-1st': first, 'ru-2nd': lost - first };
  s.forces['ru-1st']!.men -= first;
  s.forces['ru-2nd']!.men -= lost - first;
  const b: BattleState = {
    id,
    node: 'smolensk-north',
    attacker: 'fr',
    sides: { fr: ['fr-vanguard'], ru: ['ru-1st', 'ru-2nd'] },
    phase: 'over',
    startsAt: { turn: Math.floor(day / 2) + 1, slot: day % 2 === 0 ? 0 : 2 },
    fightsFrom: {},
    roundsFought: 3,
    roundsThisSlot: 0,
    awaiting: null,
    hidden: null,
    lastNight: day,
    winner,
    losses,
    // The Russians broke: an orderly withdrawal is no decisive defeat (D-037, tested in second-review.test.ts).
    routed: winner === 'fr' ? ['ru'] : [],
    field: idleField(),
  };
  s.battles[id] = b;
}

/** The Russians lose men to sickness and straggling, outside any battle. */
const wasting = (s: GameState, permille: number) => {
  for (const id of ['ru-1st', 'ru-2nd']) s.forces[id]!.men -= Math.floor((s.forces[id]!.men * permille) / 1000);
};

describe('what happened to the Russian main army (§2.13 A)', () => {
  it('a decisive defeat: battle losses of 30% within four days, in battles the French won', () => {
    const o = evaluate(start, endState((s) => {
      battle(s, '6.0.0', 10, 160, 'fr');
      battle(s, '7.2.0', 13, 160, 'fr');
    }), ctx);
    expect(o.russian).toBe('decisivelyDefeated');
    expect(o.ending).toBe('decisiveSuccess');
    expect(o.reasons[0]).toContain('within 4 days');
  });

  it('the same battle losses spread over more than four days are not a decisive defeat', () => {
    const o = evaluate(start, endState((s) => {
      battle(s, '2.0.0', 2, 160, 'fr');
      battle(s, '7.0.0', 12, 160, 'fr');
    }), ctx);
    expect(o.russian).not.toBe('decisivelyDefeated');
  });

  it('losses to sickness and straggling do not count towards a decisive defeat, even with a battle won', () => {
    const o = evaluate(start, endState((s) => {
      battle(s, '6.0.0', 10, 20, 'fr');
      wasting(s, 400);
    }), ctx);
    expect(o.russian).toBe('damaged');
    expect(o.ending).not.toBe('decisiveSuccess');
  });

  it('losses in battles the Russians won do not count towards their defeat', () => {
    const o = evaluate(start, endState((s) => battle(s, '6.0.0', 10, 310, 'ru')), ctx);
    expect(o.russian).not.toBe('decisivelyDefeated');
  });

  it('cut off counts only when the road was held for two sub-steps, not on the last day alone', () => {
    const blocked = (s: GameState) => {
      s.forces['fr-right']!.at = 'dorogobuzh';
      s.forces['fr-right']!.transit = null;
    };
    const lastDay = evaluate(start, endState((s) => {
      blocked(s);
      s.cutOff = { held: 1, achievedAt: null };
    }), ctx);
    expect(lastDay.russian).not.toBe('cutOff');
    const held = evaluate(start, endState((s) => {
      blocked(s);
      s.cutOff = { held: 2, achievedAt: { turn: 10, slot: 3 } };
    }), ctx);
    expect(held.russian).toBe('cutOff');
  });
});

describe('what a cut road earns (cutOffCredit; the second review, D3)', () => {
  const credited = (credit: CutOffCredit) => createContext(vitebskDecision(), { ...RULES, outcome: { ...RULES.outcome, cutOffCredit: credit } });
  /** The road was cut on turn 6; then, at the end, the Russians are still cut off, escaped cheaply, or broke out at a heavy cost. */
  const cases = {
    stillCut: endState((s) => {
      s.cutOff = { held: 9, achievedAt: { turn: 6, slot: 0 } };
      Object.assign(s.forces['fr-right']!, { at: 'valutino', transit: null });
    }),
    escapedCheaply: endState((s) => (s.cutOff = { held: 0, achievedAt: { turn: 6, slot: 0 } })),
    brokeOut: endState((s) => {
      s.cutOff = { held: 0, achievedAt: { turn: 6, slot: 0 } };
      battle(s, '7.2.0', 13, 150, 'fr'); // a battle after the cut, costing the main armies 15%
    }),
  };
  const judged = (credit: CutOffCredit) => Object.fromEntries(Object.entries(cases).map(([k, s]) => [k, evaluate(start, s, credited(credit))]));

  it('stands (now): once cut, cut off for good', () => {
    const o = judged('stands');
    for (const k of Object.keys(cases)) expect(o[k]!.russian, k).toBe('cutOff');
  });

  it('at the end: cut off only if still cut off when the campaign ends', () => {
    const o = judged('atEnd');
    expect(o.stillCut!.russian).toBe('cutOff');
    expect(o.escapedCheaply!.russian).toBe('intact');
    expect(o.brokeOut!.russian).toBe('damaged');
  });

  it('graded: full credit if still cut off, forced out after a costly break-out, nothing for a cheap escape', () => {
    const o = judged('graded');
    expect(o.stillCut!.russian).toBe('cutOff');
    expect(o.brokeOut!.russian).toBe('forcedOut');
    expect(o.escapedCheaply!.russian).toBe('intact');
    expect(o.escapedCheaply!.reasons).toContain('Their line of retreat was cut for a time, but they got away without heavy loss.');
    expect(o.brokeOut).toMatchObject({ roadCut: true, stillCutOff: false });
    expect(Math.abs(o.brokeOut!.lostSinceCutPermille - 150)).toBeLessThanOrEqual(1);
  });
});

describe('what cuts the Russians off (§2.13)', () => {
  const holding = (place: string) => {
    const s = structuredClone(start);
    Object.assign(s.forces['fr-right']!, { at: place, transit: null });
    return lineOfRetreatBlocked(s, ctx, ['ru-1st', 'ru-2nd']);
  };

  it("holding Smolensk's north-bank suburb takes ground but does not cut them off", () => {
    expect(holding('smolensk-north')).toBe(false);
  });

  it('holding Valutino or Dorogobuzh on the Moscow road, east of them, does', () => {
    expect(holding('valutino')).toBe(true);
    expect(holding('dorogobuzh')).toBe(true);
  });
});

describe('the engine tracks how long the line of retreat is held', () => {
  const passive = createContext(vitebskDecision(), RULES, { russianCommand: holdStill });
  const blockedGame = () => {
    const s = newGame(passive, 1812);
    Object.assign(s.forces['fr-right']!, { at: 'dorogobuzh', transit: null, route: [], posture: 'concentrated' });
    const r = submit(s, { kind: 'orders', turn: 1, orders: [] }, passive);
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  };

  it('a block held through two sub-steps cuts the Russians off, and that stands', () => {
    const one = stepUntil(blockedGame(), passive, (x) => x.resolution.slot === 1 && x.resolution.stage === 'activity');
    expect(one.cutOff).toEqual({ held: 1, achievedAt: null });
    const two = stepUntil(one, passive, (x) => x.resolution.stage === 'night');
    expect(two.cutOff).toEqual({ held: 2, achievedAt: { turn: 1, slot: 1 } });
  });

  it('a block given up starts the count again', () => {
    const one = stepUntil(blockedGame(), passive, (x) => x.resolution.slot === 1 && x.resolution.stage === 'activity');
    one.forces['fr-right']!.at = 'liady'; // off the Moscow road: the way east is open again
    const two = stepUntil(one, passive, (x) => x.resolution.stage === 'night');
    expect(two.cutOff).toEqual({ held: 0, achievedAt: null });
  });
});

describe('the state of the French army (§2.13 C)', () => {
  it('one starving group makes the army unsustainable, even when its pooled food is ample', () => {
    const o = evaluate(start, endState((s) => {
      for (const f of Object.values(s.forces)) if (f.side === 'fr') f.stock.food = f.men * 6;
      // Eugène at Surazh: nothing in hand, nothing coming, no depot, and the countryside stripped.
      s.forces['fr-left']!.stock.food = 0;
      s.convoys['cv-vitebsk-left']!.cargo.food = 0;
      for (const id of ['surazh', 'velizh', 'porechye', 'vitebsk']) s.districts[id] = { food: 0, fodder: 0 };
      battle(s, '6.0.0', 10, 310, 'fr');
    }), ctx);
    expect(o.frenchFoodDays).toBeGreaterThan(2);
    expect(o.sustainable).toBe(false);
    expect(o.ending).toBe('costlyVictory');
    expect(o.reasons.some((r) => r.includes("Left wing: Eugène's corps"))).toBe(true);
  });

  it('food in a depot where a group stands, on its way by wagon, or still to be foraged, counts towards its supply', () => {
    const o = evaluate(start, endState((s) => {
      s.forces['fr-guard']!.stock.food = 0; // at Vitebsk, its depot
      s.forces['fr-vanguard']!.stock.food = 0;
      s.convoys['cv-vitebsk-vanguard']!.cargo.food = s.forces['fr-vanguard']!.men * 3;
      s.convoys['cv-vitebsk-vanguard']!.leg = 'outbound';
    }), ctx);
    expect(o.sustainable).toBe(true);
  });
});

describe('the halt (§2.13)', () => {
  it('an early halt in a supplied, secure position is a Successful Consolidation', () => {
    expect(evaluate(start, endState((s) => (s.halted = true)), ctx).ending).toBe('successfulConsolidation');
  });

  it('a halt with a starving group is a Precarious Halt', () => {
    const o = evaluate(start, endState((s) => {
      s.halted = true;
      s.forces['fr-south']!.stock.food = 0;
      s.convoys['cv-mogilev-south']!.cargo.food = 0;
      s.depots.mogilev!.stock.food = 0;
      for (const id of ['mogilev', 'mstislavl', 'orsha']) s.districts[id] = { food: 0, fodder: 0 };
    }), ctx);
    expect(o.ending).toBe('precariousHalt');
  });

  it('a decisive victory won before a late halt stands (D-035)', () => {
    const o = evaluate(start, endState((s) => {
      battle(s, '6.0.0', 10, 310, 'fr');
      s.halted = true;
    }), ctx);
    expect(o.ending).toBe('decisiveSuccess');
    expect(o.reasons).toContain('A halt for the season was declared; the victory over the Russian army still stands.');
  });
});

describe('the other endings', () => {
  it('nothing achieved and nothing lost, with no halt, is Inconclusive', () => {
    expect(evaluate(start, endState(), ctx).ending).toBe('inconclusive');
  });

  it('a lost battle with the objective not taken is a Repulse', () => {
    expect(evaluate(start, endState((s) => battle(s, '6.0.0', 10, 50, 'ru')), ctx).ending).toBe('repulse');
  });

  it('a broken army is an Operational Collapse whatever else happened', () => {
    const o = evaluate(start, endState((s) => {
      battle(s, '6.0.0', 10, 310, 'fr');
      for (const f of Object.values(s.forces)) if (f.side === 'fr') f.cohesion = 200;
    }), ctx);
    expect(o.ending).toBe('collapse');
  });
});
