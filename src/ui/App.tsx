import { useMemo, useState } from 'react';
import { ENDING_NAMES, advanceWithPlayback, createContext, evaluate, newGame, ordersFrom, planDirective, planLogistics, statusOf, summarizePlan, supplyLines, when } from '../engine';
import type { BattleDecision, Directive, Frame, GameState, GroupOverride, Input, LogEntry, NodeId, Side } from '../engine';
import { vitebskDecision } from '../data/vitebsk/scenario';
import { BattlePanel } from './BattlePanel';
import { Compare } from './Compare';
import { MapList } from './MapList';
import { MapView } from './MapView';
import { OrdersPanel } from './OrdersPanel';
import { dispatches } from './dispatches';
import { shortName, thousands } from './names';
import { lastSeenDistricts, scarsOf } from './consequences';
import { eventful } from './playbackModel';
import { loadRuns, storeRuns, summarize, type SavedRun } from './runs';

const ctx = createContext(vitebskDecision());

interface Run {
  seed: number;
  states: GameState[];
  inputs: Input[];
  logs: LogEntry[][];
}

const startRun = (seed: number): Run => ({ seed, states: [newGame(ctx, seed)], inputs: [], logs: [] });

/** The system asks for reduced motion: the map then shows where each group went without animating it (§3.1). */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOLD: Directive = { objective: null, axis: null, tempo: 'steady', posture: 'dispersed', engagement: 'accept', holdBack: [], logistics: 'hold' };

/** Men, or all horses: saddle, artillery and draught. */
const total = (s: GameState, side: Side, k: 'men' | 'horses') =>
  Object.values(s.forces)
    .filter((f) => f.side === side)
    .reduce((n, f) => n + (k === 'men' ? f.men : f.horses + f.draught), 0);

