# Second independent review: prompt

*Paste everything below the line into the reviewing agent, or point it to this file in the repository.*

---

You are an independent senior reviewer: a game-systems designer, a software engineer and a military-history researcher in one. Your task is a rigorous **second review** of an open-source browser strategy game.

Its first independent review, of commit `1ade716`, found real defects. Since then the developers have worked through that review's plan in stages A to F. Your job is to establish, with evidence, three things:

1. whether those fixes are correct and complete;
2. what they broke or left unsolved;
3. whether the conclusions drawn from the new experiments are sound.

Then say what should happen next. Be candid. A finding that something works, with the evidence, is as valuable as a defect.

## The project

- **Repository:** https://github.com/heinislepping210/the-weight-of-empire (public, branch `main`). Review the latest commit on `main`, at least `58fb761` (rules 0.11.0), and **record the exact commit hash you reviewed**.
- **What it is:** *The Weight of Empire*, a deterministic, historically grounded strategy game about Napoleon's 1812 campaign. Its first release, *The Vitebsk Decision*, is a 7–10 minute command challenge (August 1812, Vitebsk to Smolensk, 10 turns of 2 days). It is written in TypeScript with React, Vite and Vitest; there is no backend, and the engine is pure and resumable.
- **Read first:**
  - `docs/REVIEW_BRIEF.md`: the current state, what changed since the first review, and what is already known.
  - `docs/reviews/2026-10-31-independent-review.md`: every finding of the first review with its status.
  - If the person also gives you the first review's full text, use it.

## Ground rules

1. **Do not modify the repository, open pull requests, push, deploy or use paid services.** Work in a local clone or a scratch directory. Put probes and scripts outside the repository, or delete them afterwards.
2. **Evidence for every finding:**
   - a file and line at the commit you reviewed, a document section, a figure from a report you reproduced, or a minimal reproduction;
   - for each reproduction, the exact steps or script, and what you expected against what you got.
3. **Label every claim** as one of:
   - **Verified**: you ran it, or read the code path end to end;
   - **Inferred**: reasoned from code you did not execute;
   - **Unverified**: you could not check it.

   Say plainly what you could not run or render.
4. **Do not invent precision.**
   - Where a value is unknown, give a plausible range and its source, or say that none was found.
   - For historical claims, cite sources with links, and keep each quotation under 15 words.
5. **Respect the scope limits** in the brief: no real-time 3D, no multiplayer, no accounts, no paid AI services, no large backend. **Never recommend tuning a rule value just to make a balance target pass.** Acceptable fixes are bugs, implausible AI, better information for the player, or researched values within documented ranges.
6. **Severity:**
   - **P0:** crash, data loss, broken determinism or conservation;
   - **P1:** wrong behaviour that changes outcomes or misleads the player;
   - **P2:** lesser defect or clarity problem;
   - **P3:** suggestion.

   Mark each finding **before M2** (before the painted map is built on top) or **later**.

## Setup

Node.js 22 or later.

```
npm ci
npm test
npm run build
```

The normal test suite runs in seconds. The opt-in runs are slower:

| Run | Time | Command |
|---|---|---|
| Balance batch, 9 bots × 1,000 seeds × 3 sets of dice | about 5–10 min | `BALANCE=1 BALANCE_SEEDS=1000 BALANCE_DICE=3 npx vitest run tests/balance/batch.test.ts --silent=false` |
| Paired supply-stance probe | about 2 min | `BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/supply-stance.test.ts --silent=false` |
| Adaptive policy on held-out seeds | about 2 min | `BALANCE=1 BALANCE_SEEDS=1000 npx vitest run tests/balance/adaptive.test.ts --silent=false` |

- **What-if runs** override rule values for one run: `BALANCE_OVERRIDES='{"forage":{"reachMetres":15000}}'`. An unknown name is an error.
- **Reports** print between `*-REPORT-START` and `*-REPORT-END` markers. The committed reports are in `docs/balance/`; first check that yours reproduce them.
- **The prototype:** `npm run dev`, then open http://localhost:5173. If you can drive a browser (for example Playwright with an installed browser), play at least one full campaign through the UI. If you cannot, say so and review the UI from source and data flow.

## What to review

### Part 1. Did the first review's findings get fixed?

For every finding in `docs/reviews/2026-10-31-independent-review.md`, give a verdict: **fixed**, **partly fixed**, **not fixed**, **regressed** or **no longer applies**, each with evidence. At minimum, re-run the first review's own probes:

