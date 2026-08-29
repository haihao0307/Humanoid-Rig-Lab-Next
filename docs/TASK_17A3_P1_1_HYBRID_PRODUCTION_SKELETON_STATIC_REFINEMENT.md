# Task 17A.3 P1.1 Hybrid Production Skeleton Static Refinement

## Result

`HYBRID_STATIC_SKELETON_REFINED_READY_FOR_USER_REVIEW`

This conclusion means the requested static refinements, deterministic generation, and measurable geometry checks are complete. It does not mark any visual gate passed and does not authorize production or P2 dynamic work.

## Isolation

- start commit: `28c12417b171f53de94dd2e41bd2febc411e6e60`
- branch: `experiment/human-core-v5-production-skeleton-p1-1-static-refine`
- worktree: `G:\Three.js\NEW\Humanoid-Rig-Lab-Next-production-skeleton-p1-1-static-refine`
- prior user result: `P1_VISUAL_PARTIAL_PASS`

The original P1 branch and commit remain unchanged. Task 17A.2, Task 15B, Task 16A, P0, and the old Production Skeleton V2 worktree remain outside this task's write scope.

## Refined modules

### Head

- cranium radii reduced by approximately 9%
- jaw width and depth narrowed
- gaze frame reduced and moved closer to the head surface
- gaze stem and arrow shortened to preserve direction without a probe-like silhouette

### Neck

- orange head/neck connector radius reduced from `0.033 m` to `0.024 m` (approximately 27%)
- neck-root ring reduced by approximately 28%
- both waisted neck links narrowed to expose the neck column and reduce upper-body congestion

### Thorax

- closed elliptical rings replaced by one upper and one lower front-facing arch
- central front geometry reduced to one sternum bridge
- four lightweight side-depth returns preserve depth in side and three-quarter views
- rear structure reduced to one back beam
- shoulder sockets enlarged slightly for clearer exposure

### Clavicles and scapulae

- clavicle paths were shortened and simplified around their actual shoulder endpoints
- clavicle tube radius reduced from `0.014 m` to `0.011 m`
- shoulder balls increased from `0.034 m` to `0.038 m`
- scapula plates reduced from `0.016 m` to `0.010 m` thickness and moved approximately `0.03 m` rearward

### Pelvis

- maximum iliac-wing half-width reduced from `0.205 m` to `0.188 m` (approximately 8.3%)
- wing outline changed from a flat-topped plate to a six-point crest profile
- straight crossbar replaced by an arched sacrum bridge
- acetabular/hip socket radius increased from `0.041 m` to `0.045 m`
- forward marker shortened and narrowed

### Hands — highest-priority refinement

- palm longitudinal half-size increased from `0.060 m` to `0.072 m` (20%)
- palm width increased from `0.040 m` to `0.050 m`
- wrist interface enlarged slightly
- thumb cone replaced by a separate wedge-shaped volume
- grasp center retained but reduced
- palm-normal stem and arrow reduced to remove the tool-head/probe appearance

### Feet

- heel block reduced in width, height, and depth
- sole plane narrowed and flattened
- arch rail reduced slightly
- forefoot and toe flattened and integrated through the same bone-color family
- forward marker shortened and narrowed

## Invariants

- Core joints: `20`, unchanged
- Core segments: `19`, unchanged
- maximum joint-center error: `0 m`
- maximum segment-length error: `0 m`
- HumanRigCore: unchanged
- `finalPose`: unchanged and disconnected
- joint axes: unchanged
- external asset boundary: unchanged
- project-owned geometry: `true`

## Refined static cache

- vertices: `1,863`
- triangles: `3,418`
- meshes/modules: `24`
- primitives: `56`
- materials: `6`
- GLB byte size: `130,492`
- GLB SHA-256: `ffef1a04df026f576c9b5af5867b1dbd585145578cde465998a0ef56e32fbdcd`

The GLB remains a static display cache only. It contains no animation, skin, controller, IK, deformation, interaction, or external URI.

## Regenerated evidence

The following review assets are regenerated from the refined fixed geometry:

- `artifacts/qa/task17a3-p1-hybrid-static/{front,side,back,three-quarter}.png`
- all nine requested close-up PNG files
- `artifacts/qa/task17a3-p1-hybrid-static/contact-sheet.png`
- `production-skeleton-p1-static-review.html`

The HTML remains a single self-contained file with 13 embedded SVG views and no JavaScript, `fetch`, server dependency, external asset, or browser-side geometry generation.

## Review state

All original 22 visual gates remain `pending_user_review`. The eight P1.1 focus gates are also explicitly recorded as `pending_user_review`:

1. palm plate and thumb side clarity
2. front thorax clarity
3. bilateral pelvis clarity
4. rear scapula clarity
5. forefoot and toe clarity
6. uncluttered front view
7. coordinated overall proportion
8. visual value for a future P2 dynamic-connection evaluation

No visual pass or production pass is declared by this task.
