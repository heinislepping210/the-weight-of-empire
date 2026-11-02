import { buildGraph, type EdgeDef, type Graph, type NodeDef } from './graph';
import { updateIntel } from './intel';
import { planRussianTurn } from './russian';
import { drawBetween } from './rng';
import { RULES, type Rules } from './rules';
import type { Convoy, Depot, District, Engagement, Force, ForceId, GameState, LogEntry, NodeId, Pace, Posture, RoadCondition, Side, Supplies } from './types';
import { emptySupplies } from './util';

/** A fixed number, or an inclusive range drawn once per game from the seed (scenario variation, §2.12). */
export type Strength = number | readonly [number, number];

export interface ForceInit {
  id: ForceId;
  side: Side;
  name: string;
  at: NodeId;
  men: Strength;
  /** Cavalry, counted within the men; 'all' for a force of horsemen (G-021). By default none. */
  cavalry?: Strength | 'all';
  /** Field guns (G-021). By default none. */
  guns?: Strength;
  /** Fighting quality, permille (G-021): 1000, the default, for the line. */
  quality?: number;
  /** Saddle and artillery horses. */
  horses: Strength;
  wagons: number;
  /** Draught horses for its wagons; by default as many as the wagons need (G-019). */
  draught?: number;
  stock: Supplies;
  fatigue?: number;
  cohesion?: number;
  pace?: Pace;
  engagement?: Engagement;
  posture?: Posture;
}

export interface DepotInit {
  node: NodeId;
  side: Side;
  stock: Supplies;
}

export interface ConvoyInit {
  id: string;
  side: Side;
  home: NodeId;
  /** The force it supplies; leave out for a line train, which starts idle at its home depot. */
  serves?: ForceId;
  wagons: number;
  /** Draught horses; by default as many as the wagons need (G-019). */
  horses?: number;
}

export interface ScenarioDef {
  id: string;
  title: string;
  /** ISO date of day 1 (Gregorian calendar). */
  startDate: string;
  turns: number;
  nodes: NodeDef[];
  edges: EdgeDef[];
  forces: ForceInit[];
  depots: DepotInit[];
  convoys: ConvoyInit[];
  districts: Record<NodeId, District>;
  /** Places whose occupation by the French adds to Russian political pressure (§2.9). */
  pressurePlaces?: NodeId[];
  /** Places that count as "taking the objective ground" in the outcome (§2.13). */
  keyPlaces?: NodeId[];
  /** Ends of the Russian line of retreat (§2.13). */
  exitPlaces?: NodeId[];
  /**
   * Places on the line of retreat east of the Russian army: held by a large enough French force, they cut
   * the Russians off from the exits (§2.13).
   */
  cutOffPlaces?: NodeId[];
}

export type CommandFn = (s: GameState, ctx: Context, log: LogEntry[]) => void;

/** Everything resolution needs besides the state itself; never saved, rebuilt from the scenario. */
export interface Context {
  rules: Rules;
  scenario: ScenarioDef;
  graph: Graph;
  /** Decides the Russian moves at the start of each turn. Tests may substitute a fixed stand-in. */
  russianCommand: CommandFn;
}

export function createContext(scenario: ScenarioDef, rules: Rules = RULES, options: { russianCommand?: CommandFn } = {}): Context {
  return { rules, scenario, graph: buildGraph(scenario.nodes, scenario.edges), russianCommand: options.russianCommand ?? planRussianTurn };
}

function resolveStrength(seed: number, forceId: ForceId, what: string, s: Strength): number {
  return typeof s === 'number' ? s : drawBetween(seed, ['setup', forceId, what], s[0], s[1]);
}

