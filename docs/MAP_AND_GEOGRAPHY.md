# Map and Geography

*Section numbers (§) are shared across all project documents; the index is in the README.*

The map's geography — locations, routes, coordinates, rivers, obstacles — is data under program control. It never comes from generated artwork. Canva provides atmosphere only.

## The operational network (working list; every item is verified in Phase 2)

Target: 16–20 locations with alternative routes and real obstacles (acceptance criteria G1–G2, DEVELOPMENT_ROADMAP.md).

- **Places (19), in `src/data/vitebsk/places.ts`:** Vitebsk, Surazh, Velizh, Porechye (modern Demidov), Liozno, Rudnia, Babinovichi, Liubavichi, Orsha, Dubrovna, Rasasna, Liady, Krasnyi, Smolensk Old Town, Smolensk St Petersburg suburb, Valutino, Dorogobuzh, Mstislavl and Mogilev.
  - Coordinates are modern positions from Wikidata (CC0), each with its item ID. The north-bank suburb's position is estimated.
  - **Smolensk is two places** (assumption G-008): the walled Old Town on the south bank and the St Petersburg suburb on the north bank, joined by bridges. The Moscow road leaves from the north side. That reflects how the Russians could give up the Old Town and still escape in August 1812 (H-006).
  - **Left out:** Inkovo, which has no reliable Wikidata location (its action of 7 or 8 August sits on the Rudnia road), and Khomino. Khomino's only match is a village 4 km from Liubavichi, north of the river, which can't be confirmed as the 1812 Khomino. Both return if a period map places them.
- **Roads (28), in `src/data/vitebsk/roads.ts`:** all **provisional** until traced on period maps. Each records its basis, and its length is great-circle distance × 1.25 (G-007), stored as an integer. Crossings are marked only where an account supports them: Orsha (bridge), Rasasna–Liady (pontoon, the August 1812 crossing), the Smolensk bridges and the ford at Prudichevo (H-022). Unknown crossings near Mogilev and on the Moscow road are noted, not guessed.
- **Tested (`tests/data/vitebsk-network.test.ts`):** places inside the theatre and sourced; lengths consistent with coordinates; one connected network; three separate approaches to Smolensk (the Rudnia road, the southern swing across the Dnieper, the Porechye flank — the precursor of G1); and the Dnieper and the Smolensk bridges as real obstacles (precursor of G2).
- **Added after the bots found it missing (rules 0.17.2, D-044):** a way east of Smolensk that does not pass through the north-bank suburb. Before, the road to Valutino and Dorogobuzh hung off that suburb alone, so a Russian army standing there always kept its road east, and no French force could reach Valutino without going through it. Foord (1914) describes a track from the south side of Smolensk by a ford at Prudichevo, about 6 miles out, to the high road about 2 miles west of Lubino, which Junot took on 19 August (H-022). Prudichevo has no reliable Wikidata location, so the road joins the Old Town to Valutino directly, with a ford. It was measured first as a candidate road (`CANDIDATE_ROADS`, `BALANCE_SCENARIO=candidate-roads`), the route future finds also take, then adopted on your decision. The Gorbunovo cross-road that Barclay's columns took leaves from beside the north-bank suburb, so it is not added. *Audited (third review, 3 November):* a second account, the Russian *Military Encyclopaedia* (1911), puts the French crossing about 10 versts upstream of Smolensk near Prudishchevo, and Lubino lies 3.5 km from Valutino, so the track's junction falls within about a kilometre of the road's end. The ford and junction stay approximate on any painted map. The road matters to the results: without it the holding envelopment wins 41% of 200 games instead of 17% (GAMEPLAY_BALANCING).
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
- **Projection:** the places' own projection (longitude scaled by the cosine of the theatre's mean latitude), applied when the game loads to geodata stored in longitude and latitude. Places, roads and terrain share it, so nothing is misplaced against anything else. Compared with a conic projection it stretches the map east to west by up to about 2.5% at its northern and southern edges, a few pixels at the default zoom. *Decided 4 November 2026, in place of the conic projection first planned.*

## Real geography (built 4 November 2026, steps 1–3 of the geodata plan)

- **The pipeline.**
  - `tools/geo/fetch.mjs` downloads only the approved batch (batch 1, approved 4 November) into `assets-incoming/geo/`, which git ignores, and records each file's URL, licence, size and SHA-256 hash in `tools/geo/manifest.json`.
  - `tools/geo/build.mjs` checks every input against its hash. It clips the rivers and lakes to the theatre and simplifies them to about 150 m, then averages the SRTM heights into 30 × 45 arc-second cells (about 0.9 by 0.8 km).
  - It writes `src/data/vitebsk/geo.json`: 119 KB, 80 KB compressed, loaded after the game starts. Its output is byte-identical on every run.
  - Node alone, no new packages.
- **What it holds:**
  - **Natural Earth's rivers at 1:10 million:** the Dnieper, the Western Dvina, the Kasplya, the Sozh, the Desna, the Iput, the Pronya, the Druts and the Besed, and one small lake.
  - **Missing from that source:** smaller rivers such as the Luchesa at Vitebsk and the Vop. They can be added from the period maps.
  - **Accuracy:** about a kilometre. That is enough for which bank a town stands on, not for the streets of a town on both banks.
  - **The relief:** 127 to 289 m, complete, with no voids.
- **Checks against the network** (`tests/data/vitebsk-geo.test.ts`):
  - The Dnieper passes within 1.5 km of Orsha, Dubrovna, Rasasna, both parts of Smolensk, Dorogobuzh and Mogilev, and the Dvina passes Vitebsk and Velizh.
  - Smolensk's Old Town is on the south bank and its suburb on the north; Dubrovna and Liady are south, Valutino north.
  - The Dnieper's line runs at least 15 m below the theatre's mean height, which shows the relief grid lies the right way round.
- **Findings, for your decision** (each would change the rules: a crossing slows a road and makes it a difficult exit in battle):
  1. **Rasasna:** the August 1812 pontoon crossing is set on the Rasasna–Liady road, but in the data Rasasna lies 0.7 km south of the Dnieper. The river therefore falls on the Liubavichi–Rasasna road, and the Rasasna–Liady road crosses none.
  2. **Valutino–Dorogobuzh:** the road crosses the Dnieper with no crossing marked. The Solovyovo crossing is the candidate to check in the sources.
  3. **Orsha–Mogilev:** which bank the road kept, and where it crossed, is not established.
  4. **Mogilev–Mstislavl:** the road must cross the Dnieper and the Pronya; neither crossing is marked.

  Nine other roads whose straight lines cross a river are explained in the test: a town on both banks, or a straight line cutting a bend.
- **On the map** (`src/ui/TerrainLayer.tsx`, maths in `src/map/terrain.ts`):
  - **Relief:** a watercolour wash painted once from the heights, smoothed over about 2 km. SRTM measures the tree canopy, and the smoothing drops today's woods. Sepia shadows face away from the north-west light, the valleys are washed green-grey and the higher ground ochre, on a fine paper grain.
  - **Hachures:** from the operations zoom in, engraved strokes run down the steepest fifth of the ground, and only those in and around the view are drawn.
  - **Rivers and lakes:** ink lines with their corners rounded for display, and the Dnieper and the Dvina named along their course, clear of the places.
  - **Credit:** under the map, "rivers from Natural Earth, relief from SRTM data courtesy of the U.S. Geological Survey".
- **Next, each with its own approval:**
  - forest and marsh from a rights-checked 19th-century survey (download batch 2);
  - the 28 roads checked on Piadyshev's maps of 1820–21;
  - the G2 rules for terrain and road capacity, measured first.

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
