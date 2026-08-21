# Walk System Report

Date: 2026-08-21

## Runtime separation

The final animation path is:

`AnimationClip -> semantic channels / rotationTrack -> desiredPose (animationRig) -> joint limits -> foot contacts -> physics follow -> finalPose (simulationRig) -> skin`

Ordinary local-quaternion `rotationTrack` data remains unchanged. Anatomical `twist/bend/side` channels use the existing bind-local joint axes and are converted only when those channels are present.

## Locomotion changes

- Walking uses alternating left/right leg steps and opposite arm counter-swing.
- Pelvis/root motion is authored independently from limb rotations.
- In-place and forward variants share the locomotion cycle; only the forward clip enables root motion.
- Contact intervals are carried by the clip metadata and enforced by the runtime contact stage.
- Manual clip selection switches the graph to direct clip control, preventing an unintended fallback to the graph entry/A pose.

## Verification

- Idle, squat, walk-in-place and walk-forward runtime samples: PASS.
- Opposite step phases and arm counter-swing: PASS.
- Root-motion scaling across target body heights: PASS.
- Fixed bone lengths, contacts, layers and graph transitions: PASS.
- Legacy `rotationTrack` compatibility: PASS.
