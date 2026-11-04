// Playback of a turn (M2, G4, G6, V4): what the French saw happen, hour by hour, recorded while the turn resolves.
//
// Recording only reads the state, so a game advanced with playback is the same game. The frames hold what the
// French command would know: its own groups and wagon trains, and enemy forces only while some French force has
// them within its detection range (§2.8), at the scouts' estimate of their strength. Russian wagon trains are never
// shown: no rule says when they would be seen.

import { HOURS_PER_SLOT, advance, roadFactor, type AdvanceResult } from './advance';
import { edgeBetween, shortestPath } from './graph';
import { estimateOf, seenBy } from './intel';
import type { Context } from './scenario';
import type { Activity, ConvoyId, ConvoyLeg, GameState, Input, LogEntry, NodeId, Slot } from './types';
import { must, sortedValues } from './util';

/** A French group, an enemy force the French can see, or a French wagon train on the road, at one moment. */
export interface Mark {
  id: string;
  kind: 'group' | 'enemy' | 'train';
  /** Where it stands, or the place it set out from along a road. */
  at: NodeId;
  /** On the road: where it is heading, and how far along it is from `at`. */
  to: NodeId | null;
  metres: number;
  /** The places it reached since the frame before, in order: the way between the two frames. */
  via: NodeId[];
  /** Men, exact for the French and the scouts' estimate for the enemy; for a train, its wagons. */
  strength: number;
  activity: Activity | ConvoyLeg;
}

export type PlaybackEventKind = 'contact' | 'battle' | 'skirmish' | 'withdrawal' | 'depotTaken' | 'delivery';

/** Something the French would know happened, and where. */
export interface PlaybackEvent {
  kind: PlaybackEventKind;
  node: NodeId;
  detail: LogEntry['detail'];
}

export interface Frame {
  turn: number;
  slot: Slot;
  /** Hours of the sub-step done: 0 at its start, 6 at its end. */
  hour: number;
  marks: Mark[];
  /** What happened since the frame before. */
  events: PlaybackEvent[];
}

interface Position {
  at: NodeId;
  to: NodeId | null;
  metres: number;
}

/** Everything the French see at this moment, with the way each mark came since `before`. */
function marksOf(s: GameState, ctx: Context, arrivals: ReadonlyMap<string, NodeId[]>): Mark[] {
  const marks: Mark[] = [];
  for (const f of sortedValues(s.forces)) {
    if (f.men <= 0) continue;
    const ours = f.side === 'fr';
    if (!ours && !seenBy(s, ctx, 'fr', f)) continue;
    marks.push({
      id: f.id,
      kind: ours ? 'group' : 'enemy',
      at: f.at,
      to: f.transit?.to ?? null,
      metres: f.transit?.metres ?? 0,
      via: arrivals.get(f.id) ?? [],
      strength: ours ? f.men : estimateOf(s, ctx, 'fr', f, s.resolution.turn),
      activity: f.activity,
    });
  }
  for (const c of sortedValues(s.convoys)) {
    if (c.side !== 'fr' || (c.leg === 'loading' && c.transit === null)) continue;
    marks.push({ id: c.id, kind: 'train', at: c.at, to: c.transit?.to ?? null, metres: c.transit?.metres ?? 0, via: [], strength: c.wagons, activity: c.leg });
  }
  return marks;
}

/** The events in these log entries that the French would know of. */
function eventsOf(s: GameState, entries: readonly LogEntry[]): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  for (const e of entries) {
    const d = e.detail;
    if (e.kind === 'encounter') events.push({ kind: 'contact', node: String(d.node), detail: d });
    else if (e.kind === 'deployed') {
      const b = s.battles[String(d.battle)];
      if (b) events.push({ kind: 'battle', node: b.node, detail: d });
    } else if (e.kind === 'minorAction') events.push({ kind: 'skirmish', node: String(d.node), detail: d });
    else if (e.kind === 'withdrawal') events.push({ kind: 'withdrawal', node: String(d.node), detail: d });
    else if (e.kind === 'depotCaptured') events.push({ kind: 'depotTaken', node: String(d.node), detail: d });
    else if (e.kind === 'delivered') {
      const c = s.convoys[String(d.convoy)];
      if (c && c.side === 'fr') events.push({ kind: 'delivery', node: c.at, detail: d });
    }
  }
  return events;
}

/**
 * A wagon train's way through one sub-step, hour by hour. Trains move once per sub-step (§3.4a step 3) at a steady
 * rate of ideal distance that each road converts at its own speed, so where it stood after each hour follows from
 * where it started and ended: the same roads, at the same rate, stopping where it stopped.
 */
