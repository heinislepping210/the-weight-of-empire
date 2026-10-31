// Invariant checks that report violations instead of stopping at the first (for batch runs).

import type { GameState } from '../../src/engine';
import { ROUNDS_PER_SLOT, slotIndex } from '../../src/engine/time';
import { supplyTotals, type Run } from './driver';

export function violations(run: Run): string[] {
  const out: string[] = [];
  const a = supplyTotals(run.states[0] as GameState);
  run.states.forEach((s, i) => {
    const t = supplyTotals(s);
    const lost = Object.values(s.ledger.menLost).reduce((n, x) => n + x, 0);
    const where = `state ${i}`;
    if (t.men + lost !== a.men) out.push(`${where}: men not conserved`);
    if (t.horses + s.ledger.horsesLost !== a.horses) out.push(`${where}: horses not conserved`);
    if (t.wagons !== a.wagons) out.push(`${where}: wagons not conserved`);
    const burned = s.ledger.destroyed;
    if (t.food + s.ledger.consumed.food + burned.food !== a.food + s.ledger.foraged.food) out.push(`${where}: food not conserved`);
    if (t.fodder + s.ledger.consumed.fodder + burned.fodder !== a.fodder + s.ledger.foraged.fodder) out.push(`${where}: fodder not conserved`);
    if (t.ammo + s.ledger.ammoSpent.fr + s.ledger.ammoSpent.ru + burned.ammo !== a.ammo) out.push(`${where}: ammunition not conserved`);
    if (t.districtFood + s.ledger.foraged.food !== a.districtFood) out.push(`${where}: countryside food not conserved`);
    for (const c of Object.values(s.convoys)) {
      if ((c.serves === null) === (c.feeds === null)) out.push(`${where}: ${c.id} supplies both or neither a force and a depot`);
      if ([c.cargo.food, c.cargo.fodder, c.cargo.ammo].some((v) => v < 0)) out.push(`${where}: negative cargo in ${c.id}`);
    }
    for (const d of Object.values(s.depots)) {
      if ([d.stock.food, d.stock.fodder, d.stock.ammo].some((v) => v < 0)) out.push(`${where}: negative stock at ${d.node}`);
    }
    for (const f of Object.values(s.forces)) {
      if ([f.men, f.horses, f.stock.food, f.stock.fodder, f.stock.ammo, f.fatigue, f.cohesion].some((v) => v < 0)) out.push(`${where}: negative value in ${f.id}`);
      const active = Object.values(s.battles).filter((b) => b.phase !== 'over' && (b.sides.fr.includes(f.id) || b.sides.ru.includes(f.id)));
      if (active.length > 1 || f.battle !== (active[0]?.id ?? null)) out.push(`${where}: ${f.id} battle bookkeeping`);
    }
  });
  const seen = new Map<number, Set<string>>();
  const joined = new Map<string, number>();
  const perSlot = new Map<string, number>();
  for (const e of run.logs.flat()) {
    if (e.kind === 'encounter') {
      const set = seen.get(slotIndex(e)) ?? new Set<string>();
      for (const id of String(e.detail.forces).split(',')) {
        if (set.has(id)) out.push(`${id} in two encounters in one sub-step`);
        set.add(id);
      }
      seen.set(slotIndex(e), set);
    }
    if (e.kind === 'battleJoined') joined.set(String(e.detail.battle), slotIndex(e));
    if (e.kind === 'round') {
      const id = String(e.detail.battle);
      if (slotIndex(e) <= (joined.get(id) ?? Infinity)) out.push(`battle ${id} fought before it was set up`);
      const key = `${id}@${slotIndex(e)}`;
      perSlot.set(key, (perSlot.get(key) ?? 0) + 1);
      if ((perSlot.get(key) ?? 0) > ROUNDS_PER_SLOT) out.push(`battle ${id}: too many rounds in one sub-step`);
    }
  }
  return out;
}
