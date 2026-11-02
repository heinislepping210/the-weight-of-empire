# Second independent review of 1 November 2026: record and status

A second outside AI reviewer assessed commit `58fb761` (rules 0.11.0, milestone M1) from [REVIEW_BRIEF](../REVIEW_BRIEF.md) and [SECOND_REVIEW_PROMPT](SECOND_REVIEW_PROMPT.md); its report is dated 2 November 2026. It reran the test suite, the build, the 27,000-game batch, the supply probe and the adaptive experiment, and reproduced the committed figures. The full report was received in the project chat. This file records each finding in our words, our assessment and its status, so later decisions can be traced back to it. Statuses are as of rules 0.13.0.

**The reviewer's verdict, in short:**
- **The corrections since the first review are real.** It confirmed in the code and by rerunning them that reinforcements join battles, the halt clears routes, comparisons keep the fog of war, carrying and forage distance matter, and the integrity gate fails when it should.
- **The engineering foundation is stronger; the operational one is not yet trustworthy.** New boundary cases still let columns pass, trains move without horses, plans double back through their objective, and the evaluator count food that cannot arrive.
- **Next:** focused correctness fixes, then a revised reading of the experiments, then a fresh human playtest. Map art can be explored, but its behaviour contract stays provisional.
- **Historically,** the evidence supports neither the closed-stock halt model nor a 30% casualty bar as the definition of a decisive defeat.
- **Not shown:** the M1 "fun" and 7–10 minute gate. The reviewer could not render the prototype.

**Our assessment:** accurate and well evidenced. Every defect we have checked reproduced with the reviewer's own numbers: French 16,300 m against Russians 10,348 m from the same start; a group at the objective routed C → B → C; a train with no horses delivering 40,000 rations; and, on rules 0.12.0, the junction case (French attack in 200 of 200 games when their force ID sorts first, 108 of 200 when the Russian one does).

## The five main findings (all P1, before M2)

| Finding | Status |
|---|---|
| 1. A column could pass an enemy column level with it on the same road, including at 0 m after a retreat | **Fixed in rules 0.12.0** (D-037): columns level on a road keep the order in which they set out. **Completed in 0.13.0** (D-038): the reviewer's matrix (0, 1,000 and 2,000 m, either side ahead, both orders of names) is in `tests/engine/time-order.test.ts`, a closed-up column now follows at the pace of the one ahead instead of stopping for the hour, and an invariant checked at every pause flags any column further along a road than an enemy column that set out before it |
| 2. "Sustainable" counted a district's food once for every group that could reach it, and counted wagon trains however far off | **Fixed in 0.12.0 and 0.15.0.** A district is shared among the groups that reach it, by what each would take. A train counts only if it has the horses to draw its load; since 0.15.0 (D-040) the check is day by day, so a train's food counts only from the day it can arrive, and only as much as the group would take; a group in battle forages nothing |
| 3. A group on its last stretch into the objective was routed back out to rejoin the kept route (seed 1812, turn 4: Davout ordered Smolensk → Krasnyi → Smolensk) | **Fixed in 0.12.0** (planner). *Still to add:* a general test that the objective appears only at the end of an advancing route, including after the lead group changes |
| 4. A loaded wagon train moved and delivered with no draught horses | **Fixed in 0.12.0.** A train moves only what its horses can draw; the rest goes back into its depot or is left by the road (counted as abandoned), and a train with no horses stays where it is. *Still to add:* tests for a returning train and for saving and resuming while stranded |
| 5. Cut-off tracking judged the main armies by their current share, the evaluator by their starting share | **Fixed in 0.12.0:** the main armies are fixed at the start. *Still to add:* tests for a contested blocking place, an eliminated army, and an army in transit beyond the block |

## Other findings

