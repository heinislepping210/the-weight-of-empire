# Canva Asset Manifest

*Section numbers (§) are shared across all project documents; the index is in the README.*

## Status

No asset has been generated yet; the game uses placeholders. Nothing is generated, no credits are used, and nothing is exported without your approval for that batch (§5.6). No transformation of an AI image (resizing, re-encoding, cropping, colour changes) happens before its provenance check is recorded, and afterwards only what §6.2 allows. A machine-readable `assets/manifest.json` is added with the first asset.

## Production log

**Canva project folder:** "The Weight of Empire" (`FAHZmm3ZWCY`), created 31 October 2026. Nothing outside this folder is used or touched.

| Date | Asset | Approved batch | Generations used | Canva media IDs | Status |
|---|---|---|---|---|---|
| 2026-10-31 | LOG-01 (style reference) | up to 4 generations | 2 of 4 | `MAHZmiHqaIY` (candidate 1), `MAHZmkdYET8` (candidate 2) | Generated with the §5.5 prompt, 16:9, through the Canva connector's image generator (Canva doesn't say which model). Thumbnail review passed on composition, light, palette and readability at small size. Native size **1680 × 944** (JPEG). Export approved on 31 October; downloaded by hand from Canva into `assets-incoming/log-01/` (see the findings below). **Still needed: the provenance check, a full-size historical review, and choosing one candidate.** Not in the repository. |

| 2026-10-31 | LOG-01 (style reference) | same batch | 3 of 4 | `MAHZnSDGhgI` (candidate 3) | An edit of candidate 1, made with candidate 1 as the reference image. The painting is kept and only the men's clothing changes, to plain 1812 civilian wagoners' dress (linen shirts, smocks, low round felt hats, bare heads). Thumbnail check: composition, light and palette all kept. **Full size (downloaded 31 October, PNG, 1680 × 944, 2.5 MB; signed C2PA, `trainedAlgorithmicMedia`):** the edit barely changed the figures. The red cap band is gone and the trouser stripes are fainter, but the pushers and the column still wear peaked caps and belted greatcoats. **Fails the clothing check.** Style identical to candidate 1. |

**Decision (D-022):** candidate 3 is the **style anchor**. It is used only as the style reference image for later generations and is never shipped in the game. The in-game LOG-01 image is regenerated in batch 2 with the corrected clothing guidance. Generations used: 3 of 4; one held in reserve. The first check in batch 2: confirm that using the anchor does not carry its peaked caps into new images.

**Full-size review of candidates 1 and 2** (31 October; files downloaded unchanged into `assets-incoming/log-01/`)

| Check | Candidate 1 `MAHZmiHqaIY` | Candidate 2 `MAHZmkdYET8` |
|---|---|---|
| Brushwork, palette, light (§5.1, §5.1a) | Pass: strong academic oil-painting look; sun breaking from the left | Pass: warmer, more golden |
| Reads at thumbnail size | Pass | Pass |
| No text, flags, insignia or signature | Pass | Pass (a suspected corner mark was only mud) |
| No snow or winter | Pass | Pass |
| Vehicles and horses | Pass: covered wagons, plausible harness | Pass |
| Clothing | **Fail (subtle):** the foreground pushers wear peaked caps, one with a red band, and trousers with red stripes — Russian army of the later 19th century, not 1812 | **Fail (clear):** belted olive greatcoats, cross-straps and peaked caps — reads as First World War; the central standing figure is prominent |
| Verdict | Best basis; fix the clothing (candidate 3) | Rejected |

**Lessons for every prompt:** describe clothing *positively* and in period terms, and keep figures in civilian dress where possible: drivers and labourers rather than uniformed soldiers. Peaked caps and khaki or olive cloth are the model's default for "soldiers"; this goes into the historical checklist and the shared prompt.

**Provenance, as checked with `tools/check-provenance.mjs` and a block-by-block read:**
- Canva's download is a **PNG of about 2.6 MB at 1680 × 944**.
- XMP: `Canva:AI-generation-source="GENERATE_IMAGE"`; EXIF in a raw-profile text chunk.
- A **signed C2PA manifest** (about 22 KB): a *created* action with source type `trainedAlgorithmicMedia` (AI-generated), a *converted* action, and `c2pa.hash.data`, which binds the manifest to the file's exact bytes.
- **Consequence (§6.2, step 2):** we must not resize or re-encode these files; it would break the binding. They are served exactly as downloaded.

**Performance consequence.** 2.6 MB per image is heavy. The home screen's hero image alone would exceed the 1.5 MB first-load budget (§3.8). Options, in order of preference:
1. Test whether a smaller export made **inside Canva** keeps a valid C2PA manifest: place the image in a design of the target size and download it as JPG at a moderate quality. If it does, that is Canva's own pipeline, and compliant.
2. If not: serve the originals, lazy-loaded and preloaded a turn ahead. Revisit the first-load budget for the hero only. Keep the number of images per session small.

Option 1 needs one design created and exported in Canva; it can't be done through the connector, and it needs your approval.

**Findings from the first batch**

