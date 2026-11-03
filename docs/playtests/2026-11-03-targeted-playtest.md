# Targeted playtest: can you predict what the game will do?

About 30 minutes of play. The test is whether you can predict what the game does from what the screen shows, not whether you win. Play one campaign with the opening below, and before each of the moments A–E, write down what you expect and what on the screen you base it on. Then write down what happened.

If you can, have an observer who only takes notes. Observers: don't help; if the player asks what something will do, ask back "What do you think it will do?"

## Setup

- **Record** the build you play (the commit, if you run it from the repository) and the time you start setting up.
- Run the game: in the project folder, `npm ci` once, then `npm run dev`, and open the address it prints (normally http://localhost:5173). Node.js 22.12 or later, or 24 LTS.
- Type **13** in **Seed** and press **New game**. Record the time: play starts now.

## The opening (scripted; record any deviation and why)

**Turn 1:** change only these, and leave everything else as the screen offers it:
- **Objective:** Smolensk (Old Town)
- **Route:** Via Liubavichi and Rasasna (174 km from Liozno)
- **Pace:** Steady · **Groups that halt:** Dispersed · **Battle:** Accept · **Supply:** Keep the depots (these are the defaults)
- No orders for single groups. Then **Commit orders for the next two days**.

**Each later turn:** keep these orders until French troops hold Smolensk (Old Town) or reach Valutino. From then on: **Objective** Valutino and **Battle** Stand, to the end.

**Battles:** command the first one yourself (**Deploy and command the battle**, then **Continue the plan** each round). You may leave later battles to the marshal (**Deploy and leave the battle to the marshal**).

## Predict, then look

For each moment, fill a row of the sheet *before* the click that resolves it: your prediction, the evidence on screen you relied on (quote the wording), and how confident you are. Afterwards fill in what happened and its status:
- **confirmed:** it happened as predicted;
- **contradicted:** something else happened;
- **not triggered:** the event never occurred;
- **couldn't verify:** it occurred, but the screen never showed the result.

**A. Stand.** In a battle, after reading the battle panel (at the deployment or at a round) and before you deploy, continue or leave it to the marshal: "If the French lose the position in this battle, will the marshal hold on or break off?" Quote the panel wording you relied on. (The panel has a line about Stand orders only when some of your men in that battle are under them; if it has none, say so.) If you command the battle yourself, or the position never falls, the answer can't be checked: mark it couldn't verify.

**B. A French corps falling back.** Pick one named French group that is likely to fight soon.
1. On the orders screen, before committing: "If this group is beaten, where will it fall back to?"
2. In the battle, after the panel shows the road out: the same question again.

If it does fall back, compare both answers with the dispatch. Otherwise mark both not triggered.

**C. A Russian army leaving.** Before resolving a battle in which the Russians may be beaten near your troops: "Can they leave? Where might they go? Will your position still matter afterwards?" "I can't tell from the screen" is a valid answer: if you give it, write down what information was missing. Score only what you can check on the map, in the dispatches or at the end.

**D. The ending.** Before committing the last turn's orders (turn 10): "Which ending do you expect, how confident are you, and which two facts will decide it?" Then read the end screen. Write, in your own words, why the game ended as it did. Keep the ending's name apart from your explanation; you may understand what happened without knowing what the game calls it.

**E. A French corps beaten on Smolensk's north bank.** Only if a battle begins on the north bank (the St Petersburg suburb) while French troops hold the Old Town. Before reading the road line in the battle panel, answer two separate questions:
1. "Where do you expect our troops there to go if they are beaten?"
2. "Where would you order them to go, and why?"

If it never happens, mark not triggered.

## The narrow window (if you are testing the layout)

Do this at one orders pause only, after you have written that pause's predictions and set your orders, so that the check does not change the game. Set the browser window to 800 pixels high. At each of **901, 900, 899, 768 and 390 pixels** wide, scroll until **Commit orders for the next two days** is in view and note, without clicking, whether the map or its legend covers it (a screenshot at each width helps). A single check at one width can miss the fault. Then, at 900 pixels, click the button once. If the date at the top moves on two days, that was your commit for this turn. If it doesn't, go back to your usual width and commit there. Commit only once.

## Sheet

Build: ____ · Setup started: ____ · Play started: ____ · Play ended: ____

| # | Date in the game | Step (A–E) | Prediction | Evidence on screen (quote it) | Confidence (low / medium / high) | What happened | Status |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |

Add rows as needed.

- Deviations from the opening, with reasons:
- Decisions made in battle: ____ ; how many you could explain afterwards ("I did X because Y"): ____
- "I could predict what my orders would do", 1–5: ____ · "I felt in command", 1–5: ____ (an agent marks these as an agent's observations)
- Narrow window: covered or clear at 901 / 900 / 899 / 768 / 390? Did the click at 900 commit the orders?
- Console errors, or text that contradicted what then happened (with the date in the game):
- Conflicting numbers: a figure that disagrees with another figure on the screen, citing both places (don't guess which is right):
- What surprised you, one line each:

## Optional, after the sheet is done

Compare shows the verdict side by side once two runs are saved: **Save for comparison**, start seed 13 again, play a quick second game to its end (for example, tick **Declare a halt** on the first turn and commit each turn), save it, and open **Compare runs**.
