from __future__ import annotations

import hashlib
import json
import re
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

DATASET_DOI = "10.5061/dryad.fr684"
DATASET_PAGE = "https://datadryad.org/dataset/doi:10.5061/dryad.fr684"
DRYAD_TERMS_PAGE = "https://datadryad.org/terms"
ZENODO_RECORD = 4973981
ZENODO_PAGE = f"https://zenodo.org/records/{ZENODO_RECORD}"
ZIP_NAME = "Muyshondt et al. - Data and code.zip"
README_NAME = "README_for_Muyshondt et al. - Data and code.txt"
ZIP_URLS = [
    f"https://zenodo.org/records/{ZENODO_RECORD}/files/{quote(ZIP_NAME)}?download=1",
    f"https://zenodo.org/api/records/{ZENODO_RECORD}/files/{quote(ZIP_NAME)}/content",
]
README_URLS = [
    f"https://zenodo.org/records/{ZENODO_RECORD}/files/{quote(README_NAME)}?download=1",
    f"https://zenodo.org/api/records/{ZENODO_RECORD}/files/{quote(README_NAME)}/content",
]
OUT = Path("out/chicken-skull-dryad-probe")
SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Humanoid-Rig-Lab-Next Chicken-Skull-S3 Dryad-Zenodo probe/1.1",
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


def fetch(url: str, target: Path, timeout: int = 300) -> dict[str, Any]:
    target.parent.mkdir(parents=True, exist_ok=True)
    with SESSION.get(url, timeout=timeout, stream=True, allow_redirects=True) as response:
        response.raise_for_status()
        with target.open("wb") as handle:
            for chunk in response.iter_content(1024 * 1024):
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


def fetch_first(urls: list[str], target: Path, timeout: int) -> tuple[dict[str, Any], list[dict[str, str]]]:
    failures = []
    for url in urls:
        try:
            return fetch(url, target, timeout=timeout), failures
        except Exception as exc:
            failures.append({"url": url, "error": f"{type(exc).__name__}: {exc}"})
    raise RuntimeError(f"all source URLs failed: {failures}")


