# R006.1 actual delivery and verification

## Delivered files

- `NEW_HUMAN_R006_1_ORIGINAL_CORE.html`: self-contained offline interactive page, 30,512,453 bytes; SHA-256 `b018d4576c418643c4f250208c8250a78a4103d837de07a532143d0537e04e31`.
- `NEW_HUMAN_R006_1_FULL_PACKAGE.zip`: complete local handoff with source USDZ, sampled data, weights, original core source, build scripts, actual viewer source and QA evidence.

These are conversation-delivered artifacts. This record does NOT claim that the large data package or full viewer has been deployed to a public website or committed in full to GitHub. The repository contains the runtime bridge, original-core build entry and browser shader test. The complete runnable source/data handoff is the ZIP.

## Actual inheritance

Production core source is pinned to `4b52c59cb21f05e1999d1850d443cb18a4adf591`, the existing September 18 human workbench support-transfer implementation. Agent, BasicController, NaturalLocomotion, MotionLabPose, ReferenceMotion, ContactHandPose, physics and preflight remain the motion/behavior authority. The new surface adapter only supplies subject bind data, actual support probes and the DQS palette.

128 original joint IDs/parents are retained. New joint centres are engineering fits to this source character, not measured internal anatomy. Ordinary actions do not modify bind lengths. The original graph-diffused eight-influence binding and normalized DQS are used. The old experimental `SampledSurfaceAdapter.mjs` is not the executed production entry; the tested generation pipeline is in the delivered full package.

Explicit subject adaptation: original ground-clearance contact iteration cap 8 -> 24, while all bone, attachment, joint, clearance and effector acceptance thresholds remain unchanged. Actual sampled sole clearance is calibrated once. This fixes a real fine-surface convergence failure instead of suppressing the error.

## Surface identity

- Source USDZ SHA-256: `b0435f3f30e0d63b6d4527000b7995b16fa91ca0ba8cb16b811be285e4fe7567`.
- 31 source parts, 494,664 source vertices, 977,244 source triangles, 124 textures.
- Browser draw vertices: 509,233 because UV seam coordinates require separate draw vertices; no triangles were deleted or simplified.
- 5,987 actual adjacent-part boundary correspondences share weight roots. Source coordinates and UVs are not moved.
- Across 19 sampled action poses, maximum corresponding seam separation is 0.000015025391 m, retaining the source seam precision rather than creating new long strips.
- Shorts preserved. No physical cloth shorts implemented.
- Source Z-up is converted to Y-up; Z forward, character left -X.
- 1.75 m is an engineering preview scale, not a user-provided measured height.

## Executed checks

Seven sequential actual-subject tests completed without action error: wave, forward 1 m, left turn 90 degrees, sit on ground, rise, lie down, rise from lying. Four additional runs completed: salute, backward destination 1 m, right turn 90 degrees, and forward/turn/wave sequential behavior. Backward-run pause/resume retained the exact palette and clock. Both synchronous and cooperative original preflight paths were exercised.

The seven-test maximum bone-length numerical error was 5.0361104e-13 m; maximum foot-target error 4.4947754e-16 m. These are numerical invariance checks, not clinical calibration or proof of visual naturalness.

Four original-source regression scripts were rerun: motion-skin attachment, standing-gesture retarget, execution rollback and floor-palm support. Their fixture scopes are preserved in the logs; the floor-palm regression uses a synthetic envelope and must not be presented as the new surface test.

57 native EGL/OpenGL renders use the full source surface and the actual committed subject palettes. Selected front/side/back renders were reviewed for standing, wave, walking, sitting, lying and salute. They are real geometric renders, not generated images and not browser screenshots.

GitHub Actions run `36697565349` passed a real Chromium WebGL 2 shader/material integration fixture: Three.js 184, eight-influence DQS, StandardMaterial basecolor/normal/roughness/metallic paths, page errors 0, GL error 0, shader error null, 62,173 colored fixture pixels. It is a shader fixture, NOT complete-character browser end-to-end acceptance.

## Remaining boundaries

Full-character browser interaction/performance has not been end-to-end accepted in this environment. Public hosting is not completed. Fine shoulder compression, fingers, self-collision, physical clothing, face animation and generalization to arbitrary shapes/actions remain unapproved. This is a test candidate, not production completion.

The visible surface still comes from full USDZ sampling. Rigging, binding and motion are program-driven; the character is NOT yet a compact, fully function-generated surface.
