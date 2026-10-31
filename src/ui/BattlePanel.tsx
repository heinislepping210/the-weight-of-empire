import type { BattleDecision, Context, GameState, Status } from '../engine';
import { when } from '../engine';
import { condition } from './OrdersPanel';
import { thousands } from './names';

interface Props {
  s: GameState;
  ctx: Context;
  status: Extract<Status, { kind: 'awaitingBattleInput' }>;
  onDecide: (d: BattleDecision) => void;
}

/** Prototype battle panel: the placeholder round model until the sector battles of §2.10. */
export function BattlePanel({ s, ctx, status, onDecide }: Props) {
  const b = s.battles[status.battleId];
  if (!b) return null;
  const place = ctx.graph.nodes.get(b.node)?.name ?? b.node;
  const side = (ids: string[]) => ids.map((id) => s.forces[id]).filter((f) => f !== undefined);
  const ours = side(b.sides.fr);
  const theirs = side(b.sides.ru);

  return (
    <section className="panel battle" aria-labelledby="battle-title">
      <h2 id="battle-title">Battle at {place}</h2>
      <p className="muted">
        {when(ctx, s.resolution)} · {b.attacker === 'fr' ? 'We are attacking.' : 'We are attacked.'} {status.step === 'round' ? `Round ${status.round}.` : ''}
      </p>
      <div className="sides">
        <div>
          <h3>Our forces</h3>
          <ul>
            {ours.map((f) => (
              <li key={f.id}>
                {f.name}: {thousands(f.men)} men, {condition(f)}
                {f.gathering > 0 ? ', still gathering' : ''}, {thousands(f.stock.ammo)} ammunition
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>The enemy</h3>
          <ul>
            {theirs.map((f) => (
              <li key={f.id}>
                {f.name}: about {thousands(Math.round(f.men / 1000) * 1000)} men
              </li>
            ))}
          </ul>
        </div>
      </div>
      {status.step === 'deploy' && (
        <>
          <p>The enemy is in contact. The fighting will begin with the next light; the staff deploys the troops.</p>
          <button type="button" className="primary" onClick={() => onDecide({ kind: 'deploy' })}>
            Deploy for battle
          </button>
        </>
      )}
      {status.step === 'round' && (
        <div className="choices">
          <button type="button" onClick={() => onDecide({ kind: 'round', action: 'press' })}>
            Press the attack
          </button>
          <button type="button" onClick={() => onDecide({ kind: 'round', action: 'hold' })}>
            Hold our ground
          </button>
          <button type="button" onClick={() => onDecide({ kind: 'round', action: 'withdraw' })}>
            Withdraw
          </button>
          <button type="button" onClick={() => onDecide({ kind: 'delegate' })}>
            Let the marshal decide
          </button>
        </div>
      )}
      {status.step === 'nightfall' && (
        <>
          <p>Night falls on the field. Stay and fight on at dawn, or withdraw in the dark?</p>
          <div className="choices">
            <button type="button" onClick={() => onDecide({ kind: 'nightfall', choice: 'stay' })}>
              Stay
            </button>
            <button type="button" onClick={() => onDecide({ kind: 'nightfall', choice: 'withdraw' })}>
              Withdraw
            </button>
            <button type="button" onClick={() => onDecide({ kind: 'delegate' })}>
              Let the marshal decide
            </button>
          </div>
        </>
      )}
    </section>
  );
}
