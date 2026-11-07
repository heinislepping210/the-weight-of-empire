import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { closedRoads, when } from '../engine';
import type { Context, Force, Frame, GameState, PlannedOrder, PontoonTrain, SupplyLine } from '../engine';
import { bandOf, fit, heightOf, onKey, panBy, viewBoxOf, zoomAbout, zoomOf, type Camera } from '../map/camera';
import { shortName, thousands } from './names';
import { condition } from './OrdersPanel';
import { battleText, burnedText, districtText, dustOf, pontoonText, strippingOf, type Consequences } from './consequences';
import { PlaybackLayer, type PlaybackBar, type PlaybackView } from './Playback';
import { TerrainLayer } from './TerrainLayer';
import { isShort, supplyText, trailsOf } from './playbackModel';
import { MAP_HEIGHT, MAP_WIDTH, POSITION, along, type Point } from './projection';

interface Props {
  s: GameState;
  ctx: Context;
  plan: readonly PlannedOrder[];
  /** The ways the route pointed at in the orders panel would send the groups (M2, G3); null when none is. */
  preview?: readonly (readonly string[])[] | null;
  objective: string | null;
  onPick: (place: string) => void;
  /** The turn just resolved, played back on the map while set (M2, G4); `key` starts it again. */
  playback?: { frames: readonly Frame[]; key: number } | null;
  onPlaybackEnd?: () => void;
  /** The turn just resolved, once played: where each group went is drawn beside the plan for the next. */
  trails?: readonly Frame[] | null;
  /** The French wagon trains at work and what each can bring a day (G5). */
  supply?: readonly SupplyLine[];
  /** What the campaign has left on the map, as the French know it (V5). */
  consequences?: Consequences | null;
}