- The methodical bot on seed 1812. On turn 7, slot 3, are the Guard and the vanguard now inside battle 7.2.0?
- Two opposing columns exchanging the ends of an 8 km road: are there now encounters?
- A halt declared while a standing route is left in place: does the march stop?
- An unfinished saved comparison: does it still reveal hidden Russian information?
- A zero-horse column, a zero-wagon force carrying 600,000 rations, and foraging over a 12 km against a 120 km road.
- The fixed southern directive on seed 1812 after the lead group changes on turn 3.
- The methodical bot on seed 2 with a halt on turn 10, and the evaluator's verdict.
- Whether the batch now fails on an integrity violation. Inject one deliberately in a scratch copy to prove it.

### Part 2. What did the fixes introduce? Audit each stage

Look hardest here: new mechanics are where new defects hide. The questions below are hypotheses to test, not conclusions.

**A. Contacts and timing** (`advance.ts`: `stageMovement`, `moveForce`, `travel`, `joinReinforcements`; `battle.ts`: `fallBack`, `retreatNodeFor`):
- **Order bias.** Forces move in hourly shares, processed in a fixed order within each hour. Is there a French-first bias in near-simultaneous cases? How large is it, measured?
- **The road draw.** It covers only enemies standing at both ends at the start of an hour. Can two columns still pass each other, for example one reaching its end of a road mid-hour while the other sets out? Try to construct a counterexample.
- **Overtaking.** It uses a strict "ahead" test. What happens at equal positions, or with a force that has just retreated onto a road (at 0 m)? Can a pursuer slip past it?
- **Retreating forces** sit in transit at 0 m and are no longer "at" the place. Can that be exploited, by either side or by the Russian command?
- **Reinforcements** fight only from the next daylight sub-step, but retreat with their side if it gives way first. Is that right, and how often does it happen?
- **The two contact invariants:** nobody outside a battle at its place, and no opposing columns heading towards each other on one road. Are they complete? What contact defect could they miss?

**B. Horses, carrying and foraging reach** (`carriage.ts`; `advance.ts`: `leaveBehind`, `feedConvoy`, `issueFromDepots`, `forage`):
- **Capacity.** It is enforced only when a force sets out (a camp may hold more), and stores are shed fodder first. Is that coherent? Is anything lost or duplicated? Check conservation of stores, men, horses and wagons with all the new routes in play.
- **Hoarding.** Wagon trains deliver whatever they carry, whatever the group needs. One batch game ended with the vanguard holding 7.5 days' food while other corps starved. How common is it, and what is the smallest sensible fix?
- **Foraging reach:** "a neighbouring district begins half-way along the road" (reach 22 km, so neighbours within 44 km). Is the abstraction defensible?
- **Depot sharing by need** (`issueFromDepots`). Check the rounding, the order of food, ammunition and fodder, the interaction with capacity, and determinism.

**C. Previews** (`directive.ts`: `planDirective`, `summarizePlan`, `planLogistics`; `src/ui/OrdersPanel.tsx`, `App.tsx`):
- **One plan.** Are the previewed orders always exactly the committed ones?
- **The kept route and the per-group road choice.** By default a far-off group takes its own road when the route would add more than half again to its march. Edge cases?
- **The army summary:** arrival spread, exposed groups, the worst-fed group, horses short of fodder. Is it correct? Is it what a player needs first? What is missing?
- **The food forecast** bounds foraging by the districts on the way. Is it now pessimistic or optimistic, and by how much?

**D. The outcome model** (`outcome.ts`, `tests/engine/outcome.test.ts`):
- **Decisive defeat** counts battle losses in battles the French won within 4 days, using per-force losses recorded in each battle. Are the losses recorded completely and only once?
- **Cut off** is tracked every sub-step at Valutino or Dorogobuzh, with 30,000 men for 2 sub-steps, and once achieved it stands.
  - Can it be gamed by a brief hold?
  - The engine picks the main armies by their current share, the evaluator by their starting share. Can that mismatch matter?
- **Sustainable** is judged per group, including a 2-day forage forecast. Can groups sharing a district double-count it?
- **The table of campaign states.** Which important states are missing from it?

**F. The experiment** (`tests/balance/batch.test.ts`, `adaptive.test.ts`, `bots.ts`):
- **The variance split.** Check the two-way analysis with replication (strategy × scenario seed, with the dice as replicates). Are the sums of squares right? Is the interaction correctly separated from the dice?
- **The dice.** Which random draws use the scenario seed and which the dice (`s.seed` against `s.dice`)? Is the split sensible? Should the scouts' estimate errors be dice rather than scenario?
- **The adaptive policy** chooses once, at the first decision, from two features: own strength and the scouts' reported Russian strength, each in thirds.
  - Is the conclusion justified that the scenario dependence "cannot be read at the first decision"?
  - Which other features are observable at turn 1?
  - How should a per-turn adaptive policy be built and evaluated, without leaking hidden information?
