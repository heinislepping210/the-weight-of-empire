# Technical Architecture

How the game is built: stack, modules, simulation integrity, turn resolution, persistence and budgets. *Section numbers (§) are shared across all project documents; the index is in the README.*

## 3.1 Stack and the rendering decision
- **React + TypeScript + Vite.** Exact versions are pinned at setup. The game is UI-heavy — panels, reports, tooltips, accessibility — which is React's strength.
- **No game framework.** Phaser would fight React for the UI and brings physics and scene systems we don't need. **PixiJS** (WebGL 2D) is the fallback for the map layer only, if a measured trigger occurs: under 50 fps while panning or zooming, with all layers on, on a mid-range laptop. The map renderer sits behind an interface, so that swap is contained.
- **The map is three stacked layers:**
  1. **Terrain base.** A raster painted in code from real geodata — rivers, marshes, forests, relief — with watercolour washes, paper texture and engraved linework. Rendered once per zoom band and cached.
  2. **SVG interactive layer.** Locations, roads, supply flows, force markers, route previews, labels. It is crisp at any zoom and focusable for keyboard and screen readers.
  3. **Canvas 2D effects layer.** Convoys in motion, smoke, rain and dust particles.

  A small custom camera built on Pointer Events handles pan, zoom, pinch and focus animations.
- **Animation:** one `requestAnimationFrame` loop interpolates between simulation snapshots and updates elements via refs, with no React re-render per frame. In reduced-motion mode, the map snaps instead of animating.

## 3.2 Modules
```
src/
  engine/       pure TypeScript simulation: state, rules, rng, ai, battle, events, scoring — no DOM, no React
  data/         scenarios, generated geography, sources, assumptions register (JSON + TS types)
  map/          terrain renderer, SVG layers, effects canvas, camera
  battle/       battle screen rendering
  ui/           React screens and components, design tokens
  persistence/  IndexedDB saves, schema migrations, export/import
  media/        asset registry, responsive images, video with fallbacks
  share/        seeds, links, result summary and image
tools/          build-time scripts: geodata pipeline, balance runner, asset checks
tests/          unit/property (Vitest), end-to-end (Playwright)
docs/
```

## 3.3 Simulation integrity
- `resolveTurn(state, orders, rules) → { state, events, causes }` is a pure function. State is plain serialisable data with stable IDs.
- **Integer arithmetic** for all quantities, and no `Math.sin/exp/pow` in the rules. This guarantees identical results across browsers.
- **Counter-based RNG** split into named streams (§2.12).
- **Cause-tagged log.** Every state change records its cause (decision ID / event ID / system). This powers the report's supported causal statements.
- **Rules version** (semver). **Golden replays** — fixed seed + order log → final-state hash — are committed. If a rules change alters them, the version must be bumped; a test enforces this.

## 3.4 Resumable turn resolution (battles and choices that interrupt a turn)
**Principle:** resolution is an explicit state machine whose position is stored *inside* the game state. Nothing waits on the UI, uses timers or asynchronous callbacks, or keeps hidden state in a component.

```ts
// Where resolution stands — part of GameState, saved with it
interface Resolution {
  turn: number;
  subStep: 0 | 1 | 2 | 3;            // daylight sub-steps: D1 AM, D1 PM, D2 AM, D2 PM (§3.4a)
  stage: Stage;                       // position on the §3.4a timeline, including 'night' and 'endOfTurn'
  encounterQueue: EncounterId[];     // fixed, deterministic order
  activeBattle?: BattleState;         // full tactical state, incl. the hidden Russian round plan
}

type Status =
  | { kind: 'awaitingOrders' }
  | { kind: 'awaitingBattleInput'; battleId: string; step: 'deploy' | 'round'; round: number }
  | { kind: 'awaitingEventChoice'; eventId: string }
  | { kind: 'ended'; ending: EndingId };

type Input =
  | { kind: 'orders'; turn: number; directive: Directive; overrides: GroupOrder[] }
  | { kind: 'battle'; battleId: string; round: number; decision: BattleDecision } // incl. 'delegate'
  | { kind: 'eventChoice'; eventId: string; option: string };

// The only way the game moves forward. Pure and deterministic.
function advance(state: GameState, input: Input, rules: Rules):
  { state: GameState; status: Status; log: LogEntry[] };
```

