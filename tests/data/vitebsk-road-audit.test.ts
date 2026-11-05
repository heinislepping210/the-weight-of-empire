// The road audit on Piadyshev's maps of 1820–21 (HISTORICAL_RESEARCH, "The road audit"). Its road classes and
// crossings are adopted (D-052); its lengths are held as data and offered only as a what-if until a decision.

import { describe, expect, it } from 'vitest';
import { ROADS, ROAD_READINGS, VERST_METRES, readingMetres, vitebskNetwork } from '../../src/data/vitebsk/roads';
import { vitebskDecision } from '../../src/data/vitebsk/scenario';

const road = (id: string) => {
  const r = ROADS.find((x) => x.id === id);
  if (!r) throw new Error(id);
  return r;
};

describe('the adopted corrections (D-052)', () => {
  it('put the crossings where the maps have them', () => {
    // Orsha stands west of the Dnieper: the Vitebsk road reaches it dry, and the river falls on the road to Dubrovna.
    expect(road('babinovichi-orsha').crossing).toBeNull();
    expect(road('orsha-dubrovna').crossing).toBe('bridge');
    // Rasasna stands on the south bank, so the pontoon belongs on the road from the north.
    expect(road('liubavichi-rasasna').crossing).toBe('pontoon');
    expect(road('rasasna-liady').crossing).toBeNull();
    // The Moscow road crosses just east of Pnewa, and the road east from Mogilev at the town.
    expect(road('valutino-dorogobuzh').crossing).toBe('bridge');
    expect(road('mogilev-mstislavl').crossing).toBe('bridge');
    expect(road('orsha-mogilev').crossing).toBeNull();
  });

  it('give the roads their classes, and add the road the maps have', () => {
    for (const id of ['vitebsk-surazh', 'vitebsk-babinovichi', 'babinovichi-orsha', 'porechye-smolensk-north']) expect(road(id).road, id).toBe('post');
    for (const id of ['vitebsk-liozno', 'liozno-rudnia', 'rudnia-smolensk-north', 'velizh-porechye', 'rasasna-liady']) expect(road(id).road, id).toBe('secondary');
    expect(road('liozno-liubavichi')).toMatchObject({ metres: Math.round(25.75 * VERST_METRES), road: 'secondary', crossing: null });
  });
});

describe('the road readings, a what-if', () => {
  it('name real roads, and the game does not use them', () => {
    const ids = new Set(ROADS.map((r) => r.id));
    for (const id of Object.keys(ROAD_READINGS)) expect(ids.has(id), id).toBe(true);
    const edges = vitebskNetwork().edges;
    expect(edges).toHaveLength(ROADS.length);
    for (const r of ROADS) expect(edges.find((e) => e.id === r.id)?.metres).toBe(r.metres);
    expect(vitebskDecision().id).toBe('vitebsk-decision');
  });

  it('turn the map\'s stages into lengths: Smolensk to Krasnyi is 23 and 23 versts', () => {
    expect(readingMetres('krasnyi-smolensk')).toBe(Math.round(46 * VERST_METRES));
    expect(readingMetres('smolensk-bridges')).toBeNull();
    // The Moscow road's stages run from Smolensk: the game's first stretch to Valutino is taken off.
    expect(readingMetres('valutino-dorogobuzh')).toBe(Math.round(88 * VERST_METRES) - road('smolensk-north-valutino').metres);
  });

  it('fit the map: none falls far under the straight line between the places, which would mean a misreading', () => {
    // G-007's lengths are the straight line × 1.25, rounded. A stage ran between stations at the towns' edges, not
    // between today's town centres, so Orsha–Dubrovna (0.94) and Vitebsk–Surazh (0.99) can dip a little under it.
    for (const r of ROADS) {
      const read = readingMetres(r.id);
      if (read !== null) expect(read, r.id).toBeGreaterThanOrEqual(Math.floor(r.metres / 1.25) * 0.9);
    }
  });

  it('replace only the lengths, and only when asked', () => {
    const edge = vitebskNetwork({ readings: true }).edges.find((e) => e.id === 'vitebsk-surazh');
    expect(edge).toMatchObject({ metres: Math.round(40 * VERST_METRES), road: 'post' });
    expect(vitebskDecision({ roadReadings: true }).id).toBe('vitebsk-decision+road-readings');
  });
});
