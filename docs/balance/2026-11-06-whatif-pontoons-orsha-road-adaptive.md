# Adaptive policy on held-out seeds: rules 0.22.0 (what-if: `{"pontoons":{"bridgeSlots":2}}`), seeds 1–1000

**The train starts at Orsha. The southern plans go by the Orsha road and its bridge (`BALANCE_CORRIDOR=Orsha`).**

Candidates: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, southern-envelopment-hold, southern-envelopment-wait-for-trains, southern-envelopment-guard-at-base, concentrated-strike, pinning-attack, pinning-attack-search, pinning-fix-first, supplied-halt. The adaptive policy picks one at the first decision from two things the French see: their own strength and the Russians their scouts report (each in thirds), learned on seeds 1–500 and judged on seeds 501–1000. Each scenario is played with 3 sets of dice and scored by its mean rank over them. A lower rank is better; "won" means Decisive Success, Costly Victory or Operational Success, over every game.

| Policy on the held-out seeds | Mean ending rank | Against the best fixed approach (middle 95% of 200 bootstrap redraws) | Won |
|---|---|---|---|
| Best fixed approach, chosen on the training seeds (rush) | 3.06 | — | 0.0% |
| Adaptive: reads strength and scouting reports | 3.07 | +0.01 (-0.03 to 0.04) | 5.0% |
| Scenario oracle: chooses on a scenario's other rolls, so it knows the scenario but not the dice it is scored on | 2.62 | -0.43 (-0.50 to -0.38) | 50.7% |
| Full oracle: knows the dice too (includes luck no player can read) | 2.29 | -0.77 (-0.81 to -0.72) | 67.9% |

| Each approach on the held-out seeds | Mean ending rank | Most common ending |
|---|---|---|
| concentrated-push | 3.05 | Limited Success (97.9%) |
| southern-envelopment | 3.34 | Limited Success (69.1%) |
| bait-and-converge | 3.14 | Limited Success (88.7%) |
| methodical | 3.08 | Limited Success (95.3%) |
| prudent-halt | 4.00 | Precarious Halt (100.0%) |
| rush | 3.06 | Limited Success (97.9%) |
| concentrated-push-staged | 3.28 | Limited Success (82.1%) |
| southern-envelopment-hold | 3.36 | Costly Victory (45.3%) |
| southern-envelopment-wait-for-trains | 3.01 | Costly Victory (50.8%) |
| southern-envelopment-guard-at-base | 3.38 | Repulse (42.5%) |
| concentrated-strike | 3.99 | Limited Success (35.3%) |
| pinning-attack | 3.99 | Limited Success (50.1%) |
| pinning-attack-search | 3.69 | Limited Success (65.6%) |
| pinning-fix-first | 3.57 | Limited Success (71.5%) |
| supplied-halt | 4.00 | Precarious Halt (100.0%) |

Choices learned per cell (own strength third × scouted Russian strength third): 00: rush; 01: rush; 02: methodical; 10: rush; 11: southern-envelopment-wait-for-trains; 12: concentrated-push; 20: methodical; 21: concentrated-push; 22: rush.

**Reading:** a perfect reader of the scenario could improve on the best fixed approach by 0.43 ranks on average (knowing the dice as well, by 0.77); this adaptive policy, reading two figures at the first decision, captures -0.01. That bounds what this policy can read, not what a player can.

*The intervals redraw the held-out scenarios only; they do not repeat the learning on the training seeds, so they understate the uncertainty of the learned choices.*
