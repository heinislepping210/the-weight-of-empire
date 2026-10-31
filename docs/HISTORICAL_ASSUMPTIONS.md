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
| H-009 | Army strengths of both sides at each stage | Unverified | to be researched as ranges | — | starting forces |
| H-010 | Minard's strength figures | Minard's claims only | — | Minard (1869) | cited source only, never daily data |
| H-011 | Julian–Gregorian offset in 1812 | Well established (citation to add) | 12 days | standard chronology | date display |

## Game assumptions

| ID | Assumption | Value | Why | Notes |
|---|---|---|---|---|
| G-001 | Turn length | 2 days | ~10 turns fit the Challenge | may change (DEVELOPMENT_ROADMAP.md §1.2) |
| G-002 | Daylight sub-steps | 4 × 6 h per turn, plus 2 nights | movement and fighting in daylight; consumption at night | §3.4a |
| G-003 | Battle round | 2 h; at most 3 per sub-step | battles take real simulated time | §3.4a |
| G-004 | Outcome thresholds *L₁, L₂, C₁–C₃, E₁, D₁, T₁, S₁* | set in testing | §2.13 | each value recorded here once chosen |
| G-005 | Political pressure | 0–100 scale | §2.9 | |
| G-007 | Road length = great-circle distance between places × 1.25 for winding | Provisional | until roads are traced on period maps | `src/data/vitebsk/roads.ts` |
| G-008 | Smolensk as two places joined by bridges (Old Town on the south bank, St Petersburg suburb on the north) | Modelling choice | makes the river line and the Moscow road matter, as in H-006 | MAP_AND_GEOGRAPHY.md |
| G-006 | All numeric rule values in `src/engine/rules.ts` (march speeds, consumption, foraging, attrition, battle rates) | **Placeholders**, chosen only to exercise the engine | Phase 2 research replaces them with sourced ranges; balancing tunes them within those ranges | Rules 0.1.0 |


