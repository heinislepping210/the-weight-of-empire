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
export type Activity = 'march' | 'halt' | 'cross' | 'withdraw' | 'fight';
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
  battle: BattleId | null;
  men: number;
  horses: number;
  wagons: number;
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

/** A wagon park shuttling between its home depot and the force it supplies. */
export interface Convoy {
  id: ConvoyId;
  side: Side;
  home: NodeId;
  serves: ForceId;
  leg: ConvoyLeg;
  at: NodeId;
  transit: Transit | null;
  route: NodeId[];
  wagons: number;
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
  roundsFought: number;
  roundsThisSlot: number;
  awaiting: BattleStep | null;
  /** The Russian decision, fixed at the pause and never shown to the player. */
  hidden: RoundAction | NightChoice | null;
  /** Day index of the last nightfall decision taken. */
  lastNight: number;
  winner: Side | null;
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
  menLost: Record<LossCause, number>;
  horsesLost: number;
}

/** Placeholder until the §2.13 outcome evaluator exists. */
export type Ending = 'scenarioEnd';

export interface GameState {
  schema: 1;
  rulesVersion: string;
  scenarioId: string;
  seed: number;
  resolution: Resolution;
  forces: Record<ForceId, Force>;
  convoys: Record<ConvoyId, Convoy>;
  depots: Record<NodeId, Depot>;
  districts: Record<NodeId, District>;
  roads: Record<EdgeId, RoadCondition>;
  rainToday: boolean;
  battles: Record<BattleId, BattleState>;
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
}

export type BattleDecision =
  | { kind: 'deploy' }
  | { kind: 'round'; action: RoundAction }
  | { kind: 'nightfall'; choice: NightChoice }
  | { kind: 'delegate' };

export type Input =
  | { kind: 'orders'; turn: number; orders: GroupOrder[] }
  | { kind: 'battle'; battleId: BattleId; round: number; decision: BattleDecision };

export interface LogEntry {
  turn: number;
  slot: Slot;
  stage: Stage;
  kind: string;
  detail: Record<string, string | number | boolean | null>;
}
