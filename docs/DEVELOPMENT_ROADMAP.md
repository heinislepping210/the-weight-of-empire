# Development Roadmap

*Section numbers (§) are shared across all project documents; the index is in the README.*

## 1.1 What ships first
The first release is **The Vitebsk Decision only**, made genuinely excellent before anything expands (§10).

**The 3-week date is aspirational.** It depends on active development, testing and your feedback. The priorities are fixed: first a genuinely enjoyable playable prototype; then the living map, built to the agreed standard; then everything else.

**The hard rule:** if the Day 7 prototype (M1) isn't fun, or the Living Map (M2) isn't accepted, the date moves and we fix the problem first. I won't ship a hollow game to hit a deadline. A weak first impression with professors costs more than a one-week slip.

| In the first release | Deferred (comes back afterwards) |
|---|---|
| The Vitebsk Decision (~10 turns, 7–10 min) | The full campaign, The Road to Smolensk |
| Army directives with standing orders and decision points (§2.4b); detailed group orders optional | — |
| One sector-battle system, 2 battlefield templates (Smolensk; open field) | More battlefield templates (Ostrovno, Mogilev, Krasnyi…) |
| ~10 event types | ~25–35 event types |
| Contextual tips (Guided), which you can switch off (Standard) | A fuller guided tutorial flow |
| 1 video clip (intro) | Battle-transition clip, ending clip |
| No audio | Ambient and UI sound (CC0) |
| Desktop-first; mobile fully playable for the Challenge | Mobile polish for the full campaign |

## 1.2 Playable in 7–10 minutes without losing depth
- **The simulation stays as described in §2:** five force groups, real logistics, a responsive opponent. Only the *interaction* is simplified in Challenge mode (§2.4b): one army directive, persistent orders, staff defaults and forecasts. The game stops only at decision points.
- **Expected shape:** ~10 turns, **~6–8 decisions**, and one battle of ~3–4 decisions.
- **Measured, not assumed.** A playtest mode (switched on by a link parameter) records completion time, number of decisions and help use on a summary screen at the end. Nothing is sent anywhere.
- **Target:** median first-time completion of 7–10 minutes (not counting time spent reading the report), and no tester over 15.
- **If it runs long, adjust in this order:** (1) fewer decision points; (2) a later start date, which shortens the span; (3) 3-day turns. Strategic choices are never removed to save time.

## 1.3 Milestones and acceptance criteria
**M1 — Fun prototype (Day 7)**
- The full Challenge runs end-to-end on a plain debug map.
- 1,000-seed bot runs show zero invariant violations, and the determinism and resumption tests pass (§3.4).
- At least three approach families produce clearly different outcome distributions.
- **You can play at least two different strategies on the same seed** — for example the southern envelopment and the concentrated push up the Rudnia road — and compare their consequences side by side: key figures over time (effectives, supply, fatigue, horses, Russian position) and how each run ended.
- Before committing, you can see exactly what each directive will make every group do (§2.4b).
- **You play it once.** *Pass:* you felt both dilemmas (spread out vs. concentrate; push vs. halt) and can name a trade-off you made. *Fail:* we fix the mechanics before any polish.

*M1 status (31 October 2026):*
- **Done:** the full Challenge plays end to end on the prototype screen. Every order is visible with its reasons before committing. Two strategies on the same seed can be compared side by side (checked in the browser with "southern swing" against "hold dispersed").
- **Done:** determinism, resumption and conservation tests, under random play with the real Russian command.
- **Done:** the 1,000-seed batch with seven bots. It now fails on any invariant violation; there are none.
- **Done (rules 0.6.0):** captured stores and forward depots, with a supply stance in the directive.
- **Done (rules 0.7.0):** hunger's effect on cohesion set from the historical record, a judgment within a researched range (D-030).
- **Done (rules 0.8.0):** contacts corrected after the independent review (D-031): reinforcements join battles, opposing columns cannot pass each other, retreats take time on the road, and a halt stops every march.
- **Done (rules 0.9.0):** horses, carrying and foraging reach (D-032). The endings hardly depend on the new values within their researched ranges.
- **Done (review stage C):** one plan for preview and commit, a kept route, and an army summary first (D-033). Keeping the route showed the southern-envelopment bot had been flattered before. The road is now chosen per group, own road by default on a long detour (D-034), and the southern envelopment is a real approach again (GAMEPLAY_BALANCING.md, the kept route).
- **Done (rules 0.10.0, review stage D):** the outcome model as §2.13 defines it (D-035). Most earlier victories turned out to come from the old rules. Now only cutting the Moscow road at Valutino wins, no approach inflicts a decisive defeat in battle, and the halt-on-the-spot bot ends precarious because outlying corps starve. Better bots (stage F) come next.
- **Done (rules 0.11.0, review stage F):** scenario and dice separated, and a measure of skill, situation and luck (D-036).
  - Luck from the battle dice is about a fifth of the outcome.
  - Half is which approach suits which scenario; the one adaptive policy tested could not read it at the start.
  - No halt consolidates, because the placeholder depot stocks cannot feed the army for 20 days. That needs research on the 1812 magazines.
