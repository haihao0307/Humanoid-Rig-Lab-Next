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
UID = "6f6b31816ac245aa8b849be2ed299fb8"
SOURCE_PAGE = f"https://sketchfab.com/3d-models/realistic-rooster-{UID}"
EXPECTED_LICENSE_FAMILY = "by"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().upper()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def serialise(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): serialise(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialise(item) for item in value]
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, Path):
        return value.as_posix()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def gltf_report(path: Path) -> dict[str, Any]:
    gltf = GLTF2().load_binary(path.as_posix())
    nodes = gltf.nodes or []
    meshes = gltf.meshes or []
    skins = gltf.skins or []
    animations = gltf.animations or []
    materials = gltf.materials or []
    images = gltf.images or []
    textures = gltf.textures or []
    accessors = gltf.accessors or []
    mesh_nodes = []
    joint_nodes = set()
    for skin in skins:
        for joint in skin.joints or []:
            joint_nodes.add(joint)
    for index, node in enumerate(nodes):
        if node.mesh is not None:
            mesh_nodes.append({
                "node_index": index,
                "name": node.name,
                "mesh": node.mesh,
                "skin": node.skin,
                "translation": node.translation,
                "rotation": node.rotation,
                "scale": node.scale,
                "matrix": node.matrix,
            })
    primitive_rows = []
    for mesh_index, mesh in enumerate(meshes):
        for primitive_index, primitive in enumerate(mesh.primitives or []):
            attributes = primitive.attributes
            primitive_rows.append({
                "mesh_index": mesh_index,
                "mesh_name": mesh.name,
                "primitive_index": primitive_index,
                "mode": primitive.mode,
                "material": primitive.material,
                "indices_accessor": primitive.indices,
                "position_accessor": getattr(attributes, "POSITION", None),
                "normal_accessor": getattr(attributes, "NORMAL", None),
                "texcoord0_accessor": getattr(attributes, "TEXCOORD_0", None),
                "joints0_accessor": getattr(attributes, "JOINTS_0", None),
                "weights0_accessor": getattr(attributes, "WEIGHTS_0", None),
            })
    return {
        "asset": serialise(gltf.asset.__dict__ if gltf.asset else None),
        "scene_count": len(gltf.scenes or []),
        "default_scene": gltf.scene,
        "node_count": len(nodes),
        "mesh_count": len(meshes),
        "mesh_node_count": len(mesh_nodes),
        "skin_count": len(skins),
        "animation_count": len(animations),
        "material_count": len(materials),
        "texture_count": len(textures),
        "image_count": len(images),
        "accessor_count": len(accessors),
        "joint_node_count": len(joint_nodes),
        "has_skinning": bool(skins) or any(row["joints0_accessor"] is not None for row in primitive_rows),
        "has_animation": bool(animations),
        "mesh_nodes": mesh_nodes,
        "primitives": primitive_rows,
        "skins": [serialise(skin.__dict__) for skin in skins],
        "animations": [
            {
                "name": animation.name,
                "channel_count": len(animation.channels or []),
                "sampler_count": len(animation.samplers or []),
            }
            for animation in animations
        ],
        "materials": [
            {
                "name": material.name,
                "double_sided": material.doubleSided,
                "alpha_mode": material.alphaMode,
                "emissive_factor": material.emissiveFactor,
                "pbr": serialise(material.pbrMetallicRoughness.__dict__ if material.pbrMetallicRoughness else None),
                "normal_texture": serialise(material.normalTexture.__dict__ if material.normalTexture else None),
                "occlusion_texture": serialise(material.occlusionTexture.__dict__ if material.occlusionTexture else None),
            }
            for material in materials
        ],
        "images": [serialise(image.__dict__) for image in images],
    }


