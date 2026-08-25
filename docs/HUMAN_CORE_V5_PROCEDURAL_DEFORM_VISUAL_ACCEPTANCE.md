# Human Core V5 Procedural Deform Visual Acceptance

## Release gate

Current status: `blocked-on-browser-runtime`.

The code, shared anatomical-axis fixtures, independent SimulationRig FK audit, and geometric tests can be verified without a browser. Repository instructions reserve computer/browser visual checks for the user, so no Codex-generated screenshot or visual approval is claimed.

```text
implementationStatus = code-complete-browser-blocked
browserQA = blocked-on-browser-runtime
codexVisualReview = not-run-by-user-rule
userVisualAcceptance = pending
visualAcceptance = false
productionReady = false
```

## User commands

From this branch's repository root:

```powershell
npm install
npm run test:human-core-v5-procedural-deform
npm run test:human-core-v5-procedural-deform-browser
npm run test:human-core-v5-procedural-deform-qa
```

The browser test starts `npm start`, finds Chrome or Edge, attempts WebGPU, then starts an independent forced-WebGL2 run. Set `HRL_BROWSER_PATH` to an executable when automatic discovery cannot find the browser.

Manual URLs remain available:

```text
http://127.0.0.1:4173/human-core-v5-procedural-deform.html
http://127.0.0.1:4173/human-core-v5-procedural-deform.html?forceWebGL=1
```

## Automated browser checks

The browser runner checks HTTP status, loading completion, canvas dimensions, active renderer, Worker use, geometry topology, normal validity, local-quaternion authority, independent Rig/surface error gates, console/page errors, GLB requests, and every preset/pose/display/camera button. A WebGPU fallback is recorded as `WebGPU FAIL`; it is never counted as a WebGPU pass.

The right panel also exposes `Run Full QA`, `Capture Current View`, `Mark Pass`, `Mark Fail`, and `Export QA JSON`. A local pass mark does not modify the release flags.

## Visual quality checklist

- [ ] A Pose shoulders connect without a major hollow, spike, or torso tear.
- [ ] T Pose actual arm abduction is visually horizontal and both shoulder attachments are stable.
- [ ] Arm Raise 90/150 retains shoulder volume and does not detach the upper arm.
- [ ] Forearm Twist 180 retains forearm radius and rotates the palm coherently.
- [ ] Elbow Bend 140 remains connected without folding through itself.
- [ ] Hip Flex and Knee Bend retain continuous pelvis/leg and thigh/calf silhouettes.
- [ ] Squat is bilaterally coherent and both feet point consistently.
- [ ] Lunge preserves independent left/right drivers.
- [ ] Lean, Muscular, Heavy, Tall, Short, and Asymmetric change only the intended dimensions and regions.
- [ ] `Surface + Skeleton` shows cyan independent FK joints aligned with magenta procedural anchors.

## Required evidence

The runner writes real Canvas screenshots and JSON to:

```text
artifacts/qa/human-core-v5-procedural-deform/webgpu/
artifacts/qa/human-core-v5-procedural-deform/webgl2/
artifacts/qa/human-core-v5-procedural-deform/metrics.json
artifacts/qa/human-core-v5-procedural-deform/browser-qa-report.json
```

`npm run test:human-core-v5-procedural-deform-qa` verifies that all 15 required PNGs and both JSON files exist, that WebGPU and WebGL2 passed independently, and that release flags remain false.

## Acceptance result

Record failures without lowering geometric, angle, volume, symmetry, or Rig/surface thresholds. Do not edit screenshots. User approval is required before any later task changes `visualAcceptance`; `productionReady` remains false beyond this task.
