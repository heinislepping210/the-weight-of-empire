# Rights, Licences, Privacy and Legal

*I'm not a lawyer and can't guarantee legal outcomes. What I can do is design so that the known risks are avoided, document every source, and flag anything uncertain to you before launch. If you want certainty on a specific point, a lawyer or a university IP clinic is the right check.*

*Section numbers (§) are shared across all project documents; the index is in the README.*

## 6.1 What Canva's AI Product Terms say (read directly, version effective 26 June 2026)
- **You own your Output**, as between you and Canva and to the extent the law allows. You may use it "for any lawful purpose" at your own risk. **Exception:** output that modifies or incorporates Canva library content is only licensed, not owned. That is why we never use library content.
- **Prohibited:** misleading anyone that AI content is human-made → **every AI image is labelled AI-assisted**.
- **Prohibited:** removing, altering or disabling provenance or metadata tags, **including C2PA** → see §6.2.
- Outputs may not be unique; other users can get similar images. This is acceptable for us.
- Usage limits are adjustable and not guaranteed, so we plan with a margin.
- Separately: in the US, purely AI-generated images may not be protected by copyright. Others could copy them. That is acceptable, but worth knowing.

## 6.2 Provenance metadata: verify first, then decide
The terms forbid removing, altering or disabling *any* provenance or metadata tags. So we check what Canva actually embeds before deciding how to optimise:

1. **Inspect the first export (LOG-01)** with `tools/check-provenance.mjs`, which needs nothing installed. It lists every metadata block, including C2PA. If a manifest needs full validation, the C2PA reference tool can be added later, with your OK. I record exactly what each file carries.
2. **If it carries C2PA provenance data:** that data is cryptographically bound to the image, so re-encoding would break it. Images are then exported from Canva at the exact pixel sizes the game needs, at a sensible quality setting, and **served unchanged**. Small files come from right-sized exports and lazy loading, not from re-encoding.
3. **If it carries only ordinary metadata (EXIF/XMP):** we may resize and convert, but only with a pipeline that copies every tag unchanged into the new file. A test checks that the tags match the original.
4. **If it carries no metadata at all:** normal optimisation is fine.
5. **In every case:** the original exports are archived, a sample from each new batch is re-checked (Canva could change its exports), and the §3.8 budgets apply — no image larger than its display needs, and lazy loading for anything off screen.

## 6.3 Repository and hosting
You've said a public GitHub repo under your username is fine, which makes the simplest option the best:
- **A public GitHub repository on your account, hosted free on GitHub Pages.** A GitHub Actions workflow deploys it, but only when you approve a release.
- **Code under the MIT licence.** The artwork is excluded from that licence, with a notice that it is AI-assisted and not licensed for reuse. Public-domain works are credited, and map-data notices (ODbL attribution) are included.
- **Only rights-cleared files are ever committed.** `assets-incoming/` is excluded from git, so a test image or an unchecked file never becomes public, not even in the history.
- **Commits use your GitHub no-reply email address,** so your personal email stays private.
- Map data with share-alike obligations (ODbL), if any is used, stays in its own folder under its own licence (MAP_AND_GEOGRAPHY.md).
- The site itself still carries no personal information (§6.4).

## 6.4 Privacy (no personal information about you *or* players)
- **No** analytics, accounts, cookies, ads, contact forms or third-party requests. Fonts are self-hosted, because loading them from Google's servers has caused privacy rulings in the EU.
- Saves and settings live only in the player's browser. They are strictly necessary for the feature the player asked for, so no consent banner is needed under the usual EU rule. A short privacy note says exactly this.
- **The About page** covers the project's origin, method, AI disclosure, sources and credits — **no creator name, bio or contact**. You can add a project-only contact later if you want one. Your GitHub username appears only in the web address and on GitHub, as you agreed.
- One question for you: **which country do you live in?** Some countries (Germany, for example) require a legal notice on certain websites. A non-commercial personal project is often exempt, but I want to flag it properly rather than guess.

## 6.5 Other safeguards
- A rights register for every third-party item: source, date, licence, restrictions, attribution.
- Library of Congress and museum items are checked one by one, never assumed public domain.
- No copyrighted music. No assets or interface copied from commercial games.
- **The name "The Weight of Empire"**: before launch I search Steam, itch.io and the US trademark database, and report what I find. That is a conflict check, not legal clearance.
- Respectful treatment of suffering: civilian consequences are visible, conquest is never glorified, and the report has no moralising tone.

## Rights register

Every third-party or generated item that ships, or is stored in the repository, gets one row *before* it is committed.

| ID | Item | Source / URL | Date obtained | Licence / terms | Restrictions | Attribution shown | Checked by / date |
|---|---|---|---|---|---|---|---|
| R-001 | LOG-01 candidates `MAHZmiHqaIY`, `MAHZmkdYET8` (downloaded to `assets-incoming/log-01/`, not committed); candidate 3 `MAHZnSDGhgI` (an edit of candidate 1) | Canva AI image generation through the connector, in folder `FAHZmm3ZWCY` | 2026-10-31 | Canva AI Product Terms (effective 26 June 2026): we own the output; no Canva library content used | Files carry XMP, EXIF and a signed C2PA manifest (`trainedAlgorithmicMedia`); serve unchanged, never re-encode (§6.2); label as AI-assisted | *Artistic reconstruction (AI-assisted)* | Claude, 2026-10-31: all three checked for provenance (signed C2PA in each). Candidate 2 rejected; candidates 1 and 3 fail the clothing check, so neither may be shipped as a game image. Candidate 3 is kept as an internal style reference (D-022) |
| R-002 | Place coordinates in `src/data/vitebsk/places.ts` (item IDs recorded per place) | Wikidata, query.wikidata.org and the Wikidata API | 2026-10-31 | CC0 1.0 | none | courtesy credit to Wikidata in Credits | Claude, 2026-10-31 |

## Third-party software

Direct dependencies, pinned to exact versions. Each version was at least two weeks old when installed (a supply-chain precaution).

| Package | Version | Licence | Used for |
|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | user interface (shipped) |
| vite | 8.3.4 | MIT | development server and build |
| @vitejs/plugin-react | 6.1.2 | MIT | build |
| typescript | 7.0.2 | Apache-2.0 | type checking |
| vitest | 5.0.5 | MIT | tests |
| fast-check | 4.10.2 | MIT | property-based tests |
| @types/react, @types/react-dom | 19.3.0 | MIT | type definitions |

Only React ships to players. All of these licences permit use in an MIT-licensed public project.
