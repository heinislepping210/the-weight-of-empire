// The painted terrain (M2, V1): the maths behind the watercolour relief and the engraved hachures, kept apart from
// the canvas and the SVG so it can be tested. Heights come from the relief grid (src/map/geo.ts). The theatre is
// gentle country, 130 to 290 m, so slopes are exaggerated for the eye; nothing here feeds the rules.

import type { GeoData } from './geo';

/** Vertical exaggeration for the shading: the land between the Dvina and the Dnieper rises only a few metres a km. */
export const EXAGGERATION = 10;
/** The light comes from the north-west, high in the sky, as on engraved maps. */
const LIGHT = { azimuth: (315 * Math.PI) / 180, altitude: (45 * Math.PI) / 180 };

/**
 * The heights smoothed by repeated 3 × 3 averaging, about 2 km across after two passes. SRTM measures the top of
 * the tree canopy, so today's woods show as bumps a few metres high; smoothing keeps the valleys and drops those.
 */
export function smooth(r: GeoData['relief'], h: Float32Array, passes = 2): Float32Array {
  let cur = h;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(cur.length);
    for (let row = 0; row < r.rows; row++) {
      for (let col = 0; col < r.cols; col++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const [c, w] = [col + dx, row + dy];
            if (c < 0 || w < 0 || c >= r.cols || w >= r.rows) continue;
            sum += cur[w * r.cols + c] as number;
            n++;
          }
        }
        next[row * r.cols + col] = sum / n;
      }
    }
    cur = next;
  }
  return cur;
}

/** Metres between cell centres, east to west and north to south, at the grid's middle latitude. */
export function cellMetres(r: GeoData['relief']): { dx: number; dy: number } {
  const lat = r.north - (r.rows * r.dLat) / 2;
  return { dx: r.dLon * 111_320 * Math.cos((lat * Math.PI) / 180), dy: r.dLat * 111_320 };
}

/** The slope at a cell, in metres of height per metre east and per metre south, from its neighbours. */
export function gradientAt(r: GeoData['relief'], h: Float32Array, col: number, row: number): { east: number; south: number } {
  const { dx, dy } = cellMetres(r);
  const at = (c: number, w: number) => h[Math.max(0, Math.min(r.rows - 1, w)) * r.cols + Math.max(0, Math.min(r.cols - 1, c))] as number;
  return { east: (at(col + 1, row) - at(col - 1, row)) / (2 * dx), south: (at(col, row + 1) - at(col, row - 1)) / (2 * dy) };
}

/** Lambertian shading, 0 dark to 1 lit; flat ground gives the sine of the light's altitude. */
export function shade(g: { east: number; south: number }, exaggeration = EXAGGERATION): number {
  // The surface normal, x east, y north, z up.
  const nx = -g.east * exaggeration;
  const ny = g.south * exaggeration;
  const len = Math.hypot(nx, ny, 1);
  const lx = Math.sin(LIGHT.azimuth) * Math.cos(LIGHT.altitude);
  const ly = Math.cos(LIGHT.azimuth) * Math.cos(LIGHT.altitude);
  const lz = Math.sin(LIGHT.altitude);
  return Math.max(0, (nx * lx + ny * ly + lz) / len);
}

/** A repeatable value in [0, 1) for integer coordinates: the grain of the paper and the washes. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374_761_393) + Math.imul(y | 0, 668_265_263) + Math.imul(seed | 0, 2_147_483_647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

/** Smooth noise in [0, 1): watercolour blotches, interpolated between hashed lattice points `size` apart. */
export function blotch(x: number, y: number, size: number, seed = 0): number {
  const fx = x / size;
  const fy = y / size;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const s = (t: number) => t * t * (3 - 2 * t);
  const tx = s(fx - x0);
  const ty = s(fy - y0);
  const a = hash2(x0, y0, seed) * (1 - tx) + hash2(x0 + 1, y0, seed) * tx;
  const b = hash2(x0, y0 + 1, seed) * (1 - tx) + hash2(x0 + 1, y0 + 1, seed) * tx;
  return a * (1 - ty) + b * ty;
}

/**
 * Metres of fall per kilometre below which ground is left unhatched. Once smoothed (`smooth`), half this country
 * falls less than 3.4 m in a km; from 6 m is the steepest fifth, the valley sides an engraver would hatch.
 */
