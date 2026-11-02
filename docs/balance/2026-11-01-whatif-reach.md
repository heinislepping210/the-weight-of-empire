# What-if runs: foraging reach (rules 0.12.0, seeds 1–1000)

**These are not separate rules.** The second independent review found that Davie's 15, 22 and 30 km (L-011) are the widths of foraging squares, not radii, so a reach that follows the source is a half-width: about 7.5 km in normal operations, 11 km extended, 15 km with the enemy far off. **Adopted: 11 km** (D-037; the batch on the adopted rules is [rules 0.12.0](2026-11-01-rules-0.12.0.md)). Each run laid one value over rules 0.12.0 as it stood before that decision (reach 22 km); one set of dice per scenario, the seed's own, so the runs are directly comparable.

**How the reach works:** a dispersed group forages a neighbouring district when the road to it is at most twice the reach. Of the scenario's 27 roads, that admits 2 at 7.5 km, 3 at 11 km, 8 at 15 km and 11 at 22 km. Most places stand 30–60 km apart (the median road is 53 km).

## Summary

**Won (Decisive Success, Costly Victory or Operational Success)**

| | 7.5 km | 11 km | 15 km | 22 km (before) |
|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 0.0% |
| southern-envelopment | 81.8% | 81.8% | 81.8% | 81.8% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 0.0% |
| methodical | 0.0% | 0.0% | 0.1% | 0.1% |
| rush | 0.0% | 0.0% | 0.0% | 0.0% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 0.0% |

**Repulse**

| | 7.5 km | 11 km | 15 km | 22 km (before) |
|---|---|---|---|---|
| methodical | 36.9% | 36.9% | 29.5% | 30.2% |
| concentrated-push-staged | 56.6% | 56.6% | 56.6% | 56.6% |

**The halts** (every game ends in a Precarious Halt at every reach)

| | 7.5 km | 11 km | 15 km | 22 km (before) |
|---|---|---|---|---|
| prudent-halt: horses lost | 9.4% | 9.4% | 6.4% | 4.7% |
| prudent-halt: food days at end | 2.7 | 2.7 | 3.3 | 4.1 |
| prudent-halt: men lost | 13.3% | 13.3% | 12.0% | 11.4% |
| supplied-halt: horses lost | 11.6% | 11.6% | 9.9% | 8.3% |
| supplied-halt: food days at end | 2.1 | 2.1 | 2.7 | 2.8 |
| supplied-halt: men lost | 13.2% | 13.2% | 12.0% | 11.5% |

**Reading:**
- **The approach families do not depend on the reach.** Every ending moves by under 0.5 points across the range. Their groups march concentrated, and a concentrated group forages only its own district, so the reach rarely applies to them.
- **The methodical bot does, a little:** Repulse in 37% of games at 7.5 or 11 km against 30% at 15 or 22 km. Why has not been traced.
- **The halts pay in horses and food, not in endings.** At 7.5–11 km the prudent halt loses twice the horses it loses at 22 km (9.4% against 4.7%) and ends with 1.4 days less food. Both halts end precarious at every value, so within this range the reach does not decide whether a halt can be held; the placeholder depot stocks remain the open question (G-012, research pending).
- **7.5 km and 11 km give the same results:** the one road that 11 km adds (18 km long) makes no difference in these runs.

## Full reports

### Reach 7.5 km


