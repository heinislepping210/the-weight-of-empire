// Tracing the top bar to the map (M2, G4): what changed the army's men, horses and food since the last orders, and
// where. The change itself comes from the two states, so it is the top bar's own figure; each cause comes from the
// log and the battles, and what no cause explains is shown as that, not spread over the others. French groups only.

import { statusOf } from '../engine';
import type { Context, Force, ForceId, GameState, LogEntry, NodeId } from '../engine';
import { shortName } from './names';

export type Figure = 'men' | 'horses' | 'food';

export const FIGURES: readonly Figure[] = ['men', 'horses', 'food'];

/** Where a cause shows on the map: at a place, or, with no place, on the group wherever it stands. */
export interface TraceMark {
  force: ForceId;
  node: NodeId | null;
  amount: number;
}

export interface Cause {
  id: string;
  text: string;
  /** Men, horses or rations, gained or lost; the marks add up to it. */
  amount: number;
  marks: TraceMark[];
}

export interface Trace {
  figure: Figure;
  change: number;
  causes: Cause[];
}

const frenchOf = (s: GameState) => Object.values(s.forces).filter((f) => f.side === 'fr');
const horsesOf = (f: Force) => f.horses + f.draught;

/** The figures of the top bar: all the army's men and horses, and the rations of the groups still in being. */
export function figuresOf(s: GameState): Record<Figure, number> & { days: number } {
  const french = frenchOf(s);
  const men = french.reduce((n, f) => n + f.men, 0);
  const food = french.filter((f) => f.men > 0).reduce((n, f) => n + f.stock.food, 0);
  return { men, horses: french.reduce((n, f) => n + horsesOf(f), 0), food, days: food / Math.max(1, men) };
}

/** From the last orders to the present pause: the state they were given in, and all that has happened since. */
export function windowOf(states: readonly GameState[], logs: readonly LogEntry[][]): { before: GameState; log: LogEntry[] } | null {
  for (let i = states.length - 2; i >= 0; i--) {
    const s = states[i] as GameState;
    if (statusOf(s).kind === 'awaitingOrders') return { before: s, log: logs.slice(i).flat() };
  }
  return null;
}

/** Adds up what each group lost or gained to each cause, and keeps count of what has been explained. */
function tally() {
  const causes = new Map<string, Cause>();
  const explained = new Map<ForceId, number>();
  return {
    causes,
    explained,
    add(id: string, text: string, force: ForceId, node: NodeId | null, amount: number) {
      if (amount === 0) return;
      const c = causes.get(id) ?? { id, text, amount: 0, marks: [] };
      causes.set(id, c);
      c.amount += amount;
      const m = c.marks.find((x) => x.force === force && x.node === node);
      if (m) m.amount += amount;
      else c.marks.push({ force, node, amount });
      explained.set(force, (explained.get(force) ?? 0) + amount);
    },
  };
}

const CAUSE_TEXT: Record<string, string> = { sickness: 'Sickness', straggling: 'Hunger and straggling' };

/** Whatever the causes leave of each group's change is shown as that; then the largest first. */
function finish(figure: Figure, change: number, t: ReturnType<typeof tally>, groups: readonly ForceId[], changeOf: (id: ForceId) => number): Trace {
  for (const force of groups) t.add('unexplained', 'Not accounted for', force, null, changeOf(force) - (t.explained.get(force) ?? 0));
  const causes = [...t.causes.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.id < b.id ? -1 : 1));
  for (const c of causes) c.marks.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.force < b.force ? -1 : 1));
  return { figure, change, causes };
}

