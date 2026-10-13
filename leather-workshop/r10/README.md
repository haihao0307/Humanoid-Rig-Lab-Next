# Leather R10.0 — performance and viewport input

User-accepted R09.1 baseline: build `416d2b7a7d7214865fa47b82973450c700a65da9`, receipt head `0d741c72a924825a9bf42dc4c7c65c70a35d3bc5`. User acceptance covers appearance, observed physical response and thickness, not performance. The signed-off state is recorded in `../anchors/R091_USER_ACCEPTED_20261011.json`. Prior R01–R09 files and fixed links remain unchanged.

## Bounded changes

The rejected stand-collar jacket is removed from this runtime's catalogue, generated product factories and thumbnail construction. It will not return until an approved clothing shape is supplied by the clothing workbench. Six retained products, thirteen materials and six sample crafts remain.

The main RAF formerly requested two steps but the worker clamped the request to one 1/120-second step. Simulation therefore waited for presentation frames even when CPU capacity existed. R10 schedules the same fixed step in the worker, separately handles latest mouse targets, discards stale input epochs, transfers only actual completed physical poses, and applies at most one skin update per displayed frame. There is no mesh prediction, visual-only grab animation or widened physics timestep. The UI measures solve time, input-to-first-pose delay and actual cursor-to-grab distance separately.

The contact broadphase now uses reusable C/WASM spatial-hash buckets, query stamps and pooled pair objects instead of rebuilding JavaScript Maps/Sets and closure-heavy cell loops. It preserves the old candidate set AND traversal order. An initial candidate with reordered pairs was rejected after it changed finite-iteration results; the final tests assert order and full trajectory equality. Cached separating planes only skip a CCD call when both swept endpoints provably remain separated at the same thickness and tolerance; otherwise the original narrow phase runs. No contact is discarded for performance. Memory/candidate capacity overflow fails explicitly.

Skin material frames use reusable scalar buffers instead of allocating Vector3 objects and slices per face/node. Diagnostic DOM updates are limited to 5 Hz. Geometry, materials, constitutive law, damping, friction, iteration count, time step, shell thickness and collision tolerances are retained.

Viewport-only pointer capture and preventDefault suppress browser drag selection. The selection guard is temporary while a gesture crosses outside the viewport. Pointer up/cancel, lost capture, Escape and blur release it; ordinary text in the details panel remains selectable. A hidden page stops continuous physics work.

## Verification and delivery

Build: `python leather-workshop/r10/build.py`.
Numeric: `node leather-workshop/r10/qa-numeric.cjs`.
Crafts: `node leather-workshop/r10/qa-crafts.cjs`.
Paired physics benchmark: build the unchanged R09 node kernel in a temporary directory, then set `BASE_LIB` to it and run `node leather-workshop/r10/qa-performance.cjs`.
Browser: `KAOPU_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome xvfb-run -a python leather-workshop/r10/qa-browser.py`.

The benchmark uses one warm-up and two timed AB/BA repetitions of identical 52-step controlled lifts/releases for each retained product. It also checks geometry and physics-data hashes, finite-thickness candidate set/order under swept perturbations, final solved positions and skin frame values. It reports the actual machine and raw timings. These numbers are core-compute speedups, not user-device FPS or a promise of full realtime physics.

The release workflow tests in sequence, publishes only on its isolated branch, then opens the exact immutable HTMLPreview URL in Chrome. `DELIVERY.json` is written only after the public browser checks succeed. Source changes alone and previous HTML links are not new delivery evidence. QA screenshots are inspection evidence, never a substitute for the interactive runtime.

## Limits

R10 is a performance iteration, not re-certification of every physical behavior. Complex interlaced strips, dense contact, software rendering and low-power devices can still be slower than realtime. Material calibration, independent quilt filling compression, needle-hole local stress, yarn sliding and universal fine-display-mesh collision guarantees remain outside the accepted R09 scope. The 390×844 test is viewport simulation, not a physical phone. User acceptance of R10 performance remains pending.

Implementation references: MDN Pointer Events, Element.setPointerCapture, Web Workers, Transferable Objects; Three.js rendering-on-demand manual. These inform input and scheduling, not a change of leather material physics.
