# The Weight of Empire

*Ambition is unlimited. Resources are not.* (working title)

A browser-based historical strategy game about ambition, logistics and judgement. The first release is **The Vitebsk Decision**, a short command challenge set in August 1812: the Grande Armée stands at Vitebsk, and the united Russian armies hold Smolensk.

**Status:** milestone M1, the fun prototype, is waiting for its play session. In place:
- **The simulation** (rules 0.8.0):
  - supply by weight, dispersal and gathering;
  - intelligence and a Russian command that sees only what it has scouted;
  - the halt for the season;
  - captured stores and forward depots;
  - hunger's effect set from the historical record (a judgment within a researched range);
  - contacts: forces move hour by hour, reinforcements join battles, opposing columns cannot pass on a road, and retreats take time.
- **The Vitebsk–Smolensk scenario.**
- **Army directives with a staff planner:** every order is shown with its reasons before you commit.
- **A provisional outcome evaluator.**
- **Strategy bots and a 1,000-seed balance batch.**
- **A plain prototype screen** that compares runs side by side.

The living map (M2), sector battles, events and the after-action report are still to come. If you are reviewing the project, start with [REVIEW_BRIEF](docs/REVIEW_BRIEF.md).

## Development

Requires Node.js 22 or later.

```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

`npm run typecheck` and `npm run build` are also available.

**Playing the prototype:** run `npm run dev`, then open http://localhost:5173. Pick an objective (from the list or by clicking a place), a route, pace and posture, and read the staff's orders before committing. Use **Save run** and **Compare runs** to set two strategies on the same seed side by side, and **Undo last turn** to try a different choice.

## Documents

Section numbers (§) are shared across all documents, so a reference like "§3.4" points to the same place wherever it appears.

| File | Contents | Sections |
|---|---|---|
| [PROJECT_VISION](docs/PROJECT_VISION.md) | vision, priorities, approval rules, agreed decisions, scope boundaries | §0, §10 |
| [DEVELOPMENT_ROADMAP](docs/DEVELOPMENT_ROADMAP.md) | first-release scope, milestones and acceptance criteria, schedule | §1, §8, §9 |
| [GAME_DESIGN_DOCUMENT](docs/GAME_DESIGN_DOCUMENT.md) | the game design | §2 |
| [TECHNICAL_ARCHITECTURE](docs/TECHNICAL_ARCHITECTURE.md) | stack, modules, resumable resolution, turn timeline, persistence | §3 |
| [MAP_AND_GEOGRAPHY](docs/MAP_AND_GEOGRAPHY.md) | operational network, geodata pipeline, data licences | §3.7 |
| [HISTORICAL_RESEARCH](docs/HISTORICAL_RESEARCH.md) | research plan, sources, verification rules, findings | §4 |
| [HISTORICAL_ASSUMPTIONS](docs/HISTORICAL_ASSUMPTIONS.md) | register of every claim and game assumption | — |
| [CANVA_ART_DIRECTION](docs/CANVA_ART_DIRECTION.md) | visual identity, prompt rules, shared style block | §5.1, §5.2, §5.5 |
| [CANVA_ASSET_MANIFEST](docs/CANVA_ASSET_MANIFEST.md) | asset list, batches, production rules, handoff | §5.3, §5.4, §5.6, §5.7 |
| [RIGHTS_AND_LEGAL](docs/RIGHTS_AND_LEGAL.md) | Canva terms, provenance, licences, privacy, rights register | §6 |
| [GAMEPLAY_BALANCING](docs/GAMEPLAY_BALANCING.md) | fair bots, diagnostic targets F1–F6 | §7 |
| [TESTING_AND_QA](docs/TESTING_AND_QA.md) | tests, timeline tests T1–T10, playtests | §7 |
| [DECISIONS](docs/DECISIONS.md) | decision log | — |
| [REVIEW_BRIEF](docs/REVIEW_BRIEF.md) | for outside reviewers: where to start, what feedback helps, known gaps | — |

## Licences

- **Source code:** MIT ([LICENSE](LICENSE)).
- **Not covered by the MIT licence:** artwork (AI-assisted, not licensed for reuse), historical images and map data. These keep their own terms, listed in [RIGHTS_AND_LEGAL](docs/RIGHTS_AND_LEGAL.md). Any OpenStreetMap-derived data would sit under ODbL in `data/geo/odbl/`.
- Files waiting for a rights check (`assets-incoming/`) are never committed.
