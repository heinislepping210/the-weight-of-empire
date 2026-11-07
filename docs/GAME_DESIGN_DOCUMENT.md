# Game Design Document

The design of The Weight of Empire, focused on the first release, *The Vitebsk Decision*. *Section numbers (§) are shared across all project documents; the index is in the README.*

## 2.1 Design pillars
1. **Distance is the enemy.** Logistics is the core system. It is spatial, visible on the map, and forecastable.
2. **Decisions cast long shadows.** Consequences arrive turns later, and the game always shows their approach.
3. **The battle you have to earn.** The Russians can usually avoid battle. Forcing one takes manoeuvre, and manoeuvre takes supplies.
4. **Honest uncertainty.** Fog of war, warnings before events, and bounded randomness. When luck mattered, the game says so.
5. **History as frame, not script.** Documented, simulated and counterfactual are always labelled.
6. **Readable at a glance.** No more than 5 headline indicators; detail is available on demand.

**The central tension.** To feed itself, a Napoleonic army must **spread out** over a wide area to forage. To fight, it must **concentrate**. Concentrated, it starves; spread out, it is vulnerable. Every turn asks how far apart you can afford to be. Combined with the lengthening supply tether, this produces the game's decisions without any scripting.

## 2.2 Scenarios (one engine, one map dataset)
| Scenario | Role | Span (game time) | Turns | Real time |
|---|---|---|---|---|
| **The Vitebsk Decision** | Command Challenge; first build | early → ~24 August 1812 | ~10 | 7–10 min |
| **The Road to Smolensk** | Full campaign; after the share | 24 June → late August 1812 | ~28–30 | 30–45 min |

Dates use the Gregorian (New Style) calendar. Russia used the Julian calendar in 1812, 12 days behind; the Historical Notes show both where Russian sources are cited.

## 2.3 The Vitebsk Decision — the situation
*Everything below is a working description from secondary sources. Phase 2 research verifies every item and records the uncertainty.*

**Documented frame**
- Napoleon reached Vitebsk around 28 July and stayed about two weeks. By many accounts he weighed ending the year's campaign there.
- The Russian 1st and 2nd Western Armies (Barclay de Tolly and Bagration) joined at Smolensk in early August. Sources date it between 2 and 4 August — a ready example for the assumptions register.
- The Russians attempted an advance towards Rudnia in early August, with a cavalry action near Inkovo around 8 August (*to verify*).
- Napoleon answered with a swing south of the Dnieper. Eblé's engineers bridged the river near Rasasna on 13–14 August, Neverovsky's division fought a delaying action at Krasnyi on 14 August, Smolensk was assaulted on 16–18 August and burned, and the Russians withdrew east. Valutino/Lubino followed on 19 August.
- Kutuzov was appointed overall commander in August and took command after Smolensk.

**Start state (working assumption):** about 5 August. The Grande Armée is spread out around Vitebsk–Surazh–Orsha to feed itself and recover. Sickness, straggling and horse losses have already thinned it. The Russians are united at Smolensk, under political pressure to stop retreating.

**The player's options include:**
- Rest another turn.
- Concentrate.
- Strike up the direct road via Rudnia.
- Swing south across the Dnieper, towards Liady and Krasnyi, to get behind Smolensk.
- Threaten the northern flank via Poreche.
- Declare a halt and hold the Dvina–Dnieper line for the season.

**Map (target: 16–20 locations; candidate list, to verify):** Vitebsk, Surazh, Velizh, Poreche, Liozno, Rudnia, Inkovo, Babinovichi, Liubavichi, Orsha, Dubrovno, Rasasna, Khomino, Liady, Krasnyi, Smolensk (with its north-bank suburb), Valutino/Lubino, Dorogobuzh (the Moscow road exit), Mstislavl and Mogilev (southern edge).

The rear lines run off-map to Vilna and Minsk, as abstracted line-of-communication links with travel time, capacity and risk.

