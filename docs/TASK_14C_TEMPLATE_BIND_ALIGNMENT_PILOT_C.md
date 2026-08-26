# Task 14C Template Bind Space Alignment Pilot C

## Scope and evidence

Pilot C starts at Pilot B commit `06d7022c309c4887d3a1760712b2833b56a7c71f` on `experiment/human-core-v5-template-bind-alignment-pilot`. It is an isolated calibration experiment. It does not alter template topology, weights, inverse bind matrices, BodyDNA, HumanRigCore, ProductionSkinRuntime, or any procedural surface code.

Evidence is recorded in `artifacts/qa/task14c-template-bind-alignment-pilot/bind-audit.json`, `metrics.json`, the 18 fixed-scenario captures, eight Rig Overlay captures, and `contact-sheet.png`. The single metrics run and single continuous WebGL2 capture workflow completed without recorded console or page errors; the page made one GLB request per scenario load.

## Source Pose Convention

`PoseFrame V4` labels its convention `outgoing_bone_parent_rotation`. The actual `finalPose.localRotations` values are **bind-relative local deltas**, not absolute local rotations:

1. Reference T supplies identity local rotations; independent FK reproduces the canonical T bind positions.
2. Reference A and the four joint fixtures rotate canonical T bind offsets through those local deltas.
3. The existing Production Skin V4 path combines the saved target bind quaternion with each pose delta.

## Target Bind Convention and root cause

The stable template uses original glTF node-local TRS plus asset-provided inverse bind matrices. The audit records 24 mapped joints, their source and target parents, local/world bind transforms, lengths, axis-basis differences, candidate corrections, skin joint indices, and inverse bind matrices.

The direct path has three concrete problems:

1. It applies source bind-relative deltas directly in target local bone space.
2. Human Core and template outgoing-bone axes are not uniformly aligned.
3. It has no source-to-target bind-basis correction.

The experiment also shows a stable arm bind/length incompatibility: the template's original arm directions and segment lengths cannot reproduce the Human Core Reference T carrier while the Identity Gate forbids changing target local positions or scales. Root application and parent multiplication order were audited; they are not the dominant residual.

## Adapter calculation

`TemplateBindSpaceRetargetAdapterV5` exists only in the Pilot C application. After template load it saves every target bone's bind local position, quaternion, and scale. For each mapped joint it precomputes a primary outgoing-axis basis correction `C` from source and target bind child directions. Each frame it applies:

`targetLocalQ = targetBindLocalQ * (C * sourceBindRelativeDelta * inverse(C))`

It restores saved target positions and scales, leaves unmapped bones in bind, applies root translation once, and never changes inverse bind matrices or weights. The same correction fingerprint is used for all six scenes; there are no pose-specific offsets.

