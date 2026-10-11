# S1B2 capture-phase diagnosis

Failed runs 38130720211 and 38131288672 were not released or merged. The second report records exactly equal DOM rectangles, scroll offsets, camera frame, shell gauge, geometry audit and physics state for R10 and S1B2. The 950 by 542 stage screenshots differed mainly by one vertical pixel (raw mean RGB difference 1.3214404091409335).

The actual stage rectangle has height 541.015625 and bottom 743.015625, hence GL viewport y = 256.984375 at DPR 1. The pinned Three r169 renderer uses `.round()` in setViewport but `.floor()` in setRenderTarget(null), which the shadow renderer invokes. A shadow-refresh frame and a subsequent ordinary frame can rasterize at different integer viewport origins even with identical camera and model data. Primary source: mrdoob/three.js@r169 src/renderers/WebGLRenderer.js and src/renderers/webgl/WebGLShadowMap.js. The actual shipped vendor file contains both implementations.

The revised measurement method waits for the current worker's initial pose application and renders two ordinary frames before capturing both versions. It does not rewrite application rendering, translate/resample a saved image, mask leather or seams, change camera, or lower thresholds. Raw image differences and GPU viewport values remain recorded. Success still depends on fresh execution.

Device-pixel-aligned viewport rendering is a separate inherited rendering robustness improvement to consider in S2. It is not claimed fixed in this architecture-only iteration.