**Player force groups (working; positions to verify):**
1. Imperial HQ & Guard
2. Vanguard (Murat's cavalry with Ney)
3. Left wing (Eugène)
4. Right wing (Davout)
5. Southern group (Poniatowski & Junot)

Plus independent assets: **wagon parks**, a **pontoon train**, and **garrison detachments**.

**Russian forces:**
- The united main army, which can split into two columns again.
- A detachable division (Neverovsky-type role).
- Cossack light cavalry (raids and screening).
- The Smolensk garrison and militia.

## 2.4 Turn structure (2 days per turn, simultaneous orders)
1. **Dispatches.** Intelligence reports arrive, each with its age and reliability: "Cossacks reported near Babinovichi (yesterday, uncertain)."
2. **Orders.** In Challenge mode a single army directive sets these for you (§2.4b). In detail, each force group has:
   - **destination** (click the map);
   - **pace**: Rest / Steady / Forced;
   - **engagement**: Seek / Accept if favourable / Stand (the group marches as ordered; in battle, when most of the men there are under Stand orders, the marshal holds on after the position is lost and breaks off only when the army is close to breaking; from rules 0.17.2, D-045; the battle panel says whether that majority holds) / Avoid;
   - **rations**: Full / Reduced;
   - **foraging**: Regulated / Free.

   Logistics orders: assign wagon parks (travel with a force, or shuttle along a line), found a depot, bridge a river with the pontoon train, and set supply priorities.
3. **Commit.** The Russian orders are set from Russia's own intelligence picture. Then the turn resolves deterministically:
   - **four daylight sub-steps** (Day 1 morning and afternoon, Day 2 morning and afternoon): supplies that have already arrived become usable, each force carries out exactly one activity, forces and convoys move, contacts are found, and battle rounds are fought;
   - **each night:** a day's food and fodder are consumed from stock actually on hand, shortfalls take effect, fatigue recovers, and battles at nightfall are continued or broken off;
   - **end of turn:** events, political pressure and new intelligence reports.

   The exact order, and the rules that stop a force from using supplies it hasn't received or doing two things at once, are in §3.4a.

   A major battle or an event choice pauses resolution, which then resumes exactly where it stopped (§3.4).
4. **Playback.** An animated replay of the turn on the map (2–6 s, skippable), followed by a short dispatch summary. A battle pauses playback, opens the battle screen, then resumes.

   *Built (M2, third slice):* each turn plays back hour by hour, about four seconds for a whole turn, with a clock: groups and wagon trains move along the roads at their simulated speed, enemy forces appear only while a French force has them within detection range, and contacts, battles, skirmishes, captured depots and deliveries show where they happen. Skip or Escape ends it, it can be played again, and with reduced motion it is not animated. Afterwards a thin line shows where each group went, beside the dashed plan for the next turn. A turn stopped by a battle plays up to the contact, and the battle panel is already open beside it; playback does not yet stop and resume around the battle screen.

Orders persist until you change them.

## 2.4b Challenge mode: directives, standing orders, decision points

*Implementation status (D-026, D-033):*
- **Built:** directives, axes, the staff planner with per-group orders, forecasts and reasons, player overrides, and the logistics stance (D-029).
- **One plan (D-033).** Your own pace or battle stance for a group is planned and forecast with the staff's, so the map, the forecast and the committed orders are always the same plan.
- **The route is kept (D-033).** The chosen route is kept whole, so it still guides the groups after another group becomes the lead.
- **The road per group (D-034).** Each group follows the chosen route or takes its own road. By default, a group far from the route takes its own road when the route would add more than half again to its march, and says so; you can set any group either way.
- **Following the route (D-050).** A group already on the chosen route follows it from where it stands; any other joins it where its total road is shortest. So each route for an objective gives its own orders, and a route card says so when two still come to the same orders.
- **Summary first (D-033).** A short army summary leads: how far apart the groups arrive (and who arrives only after the campaign ends), which groups may meet a stronger known enemy, the worst-fed group, and horses short of fodder. The orders of each group open on demand.
- **Still to come:** detached tasks, decision points (auto-advance and stop conditions), wagon deliveries in the food forecast, and dragging a route.
The simulation underneath is identical; only the way you give orders changes.

- **One army directive replaces per-group orders.** It has five parts, and each defaults to your previous choice:
  1. **Objective** — a place on the map, or one of the staff's suggested objectives.
  2. **Axis** — one of the 2–3 highlighted routes, each with its preview.
  3. **Tempo** — Rest / Steady / Forced.
  4. **Posture** — Dispersed (feeds better, slower to concentrate) / Converging / Concentrated (fights better, strips districts fast).
  5. **Logistics stance** — Push depots forward / Hold the line / Live off the land. Each stance is a bundle of wagon, depot, ration and foraging policies.

  On top of that you can give **one optional detached task**: a single group gets its own job, such as screening, covering a crossing, holding a town, or acting as bait.
- **A staff planner** inside the engine turns the directive into group orders deterministically. It is part of the versioned rules, so replays stay exact.
- **Standing orders.** The directive persists, and the game advances on its own, **stopping only at decision points**:
  - a new sighting changes the balance of forces;
  - contact is likely next turn;
  - an event needs a choice;
  - any group's supply forecast drops below a threshold;
  - the objective is reached, or a directive is complete.

  You can stop at any turn, or set "pause every turn".
- **Staff assessment.** For each axis the staff shows a forecast: arrival, supply at arrival, fatigue and known risks. It is computed **only from what you know**, never from hidden Russian positions. It shows the trade-offs and never says which option is "right".
- **Orders of the day, always inspectable.** Before you commit, every group's planned orders are listed and drawn on the map: route with arrival times, pace, the activity for each half-day, supply arrangements, foraging policy and engagement stance. Each line says why the staff chose it, e.g. "Converging: arrives within a day of the main body".
- **Forecasts with reasons.** Every forecast shows what drives it, e.g. "Supply 5–7 days, down 2 from last turn, because the convoys from Vitebsk are 3 days behind."
- **Intervene anywhere.** Before committing, you can edit any group's planned order directly: drag its route, or change its pace, stance or foraging. Edited orders are marked *Your order*, and the staff keeps them until you release them.
- **Deviations stop the clock.** If events depart from the plan in a way that matters ("Ney delayed by mud: arrives a day late"), the game stops so you can revise.
- **Plan versus actual.** Playback shows where things went as planned, where they didn't, and why.
- **Nothing happens behind your back.** The game only carries standing orders through quiet turns, and the dispatch log lists each such turn and what happened in it.
- **Detail on demand.** The full campaign uses the same directives, with group detail more prominent.

## 2.5 Force groups and army condition
**Tracked internally:** infantry, cavalry, guns, cavalry horses, draught horses, fatigue, cohesion (morale and discipline), stragglers, sick, carried food / fodder / ammunition.

**What you see** — 4 indicators per group:
- **Effectives** (number + trend)
- **Condition**, as one word: Fresh / Steady / Worn / Exhausted / Breaking. Hover for fatigue and cohesion.
- **Supply**: days of food at hand, with fodder as a secondary icon.
- **Horses**: % of establishment, which drives mobility, scouting and the guns.

**Stragglers** are a key mechanic. Forced marches and short rations create stragglers. Halting near a depot recovers some of them. Starvation turns them into permanent losses and marauders, which harms civilians and lowers local supply. This gives the player a real way to respond to setbacks: stopping, at a cost in time.

**Horses connect everything.** A fodder shortfall kills and weakens horses. That means fewer working wagons, which means less supply. It also means weaker scouting, so more fog, and slower guns, so weaker battles. One shortage spreads everywhere, which is historically right.

## 2.6 Logistics
| Element | How it works |
|---|---|
| **Depots** | Towns holding food, fodder and ammunition. The rear depots are pre-existing. New depots take time, a garrison detachment, and wagons to stock them. |
| **Wagon parks** | Your transport. Each one either **travels with a force** (more carried supply, but a slower force that suffers on bad roads) or **shuttles** between two points. |
| **Convoys** | Emerge from shuttling parks and are visible on the roads. Throughput ≈ wagons × capacity ÷ round-trip time. Round-trip time depends on distance, road class, weather and horse condition. Raids can intercept convoys on exposed roads. |
| **Foraging** | Each district around a location has a food and fodder stock, set by the seed within researched ranges. A large concentrated force strips it fast. *Regulated* requisition is slower and gentler. *Free* foraging yields more but erodes discipline, harms villagers, raises local resistance and Cossack risk, and leaves the district stripped for anyone who passes later. |
| **Captured stores** | Reaching a Russian magazine before it is destroyed captures it. Retreating Russians may burn stores. This rewards speed and creates a real tension with sustainability. |
| **Ammunition** | Battles consume artillery ammunition, which must be re-supplied by wagon. |

**Weight decides what wagons can do (D-023).** A wagon's load is limited by weight, and a horse's daily fodder weighs about twelve times a soldier's daily ration. Convoys keep the men in bread and the guns in ammunition, but the horses largely live off the land. Where they march, rest and forage therefore decides whether cavalry, artillery and the wagons themselves keep moving.

**Spreading out, depots and retreat (D-024):**
- **Spreading out.** A halted force that is *dispersed* spreads its foragers evenly over its own and the neighbouring districts, never where the enemy stands, and gathers far more than a concentrated one.
- **The price of dispersal.** A dispersed force needs about a day to gather before it can march, and fights below strength if caught while gathering.
- **Depots.** A force standing at its own depot draws supplies directly, without wagons.
- **Retreat.** A beaten side falls back together, every corps by one road, along its line of communications: towards its base (for the French the depots they started from, for the Russians the Moscow road), not towards a depot founded on the way or a detachment standing off the line. A side that marched into the place to attack falls back the way it came, if that road is open, never on through the enemy it attacked (D-042, D-046). An army repulsed by a block on its line of retreat cannot escape through the block.

**Horses, carrying and foraging reach (rules 0.9.0, G-019):**
- **Draught horses.** Every wagon needs draught horses, in the wagon trains and in each group's own baggage. A wagon without its horses stays behind: fewer horses mean smaller loads, never faster or slower wagons. A wagon train that loses horses on the way unloads what it can no longer draw, into its depot or by the road; with no horses it cannot move (D-037).
- **Feeding the draught horses.** Wagon-train horses graze along the way, then eat the fodder they carry, then their depot's. On a long haul they eat part of what they were meant to deliver.
- **What a group can carry.** A group carries what its men (four days' rations each) and its horse-drawn wagons can take. In camp it may hold more. When it sets out on the march it leaves the rest behind: fodder first, ammunition last. At a depot the extra goes back into the depot; anywhere else it is lost. **Issuing supplies** (rules 0.15.0, D-040): from a depot or a wagon train alike, a group takes as much food as it can carry, up to two days' fodder and its ammunition, and only what it could still march with. Since fodder is left behind first, the fodder it already holds never stops it taking food. What a wagon train cannot hand over stays on the train and goes back with it.
- **Foraging reach.** A dispersed group reaches a neighbouring district only if that district begins within its foraging reach: half the road to the neighbouring place. Neighbours far down a long road are out of reach. The reach is 11 km, half the width of the source's foraging square for extended operations, so a neighbouring place counts within 22 km by road (L-011, G-019; corrected from 22 km in rules 0.12.0).
- **March speed is unchanged.** The infantry sets the pace; horse losses cost carrying, not speed.

**Captured stores and forward depots (D-029, rules 0.6.0):**
- **Capture.** A depot changes hands when only the enemy holds it. Part of its stores, 50–90%, is burned first. The rest feeds the captors. Wagon trains based there fall back on their side's nearest remaining depot.
- **Founding.** A new depot can be founded where French troops hold the ground. It starts empty, and it falls if it is left unheld and the enemy arrives.
- **Line trains** stock depots instead of supplying a force. Stores move forward in relays, a few days' haul at a time.
- **The supply stance** is part of the directive. *Keep the depots* changes nothing. *Bring depots forward* founds one depot a turn, sends the line trains forward, and has each group's wagons load at the nearest stocked depot. Its reasons are listed before you commit.
- **Not built yet:** garrison detachments for new depots, raids on convoys, and the free versus regulated foraging choice.

**The forecast.** Every group and the army as a whole show *days of supply* as a range, such as "6–9 days". The range comes from carried stock, expected deliveries and expected forage under current orders. The Logistics layer marks lines delivering less than demand as **bottlenecks**, with a pattern as well as a colour.

**Civilian consequences don't disappear.** Districts show their state (Intact / Requisitioned / Stripped / Hostile). The after-action report records the human cost of foraging choices. It reports this soberly, without lecturing.

*Built (M2, fourth slice):* the map hatches each district by how much foragers have taken from it, by the scarcer of food and fodder (foraged below 85% left, stripped below 50%, bare below 20%), as the French last saw it: a district is drawn only once a French force has come within detection range of it, and keeps what was seen there after they leave. *Requisitioned* and *Hostile* wait for the requisition policy and local resistance, which are not built.

All quantities (wagon capacity, march rates, consumption) come from Phase 2 research as ranges. Where no source exists, the value is a labelled game assumption in the register.

## 2.7 Movement and geography
- Routes form a network of locations and road segments. Each segment has: length (from real geodata), road class (post road / secondary / track), terrain (open / forest / marsh), crossing type (bridge / ford / none — pontoon needed), condition (dry / muddy, driven by weather), and **capacity**. *The pontoon crossing is built in rules 0.23.0 (D-056, G-027): the Dnieper road at Rasasna is shut until the train has bridged it, and to the Russians for good. The staff sends the train to the crossing a column wants, so there is no separate order for it.*
- **Road capacity matters.** A big force on one road moves slowly because its column is very long. Splitting across parallel roads is faster — which is why Napoleonic armies marched divided. This creates a real reason to use multiple routes. *Built in rules 0.22.0 (D-055, G-024): columns of one side queue on a road, and the staff's plans, the route cards and the summary show it.*
- **Route preview** (hover or drag): arrival day as a range, fatigue cost, supply forecast at arrival, known threats, and the crossings involved.

## 2.8 Intelligence and fog of war
- Each side sees enemy forces only within the detection range of its own units. Cavalry strength and horse condition set that range and the accuracy of estimates.
- Enemy markers show **estimated strength ranges** and **report age**. Stale markers fade into "last seen" ghosts with a date.
- The Russian side gets the same treatment. It has better local knowledge on its own soil — an explicit, documented asymmetry — but it does **not** see your true state.

## 2.9 Russian command (rules-based AI)
The Russian AI obeys exactly the same simulation rules as the player.

1. **Strategic plan**, drawn from a small seeded set and reweighted by circumstances:
   - *Preserve and withdraw* (Barclay's doctrine)
   - *Strike the dispersed* (counter-attack an isolated French group)
   - *Stand at the gate* (defend Smolensk)
   - *Harass the lines* (Cossack raids)
2. **Per-turn decisions** score candidate actions (hold, withdraw to X, attack Y, raid segment Z, burn stores) on safety, objective value, opportunity and political pressure. Ties are broken deterministically.
3. **Political pressure** (0–100) rises as the Russians cede ground — sharply once old Russian territory like Smolensk province is threatened — and falls after they fight. High pressure makes standing or counter-attacking more likely. In the full campaign, very high pressure after a defeat can trigger a change of commander. The deeper you push, the more likely you get your battle, just when you are most stretched.
4. **Seeded temperament.** Variation in caution and aggression, and friction between commanders. This is scenario randomness, documented in the notes as such.

**Implemented in rules 0.4.0 (D-025):** the four plans above as *withdraw*, *strike*, *stand* and *hold*, with the Cossacks and Neverovsky as screens. A strike keeps within reach of the base (rules 0.21.0, D-054): at a target out at Liozno the armies stop at Rudnia, and they go home by Smolensk, not round through the French rear. Harassing supply lines arrives with convoy raids. Each turn's plan is logged for the after-action report and never shown during play.

## 2.10 Battles (sector system)
**Getting a battle.** A battle happens when forces make contact and at least one side's engagement order allows it. A defender may try to withdraw. Success depends on cavalry, fatigue, terrain, and whether its retreat route is threatened. A failed withdrawal costs a rearguard action. **Pinning** the enemy prevents escape: approaching from two directions, threatening its line of retreat, catching it at a crossing, or at a city it must defend. This is the operational skill the game rewards.

**Setup.** A battlefield template for the location (Smolensk: walls, suburbs, river, bridges; open field: ridges, village, woods) gives 3 sectors plus a reserve. Each sector has terrain effects and an objective (e.g., *the bridge*). Your groups arrive as 2–4 formations each (infantry, cavalry, artillery, Guard), **in their campaign condition**. Groups nearby can *march to the sound of the guns* and arrive in round 2 or 3 depending on distance — so concentration before the battle matters.

**Rounds (2 hours each, until a side breaks or withdraws, or night falls; see §3.4a).** Each round you:
- set per-sector orders: Assault / Press / Hold / Fall back;
- concentrate artillery;
- commit reserves;
- use cavalry: screen / charge / pursue;
- or withdraw.

The Russians decide at the same time, and their choices are hidden until resolved. Pre-battle scouting reveals part of their deployment; better horses mean better scouting.

**Resolution.** Combat power = strength × quality × cohesion × fatigue × terrain × artillery support × ammunition. Losses follow a bounded attrition model with limited variance. Sector control moves along a 5-step track. A side breaks when its cohesion collapses or it loses too many sectors. Nightfall ends the battle, and a defender may slip away overnight.

**Consequences for the campaign:**
- casualties (killed / wounded / prisoners), plus the burden of caring for the wounded;
- cohesion and fatigue;
- ammunition spent;
- control of the location and the loser's retreat path;
- captured or burned stores;
- time lost;
- change in political pressure;
- a log entry for the report.

**Presentation.** A top-down battlefield in the same cartographic style: formation blocks that move and change shape, artillery smoke, sector shading, and a summary line for each round. A *delegate to the marshal* option auto-resolves with a sensible default plan, at a small penalty.

**In Challenge mode**, the staff proposes a deployment for the battlefield, and you accept it or move formations between sectors. After that, each round asks for at most one key decision — where to commit the reserve, whether to press or hold, or whether to break off — with "continue the plan" as the default. A typical battle takes 3–4 decisions and about 2 minutes. Minor actions (rearguards, raids, skirmishes below a size threshold) resolve without stopping.

*Built so far (rules 0.17.1; contracts in TECHNICAL_ARCHITECTURE §3.4b):* the open field and Smolensk's walled Old Town as templates; each force's infantry, cavalry and guns allocated across three sectors and a reserve; Assault, Press, Hold and Fall back per sector, with a five-step control track; the round's one key decision (continue the plan, send in the reserve, press or hold everywhere, mass the guns, charge, set the cavalry to pursue or screen, break off); the four results of a battle kept apart; exits open, contested or blocked; pursuit; the flank of a side that came along two roads; the whole battle left to the marshal until nightfall, at no penalty. Not yet: the illustrated battlefield (M2/M3), scouting that reveals only part of the enemy's deployment (the panel shows estimates rounded to the nearest thousand), care of the wounded, stores taken or burned in battle, and more templates.

## 2.11 Events
- Events are data. Each has: trigger conditions on the game state, a weight, an **optional warning one turn ahead**, effects, optional response choices, cooldowns, a category label (*inspired by documented conditions* / *simulated*), and a historical note.
- First ~10 events:
  - thunderstorm turns the roads to mud;
  - heat and dysentery;
  - horse sickness from green fodder (*to verify*);
  - bridge damaged;
  - convoy raided;
  - Russian magazine captured intact;
  - stores burned before capture;
  - local resistance after harsh foraging;
  - straggler crisis;
  - opportunity: an exposed Russian detachment.
- No event may single-handedly decide the campaign (enforced by bot testing, §7).

## 2.12 Variation, seeds and fairness
**Scenario randomness** is rolled once from the seed and is independent of your choices:
- the weather track, within plausible summer patterns — **never winter in August**;
- district forage stocks;
- starting transport readiness;
- Russian temperament and plan weights;
- some bridge conditions.

**Resolution randomness** comes from a counter-based generator keyed by (seed, stream, turn, entity, purpose). That means **unrelated choices never shift other random draws**. Two players on one seed get the same weather on 10 August, whatever they do.

**Scenario and dice are separate streams** (rules 0.11.0, D-036).
- **The seed sets the scenario:** strengths, the Russian command's temper and pressure, the weather, and the scouts' estimate errors.
- **The dice decide the fortunes of war:** battle rounds, withdrawals, skirmishes, the share of captured stores burned, and who gets onto a road first.
- **By default the dice equal the seed.** Replaying a seed with fresh dice keeps the situation and changes only the luck. That is how the balance tests tell luck from situation, and how the report can later show luck separately from decisions.

**Seeds and links:** a human-friendly code plus the rules version, e.g. `…/#/challenge?seed=K7Q3-9TFA&rules=1.0`. A link made under an older rules version shows a warning.

**Fairness guardrails:**
- risks are visible before you commit;
- events give warning;
- variance is bounded;
- every setback has at least one response (rest, recover stragglers, re-route, reduce rations, withdraw);
- the report shows *luck* separately from *decisions*.

## 2.13 Victory and endings (The Vitebsk Decision)

**Objective:** *Bring the Russian field army to a decisive defeat, or cut off its retreat, while keeping the Grande Armée able to continue the war. Halting for the season is a legitimate choice, and its result depends on where and how you halt.*

The engine evaluates three things separately, then combines them. Every threshold (*L₁*, *C₁*…) is a labelled game assumption, set in testing (HISTORICAL_ASSUMPTIONS.md G-004).

**A. What happened to the Russian main army** (exactly one result):

| Result | Definition (evaluated from the battle and movement log) |
|---|---|
| **Decisively defeated** | In one battle, or several within 4 days, it lost at least *L₁* of its starting strength (killed, wounded, prisoners) **and** either broke (cohesion below *C₁*) or was driven into a disordered retreat. |
| **Cut off** | A French force of at least *S₁* held a designated node on the Moscow road east of the Russian army (Valutino/Lubino or Dorogobuzh; to verify) for at least 2 consecutive sub-steps while the Russian army was west of it, **and the army is still cut off when the campaign ends** (D-039). That forces the Russians to fight at a disadvantage, or retreat by worse roads with heavy losses of stores and stragglers. An army that broke out at a heavy cost in battle counts as *forced from its position* instead; one that got away cheaply earns nothing beyond a mention in the report. |
| **Forced from its position** | It abandoned Smolensk or the Dnieper line without a major battle, under threat to its retreat, with losses or abandoned stores above *L₂*. |
| **Damaged** | Losses above *L₂*, but none of the above. |
| **Escaped intact** | It withdrew in order along its main road with losses below *L₂*. |

**B. What you hold:** Smolensk (taken / burned / still held by Russia), the Dnieper crossings, and the road junctions that matter.

**C. The state of your army:**
- **Capable:** effectives at least *E₁* of the starting strength, and army cohesion at least *C₂*.
- **Sustainable:** a supply forecast of at least *D₁* days at the final position, with the supply line delivering at least *T₁*% of need.
- **Secure:** no group in contact with a superior enemy force, and no supply line cut.

**Endings** are checked from the top down; the first one that matches applies:

| Ending | Conditions | Kind of result |
|---|---|---|
| **Decisive Success** | A = Decisively defeated or Cut off; C = Capable and Sustainable | The army itself defeated |
| **Costly Victory** | A = Decisively defeated or Cut off; C not Capable or not Sustainable | The army defeated, at a price |
| **Operational Success** | A = Forced from its position; C = Capable, Sustainable and Secure | Advantage won by manoeuvre, without a decisive battle |
| **Limited Success** | Smolensk or the Dnieper gate taken; A = Damaged or Escaped intact | Ground taken, army not beaten — **about the historical outcome (par)** |
| **Successful Consolidation** | You declared a halt; at the end C = Capable, Sustainable and Secure | A prudent halt that worked |
| **Precarious Halt** | You declared a halt; at the end C is not Sustainable or not Secure | A halt in a poor position |
| **Repulse** | Objective not achieved, and effectives below *E₁* or a major battle lost | |
| **Operational Collapse** | Army cohesion below *C₃*, a starvation spiral, or a forced withdrawal under pressure | |

- **Inconclusive** (added in D-028): the objective not achieved, the army not seriously harmed, and no halt declared — time simply ran out. It ranks with a Precarious Halt.
- **Capturing territory alone is never more than a Limited Success.**
- *Implementation (rules 0.10.0, D-035; corrected in 0.12.0, D-037):* `src/engine/outcome.ts`, with a table of campaign states in `tests/engine/outcome.test.ts` fixing what each ending means.
  - **The Russian main armies** are the forces holding at least a quarter of the Russian strength at the start. They are fixed for the game, so a main army that has been weakened still counts.
  - **Decisively defeated** counts battle losses (killed, wounded, taken, including those in a beaten side's retreat) in battles the French won and in which the Russians broke, over at most 4 days. A side breaks when its cohesion falls below the breaking point in a round, or when it is trapped with no road out. An orderly withdrawal never counts, however costly: at Borodino the Russians lost about a third and withdrew in order (H-018). Sickness and straggling never count.
  - **Cut off** is tracked sub-step by sub-step: Valutino or Dorogobuzh held by at least 30,000 French while no Russian main army can reach Dorogobuzh past them, for 2 consecutive sub-steps. What it earns is judged at the end (rules 0.14.0, D-039): still cut off, the Russians count as cut off; broken out after losing at least 10% of their starting strength in battle after the cut, they count as forced out; escaped more cheaply, the report says the road was cut for a time, and that is all. Until 0.13.0 a cut, once achieved, stood for good, even when the Russians then walked away (GAMEPLAY_BALANCING, "What a cut road earns"). Holding Smolensk's north-bank suburb takes the objective but does not cut the Russians off. A main army on the road counts from where it is going, not from the place it left: one thrown back west from Valutino is still shut in (D-053).
  - **The last battles (G-025, D-053).** A battle still open when the last turn ends is fought out before the ending is judged: no new orders, everyone else standing where they are, and at most one more turn. A contact on the last afternoon no longer leaves a battle unfought.
  - **Sustainable** is judged group by group, day by day over the next 2 days (D-040): food carried; its own depot where it stands; its share of the forage within reach, each district's food shared among the groups that reach it (none for a group in battle); and food its wagon train brings, from the day the train can arrive, if it has the horses to draw it, and only as much as the group would take. Food arriving tomorrow does not feed today. The supply line's delivery rate (*T₁*) is not used yet.
  - **Secure** does not yet include cut supply lines.
  - **A victory won before a late halt stands** (your decision, D-035): the endings are checked from the top, so a decisive result comes before the halt endings.
- The report presents every ending with its trade-offs. Rank order is used only for testing statistics: Decisive Success first; Costly Victory and Operational Success second, as different kinds of success; Limited Success and Successful Consolidation third; then Precarious Halt, Repulse and Collapse.

*Calibrating to history as par is a design choice. It is not a claim about what Napoleon "should" have done.*

**How a decisive result is earned.** The Russians avoid unfavourable battles, so skilful players need real ways to force one. Three are built in. Each emerges from the rules rather than a script, and each needs good logistics to pull off:
1. **Bait and converge.** Present what looks like an isolated group. The Russian *strike the dispersed* plan may go for it while your other groups are within marching distance. The historical Russian advance towards Rudnia (H-003, to verify) suggests the temptation was real.
2. **Envelop.** Swing south of the Dnieper to threaten the Moscow road. The Russians must fight for it or abandon it; holding it long enough counts as Cut off.
3. **Pin at the gate.** Political pressure makes Smolensk hard to give up. Arrive concentrated and supplied before the Russians can withdraw cleanly.

**The halt depends on the state of the campaign.** Declaring a halt is a directive: you choose, or accept the staff's proposal for, the line where each group will hold. The simulation then runs to the scenario's end with the Russians still acting — they may strike exposed groups or raid your lines — and you are stopped for any major battle. The ending is judged from the resulting state. A halt in a supplied, defensible position produces Successful Consolidation. A halt deep in stripped country, at the end of a long and raided line, can end as a Precarious Halt, a Repulse, or even a Collapse.

## 2.14 The after-action report
1. **Outcome** plus 3–4 headline figures.
2. **Your Minard.** A generated flow map of *your* route. Band width = effectives. Colour = supply state (gold → ochre → crimson), backed by patterns. A weather strip runs beneath. Battles and events are marked. A faint *documented* band shows the historical army as a range at a few verified, dated waypoints, drawn as an uncertainty band and never as daily figures. Minard's own numbers appear only as a cited source, with their caveats (HISTORICAL_RESEARCH.md).
3. **Turning points** (3–5). Found from the largest changes in key figures, each with a *supported* causal statement taken from the engine's cause-tagged log. Example: "Turn 6 — forced march Orsha→Liady: arrived 1 day before the Russians; cost ≈4,200 effectives in stragglers."
4. **Where the constraint bit.** Supply demand vs. delivery, turn by turn.
5. **Your decisions vs. outside your control.** Choices shown separately from seeded weather and events.
6. **Against history.** The documented outcome, with ranges and sources.
7. **Try this seed again / share.** A text summary and a PNG of your Minard, generated in the browser.

The report never comments on the player's psychology or character. Speculative readings are labelled *Interpretation*.

## 2.15 Onboarding and modes
- **The first meaningful decision comes within ~60 seconds of pressing Play.** A three-line dispatch, then: "The Russians have united at Smolensk. Your corps are dispersed to feed themselves. Concentrate now, or rest another turn?"
- **Guided** (default for first play): contextual tips across the first decisions (reading the army → the directive → comparing routes → logistics stance → first battle). Slightly clearer intelligence. Results are labelled *Guided*.
- **Standard:** no tips; the Field Manual is always available. Tips already seen are remembered in browser storage.

## 2.16 Screens and interface
1. **Home** — hero art; *Play The Vitebsk Decision (≈10 min)*; *Continue*; *Historical Notes*; *About*.
2. **Briefing** — short and skippable.
3. **Campaign map** (the main screen) — the map dominates.
   - **Top bar:** date, weather, effectives, condition, days of supply, line delivery %, objective.
   - **Left:** force list (collapsible). **Right:** context panel for orders and details. **Bottom:** turn controls and dispatch log.
   - **Map layers:** *Strategic / Logistics / Intelligence / History (ghost)*.
4. Turn playback overlay
5. Event card — illustrated, with choices.
6. Battle intro → battle → battle result
7. After-action report
8. Historical Notes — sources, assumptions register, documented / simulated / counterfactual.
9. Settings (reduced motion, effects quality, text size) and Saves (continue, export / import, abandon)
10. About / Credits / Privacy

**Mobile:** the Challenge is fully playable. The map takes the full screen, panels become bottom sheets, and route preview works by tap-and-hold. The full campaign will say "best on a larger screen" but stays functional.

## 2.17 Historical integrity in the game
- Every factual statement in the game links to a source entry. Simulated values link to the assumptions register.
- Badges: *Documented* · *Simulated* · *Your campaign*.
- AI-generated illustrations are captioned *Artistic reconstruction (AI-assisted)*. Period artworks are captioned with artist, date and source.

## 2.18 What makes it fun, and how we'll know
**Fun hypotheses:**
- the tightening tether;
- the cat-and-mouse with an opponent who doesn't want to fight;
- the timing puzzle of when to halt and when to push;
- the reveal when battle lifts the fog;
- the urge after the report to try again.

**Evidence:**
- Day 7 prototype session with you;
- bot statistics (§7);
- two observed playtests with 2 fresh testers each (§8).

The signal to watch: unprompted "let me try again".
