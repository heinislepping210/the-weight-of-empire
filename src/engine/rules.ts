// Bump on any change that alters results; golden replays enforce it (§3.3).
export const RULES_VERSION = '0.5.0';

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
  /** What a force can observe: a base radius plus reach from its horses, capped (§2.8). */
  intel: { baseMetres: 15_000, metresPerThousandHorses: 4_000, maxMetres: 60_000, estimateErrorPermille: 200 },
  /** Provisional outcome thresholds (§2.13, G-004): to be set by testing, never by history. */
  outcome: {
    /** Russian main armies decisively defeated: at least this share of their strength lost, and a battle won against them. */
    decisiveLossPermille: 300,
    /** Below this share lost, the Russian army escaped intact. */
    damagedLossPermille: 100,
    /** French force strong enough to block a road. */
    blockMen: 30_000,
    capableMenPermille: 750,
    capableCohesion: 500,
    sustainableFoodDays: 2,
    collapseCohesion: 250,
    collapseLossPermille: 500,
  },
  /** The Russian command (§2.9). All values are game assumptions (G-014). */
  russian: {
    pressureStart: [55, 75],
    temperament: [-10, 10],
    pressurePerTurn: 3,
    pressurePerOccupiedPlace: 5,
    pressureReliefAfterBattle: 20,
    /** A force with at least this share of Russian strength counts as a main army; the rest screen. */
    mainSharePermille: 250,
    /** A battle with a Russian force this large relieves the pressure. */
    mainArmyMen: 20_000,
    /** Sightings older than this many turns are not acted on. */
    freshTurns: 1,
    threatRadiusMetres: 50_000,
    /** Enemy strength near the base, relative to the main armies, that counts as danger. */
    dangerPermille: 1300,
    mustStandPressure: 80,
    isolationMetres: 40_000,
    strikeReachMetres: 110_000,
    strikeAdvantagePermille: 2000,
    strikeResolve: 60,
    standResolve: 50,
    minFoodDaysToStrike: 3,
    homeRadiusMetres: 5_000,
    /** A screening detachment falls back from enemies this much stronger. */
    screenOddsPermille: 2000,
  },
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
