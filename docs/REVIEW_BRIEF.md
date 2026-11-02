# Review Brief

For an outside reviewer, human or AI, asked to give feedback on the project as it stands (2 November 2026, rules 0.16.0, milestone M1). It says what exists, what changed since the first independent review, where to look, and what is already known, so a review can go beyond it. The detailed instructions for a second review are in [reviews/SECOND_REVIEW_PROMPT.md](reviews/SECOND_REVIEW_PROMPT.md).

## What the project is

*The Weight of Empire* is a browser strategy game about Napoleon's 1812 campaign. The first release, *The Vitebsk Decision*, is a 7–10 minute command challenge.
- **The situation:** August 1812. The Grande Armée stands around Vitebsk, and the united Russian armies hold Smolensk.
- **The player's job:** decide whether and how to advance, over 10 turns of 2 days.
- **What decides the outcome:** supply, fatigue, posture, intelligence and a responsive Russian command.
- **The aim:** historically grounded, replayable and fair. Strategy should matter more than luck, and every number is either sourced or openly labelled as a game assumption.

## What exists now

- **A deterministic, resumable simulation** in TypeScript, with no backend:
  - Four daylight sub-steps and two nights per turn. Forces move together hour by hour.
  - Integer arithmetic and counter-based randomness, with the **scenario** (seed) and the **fortunes of war** (dice) as separate streams.
  - A game can be saved and resumed at any pause, battles included. The engine supports this; the browser does not save games yet.
- **Contacts happen at places.** Reinforcements join battles and fight from the next sub-step; opposing columns cannot pass on a road; retreats take time on the road.
- **Logistics by weight:**
  - depots, wagon trains and line trains;
  - draught horses that limit loads, and finite carrying capacity;
  - foraging bounded by reach;
  - captured stores (partly burned) and forward depots;
  - hunger that costs men through straggling and cohesion more slowly.
- **A Russian command** that acts on its own scouting, with seeded political pressure and temperament.
- **Army directives with a staff planner.** One plan serves both preview and commit. It covers your own orders per group, a kept route with a per-group road choice, an army summary first, and every order's reasons.
- **An outcome evaluator** as §2.13 defines it:
  - decisive defeat from battle losses within 4 days;
  - cut off at designated places on the Moscow road, held for 2 sub-steps;
  - supply judged group by group;
  - a table of campaign states fixing what each ending means.
- **Balance tooling:**
  - thirteen bots and a 1,000-seed batch that fails on any invariant violation;
  - replays with fresh dice and a split of the ending's variance;
  - a paired supply-stance probe, and an adaptive policy judged on held-out seeds;
  - what-if runs with rule overrides.
- **A plain prototype screen:** an SVG map, the orders panel, battle decisions, dispatches, and comparison of saved summaries (fog of war kept until a campaign ends).

## Since the first independent review (commit `1ade716`)

The first review's findings and their status are in [reviews/2026-10-31-independent-review.md](reviews/2026-10-31-independent-review.md), the second's in [reviews/2026-11-01-second-review.md](reviews/2026-11-01-second-review.md). In short:

| Stage | Change | Rules | Decision |
|---|---|---|---|
| A | Contacts: reinforcements, no passing on roads, retreats take time, the halt stops every march | 0.8.0 | D-031 |
| B | Horses, carrying and foraging reach; a paired supply-stance probe | 0.9.0 | D-032 |
| C | One plan for preview and commit, a kept route, the summary first; a road choice per group | — | D-033, D-034 |
| D | The outcome model as designed; a victory before a late halt stands | 0.10.0 | D-035 |
| F | Scenario and dice apart; variance split with fresh dice; adaptive policy on held-out seeds; depot shared by need | 0.11.0 | D-036 |
| Second review | Road order, traction, fixed main armies, the rout rule, sustainability counted once; the experiment's measures and claims corrected | 0.12.0 | D-037 |
| Second review, next phase | Movement in time order within each hour; the attacker drawn on a tie | 0.13.0 | D-038 |
| Second review, D3 | A cut road counts only if the Russians are still cut off at the end (graded) | 0.14.0 | D-039 |
| Second review, supply | Trains issue like depots (all the food a corps can carry); "sustainable" day by day; forecasts run the movement rules | 0.15.0 | D-040 |
| Second review, reporting | Dice labelled as resolution randomness; noise-adjusted variance split; regret; scenario-clustered intervals; a cross-fitted oracle | — | D-041 |
| Competent bots | A southern envelopment that holds Valutino, a concentrated strike; a beaten attacker falls back the way it came | 0.16.0 | D-042 |

