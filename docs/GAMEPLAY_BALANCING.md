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

## Acting on the results

1. **First ask whether the model is plausible and the result understandable.** A low decisive-success rate that follows from historically plausible rules is a finding, not a bug.
2. **Acceptable fixes:** correcting bugs or implausible AI behaviour; giving the player better information or feedback; adjusting labelled game assumptions within their documented plausible ranges.
3. **Never:** special-case rules, hidden bonuses, rubber-banding, difficulty that secretly adapts, or changing documented facts to hit a number.
4. **Targets can be revised** after testing, with the evidence and reasoning recorded in DECISIONS.md.

When these goals conflict, the order of priority is: historical plausibility → meaningful player agency → achievable outcomes → understandable consequences.
