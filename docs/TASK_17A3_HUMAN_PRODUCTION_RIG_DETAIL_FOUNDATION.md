# Task 17A.3 Human Production Rig Detail Foundation

## Scope and authority

This task adds a read-only production-rig detail and interaction diagnostic layer. It does not modify BodyDNA, HumanRigCore, bind local positions, parent relationships, bone lengths, joint local scale, `finalPose`, skin, skin weights, inverse bind matrices, motion execution, salute, jump, grasp, carry, or any medical skeleton asset.

The permanent authority chain is:

```text
BodyDNA
  -> HumanRigCore
  -> finalPose
  -> Production Rig Detail
  -> Performance Deform Rig Contract
  -> Interaction Anchors
  -> Diagnostic Renderer
```

`CoreRigLayerV1` retains direct read-only references to HumanRigCore and `finalPose`. `PerformanceDeformRigLayerV1` and `InteractionRigLayerV1` are derived observers. Diagnostic geometry participates in neither pose solving nor camera-action decisions and is never stored in HumanCoreState.

## Source research

The implementation follows the official Three.js contracts for [CapsuleGeometry](https://threejs.org/docs/pages/CapsuleGeometry.html), [ArrowHelper](https://threejs.org/docs/pages/ArrowHelper.html), [LineSegments](https://threejs.org/docs/pages/LineSegments.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html), [Object3D](https://threejs.org/docs/pages/Object3D.html), and [Matrix4](https://threejs.org/docs/pages/Matrix4.html). Capsules use their real radius and middle height without object scaling; `Object3D.quaternion` aligns the local positive Y axis with the Core segment. Raycaster selection only reads diagnostic objects.

The Full Joint Basis convention remains the Pilot D convention: every joint basis reads `twistAxisLocal`, `bendAxisLocal`, and `sideAxisLocal` from JointSemanticProfileV5. No displayed Euler value is used to infer an axis.

## Frozen Core Rig Contract

`core-rig-contract-v1.js` compiles the existing V4Adapter T-pose definition and HumanRigCore semantic projection into an explicit immutable-data contract containing:

- schema and rig version;
- 89 joint IDs and parents;
- bind-local and bind-world positions;
- bone lengths;
- complete three-axis joint bases;
- current semantic limit records;
- topology, bind, axis, and limit fingerprints.

Runtime validation fails closed on unknown or missing joints, changed parents, changed bind positions, changed bone lengths, missing axes, non-finite values, non-orthogonal bases, or a determinant different from +1 beyond `1e-6`.

The audit fingerprints at this commit are:

| Contract | Fingerprint |
| --- | --- |
| Topology | `fnv1a-8f257f74` |
| Bind | `fnv1a-d669d035` |
| Axes | `fnv1a-e51af5f5` |
| Limits | `fnv1a-b9bd8ce0` |

All 20 `CORE_HUMAN_JOINT_IDS_V5` entries have formal semantic angular limits. The complete 89-entry RigDefinition contains 67 optional deform, control, measurement, finger, eye, jaw, end, or contact entries without a sourced formal production angular limit. The limit diagnostic explicitly reports `LIMIT UNDEFINED` for these entries and does not synthesize a limit.

## Three production-rig layers

### CoreRigLayerV1

The layer exposes Core joint transforms, finalPose FK transforms, JointSemanticProfile bases and limits, and Core bone segments. Capsules are restricted to the 20 declared Core Human joints; optional corrective and control segments are deliberately excluded from the Core capsule length gate.

Across all eight fixtures:

- unknown, missing, and parent mismatch counts: `0`;
- maximum bind-position difference: `0 m`;
- maximum bone-length difference: `0 m`;
- maximum Core capsule segment-length error: `1.6653345369377348e-16 m`;
- maximum segment-axis error: `0 degrees`;
- `finalPoseReadOnlyPassed`: `true`.

### PerformanceDeformRigLayerV1

The 22 registered nodes are:

```text
leftClavicle rightClavicle leftScapula rightScapula
leftUpperArmTwist01 leftUpperArmTwist02 rightUpperArmTwist01 rightUpperArmTwist02
leftForearmTwist01 leftForearmTwist02 rightForearmTwist01 rightForearmTwist02
leftThighTwist01 leftThighTwist02 rightThighTwist01 rightThighTwist02
leftCalfTwist01 rightCalfTwist01
leftPalmFrame rightPalmFrame leftFootFrame rightFootFrame
```

Twist pairs are placed at one-third and two-thirds of their Core segment. The single calf twist is placed at one-half. Clavicles explicitly alias the current shoulder semantics. Scapula nodes are diagnostic transforms derived from upper-chest, shoulder, and upper-arm directions. Palm and foot frames follow their Core joints.

Every node records `authority = derived`, `writesFinalPose = false`, `writesHumanRigCore = false`, `skinWeightsAvailable = false`, and `productionDeformApproved = false`. The only allowed statuses are `derived-transform`, `diagnostic`, `contract-ready`, and `skin-weight-pending`.

Reference metrics report no non-finite transform, reflection, parent inconsistency, twist-position error, or left-right symmetry error.

### InteractionRigLayerV1

The 28 required anchors are present:

```text
headGazeOrigin headGazeTarget chestFacing pelvisFacing
leftPalmCenter rightPalmCenter leftPalmNormal rightPalmNormal
leftPalmUp rightPalmUp leftThumbSide rightThumbSide
leftGripCenter rightGripCenter twoHandCarryCenter chestCarryAnchor
leftHeelContact rightHeelContact leftSoleCenter rightSoleCenter
leftToeContact rightToeContact leftFootForward rightFootForward
leftFootUp rightFootUp pelvisSeatContact backCarryAnchor
```

Palm centers use the hand frame plus the existing virtual `HandEnd` measurement point, never a middle-finger joint. Grip centers are IK/object targets and are not bones. Mirrored thumb directions retain explicit semantic handedness while the audit reports a mirror-normalized positive determinant. Foot Forward is the normalized Heel-to-Toe direction projected onto the plane orthogonal to Foot Up. Heel, Sole, and Toe remain ordered, and Foot Up remains ground-normal compatible in the Jump Preload fixture.

Reference anchor symmetry error is `0 m`; non-finite and missing anchor counts are `0`; the minimum Palm determinant is `0.9999999999999998`; the Foot determinant is `1` within floating-point noise.

## Diagnostic renderer and page

The independent page is `human-core-v5-production-rig-detail-v1.html`. It exposes:

```js
window.__HUMAN_CORE_V5_PRODUCTION_RIG_DETAIL_V1__
```

The state includes all required readiness, pose, mode, selection, fingerprints, read-only, metric, geometry, WebGL2, console-error, and page-error fields. The page supports:

- poses: `reference-t`, `reference-a`, `locomotion-neutral`, `walk-left-support`, `walk-right-support`, `turn-mid`, `salute-ready`, and `jump-preload`;
- modes: `lite`, `rig`, `interaction`, and `deform`;
- closeups: `shoulder`, `elbow`, `hand`, `pelvis`, `hip`, `knee`, `foot`, and `head`;
- query flags: `axes=1` and `limits=1`;
- keys: `1` through `4`, `A`, `L`, and `F`;
- selectable Core joints, Core bones, Performance nodes, Interaction anchors, and limit geometry;
- independently scrolling panels, collapsible panels, and a viewport whose responsive grid remains at least 55% wide.

The compact Inspector shows ID, layer, source, parent, world position, world quaternion, bone length, axes, limits, capabilities, and status. Raw matrix, quaternion, joint profile, finalPose, and anchor data are collapsed by default.

## Deterministic fixtures

Reference T and A reuse existing validation pose fixtures. Locomotion Neutral, both walk support poses, Turn Mid, and Salute Ready reuse Task 17A committed finalPose output. Salute Ready does not raise the hand. Jump Preload uses the existing squat fixture with a new PoseFrame copy whose foot-local rotations counter the hip/knee chain, retaining a ground-compatible foot frame and double-support diagnostic contacts. It does not implement a jump.

## File-level QA and pending visual QA

The permitted Core Rig audit and combined Performance/Interaction audit passed. Their JSON outputs are under `artifacts/qa/task17a3-production-rig-detail/`.

Per the repository's AGENTS.md instruction, Codex did not operate a browser, start or disturb port 4175, take screenshots, build a contact sheet, or claim a WebGL2 result. `browser-capture-manifest.json` lists every required pending screenshot. All 25 visual observations remain `unsupported` with reason `pending user-operated browser review`; this is not a visual failure claim.

Suggested user-operated URLs begin with:

```text
human-core-v5-production-rig-detail-v1.html?pose=reference-t&mode=lite
human-core-v5-production-rig-detail-v1.html?pose=reference-t&mode=rig&axes=1&limits=1
human-core-v5-production-rig-detail-v1.html?pose=reference-t&mode=interaction&closeup=hand
human-core-v5-production-rig-detail-v1.html?pose=reference-t&mode=deform&closeup=shoulder&axes=1&limits=1
human-core-v5-production-rig-detail-v1.html?pose=salute-ready&mode=interaction&closeup=hand
human-core-v5-production-rig-detail-v1.html?pose=jump-preload&mode=interaction&closeup=foot
```

After user capture, the contact sheet groups remain: Core Rig, Axes, Limits, Performance Deform, Interaction Anchors, Salute Preparation, Jump Preparation, Metrics, and Visual Observation.

## Acceptance state and conclusion

`visualAcceptance = false`, `productionReady = false`, and `userVisualAcceptance = pending` remain unchanged.

Final conclusion: **INCONCLUSIVE**.

All file-level Core, finalPose read-only, axis, capsule, derived-node, anchor, Palm, and Foot gates pass. The result cannot be promoted to `PRODUCTION_RIG_DETAIL_FOUNDATION_PROMISING` until the user completes the required browser screenshots, WebGL2/console/page-error observation, contact sheet, and 25 visual decisions.
