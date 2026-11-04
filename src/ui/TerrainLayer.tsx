import { useEffect, useMemo, useState } from 'react';
import type { Band } from '../map/camera';
import { decodeRelief, type GeoData, type LonLat } from '../map/geo';
import { blotch, gradientAt, hachures, hash2, rounded, shade, smooth, strokesPath, strokeWindow, type Hachure } from '../map/terrain';
import { sample } from './playbackModel';
import { MAP_HEIGHT, MAP_WIDTH, POSITION, project, unproject, type Point } from './projection';

/** Width of the painted relief in pixels: about 1.5 pixels a map unit, enough for a soft wash at any zoom. */
const RASTER_WIDTH = 1536;
/** Hachures a few map units apart: a lighter engraving at the operations zoom, a closer one at the local zoom. */
const HACHURE_SPACING: Record<Exclude<Band, 'theatre'>, number> = { operations: 10, local: 4.5 };

interface River {
  key: string;
  name: string | null;
  rank: number;
  d: string;
  /** The longest run of a named major river, drawn west to east for its label, and where along it the label sits. */
  label: { d: string; offset: number } | null;
}

/** Where along a river its name sits: of the points from 15% to 85% of the way, the one farthest from any place. */
function labelOffset(points: readonly Point[]): number {
  const places = Object.values(POSITION);
  let best = { offset: 0.5, clear: -1 };
  for (let f = 0.15; f <= 0.851; f += 0.05) {
    const p = sample(points, f);
    const clear = Math.min(...places.map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
    if (clear > best.clear) best = { offset: f, clear };
  }
  return best.offset;
}

interface Painted {
  image: string;
  rivers: River[];
  lakes: string[];
  hachures: Record<Exclude<Band, 'theatre'>, Hachure[]>;
}

const toMap = ([lon, lat]: LonLat): Point => project(lat, lon);
const pathOf = (points: readonly Point[], close = false) => `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')}${close ? 'Z' : ''}`;

/** A value on the relief grid at fractional cell coordinates, interpolated. */
function sampleGrid(grid: Float32Array, cols: number, rows: number, fx: number, fy: number): number {
  const x0 = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const at = (x: number, y: number) => grid[y * cols + x] as number;
  return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty;
}

/**
 * The relief as a watercolour wash on paper: sepia shadows on the slopes turned from the north-west light, the
 * valleys washed green-grey and the higher ground ochre, both broken into blotches, and a fine paper grain.
 */
async function paintRelief(geo: GeoData): Promise<string> {
  const r = geo.relief;
  const heights = smooth(r, decodeRelief(r));
  const lit = new Float32Array(heights.length);
  for (let row = 0; row < r.rows; row++) for (let col = 0; col < r.cols; col++) lit[row * r.cols + col] = shade(gradientAt(r, heights, col, row));
  let low = Infinity;
  let high = -Infinity;
  for (const h of heights) [low, high] = [Math.min(low, h), Math.max(high, h)];
  const flat = Math.SQRT1_2;

  const width = RASTER_WIDTH;
  const height = Math.round((width * MAP_HEIGHT) / MAP_WIDTH);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  const image = ctx.createImageData(width, height);
  const px = image.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { lat, lon } = unproject(((x + 0.5) * MAP_WIDTH) / width, ((y + 0.5) * MAP_HEIGHT) / height);
      const fx = (lon - r.west) / r.dLon - 0.5;
      const fy = (r.north - lat) / r.dLat - 0.5;
      const s = sampleGrid(lit, r.cols, r.rows, fx, fy);
      const t = (sampleGrid(heights, r.cols, r.rows, fx, fy) - low) / Math.max(1, high - low);
      // Layers painted one over another: elevation wash, shadow, then the paper's grain.
      let [cr, cg, cb, ca] = [0, 0, 0, 0];
      const over = (sr: number, sg: number, sb: number, sa: number) => {
        const a = sa + ca * (1 - sa);
        if (a <= 0) return;
        cr = (sr * sa + cr * ca * (1 - sa)) / a;
        cg = (sg * sa + cg * ca * (1 - sa)) / a;
        cb = (sb * sa + cb * ca * (1 - sa)) / a;
        ca = a;
      };
      const wash = 0.7 + 0.6 * blotch(x, y, 70, 3);
      if (t < 0.5) over(118, 138, 112, (0.5 - t) * 0.34 * wash);
      else over(186, 152, 98, (t - 0.5) * 0.3 * wash);
      if (s < flat) over(92, 74, 54, Math.min(0.4, (flat - s) * 1.6) * (0.75 + 0.5 * blotch(x, y, 28, 5)));
      over(80, 66, 48, hash2(x, y, 9) * 0.05);
      const i = (y * width + x) * 4;
      px[i] = cr;
      px[i + 1] = cg;
      px[i + 2] = cb;
      px[i + 3] = Math.round(ca * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('the relief could not be painted');
  return URL.createObjectURL(blob);
}

function strokes(geo: GeoData, spacing: number): Hachure[] {
  const r = geo.relief;
  const heights = smooth(r, decodeRelief(r));
  const corner = project(r.north, r.west);
  const far = project(r.north - r.dLat, r.west + r.dLon);
  const unitsPerCell = { x: far.x - corner.x, y: far.y - corner.y };
  const cellToMap = (col: number, row: number) => ({ x: corner.x + (col + 0.5) * unitsPerCell.x, y: corner.y + (row + 0.5) * unitsPerCell.y });
  return hachures(r, heights, spacing, cellToMap, unitsPerCell).filter((h) => h.x0 >= 0 && h.y0 >= 0 && h.x0 <= MAP_WIDTH && h.y0 <= MAP_HEIGHT);
}

async function paint(geo: GeoData): Promise<Painted> {
  const runs = geo.rivers.flatMap((river, i) => river.lines.map((l, k) => ({ key: `${i}-${k}`, river, points: rounded(l.map(toMap)) })));
  // Each major river named once, on its longest run, whichever source feature that run belongs to.
  const labelled = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    const name = run.river.name;
    if (name === null || run.river.rank > 5) continue;
    const held = labelled.get(name);
    if (!held || run.points.length > held.points.length) labelled.set(name, run);
  }
  const chosen = new Set([...labelled.values()].map((r) => r.key));
  const rivers: River[] = runs.map(({ key, river, points }) => {
    const westToEast = (points[0]?.x ?? 0) <= (points[points.length - 1]?.x ?? 0) ? points : [...points].reverse();
    return { key, name: river.name, rank: river.rank, d: pathOf(points), label: chosen.has(key) ? { d: pathOf(westToEast), offset: labelOffset(westToEast) } : null };
  });
  const lakes = geo.lakes.flatMap((lake) => lake.rings.map((ring) => pathOf(ring.map(toMap), true)));
  const image = await paintRelief(geo);
  return { image, rivers, lakes, hachures: { operations: strokes(geo, HACHURE_SPACING.operations), local: strokes(geo, HACHURE_SPACING.local) } };
}

/**
 * The terrain under the map (M2, V1): relief painted once as a watercolour wash, engraved hachures from the
 * operations zoom in, and the rivers and lakes as ink lines that stay sharp at any zoom. The geography loads after
 * the game, from real data (MAP_AND_GEOGRAPHY §3.7); until it arrives, or if it cannot be painted, the map is plain
 * paper as before. Only the hachures in and around `view` are drawn.
 */
export function TerrainLayer({ band, u, view }: { band: Band; u: number; view: { x: number; y: number; width: number; height: number } }) {
  const [painted, setPainted] = useState<Painted | null>(null);
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    import('../data/vitebsk/geo.json')
      .then((m) => paint(m.default as unknown as GeoData))
      .then((p) => {
        url = p.image;
        if (live) setPainted(p);
        else URL.revokeObjectURL(p.image);
      })
      .catch(() => {
        // The map works without its terrain.
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);
  const labels = useMemo(() => painted?.rivers.filter((r) => r.label !== null) ?? [], [painted]);
  const around = strokeWindow(view);
  const hachureD = useMemo(
    () => (painted && band !== 'theatre' ? strokesPath(painted.hachures[band], around) : ''),
    // The window changes only in steps, so the strokes are rebuilt only when it does.
    [painted, band, around.x0, around.y0, around.x1, around.y1],
  );
  if (!painted) return null;
  return (
    <g className="terrain" aria-hidden="true">
      <image href={painted.image} x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" />
      {hachureD !== '' && <path className="hachures" d={hachureD} style={{ strokeWidth: 0.7 * u }} />}
      {painted.lakes.map((d, i) => (
        <path key={`lake-${i}`} className="lake" d={d} />
      ))}
      {painted.rivers.map((r) => (
        <path key={`wash-${r.key}`} className="river-wash" d={r.d} style={{ strokeWidth: r.rank <= 5 ? 9 : 5 }} />
      ))}
      {painted.rivers.map((r) => (
        <path key={`river-${r.key}`} className="river" d={r.d} style={{ strokeWidth: r.rank <= 5 ? 2.4 : r.rank <= 10 ? 1.4 : 1 }} />
      ))}
      {band !== 'theatre' &&
        labels.map((r) => (
          <g key={`label-${r.key}`}>
            <path id={`river-label-${r.key}`} d={r.label?.d ?? ''} fill="none" stroke="none" />
            <text className="river-label" style={{ fontSize: 11 * u }} dy={-4 * u}>
              <textPath href={`#river-label-${r.key}`} startOffset={`${Math.round((r.label?.offset ?? 0.5) * 100)}%`} textAnchor="middle">
                {r.name}
              </textPath>
            </text>
          </g>
        ))}
    </g>
  );
}
