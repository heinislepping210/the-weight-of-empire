// Scenario and dice are separate random streams (review stage F): the seed sets the scenario
// (strengths, the Russian command's temper, weather, what the scouts report); the dice decide
// battles, withdrawals, skirmishes, burned stores and who gets onto a road first.

import { describe, expect, it } from 'vitest';
import { createContext, newGame, stateHash } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { BOTS } from '../balance/bots';
import { play } from '../fixtures/driver';

const ctx = createContext(vitebskDecision());

describe('scenario and dice', () => {
  it('by default the dice follow the seed', () => {
    expect(newGame(ctx, 1812).dice).toBe(1812);
  });

  it('fresh dice keep the scenario: strengths, the Russian command and the first reports are the same', () => {
    const a = newGame(ctx, 1812, 1);
    const b = newGame(ctx, 1812, 2);
    expect({ ...a, dice: 0 }).toEqual({ ...b, dice: 0 });
  });

  it('fresh dice keep the weather, but change how battles go', () => {
    const runs = [1, 2, 3, 4].map((dice) => play(ctx, 1812, BOTS.methodical!(ctx), 5_000, dice));
    const rain = (r: (typeof runs)[number]) => r.logs.flat().filter((e) => e.kind === 'rain').map((e) => `${e.turn}.${e.slot}`);
    for (const r of runs.slice(1)) expect(rain(r)).toEqual(rain(runs[0]!));
    expect(new Set(runs.map((r) => stateHash(r.final))).size).toBeGreaterThan(1);
    expect(new Set(runs.map((r) => r.final.ledger.menLost.battle)).size).toBeGreaterThan(1);
  });

  it('the same seed and dice replay exactly', () => {
    const a = play(ctx, 1812, BOTS.methodical!(ctx), 5_000, 7);
    const b = play(ctx, 1812, BOTS.methodical!(ctx), 5_000, 7);
    expect(stateHash(a.final)).toBe(stateHash(b.final));
  });
});
