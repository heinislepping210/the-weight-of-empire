# What-if runs: hunger and foraging (rules 0.6.0 with overrides, seeds 1–1000)

**These are not the adopted rules.** Each run lays one set of rule values over rules 0.6.0 for that run only (`BALANCE_OVERRIDES`, see `tests/balance/batch.test.ts`). The values tested span the plausible range from the hunger research (HISTORICAL_RESEARCH.md; G-017). The proposed value, 30 a day, was fixed from the evidence before these runs. The runs show how sensitive the outcome is; they do not choose the value.

## Summary

Cohesion loss at a full food shortfall, per day: 100 is the adopted rules 0.6.0. The last column also raises foraging on the march from 0.2 to 0.5 rations a man a day, the top of its plausible range.

**Operational Collapse**

| Strategy | 100 (adopted) | 50 | **30 (proposed)** | 25 | 30, forage 0.5 |
|---|---|---|---|---|---|
| concentrated-push | 84.7% | 9.1% | 0.3% | 0.0% | 0.0% |
| southern-envelopment | 76.2% | 13.9% | 0.7% | 0.7% | 0.3% |
| bait-and-converge | 44.1% | 9.9% | 2.6% | 0.8% | 0.7% |
| methodical | 18.7% | 0.9% | 0.0% | 0.0% | 0.0% |
| rush | 91.8% | 12.6% | 5.8% | 3.6% | 3.5% |

**Decisive Success or Costly Victory**

| Strategy | 100 (adopted) | 50 | **30 (proposed)** | 25 | 30, forage 0.5 |
|---|---|---|---|---|---|
| concentrated-push | 0.0% | 9.6% | 34.3% | 37.0% | 37.4% |
| southern-envelopment | 0.7% | 5.1% | 11.2% | 12.1% | 14.9% |
| bait-and-converge | 2.3% | 36.1% | 64.0% | 66.8% | 68.5% |
| methodical | 34.3% | 45.3% | 48.8% | 48.8% | 48.8% |
| rush | 0.0% | 17.1% | 25.7% | 27.2% | 26.3% |

**French cohesion at the end (mean, out of 1,000)**

| Strategy | 100 (adopted) | 50 | **30 (proposed)** | 25 | 30, forage 0.5 |
|---|---|---|---|---|---|
| concentrated-push | 158 | 397 | 548 | 588 | 628 |
| southern-envelopment | 146 | 390 | 555 | 597 | 645 |
| bait-and-converge | 231 | 392 | 538 | 578 | 588 |
| methodical | 342 | 543 | 645 | 674 | 679 |

**Fairness diagnostics**

| | 100 (adopted) | 50 | **30 (proposed)** | 25 | 30, forage 0.5 |
|---|---|---|---|---|---|
| F1: a family reaches Decisive Success | 0.0% | 0.0% | 5.5% | 5.9% | 4.2% |
| F4: variance explained by strategy / seed | 57% / 8% | 14% / 17% | 10% / 19% | 12% / 18% | 10% / 18% |
| F5 and F6 | hold | hold | hold | hold | hold |
| Invariant violations | 0 | 0 | 0 | 0 | 0 |

The full reports follow.

---

## Cohesion loss 50 a day

