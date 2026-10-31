import { describe, expect, it } from 'vitest';
import { createContext, newGame, stateHash } from '../../src/engine';
import type { GameState, LogEntry, Sighting } from '../../src/engine';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';
import { planRussianTurn, updatePressure } from '../../src/engine/russian';

const ctx = createContext(vitebskDecision());

/** A fresh game whose Russian picture is exactly `picture`, with chosen pressure and temperament. */
function situation(picture: Record<string, Sighting>, pressure: number, temperament = 0): GameState {
  const s = newGame(ctx, 1812);
  s.intel.ru = picture;
  s.russianCommand.pressure = pressure;
  s.russianCommand.temperament = temperament;
  return s;
}

function decide(s: GameState): GameState {
  const next = structuredClone(s);
  const log: LogEntry[] = [];
  planRussianTurn(next, ctx, log);
  return next;
}

const russianOrders = (s: GameState) =>
  Object.values(s.forces)
    .filter((f) => f.side === 'ru')
    .map(({ id, route, engagement, posture, gathering, pace }) => ({ id, route, engagement, posture, gathering, pace }));

describe('intelligence (§2.8)', () => {
  it('each side sees only what its forces can observe, with an error in the estimate', () => {
    const s = newGame(ctx, 1812);
    // The Cossacks at Rudnia see the vanguard at Liozno, 24 km away; nobody sees the Guard at Vitebsk.
    const vanguard = s.intel.ru['fr-vanguard'];
    expect(vanguard).toMatchObject({ at: 'liozno', turn: 1 });
    const truth = s.forces['fr-vanguard']!.men;
    expect(Math.abs(vanguard!.men - truth)).toBeLessThanOrEqual(truth * 0.2 + 100);
    expect(s.intel.ru['fr-guard']).toBeUndefined();
    expect(s.intel.fr['ru-cossacks']).toMatchObject({ at: 'rudnia' });
    expect(s.intel.fr['ru-1st']).toBeUndefined();
  });
});

describe('Russian command (§2.9)', () => {
  it('never uses information it does not have', () => {
    const a = newGame(ctx, 1812);
    const b = structuredClone(a);
    // Change the truth about French forces the Russians have not seen.
    b.forces['fr-guard']!.men = 1;
    b.forces['fr-south']!.at = 'orsha';
    expect(b.intel.ru['fr-guard']).toBeUndefined();
    expect(b.intel.ru['fr-south']).toBeUndefined();
    expect(russianOrders(decide(a))).toEqual(russianOrders(decide(b)));
    expect(decide(a).russianCommand).toEqual(decide(b).russianCommand);
  });

  it('strikes an isolated, clearly weaker French force when resolve is high', () => {
    const s = decide(situation({ 'fr-vanguard': { at: 'liozno', men: 40_000, turn: 1 } }, 80));
    expect(s.russianCommand).toMatchObject({ plan: 'strike', target: 'liozno' });
    for (const id of ['ru-1st', 'ru-2nd']) {
      const f = s.forces[id]!;
      expect(f.route.at(-1)).toBe('liozno');
      expect(f).toMatchObject({ engagement: 'seek', gathering: ctx.rules.posture.gatherSlots });
    }
  });

  it('does not strike when its resolve is low; it holds, spread out to feed', () => {
    const s = decide(situation({ 'fr-vanguard': { at: 'liozno', men: 40_000, turn: 1 } }, 40, -10));
    expect(s.russianCommand.plan).toBe('hold');
    expect(s.forces['ru-2nd']).toMatchObject({ route: [], posture: 'dispersed' });
  });

  it('does not strike a French force that has friends close by', () => {
    const s = decide(
      situation(
        {
          'fr-vanguard': { at: 'liozno', men: 40_000, turn: 1 },
          'fr-guard': { at: 'babinovichi', men: 30_000, turn: 1 },
        },
        80,
      ),
    );
    expect(s.russianCommand.plan).not.toBe('strike');
  });

  it('ignores stale sightings', () => {
    const s = situation({ 'fr-vanguard': { at: 'liozno', men: 40_000, turn: 1 } }, 80);
    s.resolution.turn = 4;
    expect(decide(s).russianCommand.plan).toBe('hold');
  });

  it('withdraws towards its next depot before a superior army, unless the pressure is too high', () => {
    const danger = { 'fr-guard': { at: 'valutino', men: 200_000, turn: 1 } };
    const low = decide(situation(danger, 60));
    expect(low.russianCommand.plan).toBe('withdraw');
    expect(low.forces['ru-1st']!.route.at(-1)).toBe('dorogobuzh');
    expect(low.forces['ru-1st']!.engagement).toBe('avoid');
    const high = decide(situation(danger, 85));
    expect(high.russianCommand.plan).toBe('stand');
    expect(high.forces['ru-1st']!.engagement).toBe('accept');
  });

  it('pulls a screening detachment back from a clearly superior enemy', () => {
    const s = decide(situation({ 'fr-vanguard': { at: 'liozno', men: 40_000, turn: 1 } }, 40, -10));
    expect(s.forces['ru-cossacks']).toMatchObject({ route: ['smolensk-north'], engagement: 'avoid' });
  });

  it('is deterministic', () => {
    const s = situation({ 'fr-vanguard': { at: 'liozno', men: 40_000, turn: 1 } }, 70);
    expect(stateHash(decide(s))).toBe(stateHash(decide(s)));
  });
});

describe('political pressure', () => {
  it('rises with time and with French troops on Smolensk province soil, and falls after a battle', () => {
    const r = ctx.rules.russian;
    const s = newGame(ctx, 1812);
    const p0 = s.russianCommand.pressure;
    updatePressure(s, ctx, []);
    expect(s.russianCommand.pressure).toBe(Math.min(100, p0 + r.pressurePerTurn));

    const occupied = newGame(ctx, 1812);
    occupied.forces['fr-vanguard']!.at = 'rudnia';
    updatePressure(occupied, ctx, []);
    expect(occupied.russianCommand.pressure).toBe(Math.min(100, p0 + r.pressurePerTurn + r.pressurePerOccupiedPlace));

    const fought = newGame(ctx, 1812);
    fought.russianCommand.foughtThisTurn = true;
    updatePressure(fought, ctx, []);
    expect(fought.russianCommand.pressure).toBe(Math.max(0, p0 + r.pressurePerTurn - r.pressureReliefAfterBattle));
    expect(fought.russianCommand.foughtThisTurn).toBe(false);
  });
});
