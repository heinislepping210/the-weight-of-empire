# Technical Architecture

How the game is built: stack, modules, simulation integrity, turn resolution, persistence and budgets. *Section numbers (§) are shared across all project documents; the index is in the README.*

## 3.1 Stack and the rendering decision
- **React + TypeScript + Vite.** Exact versions are pinned at setup. The game is UI-heavy — panels, reports, tooltips, accessibility — which is React's strength.
- **No game framework.** Phaser would fight React for the UI and brings physics and scene systems we don't need. **PixiJS** (WebGL 2D) is the fallback for the map layer only, if a measured trigger occurs: under 50 fps while panning or zooming, with all layers on, on a mid-range laptop. The map renderer sits behind an interface, so that swap is contained.
- **The map is three stacked layers:**
  1. **Terrain base.** A raster painted in code from real geodata — rivers, marshes, forests, relief — with watercolour washes, paper texture and engraved linework. Rendered once per zoom band and cached. *Built (M2, 4 November 2026), in part:*
     - the relief is one raster, 1536 pixels wide, painted once when the geodata arrives and placed in the SVG as an image;
     - the engraved hachures, rivers and lakes are SVG paths, so they stay sharp at any zoom;
     - only the hachures in and around the view are drawn, sized with the zoom rather than as non-scaling strokes, which made panning at the operations zoom drop to 20 fps.

     Forest and marsh are still to come (MAP_AND_GEOGRAPHY, "Real geography").
  2. **SVG interactive layer.** Locations, roads, supply flows, force markers, route previews, labels. It is crisp at any zoom and focusable for keyboard and screen readers.
  3. **Canvas 2D effects layer.** Convoys in motion, smoke, rain and dust particles.

  A small custom camera built on Pointer Events handles pan, zoom, pinch and focus animations. *Built (M2, first slice): `src/map/camera.ts` holds the camera as pure functions (pan, zoom about a point, clamping, the three zoom bands, keys), and `MapView` drives the SVG view box with it; labels and markers are drawn at a scale that keeps their size on screen. Focus animations are still to come.*
- **Animation:** one `requestAnimationFrame` loop interpolates between simulation snapshots and updates elements via refs, with no React re-render per frame. In reduced-motion mode, the map snaps instead of animating. *Built (M2, third slice): `advanceWithPlayback` (`src/engine/playback.ts`) records the turn as frames through a read-only watch on `advance`, one at the end of each hour of movement, holding only what the French know; `src/ui/Playback.tsx` runs the loop over them (`src/ui/playbackModel.ts` holds the timing and paths). Recording adds about 1.5 ms to a turn's 2 ms. The effects canvas is not built: wagon trains are SVG for now. The fourth slice adds the day's rain and the roads' mud to each frame, a rain overlay (still with reduced motion), and the camera's focus moments: the loop moves the SVG view box itself towards a contact, a battle or a depot changing hands, and gives it back as it was; moving the map yourself, or turning off "Follow events", stops it.*

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
   - **Forces move together, hour by hour** (rules 0.8.0, D-031). Each force's six-hour march budget is split into six hourly shares.
   - **Within each hour, in time order** (rules 0.13.0, D-038). Each force moves at a steady speed set by its hourly share and the road, so it reaches places and sets out at definite moments, timed to the second. These moments are taken in time order across both sides. What a force finds at a place or on a road is what is there at that moment, and the order of the forces' names makes no difference.
     - **At one moment, every arrival is placed before anyone sets out again.** Forces of both sides reaching a place at the same moment meet there.
     - **A force falling back stands on the road, not at the place it left** (from the moment it leaves). An enemy may enter that place at once, but contact, pursuit and blocking all treat the retreating force as on the road.
     - **The pontoon train** (rules 0.23.0, D-056, `pontoons.bridgeSlots`, G-027). A pontoon road is shut until the French have bridged it, and always shut to the Russians (`closedRoads`): a column waits on the bank, and retreats, wagon trains and the Russian command find their way by open roads only. After the wagon trains each sub-step, `movePontoons` sends the train to the first shut road a French column means to cross, or lets it work there. The staff's forecast runs the same step, so a plan says when the bridge will be ready, and the supply lines on the map go by open roads too. A scenario with no `pontoonStart` has no train, and every road is open.
     - **Raids** (rules 0.24.0, D-057, `raids`, G-028). After the wagon trains and the pontoon train each sub-step, `raidConvoys` gives each raider a 10% chance to fall on the nearest train on a road it can reach: by roads free of the enemy's troops, with none of the enemy's groups at either end of the road. The dice are keyed, so a raid that does not happen changes nothing else. The French forecast (`exposedRoads`) uses the raiders as last seen, never as they stand.
     - **Road capacity** (rules 0.22.0, D-055, `march.columnMetresPerThousand`, G-024). On one road, going one way, a column stays a column's length behind one of its own side and never passes it, and it waits to set out until the road is clear. Of columns ready at one moment the shorter goes first; only between equal columns do names decide. Other roads, the other direction and places are not limited, enemies behave as before, and the rule keeps no state of its own. The staff forecasts the army's columns together through this same movement, so a plan shows the queues the game will produce.
   - **Contact happens at places, never on the road:**
     - A force that reaches a place held by the enemy stops there; that is contact.
     - A force standing where the enemy also stands does not march on: the contact must be resolved first.
   - **Opposing columns cannot pass each other on a road:**
     - A force may not set out along a road on which an enemy column is coming the other way. It holds its place, and the enemy column reaches it there.
     - If enemy forces stand at both ends of a road and both would set out along it in the same hour, a seeded draw for that road and hour decides which one gets onto it. The other holds its place.
     - A column may not overtake an enemy column ahead of it on the same road. Of two columns on one road, the one that set out first is ahead (`Transit.seq`, numbered from `GameState.roadSeq`; D-037), so a force falling back onto a road stays ahead of a pursuer that sets out after it.
     - **A column that catches up closes up and follows at the pace of the column ahead** (D-038). It reaches the next place just after it: if the column ahead marches on, it follows; if that column stops there, they meet. If the column ahead pulls away faster, it goes on at its own pace. If the column ahead overtakes a slower enemy column of its own side, the follower is not led past it: it closes up behind the slower one (rules 0.18.0, D-046).
   - **A force that could not move at all rests** (activity *halt*) for the sub-step.
   - **Setting out, a force leaves behind what it cannot carry** (rules 0.9.0, G-019): fodder first, then food, ammunition last. The excess goes back into the depot if the force stands at its own depot; otherwise it is abandoned and recorded in the ledger.
   - **A wagon train hands over only what the group takes** (rules 0.15.0, D-040): the same issue as at a depot (`takenUp`). The rest stays on the train, which goes home with it.
   - **The staff's arrival forecast runs this same movement** for the force alone (`marchHour`), with its fatigue, rest at night and gathering. It foresees no enemy and no weather: dry roads after today, or mud on every road for the wet-weather bound.
