# Map and Geography

*Section numbers (§) are shared across all project documents; the index is in the README.*

The map's geography — locations, routes, coordinates, rivers, obstacles — is data under program control. It never comes from generated artwork. Canva provides atmosphere only.

## The operational network (working list; every item is verified in Phase 2)

Target: 16–20 locations with alternative routes and real obstacles (acceptance criteria G1–G2, DEVELOPMENT_ROADMAP.md).

- **Places (19), in `src/data/vitebsk/places.ts`:** Vitebsk, Surazh, Velizh, Porechye (modern Demidov), Liozno, Rudnia, Babinovichi, Liubavichi, Orsha, Dubrovna, Rasasna, Liady, Krasnyi, Smolensk Old Town, Smolensk St Petersburg suburb, Valutino, Dorogobuzh, Mstislavl and Mogilev.
  - Coordinates are modern positions from Wikidata (CC0), each with its item ID. The north-bank suburb's position is estimated.
  - **Smolensk is two places** (assumption G-008): the walled Old Town on the south bank and the St Petersburg suburb on the north bank, joined by bridges. The Moscow road leaves from the north side. That reflects how the Russians could give up the Old Town and still escape in August 1812 (H-006).
  - **Left out:** Inkovo, which has no reliable Wikidata location (its action of 7 or 8 August sits on the Rudnia road), and Khomino. Khomino's only match is a village 4 km from Liubavichi, north of the river, which can't be confirmed as the 1812 Khomino. Both return if a period map places them.
- **Roads (27), in `src/data/vitebsk/roads.ts`:** all **provisional** until traced on period maps. Each records its basis, and its length is great-circle distance × 1.25 (G-007), stored as an integer. Crossings are marked only where an account supports them: Orsha (bridge), Rasasna–Liady (pontoon, the August 1812 crossing) and the Smolensk bridges. Unknown crossings near Mogilev and on the Moscow road are noted, not guessed.
- **Tested (`tests/data/vitebsk-network.test.ts`):** places inside the theatre and sourced; lengths consistent with coordinates; one connected network; three separate approaches to Smolensk (the Rudnia road, the southern swing across the Dnieper, the Porechye flank — the precursor of G1); and the Dnieper and the Smolensk bridges as real obstacles (precursor of G2).
- **Rear lines:** abstracted off-map links to Vilna and Minsk, with travel time, capacity and risk.
- **Key obstacles:** the Dnieper (bridges, fords, pontoon crossings), the Western Dvina, marsh and forest belts, and road capacity.
- Segment attributes and route previews are described in §2.7.

## 3.7 Geography pipeline (build time)
- **Town coordinates:** Wikidata (CC0).
- **Major rivers:** Natural Earth (public domain).
- **Minor rivers / marsh outlines:** only if no public-domain source is enough. Then OpenStreetMap, handled as described under *Data licences* below.
- **Relief:** SRTM (public domain).
- **1812 roads:** hand-authored from period maps, **with a source recorded per segment**.
- **Forest extent:** approximated from period maps and labelled as an approximation. Today's forests are not 1812's.
- **Projection:** a conic projection centred on the theatre, computed at build time. The runtime only sees projected coordinates.

## Data licences and separation

- **Prefer sources with no obligations:** Natural Earth (public domain), Wikidata (CC0), SRTM (public domain), and data hand-authored from period maps whose rights have been checked item by item.
- **Every hand-authored road segment records its source map** in the data itself.
- **OpenStreetMap only if needed.** If any OSM-derived data is used:
  - it lives only in `data/geo/odbl/`, never mixed into other files;
  - that folder carries its own `LICENSE` (Open Database License 1.0) and an attribution file;
  - the root README states that the MIT licence does not cover it;
  - the derived data is published under ODbL in the public repository;
  - the map and the credits show "© OpenStreetMap contributors", following the OSM attribution guidelines.
- The rights register (RIGHTS_AND_LEGAL.md) lists every geographic source with its licence.
