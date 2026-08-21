# Pose Interaction Report

Date: 2026-08-21

## Final interaction path

`pointer event -> ThreeView raycaster -> joint/bone selection -> drag target -> PhysicsRig solver -> simulationRig -> skin`

The viewport uses pointer capture for free and axis-constrained dragging. `PhysicsRig` applies soft drag targets followed by exact-length projection, joint limits and rigid-pelvis constraints. Releasing a drag performs a final solve while the target indices are still known.

Static presets remain in `legacy/v8/src/` and do not enter Animation Runtime:

- A Pose: scapula, clavicle, shoulder, arm, forearm and hand.
- T Pose: pelvis through upper-body and both complete arm chains.
- Reach: hand target, elbow pole, shoulder/scapula and spine compensation.
- Step: foot target, ankle, knee, hip, pelvis and spine.

## Invariants

- Bone length: unchanged.
- Parent hierarchy: unchanged.
- Proportion revision: unchanged by pose operations.
- PoseSnapshot protocol: unchanged.

## Verification

- Joint drag during interaction and after release: PASS.
- Bone drag during interaction and after release: PASS.
- Extreme drag remains within bone, joint-limit and rigid-pelvis tolerances: PASS.
- A Pose, T Pose, Reach and Step chain tests: PASS.
