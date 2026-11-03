# Gameplay Balancing

How we check that the game is fair, varied and winnable through skill, without forcing outcomes. *Section numbers (§) are shared across all project documents; the index is in the README.*

## 7 Fairness testing

- **Fair strategy bots.** These are fixed policies that use only what a player could see. There is one per approach family — *Bait and converge*, *Southern envelopment*, *Concentrated push (Rudnia road)* — plus *Methodical (depots first)*, *Prudent halt*, *Rush*, *Greedy forager* and *Random valid*. Each is tuned across many seeds, never for a single seed, and run on 1,000+ seeds. The balance report covers outcome distribution, game length and exploits.
- **Oracle search** (diagnostic only). It sees everything and searches directive sequences to find what is *possible* on each seed, which exposes impossible starts.
- **Fairness criteria: diagnostic targets, not victory quotas.** They exist to reveal problems — an impossible start, a dominant opening, an outcome decided by dice — not to force a particular success rate:
  - **F1 Achievable:** the oracle reaches a Decisive Success on ≥ 90% of seeds, and the best fair policy for each seed does so on ≥ 60%.
  - **F2 Several ways to win:** each of the three approach families reaches a Decisive Success on at least ~25% of seeds.
  - **F3 No dominant opening:** no single opening (the first two directives) is best on more than half of the seeds, and the shortest route isn't best on most seeds.
  - **F4 Skill over luck:** across strategies × seeds, the choice of strategy explains more of the outcome than the seed does. For a fixed, sound plan, re-rolling only the battle and event dice keeps the same ending tier in ≥ 80% of runs.
  - **F5 The halt is a real choice:** it is always available, and its outcome follows the state (§2.13). From a supplied, defensible position it should reliably lead to Successful Consolidation; from an exposed or unsupplied one it should not. It never produces Decisive Success.
  - **F6 No traps:** no seed forces an early failure, every game ends by the turn limit, and random play reaches tier 1 on under 5% of seeds.

## Rule values: placeholders against the research (31 October 2026)

Rules 0.1.0 used placeholders (G-006). This table compares them with the first research ranges (L-001 to L-006). **Rules 0.2.0 adopted the right-hand column (D-023).** Load shares by weight (food 70%, fodder 20%, ammunition 10%) are still placeholders.

Effect, measured: a 60-wagon convoy now carries about 44,800 days of bread but only about 1,066 days of fodder. Even an all-fodder convoy (5,333 horse-days) feeds a 9,000-horse corps for less than a day.

| Rule | 0.1.0 placeholder | Research range | Adopted in 0.2.0 |
|---|---|---|---|
| Steady march | 11 km per sub-step = 22 km/day | 16–30 km/day | keep 22 km/day |
| Forced march | 16 km per sub-step = 32 km/day | 30–45 km/day | 36 km/day (18 km per sub-step) |
| Convoy speed | 9 km per sub-step = 18 km/day | 16–19 km/day | keep 18 km/day |
| Wagon payload | 1,000 "units" of any kind | ~700–1,100 kg | **800 kg, measured by weight** |
| Food ration | 1 unit | ~0.55–0.75 kg | **0.75 kg** |
| Fodder ration | 1 unit (as heavy as food) | ~9 kg | **9 kg** — twelve times a food ration |
| Ammunition | 1 unit | — | weight to be researched; provisional 1 kg per unit |

**What the weight change does to play:** wagons stay valuable for bread and ammunition, but cannot feed the horses for long. Horses then depend on foraging and grazing, so stripped country, a halt in poor country, or a forced march through it hits cavalry, artillery and the wagons themselves. That is a historically grounded constraint and a sharper decision for the player. Approved and implemented on 31 October 2026.

**Calibration hint, not a target:** if the popular estimate H-014 holds up, a broadly historical way of playing should lose a substantial share of men and horses to attrition rather than battle. The rates are tuned within the ranges above until the historical approach lands near the historical outcome (history is par, §2.13). Documented facts are never adjusted to reach it.

## First scenario probe (31 October 2026, rules 0.2.0, seed 1812)

The Vitebsk Decision, played for its 10 turns with **no orders at all** (every force stays in place):

| Force | Men lost | Horses lost | Supplies at end |
|---|---|---|---|
| French groups | 15–26% | ~20–38% | none |
| Russian armies | 10–23% | ~17–37% | none |

There were 80 shortfall events and about 27,500 horses lost; 42,000 men straggled and 18,000 fell sick.

**This is not historically plausible.** The halt at Vitebsk was a time of rest and partial recovery, and the Russians sat beside their own magazines. **Causes:**
1. Forces forage only the district of their own place. Spreading out across many villages, the *Dispersed* posture of §2.4b, is not implemented yet.
2. Depot stocks and wagon-park sizes are placeholders (G-012) that cannot meet a large army's daily need, even close to a depot.

**Calibration target, before any tuning of fun:** a force halted and dispersed near its depot should be roughly sustainable and slowly recover. Sustainability should then fall off with distance from the depots, with the length and condition of the line, and with concentration. That is the core tension of the game (§2.1), and it has to come from the model, not from patched numbers.

## Calibration with rules 0.3.0 (31 October 2026)

Changes: dispersed and concentrated postures, depot issue, wider foraging when dispersed, retreat towards home, and recalibrated scenario stocks (D-024). The same scenario, as a mean over 20 seeds:

| Approach | French men lost | French horses lost | Russian men lost |
|---|---|---|---|
| Stay dispersed (no orders) | 7.6% | 0.4% | 3.9% |
| Concentrate in place | 11.6% | 9.5% | 3.9% |
| Push on Smolensk on three axes (scripted, battles delegated) | 18.2% | 21.0% | 9.7% |

**Reading it:**
- **Near a depot, a halted, dispersed force is sustainable.** Guard, Davout and the southern group lose only sickness (3.9% in 20 days) and keep supplies in hand.
- **Exposed forward groups are under pressure.** The vanguard at Liozno and Eugène at Surazh are 50+ km from Vitebsk, compete for the same countryside, and can't forage under the Cossacks at Rudnia. They run short, which gives the player a reason to act — by design, not a bug.
- **Concentrating costs food and horses; pushing costs men and horses.** These are the intended trade-offs, and they come from the model.
- **Pushing, against the historical hint:** H-014 (unverified) suggests roughly a third of the men and half the horses lost over about 50 days, around 15% of men and 25% of horses per 20 days. The push lands near the men figure and somewhat below on horses; to revisit once the Russian AI moves and a historical-approach bot exists.

**Known limits:** stragglers don't yet rejoin; sickness doesn't yet vary with heat, crowding or water; the Russian AI only holds its ground, so these figures leave out Russian counter-moves.

## With the Russian command active (rules 0.4.0, 20 seeds)

| French approach | French men lost | French horses lost | Russian men lost | What the Russians did |
|---|---|---|---|---|
| Stay dispersed | 9.6% | 1.8% | 10.8% | struck the exposed vanguard at Liozno on turn 1 in 16 of 20 games (the offensive of 7 August), fought there, fell back home |
| Push on Smolensk (scripted) | 21.0% | 20.9% | 16.0% | struck isolated columns (e.g. Davout alone at Krasnyi), stood at Smolensk as pressure reached its maximum, and in several games withdrew to Valutino or Dorogobuzh |

**Readings and open questions:**
- The Russian strike creates the intended *bait and converge* opportunity (§2.13): a player who sees it coming can meet it concentrated.
- **Possibly too predictable:** a strike on turn 1 in 80% of games. Options to consider: hysteresis, a wider seeded temperament, or a false-report event (H-012). To be judged in M1 playtesting, not by numbers alone.
- Plans can switch from turn to turn (stand, strike, hold); some hysteresis may make the opponent read more consistently.

## First balance batch (rules 0.5.0, 1,000 seeds, 31 October 2026)

