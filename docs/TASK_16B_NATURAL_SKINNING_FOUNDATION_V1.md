# Task 16B R1 — Natural Skinning Foundation V1

## Outcome

`SKINNING_CATASTROPHIC_STABILITY_FAILED`

The bind calibration, generated inverse bind matrices, Rest Identity and the
project-authored eight-influence weight-field gates pass. The required standard
pose gate does not pass after two bounded core weight-method revisions, so the
explicit stop rule applies before the 512-pose stress test, page build, browser
QA, screenshots and review-package build.

## Authority chain

BodyDNA Reference -> HumanRigCore -> `finalPose.localRotations` ->
HRLPerformanceDeformRigV1 -> HRL Natural Skinning V1 ->
HRLFullBilateralSurfaceV1 -> Renderer.

The implementation does not create a second authoritative skeleton, change a
HumanRigCore parent relationship, introduce bone scale, mutate canonical
positions, regenerate topology, transfer third-party weights or read external
inverse bind matrices.

## Implemented foundation

- `HRLReferencePoseCalibrationV1` derives 26 landmarks from deterministic real
  surface neighborhoods and projects the HumanRigCore hierarchy while retaining
  fixed bone lengths.
- `HRLPerformanceDeformRigV1` builds a 69-bone deformation palette with 14
  read-only twist bones and the existing stable finger IDs.
- `HRLSkinBindProfileV1` owns the A-pose bind-local, bind-world and inverse-bind
  matrices generated in this project.
- `HRLSkinWeightGeneratorV1` uses semantic/anatomical region gates, bone-segment
  seeds, surface-graph adjacency diffusion, bilateral constraints, centerline
  balance, exact normalization and an eight-influence cap.
- `HRLNaturalSkinningRuntimeV1` provides CPU reference implementations of
  `lbs4`, `lbs8`, `dqs8` and `hybrid`. Canonical inputs remain immutable.
- Thirty-three deterministic pose fixtures and six progressive sweep
  definitions use HumanRigCore joint IDs and local quaternions.

## Passing gates

- Maximum landmark-to-joint error: `0.021670186399805454 m`.
- Mean landmark-to-joint error: `0.007168639241924053 m`.
- Maximum calibrated bone-length error: `1.6653345369377348e-16 m`.
- Rest position maximum/mean error: `0 / 0 m`.
- Rest normal maximum error: `6.143906154658885e-8`.
- Rest centerline gap, triangle flips, NaN and Inf counts: all `0`.
- Zero-weight, negative-weight, non-finite-weight, orphan-bone, unknown-bone,
  cross-side leak, bilateral error and centerline balance metrics: all `0`.
- Maximum influence count: `8`; maximum discarded weight: `0`.

## Failed gate and bounded revisions

Revision 1 corrected a real semantic-token bug where `forearm` matched a broad
`ear` expression, then constrained orphan repair to the appropriate side or
centerline. Non-contact critical self intersections fell from 10,406 to 3,322.

Revision 2 introduced anatomical-zone-specific bone-segment kernel widths,
reduced the DQS fraction at major joint transition regions and corrected
semantic flexion direction in deterministic fixtures. The final standard-pose
result is 4 pass / 29 catastrophic failures, 12 volume failures and 2,731
non-contact critical self intersections. Return-to-rest error remains exactly
zero.

The complete evidence is in
`artifacts/qa/task16b-natural-skinning-v1/standard-pose-and-sweep-audit.json`.

## Deliberately not produced

The 512-pose stress report, runtime page, portable standalone, ZIP and PNG
screenshots do not exist. Their absence is a stop-gate result, not evidence of
success. Browser fields remain `null`, visual acceptance remains false and
production readiness remains false.
