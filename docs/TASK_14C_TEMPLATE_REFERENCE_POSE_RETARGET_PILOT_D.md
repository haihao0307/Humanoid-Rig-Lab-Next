# Task 14C Template Canonical Reference Pose and Full Joint Basis Retarget Pilot D

## Scope and Pilot C correction

Pilot D starts from Pilot C commit `10d2e68b9a7724cab395c2cdf9491fb482063f29` and remains isolated on `experiment/human-core-v5-template-reference-pose-retarget-pilot`. It does not modify HumanRigCore, ProductionSkinRuntime, template topology, GLB node positions/scales, weights, inverse bind matrices, BodyDNA, procedural surfaces, morphs, or correctives.

Pilot C correctly established that `finalPose.localRotations` are bind-relative local deltas, but its Identity Gate treated the template's original non-T arm pose as the target reference. Primary-axis conjugation could therefore not repair Reference T. Pilot C's approximately `0.5335 m` wrist residual was not a bone-length incompatibility: audited Reference upper-limb length deltas are zero or floating-point noise, all far below the `0.005 m` classification threshold.

## Source and target reference conventions

- Source Reference Pose: Human Core canonical Reference T with identity bind-relative deltas.
- Target Original Bind Pose: original glTF node-local TRS plus asset-prebound inverse bind matrices.
- Target Calibrated Reference Pose: a runtime-only set of target local quaternions. It changes no local position, scale, IBM, weight, or asset file.

