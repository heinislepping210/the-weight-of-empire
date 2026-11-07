import { useMemo } from 'react';
import { axesTo, halfDays, leadGroup, previewRoutes, when } from '../engine';
import type { Axis, Context, Directive, Engagement, Force, GameState, GroupOverride, LogisticsPlan, LogisticsStance, NodeId, Pace, PlannedOrder, PlanSummary, Posture, RoutePreview } from '../engine';
import { shortName, thousands } from './names';

interface Props {
  s: GameState;
  ctx: Context;
  directive: Directive;
  onDirective: (d: Directive) => void;
  /** The one plan, the player's own orders included: what is shown is what is committed. */
  plan: readonly PlannedOrder[];
  summary: PlanSummary | null;
  supply: LogisticsPlan | null;
  overrides: Readonly<Record<string, GroupOverride>>;
  onOverride: (force: string, change: GroupOverride | null) => void;
  halt: boolean;
  onHalt: (halt: boolean) => void;
  onCommit: () => void;
  /** The ways a route would send the groups, while it is pointed at or focused; null when none is. */
  onPreview: (paths: NodeId[][] | null) => void;
}

/** A forecast fatigue in words: the preview speaks of the march, not of cohesion. */
const tiredness = (fatigue: number) => (fatigue < 250 ? 'rested' : fatigue < 500 ? 'tired' : fatigue < 750 ? 'weary' : 'exhausted');

/** A route's preview in a few lines (M2, G1 and G3): arrivals, the most tired and hungriest group, crossings, threats. */
function previewLines(ctx: Context, p: RoutePreview): string[] {
  if (p.paths.length === 0) return ['No group marches.'];
  const lines: string[] = [];
  if (p.sameAs !== undefined) lines.push(`Same orders as ${p.sameAs ?? 'the shortest roads'}.`);
  if (p.arrival) lines.push(`Arrivals ${when(ctx, p.arrival.first)} (dry roads) to ${when(ctx, p.arrival.last)} (wet weather).`);
  if (p.late.length > 0) lines.push(`${p.late.length === 1 ? '1 group arrives' : `${p.late.length} groups arrive`} only after the campaign ends, or not without rest.`);
  for (const b of p.bridges) lines.push(b.ready ? `Bridge between ${b.between}: ready ${when(ctx, b.ready)}.` : `Bridge between ${b.between}: the train cannot reach the bank.`);
  if (p.queues.length > 0) {
    const held = p.queues.map((q) => `${shortName(q.force, q.name)} behind ${shortName(q.behindForce, q.behind)} from ${q.at}, ${Number.isFinite(q.slots) ? `about ${halfDays(q.slots)}` : 'stopped'}`);
    lines.push(`Queues: ${held.join('; ')}.`);
  }
  if (p.tiredest) lines.push(`Most tired on arrival: ${shortName(p.tiredest.force, p.tiredest.name)}, ${tiredness(p.tiredest.fatigue)}.`);
  if (p.hungriest) lines.push(`Least food on arrival: ${shortName(p.hungriest.force, p.hungriest.name)}, about ${p.hungriest.days} day${p.hungriest.days === 1 ? '' : 's'}.`);
  lines.push(p.crossings.length === 0 ? 'No river to cross.' : `Crosses: ${p.crossings.map((c) => `${c.between} (${c.by})`).join('; ')}.`);
  lines.push(p.threats.length === 0 ? 'No known enemy near the way.' : `${p.threats.length === 1 ? 'A known enemy' : `${p.threats.length} known enemies`} near the way: ${p.threats.map((t) => t.replace(/^Known enemy: /, '').replace(/\.$/, '')).join('; ')}.`);
  return lines;
}

/** One word for fatigue and cohesion together (§2.5); the numbers stay one hover away. */
export function condition(f: Force): string {
  const score = f.cohesion - Math.floor(f.fatigue / 2);
  return score > 650 ? 'Fresh' : score > 500 ? 'Steady' : score > 350 ? 'Worn' : score > 200 ? 'Exhausted' : 'Breaking';
}

