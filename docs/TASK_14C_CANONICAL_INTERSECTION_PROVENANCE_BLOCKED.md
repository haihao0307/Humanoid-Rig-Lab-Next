# Task 14C-1A2a canonical intersection provenance blocked

## 1. Exact starting point

- Branch: `feature/human-core-v5-task14c-geometry-v1`
- Starting HEAD: `277622955c13e9ad52fb4a2ed29b211a35c1e859`
- Starting worktree: clean
- Starting all-refs bundle verify: passed
- Starting bundle SHA256: `5EE31404D66395DDECDF29420EB409B98B566B5620D66E06CA95C73BC85B75C2`

## 2. Diagnostic commit

`08e0aa2ded464bab9950b7910af6658f2f4847b3 test(v5): trace canonical intersection provenance`

Its single ordinary push attempt failed with exit code 1:

```text
fatal: unable to access 'https://github.com/haihao0307/Humanoid-Rig-Lab-Next.git/': Recv failure: Connection was reset
Pushing to https://github.com/haihao0307/Humanoid-Rig-Lab-Next.git
```

No retry was made.

## 3. First introduction stage

`fairing-projection`

## 4. Primary root cause

Zero-set projection moves previously separated Muscular surface triangles into penetrating configurations. Legacy raw extraction, topology filtering, compaction, initial orientation, lambda, and mu remain penetration-free. Projection uses per-vertex fixed initial gradient directions without a triangle-triangle separation constraint. The later half-space and unsafe-triangle passes reduce the new pairs but do not test or eliminate all real penetrations.

Secondary contributors are resolution sensitivity and incomplete cleanup by later fairing substages. Uniform tetrahedralization is not a repair, and the T-bind path is an exact identity.

## 5. Diagnostic matrix

| Case | Raw | Initial | Canonical | T | A |
| --- | ---: | ---: | ---: | ---: | ---: |
| A: Muscular r36 legacy, formal fairing | 0 | 0 | 104 | 104 | 118 |
| B: Muscular r36 uniform, formal fairing | 0 | 0 | 116 | 116 | 123 |
| C: Muscular r36 legacy, fairing disabled | 0 | 0 | 0 | 0 | 0 |
| D: Muscular r48 legacy, formal fairing | 0 | 0 | 16 | 16 | 22 |
| Reference r36 legacy control | 0 | 0 | 0 | 0 | 0 |

There was one preflight invocation that aborted before evidence generation when the diagnostics-only fairing-disabled output missed the production orientation mean gate. The production gate was not changed. After recording that diagnostics-only gate failure, exactly one complete diagnostic matrix was run.

## 6. Formal Muscular legacy per-stage penetrating counts

| Stage | Count |
| --- | ---: |
| polygonized-raw | 0 |
| topology-filtered | 0 |
| compacted | 0 |
| initial-oriented | 0 |
| fairing-iteration-1-lambda | 0 |
| fairing-iteration-1-mu | 0 |
| fairing-iteration-1-projected | 42 |
| fairing-iteration-1-halfspace | 29 |
| fairing-iteration-1-safe-repair | 4 |
| fairing-iteration-2-lambda | 4 |
| fairing-iteration-2-mu | 4 |
| fairing-iteration-2-projected | 142 |
| fairing-iteration-2-halfspace | 129 |
| fairing-iteration-2-safe-repair | 104 |
| final-oriented | 104 |
| canonical-final | 104 |
| t-pose-deformed | 104 |
| a-pose-deformed | 118 |

The projection substages add 42 and 138 pairs relative to their immediately preceding stages.

## 7. Representative triangle provenance

All nine final pairs are non-penetrating in the raw-source stage and first become penetrating at `fairing-iteration-2-projected`.

