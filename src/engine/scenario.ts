import { buildGraph, type EdgeDef, type Graph, type NodeDef } from './graph';
import { RULES, type Rules } from './rules';
import type { Convoy, Depot, District, Engagement, Force, ForceId, GameState, NodeId, Pace, RoadCondition, Side, Supplies } from './types';
import { emptySupplies } from './util';

export interface ForceInit {
  id: ForceId;
  side: Side;
  name: string;
  at: NodeId;
  men: number;
  horses: number;
  wagons: number;
  stock: Supplies;
  fatigue?: number;
  cohesion?: number;
  pace?: Pace;
  engagement?: Engagement;
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
  serves: ForceId;
  wagons: number;
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
}

/** Everything resolution needs besides the state itself; never saved, rebuilt from the scenario. */
export interface Context {
  rules: Rules;
  scenario: ScenarioDef;
  graph: Graph;
}

export function createContext(scenario: ScenarioDef, rules: Rules = RULES): Context {
  return { rules, scenario, graph: buildGraph(scenario.nodes, scenario.edges) };
}

export function newGame(ctx: Context, seed: number): GameState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be a 32-bit unsigned integer');
  const { scenario, rules, graph } = ctx;

  const forces: Record<ForceId, Force> = {};
  for (const f of scenario.forces) {
    if (!graph.nodes.has(f.at)) throw new Error(`force ${f.id} starts at unknown node ${f.at}`);
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
      battle: null,
      men: f.men,
      horses: f.horses,
      wagons: f.wagons,
      fatigue: f.fatigue ?? 200,
      cohesion: f.cohesion ?? 800,
      stock: { ...f.stock },
      incoming: emptySupplies(),
      marchedToday: false,
      movedThisSlot: false,
    };
  }

  const depots: Record<NodeId, Depot> = {};
  for (const d of scenario.depots) depots[d.node] = { node: d.node, side: d.side, stock: { ...d.stock }, incoming: emptySupplies() };

  const convoys: Record<string, Convoy> = {};
  for (const c of scenario.convoys) {
    if (!depots[c.home] || !forces[c.serves]) throw new Error(`convoy ${c.id} needs a home depot and a force to serve`);
    convoys[c.id] = { id: c.id, side: c.side, home: c.home, serves: c.serves, leg: 'loading', at: c.home, transit: null, route: [], wagons: c.wagons, cargo: emptySupplies() };
  }

  const districts: Record<NodeId, District> = {};
  for (const id of graph.nodes.keys()) districts[id] = { ...(scenario.districts[id] ?? { food: 0, fodder: 0 }) };
  const roads: Record<string, RoadCondition> = {};
  for (const id of graph.edges.keys()) roads[id] = 'dry';

  return {
    schema: 1,
    rulesVersion: rules.version,
    scenarioId: scenario.id,
    seed,
    resolution: { turn: 1, slot: 0, stage: 'orders', encounterQueue: null, battleSeq: 0 },
    forces,
    convoys,
    depots,
    districts,
    roads,
    rainToday: false,
    battles: {},
    ledger: {
      foraged: { food: 0, fodder: 0 },
      consumed: { food: 0, fodder: 0 },
      ammoSpent: { fr: 0, ru: 0 },
      menLost: { battle: 0, sickness: 0, straggling: 0, withdrawal: 0 },
      horsesLost: 0,
    },
    ended: null,
  };
}
