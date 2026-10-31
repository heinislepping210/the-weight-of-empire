# Historical and Game Assumptions Register

Every figure, date or rule the game relies on is listed here with its status (HISTORICAL_RESEARCH.md): **Verified**, **Disputed**, **Unverified**, or **Game assumption** (a design choice, openly labelled).

## Historical claims

| ID | Claim | Status | Value / range | Sources so far | Used in the game for |
|---|---|---|---|---|---|
| H-001 | Napoleon enters Vitebsk, stays, and weighs halting the campaign | Disputed by a day; halting corroborated | entered 28 or 29 Jul; left 12 or 13 Aug 1812 | Wikipedia; historyofwar.org; napoleon-empire.org; Ségur (via 1812now) | scenario context; historical ghost |
| H-002 | The Russian 1st and 2nd Western Armies join at Smolensk | **Disputed** | 2–4 Aug 1812: the 1st Army arrived on the evening of 1 Aug; Bagration announced 3 Aug; a junction is reported on 4 Aug | Wikipedia (Smolensk; Bagration); frenchempire.net | scenario start date |
| H-003 | Council of war (6 Aug) and Russian offensive west towards Rudnia (from 7 Aug); cavalry action at Inkovo | Corroborated; Inkovo date **disputed** | offensive 7 Aug; Inkovo 7 or 8 Aug | Wikipedia (Inkovo; Smolensk); historyofwar.org | the AI plan *strike the dispersed* |
| H-004 | Dnieper crossing at Rasasna on bridges built overnight | Corroborated; bridge count, Eblé's role and "Khomino" unverified | night of 13–14 Aug | historyofwar.org; Wikipedia (First Krasnoi) | pontoon train; road `rasasna-liady` |
| H-005 | First battle of Krasnyi: Neverovsky delays the French; his outposts at Liady | Corroborated | 14 Aug | historyofwar.org; Wikipedia | historical ghost; event |
| H-006 | Battle of Smolensk; the Russians withdraw to the north bank | Corroborated (tertiary) | 16–18 Aug | Britannica; Wikipedia; historyofwar.org | historical ghost; par outcome; two-part Smolensk (G-008) |
| H-007 | Valutino / Lubino | Unverified | 19 Aug | historyofwar.org | Moscow-road node |
| H-012 | A false report of French troops at Porechye turns Barclay north-west and stalls the offensive; Porechye found empty | 8 Aug corroborated; 12 Aug unverified | 8–12 Aug | Wikipedia (Inkovo); historyofwar.org | Russian AI acting on imperfect intelligence |
| H-013 | The Russian 1st Army reaches Smolensk by way of Porechye | Unverified | evening of 1 Aug | Wikipedia (Smolensk) | Porechye road |
| H-008 | Kutuzov's appointment and arrival | Unverified | appointed in Aug; took command after Smolensk | — | full campaign only |
| H-009 | Army strengths around Smolensk in mid-August | **Disputed** / unverified | **French central group ~180,000** (most cited; some summaries lower). Ney's III Corps ~44,000 in June → ~22,000–30,000 by mid-August. **Russian combined 1st and 2nd Armies ~120,000–130,000**; June order-of-battle figures add up higher (1st Army ~104,000 + ~7,000 Cossacks; 2nd Army ~33,000–49,000 + ~4,000 Cossacks) and are not reconciled | Wikipedia (Smolensk; III Corps; Second Western Army; orders of battle); historyofwar.org | starting forces, as ranges, by force group |
| H-014 | French attrition between the Niemen and Smolensk | Unverified (popular, uncited) | about a third of the men and about half the cavalry and draught horses, mostly to sickness, exhaustion and desertion | Real Time History blog | calibration hint for the history-as-par benchmark only |
| L-001 | March rates | Unverified (secondary) | normal ~16–30 km/day; forced roughly 30–45 km/day; ~40 km/day reported in 1812, at heavy cost | Army Heritage bibliography on marching rates; napoleonguide.com; blogs | `march.metresPerSlot` |
| L-002 | Supply-wagon speed | Unverified (secondary) | ~16–19 km/day; the transport service planned on ~16 km/day | blogs citing van Creveld | `convoy.metresPerSlot` |
| L-003 | Food ration per man per day | Unverified; no French figure found | British benchmark 0.68 kg of bread or 0.45 kg of biscuit; a figure of 1.4 kg of grain is attributed to Engels | 95th Rifles reenactors (British); violentmetaphors.com | weight of a food ration |
| L-004 | Fodder per horse per day | Unverified (secondary) | ~9 kg (20 lb), attributed to Engels | violentmetaphors.com | weight of a fodder ration |
| L-005 | Wagon payload | Unverified; French data not found | ammunition wagons ~680 kg (1,500 lb); British general-service wagon ~1,090 kg (2,400 lb) including the team's forage | historyrise.com; Wikipedia (military train) | `convoy.wagonCapacity` |
| L-006 | Transport service of 1812 | Unverified (blog citing van Creveld) | 26 transport battalions, ~9,200 tonnes, moving about 16 km a day | the-other-side-of-history blog | scale of the wagon parks |
| H-010 | Minard's strength figures | Minard's claims only | — | Minard (1869) | cited source only, never daily data |
| H-011 | Julian–Gregorian offset in 1812 | Well established (citation to add) | 12 days | standard chronology | date display |