/** A new game. The same seed with fresh `dice` replays the same scenario with different fortunes of war. */
export function newGame(ctx: Context, seed: number, dice: number = seed): GameState {
  for (const n of [seed, dice]) if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error('seed and dice must be 32-bit unsigned integers');
  const { scenario, rules, graph } = ctx;

  const forces: Record<ForceId, Force> = {};
  for (const f of scenario.forces) {
    if (!graph.nodes.has(f.at)) throw new Error(`force ${f.id} starts at unknown node ${f.at}`);
    const men = resolveStrength(seed, f.id, 'men', f.men);
    forces[f.id] = {
      id: f.id,
      side: f.side,
      name: f.name,
      at: f.at,
      transit: null,
      route: [],
      pace: f.pace ?? 'steady',
      engagement: f.engagement ?? 'accept',
      activity: 'halt',
      posture: f.posture ?? 'concentrated',
      gathering: 0,
      battle: null,
      men,
      cavalry: f.cavalry === 'all' ? men : Math.min(men, resolveStrength(seed, f.id, 'cavalry', f.cavalry ?? 0)),
      guns: resolveStrength(seed, f.id, 'guns', f.guns ?? 0),
      quality: f.quality ?? 1000,
      horses: resolveStrength(seed, f.id, 'horses', f.horses),
      wagons: f.wagons,
      draught: f.draught ?? f.wagons * rules.draught.horsesPerWagon,
      fatigue: f.fatigue ?? 200,
      cohesion: f.cohesion ?? 800,
      stock: { ...f.stock },
      incoming: emptySupplies(),
      marchedToday: false,
      movedThisSlot: false,
      arrivedAt: null,
      cameFrom: null,
    };
  }

  const depots: Record<NodeId, Depot> = {};
  for (const d of scenario.depots) depots[d.node] = { node: d.node, side: d.side, stock: { ...d.stock }, incoming: emptySupplies() };

  const convoys: Record<string, Convoy> = {};
  for (const c of scenario.convoys) {
    if (!depots[c.home] || (c.serves !== undefined && !forces[c.serves])) throw new Error(`convoy ${c.id} needs a home depot, and a known force if it serves one`);
    convoys[c.id] = {
      id: c.id,
      side: c.side,
      home: c.home,
      serves: c.serves ?? null,
      feeds: c.serves === undefined ? c.home : null,
      leg: 'loading',
      at: c.home,
      transit: null,
      route: [],
      wagons: c.wagons,
      horses: c.horses ?? c.wagons * rules.draught.horsesPerWagon,
      cargo: emptySupplies(),
    };
  }

  const districts: Record<NodeId, District> = {};
  for (const id of graph.nodes.keys()) districts[id] = { ...(scenario.districts[id] ?? { food: 0, fodder: 0 }) };
  const roads: Record<string, RoadCondition> = {};
  for (const id of graph.edges.keys()) roads[id] = 'dry';

  const command = rules.russian;
  // The main armies are fixed now and judged as such throughout, however their strength changes (D-037).
  const russians = Object.values(forces).filter((f) => f.side === 'ru');
  const russianMen = russians.reduce((n, f) => n + f.men, 0);
  const mainArmies = russians
    .filter((f) => f.men > 0 && f.men * 1000 >= russianMen * command.mainSharePermille)
    .map((f) => f.id)
    .sort();
  const state: GameState = {
    schema: 1,
    rulesVersion: rules.version,
    scenarioId: scenario.id,
    seed,
    dice,
    resolution: { turn: 1, slot: 0, stage: 'orders', encounterQueue: null, battleSeq: 0 },
    forces,
    convoys,
    depots,
    districts,
    roads,
    rainToday: false,
    battles: {},
    intel: { fr: {}, ru: {} },
    // Scenario variation (§2.12): how hard-pressed and how bold the Russian command starts.
    russianCommand: {
      pressure: drawBetween(seed, ['setup', 'pressure'], command.pressureStart[0], command.pressureStart[1]),
      temperament: drawBetween(seed, ['setup', 'temperament'], command.temperament[0], command.temperament[1]),
      plan: 'hold',
      target: null,
      foughtThisTurn: false,
    },
    halted: false,
    cutOff: { held: 0, achievedAt: null },
    mainArmies,
    roadSeq: 0,
    ledger: {
      foraged: { food: 0, fodder: 0 },
      consumed: { food: 0, fodder: 0 },
      ammoSpent: { fr: 0, ru: 0 },
      destroyed: emptySupplies(),
      abandoned: emptySupplies(),
      menLost: { battle: 0, sickness: 0, straggling: 0, withdrawal: 0 },
      horsesLost: 0,
      gunsLost: { captured: 0, abandoned: 0 },
    },
    ended: null,
  };
  updateIntel(state, ctx);
  return state;
}
