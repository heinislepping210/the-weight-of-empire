# Review Brief

For an outside reviewer, human or AI, asked to give feedback on the project as it stands (31 October 2026, rules 0.7.0, milestone M1). It says what exists, where to look, what kind of feedback helps, and what is already known to be missing, so the review can go beyond it.

## What the project is

*The Weight of Empire* is a browser strategy game about Napoleon's 1812 campaign. The first release, *The Vitebsk Decision*, is a 7–10 minute command challenge.
- **The situation:** August 1812. The Grande Armée stands around Vitebsk, and the united Russian armies hold Smolensk.
- **The player's job:** decide whether and how to advance, over 10 turns of 2 days.
- **What decides the outcome:** supply, fatigue, posture, intelligence and a responsive Russian command.
- **The aim:** historically grounded, replayable and fair. Strategy should matter more than luck, and every number is either sourced or openly labelled as a game assumption.

## What exists now

- **A deterministic, resumable simulation** (TypeScript, no backend): four daylight sub-steps and two nights per turn, with integer arithmetic and counter-based randomness. A game can be saved and resumed at any pause, battles included.
- **Supply by weight:** depots, wagon trains, line trains and foraging. Dispersal feeds an army, but it must gather before it can fight. Captured stores are partly burned, and depots can be founded forward.
- **A Russian command** that acts on its own scouting, with seeded political pressure and temperament.
- **Army directives:** one directive becomes orders for every group, each shown with its reasons before committing.
- **A provisional outcome evaluator** with nine endings, and a final halt for the season.
- **Seven strategy bots** and a 1,000-seed balance batch with invariant checks. The batch can also run with tried-out rule values ("what-if" runs).
- **A plain prototype screen:** an SVG map, the orders panel, battle decisions, dispatches, and side-by-side comparison of saved runs.

## Where to start

1. [README](../README.md), then [PROJECT_VISION](PROJECT_VISION.md): the goals and the scope limits.
2. [GAME_DESIGN_DOCUMENT](GAME_DESIGN_DOCUMENT.md) §2: the design. §2.4b covers directives, §2.6 logistics and §2.13 outcomes.
3. [GAMEPLAY_BALANCING](GAMEPLAY_BALANCING.md), the last three sections, with the reports in [balance/](balance/). The latest is [rules 0.7.0](balance/2026-10-31-rules-0.7.0.md).
4. [HISTORICAL_RESEARCH](HISTORICAL_RESEARCH.md) and [HISTORICAL_ASSUMPTIONS](HISTORICAL_ASSUMPTIONS.md): the sources and the status of every claim (H-, L- and G- entries).
5. Code:
   - `src/engine/advance.ts`: turn resolution.
   - `src/engine/directive.ts`: the staff planner.
   - `src/engine/rules.ts`: every rule value.
   - `src/data/vitebsk/`: the scenario.
   - `tests/`: tests, bots and the batch.
6. [DECISIONS](DECISIONS.md): why things are the way they are.

**To run it** (Node.js 22 or later): `npm install`, `npm test`, then `npm run dev` and open http://localhost:5173. The balance batch takes about 90 seconds: `BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/batch.test.ts`.

## Feedback that helps most

Please give your **five most important points first**. For each one:
- what the problem is;
- the evidence: a file and line, a document section, or a number from a report;
- a concrete suggestion.

Mark each point **"before M2"** (before the living map is built) or **"later"**. Useful questions:

1. **Design:** are the core dilemmas real and clear? These are spreading out against concentrating, pushing on against halting, and bringing the depots forward against keeping them. Does the outcome model reward the right things?
2. **History:** is anything wrong, overstated or missing? Better sources are especially welcome for the open items: Russian strengths by group, the French depot intervals and transport battalions of 1812, and how stores were burned at Smolensk.
3. **Balance method:** are the F1–F6 diagnostics sound? How should "strategy matters more than the seed" (F4) be measured when the best approach depends on the seed? Do the bots stand for real approaches?
4. **Architecture and tests:** any risks in the determinism, the resumable state machine or the test coverage before the map and battle work begins?
5. **Readability:** can a player follow the staff's orders and reasons on the prototype screen?

## Already known (no need to report, but ideas are welcome)

- **The map is a plain debug map.** The painted living map is the next milestone (M2).
- **Battles are abstract rounds.** Battlefield templates, events and the after-action report are not built.
- **Many rule values are still placeholders** (G-006). Only march speeds, wagon loads, rations and hunger have been checked against sources.
- **F4 fails on rules 0.7.0:** the strategy explains 10% of the variance in the ending, the seed 19%. The measure lacks a best-response view and battle-dice re-rolls.
- **Decisive Success is rare** (about 2% per approach). It hinges on the provisional threshold that the Russian main armies lose 30% (G-004).
- **The depot chain stops at the first new depot (Liozno),** and stragglers do not rejoin during halts (H-017).
- **Roads are provisional:** straight-line distance × 1.25 (G-007), until traced on period maps.

## Scope limits (please don't suggest these)

The first release deliberately has no real-time 3D, no multiplayer, no accounts, no paid AI services and no large backend. Rule values are never tuned just to make the balance targets pass. A change must come from research, a bug, implausible AI or better information for the player.
