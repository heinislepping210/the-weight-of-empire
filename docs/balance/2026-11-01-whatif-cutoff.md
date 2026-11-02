# What-if runs: what a cut road earns (rules 0.13.0, seeds 1–1000)

**These are not separate rules.** The second independent review (finding D3) questioned whether holding the Moscow road for two sub-steps should count as cutting the Russians off for good. Each run lays one value of `outcome.cutOffCredit` over rules 0.13.0; nothing else differs, and the games themselves are the same in all three: only how their ends are judged changes. One set of dice per scenario, the seed's own.

- **Stands** (the rules now): once the road is held long enough, the Russians count as cut off for good.
- **At the end:** they count as cut off only if they still are when the campaign ends.
- **Graded:** cut off if they still are at the end; if they broke out after losing at least 10% of their strength in battle after the cut, they count as forced out of their position (at best an Operational Success); if they got away cheaply, the report says so and nothing more.

## What happens to the cut road (the same under every option)

| Southern envelopment | Share of games |
|---|---|
| Road cut at some point | 82.4% |
| … still cut off at the end | 1.2% |
| … broke out at a heavy cost | 24.6% |
| … got away cheaply | 56.6% |

No other bot cuts the road (the random control in 0.2% of games). No tested approach inflicts a decisive defeat in battle under any option.

## Endings of the southern envelopment

| Option | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|
| stands | 0.7% | 81.7% | 0.3% | 7.3% | 1.1% | 7.5% | 1.4% |
| atEnd | 0.0% | 1.2% | 1.0% | 46.6% | 24.2% | 25.6% | 1.4% |
| graded | 0.0% | 1.2% | 1.0% | 46.6% | 24.2% | 25.6% | 1.4% |

Every other bot ends the same under all three options, apart from the random control's 0.2% of Costly Victories, which become Repulses.

## Which approach does best (F3, share of seeds)

| Option | |
|---|---|
| stands | concentrated-push 6.5%, southern-envelopment 85.4%, bait-and-converge 8.1% |
| atEnd | concentrated-push 41.5%, southern-envelopment 18.7%, bait-and-converge 39.8% |
| graded | concentrated-push 41.5%, southern-envelopment 18.7%, bait-and-converge 39.8% |

**Reading:**
- **The brief cut is nearly all the southern envelopment's success.** The road was cut in 82.4% of its games, but the Russians were still cut off at the end in only 1.2%; in the rest they broke out, mostly cheaply.
- **"At the end" and "graded" give the same endings here.** A costly break-out counts as forced out under "graded", but that becomes an Operational Success only if the French army is also capable, fed and secure, and this bot's army never is. The difference would appear with a player, or a bot, that keeps the army in order.
- **Under either, no tested approach wins any more.** The southern envelopment falls to Limited Success, Inconclusive or Repulse, and no family dominates (F3 passes, but among approaches that do not win). That reflects the bots and the placeholder battle model as much as the rule.

## Full reports

### stands