def safe_member_path(name: str) -> Path:
    path = Path(name)
    clean = Path(*[part for part in path.parts if part not in {"", ".", ".."}])
    return clean


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    source = OUT / "source"
    metadata = OUT / "metadata"
    selected = OUT / "selected"
    source.mkdir(parents=True, exist_ok=True)
    metadata.mkdir(parents=True, exist_ok=True)
    selected.mkdir(parents=True, exist_ok=True)

    snapshots = {}
    for label, url in (
        ("dryad_dataset_page", DATASET_PAGE),
        ("dryad_terms", DRYAD_TERMS_PAGE),
        ("zenodo_record_page", ZENODO_PAGE),
    ):
        target = metadata / f"{label}.html"
        try:
            snapshots[label] = {"ok": True, **fetch(url, target, timeout=90)}
        except Exception as exc:
            snapshots[label] = {"ok": False, "request_url": url, "error": f"{type(exc).__name__}: {exc}"}

    readme_path = source / README_NAME
    readme_receipt, readme_failures = fetch_first(README_URLS, readme_path, timeout=120)
    archive_path = source / ZIP_NAME
    archive_receipt, archive_failures = fetch_first(ZIP_URLS, archive_path, timeout=900)

    mesh_extensions = {".stl", ".ply", ".obj", ".off", ".vtk", ".vtp", ".gii", ".glb", ".gltf", ".msh", ".inp"}
    volume_extensions = {".dcm", ".dicom", ".nii", ".nrrd", ".mhd", ".mha", ".raw", ".vol", ".am", ".tif", ".tiff"}
    numeric_extensions = {".mat", ".csv", ".tsv", ".txt", ".m", ".json", ".xml", ".dat"}
    keywords = (
        "skull", "cranium", "beak", "bill", "quadrate", "pterygoid", "palatine", "head",
        "ct", "mesh", "model", "geometry", "rooster", "hen", "chicken", "gallus", "bone",
        "node", "element", "vertex", "vertices", "face", "faces", "surface", "fem",
    )
    text_extensions = {".txt", ".m", ".csv", ".tsv", ".json", ".xml", ".md"}

    members = []
    candidates = []
    text_hits = []
    extracted = []
    max_individual_extract_bytes = 120_000_000
    max_total_extract_bytes = 300_000_000
    total_extracted = 0

    with zipfile.ZipFile(archive_path) as archive:
        for info in archive.infolist():
            path = Path(info.filename)
            suffix = path.suffix.lower()
            name_lower = info.filename.lower()
            row = {
                "name": info.filename,
                "bytes": info.file_size,
                "compressed_bytes": info.compress_size,
                "crc32": f"{info.CRC:08X}",
                "extension": suffix,
                "is_directory": info.is_dir(),
            }
            members.append(row)
            reasons = []
            if suffix in mesh_extensions:
                reasons.append("mesh_extension")
            if suffix in volume_extensions:
                reasons.append("volume_extension")
            if suffix in numeric_extensions:
                reasons.append("numeric_or_code_extension")
            matched_keywords = [key for key in keywords if key in name_lower]
            if matched_keywords:
                reasons.append("name_keyword")
            if reasons:
                candidate = {**row, "reasons": reasons, "matched_keywords": matched_keywords}
                candidates.append(candidate)
                should_extract = (
                    not info.is_dir()
                    and info.file_size <= max_individual_extract_bytes
                    and total_extracted + info.file_size <= max_total_extract_bytes
                    and (
                        suffix in mesh_extensions
                        or suffix in volume_extensions
                        or bool(matched_keywords)
                        or suffix == ".mat"
                    )
                )
                if should_extract:
                    relative = safe_member_path(info.filename)
                    target = selected / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(info) as source_handle, target.open("wb") as target_handle:
                        shutil.copyfileobj(source_handle, target_handle)
                    total_extracted += target.stat().st_size
                    extracted.append({
                        "member": info.filename,
                        "path": target.as_posix(),
                        "bytes": target.stat().st_size,
                        "sha256": sha256_file(target),
                        "reasons": reasons,
                        "matched_keywords": matched_keywords,
                    })
            if not info.is_dir() and suffix in text_extensions and info.file_size <= 5_000_000:
                try:
                    text = archive.read(info).decode("utf-8", errors="ignore")
                    hits = sorted({key for key in keywords if key in text.lower()})
                    if hits:
                        text_hits.append({
                            "name": info.filename,
                            "keywords": hits,
                            "excerpt": re.sub(r"\s+", " ", text)[:3000],
                        })
                except Exception:
                    pass

    readme_text = readme_path.read_text(encoding="utf-8", errors="ignore")
    manifest = {
        "schema": "life_ecosystem/chicken_skull_dryad_zenodo_probe@1.1",
        "created_at": now_iso(),
        "dataset": {
            "doi": DATASET_DOI,
            "title": "Sound attenuation in the ear of domestic chickens (Gallus gallus domesticus) as a result of beak opening",
            "dryad_page": DATASET_PAGE,
            "zenodo_mirror_record": ZENODO_RECORD,
            "archive": archive_receipt,
            "archive_failures_before_success": archive_failures,
            "readme": readme_receipt,
            "readme_failures_before_success": readme_failures,
            "readme_text": readme_text,
            "snapshots": snapshots,
        },
        "archive": {
            "member_count": len(members),
            "uncompressed_bytes": sum(row["bytes"] for row in members),
            "members": members,
            "candidate_count": len(candidates),
            "candidates": candidates,
            "text_hits": text_hits,
            "selected_file_count": len(extracted),
            "selected_bytes": total_extracted,
            "selected_files": extracted,
        },
        "license_lock": {
            "instrument": "CC0",
            "basis": "Dryad End User Terms apply CC0 to deposited data; Zenodo is used only as an open mirror transport for the same DOI-linked dataset.",
            "commercial_reuse_allowed": True,
            "redistribution_allowed": True,
            "citation_expected": True,
            "dataset_binary_imported": True,
            "source_archive_retained_in_artifact": False,
        },
        "decision": {
            "full_skull_mesh_detected": any("mesh_extension" in row["reasons"] for row in candidates),
            "ct_volume_detected": any("volume_extension" in row["reasons"] for row in candidates),
            "geometry_numeric_candidate_detected": any(
                row["extension"] in {".mat", ".m", ".dat", ".csv", ".txt"}
                and any(key in row["matched_keywords"] for key in ("geometry", "mesh", "node", "element", "vertex", "surface", "fem", "skull", "cranium", "head"))
                for row in candidates
            ),
            "next_gate": "selective_import_review",
        },
    }
    write_json(OUT / "CHICKEN_SKULL_DRYAD_ZENODO_PROBE_MANIFEST.json", manifest)
    (OUT / "DRYAD_ZENODO_LICENSE_LOCK.md").write_text(
        "# Dryad and Zenodo Chicken Skull Dataset License Lock\n\n"
        f"Dataset DOI: {DATASET_DOI}\n\n"
        f"Zenodo mirror record: {ZENODO_RECORD}\n\n"
        "License instrument: CC0 under the Dryad dataset terms.\n\n"
        "The full source archive was downloaded and fingerprinted on the temporary runner. The uploaded artifact omits that archive and retains the README, website snapshots, complete member manifest, and selectively extracted anatomical candidates.\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "archive_bytes": archive_receipt["bytes"],
        "archive_sha256": archive_receipt["sha256"],
        "members": len(members),
        "candidates": len(candidates),
        "selected_files": len(extracted),
        "selected_bytes": total_extracted,
        "full_skull_mesh_detected": manifest["decision"]["full_skull_mesh_detected"],
        "ct_volume_detected": manifest["decision"]["ct_volume_detected"],
        "geometry_numeric_candidate_detected": manifest["decision"]["geometry_numeric_candidate_detected"],
    }, indent=2))


if __name__ == "__main__":
    main()
