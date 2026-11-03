# Review Brief

For an outside reviewer, human or AI, asked to give feedback on the project as it stands (2 November 2026, rules 0.18.0, milestone M1). It says what exists, what changed since the first independent review, where to look, and what is already known, so a review can go beyond it. The detailed instructions for a second review are in [reviews/SECOND_REVIEW_PROMPT.md](reviews/SECOND_REVIEW_PROMPT.md).

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
- **Sector battles** (§2.10): the field in three sectors and a reserve, with contracts for every man and gun, simultaneous rounds, four results kept apart and escape graded by the situation (TECHNICAL_ARCHITECTURE §3.4b).
- **An outcome evaluator** as §2.13 defines it:
  - decisive defeat from battle losses within 4 days;
  - cut off at designated places on the Moscow road, held for 2 sub-steps;
  - supply judged group by group;
  - a table of campaign states fixing what each ending means.
- **Balance tooling:**
  - fourteen bots and a 1,000-seed batch that fails on any invariant violation;
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
| Sector battles | Three sectors and a reserve, cavalry and guns, four results kept apart, graded exits, pursuit once; contracts tested before the combat code (TECHNICAL_ARCHITECTURE §3.4b) | 0.17.0–0.17.1 | D-043 |
| Prudichevo road | A track with a ford from the Old Town to the Moscow road (H-022), found missing by the pinning bot | 0.17.2 | D-044 |
| Stand order | A battle stance whose marshal holds on after losing the position while cohesion lasts | 0.17.2 | D-045 |
| Third review | A beaten side falls back together along its line (an attacker the way it came, a defender towards its base); both break-offs leave at once, never by one road; an empty line counter-attacks; only deployed cavalry pursues; losses by sub-step; in the interface, Stand explained, the verdict in Compare and a deployment preview; in the experiment, F3 with its ties and regret, variance components that allow for shared dice, pinning bots that plan by search, counted stage by stage ([record](reviews/2026-11-02-third-review.md)) | 0.18.0 | D-046, D-047 |

Each change was written test-first: tests that failed on the previous rules.

## Where to start

1. This brief, then [PROJECT_VISION](PROJECT_VISION.md) for the goals and the scope limits.
2. [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) §2: §2.4b directives, §2.6 logistics, §2.12 variation, §2.13 outcomes.
3. [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md) §3.4a: the turn timeline and the contact rule.
4. [GAMEPLAY_BALANCING](GAMEPLAY_BALANCING.md), from "Contacts corrected" to the end, with the reports in [balance/](balance/). The latest are [rules 0.18.0, how a side leaves the field](balance/2026-11-03-rules-0.18.0.md) with [its supply-stance probe](balance/2026-11-03-supply-stance-0.18.0.md), [rules 0.17.2 with the stand order](balance/2026-11-02-rules-0.17.2-stand.md), [rules 0.17.2 with the Prudichevo road](balance/2026-11-02-rules-0.17.2.md), [rules 0.17.1 with the sector battles](balance/2026-11-02-rules-0.17.1.md), [the sensitivity of four battle values](balance/2026-11-02-sensitivity-0.17.1.md), [rules 0.16.0 with the bots that feed the trap](balance/2026-11-02-rules-0.16.0-feeding-the-trap.md), [the adaptive policy](balance/2026-11-03-adaptive-0.18.0.md), and the what-ifs on [the cut road](balance/2026-11-01-whatif-cutoff.md), [the foraging reach](balance/2026-11-01-whatif-reach.md) and [the line-haul limit](balance/2026-11-02-whatif-haul.md).
5. [HISTORICAL_RESEARCH](HISTORICAL_RESEARCH.md) and [HISTORICAL_ASSUMPTIONS](HISTORICAL_ASSUMPTIONS.md): sources, and the status of every claim (H-, L- and G- entries).
6. [DECISIONS](DECISIONS.md) D-029 to D-046.
7. Code:
   - `src/engine/advance.ts`: turn resolution, about 900 lines.
   - `battle.ts`, `carriage.ts`, `directive.ts` (the staff planner), `outcome.ts` and `rules.ts` (every rule value).
   - `src/data/vitebsk/`: the scenario.
   - `tests/`: tests, bots, batch, probes.

**To run it** (Node.js 22 or later): `npm ci`, `npm test`, `npm run build`, then `npm run dev` and open http://localhost:5173. The longer runs are listed in [TESTING_AND_QA](TESTING_AND_QA.md).

## Already known (no need to report, but deeper analysis and fixes are welcome)

- **Not built yet:**
  - the painted living map (M2), the illustrated battlefield (the sector battles are built, in a plain panel), events and the after-action report;
  - real browser saves and version checks on load (review stage E, an M3 criterion);
  - road capacity and column length;
  - raids on convoys, and a cost (garrison) for founding a depot;
  - the supply line's delivery rate in "sustainable" (*T₁*), and cut supply lines in "secure".
- **Balance findings among the tested bots, documented in GAMEPLAY_BALANCING (rules 0.17.2):**
  - Only holding the Moscow road at Valutino to the end wins regularly. With its block standing (D-045), the holding southern envelopment wins 21% of its games, all costly; leaving the Guard at Vitebsk wins decisively in 4.8%. The army at Valutino has outrun its wagon trains and is mostly unfed there (lifting the 80 km line-haul limit changes that in 2 games of 1,000). Every approach that does not hold Valutino ends, at best, in Limited Success.
  - No tested approach has produced a decisive defeat in battle. Russian main armies break in up to 20 battles per 100 games (with the stand order), but never after losing 30% within four days, and none was ever trapped, even by a bot that sets out to pin them (GAMEPLAY_BALANCING, "Pinning"). Counted stage by stage, three pinning bots, two of them planning by search, almost always make a complete plan, but the army is gone before every road is held: around a main army really there, in at most 0.9% of games (D-047).
  - No halt consolidates, at any foraging reach tested, because the placeholder depot stocks cannot feed the army for 20 days. Research on the 1812 magazines is pending.
  - The adaptive policy gains nothing over the best fixed approach.
  - Two of the "competent" bot variants are not yet competent.
- **The foraging reach was corrected** to 11 km (G-019, D-037), after the source turned out to give the widths of foraging squares, not radii.
- **Open measures:** F3 by openings (branch the first two directives with a shared continuation); an adaptive policy that re-decides every turn with the full French observations, with nested resampling of its learning; plausible novice controls for F6. (Scenario-clustered intervals are in the batch since D-041; F3's ties and regret, and variance components that allow for the dice every bot shares on a roll, since D-047.)
- **Most rule values are still game assumptions.** Only march speeds, wagon loads, rations, hunger, horses per wagon and carrying have been checked against sources, and those only as ranges; the foraging reach was misread at first and corrected in 0.12.0.
- **Roads are provisional:** straight-line distance × 1.25 (G-007).
- **Narrow windows, fixed:** at 900 px wide and below, the map no longer stays in view while scrolling, so it no longer slides over the orders panel; the commit button was clear and worked at 901, 900, 899, 768 and 390 px (window 800 px high).
- **The pinning and depot puzzle is explained and gone** (0.18.0, D-046): a forward depot turned the retreat of a corps beaten on Smolensk's north bank. Under the base line the pinning attack ends at the same rank whichever way it keeps its depots, on every seed.

## Scope limits (please don't suggest these)

The first release deliberately has no real-time 3D, no multiplayer, no accounts, no paid AI services and no large backend. Rule values are never tuned just to make the balance targets pass. A change must come from research, a bug, implausible AI or better information for the player.
