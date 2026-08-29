# Task 17A.3 P0 Production Rig Visual Reference Study

## Purpose and research boundary

This study resets the visual direction of the Production Skeleton without extending the existing V2 page. It distils principles from English-language official documentation and the repository's own architecture documents. It does not copy geometry, source code, UI layouts, icons, example rigs, external models, textures, fonts, or other assets.

Research was completed before prototype code was authored. The machine-readable record is `artifacts/qa/task17a3-p0-rig-visual-direction/reference-distillation.json`; every source entry explicitly records `geometryCopied: false`, `sourceCodeCopied: false`, and `externalAssetUsed: false`.

## Official references and distilled principles

### Blender Foundation

- [Armature Viewport Display](https://docs.blender.org/manual/en/latest/animation/armatures/properties/display.html): Octahedral display communicates root, tip, relative size, and roll through a compact square-section volume. Candidate A adopts only that general information-design principle using original vertices and faces.
- [Bone Custom Shapes](https://docs.blender.org/manual/en/latest/animation/armatures/bones/properties/display.html): animator-facing shapes can be visually separate from skeletal bones. Candidate C applies this as a separate magenta control vocabulary.
- [Rigify Meta-Rigs](https://docs.blender.org/manual/en/latest/addons/rigging/rigify/metarigs.html): a simple structural description can express rig intent before a generated rig exists. Candidate C remains a non-functional static proposal; no Rigify generation or algorithm is reproduced.

### Epic Games

- [Controls, Bones, and Nulls](https://dev.epicgames.com/documentation/en-us/unreal-engine/controls-bones-and-nulls-in-control-rig-in-unreal-engine): hierarchy elements benefit from distinct visual responsibilities. Candidate C separates bones, region controls, pole hints, and gaze intent.
- [Modular Control Rigs](https://dev.epicgames.com/documentation/en-us/unreal-engine/modular-control-rigs-in-unreal-engine): modular rigs expose connection regions through connectors and sockets. The study adopts region legibility only; it does not add functional connectors, sockets, modules, or Control Rig logic.
- [Full Body IK](https://dev.epicgames.com/documentation/en-us/unreal-engine/control-rig-full-body-ik-in-unreal-engine): effectors and pole intent should be distinguishable from skeletal links. Candidate C represents them as static squares, outlines, and diamonds. No solver or constraints are implemented.

### Unity Technologies

- [Configuring the Avatar](https://docs.unity3d.com/Manual/ConfiguringtheAvatar.html): a humanoid overview succeeds when required body regions and bone mapping are recognizable. All candidates retain the same 20 Core joints; Candidate B adds region legibility without creating a second skeleton definition.

### VRM Consortium

- [VRM 1.0 Humanoid](https://vrm.dev/en/vrm1/humanoid/): interoperability begins with stable humanoid roles and hierarchy. The prototypes preserve project joint IDs, parents, segment endpoints, and lengths. They do not import VRM schemas, samples, or models.

### Khronos Group

- [OpenXR hand joint semantics](https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrHandJointEXT.html): hand-tracking vocabularies distinguish wrist/palm and directional digit chains. Candidate B uses an original palm plate and four lightweight direction rails, without claiming a full tracked-hand skeleton.

## Internal project references

- `HUMANOID_RIG_LAB_NEXT_MASTER_CONTEXT.md`: the shared HumanRigCore hierarchy, fixed IDs/parents, length invariants, quaternion pose authority, and prohibition on using bone scale as pose data remain authoritative. This P0 consumes a frozen Reference T snapshot only and never binds to `finalPose`.
- `docs/PROJECT_SPEC_FULL.md`: the same humanoid foundation must remain usable across authoring, animation, and future multi-human/world contexts without divergent structure. The study therefore compares observation-first, crowd-first, and editor-first display directions on one input.
- `docs/PERFORMANCE_RIG_ARCHITECTURE.md`: Core, production display, and performance concerns remain separate. P0 records possible suitability but does not implement a Performance Deform layer.
- `docs/TASK_17A3_HUMAN_PRODUCTION_RIG_DETAIL_FOUNDATION.md`: retained only as prior context. This reset deliberately does not repair or extend its V2 runtime page.

The repository does not contain a separately titled “World Human System Direction” document at the reset baseline. The relevant shared-human and multi-context direction was therefore taken from the master context and full project specification rather than inventing a missing source.

## Adopted cross-source rules

1. A bone display must reveal endpoints, hierarchy, and orientation with low ambiguity.
2. Anatomical observation geometry and animator controls are different visual languages.
3. Stable humanoid roles and parent relationships outrank display-specific ornament.
4. Palm, foot, pelvis, thorax, and shoulder regions deserve explicit visual treatment when motion observation is the goal.
5. IK, poles, gaze, sockets, connectors, and controls must never be implied as functional when they are only static visual proposals.
6. External reference imagery informs principles only; every shipped vertex, curve, shape, projector, rasterizer, and SVG is authored in this repository.

## Candidate translation

### Candidate A — `OCTA_TECH`

Original square-section octahedra span the exact start and end of all 19 Core segments. Parent regions use broader bodies and distal children use narrower bodies. Warm cross-section marks expose roll. Simple pelvis, chest, head, palm, and foot frames preserve a highly technical, low-cost silhouette. It intentionally excludes visible labels, animator widgets, and interaction anchors.

### Candidate B — `HYBRID_PRODUCTION`

Original waisted low-poly upper-arm and thigh volumes, paired forearm/lower-leg rails, open thorax bands, a bilateral pelvis bridge, clavicle arcs, scapula plates, a skull proxy, palm plates, and heel/arch/forefoot/toe cues emphasize human motion observation. It is still a static display layer and contains no controls, labels, or anchors.

### Candidate C — `CONTROL_STUDIO`

Lightweight wire octahedra preserve the Core skeleton while a distinct magenta language proposes a ground ring, pelvis box, chest ring, head cube, hand squares, foot outlines, elbow/knee pole diamonds, and gaze target. These are display-only shapes; no IK, solver, selection, keyframing, or runtime control behavior exists.

## Common-input and projection controls

Every candidate is generated from the exact same frozen source:

- baseline commit: `e342f0a3eed8d0c185c46814e663c497b0b8d47a`
- Core rig fingerprint: `fnv1a-8f257f74`
- pose: `reference-t`
- height: `1.795672 m`
- joints: `20`
- segments: `19`
- canvas: `900 × 1100`
- orthographic range: `1.82 m × 2.04 m`
- world center: `[0, 0.92, 0]`
- views: front, side, back, and three-quarter
- common background, grid, lighting-by-face-shading, edge policy, and baseline stroke

The renderer is an authored deterministic 3D-to-2D orthographic projector. Static SVG files contain their shapes and metadata directly. They require no server, module loader, Three.js, `node_modules`, network request, or asynchronous loading state.

## Rejected scope

This P0 does not implement or modify runtime pages, `finalPose`, HumanRigCore, mode switching, inspectors, labels, joint limits, skinning, weights, Performance Deform, Interaction Anchors, Control Rig behavior, IK, motion playback, salute/jump/carry clips, timeline editing, or multi-human runtime systems.

## Selection policy

The contact sheet and `visual-comparison.json` are design evidence. They may state which candidate is stronger for a narrowly defined observation, but they do not select or accept a final direction. The final visual direction remains a user decision.
