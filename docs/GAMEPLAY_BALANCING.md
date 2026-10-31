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

## Acting on the results

1. **First ask whether the model is plausible and the result understandable.** A low decisive-success rate that follows from historically plausible rules is a finding, not a bug.
2. **Acceptable fixes:** correcting bugs or implausible AI behaviour; giving the player better information or feedback; adjusting labelled game assumptions within their documented plausible ranges.
3. **Never:** special-case rules, hidden bonuses, rubber-banding, difficulty that secretly adapts, or changing documented facts to hit a number.
4. **Targets can be revised** after testing, with the evidence and reasoning recorded in DECISIONS.md.

When these goals conflict, the order of priority is: historical plausibility → meaningful player agency → achievable outcomes → understandable consequences.
