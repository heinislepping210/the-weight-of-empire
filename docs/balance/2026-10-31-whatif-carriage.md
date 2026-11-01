# What-if runs: horses, carrying and foraging reach (rules 0.9.0, seeds 1–1000)

**These are not separate rules.** Each run lays one value over rules 0.9.0 at an end of its plausible range (G-019), to show how much the result depends on values that are not known precisely. The adopted values (D-032) were set from the research before these runs.

## Summary

hpw = draught horses per wagon (proposed 2); carry = days of rations a man carries (proposed 4); reach = foraging reach in km (proposed 22).

**Decisive Success or Costly Victory**

| | 0.8.0 | **0.9.0** | hpw 1 | hpw 4 | carry 3 | carry 6 | reach 15 | reach 30 |
|---|---|---|---|---|---|---|---|---|
| concentrated-push | 9.1% | 9.1% | 9.1% | 9.1% | 9.3% | 9.1% | 9.1% | 9.1% |
| southern-envelopment | 27.8% | 27.7% | 27.7% | 27.7% | 28.1% | 27.6% | 27.7% | 27.7% |
| bait-and-converge | 76.3% | 74.6% | 74.5% | 74.2% | 73.8% | 73.3% | 74.6% | 75.8% |
| methodical | 38.9% | 43.5% | 43.3% | 43.4% | 44.4% | 43.7% | 44.8% | 39.1% |
| rush | 43.4% | 43.6% | 43.6% | 43.6% | 43.5% | 43.6% | 43.6% | 43.4% |

**Operational Collapse**

| | 0.8.0 | **0.9.0** | hpw 1 | hpw 4 | carry 3 | carry 6 | reach 15 | reach 30 |
|---|---|---|---|---|---|---|---|---|
| concentrated-push | 30.0% | 33.3% | 33.3% | 33.3% | 35.3% | 31.1% | 33.3% | 34.0% |
| southern-envelopment | 0.4% | 2.0% | 2.0% | 2.0% | 2.2% | 1.5% | 2.0% | 2.1% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| methodical | 0.2% | 0.1% | 0.1% | 0.1% | 0.1% | 0.1% | 0.1% | 0.1% |
| rush | 15.7% | 13.7% | 13.7% | 13.7% | 14.2% | 13.8% | 13.7% | 14.2% |

**French horses lost (saddle, artillery and draught)**

| | 0.8.0 | **0.9.0** | hpw 1 | hpw 4 | carry 3 | carry 6 | reach 15 | reach 30 |
|---|---|---|---|---|---|---|---|---|
| concentrated-push | 28.7% | 30.1% | 29.6% | 30.6% | 30.2% | 29.9% | 30.1% | 30.0% |
| southern-envelopment | 21.1% | 22.7% | 22.3% | 23.1% | 22.8% | 22.5% | 22.7% | 22.6% |
| bait-and-converge | 27.9% | 29.6% | 29.0% | 30.5% | 29.7% | 29.4% | 29.6% | 29.6% |
| methodical | 20.1% | 24.4% | 23.9% | 25.1% | 24.8% | 23.6% | 25.2% | 23.8% |
| rush | 28.6% | 30.4% | 29.8% | 31.1% | 30.5% | 30.2% | 30.4% | 30.2% |
| prudent-halt | 0.0% | 4.7% | 4.5% | 5.1% | 4.8% | 4.6% | 6.4% | 2.8% |

**The halt**

| | 0.8.0 | **0.9.0** | hpw 1 | hpw 4 | carry 3 | carry 6 | reach 15 | reach 30 |
|---|---|---|---|---|---|---|---|---|
| prudent-halt: Successful Consolidation | 100.0% | 99.5% | 99.5% | 99.5% | 99.5% | 99.5% | 90.6% | 100.0% |
| prudent-halt: food days at end | 5.1 | 4.1 | 4.1 | 4.1 | 4.1 | 4.1 | 3.3 | 4.5 |

**F4: variance explained by strategy / seed**

| | 0.8.0 | **0.9.0** | hpw 1 | hpw 4 | carry 3 | carry 6 | reach 15 | reach 30 |
|---|---|---|---|---|---|---|---|---|
| F4 | 13% / 15% | 13% / 16% | 13% / 16% | 13% / 16% | 14% / 16% | 12% / 16% | 13% / 16% | 14% / 16% |

Invariant violations: 0 in every run.

---

## Paired supply-stance probe: rules 0.9.0, seeds 1–1000

Same bots, same seeds, same group orders: only the supply stance differs. A lower ending rank is better.

| Strategy | Forward better | Same ending | Hold better | Mean rank, forward / hold | French men lost, forward / hold | Food days at end, forward / hold | Most common ending, forward / hold |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.7% | 97.8% | 0.5% | 3.9 / 3.9 | 33.1% / 33.2% | 0.8 / 0.5 | Limited Success (54.9%) / Limited Success (55.7%) |
| southern-envelopment | 3.4% | 94.0% | 2.6% | 3.2 / 3.3 | 24.4% / 24.2% | 1.4 / 1.3 | Repulse (28.9%) / Repulse (29.7%) |
| bait-and-converge | 17.2% | 75.5% | 7.3% | 2.3 / 2.7 | 23.1% / 25.7% | 1.0 / 1.4 | Costly Victory (72.5%) / Costly Victory (54.9%) |
| methodical | 7.0% | 87.2% | 5.8% | 3.1 / 3.2 | 22.8% / 24.1% | 0.6 / 1.2 | Costly Victory (43.2%) / Costly Victory (36.3%) |
| rush | 6.4% | 92.7% | 0.9% | 3.1 / 3.2 | 30.8% / 32.2% | 1.1 / 0.6 | Costly Victory (43.4%) / Costly Victory (40.8%) |

**Invariant violations: 0**