/** Prototype (M1): the whole Vitebsk Decision on a plain map, with run comparison. */
export function App() {
  const [run, setRun] = useState<Run>(() => startRun(1812));
  const [seedText, setSeedText] = useState('1812');
  const [directive, setDirective] = useState<Directive>(HOLD);
  const [overrides, setOverrides] = useState<Record<string, GroupOverride>>({});
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<SavedRun[]>(loadRuns);
  const [runName, setRunName] = useState('');
  const [view, setView] = useState<'play' | 'compare'>('play');
  const [halt, setHalt] = useState(false);
  const [asList, setAsList] = useState(false);
  /** The ways the route pointed at in the orders panel would send the groups, drawn on the map (M2, G3). */
  const [preview, setPreview] = useState<NodeId[][] | null>(null);
  /** The last input's resolution, hour by hour, when something moved or happened in it (M2, G4); `key` replays it. */
  const [played, setPlayed] = useState<{ frames: Frame[]; key: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  const s = run.states[run.states.length - 1] as GameState;
  const status = statusOf(s);
  // One plan for preview and commit: the player's own orders for a group are planned and forecast with
  // the staff's (§2.4b). Once a halt is declared or about to be, the staff plans for holding where the army stands.
  const effective: Directive = { ...directive, overrides, ...(s.halted || halt ? { objective: null } : {}) };
  const plan = useMemo(() => (status.kind === 'awaitingOrders' ? planDirective(s, ctx, effective) : []), [s, status.kind, effective.objective, directive, overrides]);
  const summary = useMemo(() => (status.kind === 'awaitingOrders' ? summarizePlan(s, ctx, plan) : null), [s, status.kind, plan]);
  const logistics = useMemo(() => (status.kind === 'awaitingOrders' ? planLogistics(s, ctx, effective) : null), [s, status.kind, effective.objective, directive]);
  const outcome = useMemo(() => (status.kind === 'ended' ? evaluate(run.states[0] as GameState, s, ctx) : null), [status.kind, run.states, s]);
  const news = useMemo(() => dispatches(run.logs.flat(), s, ctx, ctx.scenario.startDate).reverse(), [run.logs, s]);
  const supply = useMemo(() => supplyLines(s, ctx), [s]);
  // What the campaign has left on the map, as the French know it (V5).
  const consequences = useMemo(() => ({ districts: lastSeenDistricts(run.states, ctx), ...scarsOf(run.logs.flat(), s) }), [run.states, run.logs, s]);

  function submit(input: Input) {
    const { result, frames } = advanceWithPlayback(s, input, ctx);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    setRun({ ...run, states: [...run.states, result.state], inputs: [...run.inputs, input], logs: [...run.logs, result.log] });
    const show = eventful(frames);
    setPlayed(show ? { frames, key: (played?.key ?? 0) + 1 } : null);
    setPlaying(show && !reducedMotion());
  }

  function commit() {
    if (status.kind !== 'awaitingOrders') return;
    // The orders committed are exactly the orders shown.
    const supplyOrders = logistics?.orders ?? null;
    submit({ kind: 'orders', turn: status.turn, orders: ordersFrom(plan), ...(halt ? { halt: true } : {}), ...(supplyOrders ? { logistics: supplyOrders } : {}) });
    setOverrides({});
    setHalt(false);
    setPreview(null);
  }

  function replay() {
    if (!played) return;
    setPlayed({ ...played, key: played.key + 1 });
    setPlaying(true);
  }

  /** A place picked on the map or in the list becomes the objective, while orders are being given. */
  function pick(place: string) {
    if (status.kind === 'awaitingOrders') setDirective({ ...directive, objective: place, axis: null });
  }

  function decide(decision: BattleDecision) {
    if (status.kind !== 'awaitingBattleInput') return;
    submit({ kind: 'battle', battleId: status.battleId, round: status.round, decision });
  }

  /** Back to the orders of the previous turn: replaying is exact, so nothing else is needed. */
  function undo() {
    for (let i = run.states.length - 2; i >= 0; i--) {
      if (statusOf(run.states[i] as GameState).kind === 'awaitingOrders') {
        setRun({ ...run, states: run.states.slice(0, i + 1), inputs: run.inputs.slice(0, i), logs: run.logs.slice(0, i) });
        setPlayed(null);
        setPlaying(false);
        return;
      }
    }
  }

  function restart() {
    const seed = Number.parseInt(seedText, 10);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      setError('The seed must be a whole number between 0 and 4294967295.');
      return;
    }
    setRun(startRun(seed));
    setPlayed(null);
    setPlaying(false);
    setDirective(HOLD);
    setOverrides({});
    setHalt(false);
    setError(null);
  }

  function save() {
    const label = runName.trim() || `Run ${runs.length + 1}`;
    const next = [...runs, summarize(run.states, run.logs, ctx, label, run.seed)];
    setRuns(next);
    storeRuns(next);
    setRunName('');
  }

  function remove(id: string) {
    const next = runs.filter((r) => r.id !== id);
    setRuns(next);
    storeRuns(next);
  }

  const frMen = total(s, 'fr', 'men');
  const french = Object.values(s.forces).filter((f) => f.side === 'fr' && f.men > 0);
  const food = french.reduce((n, f) => n + f.stock.food, 0);
  // The army's average can hide a starving group: name the worst-fed one too.
  const hungriest = french.reduce<(typeof french)[number] | null>((w, f) => (w === null || f.stock.food / f.men < w.stock.food / w.men ? f : w), null);
  const start = run.states[0] as GameState;

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          The Weight of Empire <span>The Vitebsk Decision · prototype</span>
        </h1>
        <p className="status" aria-live="polite">
          {when(ctx, s.resolution)} · {s.resolution.turn > ctx.scenario.turns ? 'the last battle' : `turn ${s.resolution.turn} of ${ctx.scenario.turns}`} · {s.rainToday ? 'rain' : 'dry'} · {thousands(frMen)} men · {thousands(total(s, 'fr', 'horses'))} horses · {(food / Math.max(1, frMen)).toFixed(1)} days' food in hand{hungriest ? ` (least: ${shortName(hungriest.id, hungriest.name)}, ${(hungriest.stock.food / hungriest.men).toFixed(1)})` : ''}
        </p>
        <div className="controls">
          <label>
            Seed <input value={seedText} onChange={(e) => setSeedText(e.target.value)} inputMode="numeric" size={10} />
          </label>
          <button type="button" onClick={restart}>
            New game
          </button>
          <button type="button" onClick={undo} disabled={run.inputs.length === 0}>
            Undo last turn
          </button>
          <label>
            Run name <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder={`Run ${runs.length + 1}`} size={14} />
          </label>
          <button type="button" onClick={save}>
            Save for comparison
          </button>
          <button type="button" onClick={() => setView(view === 'play' ? 'compare' : 'play')}>
            {view === 'play' ? `Compare runs (${runs.length})` : 'Back to the campaign'}
          </button>
        </div>
      </header>

      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}

      {view === 'compare' ? (
        <Compare runs={runs} onDelete={remove} onClose={() => setView('play')} />
      ) : (
        <main className="layout">
          <div className="map-wrap">
            {asList ? (
              <MapList s={s} ctx={ctx} objective={directive.objective} onPick={pick} supply={supply} consequences={consequences} />
            ) : (
              <MapView
                s={s}
                ctx={ctx}
                plan={plan}
                preview={status.kind === 'awaitingOrders' ? preview : null}
                objective={directive.objective}
                onPick={pick}
                playback={playing ? played : null}
                onPlaybackEnd={() => setPlaying(false)}
                trails={played?.frames ?? null}
                supply={supply}
                consequences={consequences}
              />
            )}
            <p className="legend">
              Blue: our groups; the sign shows whether a group is marching, in battle, dispersed to feed or concentrated, and a dashed one is worn. Green: enemy reports, fading with age; after two turns a pale "last seen" marker. Dashed lines: the staff's planned routes; thin solid lines: where each group went last. Brown lines: supply lines from a depot to the group or depot its wagons serve, wider for more a day; red and dashed with "!" where a train brings less than its group eats. Hatched rings: districts foragers have taken from, darker as less is left, as last seen. A flame: stores burned when a depot changed hands; crossed sabres: a battlefield. A pale wash: dust where columns marched on dry roads; a brown wash: mud. Blue hatching over the map: rain. Squares: depots. Circles on roads: river crossings.{s.pontoons ? ' An open circle: a river still to be bridged. A small boat: the pontoon train.' : ''} Click a place to make it the objective. Drag to pan; pinch, Ctrl + scroll or the buttons to zoom. The terrain is real: rivers from Natural Earth, relief from SRTM data courtesy of the U.S. Geological Survey. Each turn is played back on the map, the camera moving in on contacts and battles unless you turn off "Follow events" (Skip or Escape to end it).{' '}
              {played && !playing && !asList && (
                <>
                  <button type="button" className="link" onClick={replay}>
                    Play the last turn again
                  </button>
                  {' · '}
                </>
              )}
              <button type="button" className="link" onClick={() => setAsList(!asList)}>
                {asList ? 'Show the map' : 'Show the map as a list'}
              </button>
            </p>
          </div>
          <aside>
            {status.kind === 'awaitingOrders' && (
              <OrdersPanel
                s={s}
                ctx={ctx}
                directive={directive}
                onDirective={setDirective}
                plan={plan}
                summary={summary}
                supply={logistics}
                overrides={overrides}
                onOverride={(force, change) =>
                  setOverrides((cur) => {
                    const next = { ...cur };
                    if (change) next[force] = change;
                    else delete next[force];
                    return next;
                  })
                }
                halt={halt}
                onHalt={setHalt}
                onCommit={commit}
                onPreview={setPreview}
              />
            )}
            {status.kind === 'awaitingBattleInput' && <BattlePanel s={s} ctx={ctx} status={status} onDecide={decide} />}
            {status.kind === 'ended' && outcome && (
              <section className="panel" aria-labelledby="end-title">
                <h2 id="end-title">{ENDING_NAMES[outcome.ending]}</h2>
                <ul className="reasons">
                  {outcome.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p>
                  All Russian forces, now revealed: {thousands(total(start, 'ru', 'men'))} men at the start, {thousands(total(s, 'ru', 'men'))} at the end, reinforcements included. The verdict counts the main armies alone.
                </p>
                <p className="muted">A provisional verdict: the thresholds (§2.13, G-004) are still being tested. The full after-action report comes later. Save this run to compare it with another strategy on the same seed.</p>
              </section>
            )}
          </aside>
        </main>
      )}

      <section className="dispatches" aria-labelledby="dispatch-title">
        <h2 id="dispatch-title">Dispatches</h2>
        {news.length === 0 ? (
          <p className="muted">No reports yet.</p>
        ) : (
          <ol>
            {news.slice(0, 40).map((d) => (
              <li key={d.key}>
                <span className="when">{d.when}</span> {d.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
