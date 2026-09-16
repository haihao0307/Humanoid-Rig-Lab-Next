# Chicken V4.6 R9.8.2 — Legacy Eye Removal and Bill Refinement Candidate

## Active executable

`CHICKEN_V46_R9_8_2_HEAD_EYE_BILL.html`

## Frozen rollback

- exact R9.1 executable: `CHICKEN_V46_R9_1.html`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

## What changed

The persistent neutral-gray rosette was traced to legacy eye parts in the `parts` mesh, not to the replacement iris module. R9.8.2 supplies exactly four eye patches—two embedded spherical eyes and two compact upper lids—so the existing exclusion rule removes legacy part IDs 1 and 2. The eyes are shifted upward/forward and the short bill is further narrowed and embedded.

## Evidence and QA

- parameters: `data/CHICKEN_R982_HEAD_EYE_BILL_PARAMETERS.json`
- static QA: `qa/CHICKEN_R982_STATIC_QA.json`
- browser QA: `qa/CHICKEN_R982_BROWSER_QA.json`
- visual review board: `evidence/r982/R982_REVIEW_BOARD.html`
- manifest: `BUILD_MANIFEST_R982.json`

Browser QA passed: `true`.

## Truth boundary

This remains a visual construction candidate. Manual visual acceptance, whole-surface freeze, Rig and Motion remain closed.
