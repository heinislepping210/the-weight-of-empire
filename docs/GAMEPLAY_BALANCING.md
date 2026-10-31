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

## Acting on the results

1. **First ask whether the model is plausible and the result understandable.** A low decisive-success rate that follows from historically plausible rules is a finding, not a bug.
2. **Acceptable fixes:** correcting bugs or implausible AI behaviour; giving the player better information or feedback; adjusting labelled game assumptions within their documented plausible ranges.
3. **Never:** special-case rules, hidden bonuses, rubber-banding, difficulty that secretly adapts, or changing documented facts to hit a number.
4. **Targets can be revised** after testing, with the evidence and reasoning recorded in DECISIONS.md.

When these goals conflict, the order of priority is: historical plausibility → meaningful player agency → achievable outcomes → understandable consequences.
