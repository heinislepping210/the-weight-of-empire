import { advance, newGame, statusOf, stepOnce } from '../../src/engine';
import type { BattleState, ConvoyOrder, Context, GameState, GroupOrder, Input, LogEntry, LogisticsOrders, NightChoice, RoundAction, Status, Supplies } from '../../src/engine';
import { neighboursOf } from '../../src/engine/graph';
import { keyHash } from '../../src/engine/rng';
import { enemyPresent } from '../../src/engine/util';

export interface Policy {
  orders(s: GameState, turn: number): GroupOrder[];
  /** Declare a halt for the season with these orders. */
  halt?(s: GameState, turn: number): boolean;
  /** Depots to found and wagon trains to reassign with these orders. */
  logistics?(s: GameState, turn: number): LogisticsOrders | null;
  round?(s: GameState, battle: BattleState): RoundAction | 'delegate';
  nightfall?(s: GameState, battle: BattleState): NightChoice | 'delegate';
}

export interface Run {
  /** The state at every pause, starting with the new game. */
  states: GameState[];
  inputs: Input[];
  logs: LogEntry[][];
  final: GameState;
}

export function inputFor(s: GameState, status: Status, policy: Policy): Input {
  if (status.kind === 'awaitingOrders') {
    // Group orders first: a policy may arrange its supply to fit the directive it just chose.
    const orders = policy.orders(s, status.turn);
    const halt = !s.halted && (policy.halt?.(s, status.turn) ?? false);
    const logistics = policy.logistics?.(s, status.turn) ?? null;
    return { kind: 'orders', turn: status.turn, orders, ...(halt ? { halt: true } : {}), ...(logistics ? { logistics } : {}) };
  }
  if (status.kind !== 'awaitingBattleInput') throw new Error(`no input fits status ${status.kind}`);
  const b = s.battles[status.battleId];
  if (!b) throw new Error(`missing battle ${status.battleId}`);
  const base = { kind: 'battle', battleId: status.battleId, round: status.round } as const;
  if (status.step === 'deploy') return { ...base, decision: { kind: 'deploy' } };
  if (status.step === 'round') {
    const action = policy.round?.(s, b) ?? 'delegate';
    return { ...base, decision: action === 'delegate' ? { kind: 'delegate' } : { kind: 'round', action } };
  }
  const choice = policy.nightfall?.(s, b) ?? 'delegate';
  return { ...base, decision: choice === 'delegate' ? { kind: 'delegate' } : { kind: 'nightfall', choice } };
}

export function play(ctx: Context, seed: number, policy: Policy, limit = 5_000): Run {
  let s = newGame(ctx, seed);
  const states = [s];
  const inputs: Input[] = [];
  const logs: LogEntry[][] = [];
  for (let i = 0; i < limit; i++) {
    const status = statusOf(s);
    if (status.kind === 'ended') return { states, inputs, logs, final: s };
    const input = inputFor(s, status, policy);
    const result = advance(s, input, ctx);
    if (!result.ok) throw new Error(`policy produced an invalid input: ${result.reason}`);
    s = result.state;
    states.push(s);
    inputs.push(input);
    logs.push(result.log);
  }
  throw new Error('the game did not end');
}

/** Steps stage by stage until `until` holds, for observing the timeline between pauses. */
export function stepUntil(state: GameState, ctx: Context, until: (s: GameState) => boolean, limit = 200): GameState {
  let s = state;
  for (let i = 0; i < limit && !until(s); i++) s = stepOnce(s, ctx).state;
  if (!until(s)) throw new Error('condition never reached');
  return s;
}

const PACES = ['rest', 'steady', 'forced'] as const;
const STANCES = ['seek', 'accept', 'avoid'] as const;
const POSTURE_CHOICES = ['dispersed', 'concentrated', 'keep'] as const;
const ROUND = ['press', 'hold', 'withdraw', 'delegate'] as const;
const NIGHT = ['stay', 'withdraw', 'delegate'] as const;

