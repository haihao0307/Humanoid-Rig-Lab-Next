# Task 14C-1 Geometry Blocked Checkpoint

## Scope

- Exact base: `c00a94f15e1d107da432014ee1d09170aaab1cc0`
- Branch: `feature/human-core-v5-task14c-geometry-v1`
- Recovery checkpoint `a3b5ae2aad03f932a17dd69972b464811cb5b618` was not cherry-picked.
- WebGPU, renderer initialization, the import map, renderer upload code, Rig hierarchy, stable joint IDs, and GitHub Actions were not changed.

## Completed

- Verified the exact remote geometry base and the read-only recovered checkpoint.
- Downloaded GitHub Actions artifact `9573498149` once, verified SHA-256 `eec7e22eecbff39943303b4c2cc69633eff2fc180605cd5b3e3467f233f1034f`, and inspected its existing WebGL2 geometry evidence.
- Moved the seven browser BodyDNA presets to one shared immutable source for browser and Node integrity checks.
- Added explicit active BodyDNA fingerprint, source ID, and proportion revision provenance through `V4Adapter` and independent SimulationRig FK diagnostics.
- Changed Rig/Surface anchor auditing to compare the procedural regions with the active BodyDNA-fitted V4 Rig landmarks instead of primitive envelope endpoints.
- Preserved topologically necessary marching-tetrahedra faces while continuing to reject repeated-index triangles.
- Added `tests/human-core-v5-procedural-preset-integrity.mjs` with closed/manifold/finite gates and active-DNA Rig/Surface gates for Reference, Lean, Muscular, Heavy, Tall, Short, and Asymmetric.
- Reference through Short passed the new preset integrity assertions before the Asymmetric assertion stopped each run.

## Test runs

| Command | Runs | Result |
| --- | ---: | --- |
| `node tests/human-core-v5-procedural-surface.mjs` | 1 | pass |
| `node tests/human-core-v5-procedural-preset-integrity.mjs` | 2 | fail with the same signature |
| `node tests/human-core-v5-procedural-deform-validation.mjs` | 0 | not run after stop rule |
| Stage two tests | 0 | not started |
| Stage three tests | 0 | not started |
| Final procedural suite | 0 | not run |
| Full `npm test` | 0 | not run |
| WebGL2 browser QA | 0 | not run |
| WebGPU | 0 | prohibited and not run |

## Repeated error signature

Both preset integrity runs stopped with:

```text
AssertionError [ERR_ASSERTION]: Asymmetric surface must have one connected component.
2 !== 1
tests/human-core-v5-procedural-preset-integrity.mjs:36
```

The second attempt extended the central groin separator to the exterior below both knees so it could not remain a sealed internal cavity. The connected component count remained exactly `2`, disproving that isolated hypothesis.

## Remaining work

- Deterministically label the two Asymmetric components by vertex count, bounds, and primary region ownership before attempting another source change.
- Establish whether the second component is a detached extremity/helper envelope or another internal subtraction shell.
- Restore `connectedComponentCount = 1` without lowering any geometry threshold or averaging authored left/right BodyDNA scales.
- Re-run phase one from a new, evidence-driven direction before starting joint-surface or static-contact work.
- Stage two, stage three, final tests, WebGL2 evidence generation, and user visual review remain pending.

`visualAcceptance = false`

`productionReady = false`

Task 14C-2 is not authorized.
