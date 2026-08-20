# Third-party notices

## Three.js

The project uses Three.js `0.185.1` under the MIT License. The local dependency is declared in `package.json`.

## Reference humanoid surface and transitional skin binding

The integrated V8.4 viewport includes a sample SMPL-related reference surface and a transitional pre-bound derivative used to validate the native Three.js `SkinnedMesh` path. Review:

- `legacy/v8/THIRD_PARTY_NOTICES.md`
- `legacy/v8/assets/smpl/ATTRIBUTION.md`
- `legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json`

The package does not include the licensed full SMPL parametric model, official learned skin weights, joint regressor, or pose-corrective blend shapes. The included transitional weights are marked `productionReady: false` and must be replaced by appropriately licensed professional weights and corrective shapes before production publication.

## MediaPipe Tasks Vision

The image-pose module can load `@mediapipe/tasks-vision@1.0.1` on demand and use `PoseLandmarker` with the `pose_landmarker_full_float16_v1` model. The MediaPipe codebase is provided under Apache License 2.0. This merged package does not redistribute the Tasks Vision runtime, WASM files, or Pose Landmarker model binary. The current browser implementation retrieves them at first use from the configured jsDelivr and Google model-storage locations.

Before public or offline distribution, the project owner must separately review the Pose Landmarker model terms, preserve source and version information, record hashes for any locally mirrored files, and complete the privacy disclosure for on-device image processing and any SDK performance or usage metrics.

## Production asset review

Every production model, texture, motion file, training-derived asset, runtime package, and remotely loaded model must receive a separate license, provenance, privacy, and redistribution review before publication.