| Final pair | Left cube/tetra | Right cube/tetra | Shared relation |
| --- | --- | --- | --- |
| 80 / 2743 | 49,16,2 / 4 | 49,16,3 / 0 | face and edge |
| 80 / 2756 | 49,16,2 / 4 | 50,16,3 / 2 | edge |
| 80 / 2758 | 49,16,2 / 4 | 50,16,3 / 3 | none |
| 82 / 2755 | 49,16,2 / 5 | 50,16,3 / 1 | edge |
| 82 / 2756 | 49,16,2 / 5 | 50,16,3 / 2 | edge |
| 82 / 2757 | 49,16,2 / 5 | 50,16,3 / 2 | edge |
| 82 / 2758 | 49,16,2 / 5 | 50,16,3 / 3 | none |
| 83 / 2759 | 49,16,2 / 5 | 50,16,3 / 3 | none |
| 83 / 2760 | 49,16,2 / 5 | 50,16,3 / 4 | none |

Exact raw triangle indices, grid corner IDs and positions, field corner values, interpolated edges, source cell/tetrahedron bounds, and AABB/shared-source tests are recorded in `artifacts/qa/task14c-geometry-v1/canonical-intersection-provenance/muscular-stage-provenance.json`.

## 8. Scalar-field trace

Each representative pair records its six triangle vertices, segment endpoints and midpoint, triangle centroids, and local-bounds center. Each sample includes the composed field value and gradient, region primitive distances, deform-helper distances, subtraction distances, and the exact smooth-union/subtraction order with blend radii and intermediate values.

Every diagnostic final distance agreed with the formal `field.sample` value to less than `1e-10`. The raw surfaces for both tetrahedralization modes have zero penetrations; therefore the scalar field and extraction were rejected as the earliest failure source.

## 9. T-bind identity

- Maximum displacement: `0 m`
- RMS displacement: `0 m`
- Vertices above `1e-7 m`: `0`
- Vertices above `1e-5 m`: `0`

Canonical and T Pose counts are identical. `t-pose-runtime-introduced` is rejected.

## 10. Attempted unique repair

Only `canonical-surface-fairing-v5.js` was changed during the uncommitted experiment. The experiment:

1. Used the production penetrating-intersection classifier after each fairing substage.
2. Tracked only the six authorized pelvis/thigh/lower-torso Region Pairs.
3. Compared each substage against its preceding accepted target-pair set.
4. Restored only vertices of newly introduced target pairs to their previous-substage positions.
5. Expanded to a one-ring only on a repeated local repair pass.
6. Deleted no triangles, welded no vertices, changed no topology, changed no field/preset/detector thresholds, and did not disable fairing.

Both Muscular commands passed the target Region Pair, total-count upper-bound, and nine representative-pair assertions before reaching the final topology assertion. The experimental source change was then removed and was not committed because the required targeted run did not exit successfully.

## 11. Two identical raw failures

Targeted run 1:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== 1

    at file:///G:/Three.js/NEW/Humanoid-Rig-Lab-Next-human-core-v5-procedural-deform-visual-repair-v2/[eval1]:29:8
```

Targeted run 2:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== 1

    at file:///G:/Three.js/NEW/Humanoid-Rig-Lab-Next-human-core-v5-procedural-deform-visual-repair-v2/[eval1]:29:8
```

Both failures came from reading `connectedComponentCount` as a top-level property first from `runtime.surface` and then from the cloned surface metadata. That property is not exposed at either attempted path. Because the signature occurred twice, no third Muscular targeted run and no seven-preset regression were run.

## 12. Next minimum verifiable hypothesis

Before restoring the same fairing experiment in a new task, locate the actual topology object from the formal extractor result or call the already exported `analyzeSurfaceGeometryV5(runtime.surface.positions, runtime.surface.indices)` in the targeted harness. Make no repair-algorithm change. Run one Muscular targeted check with that corrected topology assertion and preserve the already passing target-pair assertions.

## 13. Push and recovery status

- Diagnostic push: transport-blocked after one attempt; not retried.
- Repair code: not committed.
- Blocked-document commit: to be recorded in the final report.
- Final all-refs bundle path, SHA256, and verify output: to be recorded in the final report.

`BODY_FIELD_GENERATOR_VERSION_V5` remains `canonical-anatomical-field-v5.5.0` because no formal surface-output change was retained. `BUILD_MANIFEST.json` was not changed. `visualAcceptance` remains `false`; `productionReady` remains `false`; `userVisualAcceptance` remains `pending`. Dynamic joint work remains frozen.
