import type { ReactNode } from 'react';
import type { Context, GameState } from '../engine';
import { causeDetail, signed, type Figure, type Trace } from './trace';

const TITLE: Record<Figure, string> = { men: 'Men', horses: 'Horses', food: 'Food' };

/** A figure in the top bar: with something to trace, a button that shows on the map where its change came from (G4). */
export function TopFigure({ trace, change, open, onToggle, children }: { trace: Trace | null; change: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  if (!trace || trace.causes.length === 0) return <>{children}</>;
  return (
    <button type="button" className="figure" aria-expanded={open} aria-controls="trace-panel" title="Show on the map what changed this since the last orders" onClick={onToggle}>
      {children}
      {change && <span className={`figure-change ${change.startsWith('−') ? 'figure-down' : 'figure-up'}`}> {change}</span>}
    </button>
  );
}

/** What changed a figure since the last orders, the largest first: pick a cause to see it alone on the map. */
export function TracePanel({ trace, s, ctx, cause, onCause, onClose }: { trace: Trace; s: GameState; ctx: Context; cause: string | null; onCause: (id: string | null) => void; onClose: () => void }) {
  return (
    <section className="panel trace-panel" id="trace-panel" aria-labelledby="trace-title">
      <div className="panel-head">
        <h2 id="trace-title">
          {TITLE[trace.figure]} since the last orders: {trace.change === 0 ? 'no change' : signed(trace.change)}
          {trace.figure === 'food' && trace.change !== 0 ? ' rations' : ''}
        </h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <ul className="trace-causes">
        {trace.causes.map((c) => (
          <li key={c.id}>
            <button type="button" aria-pressed={cause === c.id} onClick={() => onCause(cause === c.id ? null : c.id)}>
              <span className="trace-amount">{signed(c.amount)}</span> {c.text}
            </button>
            <span className="muted"> {causeDetail(c, s, ctx)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
