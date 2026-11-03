# Brief for an AI agent playing the targeted playtest

Paste everything below the line into a **fresh** agent session, one that has not seen this project's reviews, balance reports or code, and replace `<PLAYTEST_COMMIT>` with the commit you want tested (the full SHA of the build you hand over). The agent needs a browser and a shell with Node.js 22.12 or later (or 24 LTS), and nothing else: no account, no key, no payment. Its results are an interface pre-check, kept apart from the human playtests of milestone M3.

---

You are playtesting a browser strategy game, *The Weight of Empire: The Vitebsk Decision* (Napoleon's advance on Smolensk, August 1812), for its developer. The test is whether a player can **predict** what the game will do from what the screen shows, not whether the game can be won.

**Get the game (record the time you start)**
1. `git clone https://github.com/heinislepping210/the-weight-of-empire.git`, `cd the-weight-of-empire`.
2. `git checkout --detach <PLAYTEST_COMMIT>`, then report the output of `git rev-parse HEAD`. As a check, step A of the script should say when the battle panel shows its line about Stand orders.
3. `npm ci --ignore-scripts --no-audit --no-fund`, then `npm run dev`. Open the address it prints (normally http://localhost:5173) in a browser at least 1200 pixels wide. Record the time: setup ends, play starts.

**Rules for this test**
- Read only `docs/playtests/2026-11-03-targeted-playtest.md`, and follow it. Until your sheet is complete, do not open anything else in the repository: the source, the tests and the other documents contain the answers you are asked to predict.
- **In the browser,** use your browser tool the ordinary way: look, click, type, scroll, resize the window, take screenshots, and read the error console. Do not run JavaScript in the page, inspect the game's state or storage with developer tools, inspect network traffic, or call the game's engine directly. Use only what the page shows.
- Do not run bots, tests or scripts against the game, and do not change any file.
- Do not create accounts or enter personal information. Return the report and any screenshots in this chat only.
- You are an AI agent, not a human tester: say so in your report, label your 1–5 ratings as an agent's observations, and keep what you saw on screen apart from what you inferred.

**Scoring**
- Write each prediction and the screen wording you relied on **before** the click that resolves it.
- **Not triggered:** the event never occurred. **Couldn't verify:** it occurred, but the screen never showed the result.
- **Conflicting numbers:** report a number only when it conflicts with another figure the screen shows, citing both places. Don't guess which one is right.

**The narrow window, without disturbing the game:** do it at one orders pause, after you have written that pause's predictions and set your orders. Set the window 800 pixels high. At 901, 900, 899, 768 and 390 pixels wide, scroll **Commit orders for the next two days** into view and take a screenshot, without clicking, noting whether the map or its legend covers it. Then, at 900 pixels, click it once. If the date moves on two days, that was your commit for this turn. If it doesn't, return to the desktop width and commit there. Commit only once.

**What to send back**
1. The output of `git rev-parse HEAD`, the setup time and the play time, separately.
2. The completed sheet from the script, every row with its prediction, the screen wording you relied on, your confidence, what happened, and its status (confirmed, contradicted, not triggered, couldn't verify).
3. For each contradicted prediction: what on the screen led you to it, and what would have told you otherwise. Don't guess at causes inside the game.
4. Any deviation from the scripted opening, and why.
5. The narrow-window results: covered or clear at each width, with the screenshots, and whether the click at 900 pixels committed the orders.
6. Console errors, conflicting numbers, or text that contradicted what then happened, each with the date in the game.
7. The ending and its reasons as the end screen shows them, and your own explanation, kept apart.

Do not suggest rule changes or balance values; report what you saw.
