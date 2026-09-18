# Chicken R10.0 · Buried-Root Segmented Neck V8.2

## 1. Why V7 was rejected

The V7 GitHub browser workflow passed its numerical checks, but its browser evidence showed a large sheet-like head/neck membrane during pecking. A green workflow was therefore not evidence of acceptable morphology.

The structural cause was a single carrier shell running from broad torso arcs into the head. Preserving each ring area did not prevent short longitudinal transition edges from stretching by approximately 5.47×.

## 2. What V8.1 changed

V8.1 separated the carrier into:

1. torso triangles driven by pelvis and chest;
2. a generated tapered neck tube transported along the fixed cervical chain;
3. rigid cranial triangles attached to the head bone.

That reduced sampled maximum longitudinal stretch to approximately 1.90×. It also changed coat elements to root-rigid, single-bone assignment so feather cards could not become blended membranes.

However, V8.1 began the tube exactly at `neck_base`. Static review could not guarantee that this ring remained visually buried inside the torso after browser skinning and shading.

## 3. V8.2 topology

V8.2 retains the three-domain architecture and adds one synthetic control point 0.09 workbench units behind `neck_base`, opposite the first cervical direction. This point is not a new logical bone. It is a geometric control point used only to begin the tube inside the chest volume.

The active neck tube therefore follows:

```text
buried_root → neck_base → neck_c0 → neck_c1 → neck_c2 → neck_c3 → head_base
```

The tube contains 34 rings × 28 samples:

- vertices: 952;
- triangles: 1,848;
- start profile: 0.120 normal / 0.095 lateral;
- end profile: 0.050 normal / 0.038 lateral;
- endpoint bone: `head_base`;
- rigid head starts at carrier `x = 0.392`.

The logical skeleton remains 21 bones. A single identity helper bone is used only by the generated neck mesh, and diagnostics report logical and render-bone counts separately.

## 4. Static results

- original carrier triangles: 13,824;
- retained torso triangles: 9,966;
- rigid head triangles: 2,016;
- root ring inside original carrier fraction: 1.0;
- tube-end to rigid-head maximum sampled distance: 0.05232;
- far-arc fold-back clearance at ≥0.20 arc separation: 0.00967;
- bind/peck centerline length ratio: 1.00348;
- longitudinal median ratio: 1.00343;
- longitudinal P95 ratio: 1.34683;
- longitudinal maximum ratio: 1.90475;
- radial ratio range: approximately 1.0 to 1.0;
- deterministic beak ground error: approximately +0.01601.

The static gate now checks the buried root, head overlap, long-range fold-back clearance, fixed cross-section, bounded longitudinal stretch and beak contact. The audit reads the active runtime peck profile and records its SHA-256, preventing the static geometry test from silently drifting away from the browser kinematics.

## 5. Remaining truth boundary

The geometry audit does not include final coat cards, eyes, comb, bill pieces, legs, procedural shader or real browser rasterization. It also does not prove that the full peck descent/contact/recovery loop is natural.

```text
staticSourceAndGeometryGate=true
buriedRootSeamGate=true
browserQAPassed=false
manualMotionNaturalnessAcceptance=false
manualVisualAcceptance=false
singleAgentGroundingComplete=false
singleAgentCollisionComplete=false
groupTestAuthorized=false
productionReady=false
```

## 6. Next browser gate

The next CI run must capture idle, look, peck, walk, turn, short run, wing balance and stop. The side and three-quarter peck evidence must reject:

- a chest/neck opening;
- a visible hard ring at the neck root;
- detached or floating head geometry;
- feather cards floating or cutting through the neck;
- neck self-intersection;
- reappearance of a sheet-like membrane;
- bill contact without valid supporting feet.
