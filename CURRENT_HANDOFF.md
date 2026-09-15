# Chicken V4.6 R9.1 — Full Handoff with Approved Head Reference Lock

## Current executable baseline

`CHICKEN_V46_R9_1.html`

The executable, frozen R9 rollback, data, evidence, and QA are preserved exactly from the prior R9.1 handoff.

## New project truth

The user has rejected the overall head silhouette of R9.1. The main error is low-frequency form, not merely surface detail:

- cranium and back-of-head volume are too thin;
- crown-to-beak-root slope is incorrect;
- forehead/beak transition reads as a wedge;
- cheek, lower-jaw, and throat support volume are insufficient;
- local improvements do not compensate for the incorrect whole-head shape.

The newly approved reference is locked at:

`reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png`

It is a visual construction reference, not measured anatomy, not a texture, and not proof of a specific breed, sex, or individual.

## What remains valid

- current procedural body, wing, body-plumage, tail, and feet systems;
- R9 frozen rollback;
- current local eye/eyelid, nostril, wattle, comb, and material modules as reusable candidates;
- current QA and evidence as historical truth.

## What is rejected

- R9.1 whole-head silhouette as the final baseline;
- treating local comb/detail improvements as proof that the head is correct;
- entering Rig or motion before the head carrier is corrected and accepted.

## Next stage

`V4.6_R9.2_HEAD_SHAPE_RESTORE_FROM_APPROVED_REFERENCE`

See `CURRENT_HEAD_CORRECTION_DIRECTIVE.md` and `06_NEXT_STAGE_PLAN.md`.

## Current gates

```text
technicalGatePassed=true
currentExecutableReproducible=true
approvedHeadReferenceLocked=true
r9_1WholeHeadSilhouetteAccepted=false
manualVisualAcceptance=false
wholeVisualGatePassed=false
canonicalChickenSurfaceComplete=false
rigAuthorized=false
motionImplemented=false
productionReady=false
publicHttpsPublished=false
```
