import { axesTo, leadGroup } from '../engine';
import type { Axis, Context, Directive, Engagement, Force, GameState, GroupOverride, LogisticsPlan, LogisticsStance, Pace, PlannedOrder, PlanSummary, Posture } from '../engine';
import { thousands } from './names';

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
}

/** One word for fatigue and cohesion together (§2.5); the numbers stay one hover away. */
export function condition(f: Force): string {
  const score = f.cohesion - Math.floor(f.fatigue / 2);
  return score > 650 ? 'Fresh' : score > 500 ? 'Steady' : score > 350 ? 'Worn' : score > 200 ? 'Exhausted' : 'Breaking';
}

const PACES: Pace[] = ['rest', 'steady', 'forced'];
const STANCES: Engagement[] = ['seek', 'accept', 'avoid'];
const POSTURES: Posture[] = ['dispersed', 'concentrated'];
const SUPPLY: [LogisticsStance, string][] = [
  ['hold', 'Keep the depots'],
  ['forward', 'Bring depots forward'],
];
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Sets or clears one field of a group's own orders, keeping the other. */
function changed(own: GroupOverride | undefined, field: keyof GroupOverride, value: string): GroupOverride | null {
  const next: GroupOverride = { ...own, [field]: value || undefined };
  if (next.pace === undefined) delete next.pace;
  if (next.engagement === undefined) delete next.engagement;
  return Object.keys(next).length > 0 ? next : null;
}

export function OrdersPanel({ s, ctx, directive, onDirective, plan, summary, supply, overrides, onOverride, halt, onHalt, onCommit }: Props) {
  const places = [...ctx.graph.nodes.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lead = directive.objective ? leadGroup(s, ctx, directive.objective) : null;
  // The routes traced from the current lead group, and the chosen one even when it was traced from another.
  const traced = directive.objective && lead ? axesTo(ctx, lead.at, directive.objective) : [];
  const kept = directive.axis && !traced.some((a) => a.id === directive.axis?.id) ? directive.axis : null;
  const routes: Axis[] = kept ? [kept, ...traced] : traced;
  const set = (change: Partial<Directive>) => onDirective({ ...directive, ...change });
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
        {directive.objective && (
          <label>
            Route
            <select value={directive.axis?.id ?? ''} onChange={(e) => set({ axis: routes.find((a) => a.id === e.target.value) ?? null })}>
              <option value="">Shortest roads for each group</option>
              {routes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({Math.round(a.metres / 1000)} km from {ctx.graph.nodes.get(a.places[0] ?? '')?.name}){a === kept ? ', as chosen earlier' : ''}
                </option>
              ))}
            </select>
          </label>
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