/** Always-valid orders chosen pseudo-randomly from a seed, for property tests. */
export function randomPolicy(ctx: Context, choiceSeed: number): Policy {
  const pick = <T>(options: readonly T[], key: (string | number)[]): T => options[keyHash(choiceSeed, key) % options.length] as T;
  return {
    orders(s, turn) {
      const orders: GroupOrder[] = [];
      for (const id of Object.keys(s.forces).sort()) {
        const f = s.forces[id];
        if (!f || f.side !== 'fr') continue;
        const pace = pick(PACES, [turn, id, 'pace']);
        const engagement = pick(STANCES, [turn, id, 'stance']);
        if (f.battle) {
          orders.push({ force: id, pace, engagement });
          continue;
        }
        const route: string[] = [];
        let at = f.transit ? f.transit.to : f.at;
        if (f.transit) route.push(at);
        const steps = keyHash(choiceSeed, [turn, id, 'steps']) % 4;
        for (let k = 0; k < steps; k++) {
          at = pick(neighboursOf(ctx.graph, at), [turn, id, 'step', k]).node;
          route.push(at);
        }
        const posture = pick(POSTURE_CHOICES, [turn, id, 'posture']);
        orders.push({ force: id, route, pace, engagement, ...(posture === 'keep' ? {} : { posture }) });
      }
      return orders;
    },
    logistics(s, turn) {
      // Now and then found a depot where French troops hold the ground, and reassign a few wagon trains.
      const ours = Object.values(s.depots).filter((d) => d.side === 'fr').map((d) => d.node).sort();
      const held = [...new Set(Object.values(s.forces).filter((f) => f.side === 'fr' && f.men > 0 && f.transit === null).map((f) => f.at))]
        .filter((n) => !s.depots[n] && !enemyPresent(s, 'fr', n))
        .sort();
      const found = held.length > 0 && keyHash(choiceSeed, [turn, 'found']) % 3 === 0 ? pick(held, [turn, 'site']) : undefined;
      const bases = found === undefined ? ours : [...ours, found];
      const french = Object.keys(s.forces).filter((id) => s.forces[id]?.side === 'fr').sort();
      const convoys: ConvoyOrder[] =
        bases.length === 0
          ? []
          : Object.keys(s.convoys)
              .sort()
              .filter((id) => s.convoys[id]?.side === 'fr' && keyHash(choiceSeed, [turn, id, 'reassign']) % 4 === 0)
              .map((id) => {
                const home = pick(bases, [turn, id, 'home']);
                return keyHash(choiceSeed, [turn, id, 'role']) % 2 === 0 ? { convoy: id, home, serves: pick(french, [turn, id, 'serves']) } : { convoy: id, home, feeds: pick(bases, [turn, id, 'feeds']) };
              });
      if (found === undefined && convoys.length === 0) return null;
      return { ...(found === undefined ? {} : { foundDepot: found }), ...(convoys.length > 0 ? { convoys } : {}) };
    },
    round: (_s, b) => pick(ROUND, ['round', b.id, b.roundsFought]),
    nightfall: (_s, b) => pick(NIGHT, ['night', b.id, b.roundsFought]),
  };
}

/** French columns marching on the Russian position: produces battles reliably. */
export const advancePolicy: Policy = {
  orders(s, turn) {
    if (turn !== 1) return [];
    const orders: GroupOrder[] = [{ force: 'fr-main', route: ['C', 'D'], pace: 'steady', engagement: 'seek' }];
    if (s.forces['fr-flank']) orders.push({ force: 'fr-flank', route: ['B', 'C'], pace: 'forced' });
    return orders;
  },
  round: () => 'delegate',
  nightfall: () => 'delegate',
};

export function supplyTotals(s: GameState): Supplies & { men: number; horses: number; wagons: number; districtFood: number; districtFodder: number } {
  const t = { food: 0, fodder: 0, ammo: 0, men: 0, horses: 0, wagons: 0, districtFood: 0, districtFodder: 0 };
  const add = (x: Supplies) => {
    t.food += x.food;
    t.fodder += x.fodder;
    t.ammo += x.ammo;
  };
  for (const f of Object.values(s.forces)) {
    add(f.stock);
    add(f.incoming);
    t.men += f.men;
    t.horses += f.horses;
    t.wagons += f.wagons;
  }
  for (const d of Object.values(s.depots)) {
    add(d.stock);
    add(d.incoming);
  }
  for (const c of Object.values(s.convoys)) {
    add(c.cargo);
    t.wagons += c.wagons;
  }
  for (const d of Object.values(s.districts)) {
    t.districtFood += d.food;
    t.districtFodder += d.fodder;
  }
  return t;
}
