"""Archive QA evidence for an explicit user-requested full GitHub checkpoint.

Archives are preservation artifacts, never production anatomy inputs.
Runtime dependencies, VCS metadata, secrets ignored by Git, and temporary
upload indexes are deliberately excluded; local files are not removed.
"""
import hashlib
import json
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/checkpoints/20261006/archives'
STAGE = ROOT / 'New-Human-Production/R008/qa/sync-staging-20261006'
OUT.mkdir(parents=True, exist_ok=True)
STAGE.mkdir(parents=True, exist_ok=True)
EXCLUDED = {'.git', '.venv', 'venv', 'python-deps', 'node_modules', '__pycache__',
            'runtime-cache', 'sync-staging-20261006'}
LIMIT = 48 * 1024 * 1024
records, archive_records, exclusions = [], [], []

def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def eligible(folder):
    result = []
    for base, dirs, files in os.walk(folder):
        for d in list(dirs):
            if d in EXCLUDED:
                exclusions.append(str(Path(base, d).relative_to(ROOT)))
                dirs.remove(d)
        for n in files:
            if n.startswith(('.env', 'source-index-', 'snapshot-index-')) or n.endswith('.pyc'):
                exclusions.append(str(Path(base, n).relative_to(ROOT)))
                continue
            p = Path(base, n)
            if p.is_symlink():
                exclusions.append(str(p.relative_to(ROOT)))
                continue
            result.append(p)
    return sorted(result)

def archive(label, paths):
    if not paths:
        return
    tmp = STAGE / (label + '.zip')
    with zipfile.ZipFile(tmp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6,
                         allowZip64=True) as z:
        for p, name in paths:
            stat = p.stat()
            sha = digest(p)
            z.write(p, name)
            if p.stat().st_mtime_ns != stat.st_mtime_ns or p.stat().st_size != stat.st_size:
                raise RuntimeError('Source changed during archive: ' + str(p))
            records.append({'source': str(p), 'entry': name, 'bytes': stat.st_size,
                            'sha256': sha, 'archive': label})
    # CRC-check every archived byte before recording the checkpoint.
    with zipfile.ZipFile(tmp) as z:
        corrupt = z.testzip()
        if corrupt:
            raise RuntimeError('ZIP validation failed: ' + corrupt)
    pieces = []
    if tmp.stat().st_size <= LIMIT:
        dest = OUT / tmp.name
        import shutil
        shutil.copyfile(tmp, dest)
        pieces.append(dest)
    else:
        with tmp.open('rb') as src:
            i = 1
            while chunk := src.read(LIMIT):
                dest = OUT / (tmp.name + f'.part{i:03d}')
                dest.write_bytes(chunk)
                pieces.append(dest)
                i += 1
    archive_records.append({'name': label, 'zipBytes': tmp.stat().st_size,
                            'zipSha256': digest(tmp), 'parts': [
                                {'path': p.relative_to(ROOT).as_posix(),
                                 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in pieces]})
    print(json.dumps({'archive': label, 'files': len(paths), 'zipBytes': tmp.stat().st_size,
                      'parts': len(pieces)}), flush=True)

for qa_root in ['GNM-Workbench/qa', 'New-Human-Production/R006/qa',
                'New-Human-Production/R007/qa', 'New-Human-Production/R008/qa']:
    folder = ROOT / qa_root
    if not folder.exists():
        continue
    prefix = qa_root.replace('/', '-')
    root_files = []
    for child in sorted(folder.iterdir()):
        if child.name in EXCLUDED:
            exclusions.append(child.relative_to(ROOT).as_posix())
        elif child.is_dir():
            archive(prefix + '-' + child.name,
                    [(p, p.relative_to(ROOT).as_posix()) for p in eligible(child)])
        elif child.is_file() and not child.name.startswith(('source-index-', '.env')):
            root_files.append((child, child.relative_to(ROOT).as_posix()))
    archive(prefix + '-root-records', root_files)

original = Path(r'G:\Three.js\Human\Human-Shorts-Static-Publish-20261001\shorts-r24-static-20261001\index.html')
if not original.exists():
    raise RuntimeError('Required original A checkpoint is missing')
archive('original-A-immutable', [(original, 'original-A/index.html')])

manifest = {'status': 'FULL_DEVELOPMENT_SNAPSHOT_NOT_GARMENT_ACCEPTANCE',
            'productionReady': False, 'sources': records, 'archives': archive_records,
            'excludedDependencyOrTemporaryPaths': sorted(set(exclusions)),
            'localSourcesRemoved': False,
            'originalASha256': digest(original)}
(OUT.parent / 'ARCHIVE_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({'complete': True, 'files': len(records), 'archives': len(archive_records),
                  'sourceBytes': sum(r['bytes'] for r in records),
                  'archiveBytes': sum(r['zipBytes'] for r in archive_records),
                  'originalASha256': digest(original)}), flush=True)
