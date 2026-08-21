# Shoulder Rebuild Report

Date: 2026-08-21

## Chain correction

The final A/T pose implementation no longer rotates only `upperArm`. It resolves the complete upper-body chain:

`pelvis -> spine -> chest -> upperChest -> scapula -> clavicle -> shoulder -> upperArm -> lowerArm -> hand`

Clavicle and scapula remain control/corrective nodes in the existing 89-node schema. No second rig schema was introduced. Bind dimensions and parent hierarchy remain immutable.

## Surface correction

The official renderer remains Three.js GPU LBS. Sparse shoulder raise/twist corrective offsets are evaluated from rest vertices before LBS, preventing accumulated deformation and preserving shoulder volume through raised-arm poses.

## Verification

- A Pose changes scapula and clavicle: PASS.
- T Pose includes pelvis, spine, chest, upper chest, clavicle, shoulder and arm: PASS.
- Fixed bone dimensions and anatomical ROM: PASS.
- T-pose maximum measured surface edge stretch: 1.381x: PASS under the current validation threshold.
- Bind-pose restoration after corrective evaluation: PASS.
