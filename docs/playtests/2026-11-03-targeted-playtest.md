# Targeted playtest: can you predict stand, retreat and the verdict?

About 25 minutes. One player (you, or a tester) and, if you can, an observer who only writes things down. Asked for by the third review ([record](../reviews/2026-11-02-third-review.md), "recommended next phase", point 3). Only what you report counts; nothing here is filled in by me.

## What it answers

1. Can a player predict which of their corps will stand and which will retreat?
2. Can a player predict what a retreat does to a block on the enemy's road?
3. Can a player explain why holding a place ends in Limited Success?

And two open items: where a French corps beaten on Smolensk's north bank should fall back (GAMEPLAY_BALANCING, 0.18.0, "Open"), and whether the map covers the orders in a narrow window (your layout fix, not yet committed).

## Setup (2 minutes)

- Open the game. In the project folder run `npm run dev`, then open http://127.0.0.1:5173 in a browser.
- Type **13** in Seed and press **New game**. Write down the time.
- Fight at least the first battle yourself: **Deploy and command the battle**. After that you may leave battles to the marshal.

## The plan to play

The holding envelopment, the one plan that wins among the tested bots:
- **Objective** Smolensk (the Old Town); **Route** the one by Rasasna; **Pace** Steady; **Battle** Accept. Then **Commit orders for the next two days**.
- Once you hold Smolensk, or reach Valutino: **Objective** Valutino, **Battle** Stand, and keep it to the end.
- Change anything you like, but say why out loud.

## Predict, then look

Write each prediction on the sheet *before* you click, then what happened.

- **A. Before each battle's first round:** "If we lose the position here, will our marshal hold on or break off?" Then read the line about Stand orders in the battle panel, and watch what he does.
- **B. Before committing orders, when one of your groups may fight next:** "If it is beaten, which place will it fall back to?" In the battle, the panel names your road out; afterwards the dispatches say where it went.
- **C. When the Russians are beaten near your block:** "Can they get away, and by which road?" The battle panel shows only your own road, not theirs, so this is your guess from the map; the dispatches tell you afterwards.
- **D. At the end, before reading the verdict:** "Which ending, and why?" Then **Save for comparison**, open **Compare runs**, and read the verdict and its **Why** list.
- **E. Only if it happens:** a French corps is beaten on Smolensk's north bank while French troops hold the Old Town. "Where should it go: back to Rudnia, or across the bridge into the town?" Then where it went.

Once during the game, narrow the window below 900 pixels: can you still reach **Commit orders for the next two days** without the map sliding over it?

## Sheet

Start time: ____  End time: ____

| # | Date in the game | Kind (A–E) | Your prediction | What happened | Right? |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |

- Decisions you made in battle: ____ ; of those, how many you could explain afterwards ("I did X because Y"): ____
- "I could predict what my orders would do", 1–5: ____
- "I felt in command", 1–5: ____ (the M3 target is a median of at least 4 on both)
- Narrow window: the map covered the orders? yes / no
- What surprised you, one line each:

## For the observer

Don't help. If the player asks what something will do, ask back: "What do you think it will do?" Note the moments the player hesitates or is surprised, with the date in the game.

## Afterwards

Send me the sheet, or tell me what happened. I'll record it in the third review's record. The Stand, retreat or verdict text changes only where the predictions show a gap, and only with your approval.
