# Task 14C Template Topology Visual Pilot B

## Scope and authority

- Baseline: `feature/human-core-v5-task14c-geometry-v1` at `f3bc99f0f88bf5eadd946ae022ed9a0b79e53d35`.
- Experiment branch: `experiment/human-core-v5-template-topology-visual-pilot`.
- Procedural path: Human Core V5, BodyDNA, HumanRigCore, ProceduralDeformRuntimeV5, resolution 48, legacy projection.
- Template path: compatibility template, experimental topology carrier, not production approved, and not Human Core authority.
- The Reference comparisons consume the same BodyDNA, HumanRigCore, `finalPose.localRotations`, root transform, pose ID, camera, lighting, ground, material characteristics, pixel ratio, and viewport.
- The template skeleton never writes back into BodyDNA, HumanCoreState, PoseFrame, ProjectState, MotionClip, or HumanRigCore.

## Template asset and runtime

- Asset: `legacy/v8/assets/smpl/smpl-male-surface-skinned.glb`
- SHA256: `736CB39C828203EAE72F5E5D094F1623C0A4465A31B484737A6E8DF02A7EC899`
- Topology: 27,578 vertices, 55,152 triangles, 24 joints.
- Runtime: `production-skin-v4-runtime@1`, native Three.js `SkinnedMesh` GPU linear-blend skinning, `skin-binding-v4-smpl24-compat@1`.
- The existing asset-bound weights and inverse bind matrices are used unchanged. No new weights, morphs, correctives, topology, UVs, inverse bind matrices, fitting algorithm, procedural surface, fairing, or intersection detector were introduced.

The runtime choice follows the repository's existing Production Skin V4 integration and the standard Three.js glTF/skinning model described by [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) and [SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html). The asset remains an internal compatibility reference; this experiment does not resolve final SMPL asset authorization. The topology family is described in the original [SMPL paper](https://virtualhumans.mpi-inf.mpg.de/papers/SMPL15/SMPL15.pdf).

## Numeric results

Anchor errors are in metres. Intersection columns are `penetrating / critical`.

| Scenario | Surface | Vertices | Triangles | Intersections | Max anchor error | Mean anchor error | Height | Shoulder width | Hip width |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reference T | Procedural R48 | 15,440 | 30,876 | 0 / 0 | 0 | 0 | 1.7923 | 0.8597 | 0.4128 |
| Reference T | Stable Template | 27,578 | 55,152 | 17 / 17 | 0.5295 | 0.1357 | 1.7957 | 0.5602 | 0.3810 |
| Reference A | Procedural R48 | 15,440 | 30,876 | 0 / 0 | 0 | 0 | 1.7923 | 0.6613 | 0.4128 |
| Reference A | Stable Template | 27,578 | 55,152 | 708 / 708 | 0.5379 | 0.1385 | 1.7957 | 0.5529 | 0.3861 |
| Arm Raise 150 | Procedural R48 | 15,440 | 30,876 | 0 / 0 | 0 | 0 | 1.9448 | 0.3860 | 0.4151 |
| Arm Raise 150 | Stable Template | 27,578 | 55,152 | 17 / 17 | 0.5295 | 0.1356 | 1.7957 | 0.8607 | 0.3708 |
| Elbow Bend 140 | Procedural R48 | 15,440 | 30,876 | 1 / 1 | 0 | 0 | 1.7923 | 0.8580 | 0.3267 |
| Elbow Bend 140 | Stable Template | 27,578 | 55,152 | 17 / 17 | 0.5295 | 0.1281 | 1.7957 | 0.7903 | 0.3810 |
| Hip Flex | Procedural R48 | 15,440 | 30,876 | 8 / 8 | 0 | 0 | 1.7923 | 0.8597 | 0.4135 |
| Hip Flex | Stable Template | 27,578 | 55,152 | 37 / 37 | 0.5295 | 0.1357 | 1.7957 | 0.5602 | 0.3828 |
| Knee Bend | Procedural R48 | 15,440 | 30,876 | 0 / 0 | 0 | 0 | 1.7923 | 0.8597 | 0.4128 |
| Knee Bend | Stable Template | 27,578 | 55,152 | 17 / 17 | 0.5295 | 0.1357 | 1.7957 | 0.5602 | 0.3887 |
| Muscular T | Procedural R48 | 16,726 | 33,448 | 16 / 14 | 0 | 0 | 1.7925 | 0.8579 | 0.4472 |
| Muscular T | Stable Template | 27,578 | 55,152 | 16 / 16 | 0.5327 | 0.1389 | 1.7957 | 0.5450 | 0.3790 |
| Muscular A | Procedural R48 | 16,726 | 33,448 | 22 / 20 | 0 | 0 | 1.7925 | 0.6899 | 0.4472 |
| Muscular A | Stable Template | 27,578 | 55,152 | 16 / 16 | 0.2568 | 0.0672 | 1.7957 | 0.5450 | 0.3790 |

The detailed connected-component, boundary-edge, non-manifold-edge, timing, browser, request, geometry, and shape records are preserved in `artifacts/qa/task14c-template-topology-visual-pilot/metrics.json`.

## Browser gate and visual audit

- One continuous WebGL2 screenshot workflow completed.
- Geometry present: true for both surfaces.
- Console errors: 0.
- Page errors: 0.
- Procedural GLB requests: 0.
- Template GLB requests: 1.
- Reference scenarios shared the same finalPose input: true.
- Template Muscular supported: false.

The existing BodyShape/Production Skin V4 path reports that the Muscular proportion preview requires a skin rebind. The formal runtime therefore blocks applying the Muscular finalPose to this asset. No Muscular template was fabricated and no fitting or rebind algorithm was added. The retained Muscular template screenshots are explicitly experimental, failed, unsupported, and not for acceptance.

| Visual item | Result |
| --- | --- |
| Overall human proportion | template-better |
| Head/neck contour | template-better |
| Shoulder contour | template-better |
| Axilla continuity | template-better |
| Upper-arm/torso connection | template-better |
| Elbow loops | template-better |
| Waist contour | template-better |
| Pelvis contour | template-better |
| Groin separation | template-better |
| Thigh-root connection | template-better |
| Knee front | template-better |
| Popliteal fossa | unsupported |
| Hands/feet shape | template-better |
| Surface faceting | template-better |
| Post-pose volume retention | template-better |
| Reference rig alignment | both-fail |
| Muscular template | unsupported |

## Decision

`TEMPLATE_REFERENCE_PROMISING`

The stable template is clearly superior as a Reference human topology and silhouette reference: head/neck, torso, pelvis, groin, limb roots, joints, hands/feet, and surface smoothness are materially more anatomical than Procedural R48. It is not yet a valid final deformation carrier. Rig overlays and anchor errors show a substantial bind-space mismatch: for example, the shared Reference T rig has horizontal arms while the rendered template arms remain below that carrier, and Arm Raise 150 does not reach the shared target. Muscular is unsupported by the existing BodyShape/Production Skin V4 path without a prohibited rebind or fitting step.

Accordingly, this result only establishes that the Reference template topology is promising. It does not approve production use, change Human Core authority, accept the current binding, or authorize further Task 14C development. `visualAcceptance` and `productionReady` remain false.
