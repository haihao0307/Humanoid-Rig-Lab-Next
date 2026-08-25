# Human Core V5 Procedural Deform Visual Acceptance

## Release gate

Current status: `automated-contract-ready`; GitHub Actions measurement and user visual acceptance are separate gates.

The code, shared anatomical-axis fixtures, independent SimulationRig FK audit, and geometric tests can be verified without a browser. Repository instructions reserve computer/browser visual checks for the user, so no Codex-generated screenshot or visual approval is claimed.

```text
implementationStatus = complete
browserAutomation = complete
ciBrowserContract = pass
ciWebGL2 = pass
ciWebGPU = webgpu-ci-fail
localBrowserPackage = ready
codexVisualReview = not-run-by-user-rule
userVisualAcceptance = pending
visualAcceptance = false
productionReady = false
```

## User commands

From this branch's repository root:

```powershell
npm ci
npm run test:human-core-v5-procedural-deform
npm run test:human-core-v5-procedural-deform-browser -- --all-backends --headed --continue-on-webgpu-failure
npm run test:human-core-v5-procedural-deform-qa
```

The recommended Windows entry is `RUN_HUMAN_CORE_V5_VISUAL_QA.bat`. It checks Node/npm, installs missing pinned dependencies, discovers Chrome/Edge/Playwright Chromium, captures both backends, verifies evidence, opens the offline gallery, and optionally leaves a hidden local server available for manual review. The PowerShell entry supports `-SkipInstall`, `-BrowserChannel`, `-Headed`, `-OutputDirectory`, and `-KeepServer`.

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

The runner writes real Canvas screenshots, JSON, and the offline review package to:

```text
artifacts/qa/human-core-v5-procedural-deform/webgpu/
artifacts/qa/human-core-v5-procedural-deform/webgl2/
artifacts/qa/human-core-v5-procedural-deform/metrics.json
artifacts/qa/human-core-v5-procedural-deform/browser-qa-report.json
artifacts/qa/human-core-v5-procedural-deform/renderer-diagnostics.json
artifacts/qa/human-core-v5-procedural-deform/qa-manifest.json
artifacts/qa/human-core-v5-procedural-deform/visual-review-gallery.html
artifacts/logs/procedural-deform-browser-qa/console.log
artifacts/logs/procedural-deform-browser-qa/network.log
```

`npm run test:human-core-v5-procedural-deform-qa` verifies file sizes, SHA256 hashes, commit identity, screenshot backend/path/pose identity, the strict WebGL2 pass, the recorded WebGPU classification, and unchanged release flags. The gallery exports `user-visual-review.json`; it cannot modify repository flags.

## Acceptance result

Record failures without lowering geometric, angle, volume, symmetry, or Rig/surface thresholds. Do not edit screenshots. User approval is required before any later task changes `visualAcceptance`; `productionReady` remains false beyond this task.