**How a turn runs:**
1. At `awaitingOrders`, the player commits a directive, and `advance` starts the turn.
2. Each daylight sub-step and each night follows the fixed timeline in §3.4a.
3. Encounters are queued in a fixed order: sub-step, then location ID, then sorted force IDs. Minor actions resolve immediately. A **major battle** creates `activeBattle`, and `advance` **returns** `awaitingBattleInput`.
4. In each battle round, the Russian decision is computed from the state at the pause and stored, hidden, in `activeBattle`. The player's input arrives and both resolve together. `advance` then either returns the next round, or ends the battle, applies its consequences, and **continues from the stored cursor** through the rest of the turn.
5. Events that need a choice pause the same way (`awaitingEventChoice`).
6. At nightfall, each side chooses to stay or withdraw. Staying creates a new encounter at the next sub-step that carries over the battlefield state ("Smolensk, day 2"), so multi-day battles need no special case.

**Determinism:**
- Battle IDs come from position in the turn (`turn.subStep.index`), never from time or UI counters.
- Every random draw is keyed by (seed, stream, battle ID, round, sector, purpose). It cannot depend on how long the player thinks, which tooltips they open, or when they saved.
- The Russian AI re-plans only at the start of a turn, plus its engagement response at contact — the same rule as the player, so it gets no mid-turn advantage.

**Saving, loading and replay:**
- Autosave happens after every `advance` call, which means at every pause point, including between battle rounds. The snapshot *is* the full state, cursor included.
- Loading restores the snapshot, and the UI shows whatever `status` says: the orders screen, or the battle at round 3.
- A replay is the initial configuration plus the input log, fed to `advance` each time it asks for input. Each logged input is checked against the status kind and battle ID it was recorded for. A mismatch means a corrupted log or a different rules version, and the game says so.
- The UI animates the `log` entries, which carry half-day timestamps, up to the pause; shows the battle; then animates the rest. Animation never touches state. After a reload the animation is skipped and the dispatch summary is shown instead.

**Tests that must pass before anything is built on top:**
- Saving and loading at random pause points, mid-battle included, gives the same final state hash as an uninterrupted run.
- Replay matches live play at every pause.
- Two battles in one sub-step always resolve in the same order.
- Battles that end by a break, a withdrawal or nightfall all resume correctly.
- State hashes match across Chromium, Firefox and WebKit.
- The timeline tests T1–T10 (TESTING_AND_QA.md) pass.

## 3.4a The turn timeline: when supplies move and are used

A turn is 2 days: **four daylight sub-steps** of 6 hours (06:00–12:00 and 12:00–18:00 on each day) and **two nights**. A battle round is 2 hours, so a sub-step holds 3 rounds. These are game abstractions, recorded as assumptions G-001 to G-003.

**Each daylight sub-step, in this order:**
1. **Availability.** Only supplies already on hand count. A delivery that arrives during a sub-step is held as *incoming* and joins the force's stock at the end of that sub-step (step 6). It can't be used for marching or fighting during the sub-step it arrives in, but it is on hand that night and afterwards.
2. **Activity.** Each force has exactly one activity: *march*, *halt*, *cross* (river crossing or bridging), *withdraw* or *fight*. A force in battle is set to *fight* for every sub-step the battle occupies, so it cannot also march, forage or join another battle.
3. **Movement.** Marching forces and convoys advance as far as their condition at the *start* of the sub-step allows: fatigue, horses, road condition, that day's weather, column length.
   - **Forces move together, hour by hour** (rules 0.8.0, D-031). Each force's six-hour march budget is split into six hourly shares. Every hour, all marching forces advance by their share in a fixed order before the next hour begins.
   - **Contact happens at places, never on the road:**
     - A force that reaches a place held by the enemy stops there; that is contact.
     - A force standing where the enemy also stands does not march on: the contact must be resolved first.
   - **Opposing columns cannot pass each other on a road:**
     - A force may not set out along a road on which an enemy column is coming the other way. It holds its place, and the enemy column reaches it there.
     - If enemy forces stand at both ends of a road and both would set out along it in the same hour, a seeded draw for that road and hour decides which one gets onto it. The other holds its place.
     - A column may not overtake an enemy column ahead of it on the same road. It closes up behind it and follows it to the next place.
   - **A force that could not move at all rests** (activity *halt*) for the sub-step.
   - **Setting out, a force leaves behind what it cannot carry** (rules 0.9.0, G-019): fodder first, then food, ammunition last. The excess goes back into the depot if the force stands at its own depot; otherwise it is abandoned and recorded in the ledger.
4. **Contact.** Contacts found during movement are resolved in this order:
   1. **Reinforcements first.** A force (of either side) that stands at the place of an active battle and is not yet in it joins its own side there, in the fixed order of force IDs. Like a new battle, it deploys at this boundary and fights from the start of the next daylight sub-step. Until then it takes no part in rounds: no losses, ammunition or fatigue from them. It does not forage while assigned to the battle. A force arriving while still gathering keeps its gathering time and its reduced readiness.
   2. **New encounters**, in the fixed order of §3.4. Minor actions resolve at once. Before a major battle, the defender tries to withdraw. If it can't or won't, the battle is set up at the end of the sub-step — this is when you deploy — and its rounds are fought from the start of the next daylight sub-step.
   - **Falling back takes time** (D-031). A force that withdraws, loses a minor action or retreats from a battle leaves the place at once, but onto the road towards its retreat place, at the start of that road. It marches the rest of the way in the following sub-steps, at its own pace (a resting force falls back at a steady pace). A road on which an enemy column is coming the other way is not a line of retreat.
