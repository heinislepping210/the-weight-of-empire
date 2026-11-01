# Independent review of 31 October 2026: record and status

An outside AI reviewer assessed commit `1ade716` (rules 0.7.0, milestone M1) from [REVIEW_BRIEF](../REVIEW_BRIEF.md). It ran the tests, the production build and the 1,000-seed batch, plus its own probes. The full review was received in the project chat. This file records each finding, our assessment and its status, so later decisions can be traced back to it.

**The reviewer's verdict, in short:**
- **Strengths:** a genuine simulation and a playable technical prototype, with a sound pure-engine architecture and candid assumption records.
- **Not yet shown:** that M1 has passed its "fun" gate.
- **The main risk:** the project had more evidence of accounting consistency than of operational correctness. Contacts and reinforcement should be fixed before anything is built on top.
- **Its stages:** contacts (A), logistics causality (B), trustworthy previews and information (C), the outcome evaluator and the halt (D), real saves (E), the balance experiment (F), and a fresh playtest before the living map (G).

**Our assessment:** accurate and well evidenced. The headline defects were reproduced independently before any change, including the exact case the reviewer named: methodical bot, seed 1812, the Guard and the vanguard outside battle 7.2.0 on turn 7.

## Status of each finding

| Finding | Stage | Status |
|---|---|---|
| Forces arriving at an active battle stay outside it | A | **Fixed in rules 0.8.0** (D-031). Reinforcements of either side join at the contacts boundary and fight from the next sub-step |
| Opposing columns can exchange places on one road without contact | A | **Fixed in 0.8.0.** Movement is hourly, no setting out against an oncoming column, a seeded draw for simultaneous starts, and no overtaking |
| Withdrawals and retreats are instant, even over 80–90 km | A | **Fixed in 0.8.0.** A force falling back leaves onto the road and marches the rest |
| A halt leaves standing routes running for groups given no new orders | D | **Fixed in 0.8.0.** The halt clears every French standing route |
| Unfinished saved comparisons reveal Russian plans and positions | C | **Fixed in 0.8.0.** True Russian strength is withheld too, both when saving and when showing |
| The batch prints invariant violations but never fails | F | **Fixed.** Integrity is now a gate; fairness diagnostics stay diagnostic |
| Fodder-only shortfalls produce no dispatch | — | **Fixed.** Food and fodder shortfalls are logged separately, with the horses that died |
| "Save run" saves only a summary | E | **Renamed** "Save for comparison". Real saves stay an M3 criterion |
| Documents disagree with themselves or describe unbuilt features in the present tense | — | **Corrected:** the roadmap's M1 status, autosave and straggler return (now marked as not built), the T10 wording, and the claim that speed preserves captured stores |
| Horses do not limit transport or speed; carried stock has no limit; foraging reaches any neighbouring place whatever the distance | B | Open: next foundation work. New values to be labelled assumptions with sensitivity runs |
| Group overrides do not update the forecast or the map; a chosen route can silently switch when the lead group changes | C | Open |
| The evaluator counts all Russian losses as "decisive defeat" without the 4-day battle window of §2.13; "sustainable" is only food in hand; per-group shortages are hidden; a late halt can end in Decisive Success | D | Open. Whether a victory earned before a late halt should stand is **a design decision for the project owner.** Our view is that it should, with "cut off" required to hold for some time rather than only on the last day |
| Stored versions are not checked on load or replay | E | Open, with real saves. A golden replay on the real scenario was added in 0.8.0 |
| The captured-store burn share does not depend on time | — | Documentation corrected. The mechanism is unchanged: either describe it as uncertain residual stores or model the destruction over time. Still to decide |
| No road capacity or column length | M2 | Open, as planned for the living map |
| F1–F6 test narrower claims than their names. F4 cannot separate skill from luck with one deterministic run per strategy and seed; the random control uses a fixed choice seed; every bot brings depots forward | F | Open. The bots that do not concentrate before attacking now understate their approaches (GAMEPLAY_BALANCING.md, contacts corrected) |
| Russian strikes count armies that cannot arrive in time | later | Open: a time-to-concentrate check, after the contact fix |
| Losses are not tagged by force and cause for a future after-action report | later | Open |
| The orders panel lacks an army-level summary (arrival spread, exposed groups, worst bottleneck) | C | Open |
| 9–18 battle decisions per advancing game may not fit 7–10 minutes | G | Open: to be judged in playtests |
| The hunger value of 30 is a modelling judgment, not a measured constant | — | Agreed. The wording is corrected in the README; the register already labels it a game assumption |
| The cited Clausewitz PDF includes modern editorial material with its own notices | release | Citation only; check all shipped notices before release |
