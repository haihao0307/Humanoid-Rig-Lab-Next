# Human Core V5 Procedural Deform QA Report

## Scope and status

| Item | Result |
|---|---|
| Exact base | `28330a4d9e7d3bccb7cfe1cb36bfa86993b39090` |
| Branch | `feature/human-core-v5-procedural-deform-visual-qa` |
| Automatic contract | pass |
| Automatic geometry | pass |
| Full `npm test` | pass |
| Browser artifact gate | blocked as expected: evidence not generated |
| WebGPU browser | blocked-on-browser-runtime |
| Forced WebGL2 browser | blocked-on-browser-runtime |
| Codex visual review | not-run-by-user-rule |
| User visual acceptance | pending |
| `visualAcceptance` | `false` |
| `productionReady` | `false` |

Repository instructions state that computer/browser visual checks are user-operated. Therefore this implementation supplies the browser runner, deterministic evidence format, page diagnostics, and manual checklist without launching Chrome or Edge or claiming visual results.

## Fixture correction

The page's inline XYZ-axis `poseFixture()` was removed. The single fixture authority is:

```text
src/modules/human-core-v5/procedural-deform/procedural-deform-validation-poses-v5.js
```

Each authored channel records `jointId`, `anatomicalChannel`, `requestedAngleDegrees`, `sourceLocalAxis`, `resolvedLocalAxis`, and `resultQuaternion`. Source axes are exactly the existing HumanRigCore `twistAxisLocal`, `bendAxisLocal`, and `sideAxisLocal`. The canonical procedural surface has a T bind, so those existing axes are rebased to the current BodyDNA-fitted T-bind direction without introducing another axis schema.

Measured Node/FK results:

| Pose | Measurement |
|---|---:|
| T Pose left/right | 90.000° / 90.000° |
| Arm Raise 90 left | 90.000° |
| Arm Raise 150 left | 149.576° |
| Elbow Bend 140 left | 140.000° |
| Forearm Twist 180 left | 180.000° |

All fixed angle gates pass.

## Independent SimulationRig FK proof

`procedural-simulation-rig-fk-v5.js` builds the cyan QA skeleton from:

```text
finalPose
+ V4Adapter(T Pose RigDefinition)
→ independent forward kinematics
```

The FK construction does not read `ProceduralDeformFrame.regionDiagnostics`. The magenta procedural anchors are compared only after FK completion. Across all ten fixtures:

```text
maximum critical-anchor error = 0.0124753881 m
maximum per-pose mean error = 0.0046411178 m
fixed gates = 0.020 m maximum / 0.010 m mean
result = pass
```

## Automatic geometry and deformation gates

The existing release thresholds were not reduced:

- one connected component;
- zero boundary edges;
- zero non-finite vertices;
- zero out-of-range indices;
- degenerate triangle ratio below 0.1%;
- forearm twist radius retention at least 0.85;
- shoulder, elbow, hip, and knee regional volume ratios between 0.75 and 1.25;
- bind lengths and Rig topology remain immutable;
- local quaternions and resolved anatomical axes remain normalized.

Latest file-level run recorded 10,284 vertices / 20,568 triangles, 1.81% maximum symmetric paired-region dimension difference, 99.99% forearm-twist radius retention, 3.89 ms median CPU deformation, and 5.13 ms p95 CPU deformation. These timings are Node references, not browser renderer benchmarks.

The browser page reports these geometry facts, current renderer status, independent FK source, anchor source/errors, active BodyDNA/pose/camera/display, runtime errors, and GLB requests with stable `data-qa-*` selectors.

## Browser automation and evidence

Prepared commands:

```powershell
npm run test:human-core-v5-procedural-deform-browser
npm run test:human-core-v5-procedural-deform-qa
```

The runner starts `npm start`, looks for Google Chrome, Microsoft Edge, project Chromium, then Playwright Chromium, and drives the page through Chrome DevTools Protocol. It records WebGPU adapter/device/renderer results separately from WebGL2 fallback and launches a second `?forceWebGL=1` session with an explicit WebGL2 context.

Browser discovery, launch, button clicking, Canvas capture, and screenshot inspection were not executed by Codex because the repository instruction assigns computer-effect verification to the user. Consequently:

```text
console error count = not measured
page error count = not measured
network GLB request count = not measured in browser
WebGPU result = blocked
WebGL2 result = blocked
required PNG evidence = absent until user run
metrics.json = absent until user run
browser-qa-report.json = absent until user run
```

This is not a browser pass or a visual pass.

## Source-sync note

The mandatory fetch was attempted before implementation but the local repository reported pre-existing missing Git objects (`d3183073...` and `75a9721...`) and rejected the fetch because the remote did not resend all necessary objects. The exact task base commit, source branch ref, and clean isolated worktree were nevertheless available locally and matched `28330a4d...`. No main-branch worktree was modified.

## User acceptance steps

1. Run the browser command from the branch worktree.
2. If WebGPU is unavailable, retain its failed/blocked result; do not treat WebGL2 fallback as WebGPU success.
3. Inspect every generated PNG against the shoulder, elbow, forearm, hip, knee, foot, and BodyDNA checklist.
4. Open `Surface + Skeleton` and confirm cyan FK joints and magenta procedural anchors align.
5. Run the artifact verifier.
6. Report visual failures with the corresponding PNG and QA JSON record.

Task 15 is not authorized while browser evidence and user visual acceptance remain pending.
