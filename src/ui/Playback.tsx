import { useEffect, useMemo, useRef } from 'react';
import type { Context, Frame, GameState } from '../engine';
import { blend, viewBoxOf, zoomOf, zoomTo, type Camera, type World } from '../map/camera';
import { shortName, thousands } from './names';
import { TAIL_MS, clockOf, eventText, focusWeight, focusesOf, newsworthy, sample, timesOf, tracksOf } from './playbackModel';
import { POSITION, type Point } from './projection';

/** What the loop writes to outside the map's drawing: the clock and the latest event, and the rain over the map. */
export interface PlaybackBar {
  clock: HTMLElement | null;
  news: HTMLElement | null;
  rain: HTMLElement | null;
}

/**
 * The map's view, for the camera's focus moments (V7): the loop moves the view box itself and gives it back as you
 * left it; once you move the map yourself, it stops focusing.
 */
export interface PlaybackView {
  svg: { current: SVGSVGElement | null };
  world: World;
  camera: { current: Camera };
  /** When you last moved the map, by `performance.now()`. */
  touched: { current: number };
  following: { current: boolean };
}

interface Props {
  s: GameState;
  ctx: Context;
  frames: readonly Frame[];
  /** The markers' scale, from the map's zoom: read every frame, so zooming during playback keeps their size. */
  scale: { current: number };
  bar: { current: PlaybackBar };
  /** A map drawn small: markers show only their strength, as on the map. */
  compact: boolean;
  view: PlaybackView;
  onEnd: () => void;
}

/** How long an event's ring takes to spread and fade, in milliseconds. */
const PULSE_MS = 900;

/**
 * The turn played back on the map (M2, G4, V4): one animation loop moves every marker along its road, hour by
 * hour, through the elements themselves, with no React render per frame (§3.1). Groups and enemies are drawn as
 * on the map; a wagon train is a short row of carts, one for every 60 wagons, up to five. Rain and mud follow the
 * day's weather (V6), and the camera can move in on the moments that matter and back (V7).
 */
