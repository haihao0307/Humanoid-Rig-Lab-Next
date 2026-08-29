# Task 17A.3 P1 Hybrid Production Skeleton Static Asset

## Result

`HYBRID_STATIC_SKELETON_READY_FOR_USER_REVIEW`

Candidate B (`HYBRID_PRODUCTION`) is implemented as the project-owned `HRL Hybrid Production Skeleton Static V1`. This status means the deterministic files and measurable geometry gates are ready; it does not mean that the user has visually approved the result for production.

Candidate A remains a future Lite Mode reference. Candidate C remains a future Control Overlay reference. Neither is implemented in P1.

## Isolation

- P0 start commit: `c81a458d8526c6df9129b0c201abd46db1fccdda`
- P0 parent commit: `e342f0a3eed8d0c185c46814e663c497b0b8d47a`
- P1 worktree: `G:\Three.js\NEW\Humanoid-Rig-Lab-Next-production-skeleton-p1-hybrid-static`
- P1 branch: `experiment/human-core-v5-production-skeleton-p1-hybrid-static`

P0 history is unchanged. This task does not modify the Task 17A.2, Task 15B, Task 16A, or old Production Skeleton V2 implementations.

## Authority model

The frozen HumanRigCore Reference T input remains authoritative for 20 joint centers and 19 segment lengths. P1 changes display geometry only.

The checked-in authority files are:

- `assets/human/production-skeleton-v2/hybrid-static-v1/skeleton-source.json`
- `assets/human/production-skeleton-v2/hybrid-static-v1/module-profile.json`
- `assets/human/production-skeleton-v2/hybrid-static-v1/material-profile.json`
- `assets/human/production-skeleton-v2/hybrid-static-v1/asset-receipt.json`

`hybrid-production-skeleton-static-v1.glb` is an embedded, deterministic glTF 2.0 display cache. It is not HumanRigCore, does not own the Reference T pose, does not bind to dynamic `finalPose`, and contains no animation, skin, inverse bind matrices, controller, IK, or interaction behavior.

## Modules

The asset contains 24 unique modules:

- head, neck, thorax, pelvis
- leftClavicle, rightClavicle, leftScapula, rightScapula
- leftUpperArm, rightUpperArm
- leftForearmRadius, leftForearmUlna, rightForearmRadius, rightForearmUlna
- leftHand, rightHand
- leftThigh, rightThigh
- leftTibia, leftFibula, rightTibia, rightFibula
- leftFoot, rightFoot

The modules collectively include the requested cranium, jaw, gaze frame, thorax rings and beams, iliac wings, sacrum bridge, sockets, clavicle arcs, scapula plates, waisted long bones, dual rails, palm structures, and detailed feet.

## Fixed geometry and GLB cache

The static source contains fixed vertex arrays, fixed normal arrays, and fixed triangle-index arrays. The offline generator creates the source JSON and serializes the exact data into GLB during development; the review page performs no generation.

Current deterministic GLB measurements are recorded in `asset-receipt.json`:

- vertices: 1,948
- triangles: 3,608
- meshes/modules: 24
- primitives: 55
- materials: 6
- external URIs: 0

The GLB SHA-256 and byte size are recorded only after the complete binary is encoded.

## Static evidence

Directory: `artifacts/qa/task17a3-p1-hybrid-static/`

- full-body SVG: `front.svg`, `side.svg`, `back.svg`, `three-quarter.svg`
- full-body PNG: `front.png`, `side.png`, `back.png`, `three-quarter.png`
- close-ups: `head-neck-closeup.png`, `thorax-closeup.png`, `pelvis-closeup.png`, `shoulder-front-closeup.png`, `scapula-back-closeup.png`, `forearm-closeup.png`, `hand-closeup.png`, `lower-leg-closeup.png`, `foot-side-closeup.png`
- combined evidence: `contact-sheet.png`
- machine-readable checks: `geometry-gate.json`, `visual-review-status.json`, `generation-manifest.json`

The root `production-skeleton-p1-static-review.html` is one file containing four full views and nine close-up SVGs. It has no JavaScript, `fetch`, server dependency, `node_modules` dependency, external URL, or runtime geometry generation.

## Geometry gate

Measured automatically from the fixed source:

- maximum joint-center error: `0 m` (required `<= 1e-7 m`)
- maximum segment-length error: `0 m` (required `<= 1e-8 m`)
- non-finite vertices: `0`
- non-finite normals: `0`
- degenerate triangles: `0`
- duplicate triangles: `0`
- module IDs unique: `true`

Disconnected display modules are explicitly allowed.

## Visual gate

All 22 requested visual observations are stored as `pending_user_review`. Codex has not marked any visual item passed or failed. The user must review the static HTML or contact sheet and provide acceptance or requested revisions.

## Excluded scope

P1 includes no dynamic `finalPose`, animation, salute, jump, IK, Control Rig, Performance Deform, Interaction Rig, joint-limit display, inspector, complex Three.js page, browser-side mesh construction, skin modification, HumanRigCore modification, bone-length modification, joint-axis modification, full npm test, WebGPU run, or CI run.

## Reproduction

```text
node scripts/task17a3-p1-generate-hybrid-static-asset.mjs
```

Validation is file-only: syntax, deterministic hashes, JSON contracts, GLB header/chunks/accessors, geometry metrics, PNG signatures and dimensions, SVG/XML structure, self-contained HTML scanning, required file inventory, and Git boundary checks.