export const MIN_FALL = 6;

/**
 * A line drawn with its corners rounded (Chaikin's corner cutting, two rounds), for display only: the source's
 * rivers are generalised to straight runs of a few kilometres, which look ruled at the local zoom. The ends stay put.
 */
export function rounded<P extends { x: number; y: number }>(points: readonly P[], rounds = 2): { x: number; y: number }[] {
  let cur: { x: number; y: number }[] = points.map((p) => ({ x: p.x, y: p.y }));
  for (let k = 0; k < rounds && cur.length > 2; k++) {
    const next = [cur[0] as { x: number; y: number }];
    for (let i = 0; i < cur.length - 1; i++) {
      const [a, b] = [cur[i] as { x: number; y: number }, cur[i + 1] as { x: number; y: number }];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(cur[cur.length - 1] as { x: number; y: number });
    cur = next;
  }
  return cur;
}

/** One engraved stroke: from a point, down the slope, in map units. */
export interface Hachure {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A rectangle of the map, in map units. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The part of the map whose hachures are drawn: the view and a margin of `margin` of its size on each side, snapped
 * to steps of a quarter of the view so that a slow pan does not redraw the strokes on every frame.
 */
export function strokeWindow(view: { x: number; y: number; width: number; height: number }, margin = 0.25): Rect {
  const step = view.width / 4;
  const snap = (v: number, up: boolean) => (up ? Math.ceil(v / step) : Math.floor(v / step)) * step;
  return {
    x0: snap(view.x - view.width * margin, false),
    y0: snap(view.y - view.height * margin, false),
    x1: snap(view.x + view.width * (1 + margin), true),
    y1: snap(view.y + view.height * (1 + margin), true),
  };
}

/** The hachures that start within a rectangle, as one SVG path: drawing only what can be seen keeps zooming smooth. */
export function strokesPath(strokes: readonly Hachure[], rect: Rect): string {
  let d = '';
  for (const h of strokes) {
    if (h.x0 < rect.x0 || h.y0 < rect.y0 || h.x0 > rect.x1 || h.y0 > rect.y1) continue;
    d += `M${h.x0.toFixed(1)} ${h.y0.toFixed(1)}L${h.x1.toFixed(1)} ${h.y1.toFixed(1)}`;
  }
  return d;
}

/**
 * Hachures, as engravers drew relief: short strokes down the slope, closer and longer where it is steeper, none on
 * gentle ground (under MIN_FALL). Points `spacing` map units apart, jittered so they do not line up; `toMap` places a cell's centre.
 */
export function hachures(
  r: GeoData['relief'],
  h: Float32Array,
  spacing: number,
  toMap: (col: number, row: number) => { x: number; y: number },
  unitsPerCell: { x: number; y: number },
): Hachure[] {
  const out: Hachure[] = [];
  const stepCols = Math.max(1, spacing / unitsPerCell.x);
  const stepRows = Math.max(1, spacing / unitsPerCell.y);
  for (let fr = 1; fr < r.rows - 1; fr += stepRows) {
    for (let fc = 1; fc < r.cols - 1; fc += stepCols) {
      const col = Math.round(fc + (hash2(Math.round(fc * 7), Math.round(fr * 7), 1) - 0.5) * stepCols * 0.8);
      const row = Math.round(fr + (hash2(Math.round(fc * 7), Math.round(fr * 7), 2) - 0.5) * stepRows * 0.8);
      if (col < 1 || row < 1 || col >= r.cols - 1 || row >= r.rows - 1) continue;
      const g = gradientAt(r, h, col, row);
      const fall = Math.hypot(g.east, g.south) * 1000;
      if (fall < MIN_FALL) continue;
      const len = Math.min(1.6, 0.4 + fall / 12) * spacing;
      // Down the slope: against the gradient, east to the right and south downwards on the map.
      const ux = -g.east / Math.hypot(g.east, g.south);
      const uy = -g.south / Math.hypot(g.east, g.south);
      const p = toMap(col, row);
      out.push({ x0: p.x, y0: p.y, x1: p.x + ux * len, y1: p.y + uy * len });
    }
  }
  return out;
}
