// Provisional outcome evaluation (§2.13). Three things are judged separately — what happened to the
// Russian main army, what ground the French hold, and the state of the French army — then combined.
// Thresholds are game assumptions (G-004). The meaning of each ending is fixed by a table of campaign
// states in tests/engine/outcome.test.ts (D-035).

import { neighboursOf, shortestPath } from './graph';
import type { Rules } from './rules';
import type { Context } from './scenario';
import { dayIndex } from './time';
import type { Force, GameState, NodeId, Side } from './types';
import { enemyPresent, sortedValues } from './util';

export type RussianResult = 'decisivelyDefeated' | 'cutOff' | 'forcedOut' | 'damaged' | 'intact';

export type EndingId =
  | 'decisiveSuccess'
  | 'costlyVictory'
  | 'operationalSuccess'
  | 'limitedSuccess'
  | 'successfulConsolidation'
  | 'precariousHalt'
  | 'inconclusive'
  | 'repulse'
  | 'collapse';

export const ENDING_NAMES: Record<EndingId, string> = {
  decisiveSuccess: 'Decisive Success',
  costlyVictory: 'Costly Victory',
  operationalSuccess: 'Operational Success',
  limitedSuccess: 'Limited Success',
  successfulConsolidation: 'Successful Consolidation',
  precariousHalt: 'Precarious Halt',
  inconclusive: 'Inconclusive',
  repulse: 'Repulse',
  collapse: 'Operational Collapse',
};

/** Rank for statistics only (1 is best); the report itself presents trade-offs, not ranks. */
export const ENDING_RANK: Record<EndingId, number> = {
  decisiveSuccess: 1,
  costlyVictory: 2,
  operationalSuccess: 2,
  limitedSuccess: 3,
  successfulConsolidation: 3,
  inconclusive: 4,
  precariousHalt: 4,
  repulse: 5,
  collapse: 6,
};

export interface Outcome {
  ending: EndingId;
  russian: RussianResult;
  holdsKeyGround: boolean;
  capable: boolean;
  sustainable: boolean;
  secure: boolean;
  frenchMenLostPermille: number;
  frenchHorsesLostPermille: number;
  russianMainLostPermille: number;
  /** French army at the end: men-weighted cohesion (0–1000) and days of food in hand. */
  frenchCohesion: number;
  frenchFoodDays: number;
  /** Plain statements of fact behind the verdict. */
  reasons: string[];
}

const men = (forces: Force[]) => forces.reduce((n, f) => n + f.men, 0);
const sideOf = (s: GameState, side: Side) => sortedValues(s.forces).filter((f) => f.side === side);

/** The Russian main armies: each holding at least a set share of the Russian strength. */
export function mainArmyIds(s: GameState, rules: Rules): string[] {
  const ru = sideOf(s, 'ru');
  const total = men(ru);
  return ru.filter((f) => f.men > 0 && f.men * 1000 >= total * rules.russian.mainSharePermille).map((f) => f.id);
}

/**
 * Whether, right now, the French hold a designated place on the Russian line of retreat (§2.13) with enough
 * men, so that no Russian main army can reach the end of that line without passing them. Holding other
 * ground, Smolensk's suburb included, takes the objective but does not cut the Russians off. Tracked
 * sub-step by sub-step during the game.
 */
export function lineOfRetreatBlocked(s: GameState, ctx: Context, mainIds: readonly string[]): boolean {
  const exits = ctx.scenario.exitPlaces ?? [];
  const holders = (node: NodeId) => men(sideOf(s, 'fr').filter((f) => f.transit === null && f.at === node));
  const blocks = new Set((ctx.scenario.cutOffPlaces ?? []).filter((n) => holders(n) >= ctx.rules.outcome.blockMen));
  if (blocks.size === 0) return false;
  const mains = sideOf(s, 'ru').filter((f) => mainIds.includes(f.id) && f.men > 0);
  return (
    exits.length > 0 &&
    mains.length > 0 &&
    mains.every((f) => !exits.includes(f.at) && exits.every((x) => shortestPath(ctx.graph, f.at, x, new Set([...blocks].filter((b) => b !== f.at))) === null))
  );
}

