# R14.0-S2A — measured contact-potential optimization

Status: delivered and merged; user review pending. PR62 was merged into `perf/leather-r10-input-20261011` at `c45a89f7bea818bd6c0a5137ba6ed25e368f1b75`. Repository main and R01-R13 are unchanged. Recovery starts at `../START_HERE.md`, `../TASK_STATE.json`, Issue52 and `NEXT_TASK_S2B.md`.

## Verified public build

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/37178e800a3272575b16e30a0723b3bcf1f29c0a/leather-workshop/r14/public-lite.html

Source: `9d436910d2dfe7c10665a4db6d208f5fa596b7ba`. Build: `37178e800a3272575b16e30a0723b3bcf1f29c0a`. Receipt: `68504371cb669707bfc7a784858cdffead355ddc`. Successful workflow: `38345375250`. HTML: 3,629,745 bytes, SHA256 `120a3772d4384ed375311df1a856e864836ba56e88a24345d0ed72e84f9cc049`.

## Production relationship

Numerical changes are the conservative projected-distance certificate in `native/energy.c` and its explicit 15-double pair ABI in `src/physics/native-energy.js`. The projection lower bound is recomputed from CURRENT vertices and must exceed BOTH the barrier range and the running exact minimum with positive padding. Only then is zero-barrier work bypassed. Lagged friction still runs independently. Invalid/zero or uncertain directions take the unchanged narrow-phase path. No candidate is removed.

High-frequency 9-double CCD packing writes exact Float64 scalars rather than allocating temporary spread arrays. Candidate order, values, capacity rollover and same-reference cache semantics are covered by 24 exact-byte cases. See PACKING_OPTIMIZATION.md. Broadphase, swept CCD, force law, friction, timestep, iteration budget, geometry, thickness, grain and wear remain protected. Actual solver poses drive the image; no mouse-follow substitute.

The new source-built kernel has a separate reviewed SHA256: `0c19f13b9cf7e2edb2b138fb2aad078bbcd7f9153e7a37b7e03630c87de360b6`. R13 golden files are not edited. Ordinary build does not execute one-time migration tools.

## Tests and measured scope

134 source gates, 480 native certificate cases, 24 exact packing cases, 18 numerical cases, 25 application cases, 25 geometry cases and six full 52-step trajectories passed. Maximum position difference: 0 mm; final penetration: 0 in those cases. 45 offline and 16 immutable-public Chrome checks passed without application/shader errors. Nine raw visual pairs matched exactly. Counts contain nested suites and should not be summed.

AMD EPYC7763, 4 logical CPUs, Node22.23.3; two warm-ups followed by eight alternating paired 52-step replays per product. Median replay times: wallet 1780.040 to 1389.985 ms (-21.91%); diamond sample 619.258 to 603.233 ms (-2.59%); bag 1242.239 to 1161.468 ms (-6.50%). These compare solver workloads, not FPS or universal latency. Browser timing probes are separate from uninstrumented release checks. Unsupported pure GPU/queue/GC attribution remains explicitly incomplete.

## Recovery and next work

The 2026-10-13 recovery rechecked artifact11789715276, all eleven receipt report hashes, nine archived raw pixel pairs and six trajectory digests. It did not execute fresh numerical/browser tests or modify the tested runtime. A separate container HTTP attempt failed DNS resolution; do not treat that as a public-page failure or as a new HTTP/browser pass. Public evidence remains the successful fixed-URL workflow. See `qa/s2/RECOVERY_20261013.json`.

Run `python leather-workshop/r14/build.py`, then `python leather-workshop/r14/verify-s2.py` in the pinned development environment. User webpage opening requires no compiler. Do not run materialize over edited canonical sources. S2B is main-thread/Worker waiting analysis, not a repetition of S1 or S2A.

- [x] Real production source and actual procedural geometry/physics.
- [x] Native/differential/performance and uninstrumented offline/public browser gates passed.
- [x] PR62 merged under user authorization; old versions preserved.
- [ ] Full S2, 50 ms P95 target, user visual acceptance and physical-device coverage.
- [ ] Material calibration and commercial legal clearance.

Three.js, Poly2Tri and source attributions are retained. Primary timing references: https://developer.mozilla.org/en-US/docs/Web/API/Performance/timeOrigin and https://developer.mozilla.org/en-US/docs/Web/API/Performance/now .
