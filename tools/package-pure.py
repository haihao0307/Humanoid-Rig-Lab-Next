"""Create a deterministic source-only ZIP; inspect files, never run the app."""
from pathlib import Path
import ast
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / 'Human-Pure-Code.zip'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    result = subprocess.run(['node', str(ROOT / 'tools/check-pure.mjs')],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    report = json.loads(result.stdout)
    python_files = sorted(ROOT.rglob('*.py'))
    for path in python_files:
        ast.parse(path.read_text(encoding='utf-8'), filename=str(path.relative_to(ROOT)))
    report['pythonFilesParsed'] = len(python_files)
    report['scope'] = 'Payload at audit time; generated audit and checksum files are subsequently included.'
    (ROOT / 'FILE_AUDIT.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    paths = sorted(p for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.relative_to(ROOT).parts)
    sums = [sha(p.read_bytes()) + '  ' + p.relative_to(ROOT).as_posix()
            for p in paths if p.name != 'SHA256SUMS.txt']
    (ROOT / 'SHA256SUMS.txt').write_text('\n'.join(sums) + '\n', encoding='utf-8')
    paths = sorted(p for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.relative_to(ROOT).parts)
    entries = {}
    with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            name = 'Human-Pure-Code/' + path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o100755 if path.suffix == '.command' else 0o100644) << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            entries[name] = sha(data)
    with zipfile.ZipFile(OUTPUT) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(entries):
            raise RuntimeError('ZIP content verification failed')
        for name, digest in entries.items():
            if sha(archive.read(name)) != digest:
                raise RuntimeError('ZIP hash mismatch: ' + name)
    print(json.dumps({'archive': str(OUTPUT), 'files': len(paths),
                      'sourceBytes': sum(p.stat().st_size for p in paths),
                      'zipBytes': OUTPUT.stat().st_size, 'sha256': sha(OUTPUT.read_bytes()),
                      'entriesVerified': len(entries), 'applicationExecuted': False}))

if __name__ == '__main__':
    main()
