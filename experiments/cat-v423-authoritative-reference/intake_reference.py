#!/usr/bin/env python3
"""Receive an officially downloaded authoritative cat reference archive.

This tool performs no download and does not bypass authentication. It preserves
an official source file, hashes it, inventories archive members and extracts
only supported geometry and licence candidates into an isolated reference area.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

SUPPORTED_GEOMETRY = {'.glb', '.gltf', '.obj', '.ply', '.stl', '.fbx', '.dae'}
LICENSE_NAMES = ('license', 'licence', 'readme', 'attribution', 'copyright')


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def safe_members(archive: zipfile.ZipFile):
    for info in archive.infolist():
        path = Path(info.filename)
        if info.is_dir():
            continue
        if path.is_absolute() or '..' in path.parts:
            raise ValueError(f'Unsafe archive member: {info.filename}')
        yield info


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('input', type=Path, help='Officially downloaded archive or geometry file')
    parser.add_argument('--out', type=Path, default=Path('reference_input/official/edinburgh_domestic_cat'))
    parser.add_argument('--expected-uid', default='7c99ca836d834c39872ecf5e9b5e2087')
    args = parser.parse_args()

    source = args.input.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)

    output = args.out.resolve()
    original_dir = output / 'original'
    extracted_dir = output / 'extracted'
    original_dir.mkdir(parents=True, exist_ok=True)
    extracted_dir.mkdir(parents=True, exist_ok=True)

    preserved = original_dir / source.name
    if preserved.resolve() != source:
        shutil.copy2(source, preserved)

    receipt = {
        'schema': 'kaopu.cat.authoritative_reference_receipt/1.0',
        'modelUid': args.expected_uid,
        'sourceTitle': 'Domestic Cat (Felis catus)',
        'publisher': 'The University of Edinburgh Open.Ed',
        'department': 'The Royal (Dick) School of Veterinary Studies',
        'sourcePage': 'https://sketchfab.com/3d-models/domestic-cat-felis-catus-7c99ca836d834c39872ecf5e9b5e2087',
        'preservedOriginal': str(preserved.relative_to(output)),
        'bytes': preserved.stat().st_size,
        'sha256': sha256_file(preserved),
        'archiveMembers': [],
        'geometryCandidates': [],
        'licenseCandidates': [],
        'sourceModified': False,
        'runtimeDependency': False,
        'status': 'source-preserved-and-inventoried'
    }

    if zipfile.is_zipfile(preserved):
        with zipfile.ZipFile(preserved) as archive:
            for info in safe_members(archive):
                suffix = Path(info.filename).suffix.lower()
                lowercase_name = info.filename.lower()
                item = {
                    'path': info.filename,
                    'bytes': info.file_size,
                    'compressedBytes': info.compress_size
                }
                receipt['archiveMembers'].append(item)
                selected = suffix in SUPPORTED_GEOMETRY or any(token in lowercase_name for token in LICENSE_NAMES)
                if selected:
                    archive.extract(info, extracted_dir)
                if suffix in SUPPORTED_GEOMETRY:
                    receipt['geometryCandidates'].append(item)
                if any(token in lowercase_name for token in LICENSE_NAMES):
                    receipt['licenseCandidates'].append(item)
    else:
        suffix = preserved.suffix.lower()
        if suffix not in SUPPORTED_GEOMETRY:
            raise ValueError(f'Unsupported input type: {suffix}')
        copied = extracted_dir / preserved.name
        shutil.copy2(preserved, copied)
        receipt['geometryCandidates'].append({'path': copied.name, 'bytes': copied.stat().st_size})

    receipt_path = output / 'REFERENCE_SOURCE_RECEIPT.json'
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    print(f'RECEIPT={receipt_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
