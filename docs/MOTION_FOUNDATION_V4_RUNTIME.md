# Motion Foundation V4 Runtime

Motion Foundation V4 adds an asset-driven animation input without replacing the existing Animation editor or its `motion_clip@1.0` files.

## Authority and runtime boundary

```text
MotionClip V4
  -> AnimationRigRuntime
  -> desiredPose (PoseFrame V4 local quaternion)
  -> IK / Contact / Balance / Physics Follow
  -> finalPose
  -> simulationRig
  -> Production Skin V4
```

`AnimationRigRuntime` stops at `desiredPose`. It does not mutate `simulationRig`, Skin, bind data, hierarchy, bone length, or inverse bind matrices. Existing solvers remain responsible for producing `finalPose`.

## MotionClip V4

Schema: `schemas/motion-clip-v4.schema.json`

The format stores only:

- normalized joint-local quaternion tracks;
- character-local root translation and rotation;
- explicit foot/hand contacts;
- events;
- phase samples and gait markers;
- source rig/proportion and quality metadata.

Non-root joint position tracks, scale, bind data, parent changes, bone lengths, and inverse bind matrices are forbidden.

## Legacy compatibility

The existing procedural presets and `motion_clip@1.0` assets remain available for editor compatibility and legacy tests. `adaptLegacyMotionClipV1()` creates a read-only V4 runtime view; it never overwrites the original asset. Procedural preset values are frozen and are not a source for future motion fidelity work.

## Phase locomotion

`PhaseLocomotionRuntime` reads clip phase samples and markers. It reports left/right stance or swing, heel strike, toe off, and double support. It does not synthesize joint rotations.

## Retargeting

`MotionRetargetProfile V4` preserves joint-local quaternions exactly. It adapts only root motion, contact positions, and the contact-derived IK targets for height, leg-length, and arm-length differences.

## Development assets

The seven built-in V4 fixtures cover Idle, Walk, Stop, Turn, Sit, Stand, and Reach at the contract level. They are explicit local-quaternion data, not sine-generated motions, mocap, or production animation. Every fixture reports `visualAcceptance: false`; browser visual acceptance and replacement by licensed/captured assets remain required.
