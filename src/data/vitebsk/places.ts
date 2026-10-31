// Places of the Vitebsk–Smolensk theatre (MAP_AND_GEOGRAPHY.md).
// Coordinates are modern positions from Wikidata (CC0), retrieved 2026-10-31.
// 1812 spellings follow common English usage; `modern` gives today's name where it differs.

export type PlaceStatus = 'located' | 'approximate' | 'uncertain';

export interface Place {
  id: string;
  name: string;
  modern?: string;
  lat: number;
  lon: number;
  /** Wikidata item the coordinates come from, or null where they are estimated. */
  wikidata: string | null;
  status: PlaceStatus;
  note?: string;
}

export const PLACES: readonly Place[] = [
  { id: 'vitebsk', name: 'Vitebsk', lat: 55.1833, lon: 30.1667, wikidata: 'Q102217', status: 'located' },
  { id: 'surazh', name: 'Surazh', modern: 'Surazh (Vitebsk district)', lat: 55.4056, lon: 30.7228, wikidata: 'Q2471115', status: 'located' },
  { id: 'velizh', name: 'Velizh', lat: 55.6, lon: 31.2, wikidata: 'Q132960', status: 'located' },
  { id: 'porechye', name: 'Porechye', modern: 'Demidov', lat: 55.2667, lon: 31.5167, wikidata: 'Q134790', status: 'located' },
  { id: 'liozno', name: 'Liozno', modern: 'Liozna', lat: 55.0261, lon: 30.7947, wikidata: 'Q1025872', status: 'located' },
  { id: 'rudnia', name: 'Rudnia', modern: 'Rudnya', lat: 54.95, lon: 31.0667, wikidata: 'Q193388', status: 'located' },
  { id: 'babinovichi', name: 'Babinovichi', modern: 'Babinavichy', lat: 54.8364, lon: 30.5758, wikidata: 'Q1066728', status: 'located' },
  { id: 'liubavichi', name: 'Liubavichi', modern: 'Lyubavichi', lat: 54.8339, lon: 30.9581, wikidata: 'Q898212', status: 'located' },
  { id: 'orsha', name: 'Orsha', lat: 54.5092, lon: 30.4258, wikidata: 'Q208609', status: 'located' },
  { id: 'dubrovna', name: 'Dubrovna', modern: 'Dubrowna', lat: 54.5722, lon: 30.69, wikidata: 'Q954505', status: 'located' },
  { id: 'rasasna', name: 'Rasasna', lat: 54.6451, lon: 30.877, wikidata: 'Q2157200', status: 'located', note: 'Spelled Rosasna or Rassasna in some accounts.' },
  { id: 'liady', name: 'Liady', modern: 'Lyady', lat: 54.6014, lon: 31.1697, wikidata: 'Q4272559', status: 'located' },
  { id: 'krasnyi', name: 'Krasnyi', modern: 'Krasny', lat: 54.56, lon: 31.435, wikidata: 'Q658905', status: 'located' },
  { id: 'smolensk', name: 'Smolensk (Old Town)', lat: 54.7828, lon: 32.0453, wikidata: 'Q2337', status: 'located', note: 'Walled city on the south bank of the Dnieper.' },
  {
    id: 'smolensk-north',
    name: 'Smolensk (St Petersburg suburb)',
    lat: 54.795,
    lon: 32.04,
    wikidata: null,
    status: 'approximate',
    note: 'North-bank suburb, joined to the Old Town by bridges; the Moscow road leaves from this side. Position estimated.',
  },
  { id: 'valutino', name: 'Valutino', lat: 54.8029, lon: 32.1986, wikidata: 'Q21636685', status: 'located', note: 'Lubino (Q13635925) lies about 3 km away; the action of 19 August is known by both names.' },
  { id: 'dorogobuzh', name: 'Dorogobuzh', lat: 54.92, lon: 33.3078, wikidata: 'Q135446', status: 'located' },
  { id: 'mstislavl', name: 'Mstislavl', modern: 'Mstsislaw', lat: 54.0196, lon: 31.7247, wikidata: 'Q744167', status: 'located' },
  { id: 'mogilev', name: 'Mogilev', modern: 'Mahilyow', lat: 53.9089, lon: 30.343, wikidata: 'Q154835', status: 'located' },
];