- **Done (rules 0.12.0, the second independent review):** five defects fixed, the rout rule added, the experiment's measures and claims corrected (D-037).
  - Fixing the road order cut the concentrated push's collapses from 33% to 7%. Fixing the route into the objective lets the southern envelopment hold Valutino: it now wins 82% of its games, mostly as Costly Victories, and is best on 85% of seeds among the tested bots.
  - The foraging reach is now 11 km, from the source read correctly, instead of 22 km. Across that range only the methodical bot and the halts were affected.
- **Done (rules 0.17.2, D-044):** the road by the Prudichevo ford from Smolensk's Old Town to the Moscow road, found missing by the pinning bot and documented by Foord (1914). The Russians now withdraw east from Smolensk more and fight less; French blocks left to the marshal give up the trap (the holding envelopment: Costly Victory 7%, against 29%), while a block that stands holds nearly as well as before. Then the stand order (D-045): a block that stands holds the trap again (the holding envelopment: Costly Victory 21%, the Guard at the base: Decisive Success 4.8%).
- **Done (rules 0.17.0–0.17.1, D-043; built on the `sector-battles` branch and merged):** the sector battles of §2.10, contracts first and a playable slice before the extensions. Russian main armies now sometimes break in battle (up to 32 times per 100 games for the trap), but no tested approach has produced a decisive battle defeat: the breaks fall short of the 30% within four days that it needs, and no army was ever trapped. The trap wins a little less often than before (Costly Victory 29% against 35%). All battle values are placeholders; the four with the largest effects were measured and kept (your decision, checkpoint B).
- **Done (bots on rules 0.16.0, no rule change):** two variants of the holding envelopment that look after its supply. Leaving the Guard at the main depot while the corps make the swing reaches the first Decisive Successes in a measurable share (6.4%); halting groups for their wagon trains does worse. The corps at Valutino are still unfed in most cut-off games.
- **Done (rules 0.16.0):** two competent bots, and a retreat defect they exposed (D-042): an army repulsed by a block escaped through it. A southern envelopment that holds Valutino now wins a third of its games, at a cost; its army cannot be fed there, having outrun its wagon trains; lifting the 80 km haul limit does not change that (what-if run). A concentrated strike still cannot break a Russian army.
- **Done (rules 0.15.0):** supply issued by need and judged day by day, and arrival forecasts that follow the movement rules (D-040). A loophole that let corps fill their wagons through their own trains was closed; corps now draw all the food they can carry (your decision). Collapses all but disappear and the slower approaches take Smolensk, but still no tested approach wins.
- **Done (rules 0.14.0):** what a cut road earns is judged at the end (D-039, your decision: graded). The southern envelopment's victories came from cuts the Russians walked away from; now no tested approach wins. The next work is bots that can hold the trap or force a decisive battle, not a looser rule.
- **Done (rules 0.13.0):** movement in time order, the second review's recommended next phase (D-038). A junction meeting no longer depends on which force's name sorts first, and a tied attacker is drawn instead of always French. The push's collapses fall from 7% to 4%; the southern envelopment is unchanged.
- **Met:** "three approach families produce clearly different outcome distributions" (even more so on 0.10.0). On rules 0.8.0, and nearly the same on 0.9.0:
  - concentrated push: mostly Limited Success (58%), Operational Collapse in 30%;
  - southern envelopment: spread from Decisive Success (8%) to Repulse (31%);
  - bait and converge: mostly Costly Victory (75%).

  (GAMEPLAY_BALANCING.md, contacts corrected.)
- **Open:** among the tested bots one approach dominates (F3: the southern envelopment is best on 85% of seeds). The strategy now explains 39% of the outcome against 4% for the scenario (F4, rules 0.12.0), but that reflects one dominant bot more than skill measured well. Better bots and an adaptive policy that re-decides every turn are still needed.
- **Waived (4 November, your decision, D-049):** you chose to skip your play session and continue building. Whether the game is fun is now first checked by the human playtests of M3 (Day ~15); the risk is that a problem with the mechanics shows up later, when it costs more to fix. The targeted playtest script and the agent brief remain available.