const WORLD = { width: MAP_WIDTH, height: MAP_HEIGHT };
/** Whether the camera follows the moments that matter during playback (V7): a choice kept on this device. */
const FOLLOW_KEY = 'woe.camera.follow';
function loadFollow(): boolean {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return localStorage.getItem(FOLLOW_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** A district's mark: a hatched ring around its place, darker as foragers take more of it. */
const DISTRICT_RADIUS = 17;

/** A press that moves less than this, in screen pixels, is a click, not a drag. */
const DRAG_PIXELS = 4;

function positionOf(ctx: Context, f: Force): Point {
  const here = POSITION[f.at] as Point;
  if (!f.transit) return here;
  const edge = ctx.graph.edges.get(f.transit.edge);
  return along(here, POSITION[f.transit.to] as Point, edge ? f.transit.metres / edge.metres : 0);
}

/** Where the pontoon train stands, on the road if it is on the march. */
function trainAt(train: PontoonTrain, ctx: Context): Point {
  const here = POSITION[train.at] as Point;
  if (!train.transit) return here;
  const edge = ctx.graph.edges.get(train.transit.edge);
  return along(here, POSITION[train.transit.to] as Point, edge ? train.transit.metres / edge.metres : 0);
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
 * The campaign map (M2): the camera pans and zooms, labels and markers keep their size on screen, and markers show
 * what each group is doing. Each turn plays back on it, then leaves a trail of where each group went, and the supply
 * lines show what each wagon train can bring a day. It shows only what the French know of the enemy.
 */
export function MapView({ s, ctx, plan, preview = null, objective, onPick, playback = null, onPlaybackEnd = () => {}, trails = null, supply = [], consequences = null }: Props) {
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
  const shutRoads = closedRoads(s, ctx, 'fr');
  /** Where the map is drawn small (a phone, the whole theatre), markers are compact and only the main places named. */
  const compact = pixels < 0.6;
  // The playback's loop reads the markers' scale and writes the clock without a render (Playback.tsx).
  const scale = useRef(u);
  scale.current = u;
  const bar = useRef<PlaybackBar>({ clock: null, news: null, rain: null });
  // The camera as you left it, and when you last moved it: playback's focus moments return to it, and stop if you move.
  const camera = useRef(cam);
  camera.current = cam;
  const touched = useRef(0);
  const [follow, setFollow] = useState(loadFollow);
  const following = useRef(follow);
  following.current = follow;
  const view = useMemo<PlaybackView>(() => ({ svg, world: WORLD, camera, touched, following }), []);
  const trailLines = useMemo(() => (trails ? trailsOf(ctx, trails) : []), [ctx, trails]);
  const dust = useMemo(() => new Set(trails ? dustOf(ctx, trails) : []), [ctx, trails]);
  const major = new Set([...ctx.graph.nodes.keys()].filter((id) => s.depots[id] || (ctx.scenario.keyPlaces ?? []).includes(id) || (ctx.scenario.cutOffPlaces ?? []).includes(id)));

  // The wheel zooms when asked to (Ctrl or a trackpad pinch), or once the map has focus; otherwise the page scrolls.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !el.contains(document.activeElement)) return;
      ev.preventDefault();
      touched.current = performance.now();
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
    touched.current = performance.now();
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
            touched.current = performance.now();
            setCam(next);
          }
        }}
      >
        <defs>
          <pattern id="stripped" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1={0} y1={0} x2={0} y2={6} className="stripped-hatch" />
          </pattern>
        </defs>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="map-paper" />
        <TerrainLayer band={band} u={u} view={{ x: cam.x, y: cam.y, width: cam.width, height: heightOf(WORLD, cam) }} />

        {consequences &&
          [...consequences.districts].map(([node, d]) => {
            const { stripping } = strippingOf(ctx, node, d);
            if (stripping === 'untouched') return null;
            const q = POSITION[node] as Point;
            return (
              <circle key={`district-${node}`} className={`district district-${stripping}`} cx={q.x} cy={q.y} r={DISTRICT_RADIUS}>
                <title>{districtText(ctx, node, d, s.resolution.turn)}</title>
              </circle>
            );
          })}

        {[...ctx.graph.edges.values()].map((e) => {
          const a = POSITION[e.a] as Point;
          const b = POSITION[e.b] as Point;
          // During playback the mud is drawn hour by hour by the playback itself.
          const wet = !playback && s.roads[e.id] === 'mud';
          return (
            <g key={e.id}>
              {!playback && dust.has(e.id) && <line className="dust" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
              {wet && <line className="mud-wash" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
              {playback && <line className="mud-wash" data-mud={e.id} style={{ opacity: 0 }} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
              <line className={`road road-${e.road}${wet ? ' road-mud' : ''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {(e.crossing === 'pontoon' || e.crossing === 'ford') && <circle className={`crossing${shutRoads.has(e.id) ? ' crossing-shut' : ''}`} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={6 * u} />}
            </g>
          );
        })}

        {s.pontoons && (
          <g className="pontoon-train" transform={`translate(${trainAt(s.pontoons, ctx).x} ${trainAt(s.pontoons, ctx).y}) scale(${u})`}>
            <title>{pontoonText(s.pontoons, ctx)}</title>
            <path d="M-9 -2 H9 L6 4 H-6 Z" />
          </g>
        )}

        {supply.map((l) => {
          const points = l.path.map((n) => POSITION[n] as Point);
          const short = isShort(l);
          const mid = points[Math.floor((points.length - 1) / 2)] as Point;
          const next = points[Math.floor((points.length - 1) / 2) + 1] ?? mid;
          return (
            <g key={`supply-${l.convoy}`} className={`supply${short ? ' supply-short' : ''}`}>
              <title>{supplyText(l, s, ctx)}</title>
              <polyline points={points.map((q) => `${q.x},${q.y}`).join(' ')} style={{ strokeWidth: Math.min(7, 1.5 + l.perDay / 20_000) }} />
              {short && points.length > 1 && (
                <g transform={`translate(${(mid.x + next.x) / 2} ${(mid.y + next.y) / 2}) scale(${u})`} className="supply-badge">
                  <circle r={6.5} />
                  <text y={3.5} textAnchor="middle">
                    !
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {!playback &&
          trailLines.map((line, i) => <polyline key={`trail-${i}`} className="trail" points={line.map((q) => `${q.x},${q.y}`).join(' ')} />)}

        {preview?.map((path, i) => (
          <polyline key={`preview-${i}`} className="route-preview" points={path.map((n) => `${(POSITION[n] as Point).x},${(POSITION[n] as Point).y}`).join(' ')} />
        ))}

        {!playback &&
          plan.map((p) => {
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

        {consequences &&
          [...consequences.burned.map((b) => ({ node: b.node, kind: 'burned' as const, text: burnedText(ctx, b) })), ...consequences.battles.map((b) => ({ node: b.node, kind: 'battle' as const, text: battleText(ctx, b) }))].map((scar, i, all) => {
            const q = POSITION[scar.node] as Point;
            // Beside the place, away from its label; a second mark at one place sits further out.
            const k = all.slice(0, i).filter((x) => x.node === scar.node).length;
            const dx = (LABEL_LEFT.has(scar.node) ? 1 : -1) * (13 + k * 13);
            return (
              <g key={`scar-${i}`} className={`scar scar-${scar.kind}`} transform={`translate(${q.x} ${q.y}) scale(${u}) translate(${dx} -13)`}>
                <title>{scar.text}</title>
                {scar.kind === 'burned' ? <path d="M 0 5 C -5 5 -6 0 -3 -3 C -3 0 -1 0 -1 -2 C -1 -5 1 -6 2 -7 C 2 -4 6 -2 5 2 C 4.5 4.5 2.5 5 0 5 Z" /> : <path d="M -5 -5 L 5 5 M 5 -5 L -5 5 M -6 -3 L -3 -6 M 6 -3 L 3 -6" />}
              </g>
            );
          })}

        {playback && (
          <PlaybackLayer
            key={playback.key}
            s={s}
            ctx={ctx}
            frames={playback.frames}
            scale={scale}
            bar={bar}
            compact={compact}
            view={view}
            onEnd={onPlaybackEnd}
          />
        )}

        {!playback &&
          Object.keys(s.intel.fr)
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

        {!playback &&
          french.map((f) => {
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
      {/* Rain over the map (V6): it falls while it rains; with reduced motion it is a still hatch. */}
      {playback ? <div key="rain-playback" className="rain-overlay" aria-hidden="true" ref={(el) => void (bar.current.rain = el)} /> : <div key="rain" className={`rain-overlay${s.rainToday ? ' raining' : ''}`} aria-hidden="true" />}
      {playback && (
        <div className="playback-bar" role="group" aria-label="Playback of the turn">
          <span className="playback-clock" ref={(el) => void (bar.current.clock = el)} />
          <span className="playback-news" aria-live="polite" ref={(el) => void (bar.current.news = el)} />
          <button
            type="button"
            aria-pressed={follow}
            onClick={() => {
              setFollow(!follow);
              try {
                localStorage.setItem(FOLLOW_KEY, follow ? 'off' : 'on');
              } catch {
                // Kept for this visit only.
              }
            }}
          >
            Follow events
          </button>
          <button type="button" onClick={onPlaybackEnd}>
            Skip
          </button>
        </div>
      )}
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
        {!playback && s.rainToday && <span className="map-band">Rain</span>}
      </div>
    </div>
  );
}
