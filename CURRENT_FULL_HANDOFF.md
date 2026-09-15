# Chicken V4.6 R9.2 — Head Shape Restore Candidate

## Active executable

`CHICKEN_V46_R9_2_HEAD_SHAPE.html`

## Frozen rollback

- exact R9.1 executable: `CHICKEN_V46_R9_1.html`
- exact R9 executable: `history/CHICKEN_V46_R9_FROZEN.html`

Neither frozen file is modified by the R9.2 build.

## What changed

R9.2 replaces the rejected thin/wedge-like whole-head envelope with one bounded, low-frequency carrier deformation. The edited domain restores posterior cranium width, crown volume, a continuous crown–forehead–bill-root slope, cheek width, lower-jaw support and throat continuity. Existing eye/eyelid, nostril, wattle, ear-lobe, continuous-comb and material modules are reattached through the existing surface chart.

## Evidence and QA

- parameters: `data/CHICKEN_R92_HEAD_SHAPE_PARAMETERS.json`
- static QA: `qa/CHICKEN_R92_STATIC_QA.json`
- browser QA: `qa/CHICKEN_R92_BROWSER_QA.json`
- visual review board: `evidence/r92/R92_REVIEW_BOARD.html`
- candidate manifest: `BUILD_MANIFEST_R92.json`

Browser QA passed: `true`.

## Truth boundary and gates

This remains a visual construction candidate. It is not measured skull anatomy and does not establish breed, sex, age or individual identity.

```text
r9_2LowFrequencyCandidateBuilt=true
browserQAPassed=true
manualVisualAcceptance=false
wholeVisualGatePassed=false
canonicalChickenSurfaceComplete=false
rigAuthorized=false
motionImplemented=false
productionReady=false
```

## Next action

Review R9.2 in neutral gray from left, front, top and three-quarter views. Only after the whole-head silhouette is accepted may the head be frozen and the project proceed to static rig planning.
