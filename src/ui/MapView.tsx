import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { when } from '../engine';
import type { Context, Force, GameState, PlannedOrder } from '../engine';
import { bandOf, fit, onKey, panBy, viewBoxOf, zoomAbout, zoomOf, type Camera } from '../map/camera';
import { shortName, thousands } from './names';
import { condition } from './OrdersPanel';
import { MAP_HEIGHT, MAP_WIDTH, POSITION, along, type Point } from './projection';

interface Props {
  s: GameState;
  ctx: Context;
  plan: readonly PlannedOrder[];
  objective: string | null;
  onPick: (place: string) => void;
}

const WORLD = { width: MAP_WIDTH, height: MAP_HEIGHT };
/** A press that moves less than this, in screen pixels, is a click, not a drag. */
const DRAG_PIXELS = 4;

function positionOf(ctx: Context, f: Force): Point {
  const here = POSITION[f.at] as Point;
  if (!f.transit) return here;
  const edge = ctx.graph.edges.get(f.transit.edge);
  return along(here, POSITION[f.transit.to] as Point, edge ? f.transit.metres / edge.metres : 0);
}

/**
 * Places too close to label apart until the local zoom (V8): Smolensk's north-bank suburb, 1.3 km from the Old
 * Town, shares the Old Town's label and its stack of markers until then. At the local zoom its own markers stack
 * above it, clear of the Old Town's.
 */
const CLUSTER: Record<string, string> = { 'smolensk-north': 'smolensk' };
const CLUSTER_NAME: Record<string, string> = { smolensk: 'Smolensk' };
/**
 * Labels set to the left of their place: Smolensk's, clear of the Moscow road and Valutino's label to the east;
 * Orsha's, clear of the markers at Dubrovna next door; Dorogobuzh's, which would run off the map's eastern edge.
 */
const LABEL_LEFT = new Set(['smolensk', 'smolensk-north', 'orsha', 'dorogobuzh']);

/** About how wide a marker's text runs at its 10-pixel size, so that its box fits it. */
const textWidth = (text: string) => text.length * 5.6;

/** What a French group is doing, as its marker shows it (M2, V3). */
type Activity = 'battle' | 'marching' | 'dispersed' | 'concentrated';

const activityOf = (f: Force): Activity => (f.battle ? 'battle' : f.transit || f.route.length > 0 ? 'marching' : f.posture === 'dispersed' ? 'dispersed' : 'concentrated');

const ACTIVITY_WORDS: Record<Activity, string> = { battle: 'in battle', marching: 'marching', dispersed: 'dispersed to feed', concentrated: 'concentrated' };

/** The marker's glyph, drawn about (0, 0) at its base size and scaled with the group's strength. */
function Glyph({ activity, men }: { activity: Activity; men: number }) {
  const k = Math.min(1.3, Math.max(0.7, Math.sqrt(men / 40_000)));
  return (
    <g transform={`scale(${k})`} className="glyph" aria-hidden="true">
      {activity === 'battle' && <path d="M -6 -3 L 6 -3 M -6 3 L 6 3 M -4 -5 L -4 5 M 4 -5 L 4 5" />}
      {activity === 'marching' && <path d="M -7 -2.5 L 3 -2.5 L 3 -5 L 8 0 L 3 5 L 3 2.5 L -7 2.5 Z" />}
      {activity === 'dispersed' && (
        <>
          <circle cx={-5} cy={2} r={2} />
          <circle cx={0} cy={-3} r={2} />
          <circle cx={5} cy={2} r={2} />
        </>
      )}
      {activity === 'concentrated' && <rect x={-4.5} y={-4.5} width={9} height={9} />}
    </g>
  );
}

/**
 * The campaign map (M2, first slice): the camera pans and zooms, labels and markers keep their size on screen, and
 * markers show what each group is doing. It shows only what the French know of the enemy.
 */
