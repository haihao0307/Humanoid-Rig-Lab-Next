# Skin Deformation Decision V4

## Decision

Production Skin V4 separates the runtime contract from asset quality.

- The formal pose authority is `simulationRig.finalPose.localRotations`.
- The runtime maps Core Rig rotations into a read-only Deform Rig, writes bone-local quaternions, updates the Three.js skeleton, and lets `SkinnedMesh` consume the resulting skin matrices.
- Runtime-generated `JOINTS_0`, `WEIGHTS_0`, and inverse bind matrices are forbidden on the formal path.
- The current 24-joint SMPL asset remains a **compatibility asset**. Its V4.1 default is `gpu-lbs-bone-corrective` because the repository does not yet contain authored Deform Rig weights, DQS region masks, or a GPU DQS/Hybrid renderer.
- A future production asset should use GPU Hybrid deformation only after authored region masks, deform weights, corrective targets, and visual acceptance are available.

This decision does not label the current GLB as production-ready.

## Experiment

An offline, renderer-independent two-joint ring fixture compared LBS, DQS, and Hybrid deformation across 32 vertices. Each region ran 120 iterations. Radius retention is relative to the rest ring; `1.0` is full volume retention.

| Region | LBS | DQS | Hybrid | Hybrid mask |
| --- | ---: | ---: | ---: | ---: |
| Shoulder | 0.642788 | 1.000000 | 0.892836 | 0.70 |
| Elbow | 0.500000 | 1.000000 | 0.860000 | 0.72 |
| Forearm twist | 0.000000 | 1.000000 | 0.820000 | 0.82 |
| Hip | 0.737277 | 1.000000 | 0.908047 | 0.65 |
| Knee | 0.573576 | 1.000000 | 0.863544 | 0.68 |

One reference run on Node.js reported:

| Stage | Total CPU time |
| --- | ---: |
| LBS | 1.039 ms |
| DQS | 2.570 ms |
| Hybrid blend only | 1.304 ms |

These timings are development evidence only. They are not a browser, WebGPU, GPU, or full-character benchmark and must not be used as a shipping performance claim.

## Interpretation

- DQS preserved the synthetic ring volume best in every tested region.
- Hybrid materially improved volume retention over LBS while allowing region-specific control.
- Forearm twist demonstrates the fundamental LBS collapse case, but the current asset has no authored twist joints or weights with which to exploit Hybrid safely.
- LBS remains the only complete GPU renderer already present in the repository. Bone-driven corrective coefficients can reduce known regional defects without changing the Core Rig or binding data.

## Production gates

GPU Hybrid becomes the default only when all of the following are true:

1. The GLB has DCC-authored clavicle, scapula, upper/lower arm twist, thigh/calf twist, and finger weights.
2. The asset contains valid `JOINTS_0`, `WEIGHTS_0`, and inverse bind matrices for the declared Deform Rig.
3. UV and tangent attributes are present.
4. Region masks and corrective targets are authored and versioned with the binding profile.
5. T Pose, A Pose, Arm Raise, Forearm Twist, Squat, Lunge, and Walk pass visual review.
6. The browser GPU benchmark stays within the project frame budget.

Until those gates pass, the compatibility asset uses asset-prebound GPU LBS plus bone-driven correctives and reports `productionReady: false`.

## Asset decision

The current `smpl-male-surface-skinned.glb` must be rebound or replaced before production release. Runtime code cannot reconstruct missing twist, scapula, finger weights, UVs, tangents, or authored pose-space corrective shapes without silently creating a second, unstable binding system.
