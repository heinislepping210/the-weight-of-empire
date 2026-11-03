import { describe, expect, it } from 'vitest';
import { ENDING_NAMES, createContext, evaluate } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { play } from '../fixtures/driver';
import { violations } from '../fixtures/invariants';
import { BOTS, PIN_STAGES, assignBlockers, pinStages, pinTraceOf } from './bots';

const ctx = createContext(vitebskDecision());

describe('the pinning attack plans by search (third review)', () => {
  // Two roads out, x and y. Corps a is nearest to both, b can reach only x: nearest pairs first would put a on x
  // and leave y open. Metres by road.
  const table: Record<string, Record<string, number>> = { a: { x: 10_000, y: 12_000 }, b: { x: 30_000 }, c: { x: 60_000, y: 70_000 } };
  const metres = (f: string, e: string) => table[f]?.[e] ?? null;
  const corps = [
    { id: 'a', men: 30_000 },
    { id: 'b', men: 30_000 },
    { id: 'c', men: 40_000 },
  ];

  it('gives every road a corps of its own where nearest pairs first would not, and keeps one to strike', () => {
    const p = assignBlockers(corps, ['x', 'y'], metres);
    expect(p.complete).toBe(true);
    expect(Object.fromEntries(p.holds)).toEqual({ a: 'y', b: 'x' });
    expect(p.strikers).toEqual(['c']);
  });

  it('never gives every corps a road: with too few, it holds what it can and strikes with the rest', () => {
    const p = assignBlockers(corps.slice(0, 2), ['x', 'y'], metres);
    expect(p.complete).toBe(false);
    // One road held within a day either way; holding x is the shorter march.
    expect(Object.fromEntries(p.holds)).toEqual({ a: 'x' });
    expect(p.strikers).toEqual(['b']);
  });

  it('among plans closing on the same day, leaves the strongest strike', () => {
    const p = assignBlockers(
      [
        { id: 'a', men: 20_000 },
        { id: 'c', men: 50_000 },
      ],
      ['x'],
      (f) => (f === 'a' ? 20_000 : 5_000),
    );
    expect(Object.fromEntries(p.holds)).toEqual({ a: 'x' });
    expect(p.strikers).toEqual(['c']);
  });

  it('records its stages in order, each only after the one before', () => {
    for (const name of ['pinning-attack', 'pinning-attack-search', 'pinning-fix-first']) {
      for (const seed of [1, 2, 3]) {
        const policy = BOTS[name]!(ctx);
        const run = play(ctx, seed, policy);
        const stages = pinStages(run, pinTraceOf(policy)!);
        PIN_STAGES.forEach((stage, k) => {
          if (k > 0 && stages[stage]) expect(stages[PIN_STAGES[k - 1]!], `${name} seed ${seed}: ${stage}`).toBe(true);
        });
      }
    }
    expect(pinTraceOf(BOTS.rush!(ctx))).toBeNull();
  });
});

describe('strategy bots (smoke test; the full batch runs with BALANCE=1)', () => {
  for (const [name, make] of Object.entries(BOTS)) {
    it(`${name} plays the scenario to an evaluated end without breaking any invariant`, () => {
      for (const seed of [1, 2]) {
        const run = play(ctx, seed, make(ctx));
        expect(run.final.ended).toBe('scenarioEnd');
        expect(violations(run)).toEqual([]);
        expect(Object.keys(ENDING_NAMES)).toContain(evaluate(run.states[0]!, run.final, ctx).ending);
      }
    });
  }

  it('the prudent halt declares its halt and never advances: its groups move only when forced to fall back', () => {
    const run = play(ctx, 3, BOTS['prudent-halt']!(ctx));
    expect(run.final.halted).toBe(true);
    const entries = run.logs.flat();
    const french = (id: unknown) => run.final.forces[String(id)]?.side === 'fr';
    // Places French groups were driven back to: after a battle, a skirmish or a withdrawal.
    const fellBackTo = new Set(
      entries.flatMap((e) =>
        (e.kind === 'retreated' && french(e.detail.force)) || (e.kind === 'minorAction' && e.detail.retreated === 'fr') || (e.kind === 'withdrawal' && e.detail.side === 'fr' && e.detail.success)
          ? [String(e.detail.to)]
          : [],
      ),
    );
    for (const e of entries.filter((x) => x.kind === 'arrived' && french(x.detail.force))) expect(fellBackTo.has(String(e.detail.node)), String(e.detail.node)).toBe(true);
  });
});