The implementation follows the glTF 2.0 rule that joint nodes use hierarchical local TRS and that inverse bind matrices precede joint transforms in skinning. See the official [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html). Three.js local/world transform semantics are documented by [Object3D](https://threejs.org/docs/pages/Object3D.html) and [Skeleton](https://threejs.org/docs/pages/Skeleton.html).

## Target Reference Pose calibrator

`TemplateCanonicalReferencePoseCalibratorV5` saves the complete original asset state and solves target Reference T recursively in explicit topology order. Single-chain joints use the declared semantic child, a secondary anatomical axis, and a right-handed orthonormal frame. The implementation never uses arbitrary first-child traversal.

Explicit chains include:

- `leftShoulder -> leftUpperArm -> leftLowerArm -> leftHand -> leftHandEnd` and the mirrored right chain.
- `leftUpperLeg -> leftLowerLeg -> leftFoot -> leftToes` and the mirrored right chain.
- `spine -> chest -> upperChest -> neck -> head`.

`hips` uses `spine`, `leftUpperLeg`, and `rightUpperLeg`; `upperChest` uses `neck`, `leftShoulder`, and `rightShoulder`. These branch joints use a deterministic multi-vector Wahba pure-rotation fit initialized from primary/lateral frames and iterated as normalized quaternions. The result has determinant `+1`, no reflection, no scale, and no translation mixed into rotation. This is the same vector-alignment problem described in the official SciPy [Rotation.align_vectors](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.transform.Rotation.align_vectors.html) documentation.

## Full three-axis joint basis

Every mapped joint reads HumanRigCore's existing `twistAxisLocal`, `bendAxisLocal`, and `sideAxisLocal`. Target twist/bend/side axes are derived in the calibrated Target Reference world frame, then transformed to target joint-local space. Each basis records orthogonality, determinant, source, and `M_source_to_target`.

Dynamic conversion is:

`convertedDelta = M_source_to_target * sourceBindRelativeDelta * inverse(M_source_to_target)`

`targetPoseLocalQuaternion = targetReferenceLocalQuaternion * convertedDelta`

Reference T plus independent 17-degree Twist, Bend, and Side probes all pass. Maximum probe quaternion error is `0 degrees`, maximum orthogonality error is `3.886e-16`, minimum determinant is `1`, and no reflection is detected. Quaternion composition follows the official Three.js [Quaternion](https://threejs.org/docs/pages/Quaternion.html) contract.

## Root offset

The original target hips world position is `[0, 0.925, 0.016]`; Source Reference hips is `[0, 0.93, 0.016]`. Pilot D applies a single carrier-group Reference offset `[0, 0.0050000000000000044, 0]`, then adds only the dynamic source root delta. Saved hips local position remains unchanged and root application count is exactly one.

## Asset Restore Gate

Asset Restore Gate passes:

| Check | Result |
| --- | ---: |
| Maximum local quaternion error | 0 degrees |
| Maximum local position error | 0 m |
| Maximum local scale error | 0 |
| Maximum world-matrix element error | 0 |
| IBM byte comparison | unchanged |
| Weight byte comparison | unchanged |

## Reference Pose Equivalence Gate

Reference Pose Gate passes. All four measured angle errors are zero. Mapped-joint max/mean errors are `0.016814 / 0.007086 m`; wrist endpoint error is `0.015282 m`; ankle error is numerical zero; root error is zero. All are below their required limits.

## Upper-limb length comparison

| Segment | Source (m) | Target (m) | Absolute delta (m) |
| --- | ---: | ---: | ---: |
| Shoulder | 0.128646803303 | 0.128646803303 | 0 |
| Upper arm | 0.277218325513 | 0.277218325513 | 1.110e-16 |
| Lower arm | 0.241402154091 | 0.241402154091 | 0 |
| Hand control | 0.070774289117 | 0.070774289117 | 4.163e-17 |

No upper-limb segment qualifies as `bone-length incompatibility`. The stable `0.015282 m` wrist residual is classified as `reference-direction mismatch`; dynamic rotation and root components are zero. Ankle residuals and all length components are numerical noise.

## Six-scene results

Angles are independently measured from source FK and actual template bone world transforms. Each cell is `Source / Direct / Pilot C / Pilot D` in degrees.

| Scenario | Shoulder | Elbow | Hip | Knee | Pilot D angle error |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reference T | 90 / 32.037 / 32.037 / 90 | 0 / 15.934 / 15.934 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 |
| Reference A | 55.172 / 11.059 / 8.900 / 55.172 | 0 / 15.934 / 15.934 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 8.538e-7 |
| Shoulder fixture | 119.788 / 61.462 / 61.574 / 119.788 | 0 / 15.934 / 15.934 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 |
| Elbow 140 | 121.366 / 62.940 / 64.928 / 121.366 | 140 / 42.970 / 125.840 / 140 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 2.842e-14 |
| Hip Flex 55 | 90 / 32.037 / 32.037 / 90 | 0 / 15.934 / 15.934 / 0 | 55 / 55 / 55 / 55 | 0 / 0 / 0 / 0 | 7.105e-15 |
| Knee Bend 110 | 90 / 32.037 / 32.037 / 90 | 0 / 15.934 / 15.934 / 0 | 0 / 0 / 0 / 0 | 110 / 110 / 110 / 110 | 2.842e-14 |

All six scenes have the same Pilot D mapped-joint max/mean errors (`0.016814 / 0.007086 m`), wrist max `0.015282 m`, ankle approximately zero, and root zero. All skeleton and endpoint gates pass.

## Penetration changes

The unchanged detector reports 17 persistent original-bind pairs. Target Reference T has 20 total, including 3 introduced pairs.

| Scenario | Direct introduced | Pilot C introduced | Pilot D introduced | Pilot D total |
| --- | ---: | ---: | ---: | ---: |
| Reference T | 0 | 0 | 3 | 20 |
| Reference A | 691 | 741 | 5 | 22 |
| Shoulder fixture | 0 | 0 | 88 | 105 |
| Elbow 140 | 0 | 19 | 213 | 230 |
| Hip Flex 55 | 20 | 20 | 23 | 40 |
| Knee Bend 110 | 0 | 0 | 3 | 20 |

Reference A satisfies the required `<100` gate. Its five Pilot D introduced pairs are limited to palm self-regions (`rightPalm+rightPalm: 3`, `leftPalm+leftPalm: 2`), replacing Pilot C's widespread arm/torso/pelvis contacts. Shoulder and elbow counts are higher, concentrated in local upper-arm/forearm self/contact regions. Screenshots show no mesh explosion, reflection, limb swap, or large-area arm-through-torso; these local surface-quality issues remain for the explicitly separate skin/corrective study.

## Visual comparison

| Item | Pilot C versus Pilot D |
| --- | --- |
| T/A arm direction | pilot-d-better |
| Shoulder/elbow centers and wrist position | pilot-d-better |
| Hip/knee centers | equal |
| Ankle center and root consistency | pilot-d-better |
| Shoulder abduction/twist, elbow bend, forearm axial direction | pilot-d-better |
| Hip flex and knee bend direction | equal |
| Left-right symmetry | equal |
| Mesh explosion / local inversion | equal (none observed) |
| Aggregate new penetration | pilot-c-better, but Pilot D is substantially better for Reference A |
| Post-pose volume | pilot-d-better |

## Limits and final conclusion

This pilot proves only deterministic Reference skeleton calibration and full-basis consumption of the shared Reference finalPose. It does not prove production skin quality, corrective quality, BodyDNA fitting, Muscular support, morph support, final asset authorization, or visual acceptance. Hand orientation and local high-flexion surface contacts remain experimental.

Final conclusion: **REFERENCE_RETARGET_PROMISING**.

Asset Restore, Reference Pose, Full Basis, six dynamic angle, mapped-joint, endpoint, root, and Reference A penetration gates all pass with one shared Target Reference and one full-basis mapping set. The stable template may enter an independent skin-quality and local-corrective research stage; this does not authorize BodyDNA fitting or production integration.
