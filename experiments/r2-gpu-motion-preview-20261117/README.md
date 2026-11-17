# R2 GPU Motion Preview · 2026-11-17

This is a separate, self-contained HTML preview. It does not modify the formal main runtime or replace the 2026-11-15 gray-motion research snapshot.

## What this first version actually reuses

- The complete formal R2 application entrypoint from the source commit recorded in BUILD_MANIFEST.json.
- The R2 function-parameter surface inputs and source rig reference. No baked display vertices or triangle-index cache is added to the preview.
- The formal 128-joint rig, eight uint16 skinning weights per binding root, and the existing GPU dual-quaternion skinning shader (DQS).
- The formal JarvisEmbodimentLab / MotionLab action interface for walk, sit, lie, stand, wave, and salute.
- The original R2 body and hair workers, packaged as Blob modules with the parameter files embedded in this single HTML. Body generation does not need remote parameter fetches.

## Controls and measurements

The floating panel submits actions through the same formal command interface as the original workbench. It reads the actual R2 runtime panel's FPS, GPU timer, render CPU, draw calls, triangles, and geometry-buffer measurements. A missing GPU timer is reported as unsupported; it is not replaced with an estimate.

## Important boundaries

- This is an integration proof using the formal R2 action interface. The gray research branch's separate 104-joint action candidate has not yet been retargeted to the 128-joint R2 rig. Its source skeleton, local-reference conventions, and finger/head tracks need a measured mapping before that can be claimed.
- R7 still records shoulder/axilla posed-surface folding. This preview does not pass skin visual acceptance and must not be frozen as a production NPC.
- The CI browser smoke uses SwiftShader and verifies loading/action dispatch only. Its FPS is not a hardware performance benchmark.
- The standalone page is a preview artifact; the formal R2 source and generated main entrypoint remain unchanged.

Open index.html directly in a modern Chromium browser, or use the immutable public preview link from the handoff.
