# Task 16A R2A — Verified Human Reference Mesh Static Truth Baseline

## Result

`REFERENCE_MESH_EVIDENCE_READY_FOR_USER_REVIEW`

Task 16A R2A establishes the verified MakeHuman Candidate A body as the canonical topology and reference-geometry foundation. It does not approve the current shape as a universal neutral default, and it does not approve dynamic skinning, BodyDNA, image fitting, motion, corrective deformation, or production readiness.

The fixed approval state remains:

```text
visualAcceptance = false
productionReady = false
userVisualAcceptance = pending
```

## Locked provenance

| Field | Value |
| --- | --- |
| Source project | MakeHuman Community MPFB2 |
| Source repository | https://github.com/makehumancommunity/mpfb2 |
| Source commit | `437dd513888a92399d1d3200d2e80859fae55abc` |
| Original mesh | `src/mpfb/data/3dobjs/base.obj` |
| Original mesh SHA256 | `8E761E6624B8F54536409135D1636DA63B32486A90D4897F84E121D144F6FB4C` |
| Candidate A GLB | `assets/human/production-surface-v2/candidate-a/neutral-body-candidate-a.glb` |
| Candidate A SHA256 | `8E62AE9FBDCDF40F0B3B294ACC8DE1FE0360A838B4E9351604114AFAED94D38E` |
| Candidate A bytes | `974268` |
| License | CC0-1.0 |
| Coordinates | right-handed, +Y up, +Z forward |
| Unit | meter |

`source-integrity.json` verifies the GLB, receipt, source lock, license, conversion report, source commit, original hash, converted hash, byte size, vertex count, triangle count, and license agreement.

## Source Static Truth visual gate

The user explicitly approved the first Source Static Truth gate:

```text
SOURCE_STATIC_TRUTH_VISUAL_GATE = PASS
CANONICAL_STATIC_COPY_AUTHORIZED = YES
```

The source was displayed as one ordinary `THREE.Mesh` using only `POSITION`, `NORMAL`, and index data. `JOINTS_0`, `WEIGHTS_0`, skeleton updates, inverse bind matrices, HumanRigCore, SurfaceCarrierV2, PerformanceDeformRig, pose presets, and shape modification were absent from this path.

The user review is preserved in `source-visual-review.json`. It approves the mesh only as a static reference foundation. It does not approve later deformation behavior.

## Source reference pose

The source mesh is in its original MakeHuman rest reference, visually classified as A-pose-like:

```text
sourceReferencePose = makehuman-source-rest-reference
sourceReferencePoseClass = a-pose-like
sourceReferencePoseModified = false
```

It is not a T-pose. No source vertex was moved to force a T-pose. Future rigging must calibrate HumanRigCore to this source rest reference; a T-pose or any other pose must be generated later by a separately audited skeleton and skinning path.

## Canonical Static Copy

The canonical asset is:

```text
assets/human/canonical-reference-v1/makehuman-reference-neutral-static-v1.glb
```

Its SHA256 is:

```text
DFB79A337DB0B6CE36BF3A94C7703A35D710331311026AD3C33BBBAB751EF257
```

The extractor retained the original typed-array order for `POSITION`, `NORMAL`, and indices. It created one scene, one node, one mesh, one primitive, and one FrontSide material. It removed the skin, skeleton hierarchy, inverse-bind accessor, `JOINTS_0`, `WEIGHTS_0`, animations, rig nodes, and helper nodes. It did not use a generic Three.js exporter, Draco, Meshopt, vertex welding, vertex splitting, re-indexing, smoothing, subdivision, simplification, or topology generation.

The source world matrix was retained as the canonical node matrix. Both matrices are identity for this locked source.

## Fidelity gate

| Measurement | Source | Canonical | Result |
| --- | ---: | ---: | --- |
| Vertex count | 13380 | 13380 | identical |
| Triangle count | 26756 | 26756 | identical |
| Index count | 80268 | 80268 | identical |
| POSITION SHA256 | `BF831A2587FDBACD633413FE9A810E4A4627BC630C1016521EF434C2547B1D7D` | same | identical |
| Index SHA256 | `813C59BA79D891DABD4F657FE042DBC20BF21518B13A59087BD4B5BF0941F7B3` | same | identical |
| NORMAL SHA256 | `EB0A3EB22C022791E43E2F806B1B1625070A52C5D887864EEA798B477327157B` | same | identical |
| World POSITION SHA256 | `403C45027ADE52E639A4B27C014D03A8CD4D4C0FC1F8B5207E8AF333925FD9D6` | same | identical |
| World NORMAL SHA256 | `B921EE64439D19FE6AEF3B98C1E2A72DC9B6671A3193BDBB2D68663D0BEFB92B` | same | identical |
| Maximum world-position delta | 0 m | threshold ≤ 1e-7 m | pass |
| Mean world-position delta | 0 m | threshold ≤ 1e-9 m | pass |
| Maximum world-normal delta | 0 | threshold ≤ 1e-6 | pass |

