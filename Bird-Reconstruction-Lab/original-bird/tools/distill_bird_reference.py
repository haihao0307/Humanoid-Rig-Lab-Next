#!/usr/bin/env python3
"""Create an R1 Original Bird source-distillation card from GLB 2.0 bytes.

The tool deliberately does not infer species, metres, natural anatomy, or production
readiness from a model file. It records auditable source facts and semantic hints.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterable

GLB_MAGIC = 0x46546C67
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942

SEMANTIC_PATTERNS = {
    "rootTrunk": re.compile(r"root|pelvis|hip$|spine|chest|body|back", re.I),
    "neckHeadBeak": re.compile(r"neck|cerv|head|beak|bill|jaw|tongue", re.I),
    "wingArm": re.compile(r"wing|up.?arm|humer|fore.?arm|radius|ulna|wrist|carp|hand|manus", re.I),
    "flightFeather": re.compile(r"primary|secondary|remex|feather|fly", re.I),
    "tail": re.compile(r"tail|rectrix", re.I),
    "hindlimbToe": re.compile(r"thigh|leg|calf|knee|shin|ankle|foot|toe|digit", re.I),
    "eyeFace": re.compile(r"eye|lid|pupil", re.I),
}


def _read_glb(path: Path) -> tuple[dict[str, Any], bytes, bytes]:
    raw = path.read_bytes()
    if len(raw) < 20:
        raise ValueError("file is too short to be GLB 2.0")
    magic, version, total_length = struct.unpack_from("<III", raw, 0)
    if magic != GLB_MAGIC or version != 2:
        raise ValueError("expected GLB 2.0")
    if total_length != len(raw):
        raise ValueError(f"GLB header length {total_length} != file bytes {len(raw)}")
    offset = 12
    document: dict[str, Any] | None = None
    binary = b""
    while offset + 8 <= len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunk = raw[offset : offset + length]
        offset += length
        if chunk_type == JSON_CHUNK:
            document = json.loads(chunk.rstrip(b"\x00 \t\r\n").decode("utf-8"))
        elif chunk_type == BIN_CHUNK and not binary:
            binary = chunk
    if document is None:
        raise ValueError("GLB has no JSON chunk")
    return document, binary, raw


def _node_parents(nodes: list[dict[str, Any]]) -> list[int | None]:
    parents: list[int | None] = [None] * len(nodes)
    for parent_index, node in enumerate(nodes):
        for child in node.get("children", []):
            if 0 <= child < len(nodes):
                parents[child] = parent_index
    return parents


def _node_name(nodes: list[dict[str, Any]], index: int) -> str:
    return nodes[index].get("name") or f"node_{index}"


def _accessor_scalar_max(document: dict[str, Any], binary: bytes, accessor_index: int) -> float | None:
    accessors = document.get("accessors", [])
    if not (0 <= accessor_index < len(accessors)):
        return None
    accessor = accessors[accessor_index]
    if accessor.get("type") != "SCALAR" or accessor.get("componentType") != 5126:
        declared = accessor.get("max")
        return float(declared[0]) if declared else None
    declared = accessor.get("max")
    if declared:
        return float(declared[0])
    view_index = accessor.get("bufferView")
    if view_index is None:
        return None
    views = document.get("bufferViews", [])
    if not (0 <= view_index < len(views)):
        return None
    view = views[view_index]
    count = int(accessor.get("count", 0))
    if count <= 0:
        return None
    start = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    stride = int(view.get("byteStride", 4))
    values: list[float] = []
    for i in range(count):
        pos = start + i * stride
        if pos + 4 > len(binary):
            return None
        values.append(struct.unpack_from("<f", binary, pos)[0])
    return max(values) if values else None


def _mesh_counts(document: dict[str, Any]) -> dict[str, int]:
    accessors = document.get("accessors", [])
    vertices = 0
    triangles = 0
    primitives = 0
    morph_sets = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitives += 1
            attrs = primitive.get("attributes", {})
            position_index = attrs.get("POSITION")
            if isinstance(position_index, int) and 0 <= position_index < len(accessors):
                position_count = int(accessors[position_index].get("count", 0))
                vertices += position_count
            else:
                position_count = 0
            mode = int(primitive.get("mode", 4))
            index_index = primitive.get("indices")
            index_count = int(accessors[index_index].get("count", 0)) if isinstance(index_index, int) and 0 <= index_index < len(accessors) else position_count
            if mode == 4:
                triangles += index_count // 3
            morph_sets += len(primitive.get("targets", []))
    return {"primitives": primitives, "vertices": vertices, "triangles": triangles, "morphTargetSets": morph_sets}


def _declared_position_bounds(document: dict[str, Any]) -> dict[str, Any]:
    accessors = document.get("accessors", [])
    mins: list[list[float]] = []
    maxs: list[list[float]] = []
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            index = primitive.get("attributes", {}).get("POSITION")
            if not isinstance(index, int) or not (0 <= index < len(accessors)):
                continue
            accessor = accessors[index]
            if accessor.get("min") and accessor.get("max"):
                mins.append([float(v) for v in accessor["min"][:3]])
                maxs.append([float(v) for v in accessor["max"][:3]])
    if not mins:
        return {"status": "UNAVAILABLE"}
    lower = [min(row[i] for row in mins) for i in range(3)]
    upper = [max(row[i] for row in maxs) for i in range(3)]
    extent = [upper[i] - lower[i] for i in range(3)]
    return {"status": "ACCESSOR_LOCAL_BOUNDS_ONLY", "min": lower, "max": upper, "extent": extent}


def _skin_joint_report(document: dict[str, Any]) -> dict[str, Any]:
    nodes = document.get("nodes", [])
    parents = _node_parents(nodes)
    joint_indices = sorted({joint for skin in document.get("skins", []) for joint in skin.get("joints", []) if isinstance(joint, int) and 0 <= joint < len(nodes)})
    names = [_node_name(nodes, index) for index in joint_indices]
    semantics: dict[str, list[str]] = {key: [] for key in SEMANTIC_PATTERNS}
    for name in names:
        for key, pattern in SEMANTIC_PATTERNS.items():
            if pattern.search(name):
                semantics[key].append(name)
    edges = []
    joint_set = set(joint_indices)
    for child in joint_indices:
        parent = parents[child]
        if parent in joint_set:
            edges.append({"parent": _node_name(nodes, parent), "child": _node_name(nodes, child)})
    return {
        "jointCount": len(joint_indices),
        "jointNames": names,
        "semanticHints": semantics,
        "jointEdges": edges,
        "semanticBoundary": "Name matching is a routing hint, not anatomical homology. Generic or reused rigs require manual mapping."
    }


def _animation_report(document: dict[str, Any], binary: bytes) -> list[dict[str, Any]]:
    nodes = document.get("nodes", [])
    report = []
    for animation in document.get("animations", []):
        paths: dict[str, int] = {}
        targets: set[str] = set()
        end_time = 0.0
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            path = str(target.get("path", "unknown"))
            paths[path] = paths.get(path, 0) + 1
            node_index = target.get("node")
            if isinstance(node_index, int) and 0 <= node_index < len(nodes):
                targets.add(_node_name(nodes, node_index))
            sampler_index = channel.get("sampler")
            samplers = animation.get("samplers", [])
            if isinstance(sampler_index, int) and 0 <= sampler_index < len(samplers):
                maximum = _accessor_scalar_max(document, binary, samplers[sampler_index].get("input", -1))
                if maximum is not None and math.isfinite(maximum):
                    end_time = max(end_time, maximum)
        report.append({
            "name": animation.get("name") or "unnamed",
            "exportedTimelineEnd": end_time,
            "channelCount": len(animation.get("channels", [])),
            "paths": paths,
            "targetNodeCount": len(targets),
            "timingBoundary": "glTF timestamps are recorded, but biological cadence is not accepted until clip phase and exporter scaling are audited."
        })
    return report


def _structural_gates(joints: dict[str, Any]) -> dict[str, Any]:
    hints = joints["semanticHints"]
    wing = len(hints["wingArm"])
    feather = len(hints["flightFeather"])
    leg = len(hints["hindlimbToe"])
    neck = len(hints["neckHeadBeak"])
    names = joints["jointNames"]
    reused_chicken = any(name.lower().startswith("chicken_") for name in names)
    generic_ratio = sum(1 for name in names if re.fullmatch(r"(?:Bone(?:\.\d+)?|node_\d+)(?:_\d+)?", name, re.I)) / max(1, len(names))
    return {
        "wingChainEvidence": "PRESENT" if wing >= 4 else "PARTIAL_OR_ABSENT",
        "explicitFlightFeatherEvidence": "PRESENT" if feather >= 2 else "ABSENT_OR_UNNAMED",
        "hindlimbToeEvidence": "PRESENT" if leg >= 4 else "PARTIAL_OR_ABSENT",
        "neckHeadEvidence": "PRESENT" if neck >= 2 else "PARTIAL_OR_ABSENT",
        "reusedChickenRigDetected": reused_chicken,
        "genericJointNameRatio": round(generic_ratio, 4),
        "automaticSemanticPromotionAllowed": bool(wing >= 4 and neck >= 2 and not reused_chicken and generic_ratio < 0.5)
    }


def distill(path: Path) -> dict[str, Any]:
    document, binary, raw = _read_glb(path)
    asset = document.get("asset", {})
    extras = asset.get("extras", {}) if isinstance(asset.get("extras"), dict) else {}
    mesh_counts = _mesh_counts(document)
    joints = _skin_joint_report(document)
    counts = {
        "scenes": len(document.get("scenes", [])),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        **mesh_counts,
        "materials": len(document.get("materials", [])),
        "textures": len(document.get("textures", [])),
        "skins": len(document.get("skins", [])),
        "joints": joints["jointCount"],
        "animations": len(document.get("animations", [])),
    }
    return {
        "schema": "bird/original-bird-source-audit@0.2",
        "identity": {
            "sourceFilename": path.name,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw),
            "title": extras.get("title"),
            "author": extras.get("author"),
            "license": extras.get("license"),
            "sourceUrl": extras.get("source"),
            "exactSpeciesStatus": "UNRESOLVED"
        },
        "sourceGrade": {
            "authority": "R1_REFERENCE_CALIBRATION",
            "naturalTruthAllowed": False,
            "note": "A third-party GLB may support measurement and comparison, but does not establish natural species truth or production ownership."
        },
        "fileAudit": {
            "generator": asset.get("generator"),
            "version": asset.get("version"),
            "counts": counts,
            "declaredLocalBounds": _declared_position_bounds(document),
            "skin": joints,
            "animations": _animation_report(document, binary)
        },
        "coordinateGate": {"unitStatus": "UNKNOWN", "forwardAxisStatus": "UNKNOWN", "upAxisStatus": "UNKNOWN", "realScaleStatus": "UNKNOWN"},
        "structuralGates": _structural_gates(joints),
        "validation": {
            "byteAudit": True,
            "jsonStructureAudit": True,
            "numericQA": True,
            "semanticQA": False,
            "visualQA": False,
            "sourceRemovalQA": False,
            "acceptedForProduction": False
        }
    }


def _make_test_glb(path: Path) -> None:
    positions = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    times = struct.pack("<2f", 0, 1)
    binary = positions + times
    document = {
        "asset": {"version": "2.0", "extras": {"title": "self-test"}},
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(positions)}, {"buffer": 0, "byteOffset": len(positions), "byteLength": len(times)}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0]},
            {"bufferView": 1, "componentType": 5126, "count": 2, "type": "SCALAR", "min": [0], "max": [1]}
        ],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
        "nodes": [{"name": "root", "children": [1]}, {"name": "Wing.L", "mesh": 0}],
        "skins": [{"joints": [0, 1]}],
        "animations": [{"name": "test", "samplers": [{"input": 1, "output": 0}], "channels": [{"sampler": 0, "target": {"node": 1, "path": "rotation"}}]}],
        "scenes": [{"nodes": [0]}], "scene": 0
    }
    js = json.dumps(document, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    binary += b"\x00" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    raw = struct.pack("<III", GLB_MAGIC, 2, total)
    raw += struct.pack("<II", len(js), JSON_CHUNK) + js
    raw += struct.pack("<II", len(binary), BIN_CHUNK) + binary
    path.write_bytes(raw)


def self_test() -> None:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "test.glb"
        _make_test_glb(path)
        card = distill(path)
        assert card["fileAudit"]["counts"]["vertices"] == 3
        assert card["fileAudit"]["counts"]["joints"] == 2
        assert card["fileAudit"]["animations"][0]["exportedTimelineEnd"] == 1.0
        assert card["structuralGates"]["wingChainEvidence"] == "PARTIAL_OR_ABSENT"
    print("SELF_TEST_OK")


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="*", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(list(argv) if argv is not None else None)
    if args.self_test:
        self_test()
        return 0
    if not args.inputs:
        parser.error("provide one or more .glb files, or use --self-test")
    cards = [distill(path) for path in args.inputs]
    payload: Any = cards[0] if len(cards) == 1 else {"schema": "bird/original-bird-source-audit-batch@0.2", "items": cards}
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
