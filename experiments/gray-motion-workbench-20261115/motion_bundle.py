"""Lossless motion-set archive, validated against the installed atlas and body runtime."""
from pathlib import Path
import hashlib, json, math, os, re, shutil, uuid, zipfile

SCHEMA = 'human-function-motion-set/2'
SUPPORTED_SCHEMAS = {'human-function-motion-set/1',SCHEMA}
MAX_MANIFEST = 16 * 1024 * 1024
MAX_ARCHIVE = 28 * 1024**3


def digest_file(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def validate(manifest, context, index):
    if not isinstance(manifest, dict) or manifest.get('schema') not in SUPPORTED_SCHEMAS:
        raise ValueError('动作组合文件版本不受支持')
    identity=manifest.get('identity')
    if not isinstance(identity,dict) or identity.get('context') != context:
        raise ValueError('动作文件使用的人物函数版本与当前平台不同，不能直接播放')
    if identity.get('footStudy') is not False or identity.get('jointVolume') != .65 or not re.fullmatch(r'[0-9a-f]{64}', str(identity.get('archiveSHA256', ''))):
        raise ValueError('人物动作配置无效')
    ground = manifest.get('groundOffset')
    if ground is not None and (isinstance(ground, bool) or not isinstance(ground, (int, float)) or not math.isfinite(ground) or abs(ground)>10):
        raise ValueError('人物动作基准高度无效')
    person = manifest.get('person')
    if not isinstance(person, dict) or person.get('schema') != 'kaopu/review-platform@1' or not isinstance(person.get('person'),dict) or not isinstance(person['person'].get('state'), dict):
        raise ValueError('人物档案无效')
    owners=person['person']['state'].get('owners')
    if not isinstance(owners,dict) or owners.get('rig') != 'anny':
        raise ValueError('该文件人物的骨架暂不受支持')
    items = manifest.get('actions')
    if not isinstance(items, list) or not 1 <= len(items) <= 500:
        raise ValueError('动作组合数量无效')
    packets = {}
    for item in items:
        if not isinstance(item, dict): raise ValueError('动作记录无效')
        action_id = item.get('id', '')
        if not isinstance(action_id, str) or not re.fullmatch(r'[a-z0-9_]+', action_id): raise ValueError('动作编号无效')
        row = index.get(action_id)
        if not row or row.get('status') != 'candidate' or row.get('frameDomain') or item.get('sha256') != row.get('sha256'):
            raise ValueError('动作库缺少匹配的定时动作：' + action_id)
        if not isinstance(item.get('role', ''), str) or len(item.get('role', '')) > 40: raise ValueError('动作用途无效')
        path = item.get('path')
        if not isinstance(path, dict) or any(isinstance(path.get(k), bool) or not isinstance(path.get(k), (int, float)) or not math.isfinite(path[k]) or abs(path[k]) > 100000 for k in ('x', 'z', 'yaw')):
            raise ValueError('动作起点或朝向无效')
        entries = item.get('packets')
        starts = list(range(0, row['frames'] - 1, 32))
        if len(starts) > 200 or not isinstance(entries, list) or len(entries) != len(starts): raise ValueError('动作数据不完整或动作过长：' + action_id)
        for entry, start in zip(entries, starts):
            if not isinstance(entry, dict) or entry.get('start') != start or not re.fullmatch(r'[0-9a-f]{64}', str(entry.get('key', ''))): raise ValueError('动作片段标识无效')
            key_data = {'schema':'atlas-function-packet/1', **identity, 'id':action_id, 'sourceSHA256':item['sha256'], 'start':start}
            expected_key = hashlib.sha256(json.dumps(key_data, ensure_ascii=False, separators=(',', ':')).encode('utf8')).hexdigest()
            if entry['key'] != expected_key: raise ValueError('动作片段与人物绑定不匹配')
            name = f"{action_id}-{start}-{entry['key']}"
            prev = packets.setdefault(name, {'id': action_id, 'start': start, 'key': entry['key']})
            if prev['id'] != action_id: raise ValueError('动作片段冲突')
    return packets


def create(manifest, context, index, packet_dir, bundle_dir, make_engine_clip, packet_provider=None, material_dir=None):
    packets = validate(manifest, context, index)
    material=None;material_token=manifest.pop('materialToken',None)
    if material_token is not None:
        if not isinstance(material_token,str) or not re.fullmatch(r'[0-9a-f]{64}',material_token) or material_dir is None:raise ValueError('人物材质标识无效')
        path=material_dir/(material_token+'.bin')
        if not path.is_file() or path.stat().st_size>32*1024*1024 or digest_file(path)!=material_token:raise ValueError('人物材质数据不完整')
        material=path;manifest['materialSHA256']=material_token
    engine = {}
    for action_id in dict.fromkeys(item['id'] for item in manifest['actions']):
        data = json.dumps(make_engine_clip(action_id), ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf8')
        engine[action_id] = data
    manifest['engineFiles'] = {key: hashlib.sha256(data).hexdigest() for key, data in engine.items()}
    # Bundle IDs address local imports only and must never leak into an export.
    for action in manifest['actions']:action.pop('bundle',None)
    serialized = json.dumps(manifest, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf8')
    if len(serialized) > MAX_MANIFEST: raise ValueError('人物档案过大')
    sources = []
    total = 0
    for name, info in packets.items():
        supplied=packet_provider(name,info) if packet_provider else None
        if supplied is None:
            path = packet_dir / (name + '.bin');side = path.with_suffix('.json')
            if not path.is_file() or not side.is_file(): raise ValueError('动作尚未准备完整：' + info['id'])
            metadata = json.loads(side.read_text(encoding='utf8'));size = path.stat().st_size
            source=lambda p=path:p.open('rb')
        else:metadata,size,source=supplied
        if any(metadata.get(k) != info[k] for k in ('id', 'start', 'key')) or metadata.get('size') != size or not re.fullmatch(r'[0-9a-f]{64}',str(metadata.get('sha256',''))):
            raise ValueError('动作缓存损坏：' + info['id'])
        total += size
        if total > MAX_ARCHIVE: raise ValueError('组合已超过当前缓存容量，请拆成多个文件')
        sources.append((name, size, source, metadata))
    bundle_dir.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex
    target = bundle_dir / (token + '.humanmotion')
    try:
        with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            archive.writestr('manifest.json', serialized)
            for action_id, data in engine.items(): archive.writestr('engine/' + action_id + '.json', data)
            if material is not None:archive.write(material,'person/material.bin')
            for name, size, source, metadata in sources:
                archive.writestr('packets/' + name + '.json', json.dumps(metadata, separators=(',', ':')))
                entry=zipfile.ZipInfo('packets/'+name+'.bin');entry.compress_type=zipfile.ZIP_DEFLATED if manifest['schema']==SCHEMA else zipfile.ZIP_STORED;entry._compresslevel=1
                h=hashlib.sha256();written=0
                with source() as stream,archive.open(entry,'w',force_zip64=size>2_000_000_000) as dest:
                    for block in iter(lambda:stream.read(1024*1024),b''):
                        h.update(block);dest.write(block);written+=len(block)
                if written!=size or h.hexdigest()!=metadata['sha256']:raise ValueError('动作缓存损坏：'+metadata['id'])
        return token, target.stat().st_size
    except Exception:
        target.unlink(missing_ok=True)
        raise


def restore(upload, context, index, packet_dir, staging_root):
    staging = staging_root / ('import-' + uuid.uuid4().hex)
    staging.mkdir(parents=True)
    try:
        with zipfile.ZipFile(upload) as archive:
            entries = archive.infolist()
            if len(entries) != len(set(e.filename for e in entries)): raise ValueError('文件包含重复条目')
            try: manifest_info = archive.getinfo('manifest.json')
            except KeyError: raise ValueError('动作组合文件缺少清单')
            if manifest_info.file_size > MAX_MANIFEST: raise ValueError('人物档案过大')
            manifest = json.loads(archive.read(manifest_info))
            packets = validate(manifest, context, index)
            engine_files = manifest.get('engineFiles')
            ids = {item['id'] for item in manifest['actions']}
            if not isinstance(engine_files, dict) or set(engine_files) != ids: raise ValueError('动作骨架数据清单不完整')
            expected = {'manifest.json'} | {f'packets/{name}.{ext}' for name in packets for ext in ('json', 'bin')} | {f'engine/{action_id}.json' for action_id in ids}
            if {e.filename for e in entries} != expected: raise ValueError('动作组合文件条目不完整')
            if sum(e.file_size for e in entries) > MAX_ARCHIVE + MAX_MANIFEST + 512 * 1024**2: raise ValueError('动作组合文件超过当前缓存容量')
            for action_id in ids:
                entry = archive.getinfo(f'engine/{action_id}.json')
                if entry.file_size > 100 * 1024 * 1024: raise ValueError('动作骨架数据过大')
                if hashlib.sha256(archive.read(entry)).hexdigest() != engine_files[action_id]: raise ValueError('动作骨架数据校验失败')
            for name, info in packets.items():
                metadata_info = archive.getinfo(f'packets/{name}.json')
                if metadata_info.file_size > 4096: raise ValueError('动作片段信息无效')
                metadata = json.loads(archive.read(metadata_info))
                bin_info = archive.getinfo(f'packets/{name}.bin')
                if any(metadata.get(k) != info[k] for k in ('id', 'start', 'key')) or metadata.get('size') != bin_info.file_size or not re.fullmatch(r'[0-9a-f]{64}', str(metadata.get('sha256', ''))): raise ValueError('动作片段信息不匹配')
                path = staging / (name + '.bin')
                h = hashlib.sha256()
                with archive.open(bin_info) as source, path.open('xb') as dest:
                    for block in iter(lambda: source.read(1024 * 1024), b''):
                        h.update(block); dest.write(block)
                if h.hexdigest() != metadata['sha256']: raise ValueError('动作片段校验失败：' + info['id'])
                (staging / (name + '.json')).write_text(json.dumps(metadata), encoding='utf8')
        packet_dir.mkdir(parents=True, exist_ok=True)
        for name in packets:
            for suffix in ('.bin', '.json'):
                os.replace(staging / (name + suffix), packet_dir / (name + suffix))
        return manifest
    except (zipfile.BadZipFile, json.JSONDecodeError, UnicodeDecodeError, KeyError, TypeError) as exc:
        raise ValueError('动作组合文件损坏或格式不正确') from exc
    finally:
        shutil.rmtree(staging, ignore_errors=True)
