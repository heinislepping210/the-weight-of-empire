import type { Crossing, EdgeId, NodeId, RoadClass } from './types';

export interface NodeDef {
  id: NodeId;
  name: string;
}

export interface EdgeDef {
  id: EdgeId;
  a: NodeId;
  b: NodeId;
  metres: number;
  road: RoadClass;
  crossing: Crossing | null;
}

export interface Neighbour {
  node: NodeId;
  edge: EdgeDef;
}

export interface Graph {
  nodes: ReadonlyMap<NodeId, NodeDef>;
  edges: ReadonlyMap<EdgeId, EdgeDef>;
  /** Sorted by node ID. */
  neighbours: ReadonlyMap<NodeId, readonly Neighbour[]>;
}

export function buildGraph(nodes: readonly NodeDef[], edges: readonly EdgeDef[]): Graph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  if (nodeMap.size !== nodes.length) throw new Error('duplicate node ID');
  const edgeMap = new Map<EdgeId, EdgeDef>();
  const neighbours = new Map<NodeId, Neighbour[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (edgeMap.has(e.id)) throw new Error(`duplicate edge ID ${e.id}`);
    if (!nodeMap.has(e.a) || !nodeMap.has(e.b) || e.a === e.b) throw new Error(`edge ${e.id} must join two different known nodes`);
    if (!Number.isInteger(e.metres) || e.metres <= 0) throw new Error(`edge ${e.id} needs a positive whole length in metres`);
    edgeMap.set(e.id, e);
    neighbours.get(e.a)?.push({ node: e.b, edge: e });
    neighbours.get(e.b)?.push({ node: e.a, edge: e });
  }
  for (const list of neighbours.values()) list.sort((x, y) => (x.node < y.node ? -1 : x.node > y.node ? 1 : 0));
  return { nodes: nodeMap, edges: edgeMap, neighbours };
}

export function neighboursOf(g: Graph, node: NodeId): readonly Neighbour[] {
  return g.neighbours.get(node) ?? [];
}

export function edgeBetween(g: Graph, a: NodeId, b: NodeId): EdgeDef | undefined {
  return neighboursOf(g, a).find((n) => n.node === b)?.edge;
}

export function pathMetres(g: Graph, from: NodeId, path: readonly NodeId[]): number {
  let metres = 0;
  let at = from;
  for (const next of path) {
    metres += edgeBetween(g, at, next)?.metres ?? 0;
    at = next;
  }
  return metres;
}

/** Road distance in metres along the shortest path, or Infinity when unreachable. */
export function roadDistance(g: Graph, from: NodeId, to: NodeId): number {
  const path = shortestPath(g, from, to);
  if (path === null) return Infinity;
  let metres = 0;
  let at = from;
  for (const next of path) {
    metres += edgeBetween(g, at, next)?.metres ?? 0;
    at = next;
  }
  return metres;
}

/**
 * Shortest road path by length, as the nodes after `from`, never entering a node in `avoid`.
 * Ties break on node ID, so the result is deterministic.
 */
export function shortestPath(g: Graph, from: NodeId, to: NodeId, avoid: ReadonlySet<NodeId> = new Set()): NodeId[] | null {
  if (from === to) return [];
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const done = new Set<NodeId>(avoid);
  for (;;) {
    let current: NodeId | null = null;
    let best = Infinity;
    for (const [node, d] of dist) {
      if (done.has(node)) continue;
      if (d < best || (d === best && current !== null && node < current)) {
        current = node;
        best = d;
      }
    }
    if (current === null) return null;
    if (current === to) break;
    done.add(current);
    for (const { node, edge } of neighboursOf(g, current)) {
      if (avoid.has(node)) continue;
      const d = best + edge.metres;
      const old = dist.get(node);
      const oldPrev = prev.get(node);
      if (old === undefined || d < old || (d === old && oldPrev !== undefined && current < oldPrev)) {
        dist.set(node, d);
        prev.set(node, current);
      }
    }
  }
  const path: NodeId[] = [];
  for (let n: NodeId | undefined = to; n !== undefined && n !== from; n = prev.get(n)) path.push(n);
  return path.reverse();
}
