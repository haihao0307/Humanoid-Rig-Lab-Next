# R02.4 eyebrow registration and aged shape candidate

## Why R02.3 was not visually accepted

The user rejected R02.3 after inspecting an angled close-up. It incorrectly combined remnants of the source scan's brows with new fibres positioned by a symmetric world-x/y arc. Real source-UV-to-triangle correspondence shows that the right outer eyebrow ends near (41.9, 69.2, 57.1) mm, while the old procedural arc extended toward x=58 mm, y=75.5 mm. Left and right source brows are asymmetric. R02.3's weathered identity changed texture and hair but retained the neutral adult geometry.

## Current candidate

- A source-albedo contrast mask determines the actual UV eyebrow region on each side. Root placement and guide direction follow this region and its actual triangle UV derivatives, including the downward-turning outer tail. No mirrored head or unrelated GNM index is used.
- The same region clears source eyebrow colour and inherited local normal/meso/micro/surface-height remnants. Outside that small region, the original 4K detail remains. Identity features RGB now means source eyebrow root region / source eyebrow detail-replacement region / authored height. Nearby measured forehead detail replaces inherited eyebrow strokes with soft boundaries, instead of a flat painted strip.
- The weathered identity uses the independent reversible AgeMorph module: mid-face volume redistribution, registered eye-bag/tear-trough/upper-lid shapes, local mouth-corner descent and jowl/submental soft tissue. This is art-directed scan editing, not a medically validated age prediction.
- Hair AND all original 14,000 fuzz fibres are rebuilt on the current shaped scan. Region masks use neutral coordinates; positions/normals and relief bindings use the current deformed geometry.
- The original R02 identity restores its original position/normal arrays byte-for-byte and its original map/material route. Old R02.2 and R02.3 fixed commit links remain available.
- New oblique, profile, high and brow-close cameras; an actual eyebrow-region diagnostic view; an untextured/hairless shape comparison; and an aged-shape toggle make the requested changes inspectable.

## Validation boundaries

Independent geometry tests cover unchanged topology/UV, zero seam gaps, no inverted triangles, finite normals, and 20 byte-exact restoration cycles. Main-application multi-view screenshots, browser/UI regression and original-R02 pixel comparison still determine integration acceptance. A green automated result is not user visual approval. Each candidate must be reviewed from angled/high/profile views as well as the front.

No outside restricted portrait, scan or groom asset is introduced. Existing scan and Three.js attribution remain in THIRD_PARTY.txt. The fibre model retains the documented bounded approximation and analytic coverage limitations.