**M2 — The Living Map (Day ~13) — an explicit gate before battles, events and the report are polished**

*Gameplay criteria:*
- **G1 Real alternatives.** Three genuinely different routes from Vitebsk towards Smolensk: the Rudnia road; the southern swing across the Dnieper via Rasasna–Liady–Krasnyi; the northern flank via Poreche. Each has a distinct preview, and bot runs show the shortest route is not automatically the best.
- **G2 Geography bites.** The Dnieper needs a bridge or the pontoon train. Marsh and forest slow movement. Road capacity makes single-road marches slow. All of this shows in the previews.
- **G3 Fast previews.** A route preview appears within 100 ms of hover or tap: arrival range, fatigue, supply at arrival, crossings, known threats.
- **G4 Visible consequences.** Every committed decision visibly changes the map during playback. Every change in the top bar can be traced on the map: select it and the cause is highlighted.
- **G5 Living supply corridors.** Active supply lines show delivery against need, turn by turn. A bottleneck appears when demand exceeds delivery and clears when it's fixed.
- **G6 A moving opponent.** Russian positions show their intelligence age, last-seen markers fade, and Russian movement is visible whenever it's within detection range.
- **G7 Keyboard play.** Everything works by keyboard, with a list alternative to the map.

*Visual criteria:*
- **V1** Terrain is painted from real geodata in the watercolour-and-engraving style. *Pass:* you'd show it to a professor without apology.
- **V2** Pan and zoom are smooth: ≥ 55 fps median on your Mac with all layers on, and three zoom bands (theatre / operations / local) with no seams or popping.
- **V3** Army markers show their state: marching column, deployed line, or dispersed in cantonments (so spreading out is visible). Marker size reflects strength, and a worn condition shows in the marker's treatment as well as in text.
- **V4** Convoys: wagons visibly move along the roads at simulated speed, their density reflects throughput, and a raid is visible where it happens.
- **V5** Consequences stay on the map: stripped districts, burned stores, mud after storms, dust in the heat.
- **V6** Weather overlays (rain, haze, mist) follow the simulated weather. Reduced-motion mode keeps static indicators.
- **V7** The camera briefly focuses on consequential moments such as a contact or a raid; this can be skipped.
- **V8** Labels are readable and don't overlap at the default zoom, with WCAG AA contrast.
- **V9** It works at 1280×800, at 1920×1080, and at tablet and phone sizes.

*Live demonstration (about 3 minutes):*
1. Pan and zoom across the theatre.
2. Compare the three routes.
3. Order the southern swing.
4. Playback: columns march, convoys follow, Cossacks raid a convoy, and a supply corridor turns into a bottleneck.
5. The Russians shift to cover Krasnyi.
6. A storm turns the roads to mud.

