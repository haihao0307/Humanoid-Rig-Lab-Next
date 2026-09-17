from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from collections import defaultdict
from pathlib import Path
from typing import Iterable

Vec3 = tuple[float, float, float]
Tri = tuple[int, int, int]

COMPONENT_FORMATS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def parse_obj(path: Path) -> tuple[list[Vec3], list[Tri]]:
    vertices: list[Vec3] = []
    triangles: list[Tri] = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if parts[0] == "v" and len(parts) >= 4:
            vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif parts[0] == "f" and len(parts) >= 4:
            face: list[int] = []
            for token in parts[1:]:
                index = int(token.split("/")[0])
                face.append(index - 1 if index > 0 else len(vertices) + index)
            for offset in range(1, len(face) - 1):
                triangles.append((face[0], face[offset], face[offset + 1]))
    return vertices, triangles


def parse_stl(path: Path) -> tuple[list[Vec3], list[Tri]]:
    data = path.read_bytes()
    if len(data) >= 84:
        count = struct.unpack_from("<I", data, 80)[0]
        if 84 + count * 50 == len(data):
            vertices: list[Vec3] = []
            triangles: list[Tri] = []
            dedupe: dict[Vec3, int] = {}
            offset = 84
            for _ in range(count):
                offset += 12
                indices = []
                for _ in range(3):
                    point = struct.unpack_from("<3f", data, offset)
                    offset += 12
                    key = (float(point[0]), float(point[1]), float(point[2]))
                    if key not in dedupe:
                        dedupe[key] = len(vertices)
                        vertices.append(key)
                    indices.append(dedupe[key])
                triangles.append(tuple(indices))
                offset += 2
            return vertices, triangles

    vertices = []
    triangles = []
    dedupe: dict[Vec3, int] = {}
    current: list[int] = []
    for raw in data.decode("utf-8", errors="replace").splitlines():
        parts = raw.strip().split()
        if len(parts) == 4 and parts[0].lower() == "vertex":
            point = (float(parts[1]), float(parts[2]), float(parts[3]))
            if point not in dedupe:
                dedupe[point] = len(vertices)
                vertices.append(point)
            current.append(dedupe[point])
            if len(current) == 3:
                triangles.append(tuple(current))
                current = []
    return vertices, triangles


def accessor_values(gltf: dict, binary: bytes, accessor_index: int) -> list[tuple[float | int, ...]]:
    accessor = gltf["accessors"][accessor_index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    component_type = accessor["componentType"]
    fmt, component_size = COMPONENT_FORMATS[component_type]
    count = TYPE_COUNTS[accessor["type"]]
    stride = view.get("byteStride", component_size * count)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    values = []
    unpack = struct.Struct("<" + fmt * count)
    for item in range(accessor["count"]):
        values.append(unpack.unpack_from(binary, start + item * stride))
    return values


def parse_glb(path: Path) -> tuple[list[Vec3], list[Tri]]:
    data = path.read_bytes()
    if data[:4] != b"glTF" or len(data) < 20:
        raise ValueError("not a GLB 2.0 file")
    version, total_length = struct.unpack_from("<II", data, 4)
    if version != 2 or total_length != len(data):
        raise ValueError("unsupported or truncated GLB")
    offset = 12
    gltf = None
    binary = b""
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            gltf = json.loads(chunk.decode("utf-8").rstrip("\x00 \t\r\n"))
        elif chunk_type == 0x004E4942:
            binary = chunk
    if gltf is None:
        raise ValueError("GLB JSON chunk missing")

    vertices: list[Vec3] = []
    triangles: list[Tri] = []
    for mesh in gltf.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4 or "POSITION" not in primitive.get("attributes", {}):
                continue
            positions = accessor_values(gltf, binary, primitive["attributes"]["POSITION"])
            base = len(vertices)
            vertices.extend((float(p[0]), float(p[1]), float(p[2])) for p in positions)
            if "indices" in primitive:
                indices = [int(v[0]) for v in accessor_values(gltf, binary, primitive["indices"])]
            else:
                indices = list(range(len(positions)))
            for i in range(0, len(indices) - 2, 3):
                triangles.append((base + indices[i], base + indices[i + 1], base + indices[i + 2]))
    return vertices, triangles


def parse_mesh(path: Path) -> tuple[list[Vec3], list[Tri]]:
    suffix = path.suffix.lower()
    if suffix == ".obj":
        return parse_obj(path)
    if suffix == ".stl":
        return parse_stl(path)
    if suffix == ".glb":
        return parse_glb(path)
    raise ValueError(f"unsupported input format: {suffix}")


def axis_index(name: str) -> tuple[int, float]:
    name = name.strip().lower()
    sign = -1.0 if name.startswith("-") else 1.0
    token = name.lstrip("+-")
    return {"x": 0, "y": 1, "z": 2}[token], sign


def remap(vertices: Iterable[Vec3], forward: str, left: str, up: str, scale: float) -> list[Vec3]:
    mapping = [axis_index(forward), axis_index(left), axis_index(up)]
    output = []
    for point in vertices:
        output.append(tuple(point[index] * sign * scale for index, sign in mapping))
    return output


def bounds(vertices: list[Vec3]) -> dict:
    mins = [min(point[i] for point in vertices) for i in range(3)]
    maxs = [max(point[i] for point in vertices) for i in range(3)]
    return {
        "min": mins,
        "max": maxs,
        "extent": [maxs[i] - mins[i] for i in range(3)],
        "centroid": [(maxs[i] + mins[i]) * 0.5 for i in range(3)],
    }


def topology_audit(vertex_count: int, triangles: list[Tri]) -> dict:
    parent = list(range(vertex_count))

    def find(value: int) -> int:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    edges: defaultdict[tuple[int, int], int] = defaultdict(int)
    used = set()
    invalid = 0
    degenerate = 0
    for tri in triangles:
        if any(index < 0 or index >= vertex_count for index in tri):
            invalid += 1
            continue
        if len(set(tri)) < 3:
            degenerate += 1
            continue
        a, b, c = tri
        used.update(tri)
        union(a, b)
        union(b, c)
        union(c, a)
        for first, second in ((a, b), (b, c), (c, a)):
            edge = (first, second) if first < second else (second, first)
            edges[edge] += 1
    components = len({find(index) for index in used}) if used else 0
    return {
        "connectedComponents": components,
        "boundaryEdges": sum(1 for count in edges.values() if count == 1),
        "nonManifoldEdges": sum(1 for count in edges.values() if count > 2),
        "invalidTriangles": invalid,
        "degenerateTriangles": degenerate,
        "usedVertices": len(used),
    }


def quantile(values: list[float], probability: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * probability)))
    return ordered[position]