4. **Contact.** Contacts found during movement are resolved in this order:
   1. **Reinforcements first.** A force (of either side) that stands at the place of an active battle and is not yet in it joins its own side there, in the fixed order of force IDs. Like a new battle, it deploys at this boundary and fights from the start of the next daylight sub-step. Until then it takes no part in rounds: no losses, ammunition or fatigue from them. It does not forage while assigned to the battle. A force arriving while still gathering keeps its gathering time and its reduced readiness.
   2. **New encounters**, in the fixed order of §3.4. Minor actions resolve at once.
      - **The attacker** (D-038) is the side that marched into a place the enemy already held; if both arrived during the sub-step, the later arrival. Arriving at the same moment, or neither having marched in: the side seeking battle, then the side not avoiding it; failing that, a draw for that place and sub-step. Never a fixed side, and never the forces' names (until 0.13.0, a tie went to the French). Before a major battle, the defender tries to withdraw. If it can't or won't, the battle is set up at the end of the sub-step — this is when you deploy — and its rounds are fought from the start of the next daylight sub-step.
   - **Falling back takes time** (D-031). A force that withdraws, loses a minor action or retreats from a battle leaves the place at once, but onto the road towards its retreat place, at the start of that road. It marches the rest of the way in the following sub-steps, at its own pace (a resting force falls back at a steady pace). A road on which an enemy column is coming the other way is not a line of retreat.
   - **Which way** (D-042, D-046): along the side's line of retreat (§3.4b D), by a road with no enemy column coming the other way: an attacker the way it came (`Force.cameFrom`) when that road is open, otherwise towards the side's base. Until 0.16.0 an army that attacked a block and lost could fall back past it, onto the very road the block was holding.
5. **Battle rounds** (sector battles from rules 0.17.0, §3.4b). Each round takes 2 hours and uses only the ammunition the force carries at that moment. A battle ends when a side breaks or withdraws, or at nightfall. Ammunition can only be topped up by wagons that are already at the battlefield at a sub-step boundary.
6. **Accrual.** Food and fodder gathered by foraging join the force's stock at the end of the sub-step. Foraging yields less while marching and nothing while fighting. Fatigue rises with the activity. Deliveries received during the sub-step join the stock now. A convoy at its home depot loads now and sets out in the next sub-step. Last, a depot held only by the enemy changes hands, part of its stores burned (D-029).

**Implementation:** `src/engine/advance.ts`. Each stage above is one function. `stepOnce` runs a single stage so tests can watch the timeline between pauses.

