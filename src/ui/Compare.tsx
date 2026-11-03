import { useState } from 'react';
import { ENDING_NAMES, RUSSIAN_RESULT_NAMES, lossPermille, percent } from '../engine';
import { thousands } from './names';
import type { RunVerdict, SavedRun } from './runs';

interface Props {
  runs: readonly SavedRun[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

const TESTS: Record<NonNullable<RunVerdict['firstFailing']>, string> = {
  capable: 'too weakened for further operations',
  sustainable: 'its supply not sustainable',
  secure: 'not secure',
};

/** Two saved runs side by side, turn by turn (M1: compare two strategies on the same seed). */
export function Compare({ runs, onDelete, onClose }: Props) {
  const [ids, setIds] = useState<[string, string]>([runs.at(-2)?.id ?? '', runs.at(-1)?.id ?? '']);
  const a = runs.find((r) => r.id === ids[0]);
  const b = runs.find((r) => r.id === ids[1]);
  // One row per moment either run recorded, in order, so the two runs are read at the same date.
  const rows = [...(a?.series ?? []), ...(b?.series ?? [])]
    .map((p, i) => ({ date: p.date, at: p.turn * 2 + (p.date === 'End of campaign' ? 1 : 0), i }))
    .sort((x, y) => x.at - y.at || x.i - y.i)
    .map((x) => x.date)
    .filter((date, k, all) => all.indexOf(date) === k);
  const pick = (i: 0 | 1, id: string) => setIds((cur) => (i === 0 ? [id, cur[1]] : [cur[0], id]));
  // Losses as the verdict counts them, with its rounding: the French of the whole army, the Russians of their main
  // armies; for an unfinished run, the French so far by the same rule, the Russians hidden (third review).
  const lost = (r: SavedRun | undefined, k: 'frMen' | 'frHorses') => {
    if (!r || r.series.length === 0) return '—';
    if (r.verdict) return percent(k === 'frMen' ? r.verdict.frenchMenLostPermille : r.verdict.frenchHorsesLostPermille);
    return percent(lossPermille(r.series[0]![k], r.series.at(-1)![k]));
  };
  const russiansLost = (r: SavedRun | undefined) => (!r ? '' : r.verdict ? `main armies ${percent(r.verdict.russianMainLostPermille)}` : r.ended ? '—' : 'hidden');
  // Hidden Russian information stays hidden until a run's campaign has ended, even in summaries saved earlier (§2.8).
  const russians = (r: SavedRun, men: number | null) => (r.ended && men !== null ? thousands(men) : 'hidden');
  const HIDDEN = 'Revealed when this campaign ends.';

  return (
    <section className="panel compare" aria-labelledby="compare-title">
      <div className="panel-head">
        <h2 id="compare-title">Compare two runs</h2>
        <button type="button" onClick={onClose}>
          Back to the campaign
        </button>
      </div>
      {runs.length < 2 ? (
        <p>Save at least two runs to compare them. Play one strategy, save it, start the same seed again, and play another.</p>
      ) : (
        <>
          <div className="form-grid">
            {([0, 1] as const).map((i) => (
              <label key={i}>
                Run {i === 0 ? 'A' : 'B'}
                <select value={ids[i]} onChange={(e) => pick(i, e.target.value)}>
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} (seed {r.seed}, rules {r.rules}){r.ended ? '' : ', unfinished'}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {a && b && a.seed !== b.seed && <p className="warning">These runs use different seeds, so their weather, strengths and Russian temperament differ.</p>}
          <div className="table-scroll">
            <table>
              <caption>French figures each turn; the Russians, all forces, are revealed only for finished campaigns</caption>
              <thead>
                <tr>
                  <th scope="col">Turn</th>
                  <th scope="col">A: men</th>
                  <th scope="col">A: horses</th>
                  <th scope="col">A: food days</th>
                  <th scope="col">A: Russians, all forces</th>
                  <th scope="col">B: men</th>
                  <th scope="col">B: horses</th>
                  <th scope="col">B: food days</th>
                  <th scope="col">B: Russians, all forces</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((date) => {
                  const pa = a?.series.find((p) => p.date === date);
                  const pb = b?.series.find((p) => p.date === date);
                  return (
                    <tr key={date}>
                      <th scope="row">{date}</th>
                      <td>{pa ? thousands(pa.frMen) : ''}</td>
                      <td>{pa ? thousands(pa.frHorses) : ''}</td>
                      <td>{pa?.frFoodDays ?? ''}</td>
                      <td>{a && pa ? russians(a, pa.ruMen) : ''}</td>
                      <td>{pb ? thousands(pb.frMen) : ''}</td>
                      <td>{pb ? thousands(pb.frHorses) : ''}</td>
                      <td>{pb?.frFoodDays ?? ''}</td>
                      <td>{b && pb ? russians(b, pb.ruMen) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Lost since the start</th>
                  <td>{lost(a, 'frMen')}</td>
                  <td>{lost(a, 'frHorses')}</td>
                  <td />
                  <td>{russiansLost(a)}</td>
                  <td>{lost(b, 'frMen')}</td>
                  <td>{lost(b, 'frHorses')}</td>
                  <td />
                  <td>{russiansLost(b)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="sides">
            {[a, b].map((r, i) =>
              r ? (
                <div key={r.id}>
                  <h3>
                    {i === 0 ? 'A' : 'B'}: {r.label}
                  </h3>
                  <Verdict run={r} />
                  <p>
                    <strong>Battles:</strong> {r.battles.length ? r.battles.join('; ') : 'none'}
                  </p>
                  {r.battleRounds !== undefined && (
                    <p>
                      <strong>In battle:</strong> {r.battleDecisions ?? 0} decisions of yours, {r.battleRounds} rounds fought
                    </p>
                  )}
                  <p>
                    <strong>What the Russian command intended:</strong> {r.ended && r.russianPlans ? r.russianPlans.join('; ') : HIDDEN}
                  </p>
                  <p>
                    <strong>Where everyone ended:</strong> {r.ended && r.finalPositions ? r.finalPositions.join('; ') : HIDDEN}
                  </p>
                  <button type="button" onClick={() => onDelete(r.id)}>
                    Delete this run
                  </button>
                </div>
              ) : null,
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** The verdict of a finished run, as the end of its campaign gave it: the ending, three facts behind it, and the reasons. */
function Verdict({ run }: { run: SavedRun }) {
  const v = run.verdict;
  if (!v) {
    return (
      <p>
        <strong>Verdict:</strong> {run.ended ? 'not recorded in this save (made before rules 0.18.0).' : 'none yet: the campaign is unfinished.'}
      </p>
    );
  }
  return (
    <>
      <p>
        <strong>Verdict: {ENDING_NAMES[v.ending]}.</strong> Objective ground {v.holdsKeyGround ? 'held' : 'not held'}; the Russian main armies {RUSSIAN_RESULT_NAMES[v.russian]}; the army: {v.firstFailing ? TESTS[v.firstFailing] : 'fit, supplied and secure'}.
      </p>
      <details>
        <summary>Why</summary>
        <ul className="reasons">
          {v.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </details>
    </>
  );
}
