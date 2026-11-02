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
- **Only cutting the Moscow road wins now.** The southern envelopment's second objective is Valutino. Holding it for two sub-steps behind the Russians gives Decisive Success in 13% of games and Costly Victory in 38%, so it is now the best family on 74% of seeds (F3).
- **No approach inflicts a decisive defeat in battle.** The bar is 30% of the Russian main armies lost in battles won within 4 days, which matches battles like Austerlitz or Jena. The placeholder battle model never reaches it.

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
- **But it cannot be read at the start.** A fair adaptive policy picks an approach at the first decision from what the French see: their own strength and the scouts' reports. It learns on 500 seeds and is judged on 500 others. It does no better than always taking the best fixed approach (mean rank 2.60 against 2.57), while an oracle that knows each ending would reach 2.21.
- **What decides the best approach is hidden at the first decision:** the Russian command's temper and pressure, the weather, the strengths of the forces not yet seen.

  To the player, half the outcome's variance is therefore effectively luck unless the game lets them learn these things in time. The design answer is information: scouting, reports of Russian movement, events such as the false report of 1812 (H-012), and a staff assessment that reads them.

  The next measure should be an adaptive policy that re-decides every turn with what is visible then.
- **Spacing of the ranks matters little:** with Costly Victory above Operational Success the shares become 32% / 5% / 44% / 19%.

**The competent variants, and what they exposed:**
- **The patient push does worse.** Gathering at Rudnia before attacking ends in Repulse in 57% of games, and Smolensk is held in only 35%. The four turns spent gathering let the Russians strike or settle in. Concentrating is not free, and this bot does not yet know when to stop waiting.
- **No halt consolidates.** The supplied halt first moves Eugène's corps to Vitebsk and Davout's to Orsha, then halts. It still ends Precarious in every game. At the end every French depot is empty, and Eugène's and Poniatowski's corps starve.

  The scenario's placeholder stocks (G-012: 2.1 million rations in French depots) plus the countryside within reach cannot feed 185,000 men through a 20-day halt. That is a question for research on the 1812 magazines, not a reason to loosen the sustainability test.
- **An engine defect, found and fixed.** Groups sharing a depot that ran short drew in the order of their names, so the Guard ("fr-guard") ate while Eugène ("fr-left") starved beside it. They now share by need. The effect on the batch is small, because the depots run dry either way.

**F1–F3:**
- The southern envelopment is the only approach that wins, and it is best on 73% of seeds (F3 fails).
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
