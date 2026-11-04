// Places to screen coordinates for the prototype map: a simple projection around the theatre,
// with longitude scaled by the cosine of the mean latitude so distances look right.

import { PLACES } from '../data/vitebsk/places';

export const MAP_WIDTH = 1000;
const PAD = 70;

const meanLat = PLACES.reduce((n, p) => n + p.lat, 0) / PLACES.length;
const k = Math.cos((meanLat * Math.PI) / 180);
const xs = PLACES.map((p) => p.lon * k);
const ys = PLACES.map((p) => p.lat);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const scale = (MAP_WIDTH - 2 * PAD) / (maxX - minX);

export const MAP_HEIGHT = Math.round((maxY - minY) * scale + 2 * PAD);

export interface Point {
  x: number;
  y: number;
}

export function project(lat: number, lon: number): Point {
  return { x: PAD + (lon * k - minX) * scale, y: PAD + (maxY - lat) * scale };
}

/** The latitude and longitude at a map point: `project` undone. */
export function unproject(x: number, y: number): { lat: number; lon: number } {
  return { lat: maxY - (y - PAD) / scale, lon: ((x - PAD) / scale + minX) / k };
}

/** Map units in a kilometre, north to south. */
export const UNITS_PER_KM = scale / 111.32;

export const POSITION: Record<string, Point> = Object.fromEntries(PLACES.map((p) => [p.id, project(p.lat, p.lon)]));

export function along(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
