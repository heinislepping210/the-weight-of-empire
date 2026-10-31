import { describe, expect, it } from 'vitest';
import { advance, createContext, newGame, stateHash, statusOf } from '../../src/engine';
import type { Input } from '../../src/engine';
import { forceInit, testGround } from '../fixtures/testGround';

describe('inputs are validated and rejected cleanly', () => {
  const ctx = createContext(testGround());
  const start = newGame(ctx, 11);

  it('rejects orders for the wrong turn, unknown or Russian forces, duplicates and roads that do not exist', () => {
    const bad: Input[] = [
      { kind: 'orders', turn: 2, orders: [] },
      { kind: 'orders', turn: 1, orders: [{ force: 'ru-main', route: [] }] },
      { kind: 'orders', turn: 1, orders: [{ force: 'nobody' }] },
      { kind: 'orders', turn: 1, orders: [{ force: 'fr-main', route: ['D'] }] },
      { kind: 'orders', turn: 1, orders: [{ force: 'fr-main' }, { force: 'fr-main' }] },
      { kind: 'battle', battleId: '1.0.0', round: 0, decision: { kind: 'deploy' } },
    ];
    for (const input of bad) expect(advance(start, input, ctx).ok).toBe(false);
  });

  it('never modifies the state it is given', () => {
    const before = stateHash(start);
    expect(advance(start, { kind: 'orders', turn: 1, orders: [{ force: 'fr-main', route: ['C', 'D'] }] }, ctx).ok).toBe(true);
    expect(advance(start, { kind: 'orders', turn: 7, orders: [] }, ctx).ok).toBe(false);
    expect(stateHash(start)).toBe(before);
  });

  it('rejects a battle decision for the wrong step, round or battle', () => {
    const battle = createContext(testGround((s) => (forceInit(s, 'ru-main').at = 'B')));
    const deployed = advance(newGame(battle, 7), { kind: 'orders', turn: 1, orders: [] }, battle);
    if (!deployed.ok) throw new Error(deployed.reason);
    const status = statusOf(deployed.state);
    expect(status).toMatchObject({ kind: 'awaitingBattleInput', step: 'deploy', round: 0 });
    if (status.kind !== 'awaitingBattleInput') return;
    const wrong: Input[] = [
      { kind: 'battle', battleId: status.battleId, round: 0, decision: { kind: 'round', action: 'press' } },
      { kind: 'battle', battleId: status.battleId, round: 1, decision: { kind: 'deploy' } },
      { kind: 'battle', battleId: 'elsewhere', round: 0, decision: { kind: 'deploy' } },
      { kind: 'orders', turn: 1, orders: [] },
    ];
    for (const input of wrong) expect(advance(deployed.state, input, battle).ok).toBe(false);
    expect(advance(deployed.state, { kind: 'battle', battleId: status.battleId, round: 0, decision: { kind: 'deploy' } }, battle).ok).toBe(true);
  });
});
