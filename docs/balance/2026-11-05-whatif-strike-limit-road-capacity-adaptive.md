# Adaptive policy on held-out seeds: rules 0.20.0 (what-if: `{"russian":{"strikeMarchMetres":85000},"march":{"columnMetresPerThousand":230}}`), seeds 1–1000

Candidates: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, southern-envelopment-hold, southern-envelopment-wait-for-trains, southern-envelopment-guard-at-base, concentrated-strike, pinning-attack, pinning-attack-search, pinning-fix-first, supplied-halt. The adaptive policy picks one at the first decision from two things the French see: their own strength and the Russians their scouts report (each in thirds), learned on seeds 1–500 and judged on seeds 501–1000. Each scenario is played with 3 sets of dice and scored by its mean rank over them. A lower rank is better; "won" means Decisive Success, Costly Victory or Operational Success, over every game.

| Policy on the held-out seeds | Mean ending rank | Against the best fixed approach (middle 95% of 200 bootstrap redraws) | Won |
|---|---|---|---|
| Best fixed approach, chosen on the training seeds (southern-envelopment-guard-at-base) | 2.76 | — | 68.5% |
| Adaptive: reads strength and scouting reports | 2.79 | +0.04 (-0.01 to 0.07) | 61.8% |
| Scenario oracle: chooses on a scenario's other rolls, so it knows the scenario but not the dice it is scored on | 2.51 | -0.24 (-0.32 to -0.17) | 55.8% |
| Full oracle: knows the dice too (includes luck no player can read) | 2.20 | -0.56 (-0.61 to -0.49) | 72.3% |

| Each approach on the held-out seeds | Mean ending rank | Most common ending |
|---|---|---|
| concentrated-push | 3.05 | Limited Success (97.9%) |
| southern-envelopment | 3.51 | Limited Success (51.1%) |
| bait-and-converge | 3.14 | Limited Success (88.7%) |
| methodical | 3.08 | Limited Success (95.3%) |
| prudent-halt | 4.00 | Precarious Halt (100.0%) |
| rush | 3.06 | Limited Success (97.9%) |
| concentrated-push-staged | 3.29 | Limited Success (82.1%) |
| southern-envelopment-hold | 2.82 | Costly Victory (65.7%) |
| southern-envelopment-wait-for-trains | 3.47 | Inconclusive (32.3%) |
| southern-envelopment-guard-at-base | 2.76 | Costly Victory (59.5%) |
| concentrated-strike | 3.90 | Inconclusive (40.1%) |
| pinning-attack | 3.99 | Limited Success (50.0%) |
| pinning-attack-search | 3.71 | Limited Success (64.6%) |
| pinning-fix-first | 3.70 | Limited Success (65.0%) |
| supplied-halt | 4.00 | Precarious Halt (100.0%) |

Choices learned per cell (own strength third × scouted Russian strength third): 00: southern-envelopment-guard-at-base; 01: southern-envelopment-guard-at-base; 02: southern-envelopment-guard-at-base; 10: southern-envelopment-guard-at-base; 11: southern-envelopment-guard-at-base; 12: concentrated-push; 20: southern-envelopment-guard-at-base; 21: southern-envelopment-guard-at-base; 22: southern-envelopment-hold.

**Reading:** a perfect reader of the scenario could improve on the best fixed approach by 0.24 ranks on average (knowing the dice as well, by 0.56); this adaptive policy, reading two figures at the first decision, captures -0.04. That bounds what this policy can read, not what a player can.

*The intervals redraw the held-out scenarios only; they do not repeat the learning on the training seeds, so they understate the uncertainty of the learned choices.*
