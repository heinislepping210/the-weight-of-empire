// The theatre's real geography (MAP_AND_GEOGRAPHY §3.7) against the game's places and roads. The rivers come from
// Natural Earth at 1:10 million, good to about a kilometre: enough for which bank a town stands on, not for the
// streets of a town on both banks. Findings that would change the rules are listed here for a decision, not fixed.

import { describe, expect, it } from 'vitest';
import geoJson from '../../src/data/vitebsk/geo.json';
import { PLACES } from '../../src/data/vitebsk/places';
import { ROADS } from '../../src/data/vitebsk/roads';
import { decodeRelief, heightAt, type GeoData, type LonLat } from '../../src/map/geo';
import { MAP_HEIGHT, MAP_WIDTH, project } from '../../src/ui/projection';

const geo = geoJson as unknown as GeoData;
const K = Math.cos((54.8 * Math.PI) / 180);
const place = (id: string): LonLat => {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return [p.lon, p.lat];
};
const linesOf = (name: string) => geo.rivers.filter((r) => r.name === name).flatMap((r) => r.lines);

/** Kilometres from a point to the nearest point of any of the lines. */
function kmTo(p: LonLat, lines: readonly (readonly LonLat[])[]): number {
  let best = Infinity;
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const [a, b] = [l[i - 1] as LonLat, l[i] as LonLat];
      const [ax, ay, bx, by, px, py] = [a[0] * K, a[1], b[0] * K, b[1], p[0] * K, p[1]];
      const [dx, dy] = [bx - ax, by - ay];
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy) * 111.32);
    }
  }
  return best;
}

/** Whether the straight line between two places crosses any of the lines. */
function crosses(p: LonLat, q: LonLat, lines: readonly (readonly LonLat[])[]): boolean {
  const side = (u: LonLat, v: LonLat, w: LonLat) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
  return lines.some((l) => l.some((_, i) => i > 0 && side(p, q, l[i - 1] as LonLat) * side(p, q, l[i] as LonLat) < 0 && side(l[i - 1] as LonLat, l[i] as LonLat, p) * side(l[i - 1] as LonLat, l[i] as LonLat, q) < 0));
}

