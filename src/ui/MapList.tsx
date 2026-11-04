import { when } from '../engine';
import type { Context, GameState, SupplyLine } from '../engine';
import { shortName, thousands } from './names';
import { condition } from './OrdersPanel';
import { battleText, burnedText, districtText, strippingOf, type Consequences } from './consequences';
import { isShort, supplyText } from './playbackModel';

interface Props {
  s: GameState;
  ctx: Context;
  objective: string | null;
  onPick: (place: string) => void;
  supply?: readonly SupplyLine[];
  consequences?: Consequences | null;
}

/**
 * The map as a list (M2, G7): every place with what stands there, what marches to it and what the scouts last
 * reported of the enemy, then the supply lines (G5), for keyboard and screen-reader play. It shows only what the
 * French know.
 */
export function MapList({ s, ctx, objective, onPick, supply = [], consequences = null }: Props) {
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
          // What the campaign has left here: a district foraged, stores burned, a battle fought (V5).
          const district = consequences?.districts.get(n.id);
          const marks = [
            ...(district && strippingOf(ctx, n.id, district).stripping !== 'untouched' ? [districtText(ctx, n.id, district, turn)] : []),
            ...(consequences?.burned.filter((b) => b.node === n.id).map((b) => burnedText(ctx, b)) ?? []),
            ...(consequences?.battles.filter((b) => b.node === n.id).map((b) => battleText(ctx, b)) ?? []),
          ];
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
              {(here.length > 0 || coming.length > 0 || seen.length > 0 || marks.length > 0) && (
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
                  {marks.map((text) => (
                    <li key={text}>{text}</li>
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
      {supply.length > 0 && (
        <>
          <h3>Supply lines</h3>
          <ul className="reasons">
            {supply.map((l) => (
              <li key={l.convoy} className={isShort(l) ? 'supply-short-text' : ''}>
                {supplyText(l, s, ctx)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
