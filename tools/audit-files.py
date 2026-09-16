"""Refresh file-only audit and checksums without creating a release copy."""
from pathlib import Path
import ast
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def write_lf(name, text):
    with (ROOT / name).open('w', encoding='utf-8', newline='\n') as stream:
        stream.write(text)


def source_files():
    return sorted(p for p in ROOT.rglob('*') if p.is_file()
                  and not {'.git', '__pycache__'}.intersection(p.relative_to(ROOT).parts))


def main():
    result = subprocess.run(['node', str(ROOT / 'tools/check-pure.mjs')],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    report = json.loads(result.stdout)
    paths = source_files()
    python_files = [p for p in paths if p.suffix == '.py']
    for path in python_files:
        ast.parse(path.read_text(encoding='utf-8'), filename=str(path.relative_to(ROOT)))
    report['pythonFilesParsed'] = len(python_files)
    report['scope'] = 'Project payload excluding .git, __pycache__, FILE_AUDIT.json and SHA256SUMS.txt.'
    write_lf('FILE_AUDIT.json', json.dumps(report, indent=2) + '\n')
    sums = [hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.relative_to(ROOT).as_posix()
            for p in source_files() if p.name != 'SHA256SUMS.txt']
    write_lf('SHA256SUMS.txt', '\n'.join(sums) + '\n')
    print(json.dumps({'filesVerified': len(sums), 'payloadBytes': report['bytes'],
                      'pythonFilesParsed': len(python_files), 'applicationExecuted': False}))


if __name__ == '__main__':
    main()
