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
- **T10** Saving and loading at every stage, including the night phase and mid-battle, gives an identical final state.

## Where the tests live (status: 31 October 2026)

Run them with `npm test`. All of these currently pass.

| File | Covers |
|---|---|
| `tests/engine/timeline.test.ts` | T1, T2, T3, T5, T6, T7, T9; pre-battle withdrawal |
| `tests/engine/properties.test.ts` | T4, T8, T10 under random play (fast-check, 60 games per run); determinism; the golden replay |
| `tests/engine/inputs.test.ts` | invalid inputs are rejected cleanly; `advance` never modifies its input |
| `tests/engine/rng.test.ts` | counter-based randomness: purity, uniformity, ranges |
| `tests/engine/zz-coverage-probe.test.ts` | guards that random play keeps reaching battles, nights, deliveries, shortfalls and withdrawals |
| `tests/engine/russian.test.ts` | intelligence (sees only what is in range, with estimate error); the Russian command never uses unseen information; strike, hold, isolation, staleness, withdraw-or-stand, screening; determinism; political pressure |
| `tests/engine/posture.test.ts` | dispersed foraging (wider, even, never under the enemy); concentrated foraging; gathering before marching; reduced strength while gathering; no dispersing in battle; depot issue |
| `tests/data/vitebsk-scenario.test.ts` | the Vitebsk Decision start: placements, totals inside the researched ranges for 200 seeds, seeded variation, full random games with conservation |
| `tests/data/vitebsk-network.test.ts` | the Vitebsk–Smolensk network: sourced places, lengths consistent with coordinates, connected, three separate approaches, real river obstacles |

All of these run on a synthetic test map (`tests/fixtures/testGround.ts`) that is not historical data. Mechanics tests use a stand-in Russian command that holds still (`passiveContext`), so they test timing and supply rather than AI choices. The random-play property tests, the scenario tests and the AI tests use the real command. Not yet covered: cross-browser hash equality (needs Playwright), and events, which don't exist yet.
