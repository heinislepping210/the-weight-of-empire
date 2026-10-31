// Bump on any change that alters results; golden replays enforce it (§3.3).
export const RULES_VERSION = '0.1.0';

/**
 * Every value below is a provisional game assumption (HISTORICAL_ASSUMPTIONS.md G-006).
 * They will be replaced by researched ranges in Phase 2 and tuned during balancing.
 */
export const RULES = {
  version: RULES_VERSION,
  march: {
    metresPerSlot: { rest: 0, steady: 11_000, forced: 16_000 },
    roadPermille: { post: 1000, secondary: 850, track: 700 },
    mudPermille: 650,
    crossingPermille: 600,
    fatigueSlowdownFrom: 500,
  },
  convoy: {
    metresPerSlot: 9_000,
    wagonCapacity: 1_000,
    loadPermille: { food: 600, fodder: 300, ammo: 100 },
  },
  fatigue: {
    marchSteady: 70,
    marchForced: 140,
    halt: -20,
    fightRound: 40,
    nightAfterMarch: 80,
    nightAfterRest: 160,
  },
  consumption: { foodPerMan: 1, fodderPerHorse: 1 },
  forage: { haltPerThousand: 300, marchPerThousand: 100 },
  attrition: {
    sicknessPermillePerDay: 3,
    stragglePermilleAtFullShortfall: 20,
    horseLossPermilleAtFullShortfall: 30,
    cohesionLossAtFullShortfall: 100,
    cohesionRecoveryWhenFed: 10,
  },
  weather: { rainPermille: 250 },
  engagement: {
    minorMenThreshold: 3_000,
    withdrawBasePermille: 750,
    withdrawMaxFatigue: 700,
    withdrawalLossPermille: 5,
    minorLossPermille: 20,
  },
  battle: {
    casualtyPermille: { press: 30, hold: 15, withdraw: 0 },
    pressExposurePermille: 10,
    defenderHoldPermille: 800,
    ammoPerThousandMen: { press: 20, hold: 10, withdraw: 0 },
    noAmmoPowerPermille: 600,
    breakCohesion: 250,
    trappedLossPermille: 300,
  },
} as const;

export type Rules = typeof RULES;
