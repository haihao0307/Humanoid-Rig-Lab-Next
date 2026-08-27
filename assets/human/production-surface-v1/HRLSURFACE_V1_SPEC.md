# HRLSurface v1

HRLSurface is the web-native editable surface format for Humanoid Rig Lab. It is the production surface source of truth; it is not a renamed GLB and it does not depend on Blender authoring state.

## Container

- Bytes `0..7`: ASCII magic `HRLSURF1`.
- Bytes `8..11`: little-endian JSON header byte length.
- Bytes `12..15`: little-endian binary data-section offset.
- The UTF-8 JSON header begins at byte `16`.
- Typed binary chunks begin at the aligned data-section offset.
- Chunk offsets in the JSON header are relative to the data section.

The schema identifier is `humanoid_rig/hrlsurface@1.0`.

## Required geometry chunks

- `basePositions`: mutable `Float32Array`, XYZ in metres.
- `baseNormals`: initial `Float32Array`; normals are regenerated after edits.
- `indices`: `Uint32Array` counter-clockwise triangles.
- `stableVertexIds`: project namespace IDs, independent of reference numbering.
- `symmetryMap`: nearest opposite-side stable vertex mapping. It is intentionally not described as an exact one-to-one pairing because the reference surface has different left/right vertex counts.
- `halfEdgeVertex`, `halfEdgeNext`, `halfEdgeTwin`, `halfEdgeFace`, `vertexHalfEdge`: navigable control-surface topology.

## Editable shape chunks

- `parameterBasis`: dense per-parameter XYZ delta basis.
- `semanticMaskLo` and `semanticMaskHi`: fast overlapping anatomical-region membership.
- `regionOffsets` and `regionVertexIndices`: sparse stable membership for inspection and editing.
- Sparse sculpt layers are represented as stable vertex-index and XYZ-delta pairs when serialized.

## Runtime contract

1. Start from `basePositions`.
2. Accumulate weighted `parameterBasis` deltas.
3. Accumulate ordered sparse sculpt-layer deltas.
4. Recompute normals and bounds.
5. Mark only affected GPU attribute ranges for update.
6. Preserve topology and stable IDs unless an explicit topology-edit transaction creates a new topology revision.

Edits support mirror pairing, undo/redo command patches, direct brush displacement, parameter reset, and reserialization. A generated GLB may be used as a disposable interchange snapshot, but it is never the HRLSurface source of truth.

## Provenance boundary

The R2A CC0 mesh may guide proportions and surface placement. HRLSurface V1 records that derivative relationship explicitly. It does not claim clean-room independence. The delivered arrays, topology order, half-edge structure, parameter basis, semantic edit regions and project neutral shape are newly generated project data.