**What-if run, not the adopted rules.** Overrides: `{"outcome":{"cutOffCredit":"stands"}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

#### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 94.7% | 0.0% | 0.0% | 0.0% | 1.1% | 4.2% |
| southern-envelopment | 0.7% | 81.7% | 0.3% | 7.3% | 0.0% | 0.0% | 1.1% | 7.5% | 1.4% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 92.5% | 0.0% | 0.0% | 0.3% | 7.1% | 0.1% |
| methodical | 0.0% | 0.0% | 0.2% | 67.4% | 0.0% | 0.0% | 0.1% | 32.1% | 0.2% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 0.0% | 92.5% | 0.0% | 0.0% | 0.0% | 1.2% | 6.3% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 35.2% | 0.0% | 0.0% | 0.4% | 56.8% | 7.6% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.2% | 0.0% | 4.2% | 0.0% | 0.0% | 64.8% | 30.8% | 0.0% |

#### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 27.8% | 29.0% | 23.4% | 98.6% | 3.3 | 437 | 1.7 |
| southern-envelopment | 21.7% | 21.4% | 23.3% | 48.3% | 2.0 | 581 | 1.7 |
| bait-and-converge | 23.3% | 29.6% | 19.7% | 92.5% | 2.5 | 550 | 0.9 |
| methodical | 23.7% | 24.6% | 16.7% | 67.6% | 2.4 | 540 | 0.5 |
| prudent-halt | 13.3% | 9.4% | 10.3% | 0.0% | 0.7 | 810 | 2.7 |
| rush | 26.5% | 30.2% | 25.6% | 98.1% | 3.1 | 472 | 1.1 |
| concentrated-push-staged | 29.0% | 32.4% | 19.8% | 35.8% | 2.6 | 403 | 1.1 |
| supplied-halt | 13.2% | 11.6% | 10.3% | 0.0% | 0.7 | 811 | 2.1 |
| random | 18.0% | 13.5% | 7.8% | 4.2% | 0.5 | 672 | 0.3 |

#### Contacts (means)

| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |
|---|---|---|---|---|---|
| concentrated-push | 3.3 | 12.7 | 0.74 | 0.20 | 2.22 |
| southern-envelopment | 2.0 | 7.5 | 0.59 | 0.13 | 0.47 |
| bait-and-converge | 2.5 | 6.8 | 0.55 | 0.15 | 0.12 |
| methodical | 2.4 | 10.6 | 0.66 | 0.15 | 0.86 |
| prudent-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| rush | 3.1 | 15.4 | 1.29 | 0.14 | 1.45 |
| concentrated-push-staged | 2.6 | 8.7 | 0.68 | 0.09 | 1.07 |
| supplied-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| random | 0.5 | 1.1 | 0.00 | 0.03 | 0.40 |

#### The Russian main armies (share of games)

Cut-off credit: `stands`. "Road cut" counts games in which the line of retreat was held long enough at some point; of those, still cut off at the end, or broken out after losing at least 10% of their strength in battle after the cut.

| Strategy | Decisively defeated | Cut off | Forced out | Damaged | Intact | Road cut | Still cut off at the end | Broke out at a heavy cost |
|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 84.5% | 1.4% | 14.1% | 0.0% | 0.0% | 0.0% |
| southern-envelopment | 0.0% | 82.4% | 5.4% | 0.1% | 12.1% | 82.4% | 1.2% | 24.6% |
| bait-and-converge | 0.0% | 0.0% | 2.5% | 80.8% | 16.7% | 0.0% | 0.0% | 0.0% |
| methodical | 0.0% | 0.0% | 20.3% | 58.3% | 21.4% | 0.0% | 0.0% | 0.0% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 68.5% | 31.5% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 75.8% | 0.8% | 23.4% | 0.0% | 0.0% | 0.0% |
| concentrated-push-staged | 0.0% | 0.0% | 5.4% | 79.3% | 15.3% | 0.0% | 0.0% | 0.0% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 68.5% | 31.5% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.2% | 1.8% | 18.4% | 79.6% | 0.2% | 0.0% | 0.0% |

#### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 86.0% | 834,160 | 618,232 | 94,331 / 32,106 | 5.2% |
| southern-envelopment | 1.00 | 0.01 | 100.0% | 834,001 | 694,174 | 50,649 / 37,531 | 3.3% |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 833,041 | 0 | 29,306 / 59,194 | 10.8% |
| methodical | 1.05 | 0.04 | 33.4% | 810,481 | 83,010 | 72,582 / 75,484 | 11.5% |
| prudent-halt | 2.00 | 0.68 | 0.0% | 418,934 | 16,167 | 43,521 / 39,286 | 13.1% |
| rush | 1.00 | 0.00 | 87.4% | 833,771 | 652,347 | 43,737 / 23,460 | 4.8% |
| concentrated-push-staged | 1.00 | 0.00 | 0.0% | 833,771 | 0 | 25,560 / 58,878 | 8.1% |
| supplied-halt | 1.00 | 0.68 | 0.0% | 418,923 | 16,167 | 43,521 / 39,286 | 19.2% |
| random | 1.84 | 0.14 | 5.2% | 177,153 | 17,311 | 36,201 / 42,171 | 7.5% |

#### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 0.7% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 0.7%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 6.5%, southern-envelopment 85.4%, bait-and-converge 8.1% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 41.3%, by the seed 5.9%, interaction and dice together 52.9% (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.
- **F5:** the prudent halt, declared on the first turn before any victory, ends in: Precarious Halt 100.0% (target: never Decisive Success; a victory won before a later halt stands, D-035).
- **F6:** random play reaches Decisive Success in 0.0% of games (target < 5%).

*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random.*


### atEnd


**What-if run, not the adopted rules.** Overrides: `{"outcome":{"cutOffCredit":"atEnd"}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

#### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 94.7% | 0.0% | 0.0% | 0.0% | 1.1% | 4.2% |
| southern-envelopment | 0.0% | 1.2% | 1.0% | 46.6% | 0.0% | 0.0% | 24.2% | 25.6% | 1.4% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 92.5% | 0.0% | 0.0% | 0.3% | 7.1% | 0.1% |
| methodical | 0.0% | 0.0% | 0.2% | 67.4% | 0.0% | 0.0% | 0.1% | 32.1% | 0.2% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 0.0% | 92.5% | 0.0% | 0.0% | 0.0% | 1.2% | 6.3% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 35.2% | 0.0% | 0.0% | 0.4% | 56.8% | 7.6% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.0% | 0.0% | 4.2% | 0.0% | 0.0% | 64.8% | 31.0% | 0.0% |

#### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 27.8% | 29.0% | 23.4% | 98.6% | 3.3 | 437 | 1.7 |
| southern-envelopment | 21.7% | 21.4% | 23.3% | 48.3% | 2.0 | 581 | 1.7 |
| bait-and-converge | 23.3% | 29.6% | 19.7% | 92.5% | 2.5 | 550 | 0.9 |
| methodical | 23.7% | 24.6% | 16.7% | 67.6% | 2.4 | 540 | 0.5 |
| prudent-halt | 13.3% | 9.4% | 10.3% | 0.0% | 0.7 | 810 | 2.7 |
| rush | 26.5% | 30.2% | 25.6% | 98.1% | 3.1 | 472 | 1.1 |
| concentrated-push-staged | 29.0% | 32.4% | 19.8% | 35.8% | 2.6 | 403 | 1.1 |
| supplied-halt | 13.2% | 11.6% | 10.3% | 0.0% | 0.7 | 811 | 2.1 |
| random | 18.0% | 13.5% | 7.8% | 4.2% | 0.5 | 672 | 0.3 |

#### Contacts (means)

| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |
|---|---|---|---|---|---|
| concentrated-push | 3.3 | 12.7 | 0.74 | 0.20 | 2.22 |
| southern-envelopment | 2.0 | 7.5 | 0.59 | 0.13 | 0.47 |
| bait-and-converge | 2.5 | 6.8 | 0.55 | 0.15 | 0.12 |
| methodical | 2.4 | 10.6 | 0.66 | 0.15 | 0.86 |
| prudent-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| rush | 3.1 | 15.4 | 1.29 | 0.14 | 1.45 |
| concentrated-push-staged | 2.6 | 8.7 | 0.68 | 0.09 | 1.07 |
| supplied-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| random | 0.5 | 1.1 | 0.00 | 0.03 | 0.40 |

#### The Russian main armies (share of games)

Cut-off credit: `atEnd`. "Road cut" counts games in which the line of retreat was held long enough at some point; of those, still cut off at the end, or broken out after losing at least 10% of their strength in battle after the cut.

| Strategy | Decisively defeated | Cut off | Forced out | Damaged | Intact | Road cut | Still cut off at the end | Broke out at a heavy cost |
|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 84.5% | 1.4% | 14.1% | 0.0% | 0.0% | 0.0% |
| southern-envelopment | 0.0% | 1.2% | 85.9% | 0.6% | 12.3% | 82.4% | 1.2% | 24.6% |
| bait-and-converge | 0.0% | 0.0% | 2.5% | 80.8% | 16.7% | 0.0% | 0.0% | 0.0% |
| methodical | 0.0% | 0.0% | 20.3% | 58.3% | 21.4% | 0.0% | 0.0% | 0.0% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 68.5% | 31.5% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 75.8% | 0.8% | 23.4% | 0.0% | 0.0% | 0.0% |
| concentrated-push-staged | 0.0% | 0.0% | 5.4% | 79.3% | 15.3% | 0.0% | 0.0% | 0.0% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 68.5% | 31.5% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.0% | 1.8% | 18.4% | 79.8% | 0.2% | 0.0% | 0.0% |

#### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 86.0% | 834,160 | 618,232 | 94,331 / 32,106 | 5.2% |
| southern-envelopment | 1.00 | 0.01 | 100.0% | 834,001 | 694,174 | 50,649 / 37,531 | 3.3% |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 833,041 | 0 | 29,306 / 59,194 | 10.8% |
| methodical | 1.05 | 0.04 | 33.4% | 810,481 | 83,010 | 72,582 / 75,484 | 11.5% |
| prudent-halt | 2.00 | 0.68 | 0.0% | 418,934 | 16,167 | 43,521 / 39,286 | 13.1% |
| rush | 1.00 | 0.00 | 87.4% | 833,771 | 652,347 | 43,737 / 23,460 | 4.8% |
| concentrated-push-staged | 1.00 | 0.00 | 0.0% | 833,771 | 0 | 25,560 / 58,878 | 8.1% |
| supplied-halt | 1.00 | 0.68 | 0.0% | 418,923 | 16,167 | 43,521 / 39,286 | 19.2% |
| random | 1.84 | 0.14 | 5.2% | 177,153 | 17,311 | 36,201 / 42,171 | 7.5% |

#### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 0.0% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 0.0%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 41.5%, southern-envelopment 18.7%, bait-and-converge 39.8% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 26.7%, by the seed 8.6%, interaction and dice together 64.7% (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.
- **F5:** the prudent halt, declared on the first turn before any victory, ends in: Precarious Halt 100.0% (target: never Decisive Success; a victory won before a later halt stands, D-035).
- **F6:** random play reaches Decisive Success in 0.0% of games (target < 5%).

*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random.*


### graded


**What-if run, not the adopted rules.** Overrides: `{"outcome":{"cutOffCredit":"graded"}}`

Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random. Approach families: concentrated-push, southern-envelopment, bait-and-converge. Battles are left to the marshal.

**Invariant violations: 0**

#### Endings by strategy

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Successful Consolidation | Precarious Halt | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 0.0% | 94.7% | 0.0% | 0.0% | 0.0% | 1.1% | 4.2% |
| southern-envelopment | 0.0% | 1.2% | 1.0% | 46.6% | 0.0% | 0.0% | 24.2% | 25.6% | 1.4% |
| bait-and-converge | 0.0% | 0.0% | 0.0% | 92.5% | 0.0% | 0.0% | 0.3% | 7.1% | 0.1% |
| methodical | 0.0% | 0.0% | 0.2% | 67.4% | 0.0% | 0.0% | 0.1% | 32.1% | 0.2% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 0.0% | 92.5% | 0.0% | 0.0% | 0.0% | 1.2% | 6.3% |
| concentrated-push-staged | 0.0% | 0.0% | 0.0% | 35.2% | 0.0% | 0.0% | 0.4% | 56.8% | 7.6% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.0% | 0.0% | 4.2% | 0.0% | 0.0% | 64.8% | 31.0% | 0.0% |

#### Costs and gains (means)

| Strategy | French men lost | French horses lost | Russian main armies lost | Smolensk held | Battles | French cohesion at end | Food days at end |
|---|---|---|---|---|---|---|---|
| concentrated-push | 27.8% | 29.0% | 23.4% | 98.6% | 3.3 | 437 | 1.7 |
| southern-envelopment | 21.7% | 21.4% | 23.3% | 48.3% | 2.0 | 581 | 1.7 |
| bait-and-converge | 23.3% | 29.6% | 19.7% | 92.5% | 2.5 | 550 | 0.9 |
| methodical | 23.7% | 24.6% | 16.7% | 67.6% | 2.4 | 540 | 0.5 |
| prudent-halt | 13.3% | 9.4% | 10.3% | 0.0% | 0.7 | 810 | 2.7 |
| rush | 26.5% | 30.2% | 25.6% | 98.1% | 3.1 | 472 | 1.1 |
| concentrated-push-staged | 29.0% | 32.4% | 19.8% | 35.8% | 2.6 | 403 | 1.1 |
| supplied-halt | 13.2% | 11.6% | 10.3% | 0.0% | 0.7 | 811 | 2.1 |
| random | 18.0% | 13.5% | 7.8% | 4.2% | 0.5 | 672 | 0.3 |

#### Contacts (means)

| Strategy | Battles | Rounds fought | French reinforcements joined | Russian reinforcements joined | Battles the French lost |
|---|---|---|---|---|---|
| concentrated-push | 3.3 | 12.7 | 0.74 | 0.20 | 2.22 |
| southern-envelopment | 2.0 | 7.5 | 0.59 | 0.13 | 0.47 |
| bait-and-converge | 2.5 | 6.8 | 0.55 | 0.15 | 0.12 |
| methodical | 2.4 | 10.6 | 0.66 | 0.15 | 0.86 |
| prudent-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| rush | 3.1 | 15.4 | 1.29 | 0.14 | 1.45 |
| concentrated-push-staged | 2.6 | 8.7 | 0.68 | 0.09 | 1.07 |
| supplied-halt | 0.7 | 2.8 | 0.00 | 0.15 | 0.73 |
| random | 0.5 | 1.1 | 0.00 | 0.03 | 0.40 |

#### The Russian main armies (share of games)

Cut-off credit: `graded`. "Road cut" counts games in which the line of retreat was held long enough at some point; of those, still cut off at the end, or broken out after losing at least 10% of their strength in battle after the cut.

| Strategy | Decisively defeated | Cut off | Forced out | Damaged | Intact | Road cut | Still cut off at the end | Broke out at a heavy cost |
|---|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% | 0.0% | 84.5% | 1.4% | 14.1% | 0.0% | 0.0% | 0.0% |
| southern-envelopment | 0.0% | 1.2% | 86.3% | 0.2% | 12.3% | 82.4% | 1.2% | 24.6% |
| bait-and-converge | 0.0% | 0.0% | 2.5% | 80.8% | 16.7% | 0.0% | 0.0% | 0.0% |
| methodical | 0.0% | 0.0% | 20.3% | 58.3% | 21.4% | 0.0% | 0.0% | 0.0% |
| prudent-halt | 0.0% | 0.0% | 0.0% | 68.5% | 31.5% | 0.0% | 0.0% | 0.0% |
| rush | 0.0% | 0.0% | 75.8% | 0.8% | 23.4% | 0.0% | 0.0% | 0.0% |
| concentrated-push-staged | 0.0% | 0.0% | 5.4% | 79.3% | 15.3% | 0.0% | 0.0% | 0.0% |
| supplied-halt | 0.0% | 0.0% | 0.0% | 68.5% | 31.5% | 0.0% | 0.0% | 0.0% |
| random | 0.0% | 0.0% | 1.8% | 18.4% | 79.8% | 0.2% | 0.0% | 0.0% |

#### Supply (means)

| Strategy | Depots founded | French depots lost | Took the Smolensk stores | Food moved up by line trains | Stores burned (food) | Left behind on the march (rations / fodder) | French wagon-train horses lost |
|---|---|---|---|---|---|---|---|
| concentrated-push | 1.00 | 0.01 | 86.0% | 834,160 | 618,232 | 94,331 / 32,106 | 5.2% |
| southern-envelopment | 1.00 | 0.01 | 100.0% | 834,001 | 694,174 | 50,649 / 37,531 | 3.3% |
| bait-and-converge | 1.00 | 0.00 | 0.0% | 833,041 | 0 | 29,306 / 59,194 | 10.8% |
| methodical | 1.05 | 0.04 | 33.4% | 810,481 | 83,010 | 72,582 / 75,484 | 11.5% |
| prudent-halt | 2.00 | 0.68 | 0.0% | 418,934 | 16,167 | 43,521 / 39,286 | 13.1% |
| rush | 1.00 | 0.00 | 87.4% | 833,771 | 652,347 | 43,737 / 23,460 | 4.8% |
| concentrated-push-staged | 1.00 | 0.00 | 0.0% | 833,771 | 0 | 25,560 / 58,878 | 8.1% |
| supplied-halt | 1.00 | 0.68 | 0.0% | 418,923 | 16,167 | 43,521 / 39,286 | 19.2% |
| random | 1.84 | 0.14 | 5.2% | 177,153 | 17,311 | 36,201 / 42,171 | 7.5% |

#### Fairness diagnostics (targets are diagnostics, not quotas)

- **F1 (fair-policy part):** at least one approach family reaches Decisive Success on 0.0% of seeds (target ≥ 60%). No oracle search yet.
- **F2:** Decisive Success rate per family: concentrated-push 0.0%, southern-envelopment 0.0%, bait-and-converge 0.0% (target ≈ 25% each).
- **F3:** share of seeds on which each family does best: concentrated-push 41.5%, southern-envelopment 18.7%, bait-and-converge 39.8% (target: none above 50%).
- **F4:** variance of the ending rank explained by the strategy 26.7%, by the seed 8.6%, interaction and dice together 64.7% (target: strategy above seed). Run with BALANCE_DICE=3 to separate the dice.
- **F5:** the prudent halt, declared on the first turn before any victory, ends in: Precarious Halt 100.0% (target: never Decisive Success; a victory won before a later halt stands, D-035).
- **F6:** random play reaches Decisive Success in 0.0% of games (target < 5%).

*F1 and F3 use each seed's first roll; F2, F5 and F6 count every game. Bots: concentrated-push, southern-envelopment, bait-and-converge, methodical, prudent-halt, rush, concentrated-push-staged, supplied-halt, random.*

