# R14 S2A — measured contact-potential optimization

This candidate starts from fixed R13. The only numerical production changes are the conservative projected-distance certificate in native/energy.c and its explicit 15-double pair ABI in src/physics/native-energy.js. One-time preparation is not used by normal build.py. New native bytes are pinned separately, never substituted for R13 golden bytes. The broadphase, candidate order, narrow-phase fallback, swept CCD, force law, friction, timestep, iterations, appearance and geometry remain protected.

A projection lower bound must exceed BOTH the barrier range and the current exact minimum, with positive numerical padding. Only then is the zero barrier term bypassed. Lagged friction remains evaluated independently. This is not omission of contact candidates. Invalid/zero normals and uncertain cases fall back to the original calculation. All displayed poses remain genuine solver results.

Run build.py, then verify-s2.py. The performance script uses one warm-up and four alternating paired 52-step runs per product; P50/P95, hardware, sample counts and inclusive phase costs are recorded. Wall-clock comparisons are not user-device FPS guarantees. Browser frame and input-to-pose samples are separate; unsupported GPU/queue/GC attribution is labelled unavailable instead of invented.

Progress and delivery are authoritative only in DELIVERY.json and the parent TASK_STATE. S2A is not all of S2, not a new material calibration, and not commercial legal clearance. Three.js, Poly2Tri and source attributions remain unchanged.

- [x] Real production source, not generated images.
- [x] Procedural leather geometry and actual physics retained.
- [ ] New interactive standalone/public browser verification: see fresh DELIVERY.json.
- [ ] User visual acceptance remains pending.

Primary timing references: https://developer.mozilla.org/en-US/docs/Web/API/Performance/timeOrigin and https://developer.mozilla.org/en-US/docs/Web/API/Performance/now .
