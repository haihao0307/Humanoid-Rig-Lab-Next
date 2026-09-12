#!/usr/bin/env python3
"""Inspect embedded glTF canine references and export an immutable static OBJ surface.

This script is intentionally dependency-free so a GitHub Actions runner can create a
reproducible artifact from a pinned public CC0 source.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import struct
from pathlib import Path
from typing import Any, Iterable

COMPONENT = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_WIDTH = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ident() -> list[list[float]]:
    return [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]]


def mmul(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def translation(v: list[float]) -> list[list[float]]:
    m = ident()
    m[0][3], m[1][3], m[2][3] = map(float, v)
    return m


def scaling(v: list[float]) -> list[list[float]]:
    m = ident()
    m[0][0], m[1][1], m[2][2] = map(float, v)
    return m


def rotation(q: list[float]) -> list[list[float]]:
    x, y, z, w = map(float, q)
    n = math.sqrt(x*x + y*y + z*z + w*w) or 1.0
    x, y, z, w = x/n, y/n, z/n, w/n
    xx, yy, zz = x*x, y*y, z*z
    xy, xz, yz = x*y, x*z, y*z
    wx, wy, wz = w*x, w*y, w*z
    return [
        [1 - 2*(yy+zz), 2*(xy-wz), 2*(xz+wy), 0.0],
        [2*(xy+wz), 1 - 2*(xx+zz), 2*(yz-wx), 0.0],
        [2*(xz-wy), 2*(yz+wx), 1 - 2*(xx+yy), 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]


def node_matrix(node: dict[str, Any]) -> list[list[float]]:
    if "matrix" in node:
        raw = [float(x) for x in node["matrix"]]
        # glTF stores matrices column-major.
        return [[raw[c*4+r] for c in range(4)] for r in range(4)]
    t = translation(node.get("translation", [0, 0, 0]))
    r = rotation(node.get("rotation", [0, 0, 0, 1]))
    s = scaling(node.get("scale", [1, 1, 1]))
    return mmul(mmul(t, r), s)


def apply_point(m: list[list[float]], p: Iterable[float]) -> tuple[float, float, float]:
    x, y, z = map(float, p)
    v = [x, y, z, 1.0]
    out = [sum(m[r][k] * v[k] for k in range(4)) for r in range(4)]
    w = out[3] or 1.0
    return out[0] / w, out[1] / w, out[2] / w


def decode_buffers(doc: dict[str, Any], src: Path) -> list[bytes]:
    result: list[bytes] = []
    for i, item in enumerate(doc.get("buffers", [])):
        uri = item.get("uri")
        if not uri:
            raise ValueError(f"buffer {i} has no URI; GLB input is not supported by this script")
        if uri.startswith("data:"):
            head, payload = uri.split(",", 1)
            if ";base64" not in head:
                raise ValueError(f"buffer {i} data URI is not base64")
            raw = base64.b64decode(payload)
        else:
            raw = (src.parent / uri).read_bytes()
        declared = int(item.get("byteLength", len(raw)))
        if len(raw) < declared:
            raise ValueError(f"buffer {i} shorter than declared byteLength")
        result.append(raw)
    return result


def read_accessor(doc: dict[str, Any], buffers: list[bytes], index: int) -> list[Any]:
    acc = doc["accessors"][index]
    if "sparse" in acc:
        raise ValueError(f"sparse accessor {index} is not supported")
    view = doc["bufferViews"][acc["bufferView"]]
    comp_type = int(acc["componentType"])
    fmt, size = COMPONENT[comp_type]
    width = TYPE_WIDTH[acc["type"]]
    count = int(acc["count"])
    stride = int(view.get("byteStride", size * width))
    start = int(view.get("byteOffset", 0)) + int(acc.get("byteOffset", 0))
    raw = buffers[int(view["buffer"])]
    unpack = struct.Struct("<" + fmt * width)
    values: list[Any] = []
    for i in range(count):
        offset = start + i * stride
        value = unpack.unpack_from(raw, offset)
        values.append(value[0] if width == 1 else list(value))
    return values


def triangles_from_indices(indices: list[int], mode: int) -> list[tuple[int, int, int]]:
    if mode == 4:  # TRIANGLES
        return [(indices[i], indices[i+1], indices[i+2]) for i in range(0, len(indices) - 2, 3)]
    if mode == 5:  # TRIANGLE_STRIP
        out = []
        for i in range(len(indices) - 2):
            a, b, c = indices[i:i+3]
            out.append((a, b, c) if i % 2 == 0 else (b, a, c))
        return out
    if mode == 6:  # TRIANGLE_FAN
        return [(indices[0], indices[i], indices[i+1]) for i in range(1, len(indices)-1)]
    raise ValueError(f"unsupported primitive mode {mode}")


def build_world_matrices(doc: dict[str, Any]) -> dict[int, list[list[float]]]:
    nodes = doc.get("nodes", [])
    worlds: dict[int, list[list[float]]] = {}
    scene_index = int(doc.get("scene", 0)) if doc.get("scenes") else 0
    roots = doc.get("scenes", [{}])[scene_index].get("nodes", list(range(len(nodes))))

    def walk(idx: int, parent: list[list[float]]) -> None:
        world = mmul(parent, node_matrix(nodes[idx]))
        worlds[idx] = world
        for child in nodes[idx].get("children", []):
            walk(int(child), world)

    for root in roots:
        walk(int(root), ident())
    for idx in range(len(nodes)):
        if idx not in worlds:
            walk(idx, ident())
    return worlds


def inspect_and_export(src: Path, out_dir: Path) -> dict[str, Any]:
    doc = json.loads(src.read_text(encoding="utf-8"))
    buffers = decode_buffers(doc, src)
    worlds = build_world_matrices(doc)
    nodes = doc.get("nodes", [])
    meshes = doc.get("meshes", [])

    out_vertices: list[tuple[float, float, float]] = []
    out_faces: list[tuple[int, int, int]] = []
    primitive_rows: list[dict[str, Any]] = []

    for node_index, node in enumerate(nodes):
        if "mesh" not in node:
            continue
        mesh_index = int(node["mesh"])
        mesh = meshes[mesh_index]
        world = worlds[node_index]
        for primitive_index, primitive in enumerate(mesh.get("primitives", [])):
            attrs = primitive.get("attributes", {})
            if "POSITION" not in attrs:
                continue
            positions = read_accessor(doc, buffers, int(attrs["POSITION"]))
            transformed = [apply_point(world, p) for p in positions]
            base = len(out_vertices)
            out_vertices.extend(transformed)
            if "indices" in primitive:
                raw_indices = [int(x) for x in read_accessor(doc, buffers, int(primitive["indices"]))]
            else:
                raw_indices = list(range(len(positions)))
            faces = triangles_from_indices(raw_indices, int(primitive.get("mode", 4)))
            out_faces.extend((base+a+1, base+b+1, base+c+1) for a, b, c in faces)
            primitive_rows.append({
                "node_index": node_index,
                "node_name": node.get("name"),
                "mesh_index": mesh_index,
                "mesh_name": mesh.get("name"),
                "primitive_index": primitive_index,
                "material_index": primitive.get("material"),
                "vertex_count": len(positions),
                "triangle_count": len(faces),
                "attributes": sorted(attrs.keys()),
                "has_skin": "skin" in node,
                "skin_index": node.get("skin"),
            })

    if not out_vertices or not out_faces:
        raise ValueError("no triangle surface was extracted")

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = src.stem
    obj_path = out_dir / f"{stem}_immutable_surface.obj"
    with obj_path.open("w", encoding="utf-8", newline="\n") as f:
        f.write(f"# Static surface exported from {src.name}\n")
        f.write("# Immutable reference derivative; not the Bruce production mesh.\n")
        f.write(f"o {stem}_surface\n")
        for x, y, z in out_vertices:
            f.write(f"v {x:.9g} {y:.9g} {z:.9g}\n")
        for a, b, c in out_faces:
            f.write(f"f {a} {b} {c}\n")

    mins = [min(p[i] for p in out_vertices) for i in range(3)]
    maxs = [max(p[i] for p in out_vertices) for i in range(3)]
    extents = [maxs[i] - mins[i] for i in range(3)]

    skins = doc.get("skins", [])
    joint_ids = sorted({int(j) for skin in skins for j in skin.get("joints", [])})
    joints = [{"node_index": j, "name": nodes[j].get("name")} for j in joint_ids]
    animations = []
    for i, animation in enumerate(doc.get("animations", [])):
        paths: dict[str, int] = {}
        targets: set[int] = set()
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            path = str(target.get("path", "unknown"))
            paths[path] = paths.get(path, 0) + 1
            if "node" in target:
                targets.add(int(target["node"]))
        animations.append({
            "index": i,
            "name": animation.get("name", f"animation_{i}"),
            "channel_count": len(animation.get("channels", [])),
            "sampler_count": len(animation.get("samplers", [])),
            "target_node_count": len(targets),
            "target_paths": paths,
        })

    report = {
        "schema": "bruce/reference_gltf_inspection@1.0",
        "source_file": src.name,
        "source_size_bytes": src.stat().st_size,
        "source_sha256": sha256(src),
        "asset": doc.get("asset", {}),
        "scene_count": len(doc.get("scenes", [])),
        "node_count": len(nodes),
        "mesh_count": len(meshes),
        "mesh_node_count": sum(1 for n in nodes if "mesh" in n),
        "primitive_count": len(primitive_rows),
        "extracted_vertex_count": len(out_vertices),
        "extracted_triangle_count": len(out_faces),
        "material_count": len(doc.get("materials", [])),
        "texture_count": len(doc.get("textures", [])),
        "image_count": len(doc.get("images", [])),
        "skin_count": len(skins),
        "joint_count_unique": len(joint_ids),
        "animation_count": len(animations),
        "bounds": {"min": mins, "max": maxs, "extents": extents},
        "coordinate_note": "Coordinates are the source glTF default-scene rest surface after node transforms; no production canonicalization has been applied.",
        "primitive_inventory": primitive_rows,
        "joints": joints,
        "animations": animations,
        "exported_obj": obj_path.name,
        "exported_obj_sha256": sha256(obj_path),
    }
    report_path = out_dir / f"{stem}_inspection.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    summaries = []
    for src in args.inputs:
        summaries.append(inspect_and_export(src.resolve(), args.out.resolve()))
    aggregate = {
        "schema": "bruce/reference_set_inspection@1.0",
        "references": [{
            "source_file": r["source_file"],
            "source_sha256": r["source_sha256"],
            "vertices": r["extracted_vertex_count"],
            "triangles": r["extracted_triangle_count"],
            "joints": r["joint_count_unique"],
            "animations": r["animation_count"],
            "bounds": r["bounds"],
        } for r in summaries],
    }
    (args.out / "REFERENCE_SET_SUMMARY.json").write_text(
        json.dumps(aggregate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(aggregate, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
