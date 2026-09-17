# Chicken V4.6 R10.0 — Centerline Sweep V7 Single-Agent Candidate

## Active executable

`CHICKEN_V46_R10_0_SINGLE_AGENT.html`

## Current baseline

R10.0 V7 replaces the rejected mixed-ring neck deformation with an anatomical topology split. The torso remains on the original body carrier, while the neck/head is rebuilt as an independent closed shell and transported over the posed cervical bone centerline with rigid per-ring frames.

The local topology and mathematics gate passes. A fresh browser run and manual visual review have not yet passed, so this is a candidate rather than an accepted production baseline.

## Priority remains fixed

1. single-agent morphology;
2. single-agent motion;
3. grounding and collision;
4. bounded individual variation;
5. small-group test;
6. complex life activity later.

## Active revisions

```text
weightingRevision=anatomical-topology-split-and-centerline-sweep-v7
topologyRevision=anatomical-torso-neck-split-v7
centerlineCurveRevision=bone-centerline-pchip-volume-preserving-v1
```

## Primary files

- `R100_CENTERLINE_V7_IMPLEMENTATION.md`
- `runtime/chicken_phase1_centerline_sweep_adapter.mjs`
- `tools/chicken_r100_centerline_patch.js`
- `tests/chicken_phase1_centerline_sweep_adapter.test.mjs`
- `tools/verify_chicken_r100_centerline_v7.mjs`
- `qa/CHICKEN_R100_CENTERLINE_V7_QA.json`
- `evidence/r100/centerline_v7_prebrowser/`

## Current gates

```text
localStaticGate=true
localTopologyMathGate=true
browserQAPassed=false
manualMotionNaturalnessAcceptance=false
manualVisualAcceptance=false
singleAgentGroundingComplete=false
singleAgentCollisionComplete=false
groupTestAuthorized=false
productionReady=false
```

The worst remaining technical risk is local longitudinal stretch at short transition edges. Passing numerical ring-area checks alone is not sufficient; the throat, head base and torso/neck seam still require browser and human visual inspection.
