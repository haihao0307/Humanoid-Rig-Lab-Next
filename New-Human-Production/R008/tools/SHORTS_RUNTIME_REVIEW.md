# Independent runtime review, 2026-10-02

Read-only production review of initial `ShortsClothRuntime.mjs`, before body/draft integration. No candidate runtime was executed. QA harness syntax and `--help` checks passed only.

Disposition: HOLD for dynamic acceptance.

1. `advance()` captures body pose once with `body.update(dt)` and then runs multiple 1/240 s cloth steps against that single pose. This moves the kinematic collider in frame-sized jumps and makes the physical path depend on rendering cadence. Sample the actual animation/collider at solver time, or interpolate the actual previous/current pose on a documented synchronized clock; a stationary body test cannot establish this correctness.
2. `fixedStep()` records `audit(false)`, whose body penetration field remains zero by construction. Its body failure history can therefore falsely remain zero. An unchecked field must be unknown, not passed. Full audit currently checks only vertices; vertex and centroid projection cannot establish all-triangle body clearance or swept crossings.
3. Opposite-vertex bend distance is initialized from formed 3D cloth coordinates. This encodes the initialization shape into bending rest and also mixes bending with membrane distance. Use a declared flat-cutpaper bending reference (e.g. rest dihedral with a documented constitutive law), or explicitly document/authorize a manufactured crease; initialization alone is not material-rest authority.
4. Self-contact has no EE or swept tests, skips distances below 1e-10, and excludes any triangle touching a vertex's one-ring neighbors. A coincident/crossed candidate can be missed. Audit returns no independent strict/self/CCD counters. Its `valid` cannot mean whole-garment dynamic validity; missing checks must retain HOLD.
5. Validate finite dt and configuration before mutation. Infinity causes an unbounded accumulator loop; zero/negative fixedDt can hang. A bounded catch-up policy must record retained backlog, not silently discard elapsed time or rewind cloth.

Correct source observations: the triangle deformation gradient uses Dm inverse with the appropriate column mapping; distance XPBD update signs are consistent with C=length-rest; source mass is apportioned by 2D triangle area and summed over stitched quotient groups. These observations do not prove coupled convergence or material calibration.

The independent harness `qa-shorts-motion.cjs` waits for `HumanShorts.cloth` and `HumanGame`, observes each real fixedStep through a transparent wrapper, audits actual seam quotient/positions, and executes real controller stand/walk/run/jump/settle actions. It preserves the first failure. Full-body/CCD/strict certificates are currently absent, so it deliberately cannot certify the initial candidate. Future certificates must be substantiated by independent geometric checks, not boolean labels.

The runner has not yet tested stopping relative velocity or body-relative waistband drift. Those gates require a stable actual candidate and its measured band reference, and remain pending; current harness completion must not be treated as final approval.

- [x] No generated image substitutes for real 3D implementation.
- [ ] Production integration and physics defects are resolved by producer lanes.
- [ ] User-visible interactive garment workbench is tested.
- [ ] Actual runtime geometry, skeleton, cloth and actions pass.
- [ ] Camera, motion and parameter controls are tested.
- [ ] Fixed public URL and real browser are verified.
- [x] Screenshot-only delivery is rejected.
