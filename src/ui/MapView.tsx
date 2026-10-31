import type { Context, Force, GameState, PlannedOrder } from '../engine';
import { shortName, thousands } from './names';
import { MAP_HEIGHT, MAP_WIDTH, POSITION, along, type Point } from './projection';

interface Props {
  s: GameState;
  ctx: Context;
  plan: readonly PlannedOrder[];
  objective: string | null;
  onPick: (place: string) => void;
}

function positionOf(ctx: Context, f: Force): Point {
  const here = POSITION[f.at] as Point;
  if (!f.transit) return here;
  const edge = ctx.graph.edges.get(f.transit.edge);
  return along(here, POSITION[f.transit.to] as Point, edge ? f.transit.metres / edge.metres : 0);
}

/** Prototype map (M1): plain, readable, and showing only what the French know of the enemy. */
export function MapView({ s, ctx, plan, objective, onPick }: Props) {
  const turn = s.resolution.turn;
  const french = Object.values(s.forces)
    .filter((f) => f.side === 'fr' && f.men > 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const stack = new Map<string, number>();
  const slotFor = (key: string) => {
    const n = stack.get(key) ?? 0;
    stack.set(key, n + 1);
    return n;
  };

  return (
    <svg className="map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label="Campaign map">
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-paper" />

      {[...ctx.graph.edges.values()].map((e) => {
        const a = POSITION[e.a] as Point;
        const b = POSITION[e.b] as Point;
        const wet = s.roads[e.id] === 'mud';
        return (
          <g key={e.id}>
            <line className={`road road-${e.road}${wet ? ' road-mud' : ''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {(e.crossing === 'pontoon' || e.crossing === 'ford') && <circle className="crossing" cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={6} />}
          </g>
        );
      })}

      {plan.map((p) => {
        const f = s.forces[p.force];
        if (!f || !p.order.route || p.order.route.length === 0) return null;
        const points = [positionOf(ctx, f), ...p.order.route.map((n) => POSITION[n] as Point)];
        return <polyline key={`plan-${p.force}`} className="planned" points={points.map((q) => `${q.x},${q.y}`).join(' ')} />;
      })}

      {[...ctx.graph.nodes.values()].map((n) => {
        const q = POSITION[n.id] as Point;
        const depot = s.depots[n.id];
        const chosen = objective === n.id;
        return (
          <g
            key={n.id}
            className={`place${chosen ? ' place-objective' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${n.name}${depot ? `, ${depot.side === 'fr' ? 'French' : 'Russian'} depot` : ''}. Set as objective.`}
            onClick={() => onPick(n.id)}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onPick(n.id)}
          >
            {chosen && <circle cx={q.x} cy={q.y} r={13} className="objective-ring" />}
            {depot ? <rect x={q.x - 6} y={q.y - 6} width={12} height={12} className={`depot depot-${depot.side}`} /> : <circle cx={q.x} cy={q.y} r={4.5} className="town" />}
            <text x={q.x + 9} y={q.y - 8} className="place-label">
              {n.name}
            </text>
          </g>
        );
      })}

      {Object.keys(s.intel.fr)
        .sort()
        .map((id) => {
          const x = s.intel.fr[id];
          const f = s.forces[id];
          if (!x || !f) return null;
          const age = turn - x.turn;
          const q = POSITION[x.at] as Point;
          const k = slotFor(x.at);
          return (
            <g key={`ru-${id}`} className="enemy" opacity={age <= 0 ? 1 : age === 1 ? 0.75 : 0.4}>
              <rect x={q.x - 34} y={q.y + 8 + k * 16} width={68} height={14} rx={2} />
              <text x={q.x} y={q.y + 18.5 + k * 16} textAnchor="middle">
                {shortName(id, f.name)} ~{thousands(x.men)}
                {age > 0 ? ` (${age}t)` : ''}
              </text>
            </g>
          );
        })}

      {french.map((f) => {
        const q = positionOf(ctx, f);
        const k = slotFor(f.transit ? `${f.id}-road` : f.at);
        return (
          <g key={f.id} className={`friend${f.battle ? ' friend-battle' : ''}`}>
            <rect x={q.x - 34} y={q.y + 8 + k * 16} width={68} height={14} rx={2} />
            <text x={q.x} y={q.y + 18.5 + k * 16} textAnchor="middle">
              {shortName(f.id, f.name)} {thousands(f.men)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
