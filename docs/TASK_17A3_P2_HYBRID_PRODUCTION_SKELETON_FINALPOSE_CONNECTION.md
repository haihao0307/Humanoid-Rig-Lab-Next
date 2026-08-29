# Task 17A.3 P2 — Hybrid Production Skeleton finalPose Connection

## Scope and exact start

- Start commit: `20804068bbbf0994b8db4d066902147c11ed698c`
- Start branch: `experiment/human-core-v5-production-skeleton-p1-1-static-refine`
- P2 branch: `experiment/human-core-v5-production-skeleton-p2-finalpose`
- Frozen display cache: `assets/human/production-skeleton-v2/hybrid-static-v1/hybrid-production-skeleton-static-v1.glb`
- Frozen GLB SHA256: `ffef1a04df026f576c9b5af5867b1dbd585145578cde465998a0ef56e32fbdcd`

This phase connects the accepted P1.1 display cache to the existing HumanRigCore `finalPose` authority. It does not add a second skeleton, change pose data, generate skeleton geometry in the browser, or implement Control, Interaction, Deform, IK, salute, jump, grab, carry, or skin functionality.

## Research basis

Implementation choices were checked against the official sources before editing:

- [Three.js Object3D](https://threejs.org/docs/pages/Object3D.html): with `matrixAutoUpdate = false`, the application owns each local object matrix.
- [Three.js Matrix4](https://threejs.org/docs/pages/Matrix4.html): affine matrix determinant/decomposition behavior informed the positive-determinant gate and the decision to avoid scale/decomposition in the runtime path.
- [Three.js Quaternion](https://threejs.org/docs/pages/Quaternion.html): quaternion rotation matrices and normalized interpolation are used for finalPose transitions.
- [Khronos glTF 2.0 Transformations](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#transformations): node matrices are column-major; TRS composition uses `T × R × S`. The P2 runtime writes rigid matrices only and never introduces scale.

## Authority chain

`HumanRigCore → finalPose → SimulationRig FK → module source frame → Object3D matrix`

The frozen GLB remains a display cache. Its nodes have identity rest transforms and world-authored vertices. Each module record therefore stores:

- `restWorldMatrix = identity`
- `restLocalMatrix = inverse(rest source frame)`
- `authority = display-derived`
- `writesHumanRigCore = false`
- `writesFinalPose = false`

At runtime:

`currentWorldMatrix = currentSourceFrame × restLocalMatrix`

This is algebraically identical to:

`currentSourceFrame × inverse(restSourceFrame) × restModuleWorldMatrix`

No BufferGeometry, Material, vertex, normal, index, joint length, or hierarchy value is created or changed per frame.

## Module map

| Module | Class | Source | Transform |
| --- | --- | --- | --- |
| pelvis | axial | hips | joint-frame |
| thorax | axial | chest + upperChest | composite joint-frame |
| neck | axial | neck | joint-frame |
| head | axial | head | joint-frame |
| leftClavicle / rightClavicle | shoulder-girdle | upperChest → shoulder | segment-frame |
| leftScapula / rightScapula | shoulder-girdle | upperChest frame + shoulder position + upperArm direction | diagnostic-frame |
| leftUpperArm / rightUpperArm | long-bone | upperArm → lowerArm | segment-frame |
| left/right ForearmRadius | paired-rail | lowerArm → hand | segment-frame |
| left/right ForearmUlna | paired-rail | lowerArm → hand | segment-frame |
| leftHand / rightHand | extremity | hand frame | joint-frame |
| leftThigh / rightThigh | long-bone | upperLeg → lowerLeg | segment-frame |
| left/right Tibia | paired-rail | lowerLeg → foot | segment-frame |
| left/right Fibula | paired-rail | lowerLeg → foot | segment-frame |
| leftFoot / rightFoot | extremity | foot frame | joint-frame |

Left and right scapula frames use their own upperChest world basis and same-side upper-arm direction diagnostic. No unconverted quaternion is shared across sides.

## Fixed poses and sequence

Only these existing deterministic finalPose fixtures are exposed:

1. `reference-t`
2. `reference-a`
3. `locomotion-neutral`
4. `walk-left-support`
5. `walk-right-support`
6. `turn-mid`

The diagnostic sequence is:

`reference-t → reference-a → locomotion-neutral → walk-left-support → walk-right-support → turn-mid → locomotion-neutral`

Root position is interpolated independently, root rotation and joint local rotations use normalized quaternion slerp, and no scale is used.

## File and numerical evidence

Run the scoped audit:

```powershell
node scripts/task17a3-p2-finalpose-audit.mjs
```

It validates the frozen GLB, 24-module identity, deterministic transform equality, six numerical gates, finalPose read-only fingerprints, HumanRigCore invariants, geometry/index hashes, and 61 samples per sequence transition. Results are under `artifacts/qa/task17a3-p2-finalpose/`.

The offline audit currently passes all six numerical scenes. The maximum sequence frame-to-frame module translation jump is recorded, but the task does not define a pass threshold for that field; visual discontinuity remains a user review item.

## Review camera and pose synchronization

The P2 review viewport uses window-local `OrbitControls`: left drag rotates, the wheel zooms, right drag pans, `F` frames the complete person, `R` restores the default camera, and double-click focuses the person. Distance is clamped, the initial target is between the pelvis and thorax, and resize reframes the person. The published camera receipt explicitly records that it does not write HumanRigCore, finalPose, or project state.

The URL `pose`, pose selector, numerical-summary pose ID, and public page-state `poseId` share one normalized value. Selecting a pose uses `history.replaceState` without reloading. A direct URL is canonicalized immediately, and the diagnostic sequence explicitly publishes `sequence` while it is playing.

Run the file-only UI contract audit with:

```powershell
node scripts/task17a3-p2-review-ui-audit.mjs
```

It checks the camera contract, all six fixed poses plus `sequence`, the browser-capture synchronization assertions, byte-for-byte equality of the frozen GLB, and normalized text-content equality of HumanRigCore/finalPose inputs, module map, and transform runtime against the P2 baseline commit.

## Browser review reserved for the user

Repository instructions reserve computer/browser effect validation for the user. Codex therefore does not launch the page, capture screenshots, or record video. After dependencies are available, the user can run:

```powershell
node scripts/capture-task17a3-p2-finalpose.mjs
```

The script uses only the six committed finalPose fixtures, directly loads the frozen GLB, creates the 12 full-body/overlay images, four closeups, contact sheet, and diagnostic WebM, then records WebGL2/console/page evidence. Every capture asserts that URL, selector, numerical summary, and public pose state agree. It does not manually move a module.

Until that capture and the 22 visual decisions are completed, the only allowed conclusion is:

`INCONCLUSIVE`
