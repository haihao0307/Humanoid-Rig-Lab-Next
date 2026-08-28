# Task 16A R2B — HRLFullBilateralSurfaceV1

## Decision

The production source of truth is `HRLFullBilateralSurfaceV1` inside the project-specific web-native `HRLSurface v1` binary format. The user explicitly replaced the Blender/authoring-cage direction because this surface is only consumed on the web and must remain continuously reshapeable. No `.blend` asset is delivered, and no production GLB is treated as an editable master.

The locked R2A MakeHuman CC0 GLB remains excluded from final runtime identity. The generator did, however, read its POSITION, NORMAL and index accessors and used its positions and connectivity as the seed for the derived project surface. The portable review also embeds it for comparison. This is explicitly a CC0-derived workflow, not clean-room authoring.

## Format and edit model

`HRLSURF1` stores a JSON schema header followed by aligned typed-array chunks. The current asset includes:

- one complete bilateral position array, derived normals and deterministic tangents;
- one full indexed triangle topology and navigable full-surface half-edge adjacency;
- stable project vertex IDs, explicit `left/right/center` side metadata and a bijective `symmetryPartner` involution;
- an unbranched 188-vertex centerline chain with `X=0`, shared by triangles from both sides;
- per-vertex primary region, anatomical-band, centerline-role and future weight/corrective/expression region identifiers;
- 13 continuous shape-parameter delta bases;
- 36 overlapping semantic deformation regions;
- sparse sculpt-layer patches, undo/redo transactions and deterministic reset;
- dynamic GPU buffer update ranges through the Three.js adapter;
- explicit topology revisions for future connectivity edits.

This is a real mesh format, not a renamed GLB and not a collection of capsules, cylinders, implicit blobs or a two-dimensional outline. Neither side is generated from the other at runtime; there is no `reflectX`, negative-scale node, overlapped half mesh or split centerline attribute authority.

## Reference boundary and project identity

The production surface is a known derivative of the CC0 reference. The generator reads Reference positions, normals and indices, uses positions for the project-neutral shape input, and uses Reference connectivity as the seed for semantic-constrained refinement. It then performs local triangle-quality optimization and deterministic vertex relabelling. It does not use a distance field or nearest-surface projection and does not claim clean-room independence.

Direct array comparison reports zero copied positions, zero copied index triplets and zero copied triangles. Production uses 16,384 vertices and 32,764 triangles, compared with the reference's 13,380 vertices and 26,756 triangles. The rest pose remains a natural A pose; random noise is not used to manufacture difference.

Project-neutral changes cover head width, jaw, nose bridge, shoulder width, clavicle slope, chest, waist, pelvis, gluteal depth, limb volume, hand scale and foot scale. These are also exposed as editable basis fields where appropriate.

## Static topology evidence

The data audit records one closed connected component, zero boundary edges, zero non-manifold edges and vertices, zero degenerate or duplicate triangles, consistent winding, positive signed volume, Euler characteristic 2 and zero detected self-intersections. The minimum triangle angle is 4.434661 degrees, p99 aspect ratio is 9.188937 and maximum valence is 10.

The full-bilateral audit records 8,098 left vertices, 8,098 right vertices and 188 center vertices. The centerline has one connected component, 187 edges, two endpoints, no branch, no duplicate center pair, no position gap and no separately stored normal or tangent disagreement. Every center vertex is referenced by triangles from both sides. Symmetry-partner missing, wrong-side, involution and center-self errors are all zero.

Deterministic symmetric edits at left shoulder, waist, hip and cheek report zero magnitude and mirrored-direction error. Deterministic asymmetric edits at left shoulder, left cheek, right pelvis and right calf leave every unselected opposite vertex unchanged; undo and redo reproduce both states.

Because HRLSurface is an indexed-triangle half-edge format, authoring quad count and Blender edge-loop claims are not applicable. Instead, it stores real overlapping vertex bands for shoulder/axilla, elbow, wrist/hand, pelvis/groin, knee, ankle/foot and face. These bands are preparation data, not proof of dynamic deformation quality; skinning remains deferred.

## Portable review boundary

The standalone review is a single ordinary-script HTML file. It embeds HRLSurface, the locked reference, the static audit and a project-local Three.js r185 build; its CSP sets `connect-src 'none'`. It supports `production-full`, `production-wireframe`, `centerline`, `symmetry-map`, `symmetric-edit-test`, `asymmetric-edit-test`, `reference-compare` and `failed-mirror-compare`, plus view/close-up parameters, direct sculpt, symmetric or asymmetric edits, continuous shape parameters, undo/redo, reset, orbit and zoom.

The root entry and standalone are byte-identical, fully embedded single-file pages. The previous fetch-based root entry remains `human-core-v5-production-surface-v1-http-debug.html`. Both offline files expose `window.__HRL_FULL_BILATERAL_SURFACE_V1__`, verify the embedded asset SHA-256 in page memory, distinguish seven startup error codes, and compute first-frame pixel and screen-bound evidence.

The earlier portable-review pass recorded that supported Chrome automation rejected `file://` navigation. For this reconstruction pass, repository `AGENTS.md` assigns all computer interaction and visual-effect inspection to the user. Consequently, no screenshot, contact sheet, console result or visual-shape decision is claimed from static evidence.

## Current gates

- Static container/topology/data audit: passed.
- Full-bilateral centerline and metadata audit: passed.
- Symmetric and asymmetric deterministic edit audits: passed.
- Editable runtime unit audit: passed.
- R2A asset integrity: must remain byte-for-byte unchanged.
- Portable review static/file-content audit: passed.
- Real Chrome/Edge `file://` execution: pending user execution under the repository instruction.
- Visual acceptance: false.
- Production ready: false.
- User visual acceptance: pending.

Current conclusion: `HRL_FULL_BILATERAL_STATIC_GATES_PASSED_VISUAL_REVIEW_PENDING` and `BROWSER_EVIDENCE_INCONCLUSIVE_PENDING_USER_REVIEW`. This intentionally makes no shape judgment without real rendered evidence.