- **Exporting.** The connector can generate, file and describe images, but it can't download a generated image. Its export only handles designs, and its design tool creates a new AI layout from a brief, so it isn't suitable. Generated images are therefore downloaded with Canva's own *Download* button. That also keeps the original file, which is what the provenance check needs. This replaces step 5 of the handoff workflow for images; video still comes from your own Canva exports.
- **Resolution.** Connector-generated images come out at 1680 × 944, below full HD. That is fine for event cards and battle intros. For full-screen art (HERO-01, the endings, briefings) on large displays, the options are: (a) generate those in Dream Lab, if it delivers larger images — compare when the style reference is chosen; (b) use Canva's own upscaling, which keeps the work inside Canva's process; or (c) design those screens so the image needn't fill a very wide display. Decided when the batch 2 layouts are fixed.
- **Provenance check.** `node tools/check-provenance.mjs <files>` lists the metadata and provenance blocks a file carries (EXIF, XMP, IPTC, ICC, C2PA) without modifying it. It needs nothing installed, and it has been verified against synthetic JPEG and PNG files.

## 5.3 Initial asset list (13 stills + 1–2 clips, in batches)
| ID | Purpose | Subject (short) | Ratio | Batch |
|---|---|---|---|---|
| LOG-01 | Style anchor; road/supply events | Wagon train stuck in mud on a birch-lined road after a storm | 16:9 | 1 |
| HERO-01 | Home screen | The army crossing a broad river on pontoon bridges at dawn, figures at a distance | 2:1 | 2 |
| HQ-01 | Briefing | Night headquarters in a requisitioned manor; maps, candles, officers in silhouette | 16:9 | 2 |
| BAT-01 | Smolensk battle intro | Old fortress walls under bombardment, smoke, distant columns | 2:1 | 2 |
| BAT-02 | Open-field battle intro | Columns advancing through smoke across rolling fields at dawn | 2:1 | 2 |
| LOG-02 | Heat / straggling | Dusty column in extreme heat; stragglers resting by the road | 3:2 | 2 |
| LOG-04 | Foraging | Foraging party at a village; peasants watching an emptied granary | 3:2 | 2 |
| OPS-01 | Raid | Cossack riders striking a convoy at a forest edge, seen from a distance | 3:2 | 2 |
| OPS-02 | Bridging | Engineers building a pontoon bridge in morning mist | 3:2 | 2 |
| END-01 | Sustainable endings | Orderly camp by a river at sunset, campfires | 16:9 | 2 |
| END-02 | Costly / limited endings | A smouldering city at dawn, exhausted soldiers | 16:9 | 2 |
| END-03 | Failure endings | A long column withdrawing on a ruined road under grey sky | 16:9 | 2 |
| VID-01 | Intro clip (≤8 s) | Slow push along columns and wagons on an endless road at dawn | 16:9 | 2 |
| LOG-03 | Horse losses (full campaign) | Exhausted draught horses beside an abandoned wagon at dusk (restrained) | 3:2 | 3 |
| VID-02 | Battle transition (optional) | Smoke rolling over a field, artillery flashes, no visible outcome | 16:9 | 3 |

**Batch timing:**
- **Batch 1 is only the style reference (LOG-01), on Days 1–3.**
- **Batch 2** waits until M2 is accepted and the layouts of the home screen, event cards and battle intros are fixed (~Days 13–15), so every image is generated at its real proportions. Ratios in this table may change at that point.
- **Batch 3** runs on ~Days 19–24.
- **Every asset must be exported before about 27 November**, leaving a margin before the subscription ends.

Paper and watercolour textures are made in code or taken from CC0 sources, not from Canva.

## 5.4 What each manifest entry will contain
`CANVA_ASSET_MANIFEST.md` holds all 20 fields you listed for every asset: ID, purpose, scene, historical context, composition, ratio, export size, display size, style, lighting, the **full copy-paste prompt**, exclusions, whether a reference image is used, filename, folder, format, size budget, essential/optional, items for human historical review, and rights notes. A matching `assets/manifest.json` lets the game check which files are missing and show placeholders.

## 5.6 Canva production rules and the connector
- **A dedicated space.** All work happens in one new Canva folder, "The Weight of Empire", created only with your approval. I won't open, search, edit or move any of your other designs or assets.
- **Approval before spending.** Before any generation, credit use or export, I send a short request: which assets, how many generations, the estimated share of your allowance, what will be exported, and the file names and sizes of any downloads. **Nothing happens without your yes for that batch.**
- **A style reference first, everything else later.** The only early generation is the LOG-01 style reference: about 2–4 generations, through the connector and/or by you in Dream Lab, so we can compare quality. Extensive generation waits for batch 2 (§5.3).
- **Connector or by hand.** This session's Canva connector can generate images, including with a style reference image. If its quality matches Dream Lab, I generate candidates and you approve them, which saves your time. You generate the video clips in Canva yourself.
- **Before Day 1:** please check your Canva account's AI usage page and tell me what it shows for images and video.

## 5.7 Handoff workflow (repeatable)
1. I specify the asset in the manifest, at its final display proportions.
2. I ask you to approve the batch: which assets, how many generations, how much allowance.
3. Generation happens inside the project's Canva folder — by me through the connector, or by you in Dream Lab.
4. You approve or reject the candidates.
5. With your approval, the export is made at the sizes listed in the manifest (JPG for illustrations, MP4 for video).
6. Files go into `assets-incoming/`, which is never committed to git until the asset is cleared.
7. I check provenance metadata (§6.2), dimensions, quality and historical details, and record the asset in the rights register.
8. I integrate it into the game.
9. We review it in the game: keep it, or regenerate it.

The game always runs with placeholders, and missing assets are listed on a debug page.