Full report: [balance/2026-10-31-rules-0.5.0.md](balance/2026-10-31-rules-0.5.0.md). Seven bots play through the same directives and staff planner a player uses, see only French intelligence, and leave battles to the marshal.

**What holds:**
- **Zero invariant violations** in 7,000 games.
- **F4, skill over luck:** the strategy explains 72% of the variance in the ending, the seed only 5%.
- **F5:** the prudent halt never reaches Decisive Success.
- **F6:** random play never reaches Decisive Success.

**What fails, and why:**
- **Every approach that advances on Smolensk ends in Operational Collapse** (concentrated push, southern envelopment, bait and converge, rush: 100%). The losses in men (23–28%) are not the cause. The armies arrive starving (0.1–0.8 days of food) and hunger destroys their cohesion (20–90 out of 1,000 at the end).
- **The methodical approach shows the way out:** it rests dispersed to feed before advancing, and gets 46% Costly Victory and holds Smolensk in 83% of games. It still collapses in 43%.
- **F1 and F2 cannot pass under this model:** no Decisive Success at all. **This follows from missing parts of the model, not from balance values:**
  1. **Captured stores** (§2.6): taking a Russian magazine, Smolensk above all, before it is burned is not modelled yet.
  2. **Pushing depots forward** (the logistics stance of §2.4b) is not modelled yet. Supply still starts from Vitebsk, Orsha and Mogilev, and wagons at 18 km/day cannot keep up with a moving army.
  3. **The effect of hunger is probably too harsh on cohesion** (G-006 placeholder: −100 a day at a full shortfall, recovery +10 a day). Historically, hunger showed mostly as straggling and marauding, which the model also counts. Foraging on the march (0.2 rations a man a day) is a low placeholder as well.
- **F3 is meaningless for now,** because the three families tie on every seed.

**Recommended next step (for your decision):** build the two planned mechanics first (1 and 2), then research the effect of hunger and marching forage (3) before touching those numbers, and run the batch again. No rule is to be tuned just to make the targets pass.

## Second balance batch (rules 0.6.0, 1,000 seeds, 31 October 2026)

Full report: [balance/2026-10-31-rules-0.6.0.md](balance/2026-10-31-rules-0.6.0.md). This batch adds the two missing mechanics: captured stores, and forward depots stocked by line trains (D-029, G-016). Every bot except the random one now brings its depots forward. No other rule value changed.

**What holds:**
- **Zero invariant violations** in 7,000 games, with burned stores and depot changes inside the conservation checks.
- **F4, F5, F6** still hold. The strategy explains 57% of the variance in the ending and the seed 8%. The share explained by strategy fell from 72%, because the families no longer tie.

**What changed:**
- **The approach families now differ.**
  - Concentrated push: 85% Collapse, 15% Limited Success.
  - Southern envelopment: 76% Collapse, 15% Repulse, 8% Limited Success, 1% Costly Victory.
  - Bait and converge: 44% Collapse, 46% Repulse, 7% Limited Success, 2% Costly Victory.
  - F3 now means something. Bait and converge does best on 49% of seeds, just under the 50% line, mostly because it collapses less often. A Repulse ranks above a Collapse.
- **The methodical approach improves.** It gets 33% Costly Victory and 40% Limited Success, and collapses in 19% of games (43% before). It reaches the first Decisive Successes (0.9%).
- **Captured stores now matter.** The advancing bots take the Smolensk stores in 84–96% of games. But 50–90% has been burned by then: on average 650,000 rations go up in smoke in the concentrated push. *Corrected after the independent review:* the burned share is drawn at random for each capture and does not depend on how quickly the depot is reached, so speed does not preserve more of the stores under these rules. Only the stock the Russians had not yet drawn down can favour an early capture.
- **Forward depots near the enemy are a liability.** The prudent halt founds depots where its dispersed troops stand. It loses 0.68 of them on average to the Russian strike, but little is burned.

**What still fails, and why:**
- **F1 and F2:** no approach family reaches Decisive Success. The armies still end hungry (0.4–1.1 days of food) and worn (cohesion 138–342 out of 1,000).
- **The depot chain stops at Liozno.** Every advancing game founds exactly one depot.
  - After Liozno, a group standing at the start of a turn is either too close to Liozno (Rudnia, 24 km away) or beyond a line train's 80 km haul.
  - The line trains move about 834,000 rations up to Liozno, roughly 4½ days for the whole army. By then the army is 100 km further on, and corps wagons at 18 km/day cannot close the gap.
  - This is how the historical advance went: the army outran its supply. But the player has no tool yet to build the chain on purpose, other than halting a group at the right place.
- **The cohesion collapse looks too severe historically.** The Grande Armée reached Smolensk worn and hungry, but it did not collapse until the retreat. That points again to the hunger effect on cohesion (G-006: −100 a day at a full shortfall), which has not been researched yet.

**Recommended next steps (for your decision):**
1. **Research the hunger effects** (cohesion loss, straggling) and foraging on the march against sources. Adjust only within documented ranges.
2. **Check the 80 km haul and the 40 km spacing** (G-016) against the French line of magazines in 1812. Consider letting the player name a depot site that a group should halt at.
3. **Your play session (M1).** The numbers say the dilemmas exist. Only playing tells us whether you feel them.

## Hunger research and what-if runs (31 October 2026)

The research is in HISTORICAL_RESEARCH.md ("Hunger, straggling and foraging") and the register (H-014 to H-017, L-007, L-008, G-017).
- **The finding:** hunger wore the 1812 army down mainly through men leaving the ranks, by sickness and straggling. It cost a third of the central army in 52 days, yet the rest still fought.
- **The proposal:** lower the cohesion loss at a full food shortfall from 100 to 30 a day, inside a plausible range of 20–60. Straggling and foraging on the march stay as they are.

To see the effect before adopting anything, the batch now takes rule overrides for a single run. Four what-if runs of 1,000 seeds each covered the range: [balance/2026-10-31-whatif-hunger.md](balance/2026-10-31-whatif-hunger.md). The proposed value was set from the evidence before the runs.

**What the runs show (at 30, against the adopted 100):**
- **Collapse from hunger nearly disappears** for the approach families: 0.3–2.6%, down from 44–85%. The rush still collapses in 6% of games. Armies end worn but capable: cohesion 540–650, food in hand about a day. This matches the army that reached Smolensk.
- **The approaches still differ.**
  - Bait and converge: 62% Costly Victory.
  - Concentrated push: 33% Costly Victory, 64% Limited Success.
  - Southern envelopment: mostly Limited Success, Inconclusive or Repulse. It holds Smolensk in only 46% of games.
- **Within the range, the result is insensitive at the low end and sensitive at the top.**
  - 25 and 30 give nearly the same results.
  - At 50, collapse returns in 9–14% of the families' games, and Costly Victory falls by half or more.
- **Foraging on the march hardly matters.** Raising it to 0.5 rations a man a day, the top of its range, changes the endings by a few points. It stays at 0.2.
- **Decisive Success is still rare:** 2% per family and 5% for the methodical bot (F1 5.5%, F2 about 2%). The Russian main armies lose 17–26% on average, short of the 30% the Decisive threshold asks for (G-004). F1 and F2 now hinge on that threshold and on how battles are fought, not on hunger.

**What gets worse, and needs thought:**
- **F4 fails.** The strategy explains only 10% of the variance in the ending, the seed 19%, and the interaction and noise 71%.
- The reason: with hunger no longer forcing every advance into collapse, each strategy spreads over several endings depending on the seed (strengths, Russian temperament, weather).
- A large interaction means *which* approach is best depends on the situation. That rewards reading the situation, if the player can see what matters.
- But the bots never adapt to the seed, and with one game per strategy and seed, battle luck cannot be separated from the interaction.
- **Before reading F4 as "luck beats skill",** the batch needs:
  - a best-response measure: how well the best approach for each seed does, compared with a fixed approach;
  - repeat runs with fresh battle dice.
