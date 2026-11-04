// The theatre's real geography (MAP_AND_GEOGRAPHY §3.7), as tools/geo/build.mjs writes it: rivers and lakes from
// Natural Earth and a relief grid from SRTM, in longitude and latitude. The map projects it with its places'
// projection. Read only; the rules do not use it (yet).

/** A line or ring of [longitude, latitude] points. */
export type LonLat = readonly [number, number];

export interface GeoData {
  about: string;
  box: { west: number; east: number; south: number; north: number };
  rivers: { name: string | null; rank: number; source: string; lines: LonLat[][] }[];
  lakes: { name: string | null; rank: number; source: string; rings: LonLat[][] }[];
  /** Heights in metres, row by row from the north-west corner: `min + byte × step`, the bytes in base64. */
  relief: { west: number; north: number; dLon: number; dLat: number; cols: number; rows: number; min: number; step: number; heights: string };
}

/** The relief grid's heights in metres, row by row from the north-west corner. */
export function decodeRelief(r: GeoData['relief']): Float32Array {
  const bin = atob(r.heights);
  const out = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = r.min + bin.charCodeAt(i) * r.step;
  return out;
}

/** The height at a point, interpolated between the four nearest cell centres; null outside the grid. */
export function heightAt(r: GeoData['relief'], heights: Float32Array, lon: number, lat: number): number | null {
  const fx = (lon - r.west) / r.dLon - 0.5;
  const fy = (r.north - lat) / r.dLat - 0.5;
  if (fx < -0.5 || fy < -0.5 || fx > r.cols - 0.5 || fy > r.rows - 0.5) return null;
  const x0 = Math.max(0, Math.min(r.cols - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(r.rows - 1, Math.floor(fy)));
  const x1 = Math.min(r.cols - 1, x0 + 1);
  const y1 = Math.min(r.rows - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const at = (x: number, y: number) => heights[y * r.cols + x] as number;
  return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty;
}
