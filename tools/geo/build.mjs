// Builds src/data/vitebsk/geo.json from the files tools/geo/fetch.mjs downloaded (MAP_AND_GEOGRAPHY §3.7): rivers and
// lakes from Natural Earth, clipped to the theatre and simplified, and a relief grid averaged from the SRTM tiles.
// Everything stays in longitude and latitude; the game projects it with the same projection as its places. Each
// input is checked against its hash in tools/geo/manifest.json first, and the output is the same on every run.
// Run: node tools/geo/build.mjs

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'tools', 'geo', 'manifest.json'), 'utf8'));
const byId = new Map(manifest.files.map((f) => [f.id, f]));

/**
 * The map (29.91–33.56° E, 53.76–55.75° N) with about 10 km to spare on each side, inside the fifteen approved
 * SRTM tiles; tests/data/vitebsk-geo.test.ts checks that it covers the map.
 */
const BOX = { west: 29.8, east: 33.7, south: 53.65, north: 55.85 };
/** Relief cells of 30 by 45 arc-seconds: about 0.9 km north to south and 0.8 km east to west here. */
const CELL = { dLat: 1 / 120, dLon: 1 / 80 };
/** Lines simplified to about 150 m, and coordinates kept to about 10 m. */
const TOLERANCE = 0.0015;
const round = (x) => Math.round(x * 1e4) / 1e4;
/** The game's names for the rivers that carry a name in the source. */
const NAMES = { Dnipro: 'Dnieper', Dnepre: 'Dnieper', Dnepr: 'Dnieper', Daugava: 'Western Dvina', Byesyedz: 'Besed', Iputs: 'Iput' };

function load(id) {
  const entry = byId.get(id);
  if (!entry) throw new Error(`${id} is not in the manifest: fetch it first`);
  const buf = readFileSync(join(root, 'assets-incoming', 'geo', entry.file));
  const hash = createHash('sha256').update(buf).digest('hex');
  if (hash !== entry.sha256) throw new Error(`${entry.file} does not match its recorded hash`);
  return buf;
}

const inside = ([x, y]) => x >= BOX.west && x <= BOX.east && y >= BOX.south && y <= BOX.north;

/** The runs of a line that lie in the box, each with one point beyond either end so it reaches the edge. */
function clip(line) {
  const runs = [];
  let run = [];
  line.forEach((p, i) => {
    if (inside(p)) {
      if (run.length === 0 && i > 0) run.push(line[i - 1]);
      run.push(p);
    } else if (run.length > 0) {
      run.push(p);
      runs.push(run);
      run = [];
    }
  });
  if (run.length > 0) runs.push(run);
  return runs.filter((r) => r.length >= 2);
}

/** Douglas–Peucker, with longitude scaled to the theatre's latitude so the tolerance is the same both ways. */
function simplify(line) {
  const k = Math.cos((54.8 * Math.PI) / 180);
  const dist = (p, a, b) => {
    const [px, py, ax, ay, bx, by] = [p[0] * k, p[1], a[0] * k, a[1], b[0] * k, b[1]];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length > 0) {
    const [i, j] = stack.pop();
    let best = -1;
    let far = 0;
    for (let m = i + 1; m < j; m++) {
      const d = dist(line[m], line[i], line[j]);
      if (d > far) [far, best] = [d, m];
    }
    if (best >= 0 && far > TOLERANCE) {
      keep[best] = 1;
      stack.push([i, best], [best, j]);
    }
  }
  return line.filter((_, i) => keep[i]).map(([x, y]) => [round(x), round(y)]);
}

const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
const ringsOf = (g) => (g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : []);

const rivers = [];
for (const id of ['ne-10m-rivers-lake-centerlines', 'ne-10m-rivers-europe']) {
  for (const f of JSON.parse(load(id).toString('utf8')).features) {
    const lines = linesOf(f.geometry).flatMap(clip).map(simplify).filter((l) => l.length >= 2);
    if (lines.length === 0) continue;
    const name = f.properties.name ? (NAMES[f.properties.name] ?? f.properties.name) : null;
    rivers.push({ name, rank: f.properties.scalerank, source: id, lines });
  }
}

