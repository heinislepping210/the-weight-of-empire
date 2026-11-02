// Core simulation types. All state is plain, serialisable data with stable IDs (§3.3).

export type Side = 'fr' | 'ru';
export type NodeId = string;
export type EdgeId = string;
export type ForceId = string;
export type ConvoyId = string;
export type BattleId = string;

/** Integer quantities: food and fodder in daily rations, ammunition in issue units. */
export interface Supplies {
  food: number;
  fodder: number;
  ammo: number;
}

export type Pace = 'rest' | 'steady' | 'forced';
export type Engagement = 'seek' | 'accept' | 'avoid';
export type Activity = 'march' | 'halt' | 'gather' | 'cross' | 'withdraw' | 'fight';
/** Dispersed forces forage widely but must gather before they can march or fight at full strength (§2.4b). */
export type Posture = 'dispersed' | 'concentrated';
export type RoadClass = 'post' | 'secondary' | 'track';
export type RoadCondition = 'dry' | 'mud';
export type Crossing = 'bridge' | 'ford' | 'pontoon';

/** Daylight sub-steps: 0 = day 1 morning, 1 = day 1 afternoon, 2 = day 2 morning, 3 = day 2 afternoon (§3.4a). */
export type Slot = 0 | 1 | 2 | 3;

export interface SlotRef {
  turn: number;
  slot: Slot;
}

export interface Transit {
  edge: EdgeId;
  to: NodeId;
  /** Distance travelled from `at` towards `to`. */
  metres: number;
}

export interface Force {
  id: ForceId;
  side: Side;
  name: string;
  at: NodeId;
  transit: Transit | null;
  /** Nodes still to march through, in order. */
  route: NodeId[];
  pace: Pace;
  engagement: Engagement;
  activity: Activity;
  posture: Posture;
  /** Sub-steps still needed to finish gathering from dispersal; 0 when not gathering. */
  gathering: number;
  battle: BattleId | null;
  men: number;
  /** Saddle and artillery horses. */
  horses: number;
  wagons: number;
  /** Draught horses for its own wagons: a wagon without its horses stays behind (G-019). */
  draught: number;
  /** 0–1000. */
  fatigue: number;
  /** 0–1000. */
  cohesion: number;
  stock: Supplies;
  /** Received during the current sub-step; joins `stock` at its end (§3.4a). */
  incoming: Supplies;
  marchedToday: boolean;
  movedThisSlot: boolean;
}

export type ConvoyLeg = 'loading' | 'outbound' | 'returning';

/** A wagon park shuttling from its home depot to the force it supplies, or to a depot it stocks (§2.6). */
export interface Convoy {
  id: ConvoyId;
  side: Side;
  home: NodeId;
  /** The force it supplies, or null for a line train that stocks a depot. */
  serves: ForceId | null;
  /** The depot a line train stocks; equal to `home` when the train stands idle. */
  feeds: NodeId | null;
  leg: ConvoyLeg;
  at: NodeId;
  transit: Transit | null;
  route: NodeId[];
  wagons: number;
  /** Draught horses: only the wagons they can draw are loaded (G-019). */
  horses: number;
  cargo: Supplies;
}

export interface Depot {
  node: NodeId;
  side: Side;
  stock: Supplies;
  incoming: Supplies;
}

/** What the countryside around a location can still yield to foragers. */
export interface District {
  food: number;
  fodder: number;
}

export type BattlePhase = 'deploy' | 'rounds' | 'over';
export type RoundAction = 'press' | 'hold' | 'withdraw';
export type NightChoice = 'stay' | 'withdraw';
export type BattleStep = 'deploy' | 'round' | 'nightfall';

export interface BattleState {
  id: BattleId;
  node: NodeId;
  attacker: Side;
  sides: Record<Side, ForceId[]>;
  phase: BattlePhase;
  /** First daylight sub-step in which rounds are fought. */
  startsAt: SlotRef;
  /** Reinforcements: the sub-step index (`slotIndex`) from which each one takes part in rounds (§3.4a step 4). */
  fightsFrom: Record<ForceId, number>;
  roundsFought: number;
  roundsThisSlot: number;
  awaiting: BattleStep | null;
  /** The Russian decision, fixed at the pause and never shown to the player. */
  hidden: RoundAction | NightChoice | null;
  /** Day index of the last nightfall decision taken. */
  lastNight: number;
  winner: Side | null;
  /** Men each force lost in this battle, its retreat included: killed, wounded and taken (§2.13). */
  losses: Record<ForceId, number>;
}

export type Stage = 'orders' | 'activity' | 'movement' | 'contacts' | 'battleRounds' | 'accrual' | 'night' | 'endOfTurn';

