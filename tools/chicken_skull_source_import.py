from __future__ import annotations

import hashlib
import json
import re
import shutil
import traceback
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ARTICLE_ID = 29618981
FIGSHARE_API = f"https://api.figshare.com/v2/articles/{ARTICLE_ID}"
DIGIMORPH_SPECIMEN = "https://digimorph.org/specimens/Gallus_gallus/adult/"
DIGIMORPH_COPYRIGHT = "https://digimorph.org/about/copyright.html"
SKETCHFAB_MODELS = {
    "overt_fmnh_492179": "5d4e3fbcdaf3414da98d007d2d5b45f1",
    "asaez_upper_skull": "42b903559b0342acbd1f09f5e14a8ac0",
}
OUT = Path("out/chicken-skull-s3")
RAW = OUT / "source" / "original"
CANON = OUT / "canonical" / "static-copy"
META = OUT / "metadata"
EXTRACTED = OUT / "extracted"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Humanoid-Rig-Lab-Next Chicken-Skull-S3 source-lock/1.0",
    "Accept": "*/*",
})


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


def safe_name(value: str) -> str:
    value = value.replace("\\", "_").replace("/", "_")
    value = re.sub(r"[^A-Za-z0-9._()+ -]+", "_", value).strip(" .")
    return value or "unnamed"


def fetch(url: str, target: Path, timeout: int = 180) -> dict[str, Any]:
    target.parent.mkdir(parents=True, exist_ok=True)
    with SESSION.get(url, timeout=timeout, stream=True, allow_redirects=True) as response:
        response.raise_for_status()
        with target.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
        return {
            "request_url": url,
            "resolved_url": response.url,
            "status_code": response.status_code,
            "content_type": response.headers.get("content-type"),
            "content_length_header": response.headers.get("content-length"),
            "etag": response.headers.get("etag"),
            "last_modified": response.headers.get("last-modified"),
            "bytes": target.stat().st_size,
            "sha256": sha256_file(target),
            "path": target.as_posix(),
        }


def snapshot(url: str, filename: str) -> dict[str, Any]:
    try:
        return {"ok": True, **fetch(url, META / filename, timeout=90)}
    except Exception as exc:
        return {"ok": False, "request_url": url, "error": f"{type(exc).__name__}: {exc}"}


def normalize_license(value: Any) -> str | None:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        for key in ("name", "title", "url", "slug"):
            item = value.get(key)
            if isinstance(item, str) and item.strip():
                return item.strip()
    return None


def commercial_ok(name: str | None) -> bool:
    if not name:
        return False
    value = name.lower().replace("_", " ")
    blocked = any(token in value for token in ("by-nc", "by nc", "noncommercial", "non-commercial", "non commercial"))
    permitted = any(token in value for token in ("cc0", "public domain", "cc by", "cc-by", "attribution"))
    return permitted and not blocked


def exact_copy(source: Path, target: Path) -> dict[str, Any]:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    source_hash = sha256_file(source)
    target_hash = sha256_file(target)
    return {
        "source_path": source.as_posix(),
        "canonical_path": target.as_posix(),
        "source_bytes": source.stat().st_size,
        "canonical_bytes": target.stat().st_size,
        "source_sha256": source_hash,
        "canonical_sha256": target_hash,
        "hash_identical": source_hash == target_hash,
        "exact_byte_copy": source.read_bytes() == target.read_bytes(),
    }