*M2 status (4 November 2026):*
- **Done, first slice (the map's camera and markers):**
  - The camera: drag to pan, pinch or Ctrl + scroll to zoom (plain scrolling zooms once the map has focus, so the page still scrolls past it), arrow keys, + and −, 0 for the whole theatre, and on-screen buttons. Three zoom bands: theatre, operations, local.
  - Labels and markers keep a readable size on any screen. Where the map is drawn small (a phone, the whole theatre), markers show only their sign and strength, and only the main places are named until you zoom in.
  - Markers show what a group is doing (marching, in battle, dispersed to feed, concentrated), sized by strength; a worn group is dashed and says so (V3, in part).
  - Enemy reports fade with age and become dated "last seen" markers after two turns (G6, in part).
  - Smolensk's Old Town and north-bank suburb share one label and stack until the local zoom; no labels overlap at the default zoom at 1280 × 800, 1440 × 900 or phone width, though a marching marker can still cover part of a place's label (V8, in part).
  - The map as a list, for keyboard and screen-reader play (G7, in part).
- **Done, second slice (route previews, G3, and G1 in part):** the Route list is a set of cards, the shortest roads and each route traced from the lead group. Each card previews what that route would do for the whole army, planned as it would be committed: the arrivals (first by dry roads, last in wet weather), groups arriving only after the campaign ends, the most tired group on arrival (the staff's forecast now carries fatigue) and the worst-fed, the river crossings and how (bridge, ford, pontoon), and the known enemies near the way. Pointing at or focusing a card draws on the map where each group would march; choosing it is a click. All the routes for an objective are planned together in 3–7 ms, well inside G3's 100 ms.
  - **Found by the previews, and fixed (rules 0.18.1, D-050):** two of the three routes could come to the same orders. On the opening turn the route by Orsha and Dubrovna gives exactly the orders of the route by Rasasna: groups join a chosen route where their total road is shortest (D-034), which for this route is at Liady, after the places that name it. The card says "Same orders as …". G1 asks for three genuinely different routes. *Measured (GAMEPLAY_BALANCING, "Following a chosen route"):* if a group already on a route follows it from where it stands ("on-route"), the three routes come apart and no bot's orders change; if every group must pass the route's first named place, the trap plans lose most of their wins. You adopted on-route: the three routes to each objective now give three different sets of orders on the opening turn, and to the north bank they are G1's three, by Rudnia, by Rasasna and Liady, and by Surazh and Porechye. That meets G1's distinct previews; its other half, bot runs showing the shortest route is not automatically the best, is unchanged by this rule.
- **Done, third slice (playback and supply lines; G4, G5 and V4 in part, G6):**
  - Each turn plays back on the map, hour by hour, in about four seconds, with a clock. Groups and wagon trains move along the roads at their simulated speed (a train 1.5 km an hour on a post road), and contacts, battles, skirmishes, captured depots and deliveries show where they happen. Skip or Escape ends it; it can be played again; with reduced motion it is not animated. Afterwards a thin line shows where each group went, beside the dashed plan for the next turn.
  - The frames are recorded while the turn resolves, through a read-only watch: a game played with playback is the same game, tested on the real scenario step by step. They hold only what the French know: Russian forces move on the map while a French force has them within detection range (G6), at the scouts' estimate; Russian wagon trains are never shown.
  - Supply lines run from each depot to the group or depot its wagons serve, wider for more a day. Each says what its train can bring a day at that distance, on today's roads, against what its group eats; a line that brings less is red and marked "!", and clears when a depot nearer or more wagons fix it. The round trip it assumes is the one the trains make in play (tested). On the opening turn the trains of Eugène and of the Vanguard are already short. The lines are also listed under the map as a list.
  - **Not yet:** a raid on a convoy (V4) needs a rule we do not have, which would change results and so needs measuring and your decision; G4's tracing of a change in the top bar to its cause on the map; a battle stopping playback and resuming it after the battle screen (the battle panel opens beside it for now); carts that show throughput rather than a train's size (the line's width shows throughput); the camera's focus moments (V7).
- **Done, fourth slice (weather and consequences; V5 and V6 in part, V7):**
  - Consequences stay on the map, as the French know them: districts are hatched by how much foragers have taken (foraged, stripped, bare), as last seen within a French force's detection range; a flame marks stores burned when a depot changed hands; crossed sabres mark a battlefield, with its result and our losses; a pale wash marks the roads columns marched along on dry days, and a brown wash the roads in mud. Each has its words on the map and in the map as a list.
  - The weather follows the simulation: rain falls over the map on a rainy day, during playback day by day and afterwards, and the roads turn to mud overnight after it (all roads at once, as the rules have it). With reduced motion the rain is a still hatch.
  - During playback the camera moves in on a contact, a battle or a depot changing hands for about 1.5 s and back; "Follow events" turns it off (remembered on this device), it is off with reduced motion, and it stops once you move the map.
  - **Not drawn, because the game does not simulate them:** heat, haze and mist (the dust is only what dry roads and marching show), and a storm as more than a day's rain. Each would need a weather rule, measured first, and your decision. *Requisitioned* and *Hostile* districts wait for the requisition policy.
- **Measured, frame rate (V2):** a median of 60 fps in every phase, the most a 60 Hz display shows, against the 55 fps asked. The slowest 5% of frames stayed at 56.8 fps or better while panning, zooming through the three bands and playing a turn back. Two runs on the production build in the app's browser pane covered every layer, with rain and mud in one and dust and a battlefield in the other. One earlier rainy run slowed to 30 fps in its second half and was not repeated by a rerun (TESTING_AND_QA, "Frame rate"). Still to do: one run of the probe (`tools/measure-fps.js`) in a full-size browser window. There is no terrain yet, so no seams; labels change at the band boundaries by design.
- **Done, fifth slice (real geography, steps 1–3 of the geodata plan; V1 in part):**
  - Download batch 1 (approved 4 November): Natural Earth rivers and lakes, 15 SRTM relief tiles, and Piadyshev's provincial maps of 1820–21, 91.5 MB, kept out of the repository and hashed in `tools/geo/manifest.json`.
  - Built into a 119 KB data file that loads after the game starts.
  - The map now shows the real relief as a watercolour wash, engraved hachures from the operations zoom in, and the rivers in ink with the Dnieper and the Dvina named. It is credited under the map, with rows R-003 to R-005 in the rights register.
  - Checked against the network: four findings for your decision, chiefly that the Rasasna pontoon sits on a road that crosses no river in the data (MAP_AND_GEOGRAPHY, "Real geography").
  - V2 holds with the terrain on, after a fix: a 60 fps median, the slowest 5% of frames at 58.1 fps or better, while zooming and panning.
  - **Checkpoint A passed (4 November, your decision, D-051):** you judged the terrain against V1's bar ("you'd show it to a professor without apology") and said "Looks right". V1 stays in part until forest and marsh are painted.
- **Next slices:** forest and marsh from a rights-checked 19th-century survey (download batch 2, your approval); the roads checked on Piadyshev's maps; the G2 rules for terrain and road capacity, measured first; the Canva art (your approval for each generation and its credits).

You accept it, or list changes.

**M3 — Challenge complete (Day ~15)**
- The full flow works: briefing → directives → battle → ending → report with your Minard → share link and image.
- Reloading at any moment, including mid-turn and mid-battle, resumes exactly where you were (§3.4).
- A new player finishes without help in playtest round 1.
- Playtesters rate *"I felt in command"* and *"I could predict what my orders would do"*: the median is at least 4 out of 5 on both.

**M4 — Release candidate (Day 21)**
- Fairness criteria F1–F6 met (§7), or exceptions you have accepted.
- The duration target from §1.2 met in playtests, or an adjustment we've agreed.
- The whole Challenge is playable by keyboard, axe reports no serious violations, and reduced motion works.
- Performance budgets met (§3.8).
- Every shipped asset cleared in the rights register, and the name check reported.
- No console errors in current Chrome, Safari, Firefox and Edge, or on iOS Safari and Android Chrome.
- **You approve → we deploy.**

## 1.4 Sharing
Send the release to a small first circle first: your 4 testers plus a few friendly contacts. Widen to professors and executives a few days later, after fixing what that circle finds. The link stays the same; only the audience grows.

## 8 Schedule and what I need from you

Day 0 was 31 October 2026, so the aspirational share target is ~21 November. The days below are a plan, not a promise: milestones move with development, testing and your feedback. The one fixed date is the end of Canva Pro (~30 November) — every asset must be exported before then.

| Days | Code track (me) | Art track | **Your time** |
|---|---|---|---|
| 0 | — | — | Approve this plan (~30 min); check your Canva AI usage page (5 min); book your testers |
| 1–3 | Repository and docs; region research and assumptions register v1; geodata; resolution architecture built first (§3.4) | Art direction doc; approval request for the LOG-01 style reference (2–4 generations) | Approve and compare the style reference (~45 min) |
| 2–6 | Engine with resumable resolution, directives and staff planner, bots, first fairness report | First export → provenance check (§6.2) | Approve installing the metadata tools (1 min) |
| **7** | **M1 — fun prototype** | — | **Play it and give feedback (~45 min)** |
| 8–13 | Living map: terrain, layers, route previews, convoys, fog, playback; UI shell; battle v1 in parallel | Manifest finalised at real UI proportions | — |
| **13** | **M2 — Living Map demonstration** | Approval request for batch 2 | **Watch the demo; accept or list changes (~30 min)**; approve batch 2 (~15 min) |
| 13–15 | Battle, report, share; directive polish | Batch 2 generation + VID-01 | Review candidates; generate VID-01 (~1 h) |
| **15** | **M3 — Challenge complete** | — | **Playtest round 1 with 2 testers (~1.5 h)** |
| 16–19 | Playtest fixes; events; mobile; accessibility; fairness tuning | Integrate batch 2; regenerate weak assets (with approval) | — |
| **19** | — | Approval request for batch 3 | **Playtest round 2 with the other 2 testers (~1.5 h)**; approve batch 3 (~15 min) |
| 20–21 | Final QA (tests, bot runs, browser checks); legal pages; name check | All exports finished by ~27 November | — |
| **21** | **M4 — release candidate** | — | **Review and approve the deployment to GitHub Pages (~1 h)** |

**Your total: roughly 8–10 hours over 3 weeks.** Please book your 4 testers now for around Days 15 and 19.

At every milestone you get: what's done, what was tested, what's incomplete, open design or historical uncertainties, what I need from you, and the next milestone.

**Schedule risks:** the M1 fun check, the M2 map gate, review turnaround, tester availability, and Canva quality or retries. If any of these slips, I'll tell you that day, with options.

## 9 After the share

1. Collect feedback from the first circle → fixes → widen the audience.
2. **The Road to Smolensk** (full campaign, 30–45 min): extend the map west to the Niemen and Vilna; preparation phase; the objective of preventing the Russian armies from uniting; more battlefield templates and events; sound (CC0).
3. Final release QA. Any decision on public code (§6.3 option B).
