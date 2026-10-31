# Canva Art Direction

The visual identity and the rules every Canva prompt follows. Full art direction is expanded before the style-reference request. *Section numbers (§) are shared across all project documents; the index is in the README.*

## 5.1 Visual identity (proposed; detailed in `CANVA_ART_DIRECTION.md`)
- **Map:** warm laid-paper ground; watercolour washes for water, marsh and forest; engraved hairline roads and hachured relief; ink labels in a refined serif; numbers in a clear sans with tabular figures. Force markers are stylised formation blocks in muted national colours, with shape and pattern as well as colour.
- **Illustrations:** cinematic oil painting in the manner of early-19th-century academic landscape and military painting. Restrained palette: parchment ochre, stone grey, charcoal, subdued navy, military green, accents of aged gold and dull crimson. Natural directional light, atmospheric haze. Figures small to medium, faces rarely prominent.
- **Interface:** dark charcoal-navy panels with parchment cards. Gold is used only for the selected or active state; crimson only for danger. Minimal ornament: no giant borders, no fake grain.
- **Type:** open-licence (OFL) fonts, **self-hosted**. Final pairing chosen in the art direction document.

## 5.2 The hard rules for Canva prompts
- No text, lettering, maps, legible flags, insignia or inscriptions in any image.
- No snow or winter in summer scenes.
- No modern objects or anachronistic weapons.
- Compose around AI's weak spots. Logistics subjects — roads, wagons, horses, river crossings, bivouacs, weather — are on-theme *and* forgiving. Keep uniform close-ups rare.
- One **style anchor** image is generated first. Every later image uses it as a style reference, plus the same style block.
- **Real historical people are never AI-generated.** Portraits come from public-domain paintings: Napoleon from David's *The Emperor Napoleon in His Study at the Tuileries* (1812, National Gallery of Art, Washington; to be checked against the gallery's open-access terms); Barclay, Bagration and Kutuzov from George Dawe's Military Gallery portraits (public domain; per-scan rights checked).
- **No Canva library (stock) content in any game asset** — only our own AI outputs. This keeps rights simple (§6).

## 5.5 Example — the shared style block and prompt for LOG-01
> **Style block (appended to every image prompt):** Oil painting in the manner of early-19th-century European academic landscape and military painters, cinematic composition, confident visible brushwork, restrained palette of warm parchment ochre, muted stone grey, deep charcoal shadow, subdued navy and military green with small accents of aged gold and dull crimson, soft natural directional light, atmospheric depth and humid haze. No text, no lettering, no legible flags or insignia, no frames or borders, no watermark, no modern objects.
>
> **LOG-01 scene:** Summer 1812 in Lithuania, the afternoon after a thunderstorm. A long column of heavy four-wheeled military supply wagons with canvas covers, drawn by teams of tired draught horses, struggles along a deeply rutted, waterlogged dirt road through flat country of birch groves and wet meadows. Several wagons are stuck axle-deep; drivers in plain greatcoats and soldiers in shirtsleeves push at the wheels. The column recedes into the distance towards a pale horizon under breaking storm clouds; a low sun breaks through from the left. Eye-level camera slightly above the road, wide framing, figures small to medium scale, faces not prominent. Mood: effort, exhaustion, enormous distance. Exclude: snow, winter, modern vehicles, cannons in the foreground, close-up faces.

**Historical review points for this image:** wagon types, harness, civilian-style drivers, a plausible landscape. Anything wrong gets a corrected prompt.

## 5.1a Palette (working values, to be confirmed against the style reference)

| Role | Hex | Use |
|---|---|---|
| Parchment | `#E9DFC8` | paper ground of the map; cards |
| Warm ochre | `#C9A66B` | land washes; supply state "strained" |
| Stone grey | `#8C877D` | secondary text on parchment; relief |
| Charcoal | `#23211F` | ink linework; primary text |
| Subdued navy | `#1F2A38` | interface panels |
| Military green | `#4B5A3C` | forest washes; positive states |
| Aged gold | `#B08D4A` | selected or active state only |
| Dull crimson | `#8E2F2A` | danger only |

Every text and colour pair is checked for WCAG AA contrast before use. Colour is never the only signal (§2.6, §2.14). Illustrations use the same colour families through the shared style block; they are not tinted afterwards.

## 5.2a Illustration rules

- **Light:** natural and directional — low sun, or overcast with breaks — with atmospheric haze. No theatrical spotlights.
- **Composition:** wide, with the horizon in the upper or lower third. Large figures only at mid-distance; faces rarely legible. Calm areas are left where interface text will overlay them; where those areas fall is set per asset once the layouts are fixed (§5.3, batch 2).
- **Season:** summer 1812 (late July to August). Green-to-gold fields, dust or mud, heavy thunderclouds. Never snow.
- **Landscape:** flat to gently rolling country; birch, pine and mixed woods; wooden villages with thatched or plank roofs; sandy or muddy dirt roads. Churches and town architecture are checked scene by scene.
- **Consistency:** every generation after the style reference uses it as its style reference image and appends the §5.5 style block word for word.

## Historical review checklist (every image)

- No legible text, flags, eagles, insignia or inscriptions.
- No snow or winter clothing in summer scenes.
- Weapons: flintlock muskets and smoothbore field guns only. No rifles with modern features, no percussion caps, no breech-loaders.
- Vehicles: horse-drawn wagons and carts only.
- Uniforms, where visible, are kept at a distance and claim no regimental detail. Obvious anachronisms (kepis, steel helmets, modern cloth) are rejected.
- **Learned from LOG-01:** when a prompt says "soldiers", the model defaults to peaked caps, belted olive or khaki greatcoats and red trouser stripes — late-19th-century or First World War dress. Describe clothing positively and in period terms. Prefer civilian drivers and labourers (linen shirts, smocks, low round felt hats, bare heads) where the scene allows. Check every figure's headgear at full size.
- **Also learned:** an "edit only the clothing, keep everything else" request changes too little to fix it. Correct the clothing in a fresh generation instead, and keep foreground figures few, small or seen from behind.
- Landscape and buildings are plausible for Lithuania, Belarus and western Russia.
- Every published image is captioned *Artistic reconstruction (AI-assisted)*.

## The style reference (LOG-01)

It is the first image generated, and it anchors every later one. It is accepted only if:
- its brushwork and palette match §5.1 and §5.1a;
- its light is natural and directional, with atmospheric depth;
- it passes the historical checklist;
- it still reads at thumbnail size as well as full screen.

The prompt is in §5.5. Generation requires your approval (§5.6).