5. **Battle rounds.** Each round takes 2 hours and uses only the ammunition the force carries at that moment. A battle ends when a side breaks or withdraws, or at nightfall. Ammunition can only be topped up by wagons that are already at the battlefield at a sub-step boundary.
6. **Accrual.** Food and fodder gathered by foraging join the force's stock at the end of the sub-step. Foraging yields less while marching and nothing while fighting. Fatigue rises with the activity. Deliveries received during the sub-step join the stock now. A convoy at its home depot loads now and sets out in the next sub-step. Last, a depot held only by the enemy changes hands, part of its stores burned (D-029).

**Implementation:** `src/engine/advance.ts`. Each stage above is one function. `stepOnce` runs a single stage so tests can watch the timeline between pauses.

**Each night:**
1. **Consumption.** A day's food and fodder are taken from stock actually on hand — never from supplies still on the road or in a depot elsewhere. A group's draught horses eat with its other horses. Wagon-train horses graze where they stand at the marching rate, then eat the fodder they carry, then their depot's if they stand at it (G-019).
2. **Shortfall effects.** Any recorded shortfall drives hunger, sickness, straggling, horse losses and loss of cohesion.
3. **Recovery.** Fatigue recovers according to the day's activity. *Not built yet:* stragglers rejoining halted forces near depots (H-017).
4. **Nightfall in battle.** Each side chooses to stay or withdraw (§3.4, step 6). A battle that continues resumes in the next daylight sub-step, across the turn boundary if necessary. Its forces can't take new movement orders meanwhile.
5. **Roads.** Road condition is updated from the day's rain.

**End of turn:** events, political pressure, new intelligence reports (with their age), the next turn's weather forecast, autosave, then `awaitingOrders`. *Built so far:* political pressure and intelligence reports. Events, the forecast and autosave are not built yet.

**Conservation and exclusivity.** Men, horses, wagons, food, fodder and ammunition are conserved: every unit is in exactly one place — with a force, in a depot or on a convoy — or lost with a recorded cause. Each force has one activity per sub-step and belongs to at most one encounter in it.

## 3.5 Persistence
*Status (31 October 2026): designed, not built.* The engine can resume from any saved state, and the tests check this. But the browser does not yet save a campaign: "Save for comparison" in the prototype stores only a summary for the comparison screen. Real saves are an M3 criterion (DEVELOPMENT_ROADMAP.md).

- **A save holds the scenario, seed, dice (D-036) and rules version, the input log (orders, battle decisions, event choices), a snapshot at the latest pause point, and a checksum.** It is stored in IndexedDB through a tiny wrapper (one small dependency, or about 50 lines of our own).
- **Autosave at every pause point** (§3.4). Two save slots are written alternately, so a crash during a write never loses the previous save.
- Loading verifies the checksum and resumes from the snapshot. If that fails, the game rebuilds the state by replaying the input log. If that also fails, you get a clear message plus the option to export the raw file.
- Export/import is a JSON file. The game explains that browser saves are not permanent and don't sync between devices.

## 3.6 Dependencies
- **Runtime:** react, react-dom, and possibly one tiny IndexedDB helper.
- **Development:** vite, typescript, vitest, fast-check (property tests), @playwright/test, @axe-core/playwright, d3-geo (map projection, *build time only*), eslint, prettier.
- **No** state-management library, router, CSS framework, analytics, or external API. Routing uses the URL hash, which suits static hosting.

## 3.7 Geography pipeline (build time)
Moved to MAP_AND_GEOGRAPHY.md, together with the data licences.

## 3.8 Performance budgets
- Initial JavaScript ≤ ~250 KB gzipped; playable menu in < 3 s on a mid-range laptop over a normal connection.
- Total first load ≤ ~1.5 MB including the hero image. Event and battle art lazy-loads and is preloaded one turn ahead.
- Video is never required. Each clip is streamed, has a still-image poster fallback, is skipped under reduced motion, and can always be skipped.
- 60 fps target for pan and zoom; 30 fps floor on low-end devices with the effects layer reduced.

## 3.9 Hosting
The static build is deployed to **GitHub Pages** by a GitHub Actions workflow, and only when you approve a release (§6.3). There is no server. The Canva subscription is only needed to *create* assets, never to run the game.
