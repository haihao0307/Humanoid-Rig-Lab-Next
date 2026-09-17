# Chicken R10.0 Centerline Sweep V7.1 — Implementation and Truth Boundary

## Why V7.1 exists

V7 correctly identified that the old radial carrier mixed torso, neck and head vertices in the same longitudinal station. It therefore split the neck/head into a separate closed shell and transported that shell over the cervical centerline.

The first V7 browser evidence nevertheless failed visually. The cut started around `x≈0.086`, where the source rings still represented the full body cross-section. Removing their dorsal sector opened a large vertical hole in the torso. During pecking, frame/tangent offsets also allowed neighbouring rings to overtake one another, producing a long folded surface sheet. The CI pass proved only that the expected revision strings, contacts and numerical ring checks existed; it did not prove a usable chicken.

V7.1 addresses those structural causes rather than hiding them with more pose rotations.

## Implemented V7.1 architecture

1. The original body carrier remains the torso source.
2. The independent neck/head shell now begins at `x=0.255` instead of inside the middle torso.
3. The torso remains intact until `x=0.2835`, giving a controlled `0.0285` overlap over two source stations rather than an open vertical cut.
4. The shell root follows the chest rigidly and blends into the cervical sweep over the first 28% of shell length.
5. The cervical surface uses a sign-continuous rotation-minimising transported frame.
6. Per-ring tangent offsets are discarded; normalized centerline arc length controls longitudinal placement.
7. Ring centre normal/lateral offsets are smoothed over neighbouring stations, while each ring profile remains unchanged.
8. Browser diagnostics now report actual median, P95 and maximum longitudinal edge-length ratios for the rendered peck pose.
9. One identity helper bone is still used only for the Three.js `SkinnedMesh` path; the motion rig remains 21 logical bones.

Active implementation:

- `runtime/chicken_phase1_centerline_sweep_v71_adapter.mjs`
- `tools/chicken_r100_centerline_patch.js`
- `tests/chicken_phase1_centerline_sweep_adapter.test.mjs`
- `tools/verify_chicken_r100_centerline_v7.mjs`
- `tools/capture_chicken_r100.mjs`

Revision identifiers:

```text
weightingRevision=anatomical-neck-root-preserving-centerline-sweep-v7.1
topologyRevision=torso-preserving-neck-root-split-v7.1
centerlineCurveRevision=rotation-minimizing-frame-centerline-v2
```

## Local structural evidence

The deterministic V7.1 audit currently reports:

```text
original carrier: 72 × 96 radial sweep, 6,914 vertices, 13,824 triangles
independent neck shell: 20 rings × 32 samples, 640 vertices, 1,216 triangles
torso retained: 11,480 triangles (83.04398%)
torso/shell overlap: 0.0285 x-units
retained post-boundary neck-sector triangle violations: 0
normalized arc-length round-trip error: below 0.005
```

These numbers prove that the new split is deterministic, the shell is closed, the torso is no longer cut through its central body region, and the two surfaces have a bounded transition overlap. They do not prove that the rendered seam, silhouette or motion is visually acceptable.

## Required V7.1 browser gates

A fresh browser build must prove all of the following before human visual review:

- logical bone count `21`;
- actual skeleton bone count `22`;
- helper bone count `1`;
- V7.1 topology, weighting and frame revision strings are active;
- exactly one independent neck shell is detected;
- the torso retains between 75% and 93% of source triangles;
- peck-frame rendered ring-area ratio remains within `0.70–1.35`;
- peck centerline length ratio remains within `0.90–1.10`;
- peck longitudinal edge ratio has `P95 < 2.25` and `maximum < 3.50`;
- bill and support-foot contacts remain inside tolerance;
- fixed-bone-length invariant remains true;
- no console, page or request failures occur.

Even a technical pass will not constitute manual visual approval. The rendered peck, side view, isolated torso and isolated neck shell must still be inspected for gaps, doubled surfaces, self-intersection, a vertical body cut, excessive stretching and head/comb detachment.

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

Group testing remains prohibited. The next accepted milestone is one chicken whose torso, neck/head shell, bill, feet and external head parts remain coherent through idle, look, peck, walk, turn, short run, wing balance and stop.