const PACES: Pace[] = ['rest', 'steady', 'forced'];
const STANCES: Engagement[] = ['seek', 'accept', 'stand', 'avoid'];
const POSTURES: Posture[] = ['dispersed', 'concentrated'];
const SUPPLY: [LogisticsStance, string][] = [
  ['hold', 'Keep the depots'],
  ['forward', 'Bring depots forward'],
];
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Sets or clears one field of a group's own orders, keeping the others. */
function changed(own: GroupOverride | undefined, field: keyof GroupOverride, value: string): GroupOverride | null {
  const next: Record<string, string | undefined> = { ...own, [field]: value || undefined };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  return Object.keys(next).length > 0 ? (next as GroupOverride) : null;
}

export function OrdersPanel({ s, ctx, directive, onDirective, plan, summary, supply, overrides, onOverride, halt, onHalt, onCommit, onPreview }: Props) {
  const places = [...ctx.graph.nodes.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lead = directive.objective ? leadGroup(s, ctx, directive.objective) : null;
  // The routes traced from the current lead group, and the chosen one even when it was traced from another.
  // Up to four: from Liozno the new road to Liubavichi puts Orsha ahead of the northern flank by Porechye (G1, D-052).
  const traced = directive.objective && lead ? axesTo(ctx, lead.at, directive.objective, 4) : [];
  const kept = directive.axis && !traced.some((a) => a.id === directive.axis?.id) ? directive.axis : null;
  const routes: Axis[] = kept ? [kept, ...traced] : traced;
  const set = (change: Partial<Directive>) => onDirective({ ...directive, ...change });
  // Every route planned at once when the objective or the orders change, so that pointing at one shows it at once.
  const options = useMemo<(Axis | null)[]>(() => (directive.objective ? [null, ...routes] : []), [directive.objective, routes.map((a) => a.id).join()]);
  const previews = useMemo(
    () => (options.length > 0 ? previewRoutes(s, ctx, { ...directive, overrides, axis: null }, options) : []),
    [s, ctx, options, directive.objective, directive.tempo, directive.posture, directive.engagement, directive.holdBack, overrides],
  );
  const ownCount = plan.filter((p) => p.own).length;

  return (
    <section className="panel" aria-labelledby="orders-title">
      <h2 id="orders-title">Army directive</h2>
      {s.halted ? (
        <p className="warning">The army has halted for the season. Groups hold their ground; you can still change posture and battle stance.</p>
      ) : (
        <label className="choice halt">
          <input type="checkbox" checked={halt} onChange={(e) => onHalt(e.target.checked)} /> Declare a halt for the season. This is final: the army will hold where it stands until the campaign ends.
        </label>
      )}
      <div className="form-grid">
        <label>
          Objective
          <select value={directive.objective ?? ''} disabled={s.halted || halt} onChange={(e) => set({ objective: e.target.value || null, axis: null })}>
            <option value="">Hold the current line</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {directive.objective && previews.length > 0 && (
          <fieldset className="routes">
            <legend>Route (point at one to see it on the map)</legend>
            {previews.map((p) => {
              const a = p.axis;
              const chosen = (directive.axis?.id ?? null) === (a?.id ?? null);
              return (
                <label
                  key={a?.id ?? 'shortest'}
                  className={`route-card${chosen ? ' route-chosen' : ''}`}
                  onMouseEnter={() => onPreview(p.paths)}
                  onMouseLeave={() => onPreview(null)}
                  onFocus={() => onPreview(p.paths)}
                  onBlur={() => onPreview(null)}
                >
                  <span className="route-title">
                    <input type="radio" name="route" aria-label={a ? a.label : 'Shortest roads for each group'} checked={chosen} onChange={() => set({ axis: a })} /> {a ? a.label : 'Shortest roads for each group'}
                    {a && (
                      <span className="figures">
                        {' '}
                        {Math.round(a.metres / 1000)} km from {ctx.graph.nodes.get(a.places[0] ?? '')?.name}
                        {a === kept ? ', as chosen earlier' : ''}
                      </span>
                    )}
                  </span>
                  <ul className="reasons">
                    {previewLines(ctx, p).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </label>
              );
            })}
          </fieldset>
        )}
        <fieldset>
          <legend>Pace</legend>
          {PACES.map((p) => (
            <label key={p} className="choice">
              <input type="radio" name="tempo" checked={directive.tempo === p} onChange={() => set({ tempo: p })} /> {label(p)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Groups that halt</legend>
          {POSTURES.map((p) => (
            <label key={p} className="choice">
              <input type="radio" name="posture" checked={directive.posture === p} onChange={() => set({ posture: p })} /> {label(p)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Battle</legend>
          {STANCES.map((e) => (
            <label key={e} className="choice">
              <input type="radio" name="stance" checked={directive.engagement === e} onChange={() => set({ engagement: e })} /> {label(e)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Supply</legend>
          {SUPPLY.map(([value, text]) => (
            <label key={value} className="choice">
              <input type="radio" name="supply" checked={directive.logistics === value} onChange={() => set({ logistics: value })} /> {text}
            </label>
          ))}
        </fieldset>
      </div>

      {summary && (
        <>
          <h3>What these orders mean</h3>
          <ul className="reasons summary">
            {summary.lines.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}

      {supply && (
        <>
          <h3>Supply arrangements</h3>
          <ul className="reasons">
            {supply.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}

      <details className="plan-details">
        <summary>
          Orders for each group ({plan.length}){ownCount > 0 ? `, ${ownCount} with your own orders` : ''}
        </summary>
        <ol className="plan">
          {plan.map((p) => {
            const f = s.forces[p.force];
            if (!f) return null;
            const own = overrides[p.force];
            const held = directive.holdBack.includes(p.force);
            return (
              <li key={p.force} className={p.own ? 'plan-overridden' : ''}>
                <div className="plan-head">
                  <strong>{p.name}</strong>
                  <span className="figures">
                    {thousands(f.men)} men · {thousands(f.horses + f.draught)} horses · {Math.floor(f.stock.food / Math.max(1, f.men))} days' food · {condition(f)}
                    {p.own ? ' · Your order' : ''}
                  </span>
                </div>
                <ul className="reasons">
                  {p.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {f.battle === null && (
                  <div className="plan-controls">
                    <label className="choice">
                      <input
                        type="checkbox"
                        checked={held}
                        onChange={(e) => set({ holdBack: e.target.checked ? [...directive.holdBack, p.force] : directive.holdBack.filter((x) => x !== p.force) })}
                      />{' '}
                      Hold back
                    </label>
                    <label>
                      Pace{' '}
                      <select value={own?.pace ?? ''} onChange={(e) => onOverride(p.force, changed(own, 'pace', e.target.value))}>
                        <option value="">Staff: {directive.tempo}</option>
                        {PACES.map((x) => (
                          <option key={x} value={x}>
                            {label(x)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {p.staffRoad !== null && (
                      <label>
                        Road{' '}
                        <select value={own?.road ?? ''} onChange={(e) => onOverride(p.force, changed(own, 'road', e.target.value))}>
                          <option value="">Staff: {p.staffRoad === 'own' ? 'own road' : 'follow the route'}</option>
                          <option value="route">Follow the route</option>
                          <option value="own">Own road</option>
                        </select>
                      </label>
                    )}
                    <label>
                      Battle{' '}
                      <select value={own?.engagement ?? ''} onChange={(e) => onOverride(p.force, changed(own, 'engagement', e.target.value))}>
                        <option value="">Staff: {directive.engagement}</option>
                        {STANCES.map((x) => (
                          <option key={x} value={x}>
                            {label(x)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </details>
      <button type="button" className="primary" onClick={onCommit}>
        Commit orders for the next two days
      </button>
    </section>
  );
}
