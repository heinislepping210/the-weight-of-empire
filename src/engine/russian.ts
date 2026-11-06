// The Russian command (§2.9). It decides once per turn, at the same moment as the player, from its
// own intelligence picture only (`intel.ru`), never from the true state of the French army.
// The rules are deliberately readable, so that the after-action report can explain what it did.

import { roadDistance, shortestPath } from './graph';
import type { Context } from './scenario';
import type { Force, GameState, LogEntry, NodeId, RussianPlan, Sighting } from './types';
import { note, setPosture, sortedValues } from './util';

interface Seen extends Sighting {
  id: string;
}

function routeTo(ctx: Context, f: Force, dest: NodeId): NodeId[] {
  const from = f.transit ? f.transit.to : f.at;
  const path = shortestPath(ctx.graph, from, dest) ?? [];
  return f.transit ? [from, ...path] : path;
}

/**
 * A strike's road, kept within reach of the base (G-026). A target within the limit is reached by places within it,
 * if any such road leads there; at a target beyond it the march stops at the first place too far out. A column on
 * the road finishes the stretch it is on.
 */
function strikeRoute(ctx: Context, f: Force, target: NodeId, base: NodeId): NodeId[] {
  const limit = ctx.rules.russian.strikeMarchMetres;
  const route = routeTo(ctx, f, target);
  if (limit <= 0) return route;
  const tooFar = (node: NodeId) => roadDistance(ctx.graph, node, base) > limit;
  if (tooFar(target)) {
    const beyond = route.findIndex((node, i) => !(f.transit && i === 0) && tooFar(node));
    return beyond < 0 ? route : route.slice(0, beyond);
  }
  const from = f.transit ? f.transit.to : f.at;
  const inside = shortestPath(ctx.graph, from, target, new Set([...ctx.graph.nodes.keys()].filter((node) => node !== from && tooFar(node))));
  if (inside === null) return route;
  return f.transit ? [from, ...inside] : inside;
}

/** The Russian depot with the largest stock of food: the army's base. */
function baseOf(s: GameState): NodeId | null {
  const depots = sortedValues(s.depots).filter((d) => d.side === 'ru');
  return depots.reduce<NodeId | null>((best, d) => (best === null || d.stock.food > (s.depots[best]?.stock.food ?? 0) ? d.node : best), null);
}

function fallbackOf(s: GameState, ctx: Context, base: NodeId | null): NodeId | null {
  if (base === null) return null;
  const others = sortedValues(s.depots).filter((d) => d.side === 'ru' && d.node !== base);
  let best: NodeId | null = null;
  let bestDistance = Infinity;
  for (const d of others) {
    const distance = roadDistance(ctx.graph, base, d.node);
    if (distance < bestDistance) {
      best = d.node;
      bestDistance = distance;
    }
  }
  return best;
}

/** A French force standing apart from the rest, within reach, and clearly weaker than the main armies. */
function isolatedTarget(ctx: Context, seen: Seen[], base: NodeId, ours: number): Seen | null {
  const r = ctx.rules.russian;
  let best: Seen | null = null;
  let bestDistance = Infinity;
  for (const x of seen) {
    const distance = roadDistance(ctx.graph, base, x.at);
    if (distance > r.strikeReachMetres || ours * 1000 < x.men * r.strikeAdvantagePermille) continue;
    const nearestFriend = Math.min(...seen.filter((y) => y.id !== x.id).map((y) => roadDistance(ctx.graph, x.at, y.at)));
    if (nearestFriend <= r.isolationMetres) continue;
    if (distance < bestDistance) {
      best = x;
      bestDistance = distance;
    }
  }
  return best;
}