export interface Encounter {
  node: NodeId;
  fr: ForceId[];
  ru: ForceId[];
}

/** Where turn resolution stands. Saved with the game, so any pause can be resumed exactly (§3.4). */
export interface Resolution {
  turn: number;
  slot: Slot;
  stage: Stage;
  /** Built at the start of the contacts stage, consumed in order. */
  encounterQueue: Encounter[] | null;
  /** Battles created in this sub-step, for position-derived battle IDs. */
  battleSeq: number;
}

export type LossCause = 'battle' | 'sickness' | 'straggling' | 'withdrawal';

/** Running totals that make conservation checkable (§3.4a). */
export interface Ledger {
  foraged: { food: number; fodder: number };
  consumed: { food: number; fodder: number };
  ammoSpent: Record<Side, number>;
  /** Stores burned when a depot was captured. */
  destroyed: Supplies;
  /** Stores left behind on the march because they could not be carried (G-019). */
  abandoned: Supplies;
  menLost: Record<LossCause, number>;
  horsesLost: number;
}

/** What one side last saw of an enemy force: where, an estimate of its strength, and when (§2.8). */
export interface Sighting {
  at: NodeId;
  men: number;
  turn: number;
}

/** The Russian command's plan for the turn (§2.9). */
export type RussianPlan = 'hold' | 'stand' | 'strike' | 'withdraw';

export interface RussianCommand {
  /** Political pressure to stop retreating, 0–100. */
  pressure: number;
  /** Seeded disposition of the commanders: positive is bolder. */
  temperament: number;
  plan: RussianPlan;
  target: NodeId | null;
  foughtThisTurn: boolean;
}

/** Placeholder until the §2.13 outcome evaluator exists. */
export type Ending = 'scenarioEnd';

export interface GameState {
  schema: 1;
  rulesVersion: string;
  scenarioId: string;
  /** Sets the scenario: strengths, the Russian command's temper, weather and the scouts' estimates (§2.12). */
  seed: number;
  /** Decides the chances of play: battles, withdrawals, skirmishes, burned stores, who gets onto a road first. */
  dice: number;
  resolution: Resolution;
  forces: Record<ForceId, Force>;
  convoys: Record<ConvoyId, Convoy>;
  depots: Record<NodeId, Depot>;
  districts: Record<NodeId, District>;
  roads: Record<EdgeId, RoadCondition>;
  rainToday: boolean;
  battles: Record<BattleId, BattleState>;
  /** Each side's picture of the enemy. The Russian command decides from `intel.ru` only. */
  intel: Record<Side, Record<ForceId, Sighting>>;
  russianCommand: RussianCommand;
  /** The French have declared a halt for the season: final, and no further advance (§2.13). */
  halted: boolean;
  /**
   * How long the Russian main armies' line of retreat has been blocked, in consecutive sub-steps, and when
   * it first counted as cut off (§2.13): held long enough once, it stands.
   */
  cutOff: { held: number; achievedAt: SlotRef | null };
  ledger: Ledger;
  ended: Ending | null;
}

export type Status =
  | { kind: 'awaitingOrders'; turn: number }
  | { kind: 'awaitingBattleInput'; battleId: BattleId; step: BattleStep; round: number }
  | { kind: 'ended'; ending: Ending }
  /** Only seen when stepping stage by stage; `advance` always stops at a pause. */
  | { kind: 'resolving' };

export interface GroupOrder {
  force: ForceId;
  /** Nodes to march through. A force on the road must first reach the end of its current road. */
  route?: NodeId[];
  pace?: Pace;
  engagement?: Engagement;
  posture?: Posture;
}

/** A wagon train's new assignment: supply a force, or stock a depot (§2.6). */
export interface ConvoyOrder {
  convoy: ConvoyId;
  home: NodeId;
  serves?: ForceId;
  feeds?: NodeId;
}

export interface LogisticsOrders {
  /** Found an empty depot where French troops hold the ground. */
  foundDepot?: NodeId;
  convoys?: ConvoyOrder[];
}

export type BattleDecision =
  | { kind: 'deploy' }
  | { kind: 'round'; action: RoundAction }
  | { kind: 'nightfall'; choice: NightChoice }
  | { kind: 'delegate' };

export type Input =
  | { kind: 'orders'; turn: number; orders: GroupOrder[]; halt?: boolean; logistics?: LogisticsOrders }
  | { kind: 'battle'; battleId: BattleId; round: number; decision: BattleDecision };

export interface LogEntry {
  turn: number;
  slot: Slot;
  stage: Stage;
  kind: string;
  detail: Record<string, string | number | boolean | null>;
}