const lakes = [];
for (const id of ['ne-10m-lakes', 'ne-10m-lakes-europe']) {
  for (const f of JSON.parse(load(id).toString('utf8')).features) {
    const rings = ringsOf(f.geometry).filter((r) => r.some(inside)).map(simplify).filter((r) => r.length >= 4);
    if (rings.length > 0) lakes.push({ name: f.properties.name || null, rank: f.properties.scalerank, source: id, rings });
  }
}

const order = (a, b) => (a.rank - b.rank || String(a.name).localeCompare(String(b.name)) || JSON.stringify(a.lines ?? a.rings).localeCompare(JSON.stringify(b.lines ?? b.rings)));
rivers.sort(order);
lakes.sort(order);

// Relief: each cell the mean height of the SRTM samples in it (1 arc-second, 3601 a side per 1° tile).
const cols = Math.round((BOX.east - BOX.west) / CELL.dLon);
const rows = Math.round((BOX.north - BOX.south) / CELL.dLat);
const sum = new Float64Array(cols * rows);
const count = new Uint32Array(cols * rows);
for (let lat = Math.floor(BOX.south); lat < BOX.north; lat++) {
  for (let lon = Math.floor(BOX.west); lon < BOX.east; lon++) {
    const raw = gunzipSync(load(`srtm-N${lat}E0${lon}`));
    const side = Math.round(Math.sqrt(raw.length / 2));
    for (let r = 0; r < side; r++) {
      // Row 0 is the tile's northern edge.
      const y = lat + 1 - r / (side - 1);
      const row = Math.floor((BOX.north - y) / CELL.dLat);
      if (row < 0 || row >= rows) continue;
      for (let c = 0; c < side; c++) {
        const x = lon + c / (side - 1);
        const col = Math.floor((x - BOX.west) / CELL.dLon);
        if (col < 0 || col >= cols) continue;
        const v = raw.readInt16BE((r * side + c) * 2);
        if (v === -32768) continue;
        sum[row * cols + col] += v;
        count[row * cols + col] += 1;
      }
    }
  }
}
const heights = Array.from(sum, (s, i) => (count[i] > 0 ? s / count[i] : NaN));
if (heights.some(Number.isNaN)) throw new Error('a relief cell has no samples');
const min = Math.floor(Math.min(...heights));
const max = Math.ceil(Math.max(...heights));
// Heights to the metre where the range allows it, as one byte a cell.
const step = Math.max(1, Math.ceil((max - min) / 255));
const bytes = Uint8Array.from(heights, (h) => Math.round((h - min) / step));

const geo = {
  about: 'Built by tools/geo/build.mjs from the files in tools/geo/manifest.json. Rivers and lakes: Natural Earth (public domain). Relief: SRTM data courtesy of the U.S. Geological Survey (public domain). Longitude and latitude, WGS84.',
  box: BOX,
  rivers,
  lakes,
  relief: { west: BOX.west, north: BOX.north, dLon: CELL.dLon, dLat: CELL.dLat, cols, rows, min, step, heights: Buffer.from(bytes).toString('base64') },
};
const text = `${JSON.stringify(geo)}\n`;
writeFileSync(join(root, 'src', 'data', 'vitebsk', 'geo.json'), text);
console.log(`rivers ${rivers.length} (${rivers.reduce((n, r) => n + r.lines.reduce((m, l) => m + l.length, 0), 0)} points), lakes ${lakes.length}, relief ${cols}×${rows} from ${min} to ${max} m in ${step} m steps; ${(text.length / 1024).toFixed(0)} KB, sha256 ${createHash('sha256').update(text).digest('hex').slice(0, 16)}`);
