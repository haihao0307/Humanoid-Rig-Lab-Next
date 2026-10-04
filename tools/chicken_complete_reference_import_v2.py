from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import objaverse
import trimesh
from pygltflib import GLTF2

OUT = Path("out/chicken-complete-reference")
UID = "98830a78e8c54354a7fbe5ca8346fbf9"
SOURCE_PAGE = f"https://sketchfab.com/3d-models/chicken-{UID}"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest().upper()


def serialise(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): serialise(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialise(v) for v in value]
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(serialise(value), ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def inspect_gltf(path: Path) -> dict[str, Any]:
    gltf = GLTF2().load_binary(path.as_posix())
    nodes = gltf.nodes or []
    meshes = gltf.meshes or []
    skins = gltf.skins or []
    animations = gltf.animations or []
    materials = gltf.materials or []
    primitives = []
    for mesh_index, mesh in enumerate(meshes):
        for primitive_index, primitive in enumerate(mesh.primitives or []):
            attributes = primitive.attributes
            primitives.append({
                "mesh_index": mesh_index,
                "mesh_name": mesh.name,
                "primitive_index": primitive_index,
                "mode": primitive.mode,
                "material": primitive.material,
                "indices": primitive.indices,
                "position": getattr(attributes, "POSITION", None),
                "normal": getattr(attributes, "NORMAL", None),
                "texcoord_0": getattr(attributes, "TEXCOORD_0", None),
                "joints_0": getattr(attributes, "JOINTS_0", None),
                "weights_0": getattr(attributes, "WEIGHTS_0", None),
            })
    joint_nodes = sorted({joint for skin in skins for joint in (skin.joints or [])})
    return {
        "scene_count": len(gltf.scenes or []),
        "default_scene": gltf.scene,
        "node_count": len(nodes),
        "mesh_count": len(meshes),
        "primitive_count": len(primitives),
        "skin_count": len(skins),
        "joint_node_count": len(joint_nodes),
        "animation_count": len(animations),
        "material_count": len(materials),
        "texture_count": len(gltf.textures or []),
        "image_count": len(gltf.images or []),
        "accessor_count": len(gltf.accessors or []),
        "has_skinning": bool(skins) or any(row["joints_0"] is not None for row in primitives),
        "has_animation": bool(animations),
        "nodes": [
            {
                "index": index,
                "name": node.name,
                "mesh": node.mesh,
                "skin": node.skin,
                "children": node.children,
                "translation": node.translation,
                "rotation": node.rotation,
                "scale": node.scale,
                "matrix": node.matrix,
            }
            for index, node in enumerate(nodes)
        ],
        "primitives": primitives,
        "skins": [serialise(skin.__dict__) for skin in skins],
        "animations": [
            {
                "name": animation.name,
                "channels": len(animation.channels or []),
                "samplers": len(animation.samplers or []),
            }
            for animation in animations
        ],
        "materials": [
            {
                "name": material.name,
                "double_sided": material.doubleSided,
                "alpha_mode": material.alphaMode,
                "pbr": serialise(material.pbrMetallicRoughness.__dict__ if material.pbrMetallicRoughness else None),
                "normal_texture": serialise(material.normalTexture.__dict__ if material.normalTexture else None),
                "occlusion_texture": serialise(material.occlusionTexture.__dict__ if material.occlusionTexture else None),
            }
            for material in materials
        ],
        "images": [serialise(image.__dict__) for image in (gltf.images or [])],
    }


def inspect_surface(path: Path) -> dict[str, Any]:
    loaded = trimesh.load(path, process=False, force="scene")
    scene = loaded if isinstance(loaded, trimesh.Scene) else trimesh.Scene(loaded)
    rows = []
    total_vertices = 0
    total_triangles = 0
    for name, mesh in scene.geometry.items():
        if not isinstance(mesh, trimesh.Trimesh):
            continue
        total_vertices += len(mesh.vertices)
        total_triangles += len(mesh.faces)
        components = mesh.split(only_watertight=False)
        rows.append({
            "name": name,
            "vertices": len(mesh.vertices),
            "triangles": len(mesh.faces),
            "bounds_min": mesh.bounds[0].tolist(),
            "bounds_max": mesh.bounds[1].tolist(),
            "extents": mesh.extents.tolist(),
            "centroid": mesh.centroid.tolist(),
            "components": len(components),
            "largest_component_triangle_fraction": (
                max((len(item.faces) for item in components), default=0) / max(1, len(mesh.faces))
            ),
            "watertight": bool(mesh.is_watertight),
            "winding_consistent": bool(mesh.is_winding_consistent),
            "visual_kind": type(mesh.visual).__name__,
            "material_name": getattr(getattr(mesh.visual, "material", None), "name", None),
        })
    bounds = np.asarray(scene.bounds, dtype=float)
    return {
        "geometry_count": len(rows),
        "total_vertices": total_vertices,
        "total_triangles": total_triangles,
        "bounds_min": bounds[0].tolist(),
        "bounds_max": bounds[1].tolist(),
        "extents": (bounds[1] - bounds[0]).tolist(),
        "geometry": rows,
    }


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    source_dir = OUT / "source" / "original"
    canonical_dir = OUT / "canonical" / "static-copy"
    source_dir.mkdir(parents=True)
    canonical_dir.mkdir(parents=True)

    annotations = objaverse.load_annotations([UID])
    annotation = annotations.get(UID)
    if annotation is None:
        raise RuntimeError(f"Objaverse annotation missing for {UID}")
    write_json(OUT / "metadata" / "OBJAVERSE_ANNOTATION.json", annotation)

    license_text = str(annotation.get("license", "")).lower()
    if "by" not in license_text:
        raise RuntimeError(f"Reference license is not attribution compatible: {annotation.get('license')}")

    downloaded = objaverse.load_objects([UID], download_processes=1)
    source_path_raw = downloaded.get(UID)
    if source_path_raw is None:
        raise RuntimeError(f"Objaverse binary unavailable for {UID}")
    downloaded_path = Path(source_path_raw)
    original = source_dir / f"chicken-{UID}.glb"
    canonical = canonical_dir / original.name
    shutil.copy2(downloaded_path, original)
    shutil.copy2(original, canonical)

    exact_copy = original.read_bytes() == canonical.read_bytes()
    source_sha = sha256_file(original)
    canonical_sha = sha256_file(canonical)
    if not exact_copy or source_sha != canonical_sha:
        raise RuntimeError("Canonical copy is not byte-identical")

    gltf = inspect_gltf(original)
    surface = inspect_surface(original)
    write_json(OUT / "GLTF_STRUCTURE_REPORT.json", gltf)
    write_json(OUT / "SURFACE_GEOMETRY_REPORT.json", surface)

    lock = {
        "schema": "life_ecosystem/chicken_complete_reference_lock@1.0",
        "created_at": now_iso(),
        "source_platform": "Sketchfab mirrored by Objaverse 1.0",
        "source_page": SOURCE_PAGE,
        "uid": UID,
        "title": annotation.get("name"),
        "author": annotation.get("user"),
        "license": annotation.get("license"),
        "license_url": annotation.get("license_url"),
        "source_binary": {
            "path": original.relative_to(OUT).as_posix(),
            "bytes": original.stat().st_size,
            "sha256": source_sha,
        },
        "canonical_static_copy": {
            "path": canonical.relative_to(OUT).as_posix(),
            "bytes": canonical.stat().st_size,
            "sha256": canonical_sha,
            "exact_byte_copy": exact_copy,
        },
        "runtime_policy": {
            "reference_model_only": True,
            "source_mesh_in_final_runtime": False,
            "source_textures_in_final_runtime": False,
            "attribution_required": True,
            "generated_results_separate": True,
        },
    }
    write_json(OUT / "LICENSE_AND_SOURCE_LOCK.json", lock)

    selection = {
        "schema": "life_ecosystem/chicken_reference_selection@1.0",
        "created_at": now_iso(),
        "selected": True,
        "uid": UID,
        "public_listing": {
            "reported_triangles": 57000,
            "reported_vertices": 29200,
            "published": "2020-05-15",
            "license": "CC Attribution",
        },
        "role": "complete external surface and material mother reference",
        "limitations": [
            "not a veterinary anatomy source",
            "internal skeleton and joint centres require anatomical references",
            "reference selection is pending visual review",
        ],
        "first_integrated_test": {
            "region": "left_distal_hindlimb",
            "includes": [
                "reference surface",
                "material response",
                "tibiotarsus distal section",
                "intertarsal joint",
                "tarsometatarsus",
                "digits and claws",
                "joint controls",
                "skin weights",
                "ground contact",
            ],
        },
    }
    write_json(OUT / "REFERENCE_SELECTION.json", selection)

    (OUT / "00_START_HERE.md").write_text(
        "# Complete chicken reference import\n\n"
        f"UID: `{UID}`\n\n"
        "The source GLB is preserved unchanged and paired with an exact static copy. "
        "The model is used as a complete surface and material reference. Anatomical joint "
        "locations remain independently constrained. The next production step is one "
        "integrated left distal hindlimb reconstruction test.\n",
        encoding="utf-8",
    )

    files = []
    for path in sorted(OUT.rglob("*")):
        if path.is_file() and path.name != "PACKAGE_MANIFEST.json":
            files.append({
                "path": path.relative_to(OUT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            })
    write_json(OUT / "PACKAGE_MANIFEST.json", {
        "schema": "life_ecosystem/chicken_complete_reference_package@1.0",
        "created_at": now_iso(),
        "files": files,
        "exact_static_copy": exact_copy,
    })

    print(json.dumps({
        "uid": UID,
        "name": annotation.get("name"),
        "license": annotation.get("license"),
        "source_bytes": original.stat().st_size,
        "source_sha256": source_sha,
        "exact_static_copy": exact_copy,
        "surface": surface,
        "gltf_summary": {
            "skin_count": gltf["skin_count"],
            "animation_count": gltf["animation_count"],
            "material_count": gltf["material_count"],
            "image_count": gltf["image_count"],
            "has_skinning": gltf["has_skinning"],
            "has_animation": gltf["has_animation"],
        },
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
