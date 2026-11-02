# What-if run: no limit on a line train's haul (rules 0.16.0, seeds 1–1000)

**These are not separate rules.** The 0.16.0 report blamed the 80 km line-haul limit (G-016, a placeholder) for the holding envelopment's unfed army at Valutino: Liozno to Smolensk is 106 km by road, and Rudnia to Smolensk's north bank 81 km. This run tests that explanation by removing the limit and halving the depot spacing:

```
BALANCE=1 BALANCE_SEEDS=1000 BALANCE_DICE=1 BALANCE_OVERRIDES='{"logistics":{"maxLineHaulMetres":10000000,"minDepotSpacingMetres":20000}}' npx vitest run tests/balance/batch.test.ts
```

One set of dice per scenario. **Invariant violations: 0.** The game-for-game comparison below comes from a one-off script that plays every seed twice, under the adopted rules and with the limit lifted, with the same dice; it is not kept in the repository.

## The explanation does not hold

| Strategy (1,000 seeds, the same dice) | Better with the limit lifted | Worse | Decisive Success, adopted → lifted | Russians cut off at the end | … of those, French army capable but not fed |
|---|---|---|---|---|---|
| southern-envelopment-hold | 2 | 0 | 0 → 2 | 350 → 350 | 336 → 335 |
| southern-envelopment | 41 | 1 | 0 → 2 | 96 → 96 | 93 → 91 |
| concentrated-push | 4 | 3 | 0 → 0 | 0 → 0 | — |

- **Supply is what keeps the trap from being decisive.** In 336 of the 350 games in which the holding envelopment ends with the Russians cut off, its army is capable but not sustainable. Fed, they would be Decisive Successes.
- **But the haul limit is not what leaves it unfed.** With no limit at all, line trains stock Smolensk (88,000 rations at the end, on average) and the staff founds depots at Krasnyi (552 games) and on Smolensk's north bank (53), yet the army is fed in only one more of those games.
- **The original southern envelopment gains a little:** 41 games of 1,000 end better. By the batch's totals most of them turn Limited Success into Operational Success (0.1% of games with three sets of dice under the adopted rules, 3.9% here).

## Why the army at Valutino is not fed

Traced in the games where the Russians end cut off, under the adopted rules:
- **The trains cannot keep up.** A group marches 22 km a day at a steady pace; a wagon train makes 18 km a day on a post road and less on tracks. Following the Guard round the southern swing, its train never catches it: in the six games traced in detail it ends on the road from Krasnyi to Smolensk with the Guard's four days of food still aboard, 40 km behind in the one followed step by step, while the Guard has none.
- **The others are reloading far behind.** Most of the other groups' trains have delivered and are on their way back to Liozno or Vitebsk; from Liozno to Valutino and back is about 13 days. Valutino's own district is stripped.
- **A depot only feeds the groups standing at it.** A depot at Smolensk, 14 km from Valutino, does not count for the groups at Valutino; only their own wagon trains could bring its stores the last stretch, and they are elsewhere.

## Side effects of lifting the limit (whole batch)

Compared with the adopted rules' report (three sets of dice, so the comparison is approximate):

| Strategy | Depots founded, adopted / lifted | French depots lost | Food moved up by line trains |
|---|---|---|---|
| concentrated-push | 1.00 / 2.29 | 0.02 / 0.27 | 793,033 / 682,340 |
| southern-envelopment | 1.00 / 1.61 | 0.02 / 0.09 | 793,691 / 731,322 |
| southern-envelopment-hold | 1.00 / 1.63 | 0.13 / 0.20 | 793,691 / 727,402 |
| concentrated-strike | 1.00 / 2.58 | 0.00 / 0.47 | 794,932 / 843,784 |

Longer hauls move less food in the same time, and more forward depots are founded and lost. No halt consolidates in either case: the prudent and supplied halts end in Precarious Halt in every game.

**Reading:** an army that springs the trap at the end of a 20-day advance has outrun its wagon trains, under any haul limit. That matches the campaign: the army reached Smolensk worn and hungry, and halted there for about a week afterwards (a secondary source, not yet verified). No source supports a different haul limit, so it stays at 80 km. Whether a player can feed the trap by planning for it, for example by keeping the wagon trains close before springing it, is a question for a bot or a playtest, not for this rule.
