import { useState } from 'react';
import type { BattleDecision, Context, GameState, KeyDecision, Placement, SectorIndex, Status } from '../engine';
import { when } from '../engine';
import { mustStand, standingMen } from '../engine/ai';
import { FIELD_TEMPLATES, SECTORS, exitStateFor, placedAllocation, reserveMen, retreatOfSide, sectorsLost } from '../engine/battle';
import { slotIndexOf } from '../engine';
import { condition } from './OrdersPanel';
import { thousands } from './names';

interface Props {
  s: GameState;
  ctx: Context;
  status: Extract<Status, { kind: 'awaitingBattleInput' }>;
  onDecide: (d: BattleDecision) => void;
}

const ORDER_NAMES = { assault: 'Assault', press: 'Press', hold: 'Hold', fallBack: 'Fall back' } as const;

/** Sector battles (§2.10), plain: the field in three sectors and a reserve, and one decision at a time. */
export function BattlePanel({ s, ctx, status, onDecide }: Props) {
  const b = s.battles[status.battleId];
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [reserveTo, setReserveTo] = useState<SectorIndex>(1);
  const [takeCommand, setTakeCommand] = useState(true);
  if (!b) return null;
  const place = ctx.graph.nodes.get(b.node)?.name ?? b.node;
  const sectors = FIELD_TEMPLATES[b.field.template].sectors;
  const ours = b.sides.fr.map((id) => s.forces[id]).filter((f) => f !== undefined);
  const now = slotIndexOf(s.resolution);
  const exit = exitStateFor(s, ctx, b, 'fr');
  const road = retreatOfSide(s, ctx, b, 'fr')?.to ?? null;
  const roadName = road ? (ctx.graph.nodes.get(road)?.name ?? road) : null;
  const reserve = reserveMen(s, b, 'fr', now);
  // Before the deployment is ordered, the field shows the staff's plan with your changes to it (third review).
  const pending = status.step === 'deploy' ? placements : {};
  const changed = Object.values(pending).some((p) => p !== 'staff');
  const allocOf = (id: string) => {
    const where = pending[id];
    const f = s.forces[id];
    return where !== undefined && where !== 'staff' && f ? placedAllocation(f, where) : b.field.alloc[id];
  };
  const reserveCav = b.sides.fr.reduce((n, id) => n + ((b.fightsFrom[id] ?? 0) <= now ? (b.field.alloc[id]?.reserve.cav ?? 0) : 0), 0);
  const guns = (i: SectorIndex) => b.sides.fr.reduce((n, id) => n + (allocOf(id)?.sectors[i].guns ?? 0), 0);
  // Stand holds only when most of the men here are under it (D-045), and only in the marshal's own decisions.
  const stand = standingMen(s, b, 'fr');
  const firm = mustStand(s, ctx, b, 'fr');

  /** Men of one side in a sector, ours exact, theirs as the scouts see them: to the nearest thousand. */
  const menIn = (side: 'fr' | 'ru', i: SectorIndex | 'reserve') =>
    b.sides[side].reduce((n, id) => {
      const a = side === 'fr' ? allocOf(id) : b.field.alloc[id];
      const t = a ? (i === 'reserve' ? a.reserve : a.sectors[i]) : null;
      return n + (t ? t.inf + t.cav : 0);
    }, 0);
  const COUNT = ['no sector is', 'one sector is', 'two sectors are', 'all three sectors are'];
  const lostLine = (side: 'fr' | 'ru') => {
    const n = COUNT[sectorsLost(b, side)] as string;
    const whose = side === 'fr' ? 'their' : 'our';
    if (sectorsLost(b, side) >= 2) return side === 'fr' ? `We have lost the position: ${n} in ${whose} hands.` : `They have lost the position: ${n} in ${whose} hands.`;
    return side === 'fr' ? `We lost the position earlier; now ${n} in ${whose} hands.` : `They lost the position earlier; now ${n} in ${whose} hands.`;
  };
  const seen = (n: number) => (n === 0 ? 'none seen' : `about ${thousands(Math.max(1000, Math.round(n / 1000) * 1000))}`);
  // The five-step track: the marker where the line stands, the ground taken from the middle towards it filled.
  const track = (control: number) => [-2, -1, 0, 1, 2].map((step) => (step === control ? '◆' : (step > 0 && step < control) || (step < 0 && step > control) ? '■' : '·')).join(' ');
  const decide = (decision: BattleDecision) => onDecide(decision);
  const key = (k: KeyDecision) => decide({ kind: 'round', key: k });
  const exitLine =
    exit === 'open'
      ? `The road to ${roadName} is open: a rearguard covers a withdrawal, and our cavalry screens it.`
      : exit === 'contested'
        ? `The road to ${roadName} is contested: breaking off takes a round of falling back under fire, and costs more.`
        : 'No road is open: breaking off now means the army is trapped. It must fight on.';

  return (
    <section className="panel battle" aria-labelledby="battle-title">
      <h2 id="battle-title">Battle at {place}</h2>
      <p className="muted">
        {when(ctx, s.resolution)} · {b.attacker === 'fr' ? 'We are attacking.' : 'We are attacked.'} {status.step === 'round' ? `Round ${status.round}.` : ''} {b.field.delegated ? 'The marshal has command.' : ''}
      </p>

      <p className="muted">Each sector's track runs from their ground on the left to ours on the right; ◆ marks where the line stands.</p>
      <div className="field" role="table" aria-label="The field">
        <div role="row" className="field-row">
          {SECTORS.map((i) => (
            <div role="cell" key={i} className="sector">
              <strong>{sectors[i].name}</strong>
              <span className="track" aria-label={`Control: ${b.field.control[i] > 0 ? 'ours' : b.field.control[i] < 0 ? 'theirs' : 'contested'}, ${b.field.control[i]}`}>
                {track(b.field.control[i])}
              </span>
              <span>
                Ours: {thousands(menIn('fr', i))}, {guns(i)} guns · {ORDER_NAMES[b.field.orders.fr[i]]}
              </span>
              <span>Theirs: {seen(menIn('ru', i))}</span>
            </div>
          ))}
          <div role="cell" className="sector reserve">
            <strong>Reserve</strong>
            <span>Ours: {thousands(menIn('fr', 'reserve'))}</span>
            <span>Theirs: {seen(menIn('ru', 'reserve'))}</span>
          </div>
        </div>
      </div>
      <p className="muted">
        Our cavalry is set to {b.field.cavalryTask.fr === 'pursue' ? 'pursue a beaten enemy' : 'screen our own withdrawal'}.
        {b.field.flank.fr !== null ? ` Coming along two roads, we strike ${sectors[b.field.flank.fr].name} in the flank.` : ''}
        {b.field.flank.ru !== null ? ` The enemy, coming along two roads, strikes ${sectors[b.field.flank.ru].name} in the flank.` : ''}
      </p>
      {(['fr', 'ru'] as const).filter((side) => b.field.positionLost.includes(side)).map((side) => (
        <p key={side} className="warning">
          {lostLine(side)}
        </p>
      ))}
      {stand.standing > 0 && (
        <p className="muted">
          {firm
            ? `Most of our men here are under Stand orders (${thousands(stand.standing)} of ${thousands(stand.men)}): when the marshal decides, he holds on after the position is lost, and breaks off only when the army is close to breaking.`
            : `${thousands(stand.standing)} of our ${thousands(stand.men)} men here are under Stand orders, not most of them: the marshal fights this battle as usual.`}
        </p>
      )}

      <h3>Our corps</h3>
      <ul>
        {ours.map((f) => (
          <li key={f.id}>
            {f.name}: {thousands(f.men)} men ({thousands(f.cavalry)} cavalry), {f.guns} guns, {condition(f)}
            {f.gathering > 0 ? ', still gathering' : ''}, {thousands(f.stock.ammo)} ammunition
            {(b.fightsFrom[f.id] ?? 0) > now ? ', deploying' : ''}
          </li>
        ))}
      </ul>

      {status.step === 'deploy' && (
        <>
          <p>
            The fighting begins with the next light. The staff has deployed the troops as shown; you may send a corps whole into another sector or the reserve.
            {changed ? ' The field above shows your changes; they take effect when you deploy.' : ''}
          </p>
          <div className="form-grid">
            {ours.map((f) => (
              <label key={f.id}>
                {f.name}
                <select value={String(placements[f.id] ?? 'staff')} onChange={(e) => setPlacements({ ...placements, [f.id]: e.target.value === 'staff' || e.target.value === 'reserve' ? e.target.value : (Number(e.target.value) as SectorIndex) })}>
                  <option value="staff">As the staff placed it</option>
                  {SECTORS.map((i) => (
                    <option key={i} value={i}>
                      All to {sectors[i].name}
                    </option>
                  ))}
                  <option value="reserve">All to the reserve</option>
                </select>
              </label>
            ))}
          </div>
          <div className="choices">
            <button type="button" className="primary" onClick={() => decide({ kind: 'deploy', placements })}>
              Deploy and command the battle
            </button>
            <button type="button" onClick={() => decide({ kind: 'deploy', placements, delegateBattle: true })}>
              Deploy and leave the battle to the marshal
            </button>
          </div>
        </>
      )}

      {status.step === 'round' && (
        <>
          <p>{exitLine}</p>
          <div className="choices">
            <button type="button" className="primary" onClick={() => key({ kind: 'continue' })}>
              Continue the plan
            </button>
            <button type="button" onClick={() => key({ kind: 'pressAll' })}>
              Press everywhere
            </button>
            <button type="button" onClick={() => key({ kind: 'holdAll' })}>
              Hold everywhere
            </button>
            <button type="button" onClick={() => key({ kind: 'breakOff' })}>
              {exit === 'blocked' ? 'Break off (trapped)' : 'Break off'}
            </button>
          </div>
          <div className="choices">
            <label className="inline">
              At
              <select aria-label="Sector" value={reserveTo} onChange={(e) => setReserveTo(Number(e.target.value) as SectorIndex)}>
                {SECTORS.map((i) => (
                  <option key={i} value={i}>
                    {sectors[i].name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={reserve === 0} onClick={() => key({ kind: 'commitReserve', sector: reserveTo })}>
              send in the reserve
            </button>
            <button type="button" onClick={() => key({ kind: 'massGuns', sector: reserveTo })}>
              mass the guns
            </button>
            <button type="button" disabled={reserveCav === 0} onClick={() => key({ kind: 'charge', sector: reserveTo })}>
              charge with the reserve cavalry
            </button>
            <button type="button" onClick={() => key({ kind: 'cavalry', task: b.field.cavalryTask.fr === 'pursue' ? 'screen' : 'pursue' })}>
              {b.field.cavalryTask.fr === 'pursue' ? 'Keep the cavalry back to screen' : 'Set the cavalry to pursue'}
            </button>
          </div>
          <div className="choices">
            <button type="button" onClick={() => decide({ kind: 'delegate' })}>
              Let the marshal decide this round
            </button>
            <button type="button" onClick={() => decide({ kind: 'delegate', delegateBattle: true })}>
              Leave the battle to the marshal
            </button>
          </div>
        </>
      )}

      {status.step === 'nightfall' && (
        <>
          <p>Night falls on the field. Stay and fight on at dawn, or slip away in the dark? {exitLine}</p>
          {b.field.delegated && (
            <label className="inline">
              <input type="checkbox" checked={takeCommand} onChange={(e) => setTakeCommand(e.target.checked)} /> Take command of the battle again
            </label>
          )}
          <div className="choices">
            {(['stay', 'withdraw'] as const).map((choice) => (
              <button key={choice} type="button" className={choice === 'stay' ? 'primary' : undefined} onClick={() => decide({ kind: 'nightfall', choice, ...(b.field.delegated && takeCommand ? { delegateBattle: false } : {}) })}>
                {choice === 'stay' ? 'Stay' : 'Withdraw'}
              </button>
            ))}
            <button type="button" onClick={() => decide({ kind: 'delegate', ...(b.field.delegated && takeCommand ? { delegateBattle: false } : {}) })}>
              Let the marshal decide
            </button>
          </div>
        </>
      )}
      <p className="muted">
        Your decisions in this battle: {b.field.decisions} · rounds fought: {b.roundsFought}
      </p>
    </section>
  );
}
