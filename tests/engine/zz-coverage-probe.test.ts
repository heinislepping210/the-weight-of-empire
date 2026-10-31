import { expect, it } from 'vitest';
import { createContext } from '../../src/engine';
import { play, randomPolicy } from '../fixtures/driver';
import { forceInit, testGround } from '../fixtures/testGround';

// The invariant tests are only as strong as the situations random play reaches.
// This guards against them silently passing on games where nothing happens.
it('random play reaches battles, nights, deliveries, shortfalls and withdrawals', () => {
  const open = createContext(testGround());
  const crowded = createContext(
    testGround((s) => {
      forceInit(s, 'ru-main').at = 'B';
      forceInit(s, 'ru-post').at = 'A';
    }),
  );
  const counts = new Map<string, number>();
  for (let i = 0; i < 60; i++) {
    const ctx = i % 2 ? crowded : open;
    for (const e of play(ctx, i * 7919, randomPolicy(ctx, i * 104729)).logs.flat()) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  }
  for (const kind of ['battleJoined', 'round', 'nightfall', 'battleEnded', 'delivered', 'shortfall', 'minorAction', 'withdrawal', 'retreated']) {
    expect(counts.get(kind) ?? 0, kind).toBeGreaterThan(0);
  }
});