export function planRussianTurn(s: GameState, ctx: Context, log: LogEntry[]): void {
  const r = ctx.rules.russian;
  const cmd = s.russianCommand;
  const turn = s.resolution.turn;
  const russians = sortedValues(s.forces).filter((f) => f.side === 'ru' && f.men > 0);
  const total = russians.reduce((n, f) => n + f.men, 0);
  const main = russians.filter((f) => f.men * 1000 >= total * r.mainSharePermille);
  const screens = russians.filter((f) => !main.includes(f));
  const base = baseOf(s);
  const fallback = fallbackOf(s, ctx, base);
  const seen: Seen[] = Object.keys(s.intel.ru)
    .sort()
    .map((id) => ({ id, ...(s.intel.ru[id] as Sighting) }))
    .filter((x) => turn - x.turn <= r.freshTurns);
  const ours = main.reduce((n, f) => n + f.men, 0);
  const threat = base === null ? 0 : seen.filter((x) => roadDistance(ctx.graph, x.at, base) <= r.threatRadiusMetres).reduce((n, x) => n + x.men, 0);
  const resolve = cmd.pressure + cmd.temperament;
  const target = base === null ? null : isolatedTarget(ctx, seen, base, ours);
  const supplied = main.every((f) => f.stock.food >= f.men * r.minFoodDaysToStrike);

  // The decision, in order of priority.
  let plan: RussianPlan;
  if (threat * 1000 > ours * r.dangerPermille) plan = cmd.pressure >= r.mustStandPressure ? 'stand' : 'withdraw';
  else if (target && supplied && resolve >= r.strikeResolve) plan = 'strike';
  else if (threat > 0 && resolve >= r.standResolve) plan = 'stand';
  else plan = 'hold';
  cmd.plan = plan;
  cmd.target = plan === 'strike' && target ? target.at : null;
  // Kept in the log for the after-action report; the interface must not show it during play.
  note(s, log, 'russianPlan', { plan, target: cmd.target, pressure: cmd.pressure, threat, ours });

  for (const f of main) {
    if (f.battle !== null) continue;
    const home = base !== null && roadDistance(ctx.graph, f.at, base) > r.homeRadiusMetres ? routeTo(ctx, f, base) : [];
    if (plan === 'strike' && cmd.target && base !== null) {
      f.route = strikeRoute(ctx, f, cmd.target, base);
      f.engagement = 'seek';
      f.pace = 'steady';
      setPosture(f, 'concentrated', ctx.rules);
    } else if (plan === 'withdraw' && fallback) {
      f.route = routeTo(ctx, f, fallback);
      f.engagement = 'avoid';
      f.pace = 'steady';
      setPosture(f, 'concentrated', ctx.rules);
    } else if (plan === 'stand') {
      f.route = home;
      f.engagement = 'accept';
      setPosture(f, 'concentrated', ctx.rules);
    } else {
      f.route = home;
      f.engagement = 'accept';
      if (home.length === 0) setPosture(f, 'dispersed', ctx.rules);
    }
  }

  // Screening detachments watch the approaches and fall back from clearly superior enemies.
  for (const f of screens) {
    if (f.battle !== null) continue;
    f.engagement = 'avoid';
    const pressing = seen.filter((x) => roadDistance(ctx.graph, f.at, x.at) <= r.threatRadiusMetres / 2).reduce((n, x) => n + x.men, 0);
    if (pressing * 1000 > f.men * r.screenOddsPermille && base !== null && f.at !== base) {
      f.route = routeTo(ctx, f, base).slice(0, 1);
      setPosture(f, 'concentrated', ctx.rules);
    } else {
      f.route = [];
      setPosture(f, 'dispersed', ctx.rules);
    }
  }
}

/** End of turn: time and French boots on Smolensk province soil raise the pressure; a battle relieves it. */
export function updatePressure(s: GameState, ctx: Context, log: LogEntry[]): void {
  const r = ctx.rules.russian;
  const cmd = s.russianCommand;
  const places = ctx.scenario.pressurePlaces ?? [];
  const occupied = places.filter((p) => sortedValues(s.forces).some((f) => f.side === 'fr' && f.men > 0 && f.transit === null && f.at === p)).length;
  const next = cmd.pressure + r.pressurePerTurn + occupied * r.pressurePerOccupiedPlace - (cmd.foughtThisTurn ? r.pressureReliefAfterBattle : 0);
  cmd.pressure = Math.max(0, Math.min(100, next));
  cmd.foughtThisTurn = false;
  note(s, log, 'pressure', { pressure: cmd.pressure, occupied });
}
