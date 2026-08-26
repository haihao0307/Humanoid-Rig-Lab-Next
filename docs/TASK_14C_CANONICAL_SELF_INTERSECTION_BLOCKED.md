# Task 14C-1B-R0 canonical self-intersection blocker

## Scope and decision

- Audited source behavior: unchanged `649ab94` canonical procedural surface generation at resolution 36.
- Presets: Reference, Lean, Muscular, Heavy, Tall, Short, and Asymmetric.
- Poses: canonical T Pose and A Pose only.
- Audit evidence: `artifacts/qa/task14c-geometry-v1/stage2-recovery/canonical-self-intersection-audit.json`.
- Local triangle evidence: `artifacts/qa/task14c-geometry-v1/stage2-recovery/intersections/`.
- Outcome: case C. The detector contained contact false positives, and real canonical surface penetrations remain after those contacts are classified correctly.
- This task does not modify the body surface, field composition, joint deformation, or any corrective.

## Detector truth result

| Count | Before classification fix | After classification fix |
| --- | ---: | ---: |
| Raw contacts | 466 | 466 |
| Penetrating intersections | 466 | 402 |
| Critical penetrating intersections | 460 | 396 |

The classification fix preserves every raw contact. A contact enters `penetrating` only when it has a non-zero transverse segment whose midpoint is strictly inside both triangles. Shared topology, coplanar overlap, local topology-ring neighbors, and tolerance-only contacts do not enter the penetrating count.

## T Pose truth by preset

| Preset | Raw contacts | Real penetrations | Critical real penetrations |
| --- | ---: | ---: | ---: |
| Reference | 0 | 0 | 0 |
| Lean | 35 | 8 | 8 |
| Muscular | 104 | 104 | 102 |
| Heavy | 12 | 12 | 12 |
| Tall | 4 | 4 | 4 |
| Short | 47 | 43 | 42 |
| Asymmetric | 6 | 6 | 6 |

## A Pose truth by preset

| Preset | Raw contacts | Real penetrations | Critical real penetrations |
| --- | ---: | ---: | ---: |
| Reference | 0 | 0 | 0 |
| Lean | 35 | 8 | 8 |
| Muscular | 118 | 118 | 116 |
| Heavy | 26 | 26 | 26 |
| Tall | 4 | 4 | 4 |
| Short | 65 | 61 | 60 |
| Asymmetric | 10 | 8 | 8 |

The real pairs occur in pelvis, thigh, lower-torso, upper-torso, and upper-arm/torso regions. No audited real pair is classified as a forearm-region pair. The canonical blocker is therefore isolated from a future forearm-only deformation hypothesis, but it remains a separate production blocker.

## Representative Muscular T Pose penetrations

All listed pairs have zero shared vertices, no shared edge, a strict interior segment, and a final classification of `penetrating`. `none within 3` means no edge-adjacency path was found within three topology rings.

| Triangles | Regions | Segment length (m) | Unit segment direction | Normal angle | Topology ring distance |
| --- | --- | ---: | --- | ---: | --- |
| 80 / 2743 | pelvis / pelvis | 0.0049614569 | (0.887442, -0.450146, -0.099075) | 56.1309305163° | 3 |
| 80 / 2756 | pelvis / pelvis | 0.0014698007 | (-0.670994, 0.741462, -0.001288) | 64.0263104280° | none within 3 |
| 80 / 2758 | pelvis / pelvis | 0.0014868503 | (-0.682480, 0.730897, 0.003108) | 87.8312618498° | none within 3 |
| 82 / 2755 | pelvis / pelvis | 0.0004742107 | (-0.364839, 0.925667, -0.100161) | 68.8764497622° | none within 3 |
| 82 / 2756 | pelvis / pelvis | 0.0010174540 | (0.671205, -0.741270, 0.001608) | 63.9999158070° | none within 3 |
| 82 / 2757 | pelvis / pelvis | 0.0005030540 | (-0.348146, 0.931570, -0.104744) | 78.2059075605° | none within 3 |
| 82 / 2758 | pelvis / pelvis | 0.0009995979 | (0.682570, -0.730816, -0.002734) | 87.8052270245° | none within 3 |
| 83 / 2759 | pelvis / leftThigh | 0.0000129611 | (0.708502, -0.701605, -0.075996) | 89.8551871088° | none within 3 |
| 83 / 2760 | pelvis / leftThigh | 0.0000123879 | (0.880563, -0.438534, -0.179716) | 85.5769299847° | none within 3 |

Exact triangle vertex indices and coordinates, local bounds, intersection segment endpoints, minimum vertex distances, and OBJ paths are retained in the audit JSON. Each pair also has a standalone OBJ containing both triangles and the intersection segment.

## Likely source and next minimum hypothesis

The confirmed pelvis/pelvis and pelvis/thigh crossings are consistent with two non-neighbor sheets of the canonical implicit-field isosurface crossing around the groin/pelvis union. Torso and upper-arm/torso pairs indicate that the issue is not limited to one triangle index range. This is an evidence-based likely source, not a proven generator defect.

The next minimum geometry hypothesis is to inspect scalar-field samples and marching-tetrahedra case ownership only in the local bounds of Muscular pair 80/2743, then determine whether the two sheets originate from field-union topology or tetrahedron stitching. That investigation must be authorized as a separate canonical-surface task before any geometry change.

## Stop condition

Real canonical penetrations remain. Task 14C-1B-R0 stops before any body-surface correction and before any forearm-twist repair. `visualAcceptance` and `productionReady` remain `false`.
