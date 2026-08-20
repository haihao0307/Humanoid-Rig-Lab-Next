# Human Surface Asset Attribution

`smpl-male-surface.glb` is a web conversion of the distributable male sample body surface published in the Meshcapade SMPL documentation repository.

- Source organization: Meshcapade and the Max Planck Institute for Intelligent Systems
- Source asset category: SMPL sample mesh
- Source license: Creative Commons Attribution 4.0 International, CC BY 4.0
- Local modification: converted from the sample surface representation to binary glTF 2.0, with Y-up coordinates, vertex normals, a constant vertex color, and no textures
- Local SHA-256: `68ae60197947ae4581bfd7066b34117d4a3cf7f488b9f676d0ea7fba98a25f03`

`smpl-male-surface-skinned.glb` is a transitional pre-bound derivative of that local surface. It preserves the original 27,578 vertices and 55,152 triangles, and adds a 24-joint hierarchy, `JOINTS_0`, `WEIGHTS_0`, and inverse bind matrices for native Three.js `SkinnedMesh` validation.

- Compatible rig: `rig@0.4.0`, profile `smpl24-controls28@1`
- Maximum influences per vertex: 4
- Weight status: experimental transitional weights generated from the editor's region-isolated weighting prototype
- Production status: engineering validation only
- Local SHA-256: `736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899`

This package includes a sample surface and an editor-generated preview skinning system. It does not include the licensed full SMPL parametric body model, learned shape blend shapes, the original learned skinning weights, joint regressor, or pose corrective blend shapes.

When redistributing either surface, retain this attribution and comply with CC BY 4.0.
