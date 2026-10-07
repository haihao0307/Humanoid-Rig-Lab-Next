# Fibric-class open reconstruction route

Date: 2026-10-07
Mode: `REPLICATION_LOCKED`
Status: method route locked; cinematic reproduction and public workbench remain incomplete.

## Correction to the previous blocker

The missing proprietary Fibric core HDA blocks an exact native recook of the official sample. It does **not** block an independent, source-understood reconstruction of the same class of curve-driven textile system.

The rejected RayWaveFabric R01 is not an accepted parent. The next candidate must be based on explicit yarn geometry, fiber-aware shading and a verified multiscale runtime, not a colored plane or a generic weave shader.

## Four teachers with separate responsibilities

### 1. Fibric official examples and documentation — target/acceptance teacher

Use the legally acquired official course examples, documented node semantics and original curve caches to define the target. Do not redistribute the proprietary examples or claim that their empty fallback definitions contain the generator implementation.

Locked first target:

- `pattern_examples.hip`
- geometry output `/obj/Pattern_examples/OUT_herringbone`
- material `/stage/herringbone_MAT/herringbone/kma_hair1`
- teacher input `geo/cloth/clothPiece.usdc`
- teacher pattern reference `$FIBRIC_LIBRARY/patterns/weave/basic/herringbone_12x12.exr`

The documentation already exposes enough independent behavioral requirements to build a clean implementation: weave diagrams define warp/weft interlacement; real-life scale is specified in centimeters; yarn width, over/under offsets, curve subdivision, Jacquard replacement/multiply, multifiber, fuzz, damage, meshing and UV wrapping are separate stages.

### 2. LYNX Fabric — transparent procedural-geometry teacher

Pinned upstream: `LucaScheller/VFX-LYNX@b03e706b8062c795189990fdf09d67c146182f54`.

LYNX Fabric is an unpacked Houdini HDA collection whose source tree exposes pattern, thread, weave, resample, detangle, conversion and color assets. Its documented production features include adaptive curve resampling, curve detangling, rest-frame mesh generation, attribute transfer, stable seeds and UDIM support.

License: LGPL-3.0. The final project should not silently copy its node/VEX implementation into a differently licensed standalone product. Default route: treat LYNX as an algorithmic teacher and independently implement the observed contracts. If any source is directly reused, preserve LGPL attribution and satisfy the license obligations after a project-specific license review.

### 3. ThunderLoom and Karma Hair/Cycles Hair — optical teacher

Pinned ThunderLoom upstream: `ThunderLoom/ThunderLoom@62e6d750cf38443eecec2ea350d116c375087003` (MIT).

ThunderLoom provides a source-visible implementation of an Irawan woven-cloth model and standard WIF weaving drafts. It is useful for the middle/far-scale woven BRDF where individual yarn geometry is no longer resolved.

For close range, use actual curves with a fiber model. Karma Hair thickens curves at render time and uses a Chiang-family physical fiber shader. A Blender/Cycles reference renderer is an acceptable independent native truth renderer when Houdini/Karma is unavailable, provided it renders true 3D curves rather than flat ribbons for close-ups.

### 4. MADYPG/HYLC — deformation teacher

Pinned MADYPG upstream: `kamleshbhalui/MADYPG@b91c7af0b7a1382fed0a5fb3147f13594ddec71e` (MIT, with per-file dependency notices).

MADYPG maps a deforming cloth mesh to yarn-pattern geometry using precomputed local displacement data; its main algorithm is identified by the authors in `src/yarns/YarnMapper.h`. HYLC supplies the yarn-level homogenization route for macro cloth response. These methods allow a thin-shell cloth solver to drive rich yarn geometry without running a full yarn simulation over the entire garment every frame.

## Production architecture

### A. Authoring and cinematic truth

1. Pattern compiler
   - Inputs: binary/colored weave draft, warp/weft counts, real-life tile size, yarn widths and offsets.
   - Output: deterministic over/under topology and material-space centerlines.

2. Yarn constructor
   - Elliptical or measured cross section.
   - Crimp generated from the over/under sequence with tangent-continuous transitions.
   - Distinct warp/weft radii, color and twist.
   - No self-intersection after detangling.

3. Surface mapper
   - Non-overlapping UV surface as the material chart.
   - Material-space centerlines mapped through barycentric surface coordinates.
   - Freeze/rest-frame mapping to keep topology and IDs stable under animation.

