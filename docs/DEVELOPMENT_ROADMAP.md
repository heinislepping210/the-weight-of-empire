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
- **Done (rules 0.13.0):** movement in time order, the second review's recommended next phase (D-038). A junction meeting no longer depends on which force's name sorts first, and a tied attacker is drawn instead of always French. The push's collapses fall from 7% to 4%; the southern envelopment is unchanged.
- **Met:** "three approach families produce clearly different outcome distributions" (even more so on 0.10.0). On rules 0.8.0, and nearly the same on 0.9.0:
  - concentrated push: mostly Limited Success (58%), Operational Collapse in 30%;
  - southern envelopment: spread from Decisive Success (8%) to Repulse (31%);
  - bait and converge: mostly Costly Victory (75%).

  (GAMEPLAY_BALANCING.md, contacts corrected.)
- **Open:** among the tested bots one approach dominates (F3: the southern envelopment is best on 85% of seeds). The strategy now explains 39% of the outcome against 4% for the scenario (F4, rules 0.12.0), but that reflects one dominant bot more than skill measured well. Better bots and an adaptive policy that re-decides every turn are still needed.
- **Still to do:** your play session.

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
