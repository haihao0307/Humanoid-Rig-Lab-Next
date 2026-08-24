# Production Skin V4 Visual Acceptance

Automated tests validate contracts, quaternion preservation, compatibility gates, and synthetic deformation metrics. They do not certify visual quality. Browser inspection is performed manually by the project owner.

## Preparation

1. Start the existing local project server.
2. Open the existing humanoid viewport using the current project entry point.
3. Confirm diagnostics show:
   - `skinVersion: production-skin-v4-runtime@1`
   - `poseAuthority: finalPose.localRotations` after a V4 frame is received
   - `bindingVersion: skin-binding-v4-smpl24-compat@1`
   - `weightSource: asset-prebound`
   - `runtimeWeightGeneration: false`
   - `assetClass: compatibility`
   - `productionReady: false`
4. Keep the skin and skeleton visible together for axis and attachment comparison.

## Pose checklist

| Pose | Acceptance focus | Fail examples |
| --- | --- | --- |
| T Pose | shoulders level; arm height symmetric; chest and upper arms remain connected | collapsed shoulder, armpit spike, left/right height mismatch |
| A Pose | smooth shoulder transition and unchanged bind proportions | shoulder cave-in, arm length change |
| Arm Raise | shoulder volume and upper-arm roll remain stable | torso tearing, shoulder cap inversion |
| Forearm Twist | wrist orientation follows forearm roll without losing twist | candy-wrapper collapse, hand reversal |
| Squat | hips and knees bend forward consistently | hip explosion, knee flip, foot roll |
| Lunge | front/back legs preserve volume and foot direction | pelvis tear, calf inversion, drifting foot |
| Walk | left/right legs alternate; feet and root face the same direction | single fixed leg, reversed travel, foot twist |

## Proportion compatibility check

1. Load the bound compatibility asset and apply a V4 pose frame.
2. Change the Proportion revision without rebinding the skin.
3. Confirm the runtime blocks the frame and reports that a rebound asset is required.
4. Confirm no attempt is made to regenerate weights or inverse bind matrices at runtime.

## Result recording

For every failed pose, record:

- pose name and timestamp;
- front, side, and back screenshots;
- Skin V4 diagnostics;
- Character, Proportion, Rig, and binding revisions;
- affected region and whether the defect appears in skin-only, skeleton-only, or both.

The current compatibility GLB is expected to retain visible limitations around shoulders, twist, fingers, and materials. Passing this checklist requires a newly authored production asset, not only runtime changes.