**Each night:**
1. **Consumption.** A day's food and fodder are taken from stock actually on hand — never from supplies still on the road or in a depot elsewhere. A group's draught horses eat with its other horses. Wagon-train horses graze where they stand at the marching rate, then eat the fodder they carry, then their depot's if they stand at it (G-019).
2. **Shortfall effects.** Any recorded shortfall drives hunger, sickness, straggling, horse losses and loss of cohesion.
3. **Recovery.** Fatigue recovers according to the day's activity. *Not built yet:* stragglers rejoining halted forces near depots (H-017).
4. **Nightfall in battle.** Each side chooses to stay or withdraw (§3.4, step 6). A battle that continues resumes in the next daylight sub-step, across the turn boundary if necessary. Its forces can't take new movement orders meanwhile.
5. **Roads.** Road condition is updated from the day's rain.

**End of turn:** events, political pressure, new intelligence reports (with their age), the next turn's weather forecast, autosave, then `awaitingOrders`. *Built so far:* political pressure and intelligence reports. Events, the forecast and autosave are not built yet.

**After the last turn (rules 0.20.0, D-053, G-025):** with a battle still open, the campaign does not end. The turn counter passes the scenario's last turn and the sub-steps go on with no orders stage: every force not in a battle is set to *halt*, on the road too, so nothing marches and no new contact arises, while supply and the night go on as usual. The campaign ends at the first sub-step with no battle open, or at the end of `outcome.lastBattleTurns` more turns whatever remains. No new state is kept: `resolution.turn > scenario.turns` says where the game stands.

**Conservation and exclusivity.** Men, horses, wagons, food, fodder and ammunition are conserved: every unit is in exactly one place — with a force, in a depot or on a convoy — or lost with a recorded cause. Each force has one activity per sub-step and belongs to at most one encounter in it.

## 3.4b Sector battles: the contracts (§2.10; from rules 0.17.0)

These contracts were fixed before the sector battles were built, and every one has a test in `tests/engine/battle-sectors.test.ts`; the third review's fixes (D-046) have theirs in `tests/engine/third-review.test.ts`. The combat values are placeholders (G-006); the contracts are not.

**A. Allocation: every soldier and gun counted once.**
- A force has `cavalry` (men, counted within `men`) and `guns`.
- In battle its troops are allocated numerically to the three sectors and the reserve (`BattleField.alloc`). At every pause, summed over the sectors and the reserve: infantry = men − cavalry, cavalry = the force's cavalry, guns = its guns.
- Losses outside the fighting (hunger, sickness, straggling) come off every arm in proportion. The allocation is rescaled to the new totals at once, by a largest-remainder rule (`loseMen`).
- Casualties in a sector come out of the infantry and cavalry allocated to that sector, and out of the force's totals.
- Cavalry fights only as far as it has mounts: its effective strength is capped by the saddle horses left after the gun teams. A cavalryman lost in battle costs a horse, recorded in `ledger.horsesLost`.
- Guns are allocated once. They leave the books only as captured (a share of the guns in a sector that falls) or abandoned (in a rout or when trapped), recorded in `ledger.gunsLost`.
- A reinforcement enters the reserve and keeps its deployment delay (`fightsFrom`) and gathering penalty. Its troops cannot be committed before it has deployed.

**B. A round resolves simultaneously.**
- Every sector's power and casualties are computed from one snapshot of the field, then applied together. Neither side gains by being applied first.
- No marshal reads the other side's current decision. The Russian decision is fixed at the pause (`b.hidden`) from the state before the French decide. The French marshal decides from that same state and never reads `b.hidden`.
- Ammunition is a side's real stock. Each sector's need is drawn from the forces allocated there, and no more is spent than they carry. A sector short of ammunition fights at reduced power.
- Pursuit happens once per battle (`field.pursued`). Saving and resuming at any pause gives the same totals.
- Pursuit power is fresh, mounted cavalry: the pursuer's effective cavalry, discounted for fatigue and cohesion. Only cavalry that has deployed (`fightsFrom` at or before the sub-step) pursues or screens; a reinforcement still deploying does neither (D-046).
- Losses are recorded by force and by sub-step (`b.losses`, `b.lossesAt`); the two always add up. The evaluator's four-day window and the losses after the cut read the sub-step record, so a battle that runs over several days counts each day's losses on that day (D-046).
- Integers stay safe. Every product is divided down step by step, so no intermediate value leaves `Number.isSafeInteger` at the largest strengths the scenario allows.

**C. Four results, kept apart.**