def inspect_mesh(path: Path) -> dict[str, Any]:
    row: dict[str, Any] = {
        "path": path.as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }
    try:
        import numpy as np
        import trimesh

        loaded = trimesh.load(path, force="scene", process=False)
        geometries = list(loaded.geometry.values()) if isinstance(loaded, trimesh.Scene) else [loaded]
        total_vertices = 0
        total_faces = 0
        bounds_min = np.array([np.inf, np.inf, np.inf], dtype=float)
        bounds_max = np.array([-np.inf, -np.inf, -np.inf], dtype=float)
        mesh_rows = []
        for index, geometry in enumerate(geometries):
            if not isinstance(geometry, trimesh.Trimesh):
                continue
            vertices = int(len(geometry.vertices))
            faces = int(len(geometry.faces))
            total_vertices += vertices
            total_faces += faces
            if vertices:
                bounds_min = np.minimum(bounds_min, geometry.bounds[0])
                bounds_max = np.maximum(bounds_max, geometry.bounds[1])
            mesh_rows.append({
                "geometry_index": index,
                "vertices": vertices,
                "faces": faces,
                "watertight": bool(geometry.is_watertight),
                "winding_consistent": bool(geometry.is_winding_consistent),
                "body_count": int(geometry.body_count),
            })
        finite = bool(np.isfinite(bounds_min).all() and np.isfinite(bounds_max).all())
        row.update({
            "load_ok": True,
            "geometry_count": len(mesh_rows),
            "total_vertices": total_vertices,
            "total_faces": total_faces,
            "bounds_min": bounds_min.tolist() if finite else None,
            "bounds_max": bounds_max.tolist() if finite else None,
            "extents": (bounds_max - bounds_min).tolist() if finite else None,
            "geometries": mesh_rows,
        })
    except Exception as exc:
        row.update({"load_ok": False, "error": f"{type(exc).__name__}: {exc}"})
    return row


def import_figshare() -> dict[str, Any]:
    response = SESSION.get(FIGSHARE_API, timeout=90)
    response.raise_for_status()
    article = response.json()
    write_json(META / "figshare_article_29618981.json", article)
    record: dict[str, Any] = {
        "ok": True,
        "article_id": ARTICLE_ID,
        "api_url": FIGSHARE_API,
        "title": article.get("title"),
        "doi": article.get("doi"),
        "version": article.get("version"),
        "license": article.get("license"),
        "license_name": normalize_license(article.get("license")),
        "files": [],
    }
    destination = RAW / "figshare_29618981"
    for item in article.get("files", []):
        name = safe_name(str(item.get("name") or f"file-{item.get('id')}"))
        target = destination / name
        file_row = {
            "id": item.get("id"),
            "name": item.get("name"),
            "reported_size": item.get("size"),
            "reported_md5": item.get("computed_md5") or item.get("supplied_md5"),
            "download_url": item.get("download_url"),
        }
        try:
            file_row["download"] = fetch(str(item["download_url"]), target)
        except Exception as exc:
            file_row["download_error"] = f"{type(exc).__name__}: {exc}"
        record["files"].append(file_row)

    for archive in destination.glob("*.zip"):
        out_dir = EXTRACTED / archive.stem
        out_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as handle:
            handle.extractall(out_dir)

    keywords = ("gallus", "chicken", "domesticus", "domestic")
    gallus_candidates = []
    meshes = []
    for path in sorted(EXTRACTED.rglob("*")):
        if not path.is_file():
            continue
        matched_by = []
        if any(key in path.name.lower() for key in keywords):
            matched_by.append("filename")
        if path.suffix.lower() in {".pts", ".txt", ".csv", ".tsv", ".json", ".r"} and path.stat().st_size <= 5_000_000:
            try:
                text = path.read_text(encoding="utf-8", errors="ignore").lower()
                if any(key in text for key in keywords):
                    matched_by.append("content")
            except Exception:
                pass
        if matched_by:
            gallus_candidates.append({
                "path": path.as_posix(),
                "relative_path": path.relative_to(EXTRACTED).as_posix(),
                "matched_by": matched_by,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            })
        if path.suffix.lower() in {".ply", ".stl", ".obj", ".glb", ".gltf"}:
            meshes.append(inspect_mesh(path))
    record["gallus_candidates"] = gallus_candidates
    record["mesh_inventory"] = meshes
    write_json(META / "figshare_import_receipt.json", record)
    return record


