import { axesTo, leadGroup } from '../engine';
import type { Context, Directive, Engagement, Force, GameState, GroupOrder, Pace, PlannedOrder, Posture } from '../engine';
import { thousands } from './names';

interface Props {
  s: GameState;
  ctx: Context;
  directive: Directive;
  onDirective: (d: Directive) => void;
  plan: readonly PlannedOrder[];
  overrides: Readonly<Record<string, Partial<GroupOrder>>>;
  onOverride: (force: string, change: Partial<GroupOrder> | null) => void;
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
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function OrdersPanel({ s, ctx, directive, onDirective, plan, overrides, onOverride, onCommit }: Props) {
  const places = [...ctx.graph.nodes.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lead = directive.objective ? leadGroup(s, ctx, directive.objective) : null;
  const axes = directive.objective && lead ? axesTo(ctx, lead.at, directive.objective) : [];
  const set = (change: Partial<Directive>) => onDirective({ ...directive, ...change });

  return (
    <section className="panel" aria-labelledby="orders-title">
      <h2 id="orders-title">Army directive</h2>
      <div className="form-grid">
        <label>
          Objective
          <select value={directive.objective ?? ''} onChange={(e) => set({ objective: e.target.value || null, axis: null })}>
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
            <select value={directive.axis ?? ''} onChange={(e) => set({ axis: e.target.value || null })}>
              <option value="">Shortest roads for each group</option>
              {axes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({Math.round(a.metres / 1000)} km from {ctx.graph.nodes.get(a.places[0] ?? '')?.name})
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
      </div>

      <h3>Orders of the day</h3>
      <ol className="plan">
        {plan.map((p) => {
          const f = s.forces[p.force];
          if (!f) return null;
          const own = overrides[p.force];
          const held = directive.holdBack.includes(p.force);
          return (
            <li key={p.force} className={own ? 'plan-overridden' : ''}>
              <div className="plan-head">
                <strong>{p.name}</strong>
                <span className="figures">
                  {thousands(f.men)} men · {thousands(f.horses)} horses · {Math.floor(f.stock.food / Math.max(1, f.men))} days' food · {condition(f)}
                  {own ? ' · Your order' : ''}
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
                    <select value={own?.pace ?? ''} onChange={(e) => onOverride(p.force, e.target.value ? { ...own, pace: e.target.value as Pace } : null)}>
                      <option value="">Staff: {p.order.pace ?? 'steady'}</option>
                      {PACES.map((x) => (
                        <option key={x} value={x}>
                          {label(x)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Battle{' '}
                    <select value={own?.engagement ?? ''} onChange={(e) => onOverride(p.force, e.target.value ? { ...own, engagement: e.target.value as Engagement } : null)}>
                      <option value="">Staff: {p.order.engagement ?? 'accept'}</option>
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
      <button type="button" className="primary" onClick={onCommit}>
        Commit orders for the next two days
      </button>
    </section>
  );
}
