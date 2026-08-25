# Human Core V5 Procedural Deform

## Status

- Runtime: implemented from `feature/human-core-v5-procedural-deform-runtime` and instrumented on `feature/human-core-v5-procedural-deform-visual-qa`.
- Pose authority: `finalPose.localRotations` from PoseFrame V4.
- GLB dependency: none for the procedural path.
- Implementation status: `code-complete-browser-blocked`.
- Browser QA: `blocked-on-browser-runtime` under the repository rule that computer/browser visual checks are user-operated.
- Codex visual review: `not-run-by-user-rule`.
- User visual acceptance: pending.
- `visualAcceptance`: `false`.
- `productionReady`: `false`.

This phase creates a renderer-independent procedural body surface. It does not replace the existing V4 compatibility skin, change the Rig hierarchy, or add a WholeBodySolver V5.

## Runtime chain

```text
BodyDNA + HumanRigCore
          |
          v
BodyFieldCompilerV5
          |
          v
CanonicalBodyFieldV5
          |
          v
StableProceduralSurfaceCacheV5 (Worker, one extraction per cache key)
          |
          +-------------------------------+
                                          |
finalPose.localRotations + AnatomyState   |
          |                               |
          v                               v
RegionDeformationDriverFrameV5 -> ProceduralDeformRuntimeV5
                                          |
                                          v
                              ProceduralDeformFrameV5
                                          |
                                          v
                              RendererAdapterInputV5
                                          |
                                          v
                              Three.js renderer adapter
```

## Canonical body field

The canonical field is compiled from BodyDNA and the existing HumanRigCore. Its 17 required regions are head, neck, upper/lower torso, pelvis, bilateral upper arms, forearms, palms, thighs, calves, and feet.

The compiler uses deterministic analytic primitives: ellipsoids, superellipsoids, tapered elliptical capsules, swept elliptical segments, and anatomical smooth composition. Shoulder, hip, neck/torso, wrist/palm, and ankle/foot junctions use separate blend policies rather than one global smooth-union value.

BodyDNA drives height, widths, thicknesses, limb lengths, mass/body type/fitness distributions, and authored asymmetry. The field definition contains parameters and fingerprints only; it does not contain vertices, indices, textures, skin weights, GPU objects, or Three.js objects.

## Stable topology strategy

`surface-extractor-v5.js` performs deterministic tetrahedral extraction in canonical bind space. A cache key is derived from:

```text
BodyDNA fingerprint
+ Rig topology fingerprint
+ generator version
+ resolution
```

For identical inputs it preserves vertex order, indices, region binding, and topology fingerprint. Pose updates only deform the cached canonical arrays; they never rerun extraction. Worker communication uses TypedArrays and transferable ArrayBuffers. Large surface arrays are not written to HumanCoreState, ProjectState, or ordinary JSON window messages.

## Region binding

SurfaceRegionBinding V5 is generated from analytic field contribution at extraction time. Each vertex receives at most four deterministic, normalized region influences. Runtime code does not use nearest-bone searches and does not create or mutate bones.

Left and right shoulder, elbow, wrist, hip, knee, and ankle drivers remain separate. Driver values combine final local quaternions, existing Rig joint axes, HumanAnatomyState, muscle semantics, and BodyDNA asymmetry.

## Per-frame deformation

The fixed policy is `region-hybrid-dqs-implicit@5.0`:

- DQS blending supplies the base transform for limbs and twist-sensitive regions.
- Region transforms stabilize torso, pelvis, head, and neck.
- Sparse local corrections consume anatomy compression, volume, elevation, and activation signals around shoulder, elbow, wrist, hip, knee, and ankle.
- Every output frame starts from the canonical cache. No previous-frame vertex offsets are accumulated.
- Normals, bounds, region diagnostics, and timing diagnostics are regenerated per frame.

The runtime rejects desiredPose, world-position authority, bone-direction reconstruction, and renderer matrices as formal pose input. It accepts only PoseFrame V4 validated by `assertPoseFrameV4()` and derives world transforms by forward kinematics.

## Validation pose authority and independent FK audit

All Node stress tests and page controls consume `procedural-deform-validation-poses-v5.js`. It reads the existing `HumanRigCore` `twistAxisLocal`, `bendAxisLocal`, and `sideAxisLocal` definitions and records the source axis, canonical-T resolved axis, requested anatomical angle, and resulting normalized quaternion. The UI no longer authors joint rotations.

The cyan skeleton overlay comes from `finalPose + V4Adapter(T Pose RigDefinition)` forward kinematics in `procedural-simulation-rig-fk-v5.js`. It does not consume procedural region anchors. The magenta points are a separate view of `ProceduralDeformFrame.regionDiagnostics`. Their critical shoulder/elbow/wrist/hip/knee/ankle comparison uses fixed gates of 0.02 m maximum and 0.01 m mean error.

## Renderer boundary

Core files under `src/modules/human-core-v5/procedural-deform/` do not import Three.js. `ThreeProceduralHumanAdapterV5` is limited to BufferGeometry attributes, indices, material/display mode, upload diagnostics, and GPU resource disposal. CPU field generation and CPU reference deformation work independently of WebGPU or WebGL2.

The browser page probes a real WebGPU adapter and device before constructing `WebGPURenderer`. A WebGPU failure and a successful WebGL2 fallback are reported separately. `?forceWebGL=1` explicitly creates a WebGL2 context. Browser execution is intentionally not claimed until the user runs the provided QA command and reviews its evidence.

## Automated evidence

Environment snapshot from 2026-08-25:

| Check | Result |
|---|---:|
| Low-resolution generation | 288.99 ms |
| Medium-resolution generation | 1,455.37 ms |
| Reference vertices | 10,284 |
| Reference triangles | 20,568 |
| Transfer payload | 863,856 bytes |
| CPU deformation median | 3.98 ms |
| CPU deformation P95 | 5.34 ms |
| Forearm twist radius retention | 0.9999 |
| Maximum Rig/surface anchor error | 12.48 mm |
| Maximum per-pose mean anchor error | 4.64 mm |
| Maximum symmetric paired-region size difference | 1.81% |

The geometry tests also report one connected component, zero boundary edges, zero non-finite vertices, zero out-of-bounds indices, and geometry measurements within the task tolerances. These are automated geometric results, not browser visual approval.

## Known limits

- The surface is an analytic development body, not a medically accurate or production-quality anatomical model.
- Correctives are sparse semantic signals rather than trained PSD or muscle simulation.
- Hands and feet are intentionally coarse and do not yet include finger/toe surface articulation.
- OPFS persistence is a future cache adapter; the current cache is derived runtime memory.
- Experimental GPU compute is not the default path.
- WebGPU/WebGL2 rendering, console cleanliness, camera behavior, and screenshots remain `blocked-on-browser-runtime` until the user runs the browser QA command.
