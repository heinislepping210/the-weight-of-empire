// Turn playback on the map (M2, G4, V4): the engine's frames turned into tracks to animate, a clock, and the
// events and supply lines in words. Pure: the animation loop in Playback.tsx only reads these.

import { calendar } from '../engine';
import type { Context, Frame, GameState, Mark, PlaybackEvent, SupplyLine } from '../engine';
import { shortName, thousands } from './names';
import { POSITION, along, type Point } from './projection';

/** Milliseconds of playback for an hour of the turn, and for a night between two days: a whole turn takes about 4 s. */
export const HOUR_MS = 140;
export const NIGHT_MS = 400;
/** Time after the last frame for the last events to fade before playback ends. */
export const TAIL_MS = 700;

export function pointOf(ctx: Context, m: Pick<Mark, 'at' | 'to' | 'metres'>): Point {
  const here = POSITION[m.at] as Point;
  if (m.to === null) return here;
  const edge = [...ctx.graph.edges.values()].find((e) => (e.a === m.at && e.b === m.to) || (e.b === m.at && e.a === m.to));
  return along(here, POSITION[m.to] as Point, edge ? m.metres / edge.metres : 0);
}

/** When playback reaches each frame, in milliseconds from its start: an hour each, and a pause for each night. */
export function timesOf(frames: readonly Frame[]): number[] {
  const times: number[] = [];
  frames.forEach((f, i) => {
    const prev = frames[i - 1];
    if (!prev) return times.push(0);
    const overnight = prev.slot !== f.slot && (prev.slot === 1 || prev.slot === 3);
    times.push((times[i - 1] as number) + HOUR_MS + (overnight ? NIGHT_MS : 0));
  });
  return times;
}

/** One mark through the playback: where it is at each frame (null when not there), and the way it came. */
export interface Track {
  id: string;
  kind: Mark['kind'];
  strength: number;
  points: (Point | null)[];
  /** From the frame before, through the places reached, to this frame's point. */
  paths: (Point[] | null)[];
  /** The marker's row: stacked below a place, or above the road on the march (as on the map). */
  rows: number[];
}

export function tracksOf(ctx: Context, frames: readonly Frame[]): Track[] {
  const tracks = new Map<string, Track>();
  frames.forEach((frame, i) => {
    const stacks = new Map<string, number>();
    for (const m of frame.marks) {
      let t = tracks.get(m.id);
      if (!t) {
        t = { id: m.id, kind: m.kind, strength: m.strength, points: frames.map(() => null), paths: frames.map(() => null), rows: frames.map(() => 0) };
        tracks.set(m.id, t);
      }
      const p = pointOf(ctx, m);
      const prev = i > 0 ? t.points[i - 1] : null;
      t.points[i] = p;
      t.paths[i] = prev ? [prev, ...m.via.map((v) => POSITION[v] as Point), p] : null;
      if (m.kind === 'train') t.rows[i] = 0;
      else if (m.to !== null && m.metres > 0) t.rows[i] = -24;
      else {
        const k = stacks.get(m.at) ?? 0;
        stacks.set(m.at, k + 1);
        t.rows[i] = 8 + k * 16;
      }
    }
  });
  return [...tracks.values()];
}

/** The point a fraction of the way along a path, by its length. */
export function sample(path: readonly Point[], f: number): Point {
  const first = path[0] as Point;
  if (path.length < 2) return first;
  const lengths = path.slice(1).map((q, i) => Math.hypot(q.x - (path[i] as Point).x, q.y - (path[i] as Point).y));
  const total = lengths.reduce((n, x) => n + x, 0);
  if (total === 0) return path[path.length - 1] as Point;
  let left = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i] as number;
    if (left <= l) return along(path[i] as Point, path[i + 1] as Point, l === 0 ? 1 : left / l);
    left -= l;
  }
  return path[path.length - 1] as Point;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The date and hour of a frame: daylight sub-steps run from 06:00 to 12:00 and from 12:00 to 18:00. */