- **F3 is borderline.** Bait and converge does best on 53% of seeds, just over the 50% line.

**Recommended (for your decision):**
1. **Adopt 30 a day as rules 0.7.0** (G-017). It is evidence-based, and it removes a collapse the history does not support.
2. **Then improve the F4 measurement** (best response per seed; battle-dice re-rolls) before drawing balance conclusions.
3. **Later: returning stragglers during halts** (H-017), and a look at the Decisive Success threshold (G-004) against the historical Russian losses.

**Decision:** 30 a day adopted as rules 0.7.0 (D-030). The batch on the adopted rules ([balance/2026-10-31-rules-0.7.0.md](balance/2026-10-31-rules-0.7.0.md)) is identical to the what-if run at 30. Steps 2 and 3 are still open.

## Contacts corrected (rules 0.8.0, 31 October 2026)

An independent review (docs/reviews/2026-10-31-independent-review.md) found contact defects that changed outcomes, independently of the placeholder battle maths:
- forces arriving at a battle stayed outside it;
- opposing columns could pass through each other on a road;
- retreats were instant, even over 80–90 km;
- a halt left standing marches running.

Rules 0.8.0 corrects them (D-031, TECHNICAL_ARCHITECTURE §3.4a), with tests written to fail on the old rules. Full report: [balance/2026-10-31-rules-0.8.0.md](balance/2026-10-31-rules-0.8.0.md). No other rule changed, and nothing was tuned to compensate.

**What changed, and why:**

| | Battles per game (0.7.0 → 0.8.0) | Battles the French lost | Operational Collapse | Costly Victory or better |
|---|---|---|---|---|
| concentrated-push | 2.2 → 4.5 | 0.31 → 3.03 | 0.3% → 30.0% | 34.3% → 9.1% |
| southern-envelopment | 1.7 → 2.2 | 0.50 → 0.74 | 0.7% → 0.4% | 11.2% → 27.8% |
| bait-and-converge | 2.6 → 2.4 | 0.44 → 0.10 | 2.6% → 0.0% | 64.0% → 76.3% |
| methodical | 1.8 → 2.4 | 0.46 → 0.91 | 0.0% → 0.2% | 48.8% → 38.9% |
| rush | 3.2 → 4.2 | 0.76 → 1.87 | 5.8% → 15.7% | 25.7% → 43.4% |

- **The direct push was flattered by the defect.** Traces of collapsing games (seeds 3 and 6) show the cause:
  - Under 0.7.0, the Russian strike and the French columns often slipped past each other on the Rudnia road. Now they meet.
  - The concentrated-push bot then sends its corps one or two at a time against the united Russian armies (about 115,000 men). They lose, fall back to Rudnia, and the bot sends them forward again the next turn.
  - These piecemeal attacks are a weakness of the bot, which never waits to concentrate. They are also exactly the lesson the design means to teach.
- **Bait and converge now works as designed:** the converging corps reach the fight and join it. It does best on 64% of seeds (F3 above its 50% line), and the French rarely lose its battles.
- **The southern envelopment gains** (Decisive Success 1.8% → 7.5%). The **rush** wins more often but also collapses more; forced marches bring corps in faster but tired.
- **Reinforcements are mostly French** (0.5–1.1 per game against 0.1–0.4 Russian). The Russian command moves its armies together, so it rarely arrives piecemeal.
- **F1 rises to 9.3%; F4 stays poor** (strategy 13%, seed 15%).

**Reading:** these distributions are more trustworthy than those of 0.7.0, because the defect is gone. But the bots that do not concentrate before attacking now understate what the same approach could do in a player's hands. Before drawing balance conclusions, **review stage F** (better bots, a measure that separates battle luck from the scenario, held-out seeds) matters more than any rule value.

## Horses, carrying and foraging reach (rules 0.9.0, adopted, 31 October 2026)

Stage B of the independent review: connect horses to transport, make carrying finite, and bound foraging by distance (G-019; sources L-009 to L-011). Reports: [the batch](balance/2026-10-31-rules-0.9.0.md), and [sensitivity runs with the paired supply-stance probe](balance/2026-10-31-whatif-carriage.md). The values were set from the research before any run, and nothing was tuned afterwards.

**What the batch shows:**
- **The links bind.** Over a game the concentrated push leaves on average about 227,000 rations and 51,000 horse-rations of fodder by the road. Battle losses shrink what a corps can carry, so beaten corps abandon stores.
- **French wagon trains lose 3–11% of their draught horses.** French horse losses overall rise by 1.5–4 points against rules 0.8.0.
- **The halt now has a small price:**
  - foraging only within reach costs its horses 4.7%;
  - it ends with 4.1 days of food instead of 5.1;
  - 0.5% of halts end precariously.
- **Endings hardly move against 0.8.0**, within 2–5 points for every approach.

**Sensitivity: the unknown values do not steer the result.**
- **No change across the range:** with one horse or four per wagon, and with three or six days' rations per man, every approach family's chance of Decisive Success or Costly Victory moves by under 3 points. Collapse moves by under 3 points too.
- **Foraging reach matters only where armies stand still:**
  - at 15 km, the prudent halt consolidates successfully in 91% of games instead of 99.5%;
  - at 30 km, the methodical approach wins less often (39% instead of 44%). Why has not been traced yet.

  *Corrected after the second review:* Davie's 15, 22 and 30 km are the widths of foraging squares, not radii (L-011). The reach of 22 km was therefore about twice the source's normal case. Rules 0.12.0 set it to 11 km (see "The second independent review" below).

**The paired supply-stance probe** (same bots and seeds, depots brought forward or kept):
- **Forward supply helps a little and almost never hurts.**
  - Most approaches reach the same ending in 88–98% of games either way.
  - Bait and converge gains most: a better ending on 17% of seeds against a worse one on 7%, and Costly Victory in 73% of games instead of 55%.
- **It is not yet a dilemma**, because founding a depot costs nothing and wagon trains cannot be raided. A garrison detachment for each new depot, and Cossack raids on convoys (both in §2.6), would give it a price.

**Not changed, by design:** march speed still follows the infantry, so a group's horse losses cost it carrying, not speed. Wagon-train speed is unchanged too: wagons without horses simply stay behind.

## The kept route (review stage C, 31 October 2026)

Stage C made previews trustworthy (D-033). No rule changed, but one bot did. The southern-envelopment bot now keeps the route it chose on its first turn; before, the route was looked up by name from whichever group led, and when Davout took the lead at Krasnyi on turn 3 it silently fell back to the shortest roads. Report: [balance/2026-10-31-rules-0.9.0-route-kept.md](balance/2026-10-31-rules-0.9.0-route-kept.md).

**The southern envelopment was flattered by the defect:**

| southern-envelopment | Decisive Success | Costly Victory | Limited Success | Inconclusive | Repulse | Collapse | Smolensk held | Food days at end |
|---|---|---|---|---|---|---|---|---|
| Route lost on turn 3 (before) | 7.5% | 20.2% | 28.5% | 4.4% | 28.9% | 2.0% | 48.9% | 1.4 |
| Route kept (now) | 0.2% | 0.8% | 5.0% | 28.4% | 59.9% | 5.7% | 5.1% | 0.3 |

- **Why it fails now:** with the route kept, every corps marches the slow southern tracks by Liubavichi and Rasasna. The summary shows it before committing. The groups arrive up to 19 days apart, and Eugène's corps, coming from Surazh, only after the campaign ends.
- **What it means:** what used to work was "start south, then take the shortest roads", not a southern envelopment.
- **History did it differently.** In 1812 the army crossed the Dnieper at Rasasna on bridges built overnight (H-004), which needed the corps drawn together near the crossing first. How and where they assembled is still to be researched. A bot that concentrates first, or a planner that lets a far-off group converge by its own road, would come closer to the real manoeuvre.
- **F3 and F4 shift with it:**
  - Bait and converge is now best on 83% of seeds.
  - The strategy explains 32% of the variance and the seed 14%, so F4 passes. But that is because one family got clearly worse, not because skill was measured better.