This ordering follows Three.js local transform hierarchy and quaternion composition semantics. See the official [Quaternion](https://threejs.org/docs/pages/Quaternion.html), [Object3D](https://threejs.org/docs/pages/Object3D.html), [Skeleton](https://threejs.org/docs/pages/Skeleton.html), and [SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html) documentation.

## Identity Gate

The zero-delta gate passed for all 24 mapped joints:

| Measure | Maximum | Limit |
| --- | ---: | ---: |
| Quaternion angular error | 0 degrees | 0.01 degrees |
| Position error | 0 m | 1e-7 m |
| Scale error | 0 | 1e-7 |

## Six-scene pose results

Angles are independently measured from source FK and actual target bone world transforms. Values are `Source / Direct / Candidate` in degrees.

| Scenario | Shoulder | Elbow | Hip | Knee | Candidate angle gate |
| --- | ---: | ---: | ---: | ---: | --- |
| Reference T | 90.000 / 32.037 / 32.037 | 0.000 / 15.934 / 15.934 | 0 / 0 / 0 | 0 / 0 / 0 | fail |
| Reference A | 55.172 / 11.059 / 8.900 | 0.000 / 15.934 / 15.934 | 0 / 0 / 0 | 0 / 0 / 0 | fail |
| Shoulder 150 fixture | 119.788 / 61.462 / 61.574 | 0.000 / 15.934 / 15.934 | 0 / 0 / 0 | 0 / 0 / 0 | fail |
| Elbow 140 | 121.366 / 62.940 / 64.928 | 140.000 / 42.970 / 125.840 | 0 / 0 / 0 | 0 / 0 / 0 | fail (14.160-degree elbow error) |
| Hip Flex 55 | 90.000 / 32.037 / 32.037 | 0.000 / 15.934 / 15.934 | 55 / 55 / 55 | 0 / 0 / 0 | hip passes; scene fails |
| Knee Bend 110 | 90.000 / 32.037 / 32.037 | 0.000 / 15.934 / 15.934 | 0 / 0 / 0 | 110 / 110 / 110 | knee passes; scene fails |

The fixture labels are requests, while this table reports the required independently measured angles. The Shoulder 150 fixture therefore measures 119.788 degrees on the source rather than echoing 150.

## Joint and endpoint errors

| Scenario | Candidate mapped max / mean (m) | Wrist max (m) | Ankle max (m) | Root (m) | Symmetry (m) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reference T | 0.5335 / 0.0795 | 0.5335 | 0.0050 | 0.0050 | 0.0000 |
| Reference A | 0.5401 / 0.0806 | 0.5401 | 0.0050 | 0.0050 | 0.0000 |
| Shoulder 150 | 0.5335 / 0.0791 | 0.5335 | 0.0050 | 0.0050 | 0.0070 |
| Elbow 140 | 0.5335 / 0.0610 | 0.5335 | 0.0050 | 0.0050 | 0.3875 |
| Hip Flex 55 | 0.5335 / 0.0795 | 0.5335 | 0.0050 | 0.0050 | 0.0000 |
| Knee Bend 110 | 0.5335 / 0.0795 | 0.5335 | 0.0050 | 0.0050 | 0.0000 |

The mapped-joint gate fails in all scenes (limits: max 0.08 m, mean 0.03 m). The root value is at the 0.005 m boundary, with the JSON retaining the full floating-point value. Wrist residuals dominate and are classified as stable bind-axis/bind-pose and bone-length incompatibility; no bone scaling was used.

## Penetration reclassification

The unchanged detector finds 17 original-bind pairs. Full pair records retain triangle indices, segments, and region labels in `metrics.json`.

| Scenario | Direct introduced / total | Candidate persistent + introduced / total |
| --- | ---: | ---: |
| Reference T | 0 / 17 | 17 + 0 / 17 |
| Reference A | 691 / 708 | 17 + 741 / 758 |
| Shoulder 150 | 0 / 17 | 17 + 0 / 17 |
| Elbow 140 | 0 / 17 | 17 + 19 / 36 |
| Hip Flex 55 | 20 / 37 | 17 + 20 / 37 |
| Knee Bend 110 | 0 / 17 | 17 + 0 / 17 |

For Reference A, 17 pairs originate in the bind pose, Direct Mapping introduces 691 to reach 708, and Candidate leaves 758 total (17 persistent plus 741 introduced). The new pairs concentrate overwhelmingly in arm/forearm/palm against torso/pelvis/thigh regions. The 17 persistent bind pairs are left-foot self-region pairs.

## Visual review

| Item | Direct versus Candidate |
| --- | --- |
| T Pose arm direction | both-fail |
| A Pose arm direction | both-fail |
| Shoulder joint center | both-fail |
| Elbow joint center | candidate-better |
| Hip / knee / ankle joint centers | equal |
| Shoulder elevation angle | both-fail |
| Elbow bend direction | candidate-better |
| Hip flex / knee bend direction | equal |
| Left-right symmetry | direct-better |
| Root consistency | equal |
| Mesh explosion | equal (none observed) |
| Local inversion | equal (none observed) |
| New penetration | direct-better |
| Post-pose volume | equal |

The overlays show close root, spine, and leg agreement, but the template arms remain down or near-horizontal relative to the shared rig in T, A, and shoulder scenes. Candidate substantially improves elbow bending, with no mesh explosion, but introduces 19 new pairs in that scene and does not meet the elbow gate.

## Limitations and conclusion

This pilot does not establish BodyDNA support, production skin quality, corrective quality, asset authorization, Muscular support, or final-surface acceptance. It does not modify geometry, bone positions, weights, inverse bind matrices, or HumanRigCore.

Final conclusion: **BIND_ALIGNMENT_PARTIAL**.

The deterministic basis correction is real and reusable: Hip 55 and Knee 110 are exact, and Elbow 140 improves from 42.970 to 125.840 degrees. However, Reference T, Reference A, Shoulder, mapped-joint, and wrist gates fail because the stable template arm bind directions and lengths are incompatible with the Reference carrier under the immutable-position Identity Gate. Further work may remain isolated to mapping and bone-length compatibility research; it must not enter BodyDNA fitting yet.