4. Detail stack
   - Multifiber/plies.
   - Deterministic width variation and color variation.
   - Fuzz and flyaway fibers.
   - Damage, missing yarns, fray and edge breakup.
   - Stitch and arbitrary-curve channels remain separate from the base weave.

5. Native reference render
   - True 3D curve primitive or swept yarn geometry.
   - Physical fiber shader; width drives geometry, optical thickness remains a separate shading control.
   - ACES-managed lighting, grazing key light, back light and macro close-up.
   - High-sample path-traced frame is the reference, not the browser preview.

### B. Mechanics

1. Macro garment mesh uses measured/identified stretch, shear and bend behavior.
2. Yarn coordinates and stable IDs are attached to the rest surface.
3. Runtime mesh deformation drives yarn detail through a MADYPG-style local strain mapping.
4. Full yarn simulation is reserved for small calibration patches and destructive hero events, not the whole garment by default.
5. Cloth collision and yarn appearance are separate systems. A beautiful fiber shader cannot compensate for bad drape or penetration.

### C. Browser runtime with one source of truth

- Near: explicit yarn curves/tubes, multifiber only inside the camera importance region.
- Mid: reduced centerline curves plus fiber-aware analytic shading and baked local occlusion.
- Far: shell geometry with ThunderLoom/Irawan-class anisotropic weave response and prefiltered pattern data.
- All levels derive from the same pattern compiler, IDs, physical scale and color specification.
- Cross-fade is based on projected yarn width and temporal hysteresis; no sudden switch from real yarns to a flat checkerboard.
- Authoring render and browser runtime are different quality tiers, not different materials.

## First bounded implementation target

`FIBRIC_OPEN_HERRINGBONE_R01`

Target is one flat or gently draped herringbone sample. Garment integration is forbidden until this sample passes.

Required measurements:

- pattern repeat and warp/weft count;
- tile size in centimeters;
- yarn diameter/ellipse axes;
- crossing height and crimp amplitude;
- gap/open-area ratio;
- over/under order at every crossing;
- points per yarn repeat and curve basis;
- multifiber ply count, radius and twist pitch;
- fuzz density, length distribution and root mask;
- close/mid/far visual continuity.

Required views:

- normal incidence;
- grazing reflection;
- back light/transmission;
- macro close-up;
- deformed sample with the same material coordinates.

A candidate fails if the crossing order, scale or yarn silhouette is wrong even when the color and highlights look attractive.

## Acceptance gates

1. Contract gate: all dimensions are in meters internally and map to documented centimeter controls.
2. Topology gate: crossing order and yarn IDs are deterministic and unchanged by camera or frame.
3. Geometry gate: no invalid points, zero-length segments or nonlocal curve connections.
4. Separation gate: no unapproved yarn intersections after detangling.
5. Reference gate: same camera/light views are compared against the official target evidence.
6. Native-render gate: close-up 3D yarn silhouette, occlusion and highlight direction pass before web porting.
7. Runtime gate: the standalone HTML uses generated 3D runtime geometry, not screenshots/video/canvas fakery.
8. File gate: final HTML opens by `file://`, uses no CDN/core network request and reports zero console errors.
9. Freshness gate: final build, evidence and immutable public mirror are generated after the task anchor.
10. Promotion gate: only a candidate that passes these gates may replace the rejected R01.

## Costs and risks

- Fibric recommends 32 GB RAM minimum and 64 GB or more for optimal performance. Exact hero-curve density can therefore exceed ordinary browser budgets.
- Close-up fiber path tracing is expensive; the browser cannot simply run the authoring scene at the same density.
- LYNX is LGPL-3.0, so direct code reuse has distribution obligations. ThunderLoom and MADYPG are MIT but retain attribution and third-party notices.
- The official Fibric core, original herringbone pattern library and beta license remain unavailable in the acquired public package. Exact native recook remains an independent unresolved lane.
- The current execution environment has no Houdini, Karma, Blender or verified render license. Native reference rendering must run in a suitable external/CI worker before any cinematic claim.

## Current outcome

A technically viable route now exists that does not wait for the missing Fibric HDA and does not return to the rejected shader approximation. The next artifact is source code for the deterministic herringbone pattern/yarn compiler plus numeric geometry tests. No user-facing preview is promoted before that kernel and a native reference render pass.
