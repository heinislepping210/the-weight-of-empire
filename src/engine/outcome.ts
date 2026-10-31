// Provisional outcome evaluation (§2.13). Three things are judged separately — what happened to the
// Russian main army, what ground the French hold, and the state of the French army — then combined.
// Thresholds are game assumptions (G-004). "Cut off" is judged on the final positions, a simplification
// of the "held for two sub-steps" rule until the engine tracks it.

import { shortestPath } from './graph';
import type { Context } from './scenario';
import type { Force, GameState, NodeId, Side } from './types';
import { sortedValues } from './util';

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

export function evaluate(start: GameState, end: GameState, ctx: Context): Outcome {
  const r = ctx.rules.outcome;
  const keyPlaces = ctx.scenario.keyPlaces ?? [];
  const exits = ctx.scenario.exitPlaces ?? [];

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
  const horses = (forces: Force[]) => forces.reduce((n, f) => n + f.horses, 0);
  const frenchHorsesLostPermille = Math.floor(((horses(frStart) - horses(frEnd)) * 1000) / Math.max(1, horses(frStart)));

  const holders = (side: Side, node: NodeId) => men(sideOf(end, side).filter((f) => f.transit === null && f.at === node));
  const wonAgainstMain = sortedValues(end.battles).some((b) => b.winner === 'fr' && b.sides.ru.some((id) => mainIds.includes(id)));

  // Cut off: no Russian main army can reach the end of its line of retreat without passing a French block.
  const blocks = new Set(sortedValues(end.forces).filter((f) => f.side === 'fr' && f.transit === null).map((f) => f.at).filter((n) => holders('fr', n) >= r.blockMen));
  const liveMains = sideOf(end, 'ru').filter((f) => mainIds.includes(f.id) && f.men > 0);
  const cutOff =
    exits.length > 0 &&
    liveMains.length > 0 &&
    liveMains.every((f) => !exits.includes(f.at) && exits.every((x) => shortestPath(ctx.graph, f.at, x, new Set([...blocks].filter((b) => b !== f.at))) === null));

  const russianHoldsKey = keyPlaces.some((p) => holders('ru', p) > 0);
  const holdsKeyGround = keyPlaces.some((p) => holders('fr', p) > 0 && holders('ru', p) === 0);

  let russian: RussianResult;
  if (russianMainLostPermille >= r.decisiveLossPermille && wonAgainstMain) russian = 'decisivelyDefeated';
  else if (cutOff) russian = 'cutOff';
  else if (keyPlaces.length > 0 && !russianHoldsKey && russianMainLostPermille >= r.damagedLossPermille) russian = 'forcedOut';
  else if (russianMainLostPermille >= r.damagedLossPermille) russian = 'damaged';
  else russian = 'intact';

  const frMen = men(frEnd);
  const cohesion = frMen === 0 ? 0 : Math.floor(frEnd.reduce((n, f) => n + f.cohesion * f.men, 0) / frMen);
  const foodDays = frEnd.reduce((n, f) => n + f.stock.food, 0) / Math.max(1, frMen);
  const capable = frMen * 1000 >= men(frStart) * r.capableMenPermille && cohesion >= r.capableCohesion;
  const sustainable = foodDays >= r.sustainableFoodDays;
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
    `Russian main armies lost ${pct(russianMainLostPermille)} of their strength${wonAgainstMain ? ', and were beaten in at least one battle' : ''}.`,
    cutOff ? 'Their line of retreat is blocked.' : 'Their line of retreat is open.',
    holdsKeyGround ? 'French troops hold the objective ground.' : 'The objective ground is not in French hands.',
    `The French army lost ${pct(frenchMenLostPermille)} of its men and ${pct(frenchHorsesLostPermille)} of its horses; it has ${foodDays.toFixed(1)} days' food in hand.`,
    `${capable ? 'It remains capable of further operations' : 'It is too weakened for further operations'}, ${sustainable ? 'its supply is sustainable' : 'its supply is not sustainable'}, and ${secure ? 'it is secure' : 'it is not secure'}.`,
  ];
  if (end.halted) reasons.push('A halt for the season was declared.');
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
