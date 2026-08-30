# Anatomical Skeleton S1 User Visual Review Checklist

Evidence entry: `http://127.0.0.1:4173/human-core-v5-anatomical-skeleton-s1-binary-v1.html`

Contact sheet: `24 anatomical-skeleton-s1-contact-sheet.png`

The evidence was captured from the local HTTP page in the Codex in-app Chromium browser at a `1280 x 720` viewport. The repository does not claim visual acceptance on the user's behalf.

## Full skeleton scaffold

- [ ] Front, left-side, back, and three-quarter views retain the expected full-body hierarchy.
- [ ] Joint centers remain aligned with the skeleton line scaffold.
- [ ] Left/right presentation is mirrored consistently.
- [ ] Labels and local-axis overlays are legible enough for review.

## Femur prototype

- [ ] Femoral head is anatomically plausible and does not appear pointed or faceted.
- [ ] Femoral neck transitions cleanly into the head, shaft, and trochanter region.
- [ ] Greater and lesser trochanters are distinct and correctly placed.
- [ ] Anterior shaft bow is plausible from the medial and lateral views.
- [ ] Medial and lateral distal condyles are individually legible.
- [ ] Posterior intercondylar notch is clearly recessed and readable.
- [ ] Left and right baseline femora form a consistent mirror pair.

## Variants and LOD

- [ ] The +0.8% length variant differs from baseline without an unintended camera change.
- [ ] The +10 degree anteversion variant differs from baseline without an unintended camera change.
- [ ] The 0.2% left/right asymmetry variant is visible without breaking the mirrored scaffold.
- [ ] LOD0, LOD1, and LOD2 preserve the same overall silhouette without unacceptable feature loss.

## Acceptance

- [ ] No visual refinement is required.
- [ ] Set `userVisualAcceptance` only after completing this review.

Current repository conclusion: `S1A_VISUAL_REFINEMENT_REQUIRED`.