The audit compares every index, every local-space position, every local-space normal, every world-space position, and every world-space normal. Thresholds were not relaxed.

## Geometry audit

The source and canonical reports are identical:

- one connected component;
- zero boundary edges;
- zero non-manifold edges and vertices;
- zero degenerate or duplicate triangles;
- zero duplicate-position pairs;
- zero NaN and infinity values;
- signed volume `0.05489533800603679 m³`;
- bounding size `0.9925400018692017 × 1.6658899784088135 × 0.423009991645813 m`;
- minimum triangle area `5.5015340313222887e-8 m²`;
- maximum recorded triangle aspect ratio `22.940806630725927`;
- minimum/maximum unique-edge length `0.000326643693423238 m` / `0.06522902462054117 m`;
- maximum normal-length error `4.440892098500626e-16`.

Two triangles have vertex-normal alignment opposite the dominant orientation. This is recorded as source topology evidence and was not modified or hidden.

## Browser modes and evidence

The page supports:

```text
?mode=source-static
?mode=canonical-static
?mode=overlay
?mode=deviation
?mode=current-bound
?mode=compare
```

All static source/canonical modes use the same world transform, view configuration, light policy, FrontSide material policy, exposure, and ground. Overlay uses a solid source surface and a canonical wireframe. Deviation uses exact world-space per-vertex distances and marks any distance above `1e-7 m` red. The measured maximum is zero.

The complete WebGL2 evidence was captured in one browser session using Google Chrome 151 through the Codex in-app browser and an NVIDIA GeForce RTX 4070 Ti SUPER ANGLE/D3D11 renderer. The browser report records:

```text
consoleErrors = []
pageErrors = []
failedRequests = 0
externalHumanAssetRequests = 0
```

Only the locked source and canonical GLBs were loaded as human assets.

## Current Task 15A bound diagnostic

The Current Bound Diagnostic uses the existing Task 15A `SurfaceCarrierV2` path with the existing Candidate A weights, skeleton, inverse bind matrices, Task 15A reference frame, and T-pose request. No binding data was repaired.

Under the exact source-matched camera, the bound result moves the torso, head, and arms outside the reference frame while displaced lower limbs and pelvis fragments remain visible. The browser page itself has no error, failed request, or external asset request. Therefore the evidence supports:

```text
sourceGeometryNormal = true
canonicalCopyNormal = true
boundRuntimeDistorted = true
```

This isolates the observed failure to the current binding/runtime path rather than the locked static geometry. R2A does not diagnose or repair the specific bind-matrix, inverse-bind, joint-map, reference-pose, or weight cause.

## Evidence locations

- `artifacts/qa/task16a-r2a-canonical-reference-v1/source-integrity.json`
- `artifacts/qa/task16a-r2a-canonical-reference-v1/source-geometry-metrics.json`
- `artifacts/qa/task16a-r2a-canonical-reference-v1/canonical-geometry-metrics.json`
- `artifacts/qa/task16a-r2a-canonical-reference-v1/geometry-fidelity.json`
- `artifacts/qa/task16a-r2a-canonical-reference-v1/browser-report.json`
- `artifacts/qa/task16a-r2a-canonical-reference-v1/metrics.json`
- `artifacts/qa/task16a-r2a-canonical-reference-v1/comparison-contact-sheet.png`

The `source-review/` subdirectory preserves the first user-reviewed Source Static Truth gate. The artifact root contains the final same-camera source, canonical, overlay, deviation, current-bound, close-up, wireframe, and comparison evidence.

## Implementation references

- Khronos glTF 2.0 specification: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Three.js `BufferGeometry`: https://threejs.org/docs/pages/BufferGeometry.html
- Three.js `SkinnedMesh`: https://threejs.org/docs/pages/SkinnedMesh.html

The specification separates primitive accessors from skin objects, joint nodes, inverse-bind matrices, and skinning attributes. This is the structural basis for preserving the exact mesh arrays while removing the binding structures.

## Explicitly deferred

R2A does not begin BodyDNA, morph targets, seven-body-type validation, new rig binding, weight generation, bind-matrix repair, inverse-bind repair, shoulder/scapula/clavicle systems, twist bones, corrective deformation, animation, T-pose motion validation, crouch, walking, or image-person fitting.

The next phase may begin only after the user reviews the final reference evidence and explicitly authorizes it.
