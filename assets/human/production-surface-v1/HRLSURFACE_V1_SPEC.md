# HRLSurface v1 — HRLFullBilateralSurfaceV1

HRLSurface is Humanoid Rig Lab's web-native editable surface format. It is not a renamed GLB, does not depend on Blender authoring state and can be reshaped directly as typed arrays in a web runtime.

## Container

- Bytes `0..7`: ASCII magic `HRLSURF1`.
- Bytes `8..11`: little-endian JSON header byte length.
- Bytes `12..15`: little-endian binary data-section offset.
- The UTF-8 JSON header begins at byte `16`.
- Aligned typed-array chunks follow; descriptor offsets are relative to that data section.
- Schema: `humanoid_rig/hrlsurface@1.0`.

## Complete bilateral authority

`HRLFullBilateralSurfaceV1` is one indexed `BufferGeometry` and one complete human surface. The full `basePositions` and `indices` arrays explicitly contain left, right and unique center vertices. The format does not generate either body half at runtime, use `reflectX`, use negative scale or overlap two half meshes.

Every vertex has:

- `stableVertexIds` (`vertexId`);
- `vertexSide`, with `center=0`, `left=1`, `right=2`;
- `symmetryPartner`, an exact bijective involution; center vertices map to themselves;
- `primaryRegionIds` (`regionId`);
- `anatomicalBandMaskLo/Hi` (`anatomicalBandIds`);
- `centerlineRole`;
- `futureWeightRegionMaskLo/Hi`;
- `futureCorrectiveRegionMaskLo/Hi`;
- `futureExpressionRegionMaskLo/Hi`.

`leftVertexIndices`, `rightVertexIndices` and `centerVertexIndices` expose the three explicit sets. `halfEdgeVertex`, `halfEdgeNext`, `halfEdgeTwin`, `halfEdgeFace` and `vertexHalfEdge` cover the complete surface adjacency.

## Unique centerline

The centerline is one welded, unbranched indexed chain shared by triangles from both sides. It spans scalp, forehead, nose bridge, philtrum, lips, chin, front neck, sternum, abdomen, navel, front pelvis, front groin, back spine, sacrum and back groin. Each center vertex has `X=0`, `side=center` and `symmetryPartner=self`.

`baseNormals` and `baseTangents` store one tuple per indexed vertex. Consequently there are no separately stored left/right centerline normals or tangents whose disagreement could create a split-attribute seam.

## Editable shape chunks

- `parameterBasis`: dense per-parameter XYZ deltas.
- `semanticMaskLo/Hi`: overlapping anatomical membership.
- `regionOffsets` and `regionVertexIndices`: sparse memberships for inspection and editing.
- Sparse sculpt layers serialize stable vertex indices and XYZ deltas.
- `failedCenterlinePositions`: non-authoritative historical diagnostic positions used only by `failed-mirror-compare`.

## Runtime contract

1. Start from the complete bilateral `basePositions` array.
2. Accumulate `parameterBasis` and sparse sculpt deltas without changing topology.
3. In symmetric edit mode, look up `symmetryPartner` and apply the X-sign-converted delta to the already stored partner vertex.
4. With symmetric edit disabled, modify only selected vertices; the opposite side remains byte-for-byte unchanged.
5. Keep centerline X at zero by default. An explicit centerline-offset experiment may relax that rule without duplicating topology.
6. Recompute normals and bounds, then mark affected GPU ranges.
7. Preserve stable IDs unless an explicit topology revision is created.

Undo and redo store independent left/right delta changes. A generated GLB may be a disposable interchange snapshot, but it is never the editable authority.

## Provenance boundary

The R2A CC0 mesh guides proportions and seeds the derived control surface. HRLSurface records that relationship and does not claim clean-room independence. The delivered vertex order, refined topology, half-edge data, editable region metadata, full-bilateral partner authority and project-neutral shape are generated project data.
