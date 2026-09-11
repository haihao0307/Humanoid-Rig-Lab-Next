from __future__ import annotations

import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

DATASET_DOI = "10.5061/dryad.fr684"
DATASET_PAGE = "https://datadryad.org/dataset/doi:10.5061/dryad.fr684"
TERMS_PAGE = "https://datadryad.org/terms"
ZIP_URL = "https://datadryad.org/downloads/file_stream/6988"
README_URL = "https://datadryad.org/downloads/file_stream/6989"
OUT = Path("out/chicken-skull-dryad-probe")
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Humanoid-Rig-Lab-Next Chicken-Skull-S3 Dryad probe/1.0"})


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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    source = OUT / "source"
    metadata = OUT / "metadata"
    source.mkdir(parents=True, exist_ok=True)
    metadata.mkdir(parents=True, exist_ok=True)

    snapshots = {}
    for label, url in (("dataset_page", DATASET_PAGE), ("terms", TERMS_PAGE)):
        target = metadata / f"dryad_{label}.html"
        try:
            snapshots[label] = {"ok": True, **fetch(url, target, timeout=90)}
        except Exception as exc:
            snapshots[label] = {"ok": False, "request_url": url, "error": f"{type(exc).__name__}: {exc}"}

    readme_path = source / "README_for_Muyshondt_et_al_Data_and_code.txt"
    readme_receipt = fetch(README_URL, readme_path, timeout=90)
    archive_path = source / "Muyshondt_et_al_Data_and_code.zip"
    archive_receipt = fetch(ZIP_URL, archive_path, timeout=600)

    mesh_extensions = {".stl", ".ply", ".obj", ".off", ".vtk", ".vtp", ".gii", ".glb", ".gltf", ".msh", ".inp"}
    volume_extensions = {".dcm", ".dicom", ".nii", ".nrrd", ".mhd", ".mha", ".raw", ".vol", ".am", ".tif", ".tiff"}
    numeric_extensions = {".mat", ".csv", ".tsv", ".txt", ".m", ".json", ".xml"}
    keywords = ("skull", "cranium", "beak", "bill", "quadrate", "pterygoid", "palatine", "head", "ct", "mesh", "model", "geometry", "rooster", "hen", "chicken", "gallus")
    text_extensions = {".txt", ".m", ".csv", ".tsv", ".json", ".xml", ".md"}

    members = []
    candidates = []
    text_hits = []
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
                candidates.append({**row, "reasons": reasons, "matched_keywords": matched_keywords})
            if not info.is_dir() and suffix in text_extensions and info.file_size <= 2_000_000:
                try:
                    text = archive.read(info).decode("utf-8", errors="ignore")
                    hits = sorted({key for key in keywords if key in text.lower()})
                    if hits:
                        text_hits.append({"name": info.filename, "keywords": hits, "excerpt": re.sub(r"\s+", " ", text)[:1000]})
                except Exception:
                    pass

    readme_text = readme_path.read_text(encoding="utf-8", errors="ignore")
    manifest = {
        "schema": "life_ecosystem/chicken_skull_dryad_probe@1.0",
        "created_at": now_iso(),
        "dataset": {
            "doi": DATASET_DOI,
            "title": "Sound attenuation in the ear of domestic chickens (Gallus gallus domesticus) as a result of beak opening",
            "archive": archive_receipt,
            "readme": readme_receipt,
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
        },
        "license_lock": {
            "instrument": "CC0",
            "basis": "Dryad End User Terms state that submitters grant publication under a CC0 instrument and users may reuse datasets in any manner except prohibited unlawful or service-impairing uses.",
            "commercial_reuse_allowed": True,
            "redistribution_allowed": True,
            "citation_expected": True,
            "dataset_binary_imported": True,
            "archive_redistributed_in_probe_artifact": False,
        },
        "decision": {
            "full_skull_mesh_detected": any("mesh_extension" in row["reasons"] for row in candidates),
            "ct_volume_detected": any("volume_extension" in row["reasons"] for row in candidates),
            "next_gate": "selective_import_after_member_review",
        },
    }
    write_json(OUT / "CHICKEN_SKULL_DRYAD_PROBE_MANIFEST.json", manifest)
    (OUT / "DRYAD_LICENSE_LOCK.md").write_text(
        "# Dryad Chicken Skull Dataset License Lock\n\n"
        f"Dataset DOI: {DATASET_DOI}\n\n"
        "License instrument: CC0.\n\n"
        "The downloaded archive is retained only on the temporary runner during this probe. The artifact contains its cryptographic receipt, README, website snapshots, and archive member manifest. A later selective import may copy only verified anatomical files.\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "archive_bytes": archive_receipt["bytes"],
        "archive_sha256": archive_receipt["sha256"],
        "members": len(members),
        "candidates": len(candidates),
        "full_skull_mesh_detected": manifest["decision"]["full_skull_mesh_detected"],
        "ct_volume_detected": manifest["decision"]["ct_volume_detected"],
    }, indent=2))


if __name__ == "__main__":
    main()