**Decided (D-034): the road is chosen per group, own road by default on a long detour.**
- **The staff's default:** a group not already on the chosen route takes its own road when following the route would add more than half again to its march. It says so in its reasons.
- **Your override:** you can set any group to follow the route or take its own road.

Report: [balance/2026-11-01-rules-0.9.0-own-road.md](balance/2026-11-01-rules-0.9.0-own-road.md).

| southern-envelopment | Decisive Success | Costly Victory | Operational Success | Limited Success | Repulse | Collapse | Smolensk held |
|---|---|---|---|---|---|---|---|
| Route silently lost (the old defect) | 7.5% | 20.2% | 8.5% | 28.5% | 28.9% | 2.0% | 49% |
| Route strict for every group | 0.2% | 0.8% | 0.0% | 5.0% | 59.9% | 5.7% | 5% |
| **Own road on a long detour (now)** | 6.9% | 8.6% | 24.8% | 27.6% | 26.2% | 1.7% | 52% |

- **The southern envelopment is a real approach again**, and an honest one: groups near the crossing take the southern route, while far-off groups such as Eugène's converge by their own roads.
- **It now wins a quarter of its games by manoeuvre** (Operational Success: the Russians forced out without a decisive battle), where the old version mostly won costly victories.
- **F3 and F4 return to where they were:** bait and converge is best on 62% of seeds, and the strategy explains 13% of the variance against 18% for the seed. Stage F's better measures are still needed.

## The outcome model as designed (rules 0.10.0, 1 November 2026)

Review stage D brought the evaluator in line with §2.13 (D-035). Report: [balance/2026-11-01-rules-0.10.0.md](balance/2026-11-01-rules-0.10.0.md). No movement, supply or battle rule changed; only how the end is judged.

| Decisive Success or Costly Victory | rules 0.9.0 (own road) | rules 0.10.0 |
|---|---|---|
| concentrated-push | 9.1% | 0.0% |
| southern-envelopment | 15.5% | 50.3% |
| bait-and-converge | 74.5% | 0.0% |
| methodical | 43.5% | 0.0% |
| rush | 43.6% | 0.0% |
| prudent-halt: Successful Consolidation | 99.5% | 0.0% (100% Precarious Halt) |

**What it shows:**
- **The earlier victories were mostly not victories.** Traces of 300 games found two causes:
  - **Sickness counted as defeat.** Russian losses to sickness and straggling counted towards a decisive defeat whenever any battle had been won.
  - **The suburb counted as a cut-off.** Tracked over time, 30,000 French in Smolensk's north-bank suburb counted as cutting off the Russians in the Old Town in 75–80% of games, even while those Russians were marching out to strike. The design names Valutino and Dorogobuzh on the Moscow road for that; the code now does too.
- **Among the tested bots, only cutting the Moscow road wins now.** The southern envelopment's second objective is Valutino. Holding it for two sub-steps behind the Russians gives Decisive Success in 13% of games and Costly Victory in 38%, so it is now the best family on 74% of seeds (F3).
- **No tested approach inflicts a decisive defeat in battle.** The bar is 30% of the Russian main armies lost in battles won within 4 days, which matches battles like Austerlitz or Jena. The placeholder battle model never reaches it.

  That is a finding about the battle model, which the sector battles of §2.10 replace. It is not a reason to lower the threshold, so G-004 stays.
- **Bait and converge ends in Limited Success in 93% of games:** Smolensk taken, the Russian army not beaten. That is the historical par.
- **The prudent halt now always ends precarious, and rightly.**
  - The bot halts every group where it stands on the first turn. After 20 days the districts around them are stripped.
  - Eugène's corps at Surazh and Poniatowski's at Mogilev end with no food, and in some games the vanguard too. Meanwhile the Guard sits at Vitebsk with eight days' food.
  - The army's average (4–5 days) hid this until sustainability was judged group by group.
  - A halt that works needs the outlying corps pulled back to their depots or supplied, and the bot does neither. F5 still holds: no halt reaches Decisive Success.
- **F4: the strategy explains 21% of the variance, the seed 13%.**

**Next (review stage F):** better bots matter more than any value now. Two would show what the approaches can really do:
- a concentrated push that waits to concentrate before it attacks;
- a halt that first secures supply for every group.

The battle-loss bar for a decisive defeat should be revisited only with the sector battles, and against historical battle losses.

## Skill, situation and luck (rules 0.11.0, review stage F, 1 November 2026)

Stage F rebuilt the experiment (D-036). Reports: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-01-rules-0.11.0.md), and [an adaptive policy on held-out seeds](balance/2026-11-01-adaptive.md).
- **Two random streams.** The scenario (strengths, the Russian command, weather, scouting errors) and the dice (battles, withdrawals, skirmishes, burned stores, road priority) are now separate, so each scenario can be replayed with fresh dice.
- **New controls.** The random control varies per game, and two competent bot variants were added.
- **Integrity is a gate:** zero invariant violations in 27,000 games.

**Where the ending comes from** (ranks of the endings, two-way analysis with three sets of dice per scenario):

| Strategy | Scenario | Which strategy suits which scenario | Battle dice alone |
|---|---|---|---|
| 26% | 6% | 49% | 20% |

- **Luck is a fifth of the outcome.** That is enough to matter, but not enough to swamp decisions.
- **The scenario dependence is real.** The best approach for a scenario stays the best under fresh dice in 97% of scenarios, so the large interaction is not dice noise.

  *Corrected after the second review:* that figure compared the best on the first roll with the best by the mean over all three rolls, the first included, and counted a tie as agreement. It overstates the stability. The measure with the other rolls held apart is in the next section.
- **This policy could not read it at the start.** A fair adaptive policy picks an approach at the first decision from what the French see: their own strength and the scouts' reports. It learns on 500 seeds and is judged on 500 others. It does no better than always taking the best fixed approach (mean rank 2.60 against 2.57), while an oracle that knows each ending would reach 2.21. *That oracle knew the dice as well as the scenario, so it is not a bound on reading the situation; see the next section.*
- **What may decide the best approach is hidden at the first decision:** the Russian command's temper and pressure, the weather, the strengths of the forces not yet seen.

  To the player, much of the outcome's variance may therefore be effectively luck unless the game lets them learn these things in time. *This experiment does not establish that:* one simple policy reading two figures is not a player, and it never re-decides. The design answer is information: scouting, reports of Russian movement, events such as the false report of 1812 (H-012), and a staff assessment that reads them.

  The next measure should be an adaptive policy that re-decides every turn with what is visible then.
- **Spacing of the ranks matters little:** with Costly Victory above Operational Success the shares become 32% / 5% / 44% / 19%.

**The competent variants, and what they exposed:**
- **The patient push does worse.** Gathering at Rudnia before attacking ends in Repulse in 57% of games, and Smolensk is held in only 35%. The four turns spent gathering let the Russians strike or settle in. Concentrating is not free, and this bot does not yet know when to stop waiting.
- **No halt consolidates.** The supplied halt first moves Eugène's corps to Vitebsk and Davout's to Orsha, then halts. It still ends Precarious in every game. At the end every French depot is empty, and Eugène's and Poniatowski's corps starve.

  The scenario's placeholder stocks (G-012: 2.1 million rations in French depots) plus the countryside within reach cannot feed 185,000 men through a 20-day halt. That is a question for research on the 1812 magazines, not a reason to loosen the sustainability test.
- **An engine defect, found and fixed.** Groups sharing a depot that ran short drew in the order of their names, so the Guard ("fr-guard") ate while Eugène ("fr-left") starved beside it. They now share by need. The effect on the batch is small, because the depots run dry either way.