export function PlaybackLayer({ s, ctx, frames, scale, bar, compact, view, onEnd }: Props) {
  const tracks = useMemo(() => tracksOf(ctx, frames), [ctx, frames]);
  const times = useMemo(() => timesOf(frames), [frames]);
  const pulses = useMemo(() => frames.flatMap((f, i) => f.events.filter(newsworthy).map((e) => ({ at: POSITION[e.node] as Point, from: times[i] as number }))), [frames, times]);
  const focuses = useMemo(() => focusesOf(frames, times), [frames, times]);
  const marks = useRef(new Map<string, SVGGElement>());
  const rings = useRef<(SVGCircleElement | null)[]>([]);
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    let raf = 0;
    let shown = -1;
    let focused = false;
    const start = performance.now();
    const last = times.length - 1;
    const stop = Math.max((times[last] as number) + TAIL_MS, focuses[focuses.length - 1]?.end ?? 0);
    // The roads' mud during playback, drawn by MapView and shown here day by day.
    const mud = [...(view.svg.current?.querySelectorAll<SVGLineElement>('[data-mud]') ?? [])];
    const restore = () => {
      if (focused) view.svg.current?.setAttribute('viewBox', viewBoxOf(view.world, view.camera.current));
      focused = false;
    };
    const tick = (now: number) => {
      const t = now - start;
      let i = 0;
      while (i < last && (times[i + 1] as number) <= t) i++;
      const next = Math.min(i + 1, last);
      const f = next === i ? 1 : Math.min(1, Math.max(0, (t - (times[i] as number)) / ((times[next] as number) - (times[i] as number))));
      const u = scale.current;
      for (const track of tracks) {
        const el = marks.current.get(track.id);
        if (!el) continue;
        const a = track.points[i];
        const b = track.points[next];
        let p: Point | null = null;
        let opacity = 1;
        if (a && b) p = sample(track.paths[next] ?? [a, b], f);
        else if (b) [p, opacity] = [b, f];
        else if (a) [p, opacity] = [a, 1 - f];
        if (!p) {
          el.style.opacity = '0';
          continue;
        }
        const row = (track.rows[i] as number) + ((track.rows[next] as number) - (track.rows[i] as number)) * f;
        el.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${u})`);
        (el.firstElementChild as SVGGElement | null)?.setAttribute('transform', `translate(0 ${row})`);
        el.style.opacity = String(opacity);
      }
      pulses.forEach((pulse, k) => {
        const ring = rings.current[k];
        if (!ring) return;
        const age = (t - pulse.from) / PULSE_MS;
        const on = age >= 0 && age <= 1;
        ring.style.opacity = on ? String(1 - age) : '0';
        if (on) ring.setAttribute('r', String((6 + 22 * age) * u));
      });
      // Moving in on a moment that matters, unless you turned it off or moved the map yourself.
      const focus = view.following.current && view.touched.current < start ? focuses.find((x) => t >= x.start && t < x.end) : undefined;
      if (focus && view.svg.current) {
        const user = view.camera.current;
        const target = zoomTo(view.world, user, Math.max(2.5, zoomOf(view.world, user) * 1.5), focus.at.x, focus.at.y);
        view.svg.current.setAttribute('viewBox', viewBoxOf(view.world, blend(user, target, focusWeight(t, focus))));
        focused = true;
      } else restore();
      if (i !== shown) {
        shown = i;
        const frame = frames[i] as Frame;
        if (bar.current.clock) bar.current.clock.textContent = `${clockOf(ctx, frame)}${frame.rain ? ' · rain' : ''}`;
        bar.current.rain?.classList.toggle('raining', frame.rain);
        const wet = new Set(frame.mud);
        // Shown at the stylesheet's own wash; hidden while the road is dry.
        for (const line of mud) line.style.opacity = wet.has(line.dataset.mud ?? '') ? '' : '0';
        const news = frame.events.filter(newsworthy).pop();
        if (news && bar.current.news) bar.current.news.textContent = eventText(news, s, ctx);
      }
      if (t >= stop) {
        restore();
        end.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && end.current();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      restore();
    };
  }, [tracks, times, pulses, focuses, frames, s, ctx, scale, bar, view]);

  return (
    <g className="playback" aria-hidden="true">
      {pulses.map((pulse, k) => (
        <circle
          key={`pulse-${k}`}
          ref={(el) => {
            rings.current[k] = el;
          }}
          className="pulse"
          cx={pulse.at.x}
          cy={pulse.at.y}
          r={0}
          style={{ opacity: 0 }}
        />
      ))}
      {tracks.map((track) => {
        const f = s.forces[track.id];
        const name = shortName(track.id, f?.name ?? track.id);
        const amount = `${track.kind === 'enemy' ? '~' : ''}${thousands(track.strength)}`;
        const text = track.kind === 'train' ? '' : compact ? amount : `${name} ${amount}`;
        const w = 12 + text.length * 5.6;
        const carts = Math.min(5, Math.max(1, Math.round(track.strength / 60)));
        return (
          <g
            key={track.id}
            ref={(el) => {
              if (el) marks.current.set(track.id, el);
              else marks.current.delete(track.id);
            }}
            className={track.kind === 'train' ? 'train' : track.kind === 'enemy' ? 'enemy' : 'friend friend-marching'}
            style={{ opacity: 0 }}
          >
            <g>
              {track.kind === 'train' ? (
                Array.from({ length: carts }, (_, k) => <rect key={k} x={-carts * 3.5 + k * 7} y={-2.5} width={5.5} height={5} rx={1} />)
              ) : (
                <>
                  <rect x={-w / 2} y={0} width={w} height={14} rx={2} />
                  <text x={0} y={10.5} textAnchor="middle">
                    {text}
                  </text>
                </>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