| Finding | Priority | Status |
|---|---|---|
| **A2. Junction timing depends on processing order.** Forces move one after another within each hour, and an unresolved tie makes the French the attacker. In the reviewer's symmetric fixture, the French attack in 200 of 200 games or 108 of 200 depending only on which force ID sorts first | P1, before M2 | **Fixed in rules 0.13.0** (D-038). Reproduced on 0.12.0 first, with the same numbers. Within each hour, forces now arrive and set out in time order across both sides; forces reaching a place at the same moment meet there; the attacker is the later arrival, and a remaining tie is drawn instead of going to the French. The fixture now gives the same result for every seed under either order of names: battle at the junction in all 200 games, the French attacking in 108 (the draw) |
| A3. A reinforcement can arrive, deploy and retreat with its side before it fights a round (136 such events in 200 concentrated-push games) | P2 | Open. Plausible as joining a collapsing position, but the dispatches should say "arrived, not yet deployed" |
| A4. A force falling back at 0 m is off its place, so an enemy may occupy that place at once; contact, pursuit and blocking must agree on that boundary | P2, before the M2 movement contract | **Stated in 0.13.0** (§3.4a): from the moment it leaves, a force falling back is on the road; contact, pursuit and blocking all treat it so |
| B3. Trains hand over their whole load whatever the recipient needs, so stocks end very uneven (one group with 7.5+ days of food and another with under one in 192 of 200 prudent-halt games) | P2, before M2 | **Fixed in rules 0.15.0** (D-040): a train hands over what the group would draw at a depot (all the food it can carry, two days' fodder, its ammunition) and could march with; the rest stays on the train. Depots and trains now reckon that room as a marching group sheds its load, so held fodder never blocks food |
| B4. The game credits a whole neighbouring district once its place is in reach, a separate simplification from the reach itself | P2, before the M2 geography contract | Source corrected and reach set to 11 km in 0.12.0. The whole-district convention is now stated (L-011); partial access is not modelled |
| C3. Arrival forecasts do not use the movement rules: gathering adds slots without its fatigue recovery, and the hourly integer travel is not replayed (one example arrives one sub-step earlier than forecast) | P2, before M2 | **Fixed in rules 0.15.0** (D-040): the forecast runs the engine's own hourly movement for the force alone, with fatigue, night rest and gathering. The reviewer's case now arrives exactly when forecast |
| C4. Food on arrival sums the districts on the route without reserving them between groups or timing them; the summary's warnings compare single groups with single sightings | P2, before M2 | Open |
| **D3. A cut-off, once achieved, stands for good.** Of 95 recorded cut-offs in 200 southern-envelopment games, 88 were no longer blocked at the end (seed 7: Costly Victory with every French group back at Smolensk and both Russian armies 82 km down the road) | P1, before M2 (design) | **Fixed in rules 0.14.0** (D-039), by the project owner's decision after three options were measured (docs/balance/2026-11-01-whatif-cutoff.md): a cut counts only if the Russians are still cut off at the end; a costly break-out counts as forced out; a cheap escape is only noted. The road was cut in 82% of southern-envelopment games but still cut at the end in 1.2% |
| D4. A battle's losses all count on its first day, so a battle of more than four days could put all of them in one window | P2, later | Open. No battle over four days in 250 games checked |
| Missing campaign states in the outcome table: a contested or engaged blocker, a Russian army beyond the block, an interruption followed by escape, a battle straddling the window | Before M2 | Partly: shared forage, a late train, lost traction and a main army at an exit were added in 0.12.0 |
| F1. The variance shares are descriptive. Cell means from three rolls still carry dice noise, so the raw interaction share overstates "which strategy suits which scenario" | Inferred | **Fixed** (D-041): the batch now gives the split with the dice noise taken out of the systematic terms; the interaction share falls from 27% to 19% on 0.15.0 |
| F2. The stability measure reused the first roll and counted ties | P1 | **Fixed in 0.12.0** (held-apart rolls, ties reported); regret added (D-041): 0.12 ranks on 0.15.0 |
| F3. The "dice" stream also decides withdrawals, road priority and burned stores, so "battle dice alone" is the wrong label; and weather and scouting errors stay with the scenario, which is a choice to state | P2, before M2 | **Fixed** (D-041): relabelled, and the report states that weather and scouting errors belong to the scenario |
| F4. The adaptive policy's failure shows only that this learner fails; its oracle knew the dice | P1 | **Fixed** (0.12.0, D-041): claims narrowed; the scenario oracle now chooses on a scenario's other rolls and is scored on the rest, with intervals; it gains 0.01 ranks (−0.03 to +0.01). *Still to build:* a per-turn policy with the real French observations, and nested resampling of its learning |
| F5. No confidence intervals: the games are clustered by scenario, not 27,000 independent results | P2, before strong claims | **Fixed** (D-041): intervals from a bootstrap over scenarios for each family's mean rank, F3 and the variance shares; for the adaptive test, over the held-out scenarios |
| F6. "Same ending" meant same rank (relabelled in 0.12.0); "same group orders" means the same bot, whose later orders may differ | P2 | **Fixed** (D-041): described as a comparison of two policies, not of fixed orders |
| F7. The staged push and the supplied halt are useful policies, not competent ones; their failure proves nothing about all play | Inferred | Recorded; the conclusions in GAMEPLAY_BALANCING were narrowed in 0.12.0 |
| G. The brief described rules 0.7.0, the review prompt was not published, and the first review's record said "fixed" where limits remained | P2 | **Fixed:** brief updated and prompt published in `9335272`; the first review's statuses revised |
| Version checks on load; real saves | M3 | Open, as planned |
| The Russian strike planner counts forces that cannot arrive together | Later | Open, as planned |
| Battle inputs: on average 22.6 per game for the concentrated push and 26.5 for the rush | Experience | Open: only a human playtest can say how many are worth a click |

## The developers' conclusions, as the reviewer judged them

| Our conclusion | Verdict | Status |
|---|---|---|
| Most earlier victories came from the old outcome rules | Partly: supported for the tested bots, not for every former victory | Wording kept to the bots tested |
| No approach can inflict a decisive defeat in battle; keep 30% in 4 days | Partly: true of the sampled bots only; keep 30% openly provisional, with Borodino as a negative control | Rout rule added in 0.12.0; the bar stays provisional (G-004) |
| Only the Moscow-road cut wins; the southern envelopment dominates | Partly: conditional on these bots, the graph, permanent cut-off credit and main-army identity | Narrowed; D3 open |
| Half the variance is suitability that cannot be read at the first decision | Disagree | Narrowed in 0.12.0 |
| No halt can consolidate, because the depots cannot feed 20 days | Partly: true of both halt bots, not of every halt; carried food, local resources, arrivals and throughput matter | Wording to narrow further; research leads below |
| Bait and converge's Limited Success is the historical par | Partly: a provisional par only | Recorded |

## Historical audit

- **L-011 was wrong as stated geometry:** Davie's figures are square widths. Corrected in 0.12.0.
- **H-018 (Borodino):** published estimates of Russian losses run from about a quarter (Clausewitz, about 30,000 of 120,000) to over a third (North, about 43,000). Widened accordingly.
- **Register statuses to keep honest:** L-009's 1.3–3.2 horses per 800 kg is our interpolation; Brun's article was not obtained. L-010 lists what a fusilier carried but does not fix a 3 kg payload. G-016's depot spacing, haul and burn range have no audited 1812 source. G-017's ranges are judgments, not statistical estimates. G-004 is unverified as a historical classifier. Updated in the register.
- **Research leads,** recorded in HISTORICAL_RESEARCH for checking: Napoleon's correspondence of 22 July and 10–12 August 1812 on the Orsha magazines and the Borisov flour requisition (Napoleonica); Nafziger's dated returns for 1 and 15 August 1812; Foord (1915) on the strength of the united Russian armies; the positions of Junot (Orsha) and Poniatowski (Mogilev) around 4 August, which the scenario merges; Clausewitz on Barclay's flank march to Lubino; and casualty comparisons for Austerlitz and Jena–Auerstedt.

## The reviewer's recommended next phase

One focused correction of the contact and retreat boundary: no column passes another merely because their positions are equal, and near-simultaneous meetings at a junction follow a stated rule of time rather than force-ID order. **Done in rules 0.12.0 and 0.13.0** (D-037, D-038), tests first. Still to come, as separate phases: supply forecasting and deliveries (B3, C3, C4, the time-aware allocation), the cut-off design (D3), the experiment's reporting (F1, F3–F6), and the human playtest.

## What the fixes in 0.12.0 changed

Rules 0.12.0, 1,000 scenarios × 3 sets of dice, zero invariant violations (GAMEPLAY_BALANCING, "The second independent review"):
- **The road-order fix** cut the concentrated push's collapses from 33% to 7%.
- **The route fix** let the southern envelopment hold Valutino. It now wins 82% of its games, but mostly as Costly Victories, because each ration counts once.
- **The corrected stability measure** still finds the best approach stable under fresh dice (99.6% of untied scenarios). Ties, at 21%, are now reported apart.
- **The scenario oracle** beats the best fixed approach by 0.13 ranks. The adaptive policy gains nothing, because it picks the southern envelopment everywhere.
- **Within the source's corrected range (7.5–15 km), the foraging reach** changes no approach family's endings. It costs the halts horses and food, and the methodical bot is repulsed more often.

## What the supply fixes in 0.15.0 changed

Rules 0.15.0, 1,000 scenarios × 3 sets of dice, zero invariant violations (GAMEPLAY_BALANCING, "Supply issued by need"):
- **A loophole closed:** a corps at its depot also drew through its own train, which is how stocks became so uneven. Closing it with the old four-day issue tripled collapses; the project owner chose to issue all the food a corps can carry instead.
- **Collapses all but disappear** (the push 4.3% → 0.3%), and the slower approaches now take Smolensk (the methodical bot 69% → 97%).
- **Uneven stocks remain only where position causes them** (29% of prudent halts, from 95%).
- **Still no tested approach wins.**

## What the timing fix in 0.13.0 changed

Rules 0.13.0, 1,000 scenarios × 3 sets of dice, zero invariant violations including the new road-order check (GAMEPLAY_BALANCING, "Movement in time order"):
- **The attacker rule** ended the French default: they now attack in 48% of the concentrated push's battles instead of 62%, and the push collapses less often (4.3% against 7.1%).
- **The time order** cut the push's battles from 4.3 to 3.4 a game, and French reinforcement joins by about half.
- **The southern envelopment** is unchanged (83% won, best on 85% of seeds).
