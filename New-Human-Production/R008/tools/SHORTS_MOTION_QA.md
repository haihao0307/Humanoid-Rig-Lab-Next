# Independent shorts motion acceptance

Prepared 2026-10-02 against R008 baseline `09507c395eee0b924d1fc98572c1134773f9b779`. This is a test contract, not a passing garment report. No candidate physics run has been certified.

## Evidence and runtime authority

The old `NATIVE_MATH_AUDIT.json` verifies membrane and distance gradients against finite differences (maximum relative error 2.23e-9), actual stitched masses, and isolated membrane energy decrease. It does not prove bending/contact coupling or native stability. Old NATIVE / NATIVE_PRESET / NATIVE_BIND first-step principal strains are 12.631%, 21.200%, and 20.792%: all fail. Do not carry their motion-ready state forward.

R008 is a generated, already clothed surface with 61 bones and eight skin influences. Its mesh overrides `applyBoneTransform` to evaluate all eight. A CPU collider can use that override on current geometry positions, followed by `mesh.matrixWorld`. Do not multiply the actor transform twice. Evaluate after the final animation/IK pose; keep previous and current body positions on the same simulation clock as cloth. Record component ownership: a clothed envelope measurement is not bare-skin measurement. Existing source clothes cannot silently be treated as an interchangeable naked body or removed from collision while remaining visible.

The original nine roles and 19 source seam relationships are reusable. Old paper dimensions, G width, formed XYZ, old body triangle anchors, DOF/cache objects, and motion history are not transferable fit authority. New 2D paper must come from current measured dimensions and declared design. Every new rest triangle and mass must be reconstructible from that source paper.

## Gates before and throughout motion

- All 19 source seam pairs are genuinely joined; maximum positional gap <=0.1 mm. One garment component and three boundary loops. No extra joins, frozen cloth, or hidden position skinning.
- Ordinary linen panels, including G and linen waist casing: absolute principal strain <=5% for every triangle. Elastic tape is a separate source rest-length/compliance channel with its extension limit declared before testing; its allowance cannot relax linen limits. Log elastic rest/current arc lengths, stretch, force estimate, and source attachment endpoints.
- Body signed penetration <=1 mm; strict cloth/body and unexpected cloth/self intersection counts zero. Contact uncertainty, unresolved constraints, and exhausted candidate budgets fail. Record collider approximation error separately; proxy success alone does not certify the rendered surface.
- Finite position, velocity and multipliers; source UV/rest/mass identity unchanged during motion. No rewinding positions, zeroing velocities/history, skipping failed frames, or dropping elapsed simulation time. All constraint compliance uses the actual substep h. Log every substep worst strain/contact, not only displayed frames.
- Elastic waistband stays on the declared measured low-rise band. Report actual body-relative band height, gap and downward drift, rather than accepting a ring floating away from the body. Finite material/contact forces may act; no permanent world pins.

## Fixed action sequence

Once the initial garment passes, use the real CharacterController/GameAnimator: stand 2 s, walk 4 s, run 4 s, three complete jumps including landing, then stop and settle 3 s. Choose an unobstructed declared route for the cloth-only action test; separately retain the existing obstacle controller tests. Log actual movement speed, world distance, gait cycle progression, airborne interval and landings to prove actions occurred. Keep the first failure and complete phase peaks in the receipt.

For the last settling second, use waist/pelvis-relative cloth velocities so actor translation does not fake instability or rest. Proposed engineering limit: RMS <=0.05 m/s, no sustained downward waistband drift or increasing energy. Repeat the same simulation schedule at 30/60/120 Hz render cadence; compare final cloth position and elastic length with an explicit tolerance. Changing timestep, solver coefficients or iteration budget starts a new candidate with a new receipt.

## Performance and browser evidence

Proposed current-machine engineering target: cloth plus posed collider CPU p95 <=8 ms per visual frame; total CPU frame p95 <=16.7 ms. Report p50/p95/max and action-specific counters, cloth count, contact candidates, pose update and collider refit time separately. Full-quality rendered geometry is ~436k triangles: do not rebuild or CPU-skin it every solver iteration. A reduced collision surface needs an independently measured posed-surface error bound and identity.

No uncaught browser errors or failed required runtime requests. The preview server whitelist must include new modules. Rebuild/reset/density changes must dispose the old simulation/collider and bind new identities atomically. Background pause must stop both clocks; resuming cannot apply a large single cloth step. Capture internal off-screen QA evidence without touching the desktop mouse. A failed physics candidate must visibly disable motion-ready claims and retain failure telemetry.

QA remains pending until an actual candidate runtime and its snapshot API are available. `tools/qa-shorts-motion.cjs` will execute the fixed sequence against that API, not against an isolated fake fixture.

## Delivery checklist

- [x] No generated image substitutes for the real 3D implementation.
- [ ] Production cloth source is actually integrated (owned by the producer lanes).
- [ ] The user has an interactive 3D workbench containing the candidate shorts.
- [ ] Human geometry, skeleton, actions and cloth come from the actual runtime.
- [ ] Camera, motion and parameters are operable.
- [ ] Fixed public URL and real browser are verified.
- [x] Screenshot-only delivery is rejected.

Primary numerical references: [XPBD](https://mmacklin.com/xpbd.pdf), [Small Steps](https://mmacklin.com/smallsteps.pdf), [Three.js SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html).
