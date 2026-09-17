# Chicken R10.0 Centerline Sweep V7 — Implementation and Truth Boundary

## Why V7 exists

The rejected V5/V6 path assumed that vertices sharing the same longitudinal sweep coordinate belonged to one anatomical ring. That assumption is false for the current radial carrier: a single `x` station can contain lower breast, upper thorax, neck and head vertices at the same time. The consequence is structural rather than cosmetic. When the cervical chain bends, conventional linear blend skinning can drag thorax vertices into the neck and can collapse the neck into a thin rod.

V7 therefore changes topology instead of adding more corrective rotations to the same mixed carrier.

## Implemented architecture

1. The original body carrier remains the torso source.
2. High neck/head sector triangles are removed from the torso carrier.
3. A separate closed 32-sample neck/head shell is rebuilt from 32 longitudinal stations.
4. The shell is deformed along the posed cervical bone centerline:
   - control points come from `neck_base` through `head`;
   - PCHIP interpolation provides a smooth centerline;
   - bind and posed stations are matched by normalized arc length;
   - each shell ring is transported by a rigid local frame;
   - ring cross-section area is therefore preserved by construction.
5. One identity helper bone is added only to satisfy the Three.js `SkinnedMesh` shader path. Diagnostics report both the 21 logical motion bones and the 22 actual skeleton bones.

Active implementation:

- `runtime/chicken_phase1_centerline_sweep_adapter.mjs`
- `tools/chicken_r100_centerline_patch.js`
- `tests/chicken_phase1_centerline_sweep_adapter.test.mjs`
- `tools/verify_chicken_r100_centerline_v7.mjs`

Revision identifiers:

```text
weightingRevision=anatomical-topology-split-and-centerline-sweep-v7
topologyRevision=anatomical-torso-neck-split-v7
centerlineCurveRevision=bone-centerline-pchip-volume-preserving-v1
```

## Local mathematical evidence

The deterministic audit currently reports:

```text
original carrier: 72 × 96 radial sweep, 6,914 vertices, 13,824 triangles
independent neck shell: 32 rings × 32 samples, 1,024 vertices, 1,984 triangles
torso retained: 10,216 triangles (73.9005%)
retained neck-sector triangle violations: 0
normalized arc-length round-trip error: 2.78e-17
prototype peck/bind centerline length ratio: 0.92428
rigid ring area ratio: approximately 1.0
radial edge ratio: approximately 1.0
```

These numbers prove only that the topology split is deterministic, the shell is closed, the torso no longer contains the removed cervical sector, and rigid ring transport preserves the cross-section.

## Known unresolved defect

The prototype still contains high local longitudinal stretch around very short transition edges. The stored prototype distribution reaches approximately `5.47×` on the worst sampled edge. This does not invalidate the topology split, but it prevents any claim that V7 is visually complete. The next browser run must inspect the throat-to-head transition and the torso/neck seam for bunching, gaps, self-intersection and excessive elongation.

## Required browser gates

A new V7 browser build must prove all of the following before visual review:

- logical bone count `21`;
- actual skeleton bone count `22`;
- helper bone count `1`;
- V7 topology, weighting and curve revision strings present;
- one independent neck shell detected;
- torso triangle count reduced but still above 45% of the source;
- peck frame ring-area ratio remains `1 ± 1e-6`;
- peck centerline length ratio remains within `0.90–1.10`;
- bill and support-foot contacts remain inside tolerance;
- fixed-bone-length invariant remains true;
- no console, page or request failures.

A technical browser pass will still not constitute manual visual approval.

## Gates

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

Group testing remains prohibited. The next accepted milestone is a single chicken whose torso, neck/head shell, feet and bill remain coherent through idle, look, peck, walk, turn, short run, wing balance and stop.