def trimesh_report(path: Path) -> dict[str, Any]:
    loaded = trimesh.load(path, process=False, force="scene")
    if isinstance(loaded, trimesh.Trimesh):
        scene = trimesh.Scene(loaded)
    else:
        scene = loaded
    geometry_rows = []
    total_vertices = 0
    total_faces = 0
    for name, geometry in scene.geometry.items():
        if not isinstance(geometry, trimesh.Trimesh):
            continue
        total_vertices += len(geometry.vertices)
        total_faces += len(geometry.faces)
        components = geometry.split(only_watertight=False)
        geometry_rows.append({
            "name": name,
            "vertices": int(len(geometry.vertices)),
            "triangles": int(len(geometry.faces)),
            "bounds_min": [float(value) for value in geometry.bounds[0]],
            "bounds_max": [float(value) for value in geometry.bounds[1]],
            "extents": [float(value) for value in geometry.extents],
            "centroid": [float(value) for value in geometry.centroid],
            "connected_components": int(len(components)),
            "watertight": bool(geometry.is_watertight),
            "winding_consistent": bool(geometry.is_winding_consistent),
            "euler_number": int(geometry.euler_number),
            "visual_kind": type(geometry.visual).__name__,
            "material_name": getattr(getattr(geometry.visual, "material", None), "name", None),
        })
    bounds = np.asarray(scene.bounds, dtype=float)
    return {
        "geometry_count": len(geometry_rows),
        "total_vertices": int(total_vertices),
        "total_triangles": int(total_faces),
        "bounds_min": [float(value) for value in bounds[0]],
        "bounds_max": [float(value) for value in bounds[1]],
        "extents": [float(value) for value in bounds[1] - bounds[0]],
        "geometry": geometry_rows,
    }


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    source_dir = OUT / "source" / "original"
    canonical_dir = OUT / "canonical" / "static-copy"
    metadata_dir = OUT / "metadata"
    source_dir.mkdir(parents=True)
    canonical_dir.mkdir(parents=True)
    metadata_dir.mkdir(parents=True)

    annotations = objaverse.load_annotations([UID])
    annotation = annotations.get(UID)
    if annotation is None:
        raise RuntimeError(f"Objaverse annotation missing for {UID}")
    write_json(metadata_dir / "OBJAVERSE_ANNOTATION.json", serialise(annotation))

    license_value = str(annotation.get("license", "")).lower()
    if EXPECTED_LICENSE_FAMILY not in license_value:
        raise RuntimeError(f"Expected an attribution license, got: {annotation.get('license')}")

    downloaded = objaverse.load_objects([UID], download_processes=1)
    path_value = downloaded.get(UID)
    if path_value is None:
        raise RuntimeError(f"Objaverse binary missing for {UID}")
    downloaded_path = Path(path_value)
    original_path = source_dir / f"realistic-rooster-{UID}.glb"
    shutil.copy2(downloaded_path, original_path)
    canonical_path = canonical_dir / original_path.name
    shutil.copy2(original_path, canonical_path)

    original_hash = sha256_file(original_path)
    canonical_hash = sha256_file(canonical_path)
    exact_copy = original_path.read_bytes() == canonical_path.read_bytes()
    if not exact_copy or original_hash != canonical_hash:
        raise RuntimeError("Canonical static copy is not byte-identical")

    gltf = gltf_report(original_path)
    mesh = trimesh_report(original_path)
    license_lock = {
        "schema": "life_ecosystem/chicken_reference_license_lock@1.0",
        "created_at": now_iso(),
        "source_platform": "Sketchfab via Objaverse public mirror",
        "source_page": SOURCE_PAGE,
        "uid": UID,
        "title": annotation.get("name") or annotation.get("title") or "Realistic Rooster",
        "author": annotation.get("user") or annotation.get("author"),
        "license": annotation.get("license"),
        "license_url": annotation.get("license_url"),
        "annotation": serialise(annotation),
        "source_binary": {
            "file": original_path.relative_to(OUT).as_posix(),
            "bytes": original_path.stat().st_size,
            "sha256": original_hash,
        },
        "canonical_static_copy": {
            "file": canonical_path.relative_to(OUT).as_posix(),
            "bytes": canonical_path.stat().st_size,
            "sha256": canonical_hash,
            "exact_byte_copy": exact_copy,
        },
        "usage_rule": {
            "attribution_required": True,
            "source_model_in_final_runtime": False,
            "source_textures_in_final_runtime": False,
            "source_and_generated_results_separate": True,
            "manual_visual_acceptance_required": True,
        },
    }
    write_json(OUT / "LICENSE_LOCK.json", license_lock)
    write_json(OUT / "GLTF_STRUCTURE_REPORT.json", gltf)
    write_json(OUT / "SURFACE_GEOMETRY_REPORT.json", mesh)

    selection = {
        "schema": "life_ecosystem/chicken_reference_selection@1.0",
        "created_at": now_iso(),
        "selected": True,
        "uid": UID,
        "reason": [
            "downloadable complete adult rooster",
            "CC attribution license reported by source metadata",
            "approximately fifty thousand triangles according to public listing",
            "suitable as complete external surface and material reference",
        ],
        "limitations": [
            "visual surface reference is not a veterinary anatomy authority",
            "internal skeleton and joint locations require independent anatomical sources",
            "selection does not imply final production approval",
        ],
        "next_test": "left distal hindlimb integrated surface-rig-joint-material reconstruction",
    }
    write_json(OUT / "REFERENCE_SELECTION.json", selection)

    readme = f"""# Chicken complete reference import\n\nSource UID: `{UID}`\n\nSource page: {SOURCE_PAGE}\n\nThis research package locks one complete realistic rooster reference, preserves the original GLB, creates an exact static copy, and records surface, material, skin, skeleton, and animation structure.\n\nThe source asset and source textures are reference-only and will not be embedded in the final code-only runtime. The first reconstruction test is the left distal hindlimb, handled as one integrated surface, material, joint, and control module.\n"""
    (OUT / "00_START_HERE.md").write_text(readme, encoding="utf-8")

    manifest_files = []
    for path in sorted(OUT.rglob("*")):
        if path.is_file() and path.name != "PACKAGE_MANIFEST.json":
            manifest_files.append({
                "path": path.relative_to(OUT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            })
    write_json(OUT / "PACKAGE_MANIFEST.json", {
        "schema": "life_ecosystem/chicken_complete_reference_import_package@1.0",
        "created_at": now_iso(),
        "files": manifest_files,
        "exact_static_copy": exact_copy,
    })

    print(json.dumps({
        "output": OUT.as_posix(),
        "uid": UID,
        "license": annotation.get("license"),
        "source_bytes": original_path.stat().st_size,
        "source_sha256": original_hash,
        "exact_static_copy": exact_copy,
        "mesh": mesh,
        "gltf": {
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