- **Uncertainty.** The report gives no confidence intervals. Which figures need them, and which differences are within noise?
- **The bots.** Do they stand for competent play? The patient push and the supplied halt underperform. Is that the bots, or the rules?

### Part 3. Are the developers' conclusions sound?

`docs/GAMEPLAY_BALANCING.md` (from "Contacts corrected" on) draws conclusions. For each, say **agree**, **partly** or **disagree**, with evidence:

1. The earlier victories were mostly artefacts of the old outcome rules.
2. Under the placeholder battle model no approach can inflict a decisive defeat in battle, and the 30%-in-4-days bar should stay.
3. Only cutting the Moscow road at Valutino wins, so the southern envelopment dominates (best on 73% of seeds).
4. About half the ending's variance is which approach suits which scenario, and a player cannot read it at the first decision, so the design must reveal the hidden factors through information.
5. No halt can consolidate because the placeholder depot stocks cannot feed the army for 20 days.
6. Bait and converge ending in Limited Success about 93% of the time is roughly the historical par.

### Part 4. Historical audit

Check the claims and assumptions added since the first review:
- H-014 to H-017 (attrition before Smolensk, the French supply around Vitebsk, Russian destruction of magazines, stragglers rejoining during halts);
- L-007 to L-011 (living off the land, underfeeding, wagons and draught animals, the fusilier's load, foraging reach);
- G-016 to G-019, and G-004 (the outcome thresholds).

Then do the open research that would most change the game, separating primary, scholarly and popular sources:
- **The French magazines and depots at Vitebsk, Orsha and Mogilev** in late July and August 1812: what they held, in rations or tonnes. This decides whether a halt can be sustained.
- **Corps strengths around 5 August 1812**, reconciled by group (G-010): establishment against present, detachments, and author estimates.
- **The Moscow road east of Smolensk.** Are Valutino (Lubino) and Dorogobuzh the right places for "cut off"? Were there other escape roads for the Russians (the northern detour Barclay took, the Roslavl road)?
- **Casualties in decisive Napoleonic defeats within a few days** (for example Austerlitz, Jena–Auerstedt, Borodino), as a share of the losing army, to test the 30%-in-4-days bar.

### Part 5. Play and experience

- If you can, play **two contrasting plans** on one seed through the UI: for example bait and converge, and the southern envelopment.
  - Before committing each plan, write down what you predict will happen.
  - Afterwards, compare your prediction with the result, and say whether the summary and the dispatches let you understand why.
- **Count the decisions** a campaign asks of you, and how many of them are low-value repeats, such as battle-round prompts. Does the 7–10 minute target look reachable?
- **The one question M1 must answer:** do the dilemmas feel real? The dilemmas are spreading out against concentrating, pushing on against halting, and bringing depots forward against keeping them. Where does the game fail to make a trade-off visible before you commit?

### Part 6. Code and tests

- **Determinism risks.** Any floating point in the engine path? Iteration order? A `Date` dependency? (`Date` should appear only in display dates, in UTC.)
- **Missing tests** for the new mechanics. Which invariants would catch the defects you find?
- **`advance.ts`** is about 900 lines. Is there a safe, worthwhile split? Recommend one only if it pays for itself.
- **Golden replays and rules versions.** Is the discipline sound? Is a real-scenario trace with a per-pause hash worth adding?

## What to deliver

Use this order and these headings:

1. **Summary verdict.** Five to eight sentences: is the simulation now a trustworthy foundation for the painted map (M2)? What must happen before M2, and what can wait?
2. **The five most important findings.** For each: the problem, the evidence (with reproduction), the severity, before M2 or later, and a concrete, minimal fix.
3. **Verification of the first review** (Part 1), as a table: finding, verdict, evidence.
4. **New findings by stage** (Part 2), each with its severity and evidence.
5. **The developers' conclusions** (Part 3): agree, partly or disagree, with reasons.
6. **Historical audit and research** (Part 4): each claim marked verified, disputed, unverified or wrong, with sources and links. Give new values only as ranges, with their sources.
7. **Play report** (Part 5), or a clear statement that you could not play.
8. **Code and tests** (Part 6).
9. **The recommended next phase.** The objective, the files involved, acceptance tests, and what to leave for later.
10. **A handoff for the developers' coding agent**, for that single next phase. A self-contained block that states:
    - the confirmed defects, with reproductions;
    - the rules it must not break: determinism, conservation, save and resume, the information boundary, no tuning to targets;
    - tests to write first, which must fail before the fix;
    - what to run afterwards;
    - what to report back.
11. **Limits of this review:** what you did not run, render or verify.

The first review set a high bar: precise, evidence-backed, fair and actionable. Meet or exceed it.
