// Provisional outcome evaluation (§2.13). Three things are judged separately — what happened to the
// Russian main army, what ground the French hold, and the state of the French army — then combined.
// Thresholds are game assumptions (G-004). The meaning of each ending is fixed by a table of campaign
// states in tests/engine/outcome.test.ts (D-035).

import { takenUp, usableWagons, withinCapacity } from './carriage';
import { neighboursOf, roadDistance, shortestPath } from './graph';
import type { Context } from './scenario';
import { dayIndex, slotIndex } from './time';
import type { Convoy, Force, GameState, NodeId, Side } from './types';
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
  /** The line of retreat was cut at some point; whether it was still cut at the end; and what the main armies lost in battle after it was cut (permille of their starting strength). */
  roadCut: boolean;
  stillCutOff: boolean;
  lostSinceCutPermille: number;
  /** French army at the end: men-weighted cohesion (0–1000) and days of food in hand. */
  frenchCohesion: number;
  frenchFoodDays: number;
  /** Plain statements of fact behind the verdict. */
  reasons: string[];
}

const men = (forces: Force[]) => forces.reduce((n, f) => n + f.men, 0);
const sideOf = (s: GameState, side: Side) => sortedValues(s.forces).filter((f) => f.side === side);

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

  // Main armies are the forces that were main armies at the start (D-037).
  const ruStart = sideOf(start, 'ru');
  const mainIds = start.mainArmies;
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

  // Decisively defeated: losses in battles the French won and in which the Russians broke, killed, wounded
  // and taken, counted over at most a few days — never sickness or straggling, never the campaign's attrition
  // as a whole, and never an orderly withdrawal however costly, as at Borodino (§2.13, D-037).
  const won = sortedValues(end.battles)
    .filter((b) => b.winner === 'fr' && b.routed.includes('ru') && b.sides.ru.some((id) => mainIds.includes(id)))
    .map((b) => ({ day: dayIndex(b.startsAt), lost: mainIds.reduce((n, id) => n + (b.losses[id] ?? 0), 0) }));
  const worstWindow = won.reduce((best, w) => Math.max(best, won.filter((x) => x.day >= w.day && x.day < w.day + r.decisiveWindowDays).reduce((n, x) => n + x.lost, 0)), 0);
  const battleLossPermille = mainStart === 0 ? 0 : Math.floor((worstWindow * 1000) / mainStart);

  // Cut off: the line of retreat was blocked for long enough at some point. What that earns depends on
  // whether they were still cut off at the end, and what breaking out cost them in battle (`cutOffCredit`).
  const cutAt = end.cutOff.achievedAt;
  const roadCut = cutAt !== null;
  const stillCutOff = roadCut && lineOfRetreatBlocked(end, ctx, mainIds);
  const lostSinceCut = cutAt === null ? 0 : sortedValues(end.battles).filter((b) => slotIndex(b.startsAt) >= slotIndex(cutAt)).reduce((n, b) => n + mainIds.reduce((m, id) => m + (b.losses[id] ?? 0), 0), 0);
  const lostSinceCutPermille = mainStart === 0 ? 0 : Math.floor((lostSinceCut * 1000) / mainStart);
  const costlyEscape = roadCut && !stillCutOff && lostSinceCutPermille >= r.damagedLossPermille;
  const cutOff = r.cutOffCredit === 'stands' ? roadCut : stillCutOff;
  const forcedOutByCut = r.cutOffCredit === 'graded' && costlyEscape;

  const russianHoldsKey = keyPlaces.some((p) => holders('ru', p) > 0);
  const holdsKeyGround = keyPlaces.some((p) => holders('fr', p) > 0 && holders('ru', p) === 0);

  let russian: RussianResult;
  if (battleLossPermille >= r.decisiveLossPermille) russian = 'decisivelyDefeated';
  else if (cutOff) russian = 'cutOff';
  else if (forcedOutByCut || (keyPlaces.length > 0 && !russianHoldsKey && russianMainLostPermille >= r.damagedLossPermille)) russian = 'forcedOut';
  else if (russianMainLostPermille >= r.damagedLossPermille) russian = 'damaged';
  else russian = 'intact';

  const frMen = men(frEnd);
  const cohesion = frMen === 0 ? 0 : Math.floor(frEnd.reduce((n, f) => n + f.cohesion * f.men, 0) / frMen);
  const foodDays = frEnd.reduce((n, f) => n + f.stock.food, 0) / Math.max(1, frMen);
  const capable = frMen * 1000 >= men(frStart) * r.capableMenPermille && cohesion >= r.capableCohesion;
  // Sustainable is judged group by group (§2.13), as a forecast at its final position, day by day over the
  // coming days: food in hand; in its own depot where it stands (shared by men among the groups there); what it
  // can forage, each district's food shared among the groups that reach it, so that no ration counts twice; and
  // what its wagon train brings, from the day it can arrive and only as much as the group can take (D-037,
  // D-040). Every day must be covered: food arriving tomorrow does not feed today. A group in battle forages
  // nothing. The army's average must not hide a starving group.
  const fr = ctx.rules.forage;
  const days = r.sustainableFoodDays;
  const groups = frEnd.filter((f) => f.men > 0);
  const reachOf = (f: Force): NodeId[] => {
    if (f.transit !== null || f.battle !== null) return [];
    if (f.posture !== 'dispersed') return [f.at];
    return [f.at, ...neighboursOf(ctx.graph, f.at).filter((n) => n.edge.metres <= 2 * fr.reachMetres && !enemyPresent(end, f.side, n.node)).map((n) => n.node)];
  };
  const dailyForage = (f: Force): number =>
    reachOf(f).length === 0 ? 0 : Math.floor((Math.floor((f.men * fr.food.halt) / 1000) * 2 * (f.posture === 'dispersed' ? fr.dispersedPermille : 1000)) / 1000);
  const wantAt = new Map<NodeId, number>();
  for (const g of groups) for (const node of reachOf(g)) wantAt.set(node, (wantAt.get(node) ?? 0) + dailyForage(g) * days);
  /** Its share of the districts in reach, over the whole horizon. */
  const forageShare = (f: Force): number => {
    const want = dailyForage(f) * days;
    if (want === 0) return 0;
    return Math.min(want, reachOf(f).reduce((n, node) => n + Math.floor(((end.districts[node]?.food ?? 0) * want) / Math.max(1, wantAt.get(node) ?? 0)), 0));
  };
  /** Days until a wagon train can reach the group: 0 if it is there, Infinity if it has no horses to draw it. */
  const daysAway = (c: Convoy, f: Force): number => {
    if (usableWagons(c.wagons, c.horses, ctx.rules) === 0) return Infinity;
    const target = f.transit ? f.transit.to : f.at;
    const onRoad = c.transit ? (ctx.graph.edges.get(c.transit.edge)?.metres ?? 0) - c.transit.metres : 0;
    return Math.ceil((onRoad + roadDistance(ctx.graph, c.transit ? c.transit.to : c.at, target)) / (ctx.rules.convoy.metresPerSlot * 2));
  };
  const drawn = (c: Convoy): number =>
    withinCapacity(c.cargo, usableWagons(c.wagons, c.horses, ctx.rules) * ctx.rules.convoy.payloadGrams, ctx.rules).kept.food;
  /** Whether the group has food for every one of the coming days. */
  const suppliedEveryDay = (f: Force): boolean => {
    const depot = f.transit === null ? end.depots[f.at] : undefined;
    const sharers = depot && depot.side === f.side ? frEnd.filter((g) => g.men > 0 && g.transit === null && g.at === f.at) : [];
    const fromDepot = depot && sharers.length > 0 ? Math.floor((depot.stock.food * f.men) / Math.max(1, men(sharers))) : 0;
    const share = forageShare(f);
    const trains = sortedValues(end.convoys).filter((c) => c.serves === f.id && c.leg === 'outbound');
    for (let d = 1; d <= days; d++) {
      const arrived = trains.filter((c) => daysAway(c, f) <= d).reduce((n, c) => n + drawn(c), 0);
      const taken = takenUp(f, { food: arrived, fodder: 0, ammo: 0 }, ctx.rules).food;
      const foraged = Math.min(share, dailyForage(f) * d);
      if (f.stock.food + f.incoming.food + fromDepot + foraged + taken < f.men * d) return false;
    }
    return true;
  };
  const unsupplied = groups.filter((f) => !suppliedEveryDay(f));
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
      ? `In battles in which they broke, within ${r.decisiveWindowDays} days, the Russian main armies lost ${pct(battleLossPermille)} of their strength; over the whole campaign ${pct(russianMainLostPermille)}.`
      : `The Russian main armies lost ${pct(russianMainLostPermille)} of their strength over the campaign; in battles in which they broke, within ${r.decisiveWindowDays} days, ${pct(battleLossPermille)}.`,
    !roadCut
      ? 'Their line of retreat stayed open.'
      : stillCutOff
        ? 'Their line of retreat was cut, and they were still cut off when the campaign ended.'
        : costlyEscape
          ? `Their line of retreat was cut, but they broke out, losing ${pct(lostSinceCutPermille)} of their strength in battle after it was cut.`
          : 'Their line of retreat was cut for a time, but they got away without heavy loss.',
    holdsKeyGround ? 'French troops hold the objective ground.' : 'The objective ground is not in French hands.',
    `The French army lost ${pct(frenchMenLostPermille)} of its men and ${pct(frenchHorsesLostPermille)} of its horses; it has ${foodDays.toFixed(1)} days' food in hand.`,
    `${capable ? 'It remains capable of further operations' : 'It is too weakened for further operations'}, ${sustainable ? 'its supply is sustainable' : 'its supply is not sustainable'}, and ${secure ? 'it is secure' : 'it is not secure'}.`,
  ];
  if (unsupplied.length > 0) reasons.push(`Food for less than ${r.sustainableFoodDays} days, counting what it carries, what its wagon train can bring in time, its depot and its share of the forage within reach: ${unsupplied.map((f) => f.name).join('; ')}.`);
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
    roadCut,
    stillCutOff,
    lostSinceCutPermille,
    frenchCohesion: cohesion,
    frenchFoodDays: Math.round(foodDays * 10) / 10,
    reasons,
  };
}
