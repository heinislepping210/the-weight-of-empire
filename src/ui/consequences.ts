// What a campaign leaves on the map (M2, V5): districts stripped by foragers, stores burned when a depot changed
// hands, battlefields, and dust where columns marched on dry roads. All of it as the French would know it.

import { observedPlaces, when } from '../engine';
import type { Context, EdgeId, Frame, GameState, LogEntry, NodeId, PontoonTrain, Side, SlotRef } from '../engine';
import { edgeBetween } from '../engine/graph';
import { thousands } from './names';

/** A district's food and fodder as the French last saw it, and the turn they saw it. */
export interface SeenDistrict {
  food: number;
  fodder: number;
  turn: number;
}

/** How much of a district foragers have taken: untouched (drawn as nothing), foraged, stripped or bare. */
export type Stripping = 'untouched' | 'foraged' | 'stripped' | 'bare';

export interface Consequences {
  districts: ReadonlyMap<NodeId, SeenDistrict>;
  burned: { node: NodeId; when: SlotRef; by: Side; permille: number }[];
  battles: { node: NodeId; when: SlotRef; winner: Side | null; ourLosses: number }[];
  /** Raids on French wagon trains, on the roads where they fell (G-028). */
  raids: { edge: EdgeId; when: SlotRef; food: number; horses: number }[];
}

/**
 * Each district as the French last saw it: at every pause, the places within their forces' detection range (as for
 * enemy forces, §2.8). A district they never came near is not drawn, and one they left keeps the state they saw.
 */
export function lastSeenDistricts(states: readonly GameState[], ctx: Context): Map<NodeId, SeenDistrict> {
  const seen = new Map<NodeId, SeenDistrict>();
  for (const s of states) {
    for (const node of observedPlaces(s, ctx, 'fr')) {
      const d = s.districts[node];
      if (d) seen.set(node, { food: d.food, fodder: d.fodder, turn: s.resolution.turn });
    }
  }
  return seen;
}

/** What is left of a district, by the scarcer of food and fodder, against what it held at the start. */
export function strippingOf(ctx: Context, node: NodeId, d: SeenDistrict): { stripping: Stripping; food: number; fodder: number } {
  const start = ctx.scenario.districts[node];
  const share = (now: number, was: number | undefined) => (was && was > 0 ? Math.min(1, now / was) : 1);
  const food = share(d.food, start?.food);
  const fodder = share(d.fodder, start?.fodder);
  const left = Math.min(food, fodder);
  return { stripping: left >= 0.85 ? 'untouched' : left >= 0.5 ? 'foraged' : left >= 0.2 ? 'stripped' : 'bare', food, fodder };
}

/** Depots that changed hands, with the share of their stores burned, the battles fought to the end, and the raids. */
export function scarsOf(logs: readonly LogEntry[], s: GameState): Pick<Consequences, 'burned' | 'battles' | 'raids'> {
  const burned = logs
    .filter((e) => e.kind === 'depotCaptured')
    .map((e) => ({ node: String(e.detail.node), when: { turn: e.turn, slot: e.slot }, by: e.detail.by as Side, permille: Number(e.detail.burnedPermille) }));
  const battles = Object.values(s.battles)
    .filter((b) => b.phase === 'over')
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((b) => ({ node: b.node, when: b.startsAt, winner: b.winner, ourLosses: b.sides.fr.reduce((n, id) => n + (b.losses[id] ?? 0), 0) }));
  const raids = logs
    .filter((e) => e.kind === 'raided' && s.convoys[String(e.detail.convoy)]?.side === 'fr')
    .map((e) => ({ edge: String(e.detail.edge), when: { turn: e.turn, slot: e.slot }, food: Number(e.detail.food), horses: Number(e.detail.horses) }));
  return { burned, battles, raids };
}

/**
 * The roads on which columns or wagon trains marched in the frames while the road was dry and no rain fell: where
 * they raised dust. The game has no heat or drought; this is only what dry roads and marching show.
 */
export function dustOf(ctx: Context, frames: readonly Frame[]): EdgeId[] {
  const dusty = new Set<EdgeId>();
  const edge = (a: NodeId, b: NodeId) => edgeBetween(ctx.graph, a, b)?.id;
  frames.forEach((frame, i) => {
    const prev = frames[i - 1];
    if (!prev || frame.rain) return;
    const mud = new Set(frame.mud);
    const before = new Map(prev.marks.map((m) => [m.id, m]));
    for (const m of frame.marks) {
      const a = before.get(m.id);
      if (!a || (a.at === m.at && a.to === m.to && a.metres === m.metres)) continue;
      const walked: (EdgeId | undefined)[] = [];
      let here = a.at;
      if (a.to !== null) {
        walked.push(edge(a.at, a.to));
        here = a.to;
      }
      for (const v of m.via) {
        if (v !== here) walked.push(edge(here, v));
        here = v;
      }
      if (m.to !== null && m.metres > 0) walked.push(edge(m.at, m.to));
      for (const id of walked) if (id !== undefined && !mud.has(id)) dusty.add(id);
    }
  });
  return [...dusty].sort();
}

const place = (ctx: Context, id: NodeId) => ctx.graph.nodes.get(id)?.name ?? id;
const percent = (x: number) => `${Math.round(x * 100)}%`;
const day = (ctx: Context, ref: SlotRef) => when(ctx, ref).split(' ').slice(0, 2).join(' ');

export function districtText(ctx: Context, node: NodeId, d: SeenDistrict, turn: number): string {
  const { food, fodder } = strippingOf(ctx, node, d);
  const seen = d.turn >= turn ? 'now' : `as last seen on ${day(ctx, { turn: d.turn, slot: 0 })}`;
  return `The district of ${place(ctx, node)}, ${seen}: about ${percent(food)} of its food and ${percent(fodder)} of its fodder left.`;
}

export function burnedText(ctx: Context, b: Consequences['burned'][number]): string {
  const how = b.by === 'fr' ? 'when we took it' : 'when the enemy took it';
  return `The depot at ${place(ctx, b.node)} changed hands on ${day(ctx, b.when)}: about ${Math.round(b.permille / 10)}% of its stores burned ${how}.`;
}

export function battleText(ctx: Context, b: Consequences['battles'][number]): string {
  const result = b.winner === 'fr' ? 'the field is ours' : b.winner === 'ru' ? 'our troops were driven from the field' : 'no victor';
  return `Battle at ${place(ctx, b.node)}, ${day(ctx, b.when)}: ${result}. Our losses: about ${thousands(b.ourLosses)} men.`;
}

export function raidText(ctx: Context, r: Consequences['raids'][number]): string {
  const road = ctx.graph.edges.get(r.edge);
  const where = road ? `between ${place(ctx, road.a)} and ${place(ctx, road.b)}` : 'on the road';
  return `Cossacks raided a wagon train ${where} on ${day(ctx, r.when)}: about ${thousands(r.food)} rations burned, ${r.horses.toLocaleString('en-GB')} horses driven off.`;
}

/** The pontoon train in words, for the map and the list (G-027). */
export function pontoonText(train: PontoonTrain, ctx: Context): string {
  const name = (id: string) => ctx.graph.nodes.get(id)?.name ?? id;
  const where = train.transit ? `on the road to ${name(train.transit.to)}` : `at ${name(train.at)}`;
  return `The pontoon train, ${where}${train.work > 0 ? ', bridging the river' : ''}.`;
}
