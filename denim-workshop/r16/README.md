# Denim R16 — exact frame reuse and render-path iteration

Parent: R15 source/review 895bf144e2a8e70b86f7f15cfeaedba2b4415170; immutable build 9a3dd98452669ba4104a7a7cf169546c9f694e1b. User continues live-physics performance work. Thickness, continuous bending, collisions and all fixed steps stay; tearing and garment/human integration remain out of scope. Add only r16 and its workflows. Draft; no merge, force push or historical rewrites.

## Changes

1. Capture the unchanged materialFrame evaluator at the EXACT original Float32 carrier vertices into three RGBA32F attachments. Front/back surface, carrier shadow and LOD mask reuse those results for the same uploaded physics revision. No new sampling lattice, reduced geometry, cached animation, or temporal interpolation. Camera changes can reuse the same snapshot; rebuilding the cloth invalidates coordinates. Missing EXT_color_buffer_float keeps the original path. The cache is about 1.22 MiB for the existing fold carrier; it adds memory rather than claiming all resources shrink.
2. When internal and output dimensions match and local-LOD blending is absent, pair the original linear 4x4 footprint into four bilinear samples. The algebra is equivalent at native pixel centers, up to GPU floating-point rounding. Fractional supersampling and nonlinear local-LOD mixing keep the original 16-tap expression. No pixel size, antialiasing or texture resolution changes.
3. Pure physical-control changes do not cancel an already frozen coherent offscreen frame. Camera, material, geometry and display changes still invalidate it. Actual control commands and simulation continue unchanged.

13 protected physics, yarn, surface, LOD and timing modules are byte-identical. The C/WASM kernel is not rebuilt or replaced. Default light parameters are inherited unchanged so the performance comparison is not confounded by another light setup. No additional lighting claim is made.

## Evidence

BASELINE_PROFILE.json is a separate instrumented R15 diagnostic using per-draw asynchronous queries, NOT the deployed app and NOT an FPS benchmark. Shader compilation may affect first samples. Unit test independently checks native filter weights including clamped borders/HDR, preservation hashes, and visual/physical key separation. qa.py uses actual file and public navigation, R15 references, an explicit uncached A/B switch, three thicknesses, release/reset, viewport and complete 30-second motion benchmarks. Readback is paused-only, not inside timed playback.

All visual and performance results are pending until DELIVERY_RECEIPT.json is written. A successful functional build must not be called 60FPS acceptance. Software Chromium/SwiftShader is not the user's GPU; a 390x844 viewport is not a phone. Retain prior uncalibrated physics, incomplete CCD, and fixed-swatch limitations.

Run derive.py once, then edit canonical files and run build.py. Do not overwrite edited canonical files by rerunning derive.py.

Methods/documentation: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices and https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/ . No external mesh or material asset added.
