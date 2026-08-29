# Task 17A.3 RESET P0 Production Rig Visual Direction

## Result

`VISUAL_DIRECTION_READY_FOR_USER_SELECTION`

Three static, directly openable visual prototype directions have been generated from one frozen HumanRigCore Reference T input. This task stops at comparison evidence; it does not choose a final direction and does not claim user visual acceptance.

## Isolation

- start commit: `e342f0a3eed8d0c185c46814e663c497b0b8d47a`
- isolated worktree: `G:\Three.js\NEW\Humanoid-Rig-Lab-Next-production-rig-visual-direction-p0`
- branch: `experiment/human-core-v5-production-rig-visual-direction-p0`
- protected existing V2 worktree: `G:\Three.js\NEW\Humanoid-Rig-Lab-Next-production-rig-detail-v1`
- protected Task 17A.2 worktree: `G:\Three.js\NEW\Humanoid-Rig-Lab-Next-human-core-v5-procedural-deform-visual-repair-v2`

The implementation is confined to the isolated P0 worktree. It does not repair, clean, reset, or extend either protected worktree.

## Candidate set

### A — Technical Octahedral Rig (`OCTA_TECH`)

Exact-length octahedral Core segments, hierarchy-sensitive thickness, roll-readable sections, simple pelvis/chest/head frames, palm plates, and foot plates. Intended for clear technical inspection and high NPC counts.

### B — Hybrid Production Rig (`HYBRID_PRODUCTION`)

Waisted long bones, dual forearm/lower-leg rails, open thorax, bilateral pelvis bridge, clavicle arcs, scapula plates, skull proxy, palm plates, and structured feet. Intended for human-readable production motion observation.

### C — Animation Control Studio Rig (`CONTROL_STUDIO`)

Light wire Core bones with a visually separate ground ring, pelvis box, chest ring, head cube, hand squares, foot outlines, pole diamonds, and gaze target. Intended only as a static proposal for future animator-facing controls.

## Frozen input contract

`rig-prototype-data.js` contains a literal snapshot of the baseline Reference T state: 20 Core joint positions, 19 parent-child segments, source parents, identity quaternions, body height, and fingerprint. The prototype package does not import a runtime pose provider and explicitly records:

- `staticSnapshot: true`
- `connectsRuntimeFinalPose: false`
- `modifiesHumanRigCore: false`
- `modifiesFinalPose: false`

All candidates share the same four orthographic cameras, canvas, world center, meter ranges, background, ground grid, edge colors, and stroke baseline.

## Source implementation

- `scripts/task17a3-p0-generate-rig-visual-prototypes.mjs`
- `src/modules/human-core-v5/production-rig-visual-prototypes-p0/rig-prototype-data.js`
- `src/modules/human-core-v5/production-rig-visual-prototypes-p0/octa-tech-prototype.js`
- `src/modules/human-core-v5/production-rig-visual-prototypes-p0/hybrid-production-prototype.js`
- `src/modules/human-core-v5/production-rig-visual-prototypes-p0/control-studio-prototype.js`
- `src/modules/human-core-v5/production-rig-visual-prototypes-p0/svg-projection-renderer.js`
- `src/modules/human-core-v5/production-rig-visual-prototypes-p0/index.js`

The generator includes a small deterministic RGBA rasterizer and PNG encoder so the contact-sheet PNG is produced without a browser, graphics application, external binary, or third-party package.

## Generated evidence

Root: `artifacts/qa/task17a3-p0-rig-visual-direction/`

- `contact-sheet.svg`
- `contact-sheet.png`
- `reference-distillation.json`
- `visual-comparison.json`
- `generation-manifest.json`
- `candidate-a/{front,side,back,three-quarter}.svg`
- `candidate-b/{front,side,back,three-quarter}.svg`
- `candidate-c/{front,side,back,three-quarter}.svg`
- each candidate also includes `shoulder-closeup.svg`, `pelvis-closeup.svg`, and `hand-foot-closeup.svg`

The contact sheet arranges candidate A/B/C as columns and front/side/back/three-quarter as rows. Its bottom panels state each direction's goal, strengths, weaknesses, estimated cost, suitable contexts, and unsuitable contexts.

## Comparison policy

`visual-comparison.json` contains exactly 20 design observations. Every `value` is one of:

- `candidate-a`
- `candidate-b`
- `candidate-c`
- `equal`
- `all-weak`
- `user-decision-required`

The file deliberately ends the final-direction comparison with `user-decision-required`.

## Explicit non-goals

No runtime page, server dependency, Three.js dependency, `node_modules` dependency, dynamic `finalPose` connection, Control Rig functionality, IK solver, Performance Deform, Interaction Anchors, labels, inspector, limits, motion player, skin, weights, or existing V2 repair is included.

## Reproduction and file-only validation

Generate the artifacts with:

```text
node scripts/task17a3-p0-generate-rig-visual-prototypes.mjs
```

The validation for this task is intentionally file-only: syntax checks, deterministic regeneration, required-path counts, SVG/XML structure checks, PNG signature/dimension checks, JSON schema/value checks, forbidden dependency scans, Git boundary checks, and protected-worktree status-hash comparison. Visual judgement is reserved for the user opening the contact sheet.

## User selection checkpoint

The next step is for the user to open `artifacts/qa/task17a3-p0-rig-visual-direction/contact-sheet.svg` or `.png`, compare A/B/C, and explicitly select a direction or request a focused revision. No implementation beyond this P0 comparison should infer that choice.
