#!/usr/bin/env python3
"""Local binary audio gateway. Standard library in the workbench server.
Heavy imports live in a separate, cancellable worker and disappear after a job.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import threading
import time

HERE = Path(__file__).resolve().parent
MAX_AUDIO = 20 * 1024 * 1024
MODEL_INFO = {'tiny': {'approxModelMB': 76, 'label': '轻量'},
              'base': {'approxModelMB': 145, 'label': '平衡'},
              'small': {'approxModelMB': 484, 'label': '更大模型'}}

class VoiceError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message); self.status = status; self.code = code


def terminate(process):
    if not process or process.poll() is not None:
        return
    try:
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8)
        else:
            os.killpg(process.pid, signal.SIGKILL)
    except (OSError, subprocess.SubprocessError):
        try: process.kill()
        except OSError: pass


def launch(args, **kwargs):
    options = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}
    return subprocess.Popen(args, **options, **kwargs)


class SpeechService:
    def __init__(self, home: Path | None = None):
        if home is None:
            base = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / '.cache')))
            home = Path(os.environ.get('JARVIS_VOICE_HOME', str(base / 'JarvisLocalVoice' / 'v1')))
        self.home = home.expanduser().resolve()
        self.token = secrets.token_urlsafe(32)
        self.lock = threading.RLock()
        self.setup_process = None
        self.setup_started = 0
        self.job = None
        self.completed = {}
        self.cancelled = {}
        self.verified_stamp = None
        self.install_ok = False

    def read_json(self, name):
        try: return json.loads((self.home / name).read_text(encoding='utf-8'))
        except (OSError, ValueError): return {}

    def python_path(self):
        return self.home / 'venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')

    def installed(self):
        cfg = self.read_json('installed.json')
        name = cfg.get('model')
        if name not in MODEL_INFO or not self.python_path().is_file(): return None
        directory = self.home / 'models' / name
        paths = [directory / x for x in ['model.bin', 'config.json', 'tokenizer.json']]
        if not all(p.is_file() for p in paths): return None
        # Do not claim health merely because a static web server is reachable.
        if cfg.get('selfTest', {}).get('status') != 'ok': return None
        return cfg

    def status(self):
        with self.lock:
            cfg = self.installed()
            setup = self.read_json('setup-status.json')
            installing = bool(self.setup_process and self.setup_process.poll() is None)
            if setup.get('status') == 'installing' and not installing:
                setup = {**setup, 'status': 'interrupted', 'stage': '上次安装已中断，可重试'}
            if installing and setup.get('model') in MODEL_INFO:
                try:
                    folder = self.home / 'models' / setup['model']
                    setup['modelDirectoryBytes'] = sum(p.stat().st_size for p in folder.rglob('*') if p.is_file())
                except OSError: pass
            status = 'installing' if installing else 'ready' if cfg else 'setup_required'
            return {'schema': 'jarvis/local_voice_status@1', 'version': '1.15.1',
                    'status': status, 'engine': 'faster-whisper', 'installed': bool(cfg),
                    'model': cfg.get('model') if cfg else None, 'models': MODEL_INFO,
                    'setup': setup, 'busy': bool(self.job), 'token': self.token,
                    'maxAudioBytes': MAX_AUDIO, 'maxDurationSeconds': 90,
                    'privacy': 'Audio stays on this computer; no cloud transcription.',
                    'workerPolicy': 'CPU INT8; at most 2 threads; process released after each request',
                    'liveMicrophoneVerified': False, 'speechAccuracyVerified': False}

    def start_setup(self, model: str, consent: str):
        if model not in MODEL_INFO: raise VoiceError(400, 'model', '未知语音模型')
        if consent != 'download-local-model': raise VoiceError(400, 'consent', '需要明确同意首次下载模型和CPU组件')
        with self.lock:
            if self.job: raise VoiceError(409, 'busy', '当前正在转写，请先结束或取消')
            if self.setup_process and self.setup_process.poll() is None:
                return self.status()
            self.home.mkdir(parents=True, exist_ok=True)
            log = (self.home / 'installation.log').open('w', encoding='utf-8')
            env = os.environ.copy(); env.update(PYTHONIOENCODING='utf-8', HF_HUB_DISABLE_TELEMETRY='1')
            try:
                self.setup_process = launch([sys.executable, str(HERE / 'setup_voice.py'), '--home', str(self.home),
                                             '--model', model, '--download-consent'],
                                             stdout=log, stderr=subprocess.STDOUT, env=env)
            finally: log.close()
            self.setup_started = time.monotonic()
            return self.status()

    def cancel_setup(self):
        with self.lock:
            terminate(self.setup_process)
            if self.setup_process:
                try: self.setup_process.wait(timeout=8)
                except subprocess.SubprocessError: pass
            self.setup_process = None
            return self.status()

    def cleanup(self):
        now = time.monotonic()
        for table in [self.cancelled, self.completed]:
            for key, item in list(table.items()):
                stamp = item if isinstance(item, (float, int)) else item['at']
                if now - stamp > 180: table.pop(key, None)
        while len(self.cancelled) > 128: self.cancelled.pop(next(iter(self.cancelled)))
        while len(self.completed) > 16: self.completed.pop(next(iter(self.completed)))

    @staticmethod
    def validate_id(job_id):
        if not isinstance(job_id, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{4,120}', job_id):
            raise VoiceError(400, 'input_id', '输入编号无效')

    def cancel(self, job_id):
        self.validate_id(job_id)
        with self.lock:
            self.cleanup(); self.cancelled[job_id] = time.monotonic()
            self.completed.pop(job_id, None)
            active = bool(self.job and self.job['id'] == job_id)
            if active: terminate(self.job['process'])
            return {'status': 'cancelled', 'inputId': job_id, 'workerTerminated': active}

    def transcribe(self, job_id, language, raw):
        self.validate_id(job_id)
        if language not in ['zh-CN', 'zh-TW', 'en-US']: raise VoiceError(400, 'language', '此版本支持普通话和英语')
        if not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_AUDIO:
            raise VoiceError(413, 'audio_size', '录音为空或超过20MiB')
        digest = hashlib.sha256(raw + language.encode()).hexdigest()
        with self.lock:
            self.cleanup()
            if job_id in self.cancelled: raise VoiceError(409, 'cancelled', '本轮已取消，录音不会再触发动作')
            cached = self.completed.get(job_id)
            if cached:
                if cached['digest'] != digest: raise VoiceError(409, 'input_conflict', '输入编号已用于另一段录音')
                return {**cached['result'], 'duplicate': True}
            if self.job: raise VoiceError(429, 'busy', '本地语音正在转写另一段录音，请稍候重试')
            cfg = self.installed()
            if not cfg: raise VoiceError(503, 'setup_required', '本地语音模型未安装完成，请在语音设置中安装')
            if self.setup_process and self.setup_process.poll() is None: raise VoiceError(409, 'installing', '正在安装语音组件')
            env = os.environ.copy()
            env.update(PYTHONIOENCODING='utf-8', HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1',
                       HF_HUB_DISABLE_TELEMETRY='1', OMP_NUM_THREADS='2')
            process = launch([str(self.python_path()), str(HERE / 'speech_worker.py'),
                              '--model', str(self.home / 'models' / cfg['model']),
                              '--language', 'en' if language == 'en-US' else 'zh', '--threads', '2'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            self.job = {'id': job_id, 'process': process}
        try:
            out, err = process.communicate(input=raw, timeout=180)
            with self.lock:
                if job_id in self.cancelled: raise VoiceError(409, 'cancelled', '本轮已取消')
            if len(out) > 131072: raise VoiceError(502, 'output_size', '转写响应异常过大')
            try: result = json.loads(out.decode('utf-8').strip().splitlines()[-1])
            except (ValueError, IndexError):
                raise VoiceError(502, 'worker_error', '本机语音进程没有返回有效结果，请检查CPU组件安装')
            if process.returncode != 0 or result.get('status') == 'error':
                raise VoiceError(502, 'decode_error', str(result.get('error', '转写失败'))[:500])
            result.update({'inputId': job_id, 'model': cfg['model'], 'duplicate': False})
            with self.lock:
                if job_id in self.cancelled: raise VoiceError(409, 'cancelled', '本轮已取消')
                self.completed[job_id] = {'result': result, 'digest': digest, 'at': time.monotonic()}
            return result
        except subprocess.TimeoutExpired:
            terminate(process)
            try: process.communicate(timeout=8)
            except subprocess.SubprocessError: pass
            raise VoiceError(504, 'timeout', '本机转写超过180秒，已终止进程；浏览器录音仍可回放与重试')
        finally:
            with self.lock:
                if self.job and self.job['process'] is process: self.job = None

    def close(self):
        with self.lock:
            if self.job: terminate(self.job['process'])
            terminate(self.setup_process)
