#!/usr/bin/env python3
"""One bounded, offline-only inference process. Audio enters over stdin, never disk.
No vocabulary prompt is used: scene commands are interpreted downstream, not
injected into the speech decoder. The process exits after a request to release RAM.
"""
from __future__ import annotations
import argparse
import io
import json
import os
import sys
import time

MAX_AUDIO = 20 * 1024 * 1024
MAX_SECONDS = 92

def decode_bounded(raw: bytes):
    import av
    import numpy as np
    chunks, count = [], 0
    with av.open(io.BytesIO(raw)) as container:
        if not container.streams.audio:
            raise ValueError('文件中没有音频轨道')
        stream = container.streams.audio[0]
        resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)
        for frame in container.decode(stream):
            for converted in resampler.resample(frame):
                values = converted.to_ndarray().reshape(-1)
                count += len(values)
                if count > MAX_SECONDS * 16000:
                    raise ValueError('录音超过92秒限制，请分段录制')
                chunks.append(values)
        for converted in resampler.resample(None):
            values = converted.to_ndarray().reshape(-1)
            count += len(values)
            if count > MAX_SECONDS * 16000:
                raise ValueError('录音超过92秒限制')
            chunks.append(values)
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0

def transcribe(raw: bytes, model_path: str, language: str, threads: int) -> dict:
    import numpy as np
    from faster_whisper import WhisperModel
    audio = decode_bounded(raw)
    duration = len(audio) / 16000
    rms = float(np.sqrt(np.mean(audio * audio))) if len(audio) else 0
    if duration < .25 or rms < .00012:
        return {'text': '', 'rawText': '', 'status': 'no_speech', 'duration': duration,
                'reason': '录音为空、太短或几乎没有声音', 'reviewRequired': True}
    model = WhisperModel(model_path, device='cpu', compute_type='int8',
                         cpu_threads=max(1, min(4, threads)), num_workers=1,
                         local_files_only=True)
    segments, info = model.transcribe(
        audio, language=language, task='transcribe', beam_size=5,
        temperature=0.0, condition_on_previous_text=False, initial_prompt=None,
        vad_filter=True,
        vad_parameters={'min_speech_duration_ms': 250, 'min_silence_duration_ms': 650,
                        'speech_pad_ms': 300},
        no_speech_threshold=.6, log_prob_threshold=-1.0,
        compression_ratio_threshold=2.4, word_timestamps=False)
    rows = [{'text': s.text.strip(), 'start': s.start, 'end': s.end,
             'avgLogProb': s.avg_logprob, 'noSpeechProbability': s.no_speech_prob,
             'compressionRatio': s.compression_ratio} for s in segments]
    rows = [r for r in rows if r['text'] and not (r['noSpeechProbability'] > .6 and r['avgLogProb'] < -.7)]
    raw_text = (''.join(r['text'] for r in rows) if language == 'zh' else ' '.join(r['text'] for r in rows)).strip()
    if len(raw_text) > 4000:
        raise ValueError('转写文本异常过长，未提交动作')
    text = raw_text
    if language == 'zh' and text:
        from opencc import OpenCC
        text = OpenCC('t2s').convert(text)
    warning = any(r['avgLogProb'] < -.65 or r['compressionRatio'] > 2.0 or r['noSpeechProbability'] > .35 for r in rows)
    return {'text': text, 'rawText': raw_text, 'status': 'ok' if text else 'no_speech',
            'duration': duration, 'speechDuration': info.duration_after_vad,
            'language': info.language, 'segments': rows, 'reviewRequired': warning or not text,
            'confidence': None, 'confidenceMeaning': 'Whisper diagnostics are not a calibrated accuracy percentage',
            'rms': rms}

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--model', required=True)
    p.add_argument('--language', choices=['zh', 'en'], default='zh')
    p.add_argument('--threads', type=int, default=2)
    p.add_argument('--self-test', action='store_true')
    args = p.parse_args()
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['OMP_NUM_THREADS'] = str(max(1, min(4, args.threads)))
    start = time.perf_counter()
    try:
        if args.self_test:
            import numpy as np
            from faster_whisper import WhisperModel
            model = WhisperModel(args.model, device='cpu', compute_type='int8', cpu_threads=2, local_files_only=True)
            segments, _ = model.transcribe(np.zeros(16000, dtype=np.float32), language='zh', vad_filter=True, condition_on_previous_text=False)
            if ''.join(s.text for s in segments).strip():
                raise RuntimeError('静音自检意外产生文字')
            out = {'status': 'ok', 'selfTest': 'offline_model_load_and_silence', 'speechAccuracyVerified': False}
        else:
            raw = sys.stdin.buffer.read(MAX_AUDIO + 1)
            if not raw or len(raw) > MAX_AUDIO:
                raise ValueError('录音为空或超过20MiB上限')
            out = transcribe(raw, args.model, args.language, args.threads)
        out.update({'engine': 'faster-whisper', 'device': 'cpu', 'computeType': 'int8',
                    'processingSeconds': round(time.perf_counter() - start, 3)})
        print(json.dumps(out, ensure_ascii=False), flush=True)
    except Exception as e:
        print(json.dumps({'status': 'error', 'error': type(e).__name__ + ': ' + str(e)[:500]}, ensure_ascii=False), flush=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