function trainHours(s: GameState, ctx: Context, from: Position, end: Position): { position: Position; via: NodeId[] }[] {
  const lengthOf = (a: NodeId, b: NodeId) => must(edgeBetween(ctx.graph, a, b), `road ${a}–${b}`);
  /** The stretches of road it covered, in order; `place` when the stretch ends at a place. */
  const stretches: { a: NodeId; b: NodeId; m0: number; m1: number; factor: number; place: boolean }[] = [];
  const stretch = (a: NodeId, b: NodeId, m0: number, m1: number | null) => {
    const edge = lengthOf(a, b);
    stretches.push({ a, b, m0, m1: m1 ?? edge.metres, factor: roadFactor(s, ctx, edge), place: m1 === null });
  };
  let here = from.at;
  if (from.to !== null) {
    if (end.at === from.at && end.to === from.to) stretch(from.at, from.to, from.metres, end.metres);
    else stretch(from.at, from.to, from.metres, null);
    here = from.to;
  }
  if (!(from.to !== null && end.at === from.at && end.to === from.to)) {
    // A train goes by the shortest road (`moveConvoy`), so the places it reached are those on the way.
    for (const node of shortestPath(ctx.graph, here, end.at) ?? []) {
      stretch(here, node, 0, null);
      here = node;
    }
    if (end.to !== null) stretch(end.at, end.to, 0, end.metres);
  }
  const cost = stretches.map((x) => ((x.m1 - x.m0) * 1000) / x.factor);
  const total = cost.reduce((n, c) => n + c, 0);
  const hours: { position: Position; via: NodeId[] }[] = [];
  let reached = 0;
  for (let h = 1; h <= HOURS_PER_SLOT; h++) {
    const budget = Math.min(total, (ctx.rules.convoy.metresPerSlot * h) / HOURS_PER_SLOT);
    let spent = 0;
    let position: Position = { ...from };
    let i = 0;
    for (; i < stretches.length; i++) {
      const x = stretches[i] as (typeof stretches)[number];
      const c = cost[i] as number;
      if (spent + c > budget) {
        position = { at: x.a, to: x.b, metres: Math.round(x.m0 + ((budget - spent) * x.factor) / 1000) };
        break;
      }
      spent += c;
      position = x.place ? { at: x.b, to: null, metres: 0 } : { at: x.a, to: x.b, metres: x.m1 };
    }
    const via = stretches.slice(reached, i).filter((x) => x.place).map((x) => x.b);
    reached = Math.max(reached, i);
    hours.push({ position, via });
  }
  // The last hour stands exactly where the train ended.
  const last = hours[hours.length - 1];
  if (last) last.position = { ...end };
  return hours;
}

/**
 * `advance`, recording the turn as frames: the first is the moment before, then one at the end of each hour of
 * movement, each with the events since the frame before. The result is exactly `advance`'s.
 */
export function advanceWithPlayback(state: GameState, input: Input, ctx: Context): { result: AdvanceResult; frames: Frame[] } {
  const frames: Frame[] = [{ turn: state.resolution.turn, slot: state.resolution.slot, hour: 0, marks: marksOf(state, ctx, new Map()), events: [] }];
  let seen = 0;
  /** Places each force reached since the last frame. */
  let arrivals = new Map<string, NodeId[]>();
  /** Where each French train stood at the start of the sub-step's movement, and the frames of that sub-step. */
  let trainsFrom: Map<ConvoyId, Position & { leg: ConvoyLeg }> | null = null;
  let hourFrames: Frame[] = [];
  const take = (log: readonly LogEntry[]) => {
    const entries = log.slice(seen);
    seen = log.length;
    return entries;
  };
  const result = advance(state, input, ctx, (s, at, log) => {
    const entries = take(log);
    for (const e of entries) {
      if (e.kind !== 'arrived') continue;
      const id = String(e.detail.force);
      arrivals.set(id, [...(arrivals.get(id) ?? []), String(e.detail.node)]);
    }
    if (at.stage === 'movement' && at.hour !== null) {
      if (at.hour === 0) {
        trainsFrom = new Map(sortedValues(s.convoys).filter((c) => c.side === 'fr').map((c) => [c.id, { at: c.at, to: c.transit?.to ?? null, metres: c.transit?.metres ?? 0, leg: c.leg }]));
        hourFrames = [];
      }
      const frame: Frame = { turn: s.resolution.turn, slot: s.resolution.slot, hour: at.hour + 1, marks: marksOf(s, ctx, arrivals), events: eventsOf(s, entries) };
      arrivals = new Map();
      frames.push(frame);
      hourFrames.push(frame);
      return;
    }
    const last = frames[frames.length - 1] as Frame;
    last.events.push(...eventsOf(s, entries));
    if (at.stage !== 'movement' || trainsFrom === null) return;
    // The trains have moved: spread their way through the sub-step over its hours.
    const from = trainsFrom;
    trainsFrom = null;
    for (const c of sortedValues(s.convoys)) {
      const start = from.get(c.id);
      if (c.side !== 'fr' || !start) continue;
      const end: Position = { at: c.at, to: c.transit?.to ?? null, metres: c.transit?.metres ?? 0 };
      const moved = start.at !== end.at || start.to !== end.to || start.metres !== end.metres;
      if (!moved) continue;
      trainHours(s, ctx, start, end).forEach((way, h) => {
        const frame = hourFrames[h];
        if (!frame) return;
        const last = h === hourFrames.length - 1;
        const next: Mark = { id: c.id, kind: 'train', ...way.position, via: way.via, strength: c.wagons, activity: last ? c.leg : start.leg };
        const mark = frame.marks.find((x) => x.id === c.id);
        if (mark) Object.assign(mark, next);
        else frame.marks.push(next);
      });
    }
  });
  return { result, frames };
}
