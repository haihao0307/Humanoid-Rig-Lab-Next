# Task 14C-1B Stage 2 joint-surface blocker

## 1. Revision state

- Exact starting branch: `feature/human-core-v5-task14c-geometry-v1`
- Exact starting HEAD: `649ab9493918546bbe938dc2b80021a00c2ccfc0`
- Last clean committed HEAD when this report was authored: `7ea4af4d91cb7dec4c9e8cd8a4d649837e1eff3b`
- Completed diagnostic commit: `7ea4af4d91cb7dec4c9e8cd8a4d649837e1eff3b` (`test(v5): add anatomical joint surface quality gates`)
- The blocking-report commit hash is recorded in the final handoff because a commit cannot contain its own hash.
- `649ab94` and all of its ancestors remain intact. No reset, rebase, amend, squash, merge, or force push was used.

The unsuccessful deform experiment was discarded before this report was committed. The branch therefore retains the Stage 1 production surface and the diagnostic commit, rather than shipping a known regression.

## 2. Evidence files

- Baseline metrics: `artifacts/qa/task14c-geometry-v1/stage2/joint-surface-baseline-649ab94.json`
- Failed experimental metrics: `artifacts/qa/task14c-geometry-v1/stage2/joint-surface-metrics.json`
- Baseline result: 273/350 passed, 77 failed.
- Experimental result: 241/350 passed, 109 failed.
- Every local measurement selected at least 40 vertices using `regionIds`, `regionBlendWeights`, and `regionAxialU`.
- Measurements use `canonicalLayout.rigLandmarks`, HumanRigCore `axisReference`, and `finalPose.localRotations` in local anatomical frames.

## 3. Baseline and experimental metrics

Ranges below are the minimum and maximum posed values across the required preset/pose/side matrix. `failed` is the number outside its fixed gate.

### Shoulder

| Metric | Baseline range; failed | Experimental range; failed | Gate |
| --- | --- | --- | --- |
| Axillary notch depth | 0.036621–0.066752 m; 2/5 | 0.064704–0.081156 m; 5/5 | notch/radius <= 0.55 and final <= 70% baseline |
| Shoulder bridge thickness | 0.086298–0.117274 m; 0/5 | 0.086298–0.100072 m; 0/5 | thickness/diameter >= 0.35 |
| Deltoid volume ratio | 0.945556–1.007512; 0/5 | 0.943971–0.970090; 0/5 | 0.80–1.25 |
| Normal P95 | baseline failures included in global normal row | 24.580218–70.224675 degrees; 0/19 globally | shoulder <= 75 degrees |

The attempted radial fill deepened the measured notch instead of filling the axillary sector.

### Forearm twist

| Metric family | Baseline range; failed | Experimental range; failed | Gate |
| --- | --- | --- | --- |
| RMS radius ratio, seven stations | 0.838538–1.044768; 3/28 | 1.001017–1.349885; 0 below minimum, but excessive expansion | >= 0.90 |
| Minimum radius ratio | 0.469142–2.490251; 7/28 | 0.551319–3.867096; 6/28 | >= 0.88 |
| Maximum radius ratio | 0.830998–1.060700; 0/28 | 0.995231–1.684186; 16/28 | <= 1.15 |
| Area ratio | 0.851618–1.277168; 1/28 | 1.002903–2.397939; 17/28 | 0.78–1.22 |
| Adjacent twist delta | 0.044639–19.705988 degrees; 0/24 | 2.391328–45.429496 degrees; 0/24 | <= 55 degrees |
| Radius coefficient of variation | 0.174573–0.203528; 0/4 | 0.093010–0.148169; 0/4 | <= 0.24 |

The C1 curve was monotonic, but directly using the unrebased semantic twist axis over-rotated cross-sections in the canonical T-bind frame.

### Elbow

| Metric | Baseline range; failed | Experimental range; failed | Gate |
| --- | --- | --- | --- |
| Inner compression ratio | 0.931407–1.105506; 4/4 | 0.965787–1.051012; 4/4 | 0.40–0.82 |
| Outer arc retention | 0.849474–1.026327; 1/4 | 1.005173–1.070527; 0/4 | >= 0.88 |
| Minimum thickness ratio | 0.897343–1.346003; 0/4 | 1.034273–1.600195; 0/4 | >= 0.40 |
| Volume ratio | 0.789619–0.976974; 0/4 | 0.988348–1.126427; 0/4 | 0.75–1.25 |

The attempted inner-sector compression selected the wrong signed radial sector for part of the mirrored/local-axis matrix.

### Hip

| Metric | Baseline range; failed | Experimental range; failed | Gate |
| --- | --- | --- | --- |
| Groin separation | 0.019080–0.035415 m; 1/5 | 0.008972–0.039926 m; 4/5 | >= 0.006 m and separation/radius >= 0.10 |
| Hip bridge thickness ratio | 0.266327–0.334742; 5/5 | 0.284557–0.333652; 5/5 | >= 0.40 |
| Volume ratio | 1.004108–1.047809; 0/5 | 1.019682–1.036938; 0/5 | 0.75–1.25 |

The normalized bridge fill did not reach the required medial sector and reduced separation in four scenarios.

### Knee

| Metric | Baseline range; failed | Experimental range; failed | Gate |
| --- | --- | --- | --- |
| Inner compression ratio | 0.885914–0.923170; 5/5 | 0.881180–1.026338; 5/5 | 0.35–0.82 |
| Anterior retention | 0.999415–1.087487; 0/5 | 0.952619–1.015877; 0/5 | >= 0.88 |
| Minimum thickness ratio | 0.382687–0.468173; 3/5 | 0.368642–0.423311; 4/5 | >= 0.40 |
| Volume ratio | 0.825757–0.887056; 0/5 | 0.816373–0.885252; 0/5 | 0.75–1.25 |

