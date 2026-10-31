// Turns engine log entries into dispatches the French command would actually receive. Russian
// intentions, supplies and movements out of contact never appear here (§2.8).

import type { Context, GameState, LogEntry } from '../engine';

export interface Dispatch {
  key: string;
  when: string;
  text: string;
}

const SLOT = ['morning', 'afternoon', 'morning', 'afternoon'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dispatches(entries: readonly LogEntry[], s: GameState, ctx: Context, startDate: string): Dispatch[] {
  const place = (id: unknown) => ctx.graph.nodes.get(String(id))?.name ?? String(id);
  const force = (id: unknown) => s.forces[String(id)]?.name ?? String(id);
  const french = (id: unknown) => s.forces[String(id)]?.side === 'fr';
  const sideName = (side: unknown) => (side === 'fr' ? 'French' : 'Russian');
  const out: Dispatch[] = [];
  entries.forEach((e, i) => {
    const d = e.detail;
    let text: string | null = null;
    switch (e.kind) {
      case 'orders':
        text = 'Orders issued to the army.';
        break;
      case 'rain':
        text = 'Heavy rain: the roads will turn to mud.';
        break;
      case 'arrived':
        if (french(d.force)) text = `${force(d.force)} reached ${place(d.node)}.`;
        break;
      case 'encounter':
        text = `Contact with the enemy at ${place(d.node)}.`;
        break;
      case 'minorAction':
        text = `Skirmish at ${place(d.node)}: the ${sideName(d.retreated)} side fell back${d.to ? ` to ${place(d.to)}` : ''}.`;
        break;
      case 'withdrawal':
        text = `${sideName(d.side)} troops at ${place(d.node)} ${d.success ? 'slipped away before battle' : 'tried to withdraw but were held'}.`;
        break;
      case 'battleJoined':
        text = `Battle joined at ${place(d.node)}.`;
        break;
      case 'round':
        text = `Round ${d.round}: we ${d.fr === 'press' ? 'pressed the attack' : d.fr === 'hold' ? 'held our ground' : 'withdrew'}.`;
        break;
      case 'nightfall':
        text = `Nightfall on the field: we chose to ${d.fr === 'stay' ? 'stay' : 'withdraw'}; the enemy ${d.ru === 'stay' ? 'stayed' : 'withdrew'}.`;
        break;
      case 'battleEnded':
        text = d.winner === 'fr' ? 'The enemy gave way: the field is ours.' : d.winner === 'ru' ? 'Our troops were driven from the field.' : 'The battle ended without a victor.';
        break;
      case 'retreated':
        text = `${force(d.force)} fell back to ${place(d.to)}.`;
        break;
      case 'trapped':
        text = `${force(d.force)} was cut off at ${place(d.node)} and suffered heavily.`;
        break;
      case 'delivered':
        if (french(d.force)) text = `Wagons reached ${force(d.force)}: ${Number(d.food).toLocaleString('en-GB')} rations, ${Number(d.fodder).toLocaleString('en-GB')} fodder, ${Number(d.ammo).toLocaleString('en-GB')} ammunition.`;
        break;
      case 'shortfall':
        if (french(d.force)) text = `${force(d.force)} went hungry: ${Number(d.food).toLocaleString('en-GB')} rations short${Number(d.fodder) > 0 ? `, and ${Number(d.fodder).toLocaleString('en-GB')} horse-rations of fodder` : ''}.`;
        break;
      case 'ended':
        text = 'The campaign has reached its end.';
        break;
      default:
        text = null;
    }
    if (text) {
      const dayIndex = (e.turn - 1) * 2 + (e.slot < 2 ? 0 : 1);
      const date = new Date(Date.parse(`${startDate}T00:00:00Z`) + dayIndex * 86_400_000);
      out.push({ key: `${e.turn}.${e.slot}.${i}`, when: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${SLOT[e.slot]}`, text });
    }
  });
  return out;
}