| Result | Cause | Consequence |
|---|---|---|
| Position lost | a side loses two of the three sectors (a sector is lost when its control reaches that side's end of the five-step track) | a cohesion shock; the side then decides whether to withdraw or fight on with its reserve. No rout. |
| Orderly withdrawal | the side breaks off with a usable exit and its cohesion holds | it leaves under control (`field.result = 'withdrew'`); never counted towards a decisive defeat |
| Rout | its cohesion falls below `breakCohesion`, from the fighting, a shock or pursuit | command breaks down: `field.result = 'routed'`, listed in `b.routed` |
| Trapped | it must leave and has no usable exit | heavy losses, guns abandoned: `field.result = 'trapped'`, listed in `b.routed` |

Borodino (H-018) is the negative control. A cohesive army that has lost two sectors but keeps a reserve and an open road withdraws in order and is not marked routed.

**D. Escape follows the operational situation** (`exitStateFor`).

| Exit | When | Effect |
|---|---|---|
| Open | the side's line of retreat (below) has no enemy on or nearing it, no river crossing, and was not the road an enemy in this battle came along | it can break off at the start of a round: a rearguard loss, and pursuit by the enemy's fresh cavalry less its own cavalry screen |
| Contested | the retreat road crosses a river; an enemy force stands within `contestMetres` of the retreat place or marches towards it; or an enemy in this battle came along that road | breaking off takes a disengagement round: the side falls back in every sector for that round, then leaves at its end with a larger rearguard loss, its cavalry screen counting for more. When both sides break off in the same round, neither presses the other: both leave at once, each paying its own exit's rearguard rate (D-046). They do not take the same road while either has another: the side going back the way it came keeps it (the attacker, if both or neither do), and the other takes its next line of retreat, at that road's rate (`departureRoads`) |
| Blocked | no neighbouring place is free of the enemy and of enemy columns coming the other way | no orderly withdrawal: it fights on, and if it breaks or breaks off it is trapped |

- **The line of retreat** (`lineOfRetreat`, D-046). A side leaves together, every corps by one road, to one place fixed for all of it before anyone moves. Among the neighbouring places free of the enemy and of enemy columns coming the other way, it takes, in order: for the attacker, the place its main body came from (D-042; basis `line`); else the one nearest, by road and not through the battle, to the side's base (`base`: for the Russians the ends of their line of retreat, `exitPlaces`; for the French, and a side without such places, the depots it started with); else the one nearest to a place its own troops hold (`own`); else the one nearest to its own depot (`depot`); else the first in order. The same rule serves a withdrawal before battle (always the defender) and a minor action (the attacker, if the weaker side attacked). A depot founded during the campaign, or a detachment standing off the line, never decides where a beaten army goes. This is the second reading of "along its line": the first (any side the way it came, else towards its own troops) sent beaten Russians into the French rear and was replaced before it was committed (D-046).
- Several approach roads block nothing by themselves. A side whose forces came along two or more roads strikes the enemy's thinnest sector in the flank (`field.flank`, recomputed each round, so a reinforcement arriving by another road creates it).
- Political pressure changes only the Russian marshal's willingness to withdraw. It never closes a road.
- **Stand** (D-045): a group under stand orders tells its marshal to hold on. When most of a side's men in a battle stand, its marshal breaks off only below `mustStandCohesion` and withdraws at nightfall only below `mustStandNightCohesion`, the same willingness as the Russian command under political pressure at a key place. It closes no road and opens none: a standing side with no road out is still trapped if it breaks.
- **An empty line** (D-046): a marshal whose side has nobody left in the three sectors and men in the reserve sends the reserve in as a counter-attack, in the sector where the ground is least lost. Standing never means waiting off the line.

**Decisions.**
- The marshal (`decideRound`, `decideNightfall`, `src/engine/ai.ts`) answers for the Russians and for any French decision left to it. It reads only the state, never `b.hidden`.
- A player may leave the whole battle to the marshal (`delegateBattle`). The rounds then resolve without stopping, and the next pause, at nightfall, offers command back.
- The old `{ kind: 'round', action }` input stays valid: press maps to press everywhere, hold to hold everywhere, withdraw to break off.
- The key decisions of a round (`KeyDecision`): continue the plan; send in the reserve (it counter-attacks there); press or hold everywhere; break off; mass the guns in one sector; charge with the reserve cavalry in one sector; set the cavalry to pursue or to screen. Each moves troops only between places on the field, so contract A holds.
- **Battlefields by place** (`ScenarioDef.battlefields`): Smolensk's walled Old Town has its own template (the walls, the suburbs, the bridges); everywhere else is open ground (the ridge, the village, the woods).

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
- 60 fps target for pan and zoom; 30 fps floor on low-end devices with the effects layer reduced. *Measured on 4 November 2026 (TESTING_AND_QA, "Frame rate"): 60 fps median, with the slowest 5% of frames at 56.8 fps or better, panning, zooming and playing back with every layer on, on the production build in the app's browser pane; a full-size window is still to measure.*

## 3.9 Hosting
The static build is deployed to **GitHub Pages** by a GitHub Actions workflow, and only when you approve a release (§6.3). There is no server. The Canva subscription is only needed to *create* assets, never to run the game.