The same signed-sector assumption used at the elbow did not produce the required posterior knee compression.

### Global hard gates

| Metric | Baseline range; failed | Experimental range; failed | Gate |
| --- | --- | --- | --- |
| Triangle flips | 0; 0/25 | 0–2; 1/25 | 0 |
| Local foldovers | 0–7; 5/25 | 0–10; 7/25 | 0 |
| Critical self-intersections | 0–192; 19/25 | 1–126; 25/25 | 0 |
| Minimum triangle-area ratio | 0.065925–1.0; 5/25 | 0.036468–1.0; 6/25 | >= 0.15 |
| Maximum triangle-area ratio | 1.0–8.801309; 2/25 | 1.0–5.480782; 0/25 | <= 6.0 |
| Normal-deviation P95 | 55.223356–149.286710 degrees; 14/19 | 24.580218–70.224675 degrees; 0/19 | shoulder <= 75; others <= 80 |

## 4. Failed triangles and vertex regions

- The baseline Muscular canonical surface reported 102 critical pairs before pose deformation.
- Representative exact pairs from the deterministic detector were triangles `80/2743`, `80/2756`, `80/2758`, `82/2755`, `82/2756`, `82/2757`, and `82/2758`; these were classified `pelvis/pelvis`.
- Pairs `83/2759` and `83/2760` were classified `pelvis/leftThigh`.
- The experimental matrix introduced or retained failures in shoulder/upper-torso and upper-arm blend vertices, forearm stations U=0.10–0.85, elbow upper-arm/forearm blend vertices, pelvis/thigh bridge vertices, and thigh/calf knee blend vertices.
- Exact selected vertex counts, local frames, neutral/posed values, ratios, thresholds, and pass flags are retained in the two JSON evidence files.

## 5. Screenshots

Before WebGL2 evidence:

- `artifacts/qa/task14c-geometry-v1/stage2/before-649ab94/shoulder-150-front.png`
- `artifacts/qa/task14c-geometry-v1/stage2/before-649ab94/shoulder-150-closeup.png`
- `artifacts/qa/task14c-geometry-v1/stage2/before-649ab94/forearm-twist-closeup.png`
- `artifacts/qa/task14c-geometry-v1/stage2/before-649ab94/elbow-bend-closeup.png`
- `artifacts/qa/task14c-geometry-v1/stage2/before-649ab94/hip-flex-closeup.png`
- `artifacts/qa/task14c-geometry-v1/stage2/before-649ab94/knee-bend-closeup.png`

After screenshots were intentionally not captured. Numeric hard gates failed on the second permitted diagnostic run, so visual acceptance and the contact sheet were not allowed to proceed.

The clean baseline browser session reported forced WebGL2, runtime errors 0, GLB requests 0, geometry present, `visualAcceptance=false`, and `productionReady=false`.

## 6. Single attempted repair direction

One coordinated direction was attempted:

1. decompose forearm `localQ` using a HumanRigCore semantic twist axis and distribute twist with a monotonic C1 smoothstep;
2. add deform-only shoulder, elbow, hip, and knee fields with local frames derived from `axisReference` and canonical primitives;
3. replace the fixed hip world ranges with normalized landmark/radius envelopes;
4. widen and smooth the canonical groin separator; and
5. correct the test-only mirrored quaternion and compare rebuilt normals with the runtime's prepared expected normals.

The direction reduced normal-angle and maximum-area failures, but it regressed the total result from 77 to 109 failures, expanded forearm sections beyond their maximum/area gates, failed all shoulder baseline-improvement gates, and left every experimental scenario with at least one critical self-intersection.

## 7. Why work stopped and next hypothesis

The task permits at most two diagnostic `--assert` runs. Both were consumed: the first exposed a stale runtime diagnostic field after the field-frame refactor; the second completed the full matrix and failed 109 gates. No third run, parameter sweep, browser After pass, WebGPU work, or Stage 3 work was performed.

The next minimum independently verifiable hypothesis is: rebase `axisReference.twistAxisLocal` into the canonical T-bind joint-local frame with the same alignment quaternion used by the validation-pose compiler, change only the forearm twist path, and validate Reference plus Asymmetric left/right seven-station sections before adding any shoulder/hinge/hip corrective.

## 8. Raw test errors

Diagnostic `--assert` run 1/2:

```text
TypeError: Cannot read properties of undefined (reading 'map')
at ProceduralDeformRuntimeV5.update (.../procedural-deform-runtime-v5.js:141:59)
activeHipFields: jointCorrectiveFrame.hipFields.map((field) => ({ ...field }))
```

Diagnostic `--assert` run 2/2:

```text
{"measurementCount":350,"passedCount":241,"failedCount":109,"allPassed":false}
AssertionError [ERR_ASSERTION]: 109 anatomical joint-surface measurements failed; see artifacts/qa/task14c-geometry-v1/stage2/joint-surface-metrics.json
false !== true
```

The joint-quality, self-intersection, deform-stress, preset-integrity, and deform-validation tests were not run because the required diagnostic gate had already failed. `npm test`, the full suite, browser full QA, WebGPU, all-backends QA, and GitHub Actions were not run.

## 9. Push and recovery status

- The required initial push of `649ab94` was attempted once and failed with `Recv failure: Connection was reset`; it was not retried.
- The diagnostic commit push succeeded once: remote branch advanced from `0f897ee` to `7ea4af4`.
- The blocking-report commit receives one ordinary push attempt. If that push fails, the final handoff records the verified bundle path and SHA256.
- Stage 2 is not complete. `visualAcceptance` remains false, `productionReady` remains false, and Task 14C-1 Stage 3 is not authorized.
