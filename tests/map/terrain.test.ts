// The painted terrain's maths (M2, V1): shading from the north-west light, hachures down the slope, the paper's
// grain, and how many strokes the real relief gives at each zoom.

import { describe, expect, it } from 'vitest';
import geoJson from '../../src/data/vitebsk/geo.json';
import { decodeRelief, type GeoData } from '../../src/map/geo';
import { blotch, gradientAt, hachures, hash2, rounded, shade, smooth, strokesPath, strokeWindow } from '../../src/map/terrain';

const geo = geoJson as unknown as GeoData;

/** A synthetic grid: `height(col, row)` metres, with cells about 800 m across. */
function grid(height: (col: number, row: number) => number) {
  const r = { west: 30, north: 55, dLon: 1 / 80, dLat: 1 / 120, cols: 20, rows: 20, min: 0, step: 1, heights: '' };
  const h = Float32Array.from({ length: r.cols * r.rows }, (_, i) => height(i % r.cols, Math.floor(i / r.cols)));
  return { r, h };
}
const toMap = (col: number, row: number) => ({ x: col * 4, y: row * 4 });
const cell = { x: 4, y: 4 };

describe('the terrain maths', () => {
  it('shades flat ground evenly, a slope facing the north-west light brighter and one facing away darker', () => {
    const flat = shade({ east: 0, south: 0 });
    expect(flat).toBeCloseTo(Math.SQRT1_2);
    // Rising to the south-east, so it faces north-west, towards the light.
    expect(shade({ east: 0.01, south: 0.01 })).toBeGreaterThan(flat);
    expect(shade({ east: -0.01, south: -0.01 })).toBeLessThan(flat);
  });

  it('reads the slope from the grid: a plane rising eastward', () => {
    const { r, h } = grid((col) => 100 + col * 8);
    const g = gradientAt(r, h, 10, 10);
    expect(g.east).toBeGreaterThan(0);
    expect(g.south).toBeCloseTo(0);
  });

  it('draws no hachures on flat ground, and on a slope draws them down it, the same every time', () => {
    expect(hachures(grid(() => 150).r, grid(() => 150).h, 8, toMap, cell)).toEqual([]);
    // About 15 m of fall a kilometre: hatched.
    const { r, h } = grid((col) => 100 + col * 12);
    const strokes = hachures(r, h, 8, toMap, cell);
    expect(strokes.length).toBeGreaterThan(5);
    // The ground falls to the west: every stroke runs west.
    for (const s of strokes) {
      expect(s.x1).toBeLessThan(s.x0);
      expect(Math.abs(s.y1 - s.y0)).toBeLessThan(1e-9);
    }
    expect(hachures(r, h, 8, toMap, cell)).toEqual(strokes);
  });

  it('smoothing drops small bumps but keeps a valley', () => {
    // A valley along column 10, with a canopy-sized bump on its side.
    const { r, h } = grid((col, row) => 150 + Math.abs(col - 10) * 6 + (col === 14 && row === 10 ? 12 : 0));
    const s = smooth(r, h);
    const at = (a: Float32Array, col: number, row: number) => a[row * r.cols + col] as number;
    expect(at(s, 14, 10) - at(s, 13, 10)).toBeLessThan(at(h, 14, 10) - at(h, 13, 10));
    expect(at(s, 10, 10)).toBeLessThan(at(s, 6, 10));
    expect(at(s, 10, 10)).toBeLessThan(at(s, 14, 10));
  });

  it('rounds a line\'s corners for display, its ends where they were', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const r = rounded(line);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[r.length - 1]).toEqual({ x: 10, y: 10 });
    expect(r.length).toBeGreaterThan(line.length);
    // The corner is cut: no point reaches it.
    expect(r.some((p) => p.x === 10 && p.y === 0)).toBe(false);
  });

  it('draws only the hachures in and around the view, the window moving in steps', () => {
    const strokes = [
      { x0: 10, y0: 10, x1: 11, y1: 10 },
      { x0: 500, y0: 500, x1: 501, y1: 500 },
    ];
    const near = strokeWindow({ x: 5, y: 5, width: 100, height: 90 });
    expect(strokesPath(strokes, near)).toBe('M10.0 10.0L11.0 10.0');
    // A pan smaller than a step leaves the window, and so the drawn strokes, as they were.
    expect(strokeWindow({ x: 8, y: 7, width: 100, height: 90 })).toEqual(near);
    expect(strokesPath(strokes, strokeWindow({ x: 420, y: 420, width: 100, height: 90 }))).toBe('M500.0 500.0L501.0 500.0');
  });

  it('makes a repeatable paper grain and smooth washes', () => {
    expect(hash2(12, 34, 5)).toBe(hash2(12, 34, 5));
    expect(hash2(12, 34, 5)).not.toBe(hash2(13, 34, 5));
    for (let i = 0; i < 50; i++) {
      const v = blotch(i * 3.7, i * 1.3, 20);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Math.abs(blotch(i * 3.7 + 0.5, i * 1.3, 20) - v)).toBeLessThan(0.1);
    }
  });

  it('keeps the real relief light enough to draw: a few thousand strokes at the operations zoom, more close in', () => {
    const r = geo.relief;
    const h = smooth(r, decodeRelief(r));
    const count = (spacing: number) => hachures(r, h, spacing, toMap, { x: 3.4, y: 3.9 }).length;
    const operations = count(8);
    const local = count(4.5);
    expect(operations).toBeGreaterThan(300);
    expect(operations).toBeLessThan(5_000);
    expect(local).toBeGreaterThan(operations);
    expect(local).toBeLessThan(14_000);
  });
});