export function clockOf(ctx: Context, f: Frame): string {
  const { date, hour } = calendar(ctx.scenario.startDate, f);
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${String(hour + f.hour).padStart(2, '0')}:00`;
}

/** Whether an event is worth showing: wagons that arrive with nothing the group can take are not news. */
export const newsworthy = (e: PlaybackEvent) => e.kind !== 'delivery' || Number(e.detail.food) + Number(e.detail.fodder) + Number(e.detail.ammo) > 0;

/** How long the camera's focus on a moment takes, easing in and out (V7). */
export const FOCUS_MS = 1500;

/** A moment the camera focuses on: where, and when it starts and ends in the playback. */
export interface Focus {
  at: Point;
  start: number;
  end: number;
}

/**
 * The moments that matter (a contact, a battle, a depot changing hands, a raid), one at a time: a moment that would have to
 * wait more than 0.7 s behind the one before is passed over, so the camera never lags far behind the turn.
 */
export function focusesOf(frames: readonly Frame[], times: readonly number[]): Focus[] {
  const focuses: Focus[] = [];
  frames.forEach((f, i) => {
    const e = f.events.find((x) => x.kind === 'contact' || x.kind === 'battle' || x.kind === 'depotTaken' || x.kind === 'raid');
    if (!e) return;
    const from = times[i] as number;
    const start = Math.max(from, focuses[focuses.length - 1]?.end ?? 0);
    if (start - from > 700) return;
    focuses.push({ at: POSITION[e.node] as Point, start, end: start + FOCUS_MS });
  });
  return focuses;
}

/** How far the camera has moved towards a moment: easing in over the first quarter, out over the last. */
export function focusWeight(t: number, f: Focus): number {
  const p = (t - f.start) / (f.end - f.start);
  if (p < 0 || p > 1) return 0;
  const smooth = (x: number) => x * x * (3 - 2 * x);
  return p < 0.25 ? smooth(p / 0.25) : p > 0.75 ? smooth((1 - p) / 0.25) : 1;
}

/** Whether anything in the frames moves or happens, so that playing them shows something. */
export function eventful(frames: readonly Frame[]): boolean {
  return frames.some((f, i) => {
    if (f.events.some(newsworthy)) return true;
    const prev = frames[i - 1];
    if (!prev) return false;
    const before = new Map(prev.marks.map((m) => [m.id, m]));
    return f.marks.some((m) => {
      const b = before.get(m.id);
      return !b || b.at !== m.at || b.to !== m.to || b.metres !== m.metres;
    });
  });
}

/** Where each French group went in the frames, as one line: what the turn did, beside what was planned (§2.4b). */
export function trailsOf(ctx: Context, frames: readonly Frame[]): Point[][] {
  return tracksOf(ctx, frames)
    .filter((t) => t.kind === 'group')
    .map((t) => {
      const line: Point[] = [];
      t.points.forEach((p, i) => {
        if (!p) return;
        const way = t.paths[i];
        line.push(...(way ? way.slice(1) : [p]));
      });
      return line;
    })
    .filter((line) => line.some((p) => p.x !== (line[0] as Point).x || p.y !== (line[0] as Point).y));
}

const place = (ctx: Context, id: string) => ctx.graph.nodes.get(id)?.name ?? id;

/** An event as the playback names it. */
export function eventText(e: PlaybackEvent, s: GameState, ctx: Context): string {
  const at = place(ctx, e.node);
  const d = e.detail;
  switch (e.kind) {
    case 'contact':
      return `Contact at ${at}`;
    case 'battle':
      return `Battle at ${at}`;
    case 'skirmish':
      return `Skirmish at ${at}`;
    case 'withdrawal':
      if (d.side === 'fr') return d.success ? `We fall back from ${at}` : `We cannot get away from ${at}`;
      return d.success ? `The Russians fall back from ${at}` : `The Russians cannot get away from ${at}`;
    case 'depotTaken':
      return d.by === 'fr' ? `The depot at ${at} is ours` : `The depot at ${at} is lost`;
    case 'raid':
      return `Cossacks raid a wagon train near ${at}: ${thousands(Number(d.food))} rations burned`;
    case 'delivery': {
      const f = d.force ? s.forces[String(d.force)] : undefined;
      return f ? `Wagons reach ${shortName(f.id, f.name)} at ${at}: ${thousands(Number(d.food))} rations` : `Wagons stock the depot at ${at}`;
    }
  }
}

/** Whether a supply line brings less a day than its group eats: a bottleneck (G5). */
export const isShort = (l: SupplyLine) => l.need !== null && l.perDay < l.need;

/** A supply line in words, for the map's tooltip and the list. */
export function supplyText(l: SupplyLine, s: GameState, ctx: Context): string {
  const roads = l.exposed.map((id) => ctx.graph.edges.get(id)).flatMap((e) => (e ? [`${place(ctx, e.a)} and ${place(ctx, e.b)}`] : []));
  return `${loadText(l, s, ctx)}${roads.length > 0 ? ` Exposed to raids between ${roads.join('; ')}.` : ''}`;
}

function loadText(l: SupplyLine, s: GameState, ctx: Context): string {
  const from = place(ctx, l.home);
  const f = l.serves ? s.forces[l.serves] : undefined;
  const who = f ? shortName(f.id, f.name) : `the depot at ${place(ctx, l.to)}`;
  const trip = l.cycleDays === 1 ? 'a load a day' : `a load every ${l.cycleDays} days`;
  const head = f ? `${who}'s wagons from ${from}` : `Line train from ${from} to ${place(ctx, l.to)}`;
  if (l.wagons === 0) return `${head}: no draught horses left to draw them.`;
  if (l.load === 0) return `${head}: nothing left to load at ${from}.`;
  const brings = `${trip}, about ${thousands(l.perDay)} rations a day`;
  if (l.need === null) return `${head}: ${brings}.`;
  const eats = `${who} eats ${thousands(l.need)}`;
  return isShort(l) ? `${head}: ${brings}; ${eats}. Short: the rest must come from what it carries and forages.` : `${head}: ${brings}; ${eats}.`;
}