**What-if run, not the adopted rules.** Overrides: `{"forage":{"reachMetres":7500}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

#### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 92.0% | 0.0% | 0.0% | 0.0% | 1.1% | 6.9% |
| southern-envelopment | 1.1% | 80.3% | 0.4% | 9.1% | 0.0% | 0.0% | 1.0% | 6.4% | 1.7% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 92.7% | 0.0% | 0.0% | 0.3% | 7.0% | 0.0% |
| methodical | 0.0% | 0.0% | 0.0% | 62.7% | 0.0% | 0.0% | 0.2% | 36.9% | 0.2% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 0.0% | 89.4% | 0.0% | 0.0% | 0.0% | 0.8% | 9.8% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 34.4% | 0.0% | 0.0% | 0.4% | 56.6% | 8.6% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.2% | 0.0% | 4.2% | 0.0% | 0.0% | 64.8% | 30.8% | 0.0% |

#### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 29.9% | 28.3% | 25.8% | 98.7% | 4.2 | 387 | 1.9 |
| southern-envelopment | 22.2% | 21.5% | 23.6% | 51.8% | 2.2 | 567 | 1.8 |
| bait-and-converge | 23.0% | 29.6% | 18.7% | 92.7% | 2.4 | 556 | 1.0 |
| methodical | 24.2% | 24.6% | 16.6% | 62.7% | 2.3 | 529 | 0.5 |
| prudent-halt | 13.3% | 9.4% | 10.3% | 0.0% | 0.7 | 810 | 2.7 |
| rush | 27.7% | 30.0% | 25.6% | 98.4% | 3.4 | 442 | 1.1 |
| concentrated-push-staged | 28.9% | 32.4% | 19.0% | 35.5% | 2.5 | 405 | 1.0 |
| supplied-halt | 13.2% | 11.6% | 10.3% | 0.0% | 0.7 | 811 | 2.1 |
| random | 18.1% | 13.7% | 7.9% | 4.2% | 0.5 | 670 | 0.3 |

#### Contacts (means)

| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |
|---|---|---|---|---|---|
| concentrated-push | 4.2 | 14.9 | 1.37 | 0.20 | 2.76 |
| southern-envelopment | 2.2 | 8.4 | 0.68 | 0.12 | 0.53 |
| bait-and-converge | 2.4 | 6.3 | 0.52 | 0.16 | 0.10 |
| methodical | 2.3 | 10.9 | 0.64 | 0.13 | 0.90 |
| prudent-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| rush | 3.4 | 16.7 | 1.40 | 0.14 | 1.74 |
| concentrated-push-staged | 2.5 | 8.3 | 0.65 | 0.09 | 1.09 |
| supplied-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| random | 0.5 | 1.1 | 0.00 | 0.03 | 0.40 |

#### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 86.2% | 834,160 | 613,539 | 102,697 / 32,475 | 5.4% |
| southern-envelopment | 1.00 | 0.02 | 99.9% | 834,001 | 691,669 | 53,532 / 37,484 | 3.3% |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 831,772 | 235 | 29,306 / 59,516 | 10.8% |
| methodical | 1.05 | 0.04 | 33.0% | 810,481 | 80,133 | 72,018 / 75,438 | 11.5% |
| prudent-halt | 2.00 | 0.68 | 0.0% | 418,934 | 16,167 | 43,521 / 39,286 | 13.1% |
| rush | 1.00 | 0.00 | 87.6% | 833,771 | 651,273 | 46,086 / 23,355 | 4.9% |
| concentrated-push-staged | 1.00 | 0.00 | 0.0% | 833,771 | 0 | 25,565 / 59,873 | 8.1% |
| supplied-halt | 1.00 | 0.68 | 0.0% | 418,923 | 16,167 | 43,521 / 39,286 | 19.2% |
| random | 1.83 | 0.14 | 5.3% | 177,232 | 19,121 | 36,169 / 42,179 | 7.5% |

#### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 1.1% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 1.1%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 6.1%, southern-envelopment 85.1%, bait-and-converge 8.8% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 38.6%, by the seed 5.6%, interaction and dice together 55.8% (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.
- **F5:** the prudent halt, declared on the first turn before any victory, ends in: Precarious Halt 100.0% (target: never Decisive Success; a victory won before a later halt stands, D-035).
- **F6:** random play reaches Decisive Success in 0.0% of games (target < 5%).

*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random.*


### Reach 11 km


**What-if run, not the adopted rules.** Overrides: `{"forage":{"reachMetres":11000}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

#### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 92.0% | 0.0% | 0.0% | 0.0% | 1.1% | 6.9% |
| southern-envelopment | 1.1% | 80.3% | 0.4% | 9.1% | 0.0% | 0.0% | 1.0% | 6.4% | 1.7% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 92.7% | 0.0% | 0.0% | 0.3% | 7.0% | 0.0% |
| methodical | 0.0% | 0.0% | 0.0% | 62.7% | 0.0% | 0.0% | 0.2% | 36.9% | 0.2% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 0.0% | 89.4% | 0.0% | 0.0% | 0.0% | 0.8% | 9.8% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 34.4% | 0.0% | 0.0% | 0.4% | 56.6% | 8.6% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.2% | 0.0% | 4.2% | 0.0% | 0.0% | 64.8% | 30.8% | 0.0% |

#### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 29.9% | 28.3% | 25.8% | 98.7% | 4.2 | 387 | 1.9 |
| southern-envelopment | 22.2% | 21.5% | 23.6% | 51.8% | 2.2 | 567 | 1.8 |
| bait-and-converge | 23.0% | 29.6% | 18.7% | 92.7% | 2.4 | 556 | 1.0 |
| methodical | 24.2% | 24.6% | 16.6% | 62.7% | 2.3 | 529 | 0.5 |
| prudent-halt | 13.3% | 9.4% | 10.3% | 0.0% | 0.7 | 810 | 2.7 |
| rush | 27.7% | 30.0% | 25.6% | 98.4% | 3.4 | 442 | 1.1 |
| concentrated-push-staged | 28.9% | 32.4% | 19.0% | 35.5% | 2.5 | 405 | 1.0 |
| supplied-halt | 13.2% | 11.6% | 10.3% | 0.0% | 0.7 | 811 | 2.1 |
| random | 18.0% | 13.5% | 7.9% | 4.2% | 0.5 | 671 | 0.3 |

#### Contacts (means)

| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |
|---|---|---|---|---|---|
| concentrated-push | 4.2 | 14.9 | 1.37 | 0.20 | 2.76 |
| southern-envelopment | 2.2 | 8.4 | 0.68 | 0.12 | 0.53 |
| bait-and-converge | 2.4 | 6.3 | 0.52 | 0.16 | 0.10 |
| methodical | 2.3 | 10.9 | 0.64 | 0.13 | 0.90 |
| prudent-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| rush | 3.4 | 16.7 | 1.40 | 0.14 | 1.74 |
| concentrated-push-staged | 2.5 | 8.3 | 0.65 | 0.09 | 1.09 |
| supplied-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| random | 0.5 | 1.1 | 0.00 | 0.03 | 0.40 |

#### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 86.2% | 834,160 | 613,539 | 102,697 / 32,475 | 5.4% |
| southern-envelopment | 1.00 | 0.02 | 99.9% | 834,001 | 691,669 | 53,532 / 37,484 | 3.3% |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 831,772 | 235 | 29,306 / 59,516 | 10.8% |
| methodical | 1.05 | 0.04 | 33.0% | 810,481 | 80,133 | 72,018 / 75,438 | 11.5% |
| prudent-halt | 2.00 | 0.68 | 0.0% | 418,934 | 16,167 | 43,521 / 39,286 | 13.1% |
| rush | 1.00 | 0.00 | 87.6% | 833,771 | 651,273 | 46,086 / 23,355 | 4.9% |
| concentrated-push-staged | 1.00 | 0.00 | 0.0% | 833,771 | 0 | 25,565 / 59,873 | 8.1% |
| supplied-halt | 1.00 | 0.68 | 0.0% | 418,923 | 16,167 | 43,521 / 39,286 | 19.2% |
| random | 1.83 | 0.14 | 5.3% | 177,232 | 19,116 | 36,170 / 42,237 | 7.5% |

#### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 1.1% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 1.1%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 6.1%, southern-envelopment 85.1%, bait-and-converge 8.8% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 38.6%, by the seed 5.6%, interaction and dice together 55.8% (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.
- **F5:** the prudent halt, declared on the first turn before any victory, ends in: Precarious Halt 100.0% (target: never Decisive Success; a victory won before a later halt stands, D-035).
- **F6:** random play reaches Decisive Success in 0.0% of games (target < 5%).

*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random.*


### Reach 15 km


**What-if run, not the adopted rules.** Overrides: `{"forage":{"reachMetres":15000}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

#### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 91.9% | 0.0% | 0.0% | 0.0% | 1.2% | 6.9% |
| southern-envelopment | 1.1% | 80.3% | 0.4% | 9.1% | 0.0% | 0.0% | 1.0% | 6.4% | 1.7% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 92.7% | 0.0% | 0.0% | 0.3% | 7.0% | 0.0% |
| methodical | 0.0% | 0.0% | 0.1% | 70.1% | 0.0% | 0.0% | 0.2% | 29.5% | 0.1% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 0.0% | 89.4% | 0.0% | 0.0% | 0.0% | 0.8% | 9.8% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 34.4% | 0.0% | 0.0% | 0.4% | 56.6% | 8.6% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.2% | 0.0% | 4.3% | 0.0% | 0.0% | 64.9% | 30.6% | 0.0% |

#### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 29.9% | 28.3% | 25.8% | 98.6% | 4.2 | 387 | 1.9 |
| southern-envelopment | 22.2% | 21.5% | 23.6% | 51.8% | 2.2 | 567 | 1.8 |
| bait-and-converge | 23.0% | 29.6% | 18.7% | 92.7% | 2.4 | 556 | 1.0 |
| methodical | 23.1% | 25.2% | 17.5% | 70.2% | 2.4 | 558 | 0.5 |
| prudent-halt | 12.0% | 6.4% | 11.7% | 0.0% | 0.7 | 837 | 3.3 |
| rush | 27.7% | 30.0% | 25.6% | 98.4% | 3.4 | 442 | 1.1 |
| concentrated-push-staged | 28.9% | 32.4% | 19.0% | 35.5% | 2.5 | 405 | 1.0 |
| supplied-halt | 12.0% | 9.9% | 11.7% | 0.0% | 0.7 | 835 | 2.7 |
| random | 17.4% | 13.1% | 8.1% | 4.3% | 0.5 | 685 | 0.3 |

#### Contacts (means)

| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |
|---|---|---|---|---|---|
| concentrated-push | 4.2 | 14.9 | 1.37 | 0.20 | 2.76 |
| southern-envelopment | 2.2 | 8.4 | 0.68 | 0.12 | 0.53 |
| bait-and-converge | 2.4 | 6.3 | 0.52 | 0.16 | 0.10 |
| methodical | 2.4 | 10.5 | 0.62 | 0.10 | 0.86 |
| prudent-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| rush | 3.4 | 16.7 | 1.40 | 0.14 | 1.74 |
| concentrated-push-staged | 2.5 | 8.3 | 0.65 | 0.09 | 1.09 |
| supplied-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| random | 0.5 | 1.1 | 0.00 | 0.03 | 0.40 |

#### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 86.2% | 834,160 | 613,755 | 102,738 / 32,475 | 5.4% |
| southern-envelopment | 1.00 | 0.02 | 99.9% | 834,001 | 691,676 | 53,532 / 37,484 | 3.3% |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 831,772 | 235 | 29,306 / 59,516 | 10.8% |
| methodical | 1.05 | 0.04 | 32.9% | 810,755 | 81,327 | 73,417 / 76,967 | 6.6% |
| prudent-halt | 2.00 | 0.68 | 0.0% | 424,177 | 15,938 | 59,390 / 74,884 | 12.1% |
| rush | 1.00 | 0.00 | 87.6% | 833,771 | 651,273 | 46,086 / 23,355 | 4.9% |
| concentrated-push-staged | 1.00 | 0.00 | 0.0% | 833,771 | 0 | 25,565 / 59,873 | 8.1% |
| supplied-halt | 1.00 | 0.68 | 0.0% | 424,107 | 15,938 | 59,390 / 74,884 | 15.8% |
| random | 1.83 | 0.14 | 5.4% | 177,642 | 19,136 | 37,068 / 44,779 | 7.4% |

#### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 1.1% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 1.1%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 6.0%, southern-envelopment 85.1%, bait-and-converge 8.9% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 38.8%, by the seed 5.5%, interaction and dice together 55.7% (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.
- **F5:** the prudent halt, declared on the first turn before any victory, ends in: Precarious Halt 100.0% (target: never Decisive Success; a victory won before a later halt stands, D-035).
- **F6:** random play reaches Decisive Success in 0.0% of games (target < 5%).

*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random.*


### Reach 22 km (before)


Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

#### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 91.9% | 0.0% | 0.0% | 0.0% | 1.2% | 6.9% |
| southern-envelopment | 1.1% | 80.3% | 0.4% | 9.1% | 0.0% | 0.0% | 1.0% | 6.4% | 1.7% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 92.7% | 0.0% | 0.0% | 0.3% | 7.0% | 0.0% |
| methodical | 0.0% | 0.0% | 0.1% | 69.4% | 0.0% | 0.0% | 0.2% | 30.2% | 0.1% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 0.0% | 89.4% | 0.0% | 0.0% | 0.0% | 0.8% | 9.8% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 34.4% | 0.0% | 0.0% | 0.4% | 56.6% | 8.6% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.2% | 0.0% | 4.3% | 0.0% | 0.0% | 64.9% | 30.6% | 0.0% |

#### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 29.9% | 28.3% | 25.8% | 98.6% | 4.2 | 387 | 1.9 |
| southern-envelopment | 22.2% | 21.5% | 23.6% | 51.8% | 2.2 | 567 | 1.8 |
| bait-and-converge | 23.0% | 29.6% | 18.7% | 92.7% | 2.4 | 556 | 1.0 |
| methodical | 22.8% | 24.3% | 17.1% | 69.5% | 2.4 | 569 | 0.6 |
| prudent-halt | 11.4% | 4.7% | 10.8% | 0.0% | 0.7 | 848 | 4.1 |
| rush | 27.7% | 30.0% | 25.6% | 98.4% | 3.4 | 442 | 1.1 |
| concentrated-push-staged | 28.9% | 32.4% | 19.0% | 35.5% | 2.5 | 405 | 1.0 |
| supplied-halt | 11.5% | 8.3% | 10.8% | 0.0% | 0.7 | 846 | 2.8 |
| random | 17.1% | 12.6% | 7.9% | 4.3% | 0.5 | 693 | 0.4 |

#### Contacts (means)

| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |
|---|---|---|---|---|---|
| concentrated-push | 4.2 | 14.9 | 1.37 | 0.20 | 2.76 |
| southern-envelopment | 2.2 | 8.4 | 0.68 | 0.12 | 0.53 |
| bait-and-converge | 2.4 | 6.3 | 0.52 | 0.16 | 0.10 |
| methodical | 2.4 | 10.6 | 0.63 | 0.11 | 0.86 |
| prudent-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| rush | 3.4 | 16.7 | 1.40 | 0.14 | 1.74 |
| concentrated-push-staged | 2.5 | 8.3 | 0.65 | 0.09 | 1.09 |
| supplied-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| random | 0.5 | 1.1 | 0.00 | 0.03 | 0.40 |

#### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 86.2% | 834,160 | 613,755 | 102,738 / 32,475 | 5.4% |
| southern-envelopment | 1.00 | 0.02 | 99.9% | 834,001 | 691,676 | 53,532 / 37,484 | 3.3% |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 831,772 | 235 | 29,306 / 59,516 | 10.8% |
| methodical | 1.05 | 0.04 | 32.9% | 810,848 | 80,897 | 73,083 / 79,453 | 5.6% |
| prudent-halt | 2.00 | 0.68 | 0.0% | 424,181 | 15,938 | 66,135 / 78,400 | 11.3% |
| rush | 1.00 | 0.00 | 87.6% | 833,771 | 651,273 | 46,086 / 23,355 | 4.9% |
| concentrated-push-staged | 1.00 | 0.00 | 0.0% | 833,771 | 0 | 25,565 / 59,873 | 8.1% |
| supplied-halt | 1.00 | 0.68 | 0.0% | 424,116 | 15,938 | 66,135 / 78,400 | 15.1% |
| random | 1.83 | 0.14 | 5.4% | 177,802 | 19,150 | 37,470 / 45,622 | 7.3% |

#### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 1.1% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 1.1%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 6.0%, southern-envelopment 85.1%, bait-and-converge 8.9% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 38.7%, by the seed 5.5%, interaction and dice together 55.8% (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.
- **F5:** the prudent halt, declared on the first turn before any victory, ends in: Precarious Halt 100.0% (target: never Decisive Success; a victory won before a later halt stands, D-035).
- **F6:** random play reaches Decisive Success in 0.0% of games (target < 5%).

*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random.*

