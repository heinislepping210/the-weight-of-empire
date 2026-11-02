# Second independent review of 1 November 2026: record and status

A second outside AI reviewer assessed commit `58fb761` (rules 0.11.0, milestone M1) from [REVIEW_BRIEF](../REVIEW_BRIEF.md) and [SECOND_REVIEW_PROMPT](SECOND_REVIEW_PROMPT.md). The full review was received in the project chat; this file records each finding, our assessment and its status, so later decisions can be traced back to it.

**The reviewer's verdict, in short:**
- **Progress since the first review is real.** Stages A–F were confirmed in the code and the tests.
- **Five defects remained** in contacts, logistics, planning and the outcome model. Each could change a game's result.
- **The experiment's conclusions went further than its evidence**, in three places.
- **Two historical points:** a misread source (foraging reach) and a missing control (Borodino).

**Our assessment:** accurate. Every defect was reproduced before any change, with the reviewer's own numbers where it gave them: for example, French 16,300 m along the road against Russians 10,348 m from the same start; a group at the objective routed C → B → C; a train with no horses delivering 40,000 rations. Each fix began as a test that failed on rules 0.11.0 (`tests/engine/second-review.test.ts`).

## Status of each finding

| Finding | Status |
|---|---|
| A faster column could pass an enemy column level with it on the same road (both at the same distance, including the start of the road after a retreat) | **Fixed in rules 0.12.0** (D-037). Columns level on one road keep the order in which they set out |
| "Sustainable" counted a district's food once for every group that could reach it, and counted wagon trains however far off | **Fixed in 0.12.0.** A district is shared among the groups that reach it, by what each would take. A train counts only if it has the horses to draw its load and can arrive within the 2 days |
| A group on its last stretch into the objective was routed back out to rejoin the kept route | **Fixed** (planner, no rule change). It finishes the stretch it is on |
| A wagon train without horses still moved and delivered | **Fixed in 0.12.0.** A train moves only what its horses can draw; the rest goes back into its depot or is left by the road, and with no horses it stays where it is |
| The main armies were judged by their current share of the Russian strength, so the cut-off test changed as armies weakened | **Fixed in 0.12.0.** The main armies are fixed at the start (`GameState.mainArmies`), during the game and at the end alike |
| A decisive defeat needed only losses, although §2.13 also asks that the army break; Borodino (about a third lost, an orderly withdrawal) would have counted | **Fixed in 0.12.0.** Only battles in which the Russians broke (routed in the field or trapped) count. Recorded as H-018 |
| The "stable best approach" figure (97%) compared the first roll with a mean that included it, and counted ties as agreement | **Fixed.** The other rolls are held apart and ties are reported separately. The 0.11.0 figure is marked as corrected in GAMEPLAY_BALANCING |
| The adaptive test's oracle knew the dice as well as the scenario, so it was no bound on reading the situation | **Fixed.** The test now plays each scenario with several sets of dice and reports a scenario oracle and a full oracle apart |
| The supply probe's "Same ending" counted different endings of equal rank | **Relabelled** "Same rank", with a note |
| "Only the southern envelopment wins", "no approach inflicts a decisive defeat" and "the player cannot read it" were stated beyond the bots tested | **Narrowed** in GAMEPLAY_BALANCING and the roadmap: findings about these bots, not about the game |
| Davie's 15, 22 and 30 km are the widths of foraging squares, not radii (L-011) | **Source corrected, and the reach set to 11 km** in rules 0.12.0 (G-019), half the width of the source's square for extended operations. What-if runs at 7.5, 11, 15 and 22 km came first; the project owner chose 11 km |
| Junction timing, and the other points of the full report not summarised in the chat | **Open:** the full text is needed to record them |
</content>
</invoke>

## What the fixes changed

Rules 0.12.0, 1,000 scenarios × 3 sets of dice, zero invariant violations (GAMEPLAY_BALANCING, "The second independent review"):
- **The road-order fix** cut the concentrated push's collapses from 33% to 7%.
- **The route fix** let the southern envelopment hold Valutino. It now wins 82% of its games, but mostly as Costly Victories, because each ration counts once.
- **The corrected stability measure** still finds the best approach stable under fresh dice (99.6% of untied scenarios). Ties, at 21%, are now reported apart.
- **The scenario oracle** beats the best fixed approach by 0.13 ranks. The adaptive policy gains nothing, because it picks the southern envelopment everywhere.
- **Within the source's corrected range (7.5–15 km), the foraging reach** changes no approach family's endings. It costs the halts horses and food, and the methodical bot is repulsed more often.
