# Chicken V4.6 R10.0 — Centerline Sweep V7.1 Single-Agent Candidate

## Active executable

`CHICKEN_V46_R10_0_SINGLE_AGENT.html`

## Current baseline

The previous V7 workflow passed its numerical and browser automation gates, but the evidence exposed a decisive visual failure: the topology cut began inside the upper torso, and the peck pose pulled the detached neck surface into a long folded sheet. Therefore “CI passed” was not treated as visual acceptance.

V7.1 keeps the independent neck/head shell, but changes the attachment logic:

- the shell starts only at the anatomical upper-neck emergence;
- the torso is preserved farther forward, creating a short controlled overlap instead of a vertical open cut;
- the shell root follows the chest rigidly before blending into the cervical sweep;
- the transported frame uses sign-continuous rotation-minimising transport;
- per-ring tangent offsets are removed;
- browser QA now measures actual longitudinal edge strain during the peck pose.

Local syntax, unit, topology and deterministic-build gates pass. A fresh V7.1 browser run and manual visual review are still required, so this remains a candidate rather than a frozen morphology baseline.

## Priority remains fixed

1. single-agent morphology and topology;
2. single-agent motion naturalness;
3. grounding, collision and blocked-task recovery;
4. bounded individual variation;
5. small-group test;
6. complex life activity later.

## Active revisions

```text
weightingRevision=anatomical-neck-root-preserving-centerline-sweep-v7.1
topologyRevision=torso-preserving-neck-root-split-v7.1
centerlineCurveRevision=rotation-minimizing-frame-centerline-v2
```

## Primary files

- `R100_CENTERLINE_V7_IMPLEMENTATION.md`
- `runtime/chicken_phase1_centerline_sweep_v71_adapter.mjs`
- `tools/chicken_r100_centerline_patch.js`
- `tests/chicken_phase1_centerline_sweep_adapter.test.mjs`
- `tools/verify_chicken_r100_centerline_v7.mjs`
- `tools/capture_chicken_r100.mjs`
- `qa/CHICKEN_R100_CENTERLINE_V7_QA.json`

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

The current largest risk is no longer simple ring collapse. It is whether the torso/neck overlap remains visually coherent through a deep peck while the longitudinal surface strain stays bounded. Numerical contact or topology checks alone cannot approve the result.
