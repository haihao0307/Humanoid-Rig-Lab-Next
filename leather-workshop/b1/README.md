# R17 B1 integrated performance and stability candidate

Parent integration: 7c15a2d58587da27b4d1ba7d6b4233a28d001aed; fixed R16 build: 0a9f4dad16f6005da9b0fa8b5e8040323d24d9df. This is one B1 delivery, not a set of tiny public releases.

The production cache evaluates the exact accepted material-frame vertex equations once per actual nodal texture version using WebGL2 transform feedback. Existing input buffers are shared with Three.js, not uploaded twice. Main and shadow draws reuse position/normal outputs. Resolution, geometry, materials, shadows, native physics and every physical step remain unchanged. Extra cache outputs cost 24 bytes per render vertex plus the nodal texture. All cached resources are product-owned and released on replacement.

The same batch adds bounded input/receive/apply/submission timing, descriptive convergence states, optional diagnostics, explicit failed-request cleanup, current-solver reset guards, product-registry cleanup and specimen material disposal. A converged step is not a manufacture-ready or calibrated material result. Submission time is not GPU completion or monitor latency. Rebuilding after a context loss resets the current test pose; it is not lossless physical checkpoint recovery.

Canonical sources are registered before tests. Normal build: python leather-workshop/r17/build.py. Independent verification: python leather-workshop/r17/verify-b1.py. prepare.py is one-time registration and refuses an existing r17 directory. No historical builder or output fallback is used by release builds. clang18/lld18 and Python dependencies are development requirements only.

Gates include unchanged native/worker programs, full geometry and numerical trajectories, message/frame semantics, separate GPU readback, original and deformed pixel comparisons, asynchronous ABBA timings including cache preparation, and a timed ten-minute continuous grab with product/specimen resource cycles. Software Chrome results do not certify a physical GPU or phone. Fixed public and standalone browser evidence plus DELIVERY.json govern release; failures and unknown device data remain explicit.

Primary integration references: https://threejs.org/docs/pages/GLBufferAttribute.html ; https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/beginTransformFeedback ; https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices . Original third-party notices remain intact. This work does not grant legal clearance or exclusive ownership.

- [x] Actual production source, no generated-image or simplified-mesh substitute.
- [ ] Runtime/visual/performance/public acceptance: determined by final DELIVERY.json, not source presence.
- [ ] User visual acceptance and physical-device certification remain independent.

Only verified changes may merge into perf/leather-r10-input-20261011. Preserve R01-R16, other workbenches, main, root license, removed jacket and disabled R11 noise experiment. Recovery entry: Issue52.
