# Testing and QA

Automated tests, browser checks and human playtests. Fairness testing is described in GAMEPLAY_BALANCING.md. *Section numbers (§) are shared across all project documents; the index is in the README.*

## 7 Tests

- **Engine invariants** (property-based tests): no negative stocks; no troops from nowhere; transfers respect stock and capacity; movement follows the network; battles conserve men (killed + wounded + prisoners + survivors = start); invalid orders are rejected cleanly; save → load reproduces identical state.
- **Determinism:** golden replays plus a cross-browser check (Chromium, Firefox, WebKit) of the same seed giving the same hash.
- **Resumption tests:** save and reload at random pause points, including mid-battle, and confirm the final state matches an uninterrupted run (§3.4).
- **Browser tests (Playwright):** full playthrough, battle, report, reload mid-turn and mid-battle, corrupted-save recovery, share link, phone/tablet/desktop screenshots, reduced motion.
- **Accessibility:** axe checks; keyboard play of the whole Challenge, including a list-based alternative to the map; contrast; pattern + icon alongside colour.
- **Performance:** scripted pan/zoom FPS measurement; bundle-size budget check.
- **Human playtests:** I'll give you a one-page script (think-aloud play, an observation sheet, 6 questions afterwards). **Round 1: 2 testers, ~Day 15. Round 2: the other 2, ~Day 19**, so the second round tests the fixes with fresh eyes. The playtest summary screen records completion time and decisions for each tester (§1.2). I won't invent feedback; only what you report counts.

## Timeline tests (§3.4a)

- **T1** A delivery that arrives in a sub-step can't be used for marching or fighting during that sub-step; it is on hand from the end of the sub-step.
- **T2** Consumption never exceeds stock on hand; every shortfall is recorded and has effects.
- **T3** A force in battle neither moves nor forages during the sub-steps the battle occupies.
- **T4** No force belongs to two encounters in the same sub-step.
- **T5** Ammunition spent in one round is gone for the next, and is replenished only as §3.4a allows.
- **T6** Battle rounds advance the clock: a battle that starts in an afternoon sub-step has at most 3 rounds before nightfall.
- **T7** A battle that continues overnight across the turn boundary locks its forces out of new movement orders and resumes at dawn.
- **T8** Men, horses, wagons and supplies are conserved across every stage.
- **T9** Fatigue rises and recovers on the timeline: marching raises it within a sub-step, and night rest lowers it.
- **T10** Saving and loading at every stage, including the night phase and mid-battle, gives an identical final state. *Covered today:* engine states serialised to JSON at every pause, mid-battle included, then replayed. *Not yet covered:* browser saves (not built, §3.5), reload in a browser, checksums and corrupt saves, and resuming from internal stages between pauses.

## Where the tests live (status: 31 October 2026)

Run them with `npm test`. All of these currently pass.

| File | Covers |
|---|---|
| `tests/engine/timeline.test.ts` | T1, T2, T3, T5, T6, T7, T9; pre-battle withdrawal |
| `tests/engine/properties.test.ts` | T4, T8, T10 under random play (fast-check, 60 games per run), random depot founding and wagon-train orders included; conservation counts burned stores; every wagon train has exactly one task; contact rules at every pause (no force left outside a battle at its place, no opposing columns heading towards each other on one road); determinism; golden replays on the synthetic map and, from rules 0.8.0, on the real scenario with the real Russian command |
| `tests/engine/contacts.test.ts` | contacts (D-031): reinforcements of either side join at the sub-step boundary and fight from the next sub-step, without losses, ammunition or fatigue from rounds before then; columns marching towards each other meet instead of passing; no setting out along a road with an oncoming enemy column; no overtaking; withdrawals fall back along the road and arrive later; a halt stops every standing march. Written to fail on rules 0.7.0, as reproductions of the independent review |
| `tests/engine/carriage.test.ts` | horses, carrying and foraging reach (G-019): a wagon train loads only the wagons its horses can draw; wagon-train and draught horses eat and starve; setting out, a group keeps only what its men and horse-drawn wagons carry (fodder shed first, ammunition last), returning the rest to its depot or abandoning it; the staff's forecast says so before committing; depot issue only up to what can be carried; dispersed foraging only within reach by road. Written to fail on rules 0.8.0, including the review's probes (no horses, 600,000 rations without wagons, a 120 km forage road) |
| `tests/balance/supply-stance.test.ts` | the paired supply-stance probe, skipped normally: the same bots on the same seeds bringing depots forward or keeping them; run it with `BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/supply-stance.test.ts`. It fails on any invariant violation |
| `tests/ui/runs.test.ts` | saved comparison summaries keep the fog of war: no Russian strength, plans or positions for an unfinished campaign; all of them revealed for a finished one |
| `tests/engine/inputs.test.ts` | invalid inputs are rejected cleanly; `advance` never modifies its input |
| `tests/engine/rng.test.ts` | counter-based randomness: purity, uniformity, ranges |
| `tests/engine/zz-coverage-probe.test.ts` | guards that random play keeps reaching battles, nights, deliveries, shortfalls and withdrawals |
| `tests/balance/bots.test.ts` | each strategy bot plays the scenario to an evaluated end without breaking any invariant; the halt is declared and holds |
| `tests/balance/batch.test.ts` | the balance batch, skipped normally; run it with `BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/batch.test.ts` (about 80 s for 7,000 games). It fails on any invariant violation; the fairness diagnostics are reported but never fail it. Reports are kept in `docs/balance/`. What-if runs lay rule values over the adopted rules for one run, e.g. `BALANCE_OVERRIDES='{"attrition":{"cohesionLossAtFullShortfall":30}}'`; an unknown rule name is an error, and the report is marked as a what-if |
| `tests/engine/logistics.test.ts` | captured stores (who holds the ground, the burned share within its range and fixed by the seed, captors drawing on the rest, trains falling back); founding a depot only where French troops stand; one task per wagon train; idle line trains; a line train stocking a forward depot that troops then draw on; re-homing; the staff's supply plan (keep or bring forward, relays from each train's own depot, loaded trains left to finish) |
| `tests/engine/directive.test.ts` | axes (three distinct routes, shortest first, stable IDs); the staff planner (routes follow the chosen axis by sensible roads, orders the engine accepts, holding, held-back groups, forecasts including gathering, enemies from the French picture only, player overrides) |
| `tests/engine/russian.test.ts` | intelligence (sees only what is in range, with estimate error); the Russian command never uses unseen information; strike, hold, isolation, staleness, withdraw-or-stand, screening; determinism; political pressure |
| `tests/engine/posture.test.ts` | dispersed foraging (wider, even, never under the enemy); concentrated foraging; gathering before marching; reduced strength while gathering; no dispersing in battle; depot issue |
| `tests/data/vitebsk-scenario.test.ts` | the Vitebsk Decision start: placements, totals inside the researched ranges for 200 seeds, every group within what it can carry for 200 seeds, seeded variation, full random games with conservation |
| `tests/data/vitebsk-network.test.ts` | the Vitebsk–Smolensk network: sourced places, lengths consistent with coordinates, connected, three separate approaches, real river obstacles |

All of these run on a synthetic test map (`tests/fixtures/testGround.ts`) that is not historical data. Mechanics tests use a stand-in Russian command that holds still (`passiveContext`), so they test timing and supply rather than AI choices. The random-play property tests, the scenario tests and the AI tests use the real command. Not yet covered: cross-browser hash equality (needs Playwright), and events, which don't exist yet.