def import_objaverse() -> dict[str, Any]:
    record: dict[str, Any] = {
        "ok": False,
        "uids": SKETCHFAB_MODELS,
        "sketchfab_metadata": {},
        "annotations": {},
        "objects": {},
    }
    for label, uid in SKETCHFAB_MODELS.items():
        url = f"https://api.sketchfab.com/v3/models/{uid}"
        try:
            response = SESSION.get(url, timeout=90)
            response.raise_for_status()
            value = response.json()
            record["sketchfab_metadata"][label] = value
            write_json(META / f"sketchfab_{label}_{uid}.json", value)
        except Exception as exc:
            record["sketchfab_metadata"][label] = {"url": url, "error": f"{type(exc).__name__}: {exc}"}

    try:
        import objaverse

        uids = list(SKETCHFAB_MODELS.values())
        annotations = objaverse.load_annotations(uids)
        record["annotations"] = annotations
        write_json(META / "objaverse_annotations.json", annotations)
        paths = objaverse.load_objects(uids=uids, download_processes=1)
        for label, uid in SKETCHFAB_MODELS.items():
            source_path_string = paths.get(uid)
            if not source_path_string:
                record["objects"][label] = {"uid": uid, "downloaded": False}
                continue
            downloaded = Path(source_path_string)
            original = RAW / "objaverse" / f"{label}_{uid}{downloaded.suffix.lower()}"
            original.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(downloaded, original)
            canonical = CANON / original.name
            annotation = annotations.get(uid) or {}
            metadata = record["sketchfab_metadata"].get(label) or {}
            license_value = annotation.get("license") or metadata.get("license")
            license_name = normalize_license(license_value)
            record["objects"][label] = {
                "uid": uid,
                "downloaded": True,
                "source_path": original.as_posix(),
                "source_mesh": inspect_mesh(original),
                "canonical_copy": exact_copy(original, canonical),
                "license": license_value,
                "license_name": license_name,
                "commercial_redistribution_allowed": commercial_ok(license_name),
                "annotation": annotation,
            }
        record["ok"] = any(item.get("downloaded") for item in record["objects"].values())
    except Exception as exc:
        record["error"] = f"{type(exc).__name__}: {exc}"
        record["traceback"] = traceback.format_exc()
    write_json(META / "objaverse_import_receipt.json", record)
    return record


def build_license_lock(figshare: dict[str, Any], objaverse_record: dict[str, Any], snapshots: dict[str, Any]) -> dict[str, Any]:
    fig_license = figshare.get("license_name")
    sources = [{
        "id": "FIGSHARE_29618981_AVIAN_PALATE",
        "scope": "palatine and pterygoid meshes and landmarks; full cranium not guaranteed",
        "authority": "peer-reviewed paper data deposit",
        "license": figshare.get("license"),
        "license_name": fig_license,
        "commercial_redistribution_allowed": commercial_ok(fig_license),
        "downloaded": any("download" in item for item in figshare.get("files", [])),
        "gallus_candidate_count": len(figshare.get("gallus_candidates", [])),
    }]
    for label, item in objaverse_record.get("objects", {}).items():
        sources.append({
            "id": f"OBJAVERSE_SKETCHFAB_{label.upper()}",
            "scope": "whole or upper chicken skull surface depending on source object",
            "authority": "oVert/Blackburn Lab museum specimen" if label == "overt_fmnh_492179" else "veterinary anatomy educational source",
            "license": item.get("license"),
            "license_name": item.get("license_name"),
            "commercial_redistribution_allowed": item.get("commercial_redistribution_allowed", False),
            "downloaded": item.get("downloaded", False),
            "source_path": item.get("source_path"),
        })
    sources.append({
        "id": "DIGIMORPH_TMM_M1545",
        "scope": "adult whole chicken skull CT/STL morphology reference",
        "authority": "University of Texas Digital Morphology, museum specimen TMM M-1545",
        "license_name": "DigiMorph copyright, personal education only without written agreement",
        "commercial_redistribution_allowed": False,
        "downloaded": False,
        "reason": "Binary excluded because published terms require written permission for commercial reproduction, redistribution, publication, and other use.",
        "snapshots": snapshots,
    })

    full_skull = None
    for preferred in ("overt_fmnh_492179", "asaez_upper_skull"):
        item = objaverse_record.get("objects", {}).get(preferred, {})
        if item.get("downloaded") and item.get("commercial_redistribution_allowed"):
            full_skull = {"source": preferred, "path": item.get("source_path"), "status": "eligible_candidate"}
            break
    partial = None
    if sources[0]["downloaded"] and sources[0]["commercial_redistribution_allowed"]:
        partial = {
            "source": "FIGSHARE_29618981_AVIAN_PALATE",
            "status": "eligible_component_truth",
            "gallus_candidate_count": sources[0]["gallus_candidate_count"],
        }
    return {
        "schema": "life_ecosystem/chicken_skull_source_license_lock@1.0",
        "created_at": now_iso(),
        "sources": sources,
        "primary_full_skull_candidate": full_skull,
        "authoritative_component_truth": partial,
        "whole_skull_gate": "open" if full_skull else "blocked_pending_permissive_full_skull_source",
        "function_recording_gate": "open_for_imported_components" if partial or full_skull else "blocked",
        "rules": {
            "original_and_generated_results_separate": True,
            "immutable_original_bytes": True,
            "exact_static_copy_required_before_parameterization": True,
            "source_mesh_in_final_runtime": False,
            "manual_visual_acceptance_required": True,
            "muscle_skin_feather_stages_locked": True,
        },
    }