**F1–F3:**
- Among the tested bots, the southern envelopment is the only one that wins, and it is best on 73% of seeds (F3 fails). That makes it dominant among these bots, not proven dominant in the game.
- Decisive Success appears on 11% of seeds (F1 is a lower bound, using only these bots).
- Both follow from the outcome model as designed (D-035) and the placeholder battle model: only cutting the Moscow road wins.

**Still open from the review:**
- F3 by openings: branch the first two directives from the same start, with a shared continuation.
- An adaptive policy that re-decides every turn.
- Bots that know when to stop concentrating.
- The research on the 1812 magazines.

## Acting on the results

1. **First ask whether the model is plausible and the result understandable.** A low decisive-success rate that follows from historically plausible rules is a finding, not a bug.
2. **Acceptable fixes:** correcting bugs or implausible AI behaviour; giving the player better information or feedback; adjusting labelled game assumptions within their documented plausible ranges.
3. **Never:** special-case rules, hidden bonuses, rubber-banding, difficulty that secretly adapts, or changing documented facts to hit a number.
4. **Targets can be revised** after testing, with the evidence and reasoning recorded in DECISIONS.md.

When these goals conflict, the order of priority is: historical plausibility → meaningful player agency → achievable outcomes → understandable consequences.

## The second independent review (rules 0.12.0, 1 November 2026)

The second review found five defects, a missing control and a misread source (D-037; [record](reviews/2026-11-01-second-review.md)). The figures below are for the adopted rules, foraging reach 11 km included. Reports: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-01-rules-0.12.0.md), [the adaptive policy](balance/2026-11-01-adaptive-0.12.0.md), [the supply-stance probe](balance/2026-11-01-supply-stance-0.12.0.md) and [what-if runs on the foraging reach](balance/2026-11-01-whatif-reach.md). Integrity holds: zero invariant violations in 27,000 games.

**Won (Decisive Success, Costly Victory or Operational Success), every game:**

| Strategy | rules 0.11.0 | rules 0.12.0 | Operational Collapse, 0.11.0 → 0.12.0 |
|---|---|---|---|
| concentrated-push | 0.4% | 0.0% | 33.1% → 7.1% |
| southern-envelopment | 66.2% (Decisive 11.3%) | 82.2% (Decisive 1.5%) | 1.5% → 1.5% |
| bait-and-converge | 0.0% | 0.0% | 0.0% → 0.0% |
| methodical | 0.2% | 0.0% | 0.1% → 0.3% |
| rush | 0.0% | 0.0% | 13.2% → 9.4% |
| prudent and supplied halts | Precarious Halt in every game | the same | — |

**Where the changes come from**, traced by reverting one fix at a time on 300 seeds:
- **The road order spared the direct approaches.** With the old rule, the concentrated push collapses in 104 of 300 games; with the new one, in 28. Faster French columns can no longer slip past Russian columns level with them. Why the passing led to collapse has not been traced yet.
- **The southern envelopment now holds Valutino.** Before, a group on its last stretch into the objective was sent back out to rejoin the route, so the corps rarely stood at Valutino long enough. With only that fix reverted, Costly Victory falls from 238 to 158 of 300 games.
- **Its Decisive Successes became Costly Victories** because each ration now counts once. In 211 of the 238 costly victories traced, the army was capable but its supply was not sustainable. The groups short most often were Eugène's left wing, the Guard and headquarters, and the right wing.

**The experiment, with the corrected measures:**
- **Variance of the ending:** strategy 39%, scenario 4%, which strategy suits which scenario 45%, dice 13%. With the ranks spread out: 50% / 3% / 36% / 10%.
- **Stability, with the other rolls held apart:** where one approach is best on a scenario's first roll and one on its other two, they agree on 99.6% of 791 scenarios. The other 21% of scenarios have a tie for best.
- **Reading the situation:** an oracle that knows the scenario but not the dice would beat the best fixed approach by 0.13 ranks; one that also knows the dice, by 0.17. The adaptive policy gains nothing, because it learns to pick the southern envelopment in every cell. Among these bots there is little left to read at the first decision.
- **Supply stance:** bringing depots forward helps bait and converge most (better on 14% of seeds, worse on 2%). For the other approaches it rarely changes the ending's rank.

**What it means, among the tested bots:**
- **The southern envelopment is dominant.** It is best on 85% of seeds (F3 fails), and it wins mostly at a price: the Moscow road is cut, but the army that cut it cannot be fed there.
- **Decisive defeat in battle:** no tested approach reached it on 0.11.0, and 0.12.0 also requires a Russian rout. The batch does not yet count how often the Russians are decisively defeated rather than cut off; it should. Either way it is a finding about the placeholder battle model, which the sector battles (§2.10) replace.
- **No tested halt consolidates**, at any foraging reach from 7.5 to 22 km.

**The foraging reach is now 11 km** (G-019; your decision, "Adopt 11 km"). Read correctly, the source gives 7.5–15 km; 11 km is half the width of its square for extended operations, the case first chosen. The what-if runs over 7.5–22 km came first. No approach family's ending moves by as much as half a point across that range, because their groups march concentrated. Against 22 km, the methodical bot is repulsed more often (35% against 30%). The halts lose more horses (the prudent halt 9.4% against 4.7%) and end with less food (2.7 days against 4.1).

## Movement in time order (rules 0.13.0, 1 November 2026)

The second review's recommended next phase (D-038). Within each hour, forces now arrive and set out in time order across both sides, instead of one after another in the order of their names; a column that catches an enemy column follows at its pace; and a tied attacker is drawn instead of always being French. Reports: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-01-rules-0.13.0.md), [the adaptive policy](balance/2026-11-01-adaptive-0.13.0.md), [the supply-stance probe](balance/2026-11-01-supply-stance-0.13.0.md). Integrity holds: zero invariant violations in 27,000 games, now including the road-order check. No rule value changed.

| Strategy, every game | Won, 0.12.0 → 0.13.0 | Operational Collapse | Repulse | Battles a game |
|---|---|---|---|---|
| concentrated-push | 0.0% → 0.0% | 7.1% → 4.3% | 1.4% → 1.5% | 4.3 → 3.4 |
| southern-envelopment | 82.2% → 83.1% | 1.5% → 1.3% | 6.8% → 7.4% | 2.1 → 2.0 |
| bait-and-converge | 0.0% → 0.0% | 0.0% → 0.0% | 6.3% → 6.5% | 2.3 → 2.5 |
| methodical | 0.0% → 0.2% | 0.3% → 0.3% | 35.3% → 30.2% | 2.3 → 2.4 |
| rush | 0.0% → 0.0% | 9.4% → 6.1% | 0.7% → 0.8% | 3.4 → 3.1 |

**Where the changes come from**, traced on 300 seeds with the attacker rule alone reverted:
- **The attacker rule.** The French now attack in 48% of the concentrated push's battles instead of 62%, and in 46% of the rush's instead of 64%; the old rule handed them every tie. With the old rule the push collapses in 22 of 300 games, with the new one in 16.
- **The time order.** The push fights fewer battles (3.4 a game against 4.3), and French corps join battles under way about half as often (0.8 a game against 1.4). That part does not depend on the attacker rule. Why the hour-by-hour sweep produced more battles has not been traced.

**The experiment:** strategy 42% of the variance, scenario 4%, which strategy suits which scenario 42%, dice 12% (with the ranks spread out: 53% / 3% / 34% / 10%). The best approach on a scenario's first roll is the best on its other two on 99.4% of 784 untied scenarios; 22% of scenarios have a tie. The southern envelopment is still best on 85% of seeds, and the adaptive policy still picks it everywhere; a scenario oracle would gain 0.12 ranks.

**Cost:** the batch takes about 1.7 times as long (808 s against 484 s for 27,000 games, run alongside two other probes). One game in the browser is unaffected in practice.

## What a cut road earns (rules 0.14.0, adopted: graded, 1 November 2026)

