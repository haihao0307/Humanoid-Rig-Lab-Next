#!/usr/bin/env python3
"""Explicitly consented, isolated local speech installation. No microphone access."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import venv

MODELS = {'tiny': {'approxMB': 76}, 'base': {'approxMB': 145}, 'small': {'approxMB': 484}}
HERE = Path(__file__).resolve().parent

def save(path: Path, data: dict):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)

def report(home: Path, status: str, stage: str, **extra):
    data = {'status': status, 'stage': stage, 'updatedAt': time.time(), **extra}
    save(home / 'setup-status.json', data)
    print(json.dumps(data, ensure_ascii=False), flush=True)

def py_path(home: Path):
    return home / 'venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')

def acquire_lock(home: Path):
    f = (home / 'install.lock').open('a+b')
    if os.name == 'nt':
        import msvcrt
        f.seek(0); f.write(b'0'); f.flush(); f.seek(0)
        msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
    else:
        import fcntl
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    return f

def stage_model(home: Path, name: str):
    from huggingface_hub import HfApi, snapshot_download
    repo = 'Systran/faster-whisper-' + name
    report(home, 'installing', '下载模型', model=name, approximateModelMB=MODELS[name]['approxMB'])
    revision = HfApi().model_info(repo_id=repo, timeout=30).sha
    directory = home / 'models' / name
    snapshot_download(repo_id=repo, revision=revision, local_dir=str(directory),
                      max_workers=2,
                      allow_patterns=['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.*', 'preprocessor_config.json'])
    for file in ['model.bin', 'config.json', 'tokenizer.json']:
        if not (directory / file).is_file():
            raise RuntimeError('下载缺少 ' + file)
    report(home, 'installing', '离线加载与静音自检', model=name)
    env = os.environ.copy(); env.update(HF_HUB_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
    result = subprocess.run([sys.executable, str(HERE / 'speech_worker.py'), '--model', str(directory), '--self-test'],
                            capture_output=True, text=True, encoding='utf-8', env=env, timeout=180)
    if result.returncode != 0:
        raise RuntimeError('模型自检失败：' + (result.stdout or result.stderr)[-700:])
    test = json.loads(result.stdout.strip().splitlines()[-1])
    hashes = {}
    for file in directory.iterdir():
        if not file.is_file():
            continue
        digest = hashlib.sha256()
        with file.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        hashes[file.name] = digest.hexdigest()
    save(home / 'installed.json', {'schema': 'jarvis/local_voice_install@1', 'engine': 'faster-whisper',
          'model': name, 'repository': repo, 'revision': revision, 'hashes': hashes,
          'installedAt': time.time(), 'selfTest': test, 'speechAccuracyVerified': False})
    report(home, 'ready', '本地语音引擎可用', model=name)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', required=True)
    parser.add_argument('--model', choices=list(MODELS), default='base')
    parser.add_argument('--download-consent', action='store_true')
    parser.add_argument('--model-stage', action='store_true')
    args = parser.parse_args()
    if not args.download_consent:
        parser.error('需要明确同意下载：--download-consent')
    home = Path(args.home).expanduser().resolve(); home.mkdir(parents=True, exist_ok=True)
    os.environ.update(PYTHONIOENCODING='utf-8', HF_HUB_DISABLE_TELEMETRY='1', HF_HUB_DISABLE_XET='1',
                      HF_HUB_ETAG_TIMEOUT='30', HF_HUB_DOWNLOAD_TIMEOUT='60')
    if args.model_stage:
        try:
            stage_model(home, args.model)
        except Exception as e:
            report(home, 'error', '模型下载或自检未完成', model=args.model, error=str(e)[:900])
            raise SystemExit(1)
        return
    lock = None
    try:
        lock = acquire_lock(home)
        if sys.version_info < (3, 9):
            raise RuntimeError('本地语音需要 Python 3.9 或更新版本')
        report(home, 'installing', '创建独立语音环境', model=args.model)
        python = py_path(home)
        if not python.exists():
            venv.EnvBuilder(with_pip=True).create(home / 'venv')
        report(home, 'installing', '安装CPU识别组件', model=args.model)
        subprocess.run([str(python), '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input',
                        '--timeout', '30', '--retries', '2', '-r', str(HERE / 'voice-requirements.txt')],
                        check=True, timeout=900)
        subprocess.run([str(python), str(Path(__file__).resolve()), '--home', str(home), '--model', args.model,
                        '--download-consent', '--model-stage'], check=True, timeout=1200)
    except Exception as e:
        try:
            previous = json.loads((home / 'setup-status.json').read_text(encoding='utf-8'))
        except (OSError, ValueError): previous = {}
        detail = previous.get('error') if previous.get('status') == 'error' else str(e)[:900]
        report(home, 'error', '安装未完成', model=args.model, error=detail,
               recovery='检查网络能否访问 PyPI 和 Hugging Face，解决后点击重试。安装失败不会启用浏览器在线识别。')
        sys.exit(1)
    finally:
        if lock: lock.close()

if __name__ == '__main__':
    main()
