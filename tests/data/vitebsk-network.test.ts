import { describe, expect, it } from 'vitest';
import { PLACES } from '../../src/data/vitebsk/places';
import { CANDIDATE_ROADS, ROADS, vitebskNetwork } from '../../src/data/vitebsk/roads';
import { buildGraph, neighboursOf, type Graph } from '../../src/engine/graph';

const graph = (() => {
  const { nodes, edges } = vitebskNetwork();
  return buildGraph(nodes, edges);
})();

/** Is `to` reachable from `from` without entering any of `avoid`? */
function reachable(g: Graph, from: string, to: string, avoid: string[] = []): boolean {
  const seen = new Set([from, ...avoid]);
  const queue = [from];
  while (queue.length > 0) {
    const node = queue.shift() as string;
    if (node === to) return true;
    for (const n of neighboursOf(g, node)) {
      if (!seen.has(n.node)) {
        seen.add(n.node);
        queue.push(n.node);
      }
    }
  }
  return false;
}

describe('Vitebsk–Smolensk network (provisional)', () => {
  it('places are unique, inside the theatre and sourced', () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
    expect(PLACES.length).toBeGreaterThanOrEqual(16);
    expect(PLACES.length).toBeLessThanOrEqual(20);
    for (const p of PLACES) {
      expect(p.lat).toBeGreaterThan(53.6);
      expect(p.lat).toBeLessThan(56.2);
      expect(p.lon).toBeGreaterThan(29.8);
      expect(p.lon).toBeLessThan(33.6);
      if (p.status === 'located') expect(p.wikidata).toMatch(/^Q\d+$/);
      else expect(p.note).toBeTruthy();
    }
  });

  it('stored road lengths match the coordinates (great circle × 1.25, G-007)', () => {
    const at = new Map(PLACES.map((p) => [p.id, p]));
    const rad = Math.PI / 180;
    for (const r of [...ROADS, ...CANDIDATE_ROADS]) {
      const a = at.get(r.a)!;
      const b = at.get(r.b)!;
      const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
      const direct = 2 * 6371008.8 * Math.asin(Math.sqrt(h));
      const factor = r.id === 'smolensk-bridges' ? 1 : 1.25;
      expect(Math.abs(r.metres - direct * factor), r.id).toBeLessThan(60);
    }
  });

  it('every road is either traced on a period map or marked provisional with its basis', () => {
    for (const r of ROADS) expect(r.status === 'traced' || r.basis.length > 0).toBe(true);
  });

  it('is one connected network', () => {
    for (const p of PLACES) expect(reachable(graph, 'vitebsk', p.id), p.id).toBe(true);
  });

  it('offers three genuinely different approaches from Vitebsk to Smolensk (G1)', () => {
    // The Rudnia road, without the southern crossing or the Porechye flank
    expect(reachable(graph, 'vitebsk', 'smolensk-north', ['rasasna', 'porechye', 'orsha'])).toBe(true);
    // The southern swing across the Dnieper at Rasasna, avoiding Rudnia and Orsha
    expect(reachable(graph, 'vitebsk', 'smolensk', ['rudnia', 'porechye', 'orsha', 'smolensk-north'])).toBe(true);
    // The northern flank through Porechye, avoiding Rudnia
    expect(reachable(graph, 'vitebsk', 'smolensk-north', ['rudnia', 'liubavichi', 'rasasna', 'orsha'])).toBe(true);
  });

  it('makes the Dnieper and the Smolensk bridges real obstacles (G2)', () => {
    expect(ROADS.find((r) => r.id === 'rasasna-liady')?.crossing).toBe('pontoon');
    // The Moscow road starts from the north bank; from the Old Town it is reached over the bridges, or by the
    // ford at Prudichevo that Junot took (H-022, D-044): a river crossing either way.
    expect(neighboursOf(graph, 'valutino').map((n) => n.node).sort()).toEqual(['dorogobuzh', 'smolensk', 'smolensk-north']);
    expect(ROADS.find((r) => r.id === 'smolensk-prudichevo-valutino')?.crossing).toBe('ford');
    expect(reachable(graph, 'smolensk', 'valutino', ['smolensk-north'])).toBe(true);
  });

  it('candidate roads, if any, are not in the game: offered for what-if runs only', () => {
    for (const r of CANDIDATE_ROADS) {
      expect(ROADS.some((x) => x.id === r.id), r.id).toBe(false);
      expect(r.basis.length, r.id).toBeGreaterThan(0);
    }
    const { edges } = vitebskNetwork({ candidates: true });
    expect(edges.length).toBe(ROADS.length + CANDIDATE_ROADS.length);
  });
});
