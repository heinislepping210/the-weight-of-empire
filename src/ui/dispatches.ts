// Turns engine log entries into dispatches the French command would actually receive. Russian
// intentions, supplies and movements out of contact never appear here (§2.8).

import type { Context, GameState, LogEntry } from '../engine';
import { FIELD_TEMPLATES } from '../engine/battle';

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
  const sector = (battle: unknown, i: unknown) => FIELD_TEMPLATES[s.battles[String(battle)]?.field.template ?? 'open'].sectors[Number(i)]?.name ?? `sector ${Number(i) + 1}`;
  // The French decision of a round, in words; the Russian one stays hidden (§2.8).
  const decision = (battle: unknown, label: unknown) => {
    const [kind, at] = String(label).split(':');
    switch (kind) {
      case 'commitReserve':
        return `sent the reserve to ${sector(battle, at)}`;
      case 'massGuns':
        return `massed the guns at ${sector(battle, at)}`;
      case 'charge':
        return `charged with the cavalry at ${sector(battle, at)}`;
      case 'cavalry':
        return at === 'screen' ? 'kept the cavalry back to screen' : 'set the cavalry to pursue';
      case 'pressAll':
        return 'pressed everywhere';
      case 'holdAll':
        return 'held everywhere';
      case 'breakOff':
        return 'broke off the fight';
      default:
        return 'kept to the plan';
    }
  };
  const about = (n: unknown) => (Number(n) < 100 ? 'few' : `about ${(Math.round(Number(n) / 100) * 100).toLocaleString('en-GB')}`);
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
        text = `Skirmish at ${place(d.node)}: the ${sideName(d.retreated)} side fell back${d.to ? ` towards ${place(d.to)}` : ''}.`;
        break;
      case 'withdrawal':
        text = `${sideName(d.side)} troops at ${place(d.node)} ${d.success ? `slipped away before battle, falling back towards ${place(d.to)}` : 'tried to withdraw but were held'}.`;
        break;
      case 'reinforced':
        text = french(d.force) ? `${force(d.force)} joined the battle; it fights from the next sub-step.` : `Enemy reinforcements joined the battle at ${place(s.battles[String(d.battle)]?.node)}.`;
        break;
      case 'battleJoined':
        text = `Battle joined at ${place(d.node)}.`;
        break;
      case 'round':
        text = `Round ${d.round}: ${d.frBy === 'marshal' ? 'the marshal' : 'we'} ${decision(d.battle, d.fr)}.`;
        break;
      case 'sectors':
        text = `The fighting cost us ${Number(d.frLost).toLocaleString('en-GB')} men, the enemy ${about(d.ruLost)}.`;
        break;
      case 'sectorLost':
        text = d.side === 'fr' ? `We lost ${sector(d.battle, d.sector)}.` : `We took ${sector(d.battle, d.sector)}.`;
        break;
      case 'positionLost':
        text = d.side === 'fr' ? 'Our position is lost: two sectors are in enemy hands.' : 'The enemy has lost the position: two sectors are ours.';
        break;
      case 'fieldResult': {
        const how = d.result === 'withdrew' ? 'withdrew in order' : d.result === 'routed' ? 'broke and fled' : 'was trapped with no road out';
        text = d.side === 'fr' ? `Our army ${how}.` : `The enemy ${how}.`;
        break;
      }
      case 'pursuit':
        if (Number(d.men) > 0) text = d.by === 'fr' ? `Our cavalry pursued: the enemy lost ${about(d.men)} more.` : `Their cavalry pursued us: we lost ${Number(d.men).toLocaleString('en-GB')} more.`;
        break;
      case 'nightfall':
        text = `Nightfall on the field: we chose to ${d.fr === 'stay' ? 'stay' : 'withdraw'}; the enemy ${d.ru === 'stay' ? 'stayed' : 'withdrew'}.`;
        break;
      case 'battleEnded':
        text = d.winner === 'fr' ? 'The enemy gave way: the field is ours.' : d.winner === 'ru' ? 'Our troops were driven from the field.' : 'The battle ended without a victor.';
        break;
      case 'retreated':
        text = `${force(d.force)} is falling back towards ${place(d.to)}.`;
        break;
      case 'trapped':
        text = `${force(d.force)} was cut off at ${place(d.node)} and suffered heavily.`;
        break;
      case 'delivered':
        if (french(d.force)) text = `Wagons reached ${force(d.force)}: ${Number(d.food).toLocaleString('en-GB')} rations, ${Number(d.fodder).toLocaleString('en-GB')} fodder, ${Number(d.ammo).toLocaleString('en-GB')} ammunition.`;
        else if (d.depot !== null && s.convoys[String(d.convoy)]?.side === 'fr') text = `A line train stocked the depot at ${place(d.depot)}: ${Number(d.food).toLocaleString('en-GB')} rations, ${Number(d.fodder).toLocaleString('en-GB')} fodder, ${Number(d.ammo).toLocaleString('en-GB')} ammunition.`;
        break;
      case 'leftBehind': {
        if (!french(d.force)) break;
        const parts = [
          Number(d.food) > 0 ? `${Number(d.food).toLocaleString('en-GB')} rations` : '',
          Number(d.fodder) > 0 ? `${Number(d.fodder).toLocaleString('en-GB')} horse-rations of fodder` : '',
          Number(d.ammo) > 0 ? `${Number(d.ammo).toLocaleString('en-GB')} ammunition` : '',
        ].filter(Boolean);
        text = `${force(d.force)} could not carry all its stores: it left ${parts.join(', ')} ${d.depot ? `in the depot at ${place(d.depot)}` : 'by the road'}.`;
        break;
      }
      case 'convoyLeftBehind': {
        if (s.convoys[String(d.convoy)]?.side !== 'fr') break;
        const parts = [
          Number(d.food) > 0 ? `${Number(d.food).toLocaleString('en-GB')} rations` : '',
          Number(d.fodder) > 0 ? `${Number(d.fodder).toLocaleString('en-GB')} horse-rations of fodder` : '',
          Number(d.ammo) > 0 ? `${Number(d.ammo).toLocaleString('en-GB')} ammunition` : '',
        ].filter(Boolean);
        text = `A wagon train had too few horses to draw its load: it left ${parts.join(', ')} ${d.depot ? `in the depot at ${place(d.depot)}` : 'by the road'}.`;
        break;
      }
      case 'convoyShortfall':
        if (s.convoys[String(d.convoy)]?.side === 'fr' && Number(d.horsesDied) > 0) text = `A wagon train lost ${Number(d.horsesDied).toLocaleString('en-GB')} draught horses for want of fodder.`;
        break;
      case 'cutOff':
        text = 'The Russian line of retreat is cut: our troops have held the road long enough.';
        break;
      case 'depotFounded':
        text = `A depot was founded at ${place(d.node)}.`;
        break;
      case 'depotCaptured':
        // Both sides learn of a depot changing hands: it is where their own troops stand or stood.
        text =
          d.by === 'fr'
            ? `We took the enemy stores at ${place(d.node)}: about ${Math.round(Number(d.burnedPermille) / 10)}% had been burned, ${Number(d.food).toLocaleString('en-GB')} rations saved.`
            : `The enemy took our depot at ${place(d.node)}: about ${Math.round(Number(d.burnedPermille) / 10)}% of the stores were burned before it fell.`;
        break;
      case 'shortfall': {
        if (!french(d.force)) break;
        const food = Number(d.food);
        const fodder = Number(d.fodder);
        const died = Number(d.horsesDied ?? 0);
        const horses = fodder > 0 ? `${Number(fodder).toLocaleString('en-GB')} horse-rations of fodder short${died > 0 ? `, ${died.toLocaleString('en-GB')} horses died` : ''}` : '';
        text =
          food > 0
            ? `${force(d.force)} went hungry: ${food.toLocaleString('en-GB')} rations short${horses ? `; ${horses}` : ''}.`
            : `${force(d.force)}'s horses went short: ${horses}.`;
        break;
      }
      case 'lastBattles':
        text = 'The campaign has run its time, but a battle has still to be fought out. Everyone else stands where they are.';
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
