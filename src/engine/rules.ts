// Bump on any change that alters results; golden replays enforce it (§3.3).
export const RULES_VERSION = '0.3.0';

/**
 * Values are game assumptions (HISTORICAL_ASSUMPTIONS.md). Those marked with an L- ID sit inside
 * a researched range; the rest are placeholders (G-006) still to be researched and tuned.
 */
export const RULES = {
  version: RULES_VERSION,
  march: {
    // L-001: steady 22 km/day, forced 36 km/day
    metresPerSlot: { rest: 0, steady: 11_000, forced: 18_000 },
    roadPermille: { post: 1000, secondary: 850, track: 700 },
    mudPermille: 650,
    crossingPermille: 600,
    fatigueSlowdownFrom: 500,
  },
  convoy: {
    // L-002: 18 km/day
    metresPerSlot: 9_000,
    // L-005: payload per wagon
    payloadGrams: 800_000,
    /** Share of each wagon's payload *by weight*. */
    loadPermille: { food: 700, fodder: 200, ammo: 100 },
  },
  /** Weight of one unit of supply: a man's daily ration (L-003), a horse's daily fodder (L-004), one ammunition unit. */
  gramsPerUnit: { food: 750, fodder: 9_000, ammo: 1_000 },
  fatigue: {
    marchSteady: 70,
    marchForced: 140,
    halt: -20,
    fightRound: 40,
    nightAfterMarch: 80,
    nightAfterRest: 160,
  },
  consumption: { foodPerMan: 1, fodderPerHorse: 1 },
  /** Gathered per 1,000 men (food) or per 1,000 horses (fodder) per sub-step, by activity. */
  forage: {
    food: { halt: 300, gather: 200, march: 100 },
    fodder: { halt: 450, gather: 300, march: 250 },
    /** A halted, dispersed force spreads its foragers over neighbouring districts and gathers this much more. */
    dispersedPermille: 1800,
  },
  posture: {
    /** Sub-steps a dispersed force needs to assemble before it can march or fight at full strength. */
    gatherSlots: 2,
    /** Fighting strength lost per gathering sub-step still outstanding. */
    readinessLossPerSlotPermille: 250,
  },
  /** A force at its own side's depot tops up to this much at the end of each sub-step. */
  depotIssue: { foodDays: 4, fodderDays: 2, ammoPerThousandMen: 150 },
  attrition: {
    sicknessPermillePerDay: 2,
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
