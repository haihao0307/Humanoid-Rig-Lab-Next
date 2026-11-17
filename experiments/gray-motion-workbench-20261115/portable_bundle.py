"""Read-only, validated motion packages kept separate from the local atlas."""
import hashlib,json,math,re,zipfile,threading
from collections import OrderedDict
from pathlib import Path
from motion_bundle import validate,MAX_MANIFEST,MAX_ARCHIVE

MAX_CLIP=100*1024*1024

def safe_clip(data,action):
    if not isinstance(data,dict):raise ValueError('动作轨道格式无效')
    id=action['id'];times=data.get('frameTimes');poses=data.get('poses');roots=data.get('rootTranslations')
    if data.get('schema')!='kaopu/human-npc-motion@1' or data.get('id')!=id or data.get('rig')!='anny' or data.get('sourceSHA256')!=action.get('sha256'):
        raise ValueError('动作骨架来源不匹配：'+id)
    if not isinstance(data.get('sourceRestHeightReference'),bool):raise ValueError('旧动作包缺少高度基准，请在原工作台重新导出：'+id)
    if not isinstance(times,list) or len(times)<2 or len(times)>6401 or not isinstance(poses,list) or not isinstance(roots,list) or len(poses)!=len(times) or len(roots)!=len(times):raise ValueError('动作轨道不完整：'+id)
    finite=lambda v:isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
    if times[0]!=0 or any(not finite(t) or (i and t<=times[i-1]) for i,t in enumerate(times)):raise ValueError('动作时间无效：'+id)
    # Workbench sampling is fixed to the original 30 Hz sequence. The last
    # time may be shorter, but no resampling or inferred source FPS is applied.
    if any(abs(t-i/30)>1e-7 for i,t in enumerate(times[:-1])) or times[-1]>(len(times)-1)/30+1e-7:raise ValueError('动作时间与工作台不兼容：'+id)
    joints=None
    for pose,root in zip(poses,roots):
        if not isinstance(pose,dict) or not pose or not isinstance(root,list) or len(root)!=3 or not all(finite(x) for x in root):raise ValueError('动作轨道无效：'+id)
        if joints is None:joints=set(pose)
        if set(pose)!=joints or any(not isinstance(v,list) or len(v)!=3 or not all(finite(x) for x in v) for v in pose.values()):raise ValueError('动作关节轨道无效：'+id)
    return {'status':'candidate','frames':len(times),'duration':times[-1],'frameDomain':False,'sha256':action['sha256'],'label':action.get('label') or id,'provider':'动作包','quality':'unvalidated-research-only'}