/** Each figure's change since `before`, and what caused it. */
export function traceTurn(before: GameState, after: GameState, log: readonly LogEntry[], ctx: Context): Record<Figure, Trace> {
  const place = (id: NodeId) => ctx.graph.nodes.get(id)?.name ?? id;
  const ours = (id: unknown): id is ForceId => after.forces[String(id)]?.side === 'fr';
  const ids = frenchOf(after).map((f) => f.id);
  const was = figuresOf(before);
  const now = figuresOf(after);

  /** What each group lost in each battle since `before`, as the battle recorded it. */
  const fought = Object.values(after.battles).flatMap((b) => ids.map((id) => ({ id, battle: b.id, node: b.node, lost: (b.losses[id] ?? 0) - (before.battles[b.id]?.losses[id] ?? 0) })).filter((x) => x.lost > 0));

  const men = tally();
  for (const x of fought) men.add(`battle:${x.battle}`, `In the battle at ${place(x.node)}`, x.id, x.node, -x.lost);
  for (const e of log) {
    const d = e.detail;
    if (e.kind !== 'menLost' || !ours(d.force)) continue;
    const node = d.node === null ? null : String(d.node);
    const cause = String(d.cause);
    if (cause === 'skirmish') men.add(`skirmish:${node}`, `In the skirmish at ${place(node as NodeId)}`, d.force, node, -Number(d.men));
    else if (cause === 'withdrawal') men.add(`withdrawal:${node}`, `Falling back from ${place(node as NodeId)}`, d.force, node, -Number(d.men));
    else men.add(cause, CAUSE_TEXT[cause] ?? cause, d.force, node, -Number(d.men));
  }

  const horses = tally();
  for (const e of log) if (e.kind === 'shortfall' && ours(e.detail.force)) horses.add('fodder', 'Short of fodder', e.detail.force, null, -Number(e.detail.horsesDied ?? 0));
  // The only other way a group loses horses is its cavalry falling in battle, which the battle does not count apart.
  for (const id of ids) {
    const lost = horsesOf(before.forces[id] as Force) - horsesOf(after.forces[id] as Force) + (horses.explained.get(id) ?? 0);
    const battle = fought.filter((x) => x.id === id).sort((a, b) => b.lost - a.lost)[0];
    if (lost > 0 && battle) horses.add(`battle:${battle.battle}`, `In the battle at ${place(battle.node)}`, id, battle.node, -lost);
  }

  const food = tally();
  for (const e of log) {
    const d = e.detail;
    if (!ours(d.force)) continue;
    const amount = Number(d.food ?? 0);
    if (e.kind === 'ate') food.add('eaten', 'Eaten by the army', d.force, null, -amount);
    else if (e.kind === 'foraged') food.add('foraged', 'Foraged from the country', d.force, String(d.node), amount);
    else if (e.kind === 'issued') food.add('issued', 'Drawn from the depots', d.force, String(d.node), amount);
    else if (e.kind === 'leftBehind') food.add('leftBehind', 'Left behind on the march', d.force, String(d.node), -amount);
  }
  // A delivery joins a group's stock only at the end of its sub-step: at a battle's pause the latest may not be in yet.
  const comingIn = new Map(ids.map((id) => [id, (after.forces[id] as Force).incoming.food]));
  for (const e of [...log].reverse()) {
    const d = e.detail;
    if (e.kind !== 'delivered' || !ours(d.force)) continue;
    const waiting = Math.min(comingIn.get(d.force) ?? 0, Number(d.food));
    comingIn.set(d.force, (comingIn.get(d.force) ?? 0) - waiting);
    food.add('delivered', 'Brought by the wagon trains', d.force, String(d.node), Number(d.food) - waiting);
  }
  // A group gone takes what it still carried out of the figure.
  for (const id of ids) {
    const [a, b] = [before.forces[id] as Force, after.forces[id] as Force];
    if (a.men > 0 && b.men === 0) food.add('destroyed', 'Lost with groups destroyed', id, null, -(a.stock.food + (food.explained.get(id) ?? 0)));
  }

  const changeIn = (read: (f: Force) => number) => (id: ForceId) => read(after.forces[id] as Force) - read(before.forces[id] as Force);
  return {
    men: finish('men', now.men - was.men, men, ids, changeIn((f) => f.men)),
    horses: finish('horses', now.horses - was.horses, horses, ids, changeIn(horsesOf)),
    food: finish('food', now.food - was.food, food, ids, changeIn((f) => (f.men > 0 ? f.stock.food : 0))),
  };
}

/** The place a mark stands at on the map; null for a group out on the road, which the mark follows. */
export const placeOf = (m: TraceMark, s: GameState): NodeId | null => {
  const f = s.forces[m.force];
  return m.node ?? (f && !f.transit ? f.at : null);
};

/** A whole number with its sign, as the top bar and the trace show it. */
export const signed = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toLocaleString('en-GB')}`;

/** Who a cause touched, and where, in words. */
export function causeDetail(c: Cause, s: GameState, ctx: Context): string {
  return c.marks
    .map((m) => {
      const f = s.forces[m.force];
      const who = f ? shortName(f.id, f.name) : m.force;
      const where = m.node !== null && !c.id.includes(':') ? ` at ${ctx.graph.nodes.get(m.node)?.name ?? m.node}` : '';
      return `${who}${where} ${signed(m.amount)}`;
    })
    .join(', ');
}
