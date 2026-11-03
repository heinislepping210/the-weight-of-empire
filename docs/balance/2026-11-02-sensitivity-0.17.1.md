# Sensitivity of the sector battles: rules 0.17.1, seeds 1–500, one set of dice

Plan checkpoint B. Each variant changes one placeholder value of the sector battles (G-022) and nothing else; the same bots play the same seeds with the same dice under every variant. **Invariant violations: 0** in all 27,000 games.

```
BALANCE=1 BALANCE_SEEDS=500 npx vitest run tests/balance/sensitivity.test.ts
```

The values varied, each against the adopted one: what a contested exit costs (rearguard 3%: 1.5% or 6%); the pursuit rate (100 men per 1,000 fresh cavalry, 300 in a rout: halved or doubled); the flank (×1.3: ×1.15 or ×1.5); the shock of a lost position (80 cohesion: 40 or 120).

## concentrated-push

| Variant | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse | Mean rank | Russians decisively defeated (games) | A Russian main army broke (per 100 games) | French routed or trapped (per 100 games) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adopted | 0.0% | 0.0% | 0.0% | 96.0% | 0.0% | 1.2% | 2.8% | 3.11 | 0 | 3 | 32 |
| contested exit costs 1.5% | 0.0% | 0.0% | 0.0% | 95.8% | 0.0% | 1.4% | 2.8% | 3.11 | 0 | 2 | 32 |
| contested exit costs 6% | 0.0% | 0.0% | 0.0% | 96.0% | 0.0% | 1.2% | 2.8% | 3.11 | 0 | 3 | 32 |
| pursuit halved | 0.0% | 0.0% | 0.0% | 96.2% | 0.0% | 1.4% | 2.4% | 3.10 | 0 | 2 | 25 |
| pursuit doubled | 0.0% | 0.0% | 0.0% | 95.4% | 0.0% | 1.4% | 3.2% | 3.12 | 0 | 2 | 42 |
| flank ×1.15 | 0.0% | 0.0% | 0.0% | 96.0% | 0.0% | 1.0% | 3.0% | 3.11 | 0 | 2 | 31 |
| flank ×1.5 | 0.0% | 0.0% | 0.0% | 96.0% | 0.0% | 1.2% | 2.8% | 3.11 | 0 | 2 | 32 |
| lost position shock 40 | 0.0% | 0.0% | 0.0% | 97.4% | 0.0% | 1.4% | 1.2% | 3.06 | 0 | 2 | 22 |
| lost position shock 120 | 0.0% | 0.0% | 0.0% | 94.2% | 0.0% | 1.4% | 4.4% | 3.16 | 0 | 2 | 45 |

## southern-envelopment

| Variant | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse | Mean rank | Russians decisively defeated (games) | A Russian main army broke (per 100 games) | French routed or trapped (per 100 games) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adopted | 0.0% | 9.4% | 0.0% | 48.4% | 12.8% | 27.4% | 2.0% | 3.64 | 0 | 18 | 31 |
| contested exit costs 1.5% | 0.0% | 9.4% | 0.0% | 48.4% | 12.8% | 27.4% | 2.0% | 3.64 | 0 | 18 | 31 |
| contested exit costs 6% | 0.0% | 9.6% | 0.0% | 48.2% | 12.8% | 27.4% | 2.0% | 3.64 | 0 | 19 | 31 |
| pursuit halved | 0.0% | 9.4% | 0.0% | 48.4% | 12.8% | 27.4% | 2.0% | 3.64 | 0 | 18 | 26 |
| pursuit doubled | 0.0% | 9.4% | 0.0% | 48.4% | 12.8% | 27.4% | 2.0% | 3.64 | 0 | 19 | 33 |
| flank ×1.15 | 0.0% | 9.6% | 0.0% | 48.2% | 12.8% | 27.4% | 2.0% | 3.64 | 0 | 18 | 30 |
| flank ×1.5 | 0.0% | 9.6% | 0.0% | 48.2% | 12.8% | 27.4% | 2.0% | 3.64 | 0 | 19 | 32 |
| lost position shock 40 | 0.0% | 9.6% | 0.0% | 48.8% | 13.2% | 26.6% | 1.8% | 3.62 | 0 | 15 | 26 |
| lost position shock 120 | 0.0% | 12.0% | 0.0% | 46.6% | 12.8% | 26.4% | 2.2% | 3.60 | 0 | 21 | 34 |

## bait-and-converge

| Variant | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse | Mean rank | Russians decisively defeated (games) | A Russian main army broke (per 100 games) | French routed or trapped (per 100 games) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adopted | 0.0% | 0.0% | 0.0% | 90.6% | 3.8% | 5.6% | 0.0% | 3.15 | 0 | 12 | 2 |
| contested exit costs 1.5% | 0.0% | 0.0% | 0.0% | 90.4% | 3.8% | 5.8% | 0.0% | 3.15 | 0 | 12 | 2 |
| contested exit costs 6% | 0.0% | 0.0% | 0.0% | 90.6% | 3.8% | 5.6% | 0.0% | 3.15 | 0 | 13 | 2 |
| pursuit halved | 0.0% | 0.0% | 0.0% | 90.6% | 3.8% | 5.6% | 0.0% | 3.15 | 0 | 12 | 2 |
| pursuit doubled | 0.0% | 0.0% | 0.0% | 90.6% | 3.8% | 5.6% | 0.0% | 3.15 | 0 | 12 | 2 |
| flank ×1.15 | 0.0% | 0.0% | 0.0% | 90.4% | 4.0% | 5.6% | 0.0% | 3.15 | 0 | 12 | 2 |
| flank ×1.5 | 0.0% | 0.0% | 0.0% | 90.6% | 3.8% | 5.6% | 0.0% | 3.15 | 0 | 12 | 2 |
| lost position shock 40 | 0.0% | 0.0% | 0.0% | 89.0% | 5.4% | 5.6% | 0.0% | 3.17 | 0 | 11 | 1 |
| lost position shock 120 | 0.0% | 0.0% | 0.0% | 91.6% | 2.4% | 6.0% | 0.0% | 3.14 | 0 | 13 | 2 |

