# Rig / Skin Diagnostic

Date: 2026-08-21

## Root cause

The visible 89-node control/simulation rig and the original 24-joint SMPL skin palette were not equivalent. Finger controls could move correctly while the hand surface remained dominated by the hand joint, so visible finger markers were not evidence that their matrices participated in skinning. The same gap affected scapula and twist helpers.

## Final data flow

`Animation / IK / user pose -> simulationRig -> final bone matrices -> extended runtime deform palette -> Three.js SkinnedMesh GPU LBS`

The GLB `JOINTS_0`, `WEIGHTS_0`, and `inverseBindMatrices` remain the authoritative base asset. The runtime appends deterministic deform joints and derived four-influence weights without rewriting the GLB. Skinning does not read the temporary visual skeleton.

## Modified implementation

- `legacy/v8/src/smpl-skin.js`: 24-to-67 runtime deform palette, finger/scapula/twist participation, bind-safe matrices, sparse correctives.
- `legacy/v8/src/physics-rig.js`: full incoming local quaternion path into the final simulation state.
- `legacy/v8/src/skeleton-presets.js`: stable finger bind placement and complete static chains.
- `legacy/v8/tests/surface-layer-integration.mjs`: matrix, weight, finger-response and bind-restoration coverage.

## Verification

- Native GLB topology, `JOINTS_0`, `WEIGHTS_0`, inverse bind matrices and checksums: PASS.
- Runtime palette: 24 asset joints -> 67 runtime deform joints: PASS.
- Weighted vertices: 5,833 twist, 3,825 scapula and 1,924 finger vertices: PASS.
- Finger surface response: 0.0089 m: PASS.
- Full `npm test`: PASS.
