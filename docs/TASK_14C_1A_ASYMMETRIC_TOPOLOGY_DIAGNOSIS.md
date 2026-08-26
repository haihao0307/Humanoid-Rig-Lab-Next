# Task 14C-1A Asymmetric Topology Diagnosis

## Scope

This checkpoint records diagnosis only. It does not change the production
surface output because the extractor's default tetrahedralization remains
`legacy-mirrored-x`.

The diagnostic matrix evaluates the Asymmetric preset at resolutions 40 and
56 with both the legacy mirrored-X tetrahedralization and a uniform conforming
tetrahedralization. The complete machine-readable evidence is stored in
`artifacts/qa/task14c-geometry-v1/asymmetric-topology-diagnostic.json`.

## Findings

All four matrix entries produce two closed components with zero boundary edges
and zero non-manifold edges. The component count is already two in the raw
triangle soup and remains two after degenerate removal and vertex compaction.
Changing tetrahedralization does not reconnect the components, and increasing
the resolution from 40 to 56 does not reconnect them either.

The detached component is consistently localized to the right foot/right calf
region and never touches a sampled field bound. At resolution 56 it is purely
classified as `rightFoot` (946 vertices for legacy, 938 for uniform). Its
nearest distance to the main component is approximately 0.0174, so it is not a
numerical duplicate or a cleanup artifact.

The BodyDNA provenance audit also shows that the authored left/right scale is
applied once during Body Field region placement but zero times in the adapted
RigDefinition and zero times in SimulationRig FK. Therefore the current path
does not provide a single authoritative asymmetric geometry definition.

## Root-cause classification

- Not degenerate-triangle cleanup: the raw and final component counts match.
- Not tetrahedralization: legacy and uniform modes both fail identically.
- Not voxel resolution: both tested resolutions retain the detached foot.
- Primary geometry defect: the right ankle/calf and right foot implicit fields
  are spatially disconnected after asymmetric leg placement.
- Provenance defect: asymmetric placement is owned locally by Body Field
  instead of flowing once through a shared rig/geometry authority.

The repair must reconnect the ankle-foot field through that single authority;
it must not weld components after extraction or relax the component gate.
