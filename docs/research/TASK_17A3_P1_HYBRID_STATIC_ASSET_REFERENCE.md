# Task 17A.3 P1 Hybrid Static Asset Reference

## Research boundary

Official English documentation was reviewed before P1 geometry work began. External material is used only to confirm information-design and file-format principles. No external skeleton mesh, medical model, Rigify widget, Unreal control shape, source geometry, source code, texture, image, font, or other asset is included.

The P0 distillation remains the visual-direction foundation. P1 narrows that result to the user-selected `HYBRID_PRODUCTION` direction and authors a fixed static asset.

## Official sources

- [Khronos glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html): Binary glTF uses the `.glb` extension and can carry its JSON and binary payload in one file. P1 uses one embedded BIN chunk with no external URI. The GLB is explicitly a display cache and does not define or own runtime pose behavior.
- [Khronos glTF overview](https://www.khronos.org/gltf/): glTF is an asset-delivery format for scenes and models. P1 serializes the project-owned module meshes, materials, accessors, buffer views, and one scene without treating the file as HumanRigCore authority.
- [Blender Armature Viewport Display](https://docs.blender.org/manual/en/latest/animation/armatures/properties/display.html): a useful bone display communicates root, tip, relative thickness, and roll. P1 adopts the general need for readable thickness and direction but does not copy Blender octahedra or widgets.
- [Epic Controls, Bones, and Nulls](https://dev.epicgames.com/documentation/en-us/unreal-engine/controls-bones-and-nulls-in-control-rig-in-unreal-engine): bones and controls have different roles and visual responsibilities. P1 contains only static skeleton display geometry—no controls, nulls, IK, interaction, or solver behavior.

## Project sources

- `src/modules/human-core-v5/production-rig-visual-prototypes-p0/rig-prototype-data.js` supplies the frozen Reference T data selected in P0: 20 Core joints, 19 segments, fixed parents, fixed positions, and fixed lengths.
- `docs/research/TASK_17A3_P0_PRODUCTION_RIG_VISUAL_REFERENCE_STUDY.md` records the broader Blender, Epic, Unity, VRM, OpenXR, and internal architecture distillation.
- `HUMANOID_RIG_LAB_NEXT_MASTER_CONTEXT.md` remains authoritative for the shared HumanRigCore hierarchy and pose ownership.

## Adopted P1 rules

1. HumanRigCore joint centers, parents, segment endpoints, lengths, and proportions are copied unchanged into the static source receipt.
2. Visual geometry is composed of 24 named modules; disconnected modules are allowed and are not falsely required to form one connected manifold.
3. Head, thorax, pelvis, shoulder girdle, long bones, dual rails, palms, and feet use original project-authored vertices and indices.
4. The front, side, back, and three-quarter projections use the same P0 canvas, orthographic ranges, world center, and cameras.
5. `skeleton-source.json` stores fixed positions, normals, and triangle indices. The GLB merely serializes those records.
6. Review HTML contains embedded SVG only and executes no JavaScript, request, geometry generation, or server-dependent behavior.

## Originality receipt

The asset receipt records:

```text
externalGeometryUsed = false
externalAssetUsed = false
externalSourceCodeCopied = false
projectOwnedGeometry = true
```

These declarations apply to every mesh, curve approximation, module profile, material, projection, raster image, GLB buffer, and review artifact in P1.
