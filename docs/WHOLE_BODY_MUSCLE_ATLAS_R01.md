# Whole-body muscle atlas R01

Branch: `feature/human-core-v5-wholebody-muscle-atlas-r01`

This increment extends the existing R2 body rig and the current skin deformation path. It does not create another skeleton, does not write joint transforms, and does not modify `finalPose`.

## Included

- 19 authored muscle groups, expanded to 37 bilateral/central instances: pectoralis major, deltoid, trapezius, latissimus dorsi, biceps, triceps, forearm flexors/extensors, rectus abdominis, external oblique, erector spinae, gluteus maximus/medius, quadriceps, hamstrings, adductors, gastrocnemius, soleus and tibialis anterior.
- Pose-proxy activation from the current R2 joints.
- Analytic longitudinal envelopes with bounded radial expansion.
- CPU support-probe path and the existing GPU skin vertex shader both receive the same muscle runtime records.
- Muscle runtime reads source bind anchors and current pose; it never modifies the rig.

## Explicit limits

This is a first procedural deformation layer, not a reconstruction of Emil's original ML Deformer model. It is not trained from MRI or FEM simulation. Activation is a kinematic proxy, not EMG or calibrated muscle recruitment. The analytic fields approximate visible bulging but do not yet model fascia, fat sliding, skin self-collision, muscle-to-bone contact, tendon wrapping, or cloth collision. The GPU shader currently loops through a fixed maximum of 40 muscle records; the performance cost must be measured on real hardware before enabling this for crowds.

The original Emil R03 project bundle remains unavailable from the prior isolated build environment; this branch is a native integration path in the user's own rig, not a claim that the original project has been recovered.

## Checks

Run:

```sh
node tests/whole-body-muscle-atlas.test.mjs
node tools/build-pure.mjs --check
python tools/audit-files.py
```

The unit test checks the atlas descriptor count, bilateral expansion, activation on a flexed elbow, and non-zero surface displacement. It does not certify visual quality, full-body topology continuity, or runtime performance. Visual acceptance and production readiness remain false.