def main() -> None:
    for folder in (RAW, CANON, META, EXTRACTED):
        folder.mkdir(parents=True, exist_ok=True)
    snapshots = {
        "digimorph_specimen": snapshot(DIGIMORPH_SPECIMEN, "digimorph_gallus_adult.html"),
        "digimorph_copyright": snapshot(DIGIMORPH_COPYRIGHT, "digimorph_copyright.html"),
    }
    result: dict[str, Any] = {"started_at": now_iso(), "snapshots": snapshots}
    try:
        result["figshare"] = import_figshare()
    except Exception as exc:
        result["figshare"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}", "traceback": traceback.format_exc()}
        write_json(META / "figshare_import_receipt.json", result["figshare"])
    result["objaverse"] = import_objaverse()
    license_lock = build_license_lock(result["figshare"], result["objaverse"], snapshots)
    write_json(OUT / "CHICKEN_SKULL_S3_LICENSE_LOCK.json", license_lock)

    files = []
    for path in sorted(OUT.rglob("*")):
        if path.is_file():
            files.append({
                "path": path.relative_to(OUT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            })
    result["completed_at"] = now_iso()
    result["files_before_receipt"] = files
    write_json(OUT / "CHICKEN_SKULL_S3_SOURCE_IMPORT_RECEIPT.json", result)

    attribution = [
        "# Chicken Skull S3 Source Attribution and Restrictions",
        "",
        "## Figshare 29618981",
        f"Title: {result['figshare'].get('title')}",
        f"DOI: {result['figshare'].get('doi')}",
        f"License: {result['figshare'].get('license_name')}",
        "Use: palatine and pterygoid source meshes and landmark files when a Gallus specimen is present.",
        "",
        "## Sketchfab and Objaverse candidates",
        "Each imported object retains its Sketchfab UID, Objaverse annotation, author metadata, and license record in metadata/.",
        "No object enters the commercial pipeline unless its recorded license permits commercial redistribution with attribution.",
        "",
        "## DigiMorph TMM M-1545",
        "Used as scientific morphology reference only. Its binary STL is excluded because published DigiMorph terms require written permission for commercial reproduction, redistribution, publication, and other use.",
        "",
        "## Separation rule",
        "source/original contains immutable imported bytes. canonical/static-copy contains exact byte copies for identity verification. Future procedural reconstructions must live outside both directories.",
    ]
    (OUT / "ATTRIBUTION_AND_RESTRICTIONS.md").write_text("\n".join(attribution) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": OUT.as_posix(),
        "figshare_ok": result["figshare"].get("ok"),
        "objaverse_ok": result["objaverse"].get("ok"),
        "license_lock": license_lock,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
