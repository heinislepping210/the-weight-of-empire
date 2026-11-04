// The map camera (M2, V2): pan, zoom about the pointer, the three zoom bands, and the keys.

import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, bandOf, centreOn, clamp, fit, heightOf, onKey, panBy, zoomAbout, zoomOf } from '../../src/map/camera';

const world = { width: 1000, height: 700 };

describe('the map camera', () => {
  it('starts with the whole theatre in view, in the theatre band', () => {
    const c = fit(world);
    expect(c).toEqual({ x: 0, y: 0, width: 1000 });
    expect(heightOf(world, c)).toBe(700);
    expect(bandOf(world, c)).toBe('theatre');
  });

  it('zooming keeps the point under the pointer where it was', () => {
    const c = zoomAbout(world, fit(world), 2, 0.25, 0.75);
    // The map point a quarter across and three quarters down stays a quarter across and three quarters down.
    expect(c.x + 0.25 * c.width).toBeCloseTo(250);
    expect(c.y + 0.75 * heightOf(world, c)).toBeCloseTo(525);
    expect(zoomOf(world, c)).toBeCloseTo(2);
  });

  it('passes through the three bands as it zooms in, and stops at the closest zoom', () => {
    let c = fit(world);
    const bands = new Set<string>();
    for (let i = 0; i < 20; i++) {
      c = zoomAbout(world, c, 1.25);
      bands.add(bandOf(world, c));
    }
    expect([...bands]).toEqual(['theatre', 'operations', 'local']);
    expect(zoomOf(world, c)).toBeCloseTo(MAX_ZOOM);
  });

  it('never leaves the map, and never shows more than the whole of it', () => {
    expect(clamp(world, { x: -500, y: -500, width: 400 })).toEqual({ x: 0, y: 0, width: 400 });
    expect(clamp(world, { x: 900, y: 600, width: 400 })).toEqual({ x: 600, y: 420, width: 400 });
    expect(zoomAbout(world, fit(world), 0.5)).toEqual(fit(world));
    expect(panBy(world, fit(world), 0.3, 0.3)).toEqual(fit(world));
  });

  it('pans by a share of the view, and centres on a place', () => {
    const c = zoomAbout(world, fit(world), 2);
    const left = panBy(world, c, 0.1, 0);
    expect(left.x).toBeCloseTo(c.x - 0.1 * c.width);
    const centred = centreOn(world, c, 500, 350);
    expect(centred.x + centred.width / 2).toBeCloseTo(500);
    expect(centred.y + heightOf(world, centred) / 2).toBeCloseTo(350);
  });

  it('answers its keys, and only those', () => {
    const c = zoomAbout(world, fit(world), 2);
    expect(onKey(world, c, '+')!.width).toBeCloseTo(c.width / 1.25);
    expect(onKey(world, c, '-')!.width).toBeCloseTo(c.width * 1.25);
    expect(onKey(world, c, 'ArrowRight')!.x).toBeGreaterThan(c.x);
    expect(onKey(world, c, '0')).toEqual(fit(world));
    expect(onKey(world, c, 'a')).toBeNull();
  });
});
