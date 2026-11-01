import { useState } from 'react';
import { thousands } from './names';
import type { SavedRun } from './runs';

interface Props {
  runs: readonly SavedRun[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Two saved runs side by side, turn by turn (M1: compare two strategies on the same seed). */
export function Compare({ runs, onDelete, onClose }: Props) {
  const [ids, setIds] = useState<[string, string]>([runs.at(-2)?.id ?? '', runs.at(-1)?.id ?? '']);
  const a = runs.find((r) => r.id === ids[0]);
  const b = runs.find((r) => r.id === ids[1]);
  const turns = Math.max(a?.series.length ?? 0, b?.series.length ?? 0);
  const pick = (i: 0 | 1, id: string) => setIds((cur) => (i === 0 ? [id, cur[1]] : [cur[0], id]));
  const lost = (r: SavedRun | undefined, k: 'frMen' | 'frHorses' | 'ruMen') => {
    if (!r || r.series.length === 0 || (k === 'ruMen' && !r.ended)) return '—';
    const first = r.series[0]![k];
    const last = r.series.at(-1)![k];
    if (first === null || last === null) return '—';
    return `${(((first - last) / first) * 100).toFixed(1)}%`;
  };
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
          <table>
            <caption>French figures each turn; Russian figures are revealed only for finished campaigns</caption>
            <thead>
              <tr>
                <th scope="col">Turn</th>
                <th scope="col">A: men</th>
                <th scope="col">A: horses</th>
                <th scope="col">A: food days</th>
                <th scope="col">A: Russians</th>
                <th scope="col">B: men</th>
                <th scope="col">B: horses</th>
                <th scope="col">B: food days</th>
                <th scope="col">B: Russians</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: turns }, (_, t) => {
                const pa = a?.series[t];
                const pb = b?.series[t];
                return (
                  <tr key={t}>
                    <th scope="row">{pa?.date ?? pb?.date}</th>
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
                <th scope="row">Lost</th>
                <td>{lost(a, 'frMen')}</td>
                <td>{lost(a, 'frHorses')}</td>
                <td />
                <td>{lost(a, 'ruMen')}</td>
                <td>{lost(b, 'frMen')}</td>
                <td>{lost(b, 'frHorses')}</td>
                <td />
                <td>{lost(b, 'ruMen')}</td>
              </tr>
            </tfoot>
          </table>
          <div className="sides">
            {[a, b].map((r, i) =>
              r ? (
                <div key={r.id}>
                  <h3>
                    {i === 0 ? 'A' : 'B'}: {r.label}
                  </h3>
                  <p>
                    <strong>Battles:</strong> {r.battles.length ? r.battles.join('; ') : 'none'}
                  </p>
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