/** The river's latitude at a longitude, where it flows roughly west: north of it is the north bank. */
function riverLatAt(lon: number, lines: readonly (readonly LonLat[])[]): number[] {
  const out: number[] = [];
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const [a, b] = [l[i - 1] as LonLat, l[i] as LonLat];
      if ((a[0] - lon) * (b[0] - lon) <= 0 && a[0] !== b[0]) out.push(a[1] + ((lon - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
    }
  }
  return out;
}

const NAMED = ['Dnieper', 'Western Dvina', 'Kasplya', 'Sozh', 'Pronya'];

/**
 * Roads whose straight line crosses a named river with no crossing marked, each with why. `finding` marks one that
 * may need a crossing the rules lack: a decision for you, since a crossing slows a road and makes it a difficult exit.
 */
const UNMARKED: Record<string, { reason: string; finding?: true }> = {
  'vitebsk-liozno': { reason: 'Vitebsk stands on both banks of the Dvina; the crossing is the town\'s own' },
  'vitebsk-babinovichi': { reason: 'Vitebsk stands on both banks of the Dvina; the crossing is the town\'s own' },
  'vitebsk-surazh': { reason: 'Vitebsk stands on both banks of the Dvina; the valley road keeps to one bank' },
  'surazh-velizh': { reason: 'Surazh stands at the mouth of the Kasplya and Velizh on the Dvina; the valley road between them is unverified' },
  'velizh-porechye': { reason: 'Porechye stands on the Kasplya' },
  'surazh-porechye': { reason: 'Porechye stands on the Kasplya' },
  'porechye-smolensk-north': { reason: 'Porechye stands on the Kasplya' },
  'orsha-dubrovna': { reason: 'Orsha stands on the river; the road keeps to the south bank, and the straight line cuts a bend' },
  'smolensk-north-valutino': { reason: 'both on the north bank; the straight line cuts a bend' },
  'liubavichi-rasasna': { reason: 'Rasasna lies south of the Dnieper in the data, so the river falls on this road, while the August 1812 pontoon crossing is set on Rasasna–Liady', finding: true },
  'valutino-dorogobuzh': { reason: 'Valutino lies north of the Dnieper and Dorogobuzh on it; no crossing is marked on the Moscow road (the Solovyovo crossing is the candidate to check in the sources)', finding: true },
  'orsha-mogilev': { reason: 'which bank the Orsha–Mogilev road kept, and where it crossed, is not established', finding: true },
  'mogilev-mstislavl': { reason: 'Mogilev stands on the Dnieper and Mstislavl east of it, beyond the Pronya: neither crossing is marked', finding: true },
};

describe('the geography data', () => {
  it('covers the whole map, with room to spare', () => {
    const nw = project(geo.box.north, geo.box.west);
    const se = project(geo.box.south, geo.box.east);
    expect(nw.x).toBeLessThan(0);
    expect(nw.y).toBeLessThan(0);
    expect(se.x).toBeGreaterThan(MAP_WIDTH);
    expect(se.y).toBeGreaterThan(MAP_HEIGHT);
  });

  it('has a complete relief grid, and the rivers run lower than the land around them', () => {
    const r = geo.relief;
    const h = decodeRelief(r);
    expect(h.length).toBe(r.cols * r.rows);
    expect(Math.min(...h)).toBeGreaterThan(100);
    expect(Math.max(...h)).toBeLessThan(350);
    // A grid turned the wrong way would put the Dnieper on the uplands.
    const along = linesOf('Dnieper').flatMap((l) => l.map((p) => heightAt(r, h, p[0], p[1]))).filter((x): x is number => x !== null);
    const mean = h.reduce((n, x) => n + x, 0) / h.length;
    expect(along.reduce((n, x) => n + x, 0) / along.length).toBeLessThan(mean - 15);
  });
});

describe('the rivers and the game\'s places', () => {
  it('the Dnieper passes Orsha, Dubrovna, Rasasna, Smolensk, Dorogobuzh and Mogilev, and the Dvina Vitebsk and Velizh', () => {
    for (const id of ['orsha', 'dubrovna', 'rasasna', 'smolensk', 'smolensk-north', 'dorogobuzh', 'mogilev']) expect(kmTo(place(id), linesOf('Dnieper')), id).toBeLessThan(1.5);
    for (const id of ['vitebsk', 'velizh']) expect(kmTo(place(id), linesOf('Western Dvina')), id).toBeLessThan(1.5);
    expect(kmTo(place('porechye'), linesOf('Kasplya'))).toBeLessThan(1.5);
  });

  it('Smolensk\'s Old Town is on the south bank and its suburb on the north; Dubrovna and Liady south, Valutino north', () => {
    const dn = linesOf('Dnieper');
    const bank = (id: string) => {
      const [lon, lat] = place(id);
      const at = riverLatAt(lon, dn);
      return at.every((x) => lat > x) ? 'north' : at.every((x) => lat < x) ? 'south' : 'both';
    };
    expect([bank('smolensk'), bank('smolensk-north'), bank('dubrovna'), bank('liady'), bank('valutino')]).toEqual(['south', 'north', 'south', 'south', 'north']);
  });

  it('every marked crossing crosses its river, apart from the pontoon at Rasasna (a finding)', () => {
    const lines = NAMED.flatMap(linesOf);
    const marked = ROADS.filter((r) => r.crossing !== null);
    const missed = marked.filter((r) => !crosses(place(r.a), place(r.b), lines)).map((r) => r.id);
    expect(missed).toEqual(['rasasna-liady']);
  });

  it('every road that crosses a named river with no crossing marked is accounted for', () => {
    const lines = NAMED.flatMap(linesOf);
    const unmarked = ROADS.filter((r) => r.crossing === null && crosses(place(r.a), place(r.b), lines)).map((r) => r.id).sort();
    expect(unmarked).toEqual(Object.keys(UNMARKED).sort());
    expect(Object.entries(UNMARKED).filter(([, x]) => x.finding).map(([id]) => id)).toEqual(['liubavichi-rasasna', 'valutino-dorogobuzh', 'orsha-mogilev', 'mogilev-mstislavl']);
  });
});