**What-if run, not the adopted rules.** Overrides: `{"attrition":{"cohesionLossAtFullShortfall":50}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 9.6% | 0.1% | 80.1% | 0.0% | 0.0% | 0.0% | 1.1% | 9.1% |
| southern-envelopment | 0.0% | 5.1% | 5.1% | 38.9% | 0.0% | 0.0% | 13.2% | 23.8% | 13.9% |
| bait-and-converge | 0.0% | 36.1% | 0.0% | 18.9% | 0.0% | 0.0% | 0.0% | 35.1% | 9.9% |
| methodical | 2.5% | 42.8% | 1.7% | 44.5% | 0.0% | 0.0% | 5.6% | 2.0% | 0.9% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 17.1% | 0.0% | 69.3% | 0.0% | 0.0% | 0.0% | 1.0% | 12.6% |
| random | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 81.1% | 18.9% | 0.0% |

### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 22.8% | 28.8% | 24.6% | 96.1% | 2.2 | 397 | 0.6 |
| southern-envelopment | 21.9% | 20.5% | 16.2% | 50.5% | 1.7 | 390 | 1.2 |
| bait-and-converge | 23.3% | 28.0% | 16.2% | 55.8% | 2.5 | 392 | 1.0 |
| methodical | 18.7% | 20.0% | 15.4% | 91.4% | 1.7 | 543 | 0.9 |
| prudent-halt | 8.7% | 0.0% | 10.7% | 0.0% | 0.8 | 892 | 5.1 |
| rush | 23.6% | 30.2% | 23.4% | 97.0% | 3.1 | 383 | 0.5 |
| random | 15.4% | 9.0% | 7.3% | 0.0% | 0.2 | 613 | 0.9 |

### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) |
|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 93.6% | 833,771 | 653,832 |
| southern-envelopment | 1.00 | 0.04 | 95.3% | 833,771 | 506,569 |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 833,771 | 0 |
| methodical | 1.00 | 0.00 | 84.2% | 817,451 | 292,774 |
| prudent-halt | 2.00 | 0.68 | 0.0% | 423,853 | 15,850 |
| rush | 1.00 | 0.01 | 95.6% | 833,952 | 671,561 |
| random | 2.98 | 0.00 | 0.0% | 0 | 0 |

### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 0.0% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 0.0%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 37.3%, southern-envelopment 18.8%, bait-and-converge 43.9% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 13.6%, by the seed 16.5%, interaction and noise 69.9% (target: strategy above seed). Re-rolling battle dice alone is not yet possible.
- **F5:** prudent halt endings: Successful Consolidation 100.0% (target: never Decisive Success).
- **F6:** random play reaches Decisive Success on 0.0% of seeds (target < 5%).

---

## Cohesion loss 30 a day (proposed)

**What-if run, not the adopted rules.** Overrides: `{"attrition":{"cohesionLossAtFullShortfall":30}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 1.7% | 32.6% | 0.7% | 64.3% | 0.0% | 0.0% | 0.0% | 0.4% | 0.3% |
| southern-envelopment | 1.8% | 9.4% | 12.6% | 33.1% | 0.0% | 0.0% | 23.5% | 18.9% | 0.7% |
| bait-and-converge | 2.0% | 62.0% | 0.0% | 19.5% | 0.0% | 0.0% | 2.6% | 11.3% | 2.6% |
| methodical | 5.0% | 43.8% | 1.9% | 41.6% | 0.0% | 0.0% | 5.6% | 2.1% | 0.0% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.1% | 25.6% | 0.5% | 66.5% | 0.0% | 0.0% | 0.0% | 1.5% | 5.8% |
| random | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 81.2% | 18.8% | 0.0% |

### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 23.1% | 29.0% | 26.3% | 98.8% | 2.2 | 548 | 0.6 |
| southern-envelopment | 22.5% | 20.6% | 17.1% | 46.1% | 1.7 | 555 | 1.2 |
| bait-and-converge | 23.8% | 28.0% | 18.0% | 83.4% | 2.6 | 538 | 1.1 |
| methodical | 19.5% | 19.9% | 16.7% | 92.2% | 1.8 | 645 | 1.0 |
| prudent-halt | 8.7% | 0.0% | 10.7% | 0.0% | 0.8 | 907 | 5.1 |
| rush | 23.7% | 30.3% | 24.1% | 96.7% | 3.2 | 534 | 0.5 |
| random | 15.4% | 9.0% | 7.3% | 0.0% | 0.2 | 730 | 0.9 |

### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) |
|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 94.6% | 833,771 | 656,422 |
| southern-envelopment | 1.00 | 0.03 | 93.6% | 833,771 | 505,387 |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 833,771 | 0 |
| methodical | 1.00 | 0.00 | 83.9% | 817,451 | 290,264 |
| prudent-halt | 2.00 | 0.68 | 0.0% | 423,853 | 15,850 |
| rush | 1.00 | 0.01 | 94.4% | 833,952 | 670,572 |
| random | 2.98 | 0.00 | 0.0% | 0 | 0 |

### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 5.5% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 1.7%, southern-envelopment 1.8%, bait-and-converge 2.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 31.0%, southern-envelopment 16.2%, bait-and-converge 52.8% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 10.1%, by the seed 19.0%, interaction and noise 70.9% (target: strategy above seed). Re-rolling battle dice alone is not yet possible.
- **F5:** prudent halt endings: Successful Consolidation 100.0% (target: never Decisive Success).
- **F6:** random play reaches Decisive Success on 0.0% of seeds (target < 5%).

---

## Cohesion loss 25 a day

**What-if run, not the adopted rules.** Overrides: `{"attrition":{"cohesionLossAtFullShortfall":25}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 1.8% | 35.2% | 0.5% | 62.3% | 0.0% | 0.0% | 0.0% | 0.2% | 0.0% |
| southern-envelopment | 2.2% | 9.9% | 11.8% | 33.2% | 0.0% | 0.0% | 25.4% | 16.8% | 0.7% |
| bait-and-converge | 2.0% | 64.8% | 0.0% | 19.6% | 0.0% | 0.0% | 2.5% | 10.3% | 0.8% |
| methodical | 5.0% | 43.8% | 1.7% | 41.7% | 0.0% | 0.0% | 5.6% | 2.2% | 0.0% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.1% | 27.1% | 0.5% | 67.4% | 0.0% | 0.0% | 0.0% | 1.3% | 3.6% |
| random | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 81.2% | 18.8% | 0.0% |

### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 23.2% | 29.0% | 26.6% | 99.1% | 2.2 | 588 | 0.6 |
| southern-envelopment | 22.6% | 20.6% | 17.3% | 46.2% | 1.7 | 597 | 1.3 |
| bait-and-converge | 23.9% | 28.0% | 18.3% | 86.3% | 2.6 | 578 | 1.1 |
| methodical | 19.5% | 20.0% | 16.9% | 92.1% | 1.8 | 674 | 1.0 |
| prudent-halt | 8.7% | 0.0% | 10.7% | 0.0% | 0.8 | 911 | 5.1 |
| rush | 23.8% | 30.3% | 24.2% | 97.4% | 3.2 | 573 | 0.5 |
| random | 15.4% | 9.0% | 7.3% | 0.0% | 0.2 | 759 | 0.9 |

### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) |
|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 94.4% | 833,771 | 655,915 |
| southern-envelopment | 1.00 | 0.03 | 94.0% | 833,771 | 506,423 |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 833,771 | 0 |
| methodical | 1.00 | 0.00 | 83.9% | 817,451 | 290,818 |
| prudent-halt | 2.00 | 0.68 | 0.0% | 423,853 | 15,850 |
| rush | 1.00 | 0.01 | 94.4% | 833,952 | 670,319 |
| random | 2.98 | 0.00 | 0.0% | 0 | 0 |

### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 5.9% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 1.8%, southern-envelopment 2.2%, bait-and-converge 2.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 30.6%, southern-envelopment 15.5%, bait-and-converge 53.9% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 11.8%, by the seed 18.0%, interaction and noise 70.2% (target: strategy above seed). Re-rolling battle dice alone is not yet possible.
- **F5:** prudent halt endings: Successful Consolidation 100.0% (target: never Decisive Success).
- **F6:** random play reaches Decisive Success on 0.0% of seeds (target < 5%).

---

## Cohesion loss 30 a day, foraging on the march 0.5

**What-if run, not the adopted rules.** Overrides: `{"attrition":{"cohesionLossAtFullShortfall":30},"forage":{"food":{"halt":300,"gather":200,"march":250}}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.7% | 36.7% | 0.8% | 61.3% | 0.0% | 0.0% | 0.1% | 0.4% | 0.0% |
| southern-envelopment | 1.6% | 13.3% | 11.8% | 34.3% | 0.0% | 0.0% | 29.6% | 9.1% | 0.3% |
| bait-and-converge | 2.0% | 66.5% | 0.0% | 18.7% | 0.0% | 0.0% | 2.5% | 9.6% | 0.7% |
| methodical | 6.0% | 42.8% | 2.0% | 41.8% | 0.0% | 0.0% | 5.6% | 1.8% | 0.0% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.3% | 26.0% | 0.4% | 69.0% | 0.0% | 0.0% | 0.1% | 0.7% | 3.5% |
| random | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 80.8% | 19.2% | 0.0% |

### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 20.0% | 29.0% | 26.7% | 99.4% | 2.2 | 628 | 0.5 |
| southern-envelopment | 18.9% | 20.4% | 17.7% | 47.3% | 1.6 | 645 | 1.2 |
| bait-and-converge | 21.9% | 28.0% | 18.1% | 87.1% | 2.6 | 588 | 1.0 |
| methodical | 18.1% | 19.9% | 16.9% | 92.5% | 1.8 | 679 | 1.0 |
| prudent-halt | 8.8% | 0.0% | 10.4% | 0.0% | 0.8 | 906 | 5.1 |
| rush | 21.4% | 30.4% | 24.3% | 97.8% | 3.2 | 594 | 0.4 |
| random | 14.1% | 9.0% | 7.4% | 0.0% | 0.2 | 767 | 0.7 |

### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) |
|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 94.0% | 833,771 | 655,034 |
| southern-envelopment | 1.00 | 0.03 | 95.0% | 833,771 | 535,030 |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 833,771 | 0 |
| methodical | 1.00 | 0.00 | 84.2% | 810,442 | 296,427 |
| prudent-halt | 2.00 | 0.68 | 0.0% | 423,801 | 15,850 |
| rush | 1.00 | 0.01 | 94.0% | 833,952 | 672,984 |
| random | 2.98 | 0.00 | 0.0% | 0 | 0 |

### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 4.2% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.7%, southern-envelopment 1.6%, bait-and-converge 2.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 28.8%, southern-envelopment 17.2%, bait-and-converge 54.0% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 10.1%, by the seed 17.5%, interaction and noise 72.3% (target: strategy above seed). Re-rolling battle dice alone is not yet possible.
- **F5:** prudent halt endings: Successful Consolidation 100.0% (target: never Decisive Success).
- **F6:** random play reaches Decisive Success on 0.0% of seeds (target < 5%).
