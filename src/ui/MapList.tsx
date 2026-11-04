import { when } from '../engine';
import type { Context, GameState } from '../engine';
import { shortName, thousands } from './names';
import { condition } from './OrdersPanel';

interface Props {
  s: GameState;
  ctx: Context;
  objective: string | null;
  onPick: (place: string) => void;
}

/**
 * The map as a list (M2, G7): every place with what stands there, what marches to it and what the scouts last
 * reported of the enemy, for keyboard and screen-reader play. It shows only what the French know.
 */
export function MapList({ s, ctx, objective, onPick }: Props) {
  const turn = s.resolution.turn;
  const day = (t: number) => when(ctx, { turn: t, slot: 0 }).split(' ').slice(0, 2).join(' ');
  const french = Object.values(s.forces).filter((f) => f.side === 'fr' && f.men > 0);
  const places = [...ctx.graph.nodes.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="panel map-list" aria-label="The map as a list">
      <ul>
        {places.map((n) => {
          const depot = s.depots[n.id];
          const here = french.filter((f) => f.transit === null && f.at === n.id);
          const coming = french.filter((f) => f.transit?.to === n.id);
          const seen = Object.entries(s.intel.fr).filter(([, x]) => x.at === n.id);
          return (
            <li key={n.id} className={objective === n.id ? 'map-list-objective' : ''}>
              <div className="map-list-head">
                <strong>{n.name}</strong>
                {depot && <span className="muted"> · {depot.side === 'fr' ? 'French' : 'Russian'} depot</span>}
                {objective === n.id && <span className="muted"> · the objective</span>}
                <button type="button" onClick={() => onPick(n.id)} disabled={objective === n.id}>
                  Set as objective
                </button>
              </div>
              {(here.length > 0 || coming.length > 0 || seen.length > 0) && (
                <ul className="reasons">
                  {here.map((f) => (
                    <li key={f.id}>
                      Ours: {shortName(f.id, f.name)}, {thousands(f.men)} men, {f.battle ? 'in battle' : f.posture}, {condition(f).toLowerCase()}
                    </li>
                  ))}
                  {coming.map((f) => (
                    <li key={f.id}>
                      On the way here: {shortName(f.id, f.name)}, {thousands(f.men)} men
                    </li>
                  ))}
                  {seen.map(([id, x]) => (
                    <li key={id}>
                      Enemy: {shortName(id, s.forces[id]?.name ?? id)}, about {thousands(x.men)}, {turn - x.turn <= 0 ? 'reported this turn' : `last seen ${day(x.turn)}`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