## Game assumptions

| ID | Assumption | Value | Why | Notes |
|---|---|---|---|---|
| G-001 | Turn length | 2 days | ~10 turns fit the Challenge | may change (DEVELOPMENT_ROADMAP.md §1.2) |
| G-002 | Daylight sub-steps | 4 × 6 h per turn, plus 2 nights | movement and fighting in daylight; consumption at night | §3.4a |
| G-003 | Battle round | 2 h; at most 3 per sub-step | battles take real simulated time | §3.4a |
| G-004 | Outcome thresholds (provisional, rules 0.5.0): decisive defeat when the Russian main armies lose ≥ 30% and lose a battle; escaped intact below 10%; a road block needs 30,000 men; capable means ≥ 75% of men and cohesion ≥ 500; sustainable means ≥ 2 days' food in hand; collapse below cohesion 250 or at ≥ 50% of men lost | set in testing | §2.13 | `rules.outcome`; the line-delivery test (*T₁*) is not used yet |
| G-005 | Political pressure | 0–100 scale | §2.9 | |
| G-007 | Road length = great-circle distance between places × 1.25 for winding | Provisional | until roads are traced on period maps | `src/data/vitebsk/roads.ts` |
| G-008 | Smolensk as two places joined by bridges (Old Town on the south bank, St Petersburg suburb on the north) | Modelling choice | makes the river line and the Moscow road matter, as in H-006 | MAP_AND_GEOGRAPHY.md |
| G-006 | All numeric rule values in `src/engine/rules.ts` (march speeds, consumption, foraging, attrition, battle rates) | **Placeholders**, chosen only to exercise the engine | Phase 2 research replaces them with sourced ranges; balancing tunes them within those ranges | Rules 0.2.0 replaced march speeds, wagon payload and ration weights with values inside L-001 to L-005. Consumption, foraging, attrition and battle rates are still placeholders. |
| G-009 | Convoy load shares by weight: food 70%, fodder 20%, ammunition 10% | Placeholder | until depot-level supply orders exist | `convoy.loadPermille` |
| G-010 | How the researched army totals (H-009) are split across force groups, as seeded ranges: Guard 28–36k; vanguard (Murat and Ney) 38–50k; Eugène 28–36k; Davout 42–55k; Poniatowski and Junot 26–36k; Barclay 70–80k; Bagration 38–46k; Platov's Cossacks 7–10k; Neverovsky 6–8k | Game assumption | French totals land in 162–213k and Russian in 121–144k; to be replaced by order-of-battle figures | `src/data/vitebsk/scenario.ts` |
| G-011 | Positions on 5 August: Guard at Vitebsk, vanguard at Liozno, Eugène at Surazh, Davout at Dubrovna, Poniatowski and Junot at Mogilev; Barclay at Smolensk's north-bank suburb, Bagration in the Old Town, Platov at Rudnia, Neverovsky at Krasnyi | Working assumption from H-001 to H-003 | to be checked against a day-by-day source | scenario start |
| G-012 | Carried supplies, depot stocks, wagon-park sizes and countryside yields: French depots Vitebsk 1.2M rations, Orsha 600k, Mogilev 300k; Russian depots Smolensk 1.5M, Dorogobuzh 400k; each district 150k food and 150k fodder | **Calibrated placeholders** (D-024) | set so that a halted, dispersed force near its depot is sustainable and pressure grows with distance (GAMEPLAY_BALANCING.md); to be grounded in research on magazines and local resources | scenario data |
| G-013 | Posture and supply rules: gathering takes 2 sub-steps, with fighting strength −25% per outstanding sub-step; dispersed foraging ×1.8 over neighbouring districts; foraging rates per activity; depot issue up to 4 days of food, 2 of fodder and 150 ammunition units per 1,000 men; sickness 2‰ a day | Game assumptions | shape the disperse-or-concentrate dilemma (§2.4b); no sources yet | `src/engine/rules.ts` (0.3.0) |
| G-014 | Russian command: starting pressure 55–75 and temperament −10 to +10 (seeded); pressure +3 per turn, +5 per Smolensk-province place held by the French, −20 after a battle with a Russian main army; thresholds strike ≥ 60, stand ≥ 50, must stand ≥ 80; danger at 1.3× enemy strength; isolation 40 km; strike reach 110 km at 2:1 odds. Smolensk-province places: Rudnia, Porechye, Krasnyi, both parts of Smolensk, Valutino, Dorogobuzh | Game assumptions; the province list is approximate | shapes the Russian dilemma between preserving the army and political pressure (H-012 and Lieven's account of the pressure on Barclay, to verify) | `rules.russian`, `pressurePlaces` |
| G-015 | Detection: 15 km base, plus 4 km per 1,000 horses, capped at 60 km; strength estimates ±20%, rounded to the nearest hundred; updated at the end of each turn | Game assumptions | gives cavalry its scouting role (§2.8) | `rules.intel` |