def inspect(path,context):
    try:
        with zipfile.ZipFile(path) as z:
            entries=z.infolist();names=[e.filename for e in entries]
            if len(names)!=len(set(names)):raise ValueError('动作包包含重复条目')
            if any(e.flag_bits&1 for e in entries):raise ValueError('动作包包含不支持的加密格式')
            m=z.getinfo('manifest.json')
            if m.file_size>MAX_MANIFEST:raise ValueError('人物档案过大')
            manifest=json.loads(z.read(m))
            if not isinstance(manifest,dict):raise ValueError('动作包清单无效')
            for entry in entries:
                allowed=(zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) if manifest.get('schema')=='human-function-motion-set/2' and entry.filename.startswith('packets/') and entry.filename.endswith('.bin') else (zipfile.ZIP_STORED,)
                if entry.compress_type not in allowed:raise ValueError('动作包包含不支持的压缩格式')
            actions=manifest.get('actions')
            if not isinstance(actions,list) or not actions:raise ValueError('动作包没有动作')
            engine_hashes=manifest.get('engineFiles');records={}
            if not isinstance(engine_hashes,dict):raise ValueError('动作轨道清单不完整')
            for action in actions:
                if not isinstance(action,dict):raise ValueError('动作记录无效')
                id=action.get('id','')
                if not isinstance(id,str) or not re.fullmatch(r'[a-z0-9_]+',id):raise ValueError('动作编号无效')
                if id in records:
                    if records[id]['sha256']!=action.get('sha256'):raise ValueError('同名动作来源冲突：'+id)
                    continue
                info=z.getinfo('engine/'+id+'.json')
                if info.file_size>MAX_CLIP:raise ValueError('动作轨道过大：'+id)
                raw=z.read(info)
                if hashlib.sha256(raw).hexdigest()!=engine_hashes.get(id):raise ValueError('动作轨道校验失败：'+id)
                clip=json.loads(raw);records[id]=safe_clip(clip,action)
            if set(engine_hashes)!=set(records):raise ValueError('动作轨道清单不匹配')
            packets=validate(manifest,context,records)
            expected={'manifest.json'}|{f'engine/{id}.json' for id in records}|{f'packets/{name}.{suffix}' for name in packets for suffix in ('json','bin')}
            material_hash=manifest.get('materialSHA256')
            if material_hash is not None:
                if not isinstance(material_hash,str) or not re.fullmatch(r'[0-9a-f]{64}',material_hash):raise ValueError('人物材质标识无效')
                material=z.getinfo('person/material.bin')
                if material.file_size>32*1024*1024 or hashlib.sha256(z.read(material)).hexdigest()!=material_hash:raise ValueError('人物材质数据校验失败')
                expected.add('person/material.bin')
            if set(names)!=expected:raise ValueError('动作包条目不完整')
            if sum(e.file_size for e in entries)>MAX_ARCHIVE+MAX_MANIFEST+512*1024**2:raise ValueError('动作文件超过当前容量')
            for name,info in packets.items():
                mi=z.getinfo('packets/'+name+'.json');bi=z.getinfo('packets/'+name+'.bin')
                if mi.file_size>4096 or bi.file_size<8 or bi.file_size>1_000_000_000:raise ValueError('动作片段大小无效')
                metadata=json.loads(z.read(mi))
                if any(metadata.get(k)!=info[k] for k in ('id','start','key')) or metadata.get('size')!=bi.file_size or not re.fullmatch(r'[0-9a-f]{64}',str(metadata.get('sha256',''))):raise ValueError('动作片段信息不匹配')
                h=hashlib.sha256()
                with z.open(bi) as stream:
                    for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
                if h.hexdigest()!=metadata['sha256']:raise ValueError('动作片段校验失败：'+info['id'])
            return {'manifest':manifest,'records':records,'packets':packets,'clipCache':OrderedDict(),'clipLock':threading.RLock()}
    except (zipfile.BadZipFile,json.JSONDecodeError,UnicodeDecodeError,KeyError,TypeError) as e:raise ValueError('动作包损坏或格式不正确') from e


def clip(bundle,id):
    if id not in bundle['records']:raise ValueError('动作包中没有该动作')
    with bundle['clipLock']:
        cached=bundle['clipCache'].get(id)
        if cached is not None:bundle['clipCache'].move_to_end(id);return cached
        with zipfile.ZipFile(bundle['path']) as z:raw=z.read('engine/'+id+'.json')
        if hashlib.sha256(raw).hexdigest()!=bundle['manifest']['engineFiles'][id]:raise ValueError('动作轨道校验失败：'+id)
        data=json.loads(raw);bundle['clipCache'][id]=data
        while len(bundle['clipCache'])>2:bundle['clipCache'].popitem(last=False)
        return data

def segment(bundle,id,frame):
    data=clip(bundle,id);times=data['frameTimes'];n=len(times)
    if not 0<=frame<n:raise ValueError('动作帧超出范围')
    start=min((frame//32)*32,max(0,n-2));end=min(start+32,n-1);t0=times[start];local=[x-t0 for x in times[start:end+1]]
    segment_clip={'schema':'human-motion-adaptation-clip/1','id':id,'fps':30,'frameCount':len(local),'duration':local[-1],'frameTimes':local,
          'footContacts':[[0,0,0,0] for _ in local],
          'retargeted':{'rig':'anny','scale':1,'poses':data['poses'][start:end+1],'rootTranslations':data['rootTranslations'][start:end+1]},
          'provenance':{'compactForBody':True,'sourceRestHeightReference':data['sourceRestHeightReference'],'sourceStartFrame':start,'motionPackage':True}}
    return {'schema':'atlas-research-segment/1','id':id,'start':start,'end':end,'totalFrames':n,'startTime':t0,'frameDomain':False,'clip':segment_clip,'quality':'unvalidated-research-only'}
