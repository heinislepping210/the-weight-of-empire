/**
 * What cutting the Russian line of retreat earns (§2.13; D-039, `graded` adopted): `stands`, once held long
 * enough it counts for good (rules 0.10.0–0.13.0); `atEnd`, only if they are still cut off when the campaign
 * ends; `graded`, full credit if still cut off, a lesser one (forced out) if they broke out at a heavy cost
 * in battle, none if they got away cheaply.
 */
export type CutOffCredit = 'stands' | 'atEnd' | 'graded';

// Bump on any change that alters results; golden replays enforce it (§3.3).
export const RULES_VERSION = '0.18.1';

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
  /** G-019 (L-009): draught horses an 800 kg wagon needs; a wagon without them stays behind (plausible 1–4). */
  draught: { horsesPerWagon: 2 },
  /** G-019 (L-010): stores a man carries, four days' rations; plausible three to six days. */
  carrying: { manGrams: 3_000 },
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
    /**
     * G-019 (L-011, D-037): how far foragers reach from a dispersed force's place: half the width of the source's
     * foraging square for extended operations (22 km a side; plausible 7.5–15 km). A neighbouring district
     * begins about half-way along the road to its place, so it counts within twice this distance.
     */
    reachMetres: 11_000,
  },
  posture: {
    /** Sub-steps a dispersed force needs to assemble before it can march or fight at full strength. */
    gatherSlots: 2,
    /** Fighting strength lost per gathering sub-step still outstanding. */
    readinessLossPerSlotPermille: 250,
  },
  /** Share of a captured depot's stores burned before it falls, drawn per capture (G-016). */
  capture: { burnMinPermille: 500, burnMaxPermille: 900 },
  /**
   * Staff rules for the supply base (G-016): a new depot at least this far beyond the existing ones, and
   * line trains sent no farther than a few days' haul (80 km is about 4½ days at 18 km/day).
   */
  logistics: { minDepotSpacingMetres: 40_000, maxLineHaulMetres: 80_000 },
  /**
   * How the staff sends a group along a route you chose (§2.4b, D-034, D-050). `on-route`, adopted in 0.18.1: a
   * group already on the route follows it from where it stands, and any other joins where its total road is
   * shortest. What-ifs: `shortest`, before 0.18.1, every group joins where its total road is shortest, which can be
   * after the places that name the route; `by-first-landmark`, as on-route, but any other group joins no later than
   * the route's first named place.
   */
  staff: { joinRoute: 'on-route' as 'shortest' | 'on-route' | 'by-first-landmark' },
  /**
   * What a group is issued at its own side's depot, or from its wagon train: as much food as it can carry
   * (D-040), and fodder and ammunition up to this much (G-020, placeholders).
   */
  depotIssue: { fodderDays: 2, ammoPerThousandMen: 150 },
  attrition: {
    sicknessPermillePerDay: 2,
    stragglePermilleAtFullShortfall: 20,
    horseLossPermilleAtFullShortfall: 30,
    // G-017: hunger acts mainly through straggling; the units that stay together lose heart slowly (plausible 20–60).
    cohesionLossAtFullShortfall: 30,
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
    /** Decisive defeat: battle losses counted over at most this many days (§2.13). */
    decisiveWindowDays: 4,
    /** Cut off: the line of retreat blocked for at least this many consecutive sub-steps (§2.13). */
    cutOffSlots: 2,
    /** D-039: see `CutOffCredit`. */
    cutOffCredit: 'graded' as CutOffCredit,
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
  /**
   * Sector battles (§2.10, TECHNICAL_ARCHITECTURE §3.4b). Every value is a placeholder (G-006, G-022); the
   * contracts they serve are fixed. Rates are per 2-hour round.
   */
  battle: {
    /** Horses a gun takes from the saddle horses: its team and the caisson with it (L-012, G-021; plausible 10–14). */
    horsesPerGun: 12,
    /** Fire a gun adds, in men's worth. */
    gunValue: 40,
    /** A side's power in a sector, by its order. */
    orderPowerPermille: { assault: 1300, press: 1000, hold: 850, fallBack: 500 },
    /** Casualties a side inflicts per 1,000 of its power, by its order. */
    hitPermille: { assault: 30, press: 20, hold: 12, fallBack: 4 },
    /** How exposed a side is to the casualties inflicted on it, by its own order. */
    exposurePermille: { assault: 1300, press: 1100, hold: 800, fallBack: 900 },
    ammoPerThousandMen: { assault: 25, press: 20, hold: 10, fallBack: 4 },
    ammoPerGun: 2,
    /** Power left to a sector without ammunition. */
    noAmmoPowerPermille: 600,
    /** Cohesion lost per man lost, permille of the force's strength: losing a tenth costs 200. */
    cohesionPerLossPermille: 2000,
    /**
     * A side attacking in a sector gains a step on its control track with a chance that grows from nothing at the
     * first power ratio to certainty at the second; an assault at or beyond the second gains two steps.
     */
    advanceFromPermille: 1200,
    advanceSurePermille: 3000,
    /** Cohesion shock to a side when it loses a sector, and when it loses the position (two sectors). */
    sectorLossShock: 40,
    positionLossShock: 80,
    /** Share of the guns in a sector that falls taken by the enemy. */
    gunsCapturedPermille: 300,
    /** A side whose cohesion falls below this routs (contract C). */
    breakCohesion: 250,
    /** Losses to the rearguard of a side breaking off, by its exit (contract D); at night, this share of it. */
    rearguardPermille: { open: 10, contested: 30 },
    nightWithdrawalPermille: 500,
    /** Men lost per 1,000 fresh, mounted pursuing cavalry beyond the screen; a rout suffers more. */
    pursuitPermille: 100,
    routPursuitPermille: 300,
    /** Pursuit never takes more than this share of the pursued side's men. */
    maxPursuitPermille: 150,
    /** How much a cavalryman of the withdrawing side counts in its screen, by its exit. */
    screenPermille: { open: 1000, contested: 1500 },
    trappedLossPermille: 300,
    /** Share of a routed side's guns left behind; a trapped side leaves them all. */
    routGunsAbandonedPermille: 500,
    /** An enemy force this close by road to a side's retreat place contests it (contract D). */
    contestMetres: 15_000,
    /** A charge multiplies what the charging horsemen are worth that round. */
    chargePermille: 1500,
    /** A side that came along two or more roads strikes the enemy's thinnest sector in the flank. */
    flankPermille: 1300,
    /** Cavalry set to screen pursues at this share, and covers its own side's withdrawal this much better. */
    screeningPursuitPermille: 500,
    screeningCoverPermille: 1500,
    /**
     * A side under stand orders, or the Russian command under political pressure at a key place (§2.9), has its
     * marshal break off only below the first cohesion, and withdraw at nightfall only below the second.
     */
    mustStandCohesion: 300,
    mustStandNightCohesion: 400,
    /** The staff's reserve, as a share of each force's infantry and cavalry. */
    reservePermille: 250,
    /** The marshal breaks off below this cohesion, or withdraws at nightfall below the second. */
    withdrawCohesion: 350,
    nightWithdrawCohesion: 450,
    /** Outnumbered by more than this ratio of strength at dawn, the marshal withdraws at nightfall. */
    nightOddsPermille: 800,
    /** A strength ratio at which the marshal presses everywhere, and below which an attacker holds. */
    pressOddsPermille: 1300,
    /** What leaving a battle to the marshal costs: nothing in v1 (your decision, after the review). */
    delegatePenaltyPermille: 0,
  },
} as const;

export type Rules = typeof RULES;