export function evaluate(start: GameState, end: GameState, ctx: Context): Outcome {
  const r = ctx.rules.outcome;
  const keyPlaces = ctx.scenario.keyPlaces ?? [];

  // Main armies are judged by the forces that were main armies at the start.
  const ruStart = sideOf(start, 'ru');
  const ruTotal = men(ruStart);
  const mainIds = ruStart.filter((f) => f.men * 1000 >= ruTotal * ctx.rules.russian.mainSharePermille).map((f) => f.id);
  const mainStart = men(ruStart.filter((f) => mainIds.includes(f.id)));
  const mainEnd = men(sideOf(end, 'ru').filter((f) => mainIds.includes(f.id)));
  const russianMainLostPermille = mainStart === 0 ? 0 : Math.floor(((mainStart - mainEnd) * 1000) / mainStart);

  const frStart = sideOf(start, 'fr');
  const frEnd = sideOf(end, 'fr');
  const frenchMenLostPermille = Math.floor(((men(frStart) - men(frEnd)) * 1000) / Math.max(1, men(frStart)));
  // All the army's horses: saddle, artillery and draught (G-019).
  const horses = (forces: Force[]) => forces.reduce((n, f) => n + f.horses + f.draught, 0);
  const frenchHorsesLostPermille = Math.floor(((horses(frStart) - horses(frEnd)) * 1000) / Math.max(1, horses(frStart)));

  const holders = (side: Side, node: NodeId) => men(sideOf(end, side).filter((f) => f.transit === null && f.at === node));

  // Decisively defeated: losses in battles the French won, killed, wounded and taken, counted over at most
  // a few days — never sickness or straggling, and never the campaign's attrition as a whole (§2.13).
  const won = sortedValues(end.battles)
    .filter((b) => b.winner === 'fr' && b.sides.ru.some((id) => mainIds.includes(id)))
    .map((b) => ({ day: dayIndex(b.startsAt), lost: mainIds.reduce((n, id) => n + (b.losses[id] ?? 0), 0) }));
  const worstWindow = won.reduce((best, w) => Math.max(best, won.filter((x) => x.day >= w.day && x.day < w.day + r.decisiveWindowDays).reduce((n, x) => n + x.lost, 0)), 0);
  const battleLossPermille = mainStart === 0 ? 0 : Math.floor((worstWindow * 1000) / mainStart);

  // Cut off: the line of retreat was blocked for long enough at some point; once achieved, it stands.
  const cutOff = end.cutOff.achievedAt !== null;

  const russianHoldsKey = keyPlaces.some((p) => holders('ru', p) > 0);
  const holdsKeyGround = keyPlaces.some((p) => holders('fr', p) > 0 && holders('ru', p) === 0);

  let russian: RussianResult;
  if (battleLossPermille >= r.decisiveLossPermille) russian = 'decisivelyDefeated';
  else if (cutOff) russian = 'cutOff';
  else if (keyPlaces.length > 0 && !russianHoldsKey && russianMainLostPermille >= r.damagedLossPermille) russian = 'forcedOut';
  else if (russianMainLostPermille >= r.damagedLossPermille) russian = 'damaged';
  else russian = 'intact';

  const frMen = men(frEnd);
  const cohesion = frMen === 0 ? 0 : Math.floor(frEnd.reduce((n, f) => n + f.cohesion * f.men, 0) / frMen);
  const foodDays = frEnd.reduce((n, f) => n + f.stock.food, 0) / Math.max(1, frMen);
  const capable = frMen * 1000 >= men(frStart) * r.capableMenPermille && cohesion >= r.capableCohesion;
  // Sustainable is judged group by group (§2.13), as a forecast at its final position: food in hand, on its
  // way by wagon, in its own depot where it stands (shared by men among the groups there), and what it can
  // forage there over the coming days, bounded by what the districts in reach still hold. The army's average
  // must not hide a starving group.
  const forageFor = (f: Force): number => {
    if (f.transit !== null) return 0;
    const fr = ctx.rules.forage;
    const dispersed = f.posture === 'dispersed';
    const reach = dispersed ? neighboursOf(ctx.graph, f.at).filter((n) => n.edge.metres <= 2 * fr.reachMetres && !enemyPresent(end, f.side, n.node)).map((n) => n.node) : [];
    const held = [f.at, ...reach].reduce((n, node) => n + (end.districts[node]?.food ?? 0), 0);
    const daily = Math.floor((Math.floor((f.men * fr.food.halt) / 1000) * 2 * (dispersed ? fr.dispersedPermille : 1000)) / 1000);
    return Math.min(held, daily * r.sustainableFoodDays);
  };
  const supplyOf = (f: Force): number => {
    const onTheWay = sortedValues(end.convoys).filter((c) => c.serves === f.id && c.leg === 'outbound').reduce((n, c) => n + c.cargo.food, 0);
    const depot = f.transit === null ? end.depots[f.at] : undefined;
    const sharers = depot && depot.side === f.side ? frEnd.filter((g) => g.men > 0 && g.transit === null && g.at === f.at) : [];
    const fromDepot = depot && sharers.length > 0 ? Math.floor((depot.stock.food * f.men) / Math.max(1, men(sharers))) : 0;
    return f.stock.food + f.incoming.food + onTheWay + fromDepot + forageFor(f);
  };
  const unsupplied = frEnd.filter((f) => f.men > 0 && supplyOf(f) < f.men * r.sustainableFoodDays);
  const sustainable = unsupplied.length === 0;
  const secure = frEnd.every((f) => f.battle === null) && frEnd.every((f) => f.transit !== null || holders('ru', f.at) === 0);
  const lostBattle = sortedValues(end.battles).some((b) => b.winner === 'ru');

  let ending: EndingId;
  if (cohesion < r.collapseCohesion || frenchMenLostPermille >= r.collapseLossPermille) ending = 'collapse';
  else if (russian === 'decisivelyDefeated' || russian === 'cutOff') ending = capable && sustainable ? 'decisiveSuccess' : 'costlyVictory';
  else if (russian === 'forcedOut' && capable && sustainable && secure) ending = 'operationalSuccess';
  else if (holdsKeyGround) ending = 'limitedSuccess';
  else if (end.halted) ending = capable && sustainable && secure ? 'successfulConsolidation' : 'precariousHalt';
  else if (!capable || lostBattle) ending = 'repulse';
  else ending = 'inconclusive';

  const pct = (p: number) => `${(p / 10).toFixed(1)}%`;
  const reasons = [
    russian === 'decisivelyDefeated'
      ? `In battles they lost within ${r.decisiveWindowDays} days, the Russian main armies lost ${pct(battleLossPermille)} of their strength; over the whole campaign ${pct(russianMainLostPermille)}.`
      : `The Russian main armies lost ${pct(russianMainLostPermille)} of their strength over the campaign; in battles they lost within ${r.decisiveWindowDays} days, ${pct(battleLossPermille)}.`,
    cutOff ? 'Their line of retreat was blocked long enough to cut them off.' : 'Their line of retreat stayed open.',
    holdsKeyGround ? 'French troops hold the objective ground.' : 'The objective ground is not in French hands.',
    `The French army lost ${pct(frenchMenLostPermille)} of its men and ${pct(frenchHorsesLostPermille)} of its horses; it has ${foodDays.toFixed(1)} days' food in hand.`,
    `${capable ? 'It remains capable of further operations' : 'It is too weakened for further operations'}, ${sustainable ? 'its supply is sustainable' : 'its supply is not sustainable'}, and ${secure ? 'it is secure' : 'it is not secure'}.`,
  ];
  if (unsupplied.length > 0) reasons.push(`Food for less than ${r.sustainableFoodDays} days, counting what it carries, what is on its way, its depot and what it can forage: ${unsupplied.map((f) => f.name).join('; ')}.`);
  if (end.halted) reasons.push(russian === 'decisivelyDefeated' || russian === 'cutOff' ? 'A halt for the season was declared; the victory over the Russian army still stands.' : 'A halt for the season was declared.');
  return {
    ending,
    russian,
    holdsKeyGround,
    capable,
    sustainable,
    secure,
    frenchMenLostPermille,
    frenchHorsesLostPermille,
    russianMainLostPermille,
    frenchCohesion: cohesion,
    frenchFoodDays: Math.round(foodDays * 10) / 10,
    reasons,
  };
}
