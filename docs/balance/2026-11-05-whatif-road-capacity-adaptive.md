# Adaptive policy on held-out seeds: rules 0.20.0 (what-if: `{"march":{"columnMetresPerThousand":230}}`), seeds 1–1000

Candidates: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, southern-envelopment-hold, southern-envelopment-wait-for-trains, southern-envelopment-guard-at-base, concentrated-strike, pinning-attack, pinning-attack-search, pinning-fix-first, supplied-halt. The adaptive policy picks one at the first decision from two things the French see: their own strength and the Russians their scouts report (each in thirds), learned on seeds 1–500 and judged on seeds 501–1000. Each scenario is played with 3 sets of dice and scored by its mean rank over them. A lower rank is better; "won" means Decisive Success, Costly Victory or Operational Success, over every game.

| Policy on the held-out seeds | Mean ending rank | Against the best fixed approach (middle 95% of 200 bootstrap redraws) | Won |
|---|---|---|---|
| Best fixed approach, chosen on the training seeds (southern-envelopment-guard-at-base) | 2.35 | — | 84.8% |
| Adaptive: reads strength and scouting reports | 2.35 | +0.00 (0.00 to 0.00) | 84.8% |
| Scenario oracle: chooses on a scenario's other rolls, so it knows the scenario but not the dice it is scored on | 2.22 | -0.12 (-0.18 to -0.06) | 78.3% |
| Full oracle: knows the dice too (includes luck no player can read) | 2.05 | -0.29 (-0.34 to -0.23) | 86.7% |

| Each approach on the held-out seeds | Mean ending rank | Most common ending |
|---|---|---|
| concentrated-push | 3.05 | Limited Success (97.9%) |
| southern-envelopment | 3.14 | Limited Success (38.5%) |
| bait-and-converge | 3.25 | Limited Success (83.4%) |
| methodical | 3.15 | Limited Success (91.8%) |
| prudent-halt | 4.00 | Precarious Halt (100.0%) |
| rush | 3.06 | Limited Success (97.9%) |
| concentrated-push-staged | 3.43 | Limited Success (75.9%) |
| southern-envelopment-hold | 2.45 | Costly Victory (81.7%) |
| southern-envelopment-wait-for-trains | 2.61 | Costly Victory (68.6%) |
| southern-envelopment-guard-at-base | 2.35 | Costly Victory (77.7%) |
| concentrated-strike | 3.90 | Inconclusive (40.1%) |
| pinning-attack | 3.99 | Limited Success (50.2%) |
| pinning-attack-search | 3.84 | Limited Success (57.8%) |
| pinning-fix-first | 3.82 | Limited Success (58.9%) |
| supplied-halt | 4.00 | Precarious Halt (100.0%) |

Choices learned per cell (own strength third × scouted Russian strength third): 00: southern-envelopment-guard-at-base; 01: southern-envelopment-guard-at-base; 02: southern-envelopment-guard-at-base; 10: southern-envelopment-guard-at-base; 11: southern-envelopment-guard-at-base; 12: southern-envelopment-guard-at-base; 20: southern-envelopment-guard-at-base; 21: southern-envelopment-guard-at-base; 22: southern-envelopment-guard-at-base.

**Reading:** a perfect reader of the scenario could improve on the best fixed approach by 0.12 ranks on average (knowing the dice as well, by 0.29); this adaptive policy, reading two figures at the first decision, captures 0.00. That bounds what this policy can read, not what a player can.

*The intervals redraw the held-out scenarios only; they do not repeat the learning on the training seeds, so they understate the uncertainty of the learned choices.*
