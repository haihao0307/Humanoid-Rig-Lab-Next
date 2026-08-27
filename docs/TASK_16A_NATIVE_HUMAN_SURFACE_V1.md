# Task 16A Native Human Surface V1 — Blocked Foundation Record

## Final conclusion

`NATIVE_SURFACE_FOUNDATION_FAILED`

The same project-authored canonical cage evaluator failed the critical self-intersection gate on two consecutive core audits. The Task 16A stop rule is active. Parameter continuity, browser page work, screenshots, the Contact Sheet, visual acceptance, and Task 16B handoff were not run.

## Exact start and isolation

- Starting remote branch: `experiment/human-core-v5-production-surface-v2-neutral-body-a`
- Starting HEAD: `c1e042feea8a63d551ce01edc4b56f873aeff1e5`
- Sole parent: `be40c0197d91957fbc89c5cbf4aac95d231d3853`
- Task branch: `experiment/human-core-v5-native-surface-v1-canonical-cage`
- The remote starting HEAD and parent were verified before source changes.
- The Task 15A/15B read-only directories, `BUILD_MANIFEST.json`, `main`, formal geometry branches, `visualAcceptance`, `productionReady`, and `userVisualAcceptance` were not modified.

## Project-owned surface goal and authority

The implementation preserves the required authority chain:

`BodyDNA -> HumanRigCore -> Native Human Surface V1 -> future Performance Deform Rig -> Renderer`

Native Surface V1 reads BodyDNA and a read-only HumanRigCore T-pose projection. It does not mutate either input, create a second rig, use bone scaling, or write mesh/GPU/weight data into HumanCoreState. No external human mesh, downloaded asset, MakeHuman topology, SMPL topology, Mixamo topology, Marching Tetrahedra, Marching Cubes, Fairing Projection, or random seed was used.

## Fixed topology method

The project-authored cage is a symmetric front/back human silhouette shell with a shared groin boundary, separated left/right legs, T-pose arms, and a closed silhouette side wall. A fixed ear-clipped half-cage is mirrored, closed, then refined by two deterministic triangle-midpoint subdivision levels. BodyDNA never participates in connectivity generation.

- `topologyFingerprint`: `fnv1a-c3f16c93`
- `indexHash`: `fnv1a-197cd529`
- Vertices: `2658`
- Triangles: `5312`
- Seven presets share the same vertex count, triangle count, index array, topology fingerprint, patch layout, landmark IDs, region IDs, and symmetry map.

## Patch Atlas and anatomical structures

The atlas declares Head, Neck, Upper Torso, Lower Torso, Pelvis, bilateral Shoulder Junction, Upper Arm, Elbow Junction, Forearm, Hand, Hip Junction, Thigh, Knee Junction, Calf, Ankle, and Foot regions.

- Shoulder Junction: clavicle slope, acromion boundary, deltoid depth, and an axilla-floor reduction are encoded without inserting a separate joint sphere.
- Hip Junction: pelvis and thigh share one cage and bilateral hip-centered mappings.
- Axilla: front/back depth is reduced near the authored axilla floor.
- Groin: a shared central cage point separates the left/right inner-thigh boundaries.
- Knee: the same fixed patch adds anterior patella depth and reduces posterior popliteal depth.

These structures remain design evidence only because the final geometry failed the intersection gate and was not visually reviewed.

## BodyDNA mapping

BodyDNA drives height, shoulder/chest/waist/pelvis width and depth, upper-arm/forearm/hand length, thigh/calf/foot length, arm and leg volume, muscle, fat, and authored left/right asymmetry. HumanRigCore supplies T-pose anatomical anchors. Presets only change positions and normals; connectivity is fixed.

The machine-readable mapping is stored in `metrics.json` and the evaluator module.

## Landmark definitions and results

Landmarks explicitly distinguish skin-outline points from anatomical-center points. Joint centers (clavicle, shoulder, elbow, wrist, pelvis, hip, knee, and ankle) use the read-only HumanRigCore anchors. Head top, chin, heel, and toe are weighted surface-outline coordinates.

All seven presets passed the configured landmark gates:

- maximum landmark error: `0 m`
- mean landmark error: `0 m`
- height error: within `0.01 m`
- shoulder width error: `0 m`
- hip width error: `0 m`

This pass does not override the geometry failure.

## Topology metrics and two failed attempts

Both attempts retained one connected component, zero boundary edges, zero non-manifold edges, zero degenerate-triangle ratio, finite positions/normals, normalized normals, and consistent indexed edge winding. Both failed the critical self-intersection gate.

| Preset | Attempt 1 critical / total | Attempt 2 critical / total |
| --- | ---: | ---: |
| Reference | 118 / 1250 | 52 / 900 |
| Lean | 103 / 1102 | 28 / 898 |
| Muscular | 208 / 1478 | 62 / 930 |
| Heavy | 185 / 1482 | 38 / 904 |
| Tall | 161 / 1480 | 36 / 838 |
| Short | 130 / 1202 | 68 / 1084 |
| Asymmetric | 142 / 1366 | 51 / 912 |

Attempt 1 used discrete patch-dependent position mapping. Attempt 2 replaced this with continuous monotone UV mapping and reduced the Reference critical count from 118 to 52, but did not reach zero. Evidence is retained in `artifacts/qa/task16a-native-surface-v1/failures/` and `metrics.json`.

## Parameter continuity

Not run. The task explicitly prohibits parameter sweeping after two failures of the same core topology generation approach. The continuity script is retained as unfinished evidence but `parameter-continuity.json` was deliberately not generated.

## Page, screenshots, and visual results

Not implemented or run after the stop rule triggered. No browser, WebGPU, full tests, CI, or GitHub Actions were run. All required visual comparison items remain `unsupported`. `externalHumanAssetRequests` for the Native generator is `0`; browser `consoleErrors` and `pageErrors` are not measured.

## Known limitation and replacement direction

The mirrored silhouette-shell topology is fixed and closed, but its long planar disk chords remain unsuitable as a production anatomical parameterization: after 3D depth and proportion evaluation, non-adjacent surface triangles still intersect around major junctions. A future restart must use a different authored cage layout with local patch interiors and explicit junction edge loops, not another parameter tweak to this algorithm.

## Task 16B interface status

Not eligible. The intended interface would expose one indexed geometry, stable vertex IDs, patch/region metadata, symmetry partners, landmarks, BodyDNA mapping, and renderer-side carrier state without a second rig. Task 16B must not begin until a replacement static cage passes Reference critical self-intersection count `0`, all seven topology gates, continuity, and user-run visual review.