Each change was written test-first: tests that failed on the previous rules.

## Where to start

1. This brief, then [PROJECT_VISION](PROJECT_VISION.md) for the goals and the scope limits.
2. [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) §2: §2.4b directives, §2.6 logistics, §2.12 variation, §2.13 outcomes.
3. [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md) §3.4a: the turn timeline and the contact rule.
4. [GAMEPLAY_BALANCING](GAMEPLAY_BALANCING.md), from "Contacts corrected" to the end, with the reports in [balance/](balance/). The latest are [rules 0.16.0 with the bots that feed the trap](balance/2026-11-02-rules-0.16.0-feeding-the-trap.md), [the adaptive policy](balance/2026-11-02-adaptive-0.16.0-feeding-the-trap.md), and the what-ifs on [the cut road](balance/2026-11-01-whatif-cutoff.md), [the foraging reach](balance/2026-11-01-whatif-reach.md) and [the line-haul limit](balance/2026-11-02-whatif-haul.md).
5. [HISTORICAL_RESEARCH](HISTORICAL_RESEARCH.md) and [HISTORICAL_ASSUMPTIONS](HISTORICAL_ASSUMPTIONS.md): sources, and the status of every claim (H-, L- and G- entries).
6. [DECISIONS](DECISIONS.md) D-029 to D-042.
7. Code:
   - `src/engine/advance.ts`: turn resolution, about 900 lines.
   - `battle.ts`, `carriage.ts`, `directive.ts` (the staff planner), `outcome.ts` and `rules.ts` (every rule value).
   - `src/data/vitebsk/`: the scenario.
   - `tests/`: tests, bots, batch, probes.

**To run it** (Node.js 22 or later): `npm ci`, `npm test`, `npm run build`, then `npm run dev` and open http://localhost:5173. The longer runs are listed in [TESTING_AND_QA](TESTING_AND_QA.md).

## Already known (no need to report, but deeper analysis and fixes are welcome)

- **Not built yet:**
  - the painted living map (M2), sector battles (§2.10), events and the after-action report;
  - real browser saves and version checks on load (review stage E, an M3 criterion);
  - road capacity and column length;
  - raids on convoys, and a cost (garrison) for founding a depot;
  - the supply line's delivery rate in "sustainable" (*T₁*), and cut supply lines in "secure".
- **Balance findings among the tested bots, documented in GAMEPLAY_BALANCING (rules 0.16.0):**
  - Only holding the Moscow road at Valutino to the end wins: the holding southern envelopment wins 35% of its games, all costly, because its army has outrun its wagon trains and cannot be fed there. Lifting the 80 km line-haul limit changes that in 2 games of 1,000 (what-if, 2 November). Leaving the Guard at the main depot while the corps make the swing wins decisively in 6.4% of games; halting groups for their wagon trains does worse. Every approach that does not hold Valutino ends, at best, in Limited Success. Until 0.13.0 the southern envelopment won 82% of its games by cutting the Moscow road, but the Russians were still cut off at the end in under 2%; since 0.14.0 a cut counts only if it lasts (D-039).
  - No tested approach inflicts a decisive defeat in battle under the placeholder battle model (counted directly since 0.14.0).
  - No halt consolidates, at any foraging reach tested, because the placeholder depot stocks cannot feed the army for 20 days. Research on the 1812 magazines is pending.
  - The adaptive policy gains nothing over the best fixed approach.
  - Two of the "competent" bot variants are not yet competent.
- **The foraging reach was corrected** to 11 km (G-019, D-037), after the source turned out to give the widths of foraging squares, not radii.
- **Open measures:** F3 by openings (branch the first two directives with a shared continuation); an adaptive policy that re-decides every turn with the full French observations, with nested resampling of its learning. (Scenario-clustered intervals and a noise-adjusted variance split are in the batch since D-041.)
- **Most rule values are still game assumptions.** Only march speeds, wagon loads, rations, hunger, horses per wagon and carrying have been checked against sources, and those only as ranges; the foraging reach was misread at first and corrected in 0.12.0.
- **Roads are provisional:** straight-line distance × 1.25 (G-007).

## Scope limits (please don't suggest these)

The first release deliberately has no real-time 3D, no multiplayer, no accounts, no paid AI services and no large backend. Rule values are never tuned just to make the balance targets pass. A change must come from research, a bug, implausible AI or better information for the player.