def section_profile(vertices: list[Vec3], minimum_x: float, maximum_x: float, count: int = 21) -> list[dict]:
    extent = maximum_x - minimum_x
    half_slice = max(extent / (count * 2.5), 1e-9)
    sections = []
    for index in range(count):
        u = index / (count - 1)
        x = minimum_x + extent * u
        sample = [point for point in vertices if abs(point[0] - x) <= half_slice]
        if len(sample) < 4:
            sections.append({"u": u, "x": x, "sampleCount": len(sample), "valid": False})
            continue
        ys = [point[1] for point in sample]
        zs = [point[2] for point in sample]
        sections.append(
            {
                "u": u,
                "x": x,
                "sampleCount": len(sample),
                "valid": True,
                "centroid": [sum(p[0] for p in sample) / len(sample), sum(ys) / len(ys), sum(zs) / len(zs)],
                "halfWidthP95": (quantile(ys, 0.975) - quantile(ys, 0.025)) * 0.5,
                "halfDepthP95": (quantile(zs, 0.975) - quantile(zs, 0.025)) * 0.5,
                "minY": min(ys),
                "maxY": max(ys),
                "minZ": min(zs),
                "maxZ": max(zs),
            }
        )
    return sections


def axis_hypotheses(extent: list[float]) -> list[dict]:
    ordered = sorted(range(3), key=lambda index: extent[index], reverse=True)
    labels = "XYZ"
    hypotheses = []
    for up_index in range(3):
        remaining = [index for index in range(3) if index != up_index]
        forward_index = max(remaining, key=lambda index: extent[index])
        left_index = next(index for index in remaining if index != forward_index)
        hypotheses.append(
            {
                "forward": f"+{labels[forward_index]}",
                "left": f"+{labels[left_index]}",
                "up": f"+{labels[up_index]}",
                "scoreHint": "longest remaining extent as forward; requires manual confirmation",
            }
        )
    return hypotheses


def finite(vertices: list[Vec3]) -> bool:
    return all(math.isfinite(value) for point in vertices for value in point)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract an auditable cat-body reference profile from OBJ, STL or GLB.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source-metadata", type=Path)
    parser.add_argument("--forward", default="+x")
    parser.add_argument("--left", default="+y")
    parser.add_argument("--up", default="+z")
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--section-count", type=int, default=21)
    args = parser.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"input missing: {args.input}")
    source = None
    if args.source_metadata:
        source = json.loads(args.source_metadata.read_text(encoding="utf-8"))

    raw_vertices, triangles = parse_mesh(args.input)
    if not raw_vertices or not triangles:
        raise SystemExit("reference contains no supported triangle geometry")
    vertices = remap(raw_vertices, args.forward, args.left, args.up, args.scale)
    box = bounds(vertices)
    audit = topology_audit(len(vertices), triangles)
    profile = {
        "schema": "cat_kaopu/body_reference_profile@1.0",
        "input": {
            "fileName": args.input.name,
            "format": args.input.suffix.lower().lstrip("."),
            "sha256": sha256(args.input),
            "sourceMetadata": source,
            "rawReferenceDistributed": False,
        },
        "coordinateMapping": {
            "forward": args.forward,
            "left": args.left,
            "up": args.up,
            "scale": args.scale,
            "axisConfirmationRequired": True,
        },
        "geometry": {
            "vertexCount": len(vertices),
            "triangleCount": len(triangles),
            "finite": finite(vertices),
            "boundingBox": box,
            "topology": audit,
            "axisHypotheses": axis_hypotheses(box["extent"]),
        },
        "sections": section_profile(vertices, box["min"][0], box["max"][0], args.section_count),
        "geometricExtremeCandidates": {
            "forwardMin": min(range(len(vertices)), key=lambda i: vertices[i][0]),
            "forwardMax": max(range(len(vertices)), key=lambda i: vertices[i][0]),
            "leftMin": min(range(len(vertices)), key=lambda i: vertices[i][1]),
            "leftMax": max(range(len(vertices)), key=lambda i: vertices[i][1]),
            "upMin": min(range(len(vertices)), key=lambda i: vertices[i][2]),
            "upMax": max(range(len(vertices)), key=lambda i: vertices[i][2]),
            "warning": "geometric extremes are not anatomical landmarks",
        },
        "manualAnatomicalLandmarks": {},
        "decisionBoundary": {
            "mayDriveProceduralMeasurements": True,
            "mayShipRawReference": False,
            "mayAutoApproveMorphology": False,
            "mayStartSkinningBeforeAxisAndLandmarkReview": False,
        },
        "visualAcceptance": False,
        "productionReady": False,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "vertices": len(vertices), "triangles": len(triangles), **audit}, indent=2))


if __name__ == "__main__":
    main()
