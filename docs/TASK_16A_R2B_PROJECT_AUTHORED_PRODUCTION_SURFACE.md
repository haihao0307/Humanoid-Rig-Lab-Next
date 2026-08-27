# Task 16A R2B — Web-native production surface v1

## Decision

The production source of truth is `HRLSurface v1`, a project-specific web-native binary surface format. The user explicitly replaced the Blender/authoring-cage direction because this surface is only consumed on the web and must remain continuously reshapeable. No `.blend` asset is delivered, and no production GLB is treated as an editable master.

The locked R2A MakeHuman CC0 GLB remains reference-only. It is embedded in the portable review solely for proportion, silhouette and static comparison.

## Format and edit model

`HRLSURF1` stores a JSON schema header followed by aligned typed-array chunks. The current asset includes:

- mutable base positions and derived normals;
- indexed triangle control topology and navigable half-edge adjacency;
- stable project vertex IDs and a nearest opposite-side counterpart map;
- 13 continuous shape-parameter delta bases;
- 36 overlapping semantic deformation regions;
- sparse sculpt-layer patches, undo/redo transactions and deterministic reset;
- dynamic GPU buffer update ranges through the Three.js adapter;
- explicit topology revisions for future connectivity edits.

This is a real mesh format, not a renamed GLB and not a collection of capsules, cylinders, implicit blobs or a two-dimensional outline.

## Reference boundary and project identity

The production surface is a known derivative of the CC0 reference. The generator uses the reference for surface placement and human proportion guidance, then applies coherent neutral-shape fields, semantic-constrained refinement, local triangle-quality optimization and deterministic vertex relabelling. It does not claim clean-room independence.

Direct array comparison reports zero copied positions, zero copied index triplets and zero copied triangles. Production uses 16,384 vertices and 32,764 triangles, compared with the reference's 13,380 vertices and 26,756 triangles. The rest pose remains a natural A pose; random noise is not used to manufacture difference.

Project-neutral changes cover head width, jaw, nose bridge, shoulder width, clavicle slope, chest, waist, pelvis, gluteal depth, limb volume, hand scale and foot scale. These are also exposed as editable basis fields where appropriate.

## Static topology evidence

The data audit records one closed connected component, zero boundary edges, zero non-manifold edges and vertices, zero degenerate or duplicate triangles, consistent winding, positive signed volume, Euler characteristic 2 and zero detected self-intersections. The minimum triangle angle is 4.434661 degrees, p99 aspect ratio is 9.200914 and maximum valence is 10.

Because HRLSurface is an indexed-triangle half-edge format, authoring quad count and Blender edge-loop claims are not applicable. Instead, it stores real overlapping vertex bands for shoulder/axilla, elbow, wrist/hand, pelvis/groin, knee, ankle/foot and face. These bands are preparation data, not proof of dynamic deformation quality; skinning remains deferred.

## Portable review boundary

The standalone review is a single ordinary-script HTML file. It embeds HRLSurface, the locked reference and a project-local Three.js r185 build; its CSP sets `connect-src 'none'`. It supports model, view, surface-mode and close-up query parameters plus direct sculpt, symmetric counterpart edits, continuous shape parameters, undo/redo, reset, orbit and zoom.

Per repository instruction, the agent did not launch a browser or judge the rendered human. Screenshots, contact sheet, file-protocol execution, console state and visible-shape acceptance remain assigned to the user. Their absence is recorded explicitly rather than replaced with fabricated visual evidence.

## Current gates

- Static container/topology/data audit: passed.
- Editable runtime unit audit: passed.
- R2A asset integrity: must remain byte-for-byte unchanged.
- Portable review packaging: generated; user execution pending.
- Visual acceptance: false.
- Production ready: false.
- User visual acceptance: pending.

Current conclusion: `HRLSURFACE_STATIC_DATA_READY_FOR_USER_VISUAL_REVIEW`. This intentionally does not assert the original all-screenshots `PROJECT_AUTHORED_SURFACE_READY_FOR_USER_REVIEW` gate.