The second review's finding D3: holding the Moscow road for two sub-steps counts as cutting the Russians off for good, even if they then get away. Three options were measured as what-ifs on rules 0.13.0 ([report](balance/2026-11-01-whatif-cutoff.md)): *stands* (the rule now), *at the end* (cut off only if still cut off when the campaign ends), and *graded* (that, plus "forced out" for a break-out at a heavy cost in battle, and a mention for a cheap escape). The batch now also reports what happened to the Russian main armies, and how often their road was cut.

- **The cut rarely lasts.** The southern envelopment cuts the road in 82% of its games; the Russians are still cut off at the end in 1.2%. They break out at a heavy cost in 25% and get away cheaply in 57%.
- **No tested approach inflicts a decisive defeat in battle**, under any option (now counted directly).
- **Under "at the end" or "graded", no tested approach wins.** The southern envelopment falls from 82% Costly Victory to Limited Success (47%), Inconclusive (24%) and Repulse (26%), and no family dominates any more (F3: push 42%, bait and converge 40%, southern envelopment 19%).
- **The two give the same endings with these bots,** because a "forced out" becomes an Operational Success only if the French army is also capable, fed and secure, which this bot's army never is.
- **History:** at Valutino (19 August 1812) the French threatened the road, but Barclay's army slipped away east and the day was indecisive (H-019). That is the case the game is modelling, and it argues against a lasting victory for a brief interruption.

**Decided (D-039): graded.** Still cut off at the end: cut off. Broken out at a heavy cost in battle: forced out, which is an Operational Success if the French army is capable, fed and secure. Got away cheaply: a line in the report. Reports on the adopted rules: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-01-rules-0.14.0.md), [the adaptive policy](balance/2026-11-01-adaptive-0.14.0.md), [the supply-stance probe](balance/2026-11-01-supply-stance-0.14.0.md). Zero invariant violations in 27,000 games.

| Southern envelopment, every game | rules 0.13.0 | rules 0.14.0 |
|---|---|---|
| Decisive Success or Costly Victory | 82.7% | 1.6% |
| Operational Success | 0.4% | 1.5% |
| Limited Success | 7.1% | 45.8% |
| Inconclusive | 1.0% | 23.0% |
| Repulse | 7.4% | 26.7% |

**What it means, among the tested bots:**
- **No tested approach wins.** Every one now ends, at best and most often, in Limited Success (the push 94%, bait and converge 93%, the methodical bot 69%, the southern envelopment 46%). A win needs the trap kept shut to the end, a costly break-out with the army in order, or a real decisive battle, and these bots manage none of them more than once or twice in a hundred games.
- **No family dominates any more** (F3: the push best on 42% of seeds, bait and converge 40%, the southern envelopment 19%). But that is a balance among approaches that do not win, not the fairness F3 is meant to show.
- **Most scenarios now have a tie for best** (94%), since most approaches end in Limited Success; the stability measure is little use until endings spread again.
- **The variance split moves back** to strategy 27%, scenario 6%, which strategy suits which scenario 48%, dice 19%.
- **Reading the situation:** the best fixed approach is now bait and converge; a scenario oracle would gain 0.18 ranks, and the adaptive policy still gains nothing.

**What it asks for next:** not a looser rule, but bots (and, in time, players) that can do what the rule now demands: hold Valutino and feed the army there, or concentrate for a decisive battle. And the sector battles of §2.10, which replace the placeholder battle model that never produces a decisive defeat.

## Supply issued by need, and forecasts that follow the rules (rules 0.15.0, 2 November 2026)

The second review's supply findings (D-040). Wagon trains hand over what the group would draw at a depot; "sustainable" is judged day by day; the staff's arrival forecast runs the engine's own movement. Reports: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-02-rules-0.15.0.md), [the adaptive policy](balance/2026-11-02-adaptive-0.15.0.md), [the supply-stance probe](balance/2026-11-02-supply-stance-0.15.0.md). Zero invariant violations in 27,000 games.

**A loophole, found on the way.** A corps standing at its depot drew four days' food from it, and its own wagon train then loaded more at the same depot and handed it over. That is how corps set out with full wagons, and how the Guard at Vitebsk could sit on eight days' food while Eugène's corps starved. Closing it with the four-day issue kept as it was (a placeholder never registered) tripled the marching armies' collapses; issuing as much food as a corps can carry, the researched carrying rule (G-019), did not. Measured on 300 seeds per bot (the 0.14.0 collapses from its batch):

| Issue rule | Push collapse | Southern collapse | Rush collapse | Prudent halt with uneven stocks |
|---|---|---|---|---|
| 0.14.0 (the loophole) | 4% | 1% | 6% | 95% |
| Four days' food, loophole closed | 15% | 14% | 16% | 0% |
| **All the food it can carry (adopted, your decision)** | 0% | 1% | 0% | 27% |

**On the adopted rules,** against 0.14.0, every game:

| Strategy | Operational Collapse | Repulse | Limited Success | French men lost | Smolensk held |
|---|---|---|---|---|---|
| concentrated-push | 4.3% → 0.3% | 1.5% → 1.1% | 94.2% → 98.6% | 27.9% → 25.5% | 98% → 99% |
| southern-envelopment | 1.3% → 0.1% | 26.7% → 27.3% | 45.8% → 46.2% | 21.7% → 19.7% | 48% → 46% |
| bait-and-converge | 0.0% → 0.0% | 6.5% → 3.0% | 93.1% → 96.8% | 23.2% → 21.8% | 93% → 97% |
| methodical | 0.3% → 0.0% | 30.2% → 2.6% | 69.3% → 97.3% | 23.6% → 13.7% | 69% → 97% |
| concentrated-push-staged | 6.9% → 0.5% | 56.9% → 8.7% | 35.8% → 90.3% | 28.9% → 26.0% | 36% → 90% |

- **Fed armies hold together.** Collapse all but disappears, and the slower approaches that used to be repulsed now take Smolensk. Little is left by the road: the push abandons 2,400 rations in a game instead of 95,000.
- **Still no tested approach wins.** Every one ends, at best and most often, in Limited Success; the halts still end precarious. Feeding the army was not what stood between these bots and a victory.
- **Uneven stocks remain where position makes them:** a corps beside a depot can fill its wagons while a distant one goes short (29% of prudent halts, 9% of concentrated pushes). That is a matter of where the corps stand, not an engine quirk, and it is now visible in the report.
- **The experiment:** strategy 49% of the variance, scenario 4%, which strategy suits which scenario 27%, dice 20%; but 98% of scenarios now tie for the best approach, since nearly everything ends in Limited Success, so these shares say little. The adaptive policy and the oracles are within 0.04 ranks of the best fixed approach (now the rush).
- **Forecasts:** the staff's arrival forecast now equals the engine's arrival when nothing intervenes (tested for a tired, dispersed corps and a forced march).

## The experiment, reported as the second review asked (rules 0.15.0, 2 November 2026)

No rule changed; the same games are reported more carefully (D-041). The [batch](balance/2026-11-02-rules-0.15.0.md) and [adaptive](balance/2026-11-02-adaptive-0.15.0.md) reports for 0.15.0 were rerun with it; their ending tables are unchanged.

- **"The dice" are resolution randomness:** battles, withdrawals, road priority and burned stores. Weather and scouting errors are part of the scenario, so they count under "scenario".
- **Much of the "suitability" was dice noise.** Each strategy–scenario cell is a mean of only three rolls, so it still carries luck, and the raw split books that luck as interaction. Taking it out:

  | Share of the ending's variance | Raw | Noise-adjusted |
  |---|---|---|
  | strategy | 48.6% (46.4–50.7) | 48.6% (46.4–50.7) |
  | scenario | 4.2% (3.7–4.7) | 3.0% (2.5–3.5) |
  | which strategy suits which scenario | 27.4% (25.7–29.2) | 18.7% (16.8–20.8) |
  | dice | 19.8% (18.4–20.8) | 29.8% (27.6–31.2) |

  (95% intervals from a bootstrap over scenarios.) Earlier versions' "about half the outcome is suitability" was the raw figure, and overstated.
