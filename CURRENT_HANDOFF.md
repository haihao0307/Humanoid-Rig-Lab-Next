# Chicken V4.6 R9.3 — Local Head Restore Candidate

## Active executable

`CHICKEN_V46_R9_3_HEAD_SHAPE.html`

## Rollback and rejected predecessor

- exact frozen R9.1: `CHICKEN_V46_R9_1.html`
- exact frozen R9: `history/CHICKEN_V46_R9_FROZEN.html`
- rejected technical-only R9.2 candidate: `CHICKEN_V46_R9_2_HEAD_SHAPE.html`

R9.2 passed static and browser execution but failed visual inspection: its full-ring field altered long neck sections sharing the same longitudinal stations, creating an enlarged wedge/dolphin-like head. Technical success was not treated as visual acceptance.

## R9.3 change

R9.3 starts again from the exact R9.1 file. It reuses the R9.1 dorsal correction, then applies only localized upper-cranium, cheek and lower-jaw fields. Bill shortening keeps a constant X value across every sweep station, so the surface chart remains monotonic. The eye is slightly larger/lower; the ear-lobe patch is smaller/lower; the nostril follows the shortened bill.

Body, plumage, wings, tail, feet, continuous comb and materials are not redesigned.

## Evidence

- parameters: `data/CHICKEN_R93_HEAD_SHAPE_PARAMETERS.json`
- static QA: `qa/CHICKEN_R93_STATIC_QA.json`
- browser QA: `qa/CHICKEN_R93_BROWSER_QA.json`
- review board: `evidence/r93/R93_REVIEW_BOARD.html`
- manifest: `BUILD_MANIFEST_R93.json`

Browser QA passed: `true`.

```text
r9_2VisualGatePassed=false
r9_3LocalCandidateBuilt=true
r9_3BrowserQAPassed=true
manualVisualAcceptance=false
wholeVisualGatePassed=false
rigAuthorized=false
motionImplemented=false
productionReady=false
```

R9.3 must be judged from the fixed neutral-gray views before any rig or motion work begins.