## southern-envelopment-hold

| Variant | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse | Mean rank | Russians decisively defeated (games) | A Russian main army broke (per 100 games) | French routed or trapped (per 100 games) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adopted | 0.0% | 27.6% | 0.0% | 4.4% | 21.8% | 45.4% | 0.8% | 3.87 | 0 | 31 | 29 |
| contested exit costs 1.5% | 0.0% | 27.6% | 0.0% | 4.4% | 21.8% | 45.4% | 0.8% | 3.87 | 0 | 30 | 29 |
| contested exit costs 6% | 0.0% | 27.8% | 0.0% | 4.2% | 21.8% | 45.4% | 0.8% | 3.87 | 0 | 31 | 29 |
| pursuit halved | 0.0% | 27.8% | 0.0% | 4.4% | 21.6% | 45.4% | 0.8% | 3.87 | 0 | 29 | 24 |
| pursuit doubled | 0.0% | 27.6% | 0.0% | 4.4% | 21.8% | 45.4% | 0.8% | 3.87 | 0 | 33 | 31 |
| flank ×1.15 | 0.0% | 27.4% | 0.0% | 4.4% | 22.0% | 45.4% | 0.8% | 3.88 | 0 | 31 | 27 |
| flank ×1.5 | 0.0% | 28.0% | 0.0% | 4.2% | 21.6% | 45.4% | 0.8% | 3.87 | 0 | 31 | 30 |
| lost position shock 40 | 0.0% | 26.4% | 0.0% | 5.4% | 21.0% | 46.4% | 0.8% | 3.90 | 0 | 21 | 23 |
| lost position shock 120 | 0.0% | 28.8% | 0.0% | 3.8% | 21.8% | 44.6% | 1.0% | 3.85 | 0 | 39 | 31 |

## southern-envelopment-guard-at-base

| Variant | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse | Mean rank | Russians decisively defeated (games) | A Russian main army broke (per 100 games) | French routed or trapped (per 100 games) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adopted | 3.0% | 21.2% | 6.2% | 2.2% | 25.6% | 41.8% | 0.0% | 3.76 | 0 | 31 | 30 |
| contested exit costs 1.5% | 3.0% | 20.8% | 5.8% | 2.6% | 25.8% | 42.0% | 0.0% | 3.77 | 0 | 31 | 30 |
| contested exit costs 6% | 3.0% | 21.6% | 5.6% | 2.0% | 25.4% | 42.4% | 0.0% | 3.77 | 0 | 31 | 31 |
| pursuit halved | 3.0% | 21.2% | 6.2% | 2.2% | 25.6% | 41.8% | 0.0% | 3.76 | 0 | 30 | 26 |
| pursuit doubled | 3.0% | 21.2% | 6.2% | 2.2% | 25.6% | 41.8% | 0.0% | 3.76 | 0 | 32 | 32 |
| flank ×1.15 | 3.0% | 21.2% | 6.0% | 2.2% | 25.6% | 42.0% | 0.0% | 3.76 | 0 | 31 | 29 |
| flank ×1.5 | 3.2% | 21.2% | 6.0% | 2.2% | 25.4% | 42.0% | 0.0% | 3.76 | 0 | 31 | 31 |
| lost position shock 40 | 3.0% | 20.2% | 5.6% | 2.6% | 25.2% | 43.4% | 0.0% | 3.80 | 0 | 24 | 24 |
| lost position shock 120 | 3.4% | 22.0% | 6.8% | 2.2% | 25.4% | 40.2% | 0.0% | 3.70 | 0 | 38 | 32 |

## concentrated-strike

| Variant | Decisive Success | Costly Victory | Operational Success | Limited Success | Inconclusive | Repulse | Operational Collapse | Mean rank | Russians decisively defeated (games) | A Russian main army broke (per 100 games) | French routed or trapped (per 100 games) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adopted | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.6% | 0.0% | 3.47 | 0 | 0 | 1 |
| contested exit costs 1.5% | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.6% | 0.0% | 3.47 | 0 | 0 | 1 |
| contested exit costs 6% | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.6% | 0.0% | 3.47 | 0 | 0 | 1 |
| pursuit halved | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.6% | 0.0% | 3.47 | 0 | 0 | 1 |
| pursuit doubled | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.4% | 0.2% | 3.47 | 0 | 0 | 1 |
| flank ×1.15 | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.6% | 0.0% | 3.47 | 0 | 0 | 1 |
| flank ×1.5 | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.6% | 0.0% | 3.47 | 0 | 0 | 1 |
| lost position shock 40 | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.4% | 0.2% | 3.47 | 0 | 0 | 1 |
| lost position shock 120 | 0.0% | 0.0% | 0.0% | 70.4% | 12.0% | 17.4% | 0.2% | 3.47 | 0 | 0 | 1 |
