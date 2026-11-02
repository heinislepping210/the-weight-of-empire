// Invariant checks that report violations instead of stopping at the first (for batch runs).

import type { GameState } from '../../src/engine';
import { ROUNDS_PER_SLOT, slotIndex } from '../../src/engine/time';
import { supplyTotals, type Run } from './driver';

/**
 * Contact rules at a pause: no living force stands at the place of an active battle without being in
 * it, and no two opposing columns are on the same road heading in opposite directions.
 */
export function contactViolations(s: GameState): string[] {
  const out: string[] = [];
  const forces = Object.values(s.forces).filter((f) => f.men > 0);
  for (const b of Object.values(s.battles)) {
    if (b.phase === 'over') continue;
    for (const f of forces) if (f.transit === null && f.at === b.node && f.battle !== b.id) out.push(`${f.id} stands at battle ${b.id} without fighting in it`);
  }
  for (const f of forces) {
    if (f.side !== 'fr' || f.transit === null) continue;
    for (const e of forces) {
      if (e.side === 'ru' && e.transit !== null && e.transit.edge === f.transit.edge && e.transit.to !== f.transit.to) out.push(`${f.id} and ${e.id} are on road ${f.transit.edge} heading towards each other`);
    }
  }
  // No passing on the road (D-037, D-038): of two enemy columns heading the same way, the one that set out
  // later is never further along.
  for (const f of forces) {
    for (const e of forces) {
      const [ft, et] = [f.transit, e.transit];
      if (f.side === e.side || !ft || !et || ft.edge !== et.edge || ft.to !== et.to) continue;
      if (ft.seq > et.seq && ft.metres > et.metres) out.push(`${f.id} set out along road ${ft.edge} after ${e.id} but is further along it`);
    }
  }
  return out;
}

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
    // Stores leave the books only by being eaten, spent, burned on capture or abandoned on the march.
    const gone = { food: s.ledger.destroyed.food + s.ledger.abandoned.food, fodder: s.ledger.destroyed.fodder + s.ledger.abandoned.fodder, ammo: s.ledger.destroyed.ammo + s.ledger.abandoned.ammo };
    if (t.food + s.ledger.consumed.food + gone.food !== a.food + s.ledger.foraged.food) out.push(`${where}: food not conserved`);
    if (t.fodder + s.ledger.consumed.fodder + gone.fodder !== a.fodder + s.ledger.foraged.fodder) out.push(`${where}: fodder not conserved`);
    if (t.ammo + s.ledger.ammoSpent.fr + s.ledger.ammoSpent.ru + gone.ammo !== a.ammo) out.push(`${where}: ammunition not conserved`);
    if (t.districtFood + s.ledger.foraged.food !== a.districtFood) out.push(`${where}: countryside food not conserved`);
    for (const c of Object.values(s.convoys)) {
      if ((c.serves === null) === (c.feeds === null)) out.push(`${where}: ${c.id} supplies both or neither a force and a depot`);
      if ([c.cargo.food, c.cargo.fodder, c.cargo.ammo].some((v) => v < 0)) out.push(`${where}: negative cargo in ${c.id}`);
    }
    for (const d of Object.values(s.depots)) {
      if ([d.stock.food, d.stock.fodder, d.stock.ammo].some((v) => v < 0)) out.push(`${where}: negative stock at ${d.node}`);
    }
    for (const v of contactViolations(s)) out.push(`${where}: ${v}`);
    // Guns leave the books only as captured or abandoned (contract A, §3.4b).
    const guns = (x: GameState) => Object.values(x.forces).reduce((n, f) => n + f.guns, 0);
    if (guns(s) + s.ledger.gunsLost.captured + s.ledger.gunsLost.abandoned !== guns(run.states[0] as GameState)) out.push(`${where}: guns not conserved`);
    for (const f of Object.values(s.forces)) {
      if ([f.men, f.cavalry, f.guns, f.horses, f.stock.food, f.stock.fodder, f.stock.ammo, f.fatigue, f.cohesion].some((v) => v < 0)) out.push(`${where}: negative value in ${f.id}`);
      if (f.cavalry > f.men) out.push(`${where}: ${f.id} has more cavalry than men`);
      const active = Object.values(s.battles).filter((b) => b.phase !== 'over' && (b.sides.fr.includes(f.id) || b.sides.ru.includes(f.id)));
      if (active.length > 1 || f.battle !== (active[0]?.id ?? null)) out.push(`${where}: ${f.id} battle bookkeeping`);
      // Every man and gun of a force in battle stands in exactly one sector or the reserve (contract A).
      const a = active[0]?.field.alloc[f.id];
      if (active[0] && !a) out.push(`${where}: ${f.id} has no place on the field`);
      if (a) {
        const places = [...a.sectors, a.reserve];
        const sum = (k: 'inf' | 'cav' | 'guns') => places.reduce((n, t) => n + t[k], 0);
        if (places.some((t) => t.inf < 0 || t.cav < 0 || t.guns < 0)) out.push(`${where}: negative allocation for ${f.id}`);
        if (sum('inf') !== f.men - f.cavalry || sum('cav') !== f.cavalry || sum('guns') !== f.guns) out.push(`${where}: ${f.id} allocation does not match its strength`);
      }
    }
    for (const b of Object.values(s.battles)) {
      for (const side of b.routed) if (b.field.result[side] !== 'routed' && b.field.result[side] !== 'trapped') out.push(`${where}: battle ${b.id} lists ${side} as routed without a rout or a trap`);
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