- **The headline figures are precise; what they describe is narrow.** Each family's mean rank is known to about ±0.02 and its share of seeds as best (F3) to about ±1 point (push 42%, bait and converge 40%, southern envelopment 17%). But 98% of scenarios tie for best, because nearly every approach ends in Limited Success.
- **Choosing on the first roll costs 0.12 ranks** on average on the other rolls (regret).
- **Reading the scenario is worth almost nothing among these bots.** An oracle that chooses each scenario's approach on its other rolls, so it never sees the dice it is scored on, beats the best fixed approach (now the rush) by 0.01 ranks (−0.03 to +0.01); one that also knows the dice, by 0.04 (0.03 to 0.06). The earlier oracle, scored on the rolls it chose on, was optimistic.
- **Not yet done:** nested resampling of the adaptive policy's learning, and a per-turn adaptive policy with the full French observations (the review's suggested next experiment).

## Better bots, and a retreat through the block (rules 0.16.0, 2 November 2026)

Two competent variants, built after the second review: a **southern envelopment that holds** Valutino to the end once Smolensk is taken or Valutino reached, standing to fight there; and a **concentrated strike** that gathers the army around Rudnia, then marches on the largest Russian army its scouts have seen. Reports: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-02-rules-0.16.0.md), [the adaptive policy](balance/2026-11-02-adaptive-0.16.0.md), [the supply-stance probe](balance/2026-11-02-supply-stance-0.16.0.md). Zero invariant violations in 33,000 games.

**Why the trap never held, found by building the bot:**
- **The original bot turned back.** It made for Valutino only while it held Smolensk; once its corps left Smolensk for Valutino it no longer held it, and turned the army round. That is the reviewer's seed 7.
- **And the rules let the Russians through (D-042).** Committing to Valutino alone changed nothing: in twelve traced games the whole French army stood at Valutino at the end, and both Russian armies were marching away east beyond it. They had attacked the block, lost, and fallen back towards their depot at Dorogobuzh, which is to say through the block. A beaten attacker now falls back the way it came.

**Results:**

| Strategy, every game | Costly Victory | Limited Success | Inconclusive | Repulse | Road cut | Still cut off at the end |
|---|---|---|---|---|---|---|
| southern-envelopment (0.15.0 → 0.16.0) | 1.6% → 9.2% | 46.2% → 51.0% | 24.6% → 16.4% | 27.3% → 22.8% | 83% → 84% | 1.7% → 9.3% |
| **southern-envelopment-hold** (new) | 35.1% | 2.0% | 29.7% | 32.8% | 86% | 35.2% |
| concentrated-strike (new) | 0.0% | 71.2% | 11.9% | 16.9% | — | — |

- **Holding the trap now wins a third of the time.** The holding envelopment is the first bot that wins regularly. Its wins are costly, not decisive (Decisive Success 0.1%): the army at Valutino cannot be fed there.
- **Why it cannot be fed:** the army has outrun its wagon trains. *Corrected the same day after a what-if run ([report](balance/2026-11-02-whatif-haul.md)):* this first blamed the 80 km line-haul limit (G-016), since Liozno to Smolensk is 106 km by road and Rudnia to Smolensk's north bank 81 km. Lifting the limit altogether changes the ending in 2 of 1,000 games, although line trains then stock Smolensk.
  - Supply is the gate: in 336 of the 350 games that end with the Russians cut off, the army is capable but not fed.
  - The groups march 22 km a day, their trains 18. The Guard's train follows it round the southern swing and never catches it; it ends behind it with the Guard's four days of food still aboard. Most other trains are on their way back to Liozno or Vitebsk to reload, about 13 days there and back. Valutino is stripped, and a depot at Smolensk feeds only the groups standing at it.
  - The army outran its supply in 1812 too. Whether a player can feed the trap by planning for it is a question for a bot or a playtest; the haul limit stays.
- **A decisive battle stays out of reach.** The concentrated strike fights far fewer battles than the staged push (about 1.2 a game against 2.7, on 300 seeds), but the Russian main armies never break: their marshal withdraws in good order once cohesion falls below 350, and an army breaks only below 250. The routs in the batch are of small detachments. This is the placeholder battle model again (§2.10).
- **Choosing by scenario now matters.** With one approach that sometimes wins and sometimes fails badly, an oracle that chooses per scenario on its other rolls would gain 0.26 ranks over the best fixed approach (0.21 to 0.31); the two-figure adaptive policy gains nothing. The interaction share is 43% noise-adjusted (41–44).
- **The original families stay balanced** (F3: push 37%, bait and converge 36%, southern envelopment 27%); the new bots are competent variants, outside the families, as the staged push and the supplied halt are.

## Feeding the trap (bots, rules 0.16.0, 2 November 2026)

Can a player feed the army that holds Valutino by planning for it? Two more variants of the holding envelopment, no rule change. Reports: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-02-rules-0.16.0-feeding-the-trap.md), [the adaptive policy](balance/2026-11-02-adaptive-0.16.0-feeding-the-trap.md), [the supply-stance probe](balance/2026-11-02-supply-stance-0.16.0-feeding-the-trap.md). Zero invariant violations; the bots that were already there end exactly as in the 0.16.0 reports.

**What a traced game shows** (the holding envelopment, seed 5):
- Three of the five groups set out with 2½–3½ days of food, are empty by turns 3–4, and go hungry for most of the rest of the game.
- Their wagon trains trail behind them, loaded, for most of the game; the vanguard's never catches up at all. The trains are slower on every road and slowest where the army goes: on the track and pontoon from Rasasna to Liady, under half their post-road pace.
- The Guard fills up to 13 days at Vitebsk and eats it all on the 234 km swing.

**The two variants:**
- **Waiting for the trains** (`southern-envelopment-wait-for-trains`), as first proposed: a group with less than a day's food halts for its wagon train when the train is loaded and within 36 km behind it. 36 km was chosen over 72 km on seeds 1–200; 72 km did worse on both counts.
- **The Guard at the base** (`southern-envelopment-guard-at-base`): the Guard and headquarters stay at Vitebsk with the main magazine while the corps make the swing. It was the best of four supply-minded variants tried on seeds 1–200, so the batch, which includes those seeds, slightly flatters it. The others were the same with a halt of one or two turns to fill up first, and those halts let the Russians strike first: Repulse 51–66%.

| Strategy, every game | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Still cut off at the end | Food days at end |
|---|---|---|---|---|---|---|---|---|
| southern-envelopment-hold | 0.1% | 35.1% | 0.0% | 2.0% | 29.7% | 32.8% | 35.2% | 1.9 |
| southern-envelopment-wait-for-trains | 0.0% | 24.9% | 0.0% | 22.0% | 26.8% | 25.8% | 24.9% | 0.8 |
| southern-envelopment-guard-at-base | 6.4% | 24.5% | 7.7% | 1.1% | 31.7% | 28.6% | 30.9% | 4.1 |

**Reading:**
- **Halting for the wagons does worse.** The groups eat the train's load on the march, the train then goes back to reload, and the trap is sprung later: the Russians end cut off in 24.9% of games instead of 35.2%.
- **Leaving the Guard at the base wins decisively**, the first approach to do so in a measurable share: 6.4% Decisive Success and 7.7% Operational Success. The block holds nearly as often without the Guard. The Guard, which was the group left unfed in every cut-off game of the first 200 seeds, is now fed at Vitebsk.
- **The corps at Valutino are the limit now.** Of the 64 games in seeds 1–200 that end with the Russians cut off, 50 still have a corps unfed at Valutino: Eugène's, Davout's or Poniatowski's, each in about half.
- **"Uneven stocks at the end" is 71.5% for this bot, by construction:** the Guard sits at Vitebsk with full packs while the corps at Valutino go hungry.
- **Reading the scenario is worth more with these choices.** An oracle choosing per scenario on its other rolls now gains 0.49 ranks over the best fixed approach (0.44 to 0.55), up from 0.26; the two-figure adaptive policy still gains 0.01.
- **The families are unchanged** (F3: push 37%, bait and converge 36%, southern envelopment 27%). F1 and F2 count only the families, so they are unchanged too.

