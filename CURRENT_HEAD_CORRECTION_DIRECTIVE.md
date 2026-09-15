# Chicken Head Correction Directive — Reference Lock

## Status

The current executable remains `CHICKEN_V46_R9_1.html`.

The user has rejected the **overall low-frequency head silhouette** of R9.1. The rejection is specific and must not be overwritten by the fact that some local details (comb continuity, nostrils, eyelids, wattles, material separation) improved.

No code-level head correction based on the newly approved image is claimed in this package. This package locks the reference and preserves the exact current executable so the next developer can modify from a reproducible baseline.

## Approved visual reference

`reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png`

Use it as the direct visual anchor for:

1. cranium fullness and back-of-head volume;
2. continuous crown–forehead–beak-root slope;
3. cheek and lower-jaw support volume;
4. beak-root integration rather than an inserted wedge;
5. comb attachment that does not distort the skull silhouette;
6. eye placement and wattle attachment relationship.

The image is a visual construction reference, not measured anatomy and not a texture source.

## Required next implementation

1. Preserve the currently effective local systems as reusable modules: eye/eyelid candidates, paired nostrils, wattle candidates, material identities, and continuous comb generator.
2. Restore the earlier, fuller low-frequency head volume before reattaching those local systems.
3. Rebuild the head carrier in object-local coordinates; do not patch the silhouette by moving only the comb or beak tip.
4. Validate in left, front, top, and three-quarter views with neutral gray material before enabling color.
5. Provide three-way evidence: frozen R9, current R9.1, and corrected R9.2.
6. Keep an exact rollback to this package.

## Gate

Rig, skin binding, and motion remain blocked until the corrected whole-head silhouette is accepted.