export function MapView({ s, ctx, plan, objective, onPick }: Props) {
  const [cam, setCam] = useState<Camera>(() => fit(WORLD));
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dragged: boolean; start: { x: number; y: number }; pinch: number | null }>({ dragged: false, start: { x: 0, y: 0 }, pinch: null });

  // How wide the map is drawn on the page, so that labels and markers keep a readable size on any screen (V9).
  const [drawnWidth, setDrawnWidth] = useState(MAP_WIDTH * 0.8);
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => entry && entry.contentRect.width > 0 && setDrawnWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoom = zoomOf(WORLD, cam);
  const band = bandOf(WORLD, cam);
  /** Screen pixels per map unit at this zoom and on this screen. */
  const pixels = (drawnWidth / MAP_WIDTH) * zoom;
  /** Labels and markers are drawn at this scale, so that they keep their size on screen: about 10-pixel text. */
  const u = 0.85 / pixels;
  /** Where the map is drawn small (a phone, the whole theatre), markers are compact and only the main places named. */
  const compact = pixels < 0.6;
  const major = new Set([...ctx.graph.nodes.keys()].filter((id) => s.depots[id] || (ctx.scenario.keyPlaces ?? []).includes(id) || (ctx.scenario.cutOffPlaces ?? []).includes(id)));

  // The wheel zooms when asked to (Ctrl or a trackpad pinch), or once the map has focus; otherwise the page scrolls.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !el.contains(document.activeElement)) return;
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      setCam((c) => zoomAbout(WORLD, c, Math.exp(-ev.deltaY * 0.0015), (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const fraction = (x: number, y: number) => {
    const r = svg.current?.getBoundingClientRect();
    return r ? { fx: (x - r.left) / r.width, fy: (y - r.top) / r.height, w: r.width, h: r.height } : null;
  };

  function onPointerDown(ev: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.current.size === 1) gesture.current = { dragged: false, start: { x: ev.clientX, y: ev.clientY }, pinch: null };
  }

  function onPointerMove(ev: ReactPointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(ev.pointerId);
    if (!prev) return;
    const all = [...pointers.current.values()];
    const g = gesture.current;
    if (all.length >= 2) {
      // Two fingers: zoom by the change in their distance, about their midpoint.
      const other = [...pointers.current.entries()].find(([id]) => id !== ev.pointerId)?.[1];
      if (other) {
        const d = Math.hypot(ev.clientX - other.x, ev.clientY - other.y);
        const f = fraction((ev.clientX + other.x) / 2, (ev.clientY + other.y) / 2);
        if (g.pinch && f) setCam((c) => zoomAbout(WORLD, c, d / (g.pinch as number), f.fx, f.fy));
        g.pinch = d;
        g.dragged = true;
      }
    } else {
      if (!g.dragged && Math.hypot(ev.clientX - g.start.x, ev.clientY - g.start.y) >= DRAG_PIXELS) {
        g.dragged = true;
        // Captured only once it is a drag, so that a plain click still reaches the place under it.
        svg.current?.setPointerCapture(ev.pointerId);
      }
      const f = fraction(ev.clientX, ev.clientY);
      if (g.dragged && f) setCam((c) => panBy(WORLD, c, (ev.clientX - prev.x) / f.w, (ev.clientY - prev.y) / f.h));
    }
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  }

  function onPointerUp(ev: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(ev.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = null;
  }

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
  const merged = band !== 'local';
  /** Where a place's markers stand and stack, and whether they stack upwards (a cluster member at the local zoom). */
  const anchorOf = (place: string) => {
    const head = CLUSTER[place];
    if (!head) return { at: place, up: false };
    return merged ? { at: head, up: false } : { at: place, up: true };
  };
  /** The vertical offset of a marker row: below the place, or above it for a stack that goes up. */
  const rowY = (k: number, up: boolean) => (up ? -24 - k * 16 : 8 + k * 16);
  const day = (t: number) => when(ctx, { turn: t, slot: 0 }).split(' ').slice(0, 2).join(' ');

  return (
    <div className="map-frame">
      <svg
        ref={svg}
        className={`map map-${band}`}
        viewBox={viewBoxOf(WORLD, cam)}
        role="group"
        aria-label={`Campaign map, ${band} view. Drag to pan; arrow keys pan, plus and minus zoom, 0 shows the whole theatre.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(ev) => {
          // A drag that ends over a place is not a click on it.
          if (gesture.current.dragged) {
            ev.stopPropagation();
            gesture.current.dragged = false;
          }
        }}
        onKeyDown={(ev) => {
          const next = onKey(WORLD, cam, ev.key);
          if (next) {
            ev.preventDefault();
            setCam(next);
          }
        }}
      >
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-paper" />

        {[...ctx.graph.edges.values()].map((e) => {
          const a = POSITION[e.a] as Point;
          const b = POSITION[e.b] as Point;
          const wet = s.roads[e.id] === 'mud';
          return (
            <g key={e.id}>
              <line className={`road road-${e.road}${wet ? ' road-mud' : ''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {(e.crossing === 'pontoon' || e.crossing === 'ford') && <circle className="crossing" cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={6 * u} />}
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
          const hidden = (merged && CLUSTER[n.id] !== undefined) || (compact && !major.has(n.id) && !chosen);
          const label = merged ? (CLUSTER_NAME[n.id] ?? n.name) : n.name;
          const left = LABEL_LEFT.has(n.id);
          return (
            <g
              key={n.id}
              className={`place${chosen ? ' place-objective' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${n.name}${depot ? `, ${depot.side === 'fr' ? 'French' : 'Russian'} depot` : ''}. Set as objective.`}
              onClick={() => onPick(n.id)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  ev.stopPropagation();
                  onPick(n.id);
                }
              }}
            >
              <g transform={`translate(${q.x} ${q.y}) scale(${u})`}>
                {chosen && <circle r={13} className="objective-ring" />}
                {depot ? <rect x={-6} y={-6} width={12} height={12} className={`depot depot-${depot.side}`} /> : <circle r={4.5} className="town" />}
                {!hidden && (
                  <text x={left ? -10 : 9} y={left ? 4 : -8} textAnchor={left ? 'end' : 'start'} className="place-label">
                    {label}
                  </text>
                )}
              </g>
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
            const { at, up } = anchorOf(x.at);
            const q = POSITION[at] as Point;
            const k = slotFor(at);
            const y = rowY(k, up);
            // Reports fade with age; after two turns they are a "last seen" ghost with its date (§2.9).
            const ghost = age >= 2;
            const text = compact ? `~${thousands(x.men)}` : `${shortName(id, f.name)} ~${thousands(x.men)}${ghost ? ` · seen ${day(x.turn)}` : age === 1 ? ' (1t)' : ''}`;
            const w = textWidth(text) + 12;
            return (
              <g key={`ru-${id}`} className={`enemy${ghost ? ' enemy-ghost' : ''}`} opacity={age <= 0 ? 1 : age === 1 ? 0.75 : 0.55} transform={`translate(${q.x} ${q.y}) scale(${u})`}>
                <rect x={-w / 2} y={y} width={w} height={14} rx={2} />
                <text x={0} y={y + 10.5} textAnchor="middle">
                  {text}
                </text>
              </g>
            );
          })}

        {french.map((f) => {
          // On the road a group stands where it is, its marker above the road, clear of the stacks below the places;
          // at a place it joins that place's stack.
          const { at, up } = f.transit ? { at: f.at, up: true } : anchorOf(f.at);
          const q = f.transit ? positionOf(ctx, f) : (POSITION[at] as Point);
          const k = slotFor(f.transit ? `${f.id}-road` : at);
          const y = rowY(k, up);
          const activity = activityOf(f);
          const state = condition(f);
          const worn = state === 'Worn' || state === 'Exhausted' || state === 'Breaking';
          const text = compact ? thousands(f.men) : `${shortName(f.id, f.name)} ${thousands(f.men)}${worn ? ' · worn' : ''}`;
          // The glyph's room on the left, then the text, centred on the place as a whole.
          const w = 24 + textWidth(text);
          return (
            <g key={f.id} className={`friend friend-${activity}${worn ? ' friend-worn' : ''}`} transform={`translate(${q.x} ${q.y}) scale(${u})`}>
              <title>{`${f.name}: ${thousands(f.men)} men, ${ACTIVITY_WORDS[activity]}, ${state.toLowerCase()}`}</title>
              <rect x={-w / 2} y={y} width={w} height={14} rx={2} />
              <g transform={`translate(${-w / 2 + 10} ${y + 7})`}>
                <Glyph activity={activity} men={f.men} />
              </g>
              <text x={-w / 2 + 20} y={y + 10.5}>
                {text}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-controls" role="group" aria-label="Map zoom">
        <button type="button" aria-label="Zoom in" onClick={() => setCam((c) => zoomAbout(WORLD, c, 1.5))}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => setCam((c) => zoomAbout(WORLD, c, 1 / 1.5))}>
          −
        </button>
        <button type="button" onClick={() => setCam(fit(WORLD))}>
          Whole theatre
        </button>
        <span className="map-band">{band === 'theatre' ? 'Theatre' : band === 'operations' ? 'Operations' : 'Local'}</span>
      </div>
    </div>
  );
}