## Sector battles (rules 0.17.0–0.17.1, 2 November 2026)

The placeholder round model is replaced by the sector battles of §2.10 (D-043; contracts in TECHNICAL_ARCHITECTURE §3.4b). Reports: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-02-rules-0.17.1.md), [the adaptive policy](balance/2026-11-02-adaptive-0.17.1.md), [the supply-stance probe](balance/2026-11-02-supply-stance-0.17.1.md), [the sensitivity of four battle values](balance/2026-11-02-sensitivity-0.17.1.md). Zero invariant violations in 39,000 games, with every man, horse and gun of a force in battle checked at every pause.

**Endings, before and after** (the 0.16.0 figures are from [the report with the bots that feed the trap](balance/2026-11-02-rules-0.16.0-feeding-the-trap.md); same bots, scenarios and dice):

| Strategy | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse |
|---|---|---|---|---|---|---|---|
| concentrated-push | 0.0% → 0.0% | 0.0% → 0.0% | 0.0% → 0.0% | 98.8% → 96.6% | 0.0% → 0.0% | 0.9% → 1.0% | 0.3% → 2.5% |
| southern-envelopment | 0.0% → 0.0% | 9.2% → 9.6% | 0.1% → 0.0% | 51.0% → 48.6% | 16.4% → 13.2% | 22.8% → 27.1% | 0.4% → 1.4% |
| bait-and-converge | 0.0% → 0.0% | 0.0% → 0.0% | 0.0% → 0.0% | 96.8% → 91.8% | 0.2% → 2.5% | 3.0% → 5.7% | 0.0% → 0.0% |
| southern-envelopment-hold | 0.1% → 0.1% | 35.1% → 29.4% | 0.0% → 0.0% | 2.0% → 3.7% | 29.7% → 23.6% | 32.8% → 42.5% | 0.3% → 0.7% |
| southern-envelopment-guard-at-base | 6.4% → 4.8% | 24.5% → 21.1% | 7.7% → 7.4% | 1.1% → 2.1% | 31.7% → 25.8% | 28.6% → 38.7% | 0.0% → 0.0% |
| concentrated-strike | 0.0% → 0.0% | 0.0% → 0.0% | 0.0% → 0.0% | 71.2% → 71.7% | 11.9% → 11.2% | 16.9% → 17.1% | 0.0% → 0.0% |

**Reading:**
- **A Russian main army can now break in battle,** in up to 32 battles per 100 games for the trap (32 for the holding envelopment and for the Guard at the base, 19 for the original southern envelopment). Under the placeholder model it never did. *Corrected the same day:* the first report took each battle's result from the log entry written before the pursuit, which can turn a withdrawal into a rout, so it undercounted routs (28, 30 and 16 here). The battle table was rerun counting from the battles themselves; the endings did not change.
- **But no tested approach has produced a decisive battle defeat** in 39,000 games. A main army breaks when it is already worn by hunger, earlier fights and the shock of lost sectors, after modest losses in that battle; a decisive defeat also needs 30% of its strength lost within four days in battles the French won. Heavy losses and lost ground ending in an orderly withdrawal, the pattern of Borodino (H-018), is what the model produces by default.
- **No army was ever trapped.** The bots never close every road out of a battlefield. The Russians' road out is contested more often than open (142 against 82 per 100 games for the holding envelopment), which makes their withdrawals costlier, but blocking needs a player, or a bot, that sets out to pin.
- **The trap wins a little less often.** The Russian armies that attack the block at Valutino now sometimes break it: the French routed in 26 battles per 100 games of the holding envelopment, and Repulse rose to 42.5%. The original families stay balanced (F3: push 38%, bait and converge 35%, southern envelopment 28%).
- **Reading the scenario still matters, and no simple policy does it:** an oracle choosing per scenario on its other rolls would gain 0.36 ranks (0.30 to 0.43); the two-figure adaptive policy gains nothing.
- **Battles last most of a day:** 3.6 to 5.1 rounds of two hours on average for the purposeful bots, 2.5 to 3.0 for the halts and random play. In the traced games, large corps overran small detachments in two or three rounds.

**The four values with the largest effects, measured** (500 seeds per variant, the same dice): what a contested exit costs, the pursuit rate, the flank and the shock of a lost position.
- None moves any ending by more than 2.6 percentage points (13 games in 500), and none produces a single decisive defeat.
- The shock of a lost position moves the most: at 40, 80 or 120 cohesion, a Russian main army broke in 21, 31 or 39 battles per 100 games of the holding envelopment, the French routed in 22, 32 or 45 per 100 games of the concentrated push, and the push collapsed in 1.2%, 2.8% or 4.4% of games.
- The pursuit rate moves French routs (the push: 25, 32 or 42 per 100 games, halved to doubled), not the endings. The contested exit's cost and the flank barely register at the bots' level; a player who uses them may feel them more.
- **Kept, all four (your decision at checkpoint B).** No source supports another value, and none changes what the bots achieve. Whether a decisive defeat is reachable is a question of pinning, not of these numbers.

**Next steps (for your decision):** a bot that sets out to pin a Russian army (close its roads out before attacking); your playtest of the sector battles; and research for the battle values, none of which is sourced yet.

## Pinning (bot, rules 0.17.1, 2 November 2026)

Can a Russian army be trapped? A **pinning attack** (`pinning-attack`): a corps on every road out of the place where the largest Russian army seen stands, routed round it, never through; once every road is held, the corps to spare strike. It prefers an army whose roads out can all be reached without passing through it. Report: [the batch, 1,000 scenarios × 3 sets of dice](balance/2026-11-02-rules-0.17.1.md), which includes it.

| Strategy | Operational Success | Limited Success | Repulse | Battles the French lost, per game | French routed per 100 games | A Russian main army broke per 100 games | Russians trapped |
|---|---|---|---|---|---|---|---|
| pinning-attack | 0.1% | 58.6% | 41.3% | 2.0 | 16 | 0 | 0 |

**Reading:**
- **Not one Russian army was trapped** in 3,000 games, and no main army broke.
- **Spreading out to close the roads invites defeat in detail.** The corps stand days apart on roads up to 109 km long, and the Russian armies do not stay to be surrounded: in a traced game they struck one corps at Krasnyi, returned to Smolensk, and left by Valutino. The French lost two battles a game, nearly as many as the plain concentrated push.
- **Waiting for an army to stand still does not help.** A variant that pinned only an army seen at the same place on two turns running, keeping the corps together until then, never began: Smolensk's Old Town is 82 km from Rudnia, beyond the scouts' 60 km, and the Russians struck the waiting army instead (200 seeds: Repulse 69%, no army trapped). It was not kept.
- **The map makes the main position impossible to close.** The road east, to Valutino and Dorogobuzh, hangs off Smolensk's north bank alone, so a Russian army standing there always keeps its road out, and no French force can reach Valutino without going through it. In 1812 there were other ways east: Junot was sent across the Dnieper at Prudichevo towards Lubino, and Barclay regained the Moscow road near Lubino by a side road (H-022, MAP_AND_GEOGRAPHY.md). Neither is in the network yet.

**For your decision:** trace and add a way east of Smolensk that does not pass through the north bank (the Prudichevo crossing to Lubino, the side road from the Porechye road), then test the trap and the pinning again. Without one, a decisive defeat in battle is out of reach on this map, and the fed trap at Valutino is the only road to Decisive Success.

