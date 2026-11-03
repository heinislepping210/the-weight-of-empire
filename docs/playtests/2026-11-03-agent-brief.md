# Brief for an AI agent playing the targeted playtest

Paste everything below the line into a **fresh** agent session, one that has not seen this project's reviews, balance reports or code. It needs a browser and a shell with Node.js 22.12 or later (or 24 LTS), and nothing else: no account, no key, no payment. The agent's results are an interface pre-check, kept apart from the human playtests of milestone M3.

---

You are playtesting a browser strategy game, *The Weight of Empire: The Vitebsk Decision* (Napoleon's advance on Smolensk, August 1812), for its developer. The test is whether a player can **predict** what the game will do from what the screen shows, not whether the game can be won.

**Get the game (record the time you start)**
1. `git clone https://github.com/heinislepping210/the-weight-of-empire.git`, `cd the-weight-of-empire`.
2. Pin the build to the commit that last changed this brief: `git checkout $(git log -1 --format=%H -- docs/playtests/2026-11-03-agent-brief.md)`. Record the commit.
3. `npm ci --ignore-scripts --no-audit --no-fund`, then `npm run dev`. Open the address it prints (normally http://localhost:5173) in a browser at least 1200 pixels wide. Record the time: setup ends, play starts.

**Rules for this test**
- Read only `docs/playtests/2026-11-03-targeted-playtest.md`, and follow it. Until your sheet is complete, do not open anything else in the repository: the source, the tests and the other documents contain the answers you are asked to predict. Do not read the game's internal state in the browser either; use only what the page shows.
- Do not run bots, tests or scripts against the game, and do not change any file.
- Do not create accounts, enter personal information, or send anything anywhere. Saved runs stay in the browser's local storage.
- You are an AI agent, not a human tester: say so in your report, label your 1–5 ratings as an agent's observations, and keep what you saw on screen apart from what you inferred.

**What to send back**
1. The commit, the setup time and the play time, separately.
2. The completed sheet from the script, every row with its prediction, the screen wording you relied on, your confidence, what happened, and its status (confirmed, contradicted, not triggered, couldn't verify).
3. For each contradicted prediction: what on the screen led you to it, and what would have told you otherwise. Don't guess at causes inside the game.
4. Any deviation from the scripted opening, and why.
5. The narrow-window results at 901, 900, 899, 768 and 390 pixels (window 800 pixels high), whether the click at 900 committed the orders, and screenshots if you can.
6. Console errors, wrong numbers, or text that contradicted what then happened, each with the date in the game.
7. The ending and its reasons as the end screen shows them, and your own explanation, kept apart.

Do not suggest rule changes or balance values; report what you saw.
