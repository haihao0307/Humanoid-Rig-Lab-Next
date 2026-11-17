"""Isolated locomotion study using the existing function-body services."""
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs
from urllib import request,error
import argparse,hashlib,json,mimetypes,re,sys,uuid,threading,struct,math,zipfile,contextlib
from collections import OrderedDict
import motion_bundle
import portable_bundle
from tools.moving_turn_gate import check as check_moving_turn
from tools.idle_gate import check as check_idle_candidate
if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf8')
ROOT=Path(__file__).resolve().parent;PREVIOUS=ROOT.parent/'Human-Motion-Adaptation-R01-20261104';SOURCE='http://127.0.0.1:9014'
HEAD_SOURCE='http://127.0.0.1:18912';HEAD_ROOT=ROOT.parent/'Human-Function-Head-R04-20261023'
DYNAMIC_BODY=ROOT.parent/'Human-MotionBricks-R03-20261101'/'.runtime'/'dynamic-body.html'
ATLAS=ROOT.parent/'Human-Motion-Atlas-Integration-R01-20261112'
ATLAS_LOCK=threading.Lock();ATLAS_LOADED={}
ATLAS_INDEX_LOCK=threading.Lock();ATLAS_INDEX_CACHE={}
ATLAS_CORRECTION_LOCK=threading.Lock();ATLAS_CORRECTION_CACHE={}
ATLAS_THUMB_LOCK=threading.Lock();ATLAS_THUMB_CACHE={}
CACHE_DIR=ROOT/'.runtime'/'prepared';VERIFIED={}
ATLAS_PACKET_DIR=ROOT/'.runtime'/'atlas-packets';ATLAS_PACKET_LOCK=threading.Lock();ATLAS_PACKET_LIMIT=28*1024**3
BUNDLE_DIR=ROOT/'.runtime'/'motion-bundles'
MATERIAL_DIR=ROOT/'.runtime'/'motion-materials'
IMPORTED_BUNDLE_DIR=ROOT/'.runtime'/'imported-motion-bundles';IMPORTED_BUNDLE_LOCK=threading.RLock();IMPORTED_BUNDLES=OrderedDict()
ENGINE_MOTION=ROOT.parent/'Function-World-Engine-R10-20261028'/'research'/'human-life'
R06=ROOT.parent/'Human-Motion-Runtime-R06-20261106'
LEGACY_CACHE_DIR=R06/'.runtime'/'prepared'
def manifest():
    result=json.loads((ROOT/'data/adaptation-manifest.json').read_text(encoding='utf8'))
    for row in result['clips']:
        if row.get('visualReview',{}).get('status')=='rejected':row['hidden']=True
        if row.get('requiresIdleGate'):
            ok,reason=check_idle_candidate(row)
            row['idleGate']={'passed':ok,'reason':reason}
            if not ok:row['hidden']=True
        if row['id'].startswith('movingturn') or 'moving-turn' in row.get('kind','') or row.get('requiresSoleGate'):
            ok,reason=check_moving_turn(row)
            row['soleGate']={'passed':ok,'reason':reason}
            if not ok:row['hidden']=True
    return result
def cache_args(path):
    args=parse_qs(urlparse(path).query);id=args.get('id',[''])[0];key=args.get('key',[''])[0]
    if not re.fullmatch(r'[a-z][a-z0-9]*',id) or not re.fullmatch(r'[0-9a-f]{64}',key):raise ValueError('缓存标识无效')
    if not any(row['id']==id for row in manifest()['clips']):raise ValueError('缓存动作不存在')
    return id,key,CACHE_DIR/(id+'-'+key+'.bin')
def atlas_packet_args(path):
    args=parse_qs(urlparse(path).query);id=args.get('id',[''])[0];key=args.get('key',[''])[0]
    try:start=int(args.get('start',[''])[0])
    except ValueError:raise ValueError('动作段编号无效')
    if not re.fullmatch(r'[a-z0-9_]+',id) or not re.fullmatch(r'[0-9a-f]{64}',key):raise ValueError('动作缓存标识无效')
    source=args.get('sourceBundle',[''])[0]
    row=imported_bundle(source)['records'].get(id) if source else atlas_index()['records'].get(id)
    if not row or row.get('status')!='candidate' or start<0 or start>=row['frames']-1:raise ValueError('动作缓存不存在')
    return id,start,key,ATLAS_PACKET_DIR/(id+'-'+str(start)+'-'+key+'.bin')

def atlas_packet_context():
    bridge=(ROOT/'body-bridge.js').read_text(encoding='utf8');start=bridge.index('\n state(pose){');end=bridge.index('\n activate(prepared,',start)
    # Only state construction and packet building affect cached function data;
    # rendering and camera improvements do not invalidate those exact packets.
    build=hashlib.sha256(bridge[start:end].encode('utf8')).hexdigest()
    return {'schema':'atlas-packet-context/3','dynamicBody':file_hash(DYNAMIC_BODY),'bridgeBuild':build,'codec':file_hash(ROOT/'prepared-codec.js')}

def trim_atlas_packet_cache(protected):
    files=[f for f in ATLAS_PACKET_DIR.glob('*.bin') if f.is_file()]
    sizes=[(f.stat().st_mtime_ns,f.stat().st_size,f) for f in files];total=sum(x[1] for x in sizes)
    for _,size,f in sorted(sizes):
        if total<=ATLAS_PACKET_LIMIT:break
        if f==protected:continue
        try:f.unlink();f.with_suffix('.json').unlink(missing_ok=True);total-=size
        except OSError:pass

def file_hash(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def prepared_context():
    bridge=(ROOT/'body-bridge.js').read_text(encoding='utf8');start=bridge.index('\n state(pose){');end=bridge.index('\n activate(prepared,',start)
    viewer=(ROOT/'viewer.js').read_text(encoding='utf8');state_config=re.search(r'bridge\.state=pose=>\{[^\n]+\};',viewer)
    if not state_config:raise ValueError('人物动作配置未找到')
    sha=lambda text:hashlib.sha256(text.encode('utf8')).hexdigest()
    return {'schema':'function-packet-context/3','bridgeBuildSHA256':sha(bridge[start:end]),'stateConfigSHA256':sha(state_config.group()),'stitchSHA256':file_hash(ROOT/'tools/packet-tangent-stitch.js'),'codecSHA256':file_hash(ROOT/'prepared-codec.js'),'storeSHA256':file_hash(ROOT/'prepared-store.js'),'dynamicBodyLiveSHA256':file_hash(DYNAMIC_BODY)}
def read_video_manifest():
    f=ROOT/'review/videos.json'
    return json.loads(f.read_text(encoding='utf8')) if f.exists() else {}
def read_gallery():
    f=ROOT/'review/motion-gallery.json'
    return json.loads(f.read_text(encoding='utf8')) if f.exists() else {'videos':[]}
def atlas_index():
    path=ATLAS/'batch-index.json'
    if not path.is_file():return {'records':{}}
    with ATLAS_INDEX_LOCK:
        for _ in range(3):
            before=path.stat();key=(before.st_size,before.st_mtime_ns)
            if ATLAS_INDEX_CACHE.get('key')==key:return ATLAS_INDEX_CACHE['data']
            blob=path.read_bytes();after=path.stat()
            if key!=(after.st_size,after.st_mtime_ns) or len(blob)!=before.st_size:continue
            data=json.loads(blob)
            if not isinstance(data.get('records'),dict):raise ValueError('动作目录记录无效')
            ATLAS_INDEX_CACHE.clear();ATLAS_INDEX_CACHE.update(key=key,data=data);return data
    raise ValueError('动作目录正在更新，请稍后重试')
def atlas_corrections():
    compact=ATLAS/'foot-patches-index.json';path=compact if compact.is_file() else ATLAS/'research-foot-batch-index.json';check=ATLAS/'research-foot-batch-check.json'
    if not path.is_file() or not check.is_file():return {}
    with ATLAS_CORRECTION_LOCK:
        stat=path.stat();audit=check.stat();key=(stat.st_size,stat.st_mtime_ns,audit.st_size,audit.st_mtime_ns)
        if ATLAS_CORRECTION_CACHE.get('key')==key:return ATLAS_CORRECTION_CACHE['entries']
        result=json.loads(path.read_text(encoding='utf8'));verification=json.loads(check.read_text(encoding='utf8'))
        if result.get('schema') not in ('atlas-foot-spine-candidates/1','atlas-lossless-foot-patches/1') or result.get('failed') or verification.get('errorCount')!=0:raise ValueError('脚掌动作修正校验未通过')
        for name,expected in result.get('scriptHashes',{}).items():
            f=(ATLAS/name).resolve()
            if not f.is_relative_to(ATLAS.resolve()) or file_hash(f)!=expected:raise ValueError('脚掌动作转换程序已变化')
        entries=result.get('entries',{});ATLAS_CORRECTION_CACHE.clear();ATLAS_CORRECTION_CACHE.update(key=key,entries=entries);return entries

def atlas_catalog():
    index=atlas_index()['records']
    rows=[]
    for filename,provider in [('assets_cmu_catalog.json','CMU'),('assets_mesh2motion_catalog.json','Mesh2Motion'),('assets_catalog.json','Quaternius')]:
        data=json.loads((ATLAS/filename).read_text(encoding='utf8'))
        for c in data['clips']:
            rows.append({'id':c['id'],'name':c.get('label') or c.get('name') or c['id'],'category':c.get('category') or '其他',
                'provider':provider,'fps':c.get('fps'),'fpsVerified':c.get('fpsVerified',provider!='CMU'),
                'sourceSaved':(ATLAS/c['url'].removeprefix('./')).is_file(),'researchPreview':c['id']=='cmu_16_33',
                'candidateStatus':index.get(c['id'],{}).get('status','pending')})
    for id,c in index.items():
        if c.get('variant')=='root-motion':
            rows.append({'id':id,'name':c['label'],'category':c['category'],'provider':c['provider'],'fps':c.get('sourceFps'),
                         'fpsVerified':True,'sourceSaved':(ATLAS/c['sourceURL'].removeprefix('./')).is_file(),
                         'researchPreview':False,'candidateStatus':c['status']})
    return {'schema':'atlas-research-catalog/1','clips':rows}
def atlas_thumbnails(ids):
    if len(ids)>60 or any(not re.fullmatch(r'[a-z0-9_]+',id) for id in ids):raise ValueError('动作预览编号无效')
    file=ATLAS/'batch-thumbnail-index.json'
    if not file.is_file():return {'edges':[],'records':{}}
    with ATLAS_THUMB_LOCK:
        stat=file.stat();key=(stat.st_size,stat.st_mtime_ns)
        if ATLAS_THUMB_CACHE.get('key')!=key:
            data=json.loads(file.read_text(encoding='utf8'))
            if data.get('schema')!='atlas-target-joint-thumbnails/1':raise ValueError('动作预览数据版本无效')
            ATLAS_THUMB_CACHE.clear();ATLAS_THUMB_CACHE.update(key=key,data=data)
        data=ATLAS_THUMB_CACHE['data'];index=atlas_index()['records']
        return {'edges':data['edges'],'records':{id:data['records'][id]['p'] for id in ids if id in data['records'] and id in index and data['records'][id]['h']==index[id]['sha256']}}
def atlas_candidate(id):
    if not re.fullmatch(r'[a-z0-9_]+',id):raise ValueError('无效动作编号')
    index=atlas_index();base=index['records'].get(id)
    if not base or base.get('status')!='candidate':raise ValueError('该动作尚未准备或转换失败')
    correction=atlas_corrections().get(id);row=base;patch=None
    if correction and correction.get('sourceSHA256')==base['sha256'] and correction.get('frames')==base['frames']:
        if correction.get('patchSHA256'):
            patch=(ATLAS/correction['output']).resolve()
            if not patch.is_relative_to((ATLAS/'foot-patches').resolve()) or not patch.is_file():raise ValueError('脚掌动作修正数据不存在')
            row={**base,'originalSHA256':base['sha256'],'sha256':correction['sha256'],'footCorrection':'lossless-source-full-foot-orientation'}
        else:row={**base,'originalSHA256':base['sha256'],'sha256':correction['sha256'],'output':correction['output'],'footCorrection':'source-full-foot-orientation'}
    f=(ATLAS/row['output']).resolve();roots=((ATLAS/'batch-actions').resolve(),(ATLAS/'research-foot').resolve())
    if not any(f.is_relative_to(root) for root in roots) or not f.is_file():raise ValueError('动作数据不存在')
    stat=f.stat();pstat=patch.stat() if patch else None;key=(id,str(f),stat.st_size,stat.st_mtime_ns,row['sha256'],pstat.st_size if pstat else None,pstat.st_mtime_ns if pstat else None)
    with ATLAS_LOCK:
        if ATLAS_LOADED.get('key')!=key:
            blob=f.read_bytes();expected=base['sha256'] if patch else row['sha256']
            if hashlib.sha256(blob).hexdigest()!=expected:raise ValueError('动作数据完整性校验失败')
            data=json.loads(blob)
            if data.get('id')!=id or data.get('quality')!='unvalidated-research-only' or len(data.get('frames',[]))!=row['frames']:raise ValueError('动作记录不一致')
            if patch:
                raw=patch.read_bytes();names=correction.get('joints',[]);frames=data['frames'];count=len(names)
                if hashlib.sha256(raw).hexdigest()!=correction['patchSHA256'] or len(raw)!=16+len(frames)*count*3*8 or raw[:8]!=b'HAFIX001':raise ValueError('脚掌动作修正校验失败')
                n,joints=struct.unpack_from('<II',raw,8)
                if n!=len(frames) or joints!=count or count!=18:raise ValueError('脚掌动作修正数量不匹配')
                fmt=struct.Struct('<'+str(count*3)+'d');offset=16
                for frame in frames:
                    values=fmt.unpack_from(raw,offset);offset+=fmt.size
                    if any(not math.isfinite(x) or abs(x)>180 for x in values):raise ValueError('动作旋转超出范围')
                    frame['pose']={name:list(values[i*3:i*3+3]) for i,name in enumerate(names)}
                data['method']=correction.get('method');data['limitations']=correction.get('limitations')
                if correction.get('rmsDirectionErrorDegrees') is not None:data['rmsDirectionErrorDegrees']=correction['rmsDirectionErrorDegrees']
            ATLAS_LOADED.clear();ATLAS_LOADED.update(key=key,data=data)
        return row,ATLAS_LOADED['data']

def atlas_segment(id,frame,compact=False):
    row,data=atlas_candidate(id);frames=data['frames'];n=len(frames)
    if frame<0 or frame>=n:raise ValueError('动作帧超出范围')
    start=min((frame//32)*32,max(0,n-2));end=min(start+32,n-1);block=frames[start:end+1]
    is_frame=bool(data.get('frameDomain'));t0=block[0]['time'];times=[i/30 if is_frame else x['time']-t0 for i,x in enumerate(block)]
    if len(block)<2 or times[0]!=0 or any(times[i]<=times[i-1] for i in range(1,len(times))):raise ValueError('动作时间无效')
    scale=data['scale'];vertical_reference=0;rest_reference=False
    if data.get('provider') in ('Mesh2Motion','Quaternius') and isinstance(data.get('sourceRestFootY'),(int,float)):
        names=data['names'];il=names.index('thigh_l');ir=names.index('thigh_r')
        h=(frames[0]['sourceJointWorldPositionsAndLocalRotations'][il][1]+frames[0]['sourceJointWorldPositionsAndLocalRotations'][ir][1])/2
        target=json.loads((ROOT.parent/'Human-MotionBricks-R01-20261030/data/target-rig.json').read_text(encoding='utf8'))
        sole=json.loads((ATLAS/'neutral-sole-evidence.json').read_text(encoding='utf8'))
        target_blob=(ROOT.parent/'Human-MotionBricks-R01-20261030/data/target-rig.json').read_bytes()
        if hashlib.sha256(target_blob).hexdigest()!=data['targetRigSHA256'] or sole['archiveStateSHA256']!='81a30e810ba92d4d491a0861b2e06aa27333e9d30b00d473a871a6fb1a61b4db':raise ValueError('人物基准不匹配')
        li=target['labels'].index('upperleg01.L');ri=target['labels'].index('upperleg01.R');hip=(target['referenceWorld'][li][11]+target['referenceWorld'][ri][11])/2
        floor=min(p[2] for side in ('L','R') for p in sole['points'][side]);vertical_reference=(h-data['sourceRestFootY'])*scale+floor-hip;rest_reference=True
    clip={'schema':'human-motion-adaptation-clip/1','id':id,'fps':30,'frameCount':len(block),'duration':times[-1],'frameTimes':times,
          'footContacts':[[0,0,0,0] for _ in block],
          'retargeted':{'rig':'anny','scale':scale,'poses':[f['pose'] for f in block],
                        'rootTranslations':[[f['rootTranslationNativeZUp'][0],f['rootTranslationNativeZUp'][2]+vertical_reference,-f['rootTranslationNativeZUp'][1]] for f in block]},
          'provenance':{'source':data.get('source'),'sourceFPS':data.get('fps'),'frameDomain':is_frame,'sourceRestHeightReference':rest_reference,'sourceStartFrame':block[0]['sourceFrame']}}
    if compact:clip['provenance']['compactForBody']=True
    else:clip['sourceFrames']=[f['sourceJointWorldPositionsAndLocalRotations'] for f in block]
    return {'schema':'atlas-research-segment/1','id':id,'start':start,'end':end,'totalFrames':n,'startTime':t0,'frameDomain':is_frame,'clip':clip,'quality':'unvalidated-research-only','warning':'身体适配尚未验收；接触未知，头部与手部可能未接入。'}
def atlas_probe(id,extra=()):
    """Genuine source-time samples, for bulk runtime checks only."""
    row,data=atlas_candidate(id);n=len(data['frames'])
    if len(extra)>4 or any(not isinstance(i,int) or i<0 or i>=n for i in extra):raise ValueError('动作取样帧无效')
    anchors=sorted({0,(n-1)//2,n-1,*extra});samples=[]
    for anchor in anchors:
        segment=atlas_segment(id,anchor,True);clip=segment['clip'];i=anchor-segment['start'];lo=min(i,clip['frameCount']-2)
        begin,end=clip['frameTimes'][lo:lo+2];duration=end-begin
        small={**clip,'frameCount':2,'duration':duration,'frameTimes':[0,duration],
            'provenance':{**clip['provenance'],'sourceStartFrame':data['frames'][segment['start']+lo]['sourceFrame'],'auditCandidateFrameIndex':anchor},
            'footContacts':clip['footContacts'][lo:lo+2],
            'retargeted':{**clip['retargeted'],'poses':clip['retargeted']['poses'][lo:lo+2],
                          'rootTranslations':clip['retargeted']['rootTranslations'][lo:lo+2]}}
        samples.append({'sourceFrameIndex':anchor,'sampleTime':0 if i==lo else duration,'clip':small})
    return {'schema':'atlas-runtime-probe/1','id':id,'samples':samples,'frameDomain':bool(row.get('frameDomain')),
            'scope':'Discrete start, middle, end and optional flagged-frame samples only; not full playback or visual acceptance.'}

def imported_bundle(token):
    if not re.fullmatch(r'(?:[0-9a-f]{32}|[0-9a-f]{64})',str(token)):raise ValueError('动作包标识无效')
    path=IMPORTED_BUNDLE_DIR/(token+'.humanmotion')
    if not path.is_file():raise ValueError('导入的动作包不存在，请重新导入')
    stat=path.stat();key=(stat.st_size,stat.st_mtime_ns)
    with IMPORTED_BUNDLE_LOCK:
        old=IMPORTED_BUNDLES.get(token)
        if old and old['key']==key:IMPORTED_BUNDLES.move_to_end(token);return old['data']
        data=portable_bundle.inspect(path,atlas_packet_context());data['path']=path
        IMPORTED_BUNDLES[token]={'key':key,'data':data};IMPORTED_BUNDLES.move_to_end(token)
        while len(IMPORTED_BUNDLES)>4:IMPORTED_BUNDLES.popitem(last=False)
        return data

def bundle_index(manifest):
    result={};sources={}
    for item in manifest.get('actions',[]):
        id=item.get('id','') if isinstance(item,dict) else ''
        bundle=item.get('bundle') if isinstance(item,dict) else None
        if bundle:
            source=imported_bundle(bundle)
            row=source['records'].get(id)
            if not row:raise ValueError('导入动作不存在：'+id)
        else:row,_=atlas_candidate(id)
        if id in result and result[id]['sha256']!=row['sha256']:raise ValueError('同名动作来源冲突：'+id)
        if id in sources and sources[id]!=bundle:
            previous=sources[id]
            first=portable_bundle.clip(imported_bundle(previous),id) if previous else bundle_engine_clip(id)
            second=portable_bundle.clip(imported_bundle(bundle),id) if bundle else bundle_engine_clip(id)
            canonical=lambda clip:hashlib.sha256(json.dumps(clip,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode('utf8')).hexdigest()
            if canonical(first)!=canonical(second):raise ValueError('同名动作的轨道不同，请分别导出：'+id)
        sources[id]=bundle
        result[id]=row
    return result

@contextlib.contextmanager
def open_bundle_member(path,name):
    with zipfile.ZipFile(path) as z:
        with z.open(name) as stream:yield stream

def bundle_export_sources(manifest):
    actions={};packets={}
    for item in manifest['actions']:
        token=item.get('bundle')
        if not token:continue
        data=imported_bundle(token);id=item['id'];actions.setdefault(id,data)
        for p in item['packets']:
            name=f"{id}-{p['start']}-{p['key']}"
            # A new person has a different cache key; those packets come from
            # the local prepared cache while their source track stays in bundle.
            if name in data['packets']:packets[name]=data
    def source(name,info):
        data=packets.get(name)
        if not data:return None
        path=data['path'];member='packets/'+name+'.bin'
        with zipfile.ZipFile(path) as z:
            meta=json.loads(z.read('packets/'+name+'.json'));size=z.getinfo(member).file_size
        return meta,size,lambda:open_bundle_member(path,member)
    def clip(id):return portable_bundle.clip(actions[id],id) if id in actions else bundle_engine_clip(id)
    return source,clip

def bundle_engine_clip(id):
    row,_=atlas_candidate(id);times=[];poses=[];roots=[];rest_reference=False
    for start in range(0,row['frames']-1,32):
        block=atlas_segment(id,start,True);clip=block['clip'];skip=1 if start else 0
        rest_reference=bool(clip['provenance'].get('sourceRestHeightReference'))
        times.extend(block['startTime']+t for t in clip['frameTimes'][skip:])
        poses.extend(clip['retargeted']['poses'][skip:]);roots.extend(clip['retargeted']['rootTranslations'][skip:])
    if len(times)!=row['frames'] or any(times[i]<=times[i-1] for i in range(1,len(times))):raise ValueError('引擎动作时间不完整')
    return {'schema':'kaopu/human-npc-motion@1','id':id,'rig':'anny','sourceSHA256':row['sha256'],
            'timeUnit':'seconds','poseRepresentation':'anny.pose rotation vectors in degrees','rootCoordinateSystem':'body-runtime-y-up','sourceRestHeightReference':rest_reference,
            'frameTimes':times,'poses':poses,'rootTranslations':roots,'quality':'unvalidated-research-only'}
class Handler(BaseHTTPRequestHandler):
    def log_message(self,fmt,*args):
        if not self.path.startswith('/assets/'):print(fmt%args,flush=True)
    def data(self,blob,mime,status=200):
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(blob)));self.send_header('Cache-Control','no-store');self.end_headers()
        try:self.wfile.write(blob)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
    def json(self,x,status=200):return self.data(json.dumps(x,ensure_ascii=False,allow_nan=False).encode('utf8'),'application/json; charset=utf-8',status)
    def video(self,file):
        if not file.is_file():return self.json({'error':'视频尚未完成'},404)
        size=file.stat().st_size;start,end,status=0,size-1,200
        if self.headers.get('Range'):
            m=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers['Range'])
            if not m:return self.json({'error':'无效范围'},416)
            start=int(m.group(1));end=min(end,int(m.group(2))) if m.group(2) else end
            if start>end or start>=size:return self.json({'error':'无效范围'},416)
            status=206
        self.send_response(status);self.send_header('Content-Type','video/webm');self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes');self.send_header('Cache-Control','no-store')
        if status==206:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.end_headers()
        try:
            with file.open('rb') as stream:
                stream.seek(start);remaining=end-start+1
                while remaining:
                    block=stream.read(min(remaining,1024*1024))
                    if not block:break
                    self.wfile.write(block);remaining-=len(block)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
    def proxy(self,source=SOURCE):
        headers={'Range':self.headers['Range']} if self.headers.get('Range') else {}
        try:upstream=request.urlopen(request.Request(source+self.path,headers=headers),timeout=180)
        except error.HTTPError as exc:upstream=exc
        except Exception as exc:return self.json({'error':'人物预览服务未连接：'+str(exc)},502)
        with upstream:
            self.send_response(upstream.status)
            for key in ('Content-Type','Content-Length','Content-Range','Accept-Ranges','Cache-Control'):
                if upstream.headers.get(key):self.send_header(key,upstream.headers[key])
            self.end_headers()
            try:
                while True:
                    block=upstream.read(1024*1024)
                    if not block:break
                    self.wfile.write(block)
            except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
    def cached_file(self):
        id,key,path=cache_args(self.path);sidecar=path.with_suffix('.json')
        if not path.is_file() or not sidecar.is_file():
            path=LEGACY_CACHE_DIR/path.name;sidecar=path.with_suffix('.json')
        if not path.is_file() or not sidecar.is_file():return self.json({'error':'尚未预计算'},404)
        info=json.loads(sidecar.read_text(encoding='utf8'));stat=path.stat();identity=(str(path),stat.st_size,stat.st_mtime_ns)
        if info.get('id')!=id or info.get('key')!=key or info.get('size')!=stat.st_size:return self.json({'error':'缓存记录不匹配'},409)
        if identity not in VERIFIED:
            if file_hash(path)!=info.get('sha256'):return self.json({'error':'缓存校验失败'},409)
            VERIFIED[identity]=True
        self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(stat.st_size));self.send_header('Cache-Control','no-store');self.end_headers()
        try:
            with path.open('rb') as f:
                for block in iter(lambda:f.read(1024*1024),b''):self.wfile.write(block)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
    def atlas_packet_file(self):
        id,start,key,path=atlas_packet_args(self.path);sidecar=path.with_suffix('.json')
        if not path.is_file() or not sidecar.is_file():return self.data(b'','application/octet-stream',204)
        info=json.loads(sidecar.read_text(encoding='utf8'));stat=path.stat();identity=(str(path),stat.st_size,stat.st_mtime_ns)
        if info.get('id')!=id or info.get('start')!=start or info.get('key')!=key or info.get('size')!=stat.st_size:raise ValueError('动作缓存记录不匹配')
        if identity not in VERIFIED:
            if file_hash(path)!=info.get('sha256'):raise ValueError('动作缓存校验失败')
            VERIFIED[identity]=True
        self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(stat.st_size));self.send_header('Cache-Control','no-store');self.end_headers()
        try:
            with path.open('rb') as f:
                for block in iter(lambda:f.read(1024*1024),b''):self.wfile.write(block)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
        try:
            path.touch();updated=path.stat();VERIFIED[(str(path),updated.st_size,updated.st_mtime_ns)]=True
        except OSError:pass
    def save_atlas_packet(self):
        origin=self.headers.get('Origin')
        if origin and origin!=f'http://127.0.0.1:{self.server.server_port}':return self.json({'error':'来源不匹配'},403)
        if self.headers.get('Content-Type','').split(';')[0]!='application/octet-stream':return self.json({'error':'缓存类型不匹配'},415)
        try:
            id,start,key,path=atlas_packet_args(self.path);length=int(self.headers.get('Content-Length','0'))
            if length<8 or length>1_000_000_000:raise ValueError('动作缓存长度无效')
            ATLAS_PACKET_DIR.mkdir(parents=True,exist_ok=True);temporary=ATLAS_PACKET_DIR/(path.name+'.'+uuid.uuid4().hex+'.tmp');h=hashlib.sha256();remaining=length
            try:
                with temporary.open('xb') as f:
                    while remaining:
                        block=self.rfile.read(min(1024*1024,remaining))
                        if not block:raise ValueError('动作缓存上传不完整')
                        h.update(block);f.write(block);remaining-=len(block)
                with ATLAS_PACKET_LOCK:
                    temporary.replace(path);info={'id':id,'start':start,'key':key,'size':length,'sha256':h.hexdigest()}
                    sidecar=path.with_suffix('.json');tmp=sidecar.with_name(sidecar.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(info),encoding='utf8');tmp.replace(sidecar)
                    stat=path.stat();VERIFIED[(str(path),stat.st_size,stat.st_mtime_ns)]=True;trim_atlas_packet_cache(path)
                return self.json({'passed':True,'bytes':length})
            finally:
                if temporary.exists():temporary.unlink()
        except (OSError,ValueError,KeyError) as exc:return self.json({'error':str(exc)},409)
    def do_POST(self):
        if urlparse(self.path).path=='/api/motion-bundle-material':
            origin=self.headers.get('Origin')
            if origin and origin!=f'http://127.0.0.1:{self.server.server_port}':return self.json({'error':'来源不匹配'},403)
            try:
                length=int(self.headers.get('Content-Length','0'))
                if self.headers.get('Content-Type','').split(';')[0]!='application/octet-stream' or not 8<=length<=32*1024*1024:raise ValueError('人物材质数据无效')
                raw=self.rfile.read(length)
                if len(raw)!=length or raw[:4]!=b'HB06':raise ValueError('人物材质数据不完整')
                token=hashlib.sha256(raw).hexdigest();MATERIAL_DIR.mkdir(parents=True,exist_ok=True);target=MATERIAL_DIR/(token+'.bin')
                if not target.is_file():
                    temporary=MATERIAL_DIR/(token+'.'+uuid.uuid4().hex+'.tmp')
                    try:temporary.write_bytes(raw);temporary.replace(target)
                    finally:temporary.unlink(missing_ok=True)
                return self.json({'token':token,'bytes':length})
            except (OSError,ValueError) as exc:return self.json({'error':str(exc)},409)
        if urlparse(self.path).path in ('/api/motion-bundle-export','/api/motion-bundle-import'):
            origin=self.headers.get('Origin')
            if origin and origin!=f'http://127.0.0.1:{self.server.server_port}':return self.json({'error':'来源不匹配'},403)
            endpoint=urlparse(self.path).path
            try:
                length=int(self.headers.get('Content-Length','0'))
                if endpoint.endswith('export'):
                    if not 0<length<=motion_bundle.MAX_MANIFEST:raise ValueError('动作组合清单大小无效')
                    manifest=json.loads(self.rfile.read(length))
                    index=bundle_index(manifest);provider,clip=bundle_export_sources(manifest)
                    token,size=motion_bundle.create(manifest,atlas_packet_context(),index,ATLAS_PACKET_DIR,BUNDLE_DIR,clip,provider,MATERIAL_DIR)
                    return self.json({'token':token,'bytes':size})
                if not 0<length<=motion_bundle.MAX_ARCHIVE+512*1024**2:raise ValueError('动作文件大小无效')
                BUNDLE_DIR.mkdir(parents=True,exist_ok=True);upload=BUNDLE_DIR/('upload-'+uuid.uuid4().hex+'.tmp')
                try:
                    with upload.open('xb') as f:
                        remaining=length;upload_hash=hashlib.sha256()
                        while remaining:
                            block=self.rfile.read(min(1024*1024,remaining))
                            if not block:raise ValueError('动作文件上传不完整')
                            f.write(block);upload_hash.update(block);remaining-=len(block)
                    data=portable_bundle.inspect(upload,atlas_packet_context())
                    IMPORTED_BUNDLE_DIR.mkdir(parents=True,exist_ok=True);token=upload_hash.hexdigest();target=IMPORTED_BUNDLE_DIR/(token+'.humanmotion')
                    with IMPORTED_BUNDLE_LOCK:
                        if target.exists():
                            if file_hash(target)!=token:raise ValueError('已有动作包存储校验失败，请检查磁盘')
                            upload.unlink()
                        else:upload.replace(target)
                        data['path']=target;stat=target.stat();IMPORTED_BUNDLES[token]={'key':(stat.st_size,stat.st_mtime_ns),'data':data};IMPORTED_BUNDLES.move_to_end(token)
                        while len(IMPORTED_BUNDLES)>4:IMPORTED_BUNDLES.popitem(last=False)
                    return self.json({'manifest':data['manifest'],'bundle':token})
                finally:upload.unlink(missing_ok=True)
            except (OSError,ValueError,KeyError,TypeError,json.JSONDecodeError,zipfile.BadZipFile) as exc:return self.json({'error':str(exc)},409)
        if urlparse(self.path).path=='/api/atlas-packet':return self.save_atlas_packet()
        if urlparse(self.path).path!='/api/prepared':return self.json({'error':'接口不存在'},404)
        origin=self.headers.get('Origin')
        if origin and origin!=f'http://127.0.0.1:{self.server.server_port}':return self.json({'error':'来源不匹配'},403)
        if self.headers.get('Content-Type','').split(';')[0]!='application/octet-stream':return self.json({'error':'缓存类型不匹配'},415)
        try:
            id,key,path=cache_args(self.path);length=int(self.headers.get('Content-Length','0'))
            if length<8 or length>2_000_000_000:raise ValueError('缓存长度无效')
            CACHE_DIR.mkdir(parents=True,exist_ok=True);temporary=CACHE_DIR/(path.name+'.'+uuid.uuid4().hex+'.tmp');h=hashlib.sha256();remaining=length
            try:
                with temporary.open('xb') as f:
                    while remaining:
                        block=self.rfile.read(min(1024*1024,remaining))
                        if not block:raise ValueError('缓存上传不完整')
                        h.update(block);f.write(block);remaining-=len(block)
                temporary.replace(path)
                info={'id':id,'key':key,'size':length,'sha256':h.hexdigest()}
                sidecar=path.with_suffix('.json');tmpmeta=sidecar.with_name(sidecar.name+'.'+uuid.uuid4().hex+'.tmp');tmpmeta.write_text(json.dumps(info),encoding='utf8');tmpmeta.replace(sidecar)
                stat=path.stat();VERIFIED[(str(path),stat.st_size,stat.st_mtime_ns)]=True
                return self.json({'passed':True,'bytes':length,'sha256':info['sha256']})
            finally:
                if temporary.exists():temporary.unlink()
        except (OSError,ValueError,KeyError) as exc:return self.json({'error':str(exc)},409)
    def do_GET(self):
        url=urlparse(self.path).path;files={'/':'index.html','/atlas-catalog':'atlas-preview.html','/atlas-preview':'atlas-preview.html','/atlas-preview.js':'atlas-preview.js','/source-demo.js':'source-demo.js','/atlas-packet-store.js':'atlas-packet-store.js','/atlas-worker-pool.js':'atlas-worker-pool.js','/atlas-workspace.css':'atlas-workspace.css','/atlas-head-test':'atlas-head-test.html','/atlas-head-test.js':'atlas-head-test.js','/atlas-head-composite.js':'atlas-head-composite.js','/head-attachment-research.mjs':'head-attachment-research.mjs','/viewer.js':'viewer.js','/viewer.css':'viewer.css','/video':'video.html','/all-motions':'motion-gallery.html','/body-bridge.js':'body-bridge.js','/motion-transition.js':'motion-transition.js','/prepared-codec.js':'prepared-codec.js','/prepared-store.js':'prepared-store.js','/world-yaw.js':'world-yaw.js','/world-transform.js':'world-transform.js','/packet-tangent-stitch.js':'tools/packet-tangent-stitch.js'}
        try:
            if url=='/api/motion-bundle-download':
                token=parse_qs(urlparse(self.path).query).get('token',[''])[0]
                if not re.fullmatch(r'[0-9a-f]{32}',token):raise ValueError('文件标识无效')
                file=BUNDLE_DIR/(token+'.humanmotion')
                if not file.is_file():return self.json({'error':'文件不存在'},404)
                self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(file.stat().st_size));self.send_header('Content-Disposition','attachment; filename="npc-motion.humanmotion"');self.end_headers()
                try:
                    with file.open('rb') as f:
                        for block in iter(lambda:f.read(1024*1024),b''):self.wfile.write(block)
                    file.unlink(missing_ok=True)
                except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
                return
            if url=='/api/adaptation-health':return self.json({'service':'human-motion-continuity-r07','clips':len(manifest()['clips']),'videos':list(read_video_manifest())})
            if url=='/api/transition-bank':
                file=ROOT/'data/transition-bank.json'
                return self.json(json.loads(file.read_text(encoding='utf8')) if file.exists() else {'schema':'motion-transition-bank/1','entries':[]})
            if url=='/api/adaptation-videos':return self.json({'videos':[{'id':k,'title':v['title'],'description':v['description']} for k,v in read_video_manifest().items()]})
            if url=='/api/motion-gallery':return self.json(read_gallery())
            if url=='/api/atlas-source-info':
                args=parse_qs(urlparse(self.path).query);id=args.get('id',[''])[0]
                if not re.fullmatch(r'[a-z0-9_]+',id):raise ValueError('无效动作编号')
                row=atlas_index()['records'].get(id)
                if not row or row.get('status')!='candidate':raise ValueError('动作不存在')
                base=row.get('baseId',id)
                filename={'CMU':'assets_cmu_catalog.json','Mesh2Motion':'assets_mesh2motion_catalog.json','Quaternius':'assets_catalog.json'}[row['provider']]
                entries=json.loads((ATLAS/filename).read_text(encoding='utf8'))['clips']
                info=next((c for c in entries if c['id']==base),None)
                if info is None:raise ValueError('示范动作来源不存在')
                return self.json({'info':info,'rootMotion':row.get('variant')=='root-motion','frameDomain':row.get('frameDomain',False)})
            if url.startswith('/atlas-source/'):
                relative=url.removeprefix('/atlas-source/')
                if not relative or any(x in relative for x in ('..','\\')):raise ValueError('资源路径无效')
                recovered=(ATLAS/'source-demo-assets').resolve()
                local=(ATLAS/relative).resolve();source=(recovered/relative).resolve()
                if not local.is_relative_to(ATLAS.resolve()) or not source.is_relative_to(recovered):raise ValueError('资源路径无效')
                if relative.startswith('assets/') and local.is_file():f=local
                elif source.is_file():f=source
                else:return self.json({'error':'示范资源不存在'},404)
                mime='text/javascript' if f.suffix in ('.js','.mjs') else mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
                return self.data(f.read_bytes(),mime)
            if url=='/api/atlas-packet-ready':
                args=parse_qs(urlparse(self.path).query);id=args.get('id',[''])[0];items=json.loads(args.get('packets',['[]'])[0])
                if not re.fullmatch(r'[a-z0-9_]+',id) or not isinstance(items,list) or not 1<=len(items)<=200:raise ValueError('动作缓存清单无效')
                token=args.get('bundle',[''])[0]
                if token:
                    data=imported_bundle(token);row=data['records'].get(id)
                    if not row:raise ValueError('动作包中没有该动作')
                    expected=list(range(0,row['frames']-1,32))
                    if len(items)!=len(expected):raise ValueError('动作缓存分段不完整')
                    for item,start in zip(items,expected):
                        if not isinstance(item,list) or len(item)!=2 or item[0]!=start or f'{id}-{start}-{item[1]}' not in data['packets']:raise ValueError('动作包与人物绑定不一致')
                    return self.json({'complete':True,'packets':len(items)})
                source=args.get('sourceBundle',[''])[0]
                row=imported_bundle(source)['records'].get(id) if source else atlas_index()['records'].get(id)
                if not row or row.get('status')!='candidate':raise ValueError('动作不存在')
                expected=list(range(0,row['frames']-1,32))
                if len(items)!=len(expected):raise ValueError('动作缓存分段不完整')
                complete=True
                for item,start in zip(items,expected):
                    if not isinstance(item,list) or len(item)!=2 or item[0]!=start or not isinstance(item[1],str) or not re.fullmatch(r'[0-9a-f]{64}',item[1]):raise ValueError('动作缓存标识无效')
                    key=item[1];path=ATLAS_PACKET_DIR/(id+'-'+str(start)+'-'+key+'.bin');sidecar=path.with_suffix('.json')
                    if not path.is_file() or not sidecar.is_file():complete=False;break
                    info=json.loads(sidecar.read_text(encoding='utf8'))
                    if info.get('id')!=id or info.get('start')!=start or info.get('key')!=key or info.get('size')!=path.stat().st_size:complete=False;break
                return self.json({'complete':complete,'packets':len(items)})
            if url=='/api/atlas-packet':
                args=parse_qs(urlparse(self.path).query);token=args.get('bundle',[''])[0]
                if not token:return self.atlas_packet_file()
                data=imported_bundle(token);id=args.get('id',[''])[0];key=args.get('key',[''])[0]
                try:start=int(args.get('start',[''])[0])
                except ValueError:raise ValueError('动作段编号无效')
                name=f'{id}-{start}-{key}'
                if name not in data['packets']:raise ValueError('动作包中没有匹配的片段')
                with zipfile.ZipFile(data['path']) as z:
                    member='packets/'+name+'.bin';size=z.getinfo(member).file_size
                    self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(size));self.send_header('Cache-Control','no-store');self.end_headers()
                    try:
                        with z.open(member) as stream:
                            for block in iter(lambda:stream.read(1024*1024),b''):self.wfile.write(block)
                    except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
                return
            if url=='/api/atlas-packet-context':return self.json(atlas_packet_context())
            if url=='/api/atlas-catalog':return self.json(atlas_catalog())
            if url=='/api/atlas-thumbnails':return self.json(atlas_thumbnails([x for x in parse_qs(urlparse(self.path).query).get('ids',[''])[0].split(',') if x]))
            if url=='/api/atlas-candidate':
                args=parse_qs(urlparse(self.path).query);id=args.get('id',[''])[0];token=args.get('bundle',[''])[0]
                if token:
                    row=imported_bundle(token)['records'].get(id)
                    if not row:raise ValueError('动作包中没有该动作')
                    return self.json({'id':id,'label':row['label'],'frames':row['frames'],'duration':row['duration'],'frameDomain':False,'provider':row['provider'],'quality':row['quality'],'sha256':row['sha256'],'bundle':token,'boundIdentity':imported_bundle(token)['manifest']['identity']})
                row,_=atlas_candidate(id)
                return self.json({'id':id,'label':row['label'],'frames':row['frames'],'duration':row['duration'],'frameDomain':row.get('frameDomain',False),'provider':row['provider'],'quality':row['quality'],'sha256':row['sha256']})
            if url=='/api/atlas-segment':
                args=parse_qs(urlparse(self.path).query);id=args.get('id',[''])[0];frame=int(args.get('frame',['0'])[0]);token=args.get('bundle',[''])[0]
                if token:
                    data=imported_bundle(token)
                    if id not in data['records']:raise ValueError('动作包中没有该动作')
                    return self.json(portable_bundle.segment(data,id,frame))
                return self.json(atlas_segment(id,frame,args.get('compact',['0'])[0]=='1'))
            if url=='/api/atlas-probe':
                args=parse_qs(urlparse(self.path).query);extra=[int(x) for x in args.get('extra',[''])[0].split(',') if x]
                return self.json(atlas_probe(args.get('id',[''])[0],extra))
            if url=='/atlas-resident-head':
                f=HEAD_ROOT/'src/workspaces/photo-female-001/resident-r03/index.html';html=f.read_bytes()
                old=b'/src/workspaces/photo-female-001/resident-r03/viewer-adaptive.mjs';new=b'/src/workspaces/photo-female-001/resident-r03/viewer-motion.mjs'
                if html.count(old)!=1:raise ValueError('头部入口版本已变化')
                html=html.replace(old,new)+b'<style>header,#status,#loading,#startup-preview{display:none!important}main{width:100%;height:100%}canvas{width:100%;height:100%}</style>'
                return self.data(html,'text/html; charset=utf-8')
            if url=='/src/workspaces/photo-female-001/resident-r03/viewer-motion.mjs':
                return self.data((ROOT/'atlas-head-viewer.mjs').read_bytes(),'text/javascript; charset=utf-8')
            if url.startswith(('/src/','/material/','/cache/')) or url=='/native-other-manifest':return self.proxy(HEAD_SOURCE)
            if url.startswith('/gallery-poster/') and url.endswith('.jpg'):
                name=url.rsplit('/',1)[-1][:-4]
                if not re.fullmatch(r'[a-z][a-z0-9-]*',name) or not any(x['id']==name and x.get('available') for x in read_gallery()['videos']):return self.json({'error':'图片不存在'},404)
                f=ROOT/'review/gallery-posters'/(name+'.jpg')
                if not f.is_file():return self.json({'error':'图片尚未完成'},404)
                return self.data(f.read_bytes(),'image/jpeg')
            if url.startswith('/gallery-video/') and url.endswith('.webm'):
                name=url.rsplit('/',1)[-1][:-5]
                item=next((x for x in read_gallery()['videos'] if x['id']==name and x.get('available')),None)
                if not re.fullmatch(r'[a-z][a-z0-9-]*',name) or not item:return self.json({'error':'视频不存在'},404)
                f=(ROOT/item['file']).resolve()
                if not f.is_relative_to((ROOT/'review').resolve()):return self.json({'error':'视频路径不匹配'},409)
                return self.video(f)
            if url=='/api/adaptation-manifest':return self.json(manifest())
            if url=='/api/prepared':return self.cached_file()
            if url=='/api/prepared-context':return self.json(prepared_context())
            if url=='/moving-turn':
                html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>行走中转弯实录</title><style>body{margin:0;background:#0d1714;color:#e8f0e8;font:16px/1.7 system-ui,"Microsoft YaHei"}main{max-width:1100px;margin:auto;padding:28px}video{width:100%;background:#14231d;border-radius:12px}a{color:#cbe9c3}p{color:#b7cab9}</style><main><a href="/?initial=movingturnsole13arm">← 打开动作预览</a><h1>边走边转 · 同一段连续动捕</h1><p>直接播放当前人物的实时画布录屏，镜头跟随人物。人物持续行走并转向，脚跟和脚尖依据原动捕进行校准。录屏约 20 帧/秒；脚底和身体检查为有限抽样，整体自然度仍需观察。</p><video controls playsinline preload="metadata" src="/moving-turn.webm"></video></main></html>'''
                return self.data(html.encode('utf8'),'text/html; charset=utf-8')
            if url=='/moving-turn.webm':return self.video(ROOT/'review/movingturnsole13arm-seekable.webm')
            if url=='/runtime-demo':
                html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>连续动作实录</title><style>body{margin:0;background:#0d1714;color:#e8f0e8;font:16px/1.7 system-ui,"Microsoft YaHei"}main{max-width:1100px;margin:auto;padding:28px}video{width:100%;background:#14231d;border-radius:12px}a{color:#cbe9c3}p{color:#b7cab9}</style><main><a href="/?initial=gaitshortsole3cycle">← 打开连续行走预览</a><h1>连续行走 → 转身 → 继续走</h1><p>后台浏览器直接录制的人物画布，展示实际播放。头脸、完整接触和动作自然度仍待验收。</p><video controls playsinline preload="metadata" src="/runtime-demo.webm"></video></main></html>'''
                return self.data(html.encode('utf8'),'text/html; charset=utf-8')
            if url=='/runtime-demo.webm':return self.video(ROOT/'review/continuity-live-vp9-seekable.webm')
            if url=='/body-runtime-direct':
                style=b'<style>header,main>aside,.stamp,.views{display:none!important}main{display:block!important;padding:0!important;height:100vh!important}.stage{height:100vh!important;border-radius:0!important}body{overflow:hidden}#precision{display:none!important}</style>'
                html=DYNAMIC_BODY.read_bytes().replace(b'<meta charset="utf-8">',b'<meta charset="utf-8"><base href="/">',1)
                if parse_qs(urlparse(self.path).query).get('atlasPool',['0'])[0]=='1':
                    anchor=b'delete window.__TORSO_STUDY_WORKER__;delete window.__TORSO_STUDY_MANIFEST__;'
                    addition=b'window.__createAtlasMotionWorker=()=>{const w=new Worker(url);w.postMessage({type:"init",manifest,base:location.href});return w;};'
                    if html.count(anchor)!=1:raise ValueError('动作计算接口版本已变化')
                    html=html.replace(anchor,addition+anchor,1)
                if parse_qs(urlparse(self.path).query).get('atlasPool',['0'])[0]=='1':
                    anchor=b"(()=>{'use strict';\r\nconst manifest=window.__TORSO_STUDY_MANIFEST__"
                    if html.count(anchor)==1:html=html.replace(anchor,(ROOT/'atlas-worker-optimization.js').read_bytes()+anchor,1)
                if parse_qs(urlparse(self.path).query).get('headResearch',['0'])[0]=='1':
                    anchor=b"probeFrame(channel='depth'){"
                    addition=b"drawAtlasDepth(){probing=true;const previous=mode,previousTile=tile;mode=3;tile=1;draw();mode=previous;tile=previousTile;probing=false;},"
                    if html.count(anchor)!=1:raise ValueError('身体深度接口版本已变化')
                    html=html.replace(anchor,addition+anchor,1)
                    old=b"if(unresolved){colour=vec4(1.,0.,.8,1.);return;}if(mode==3){"
                    new=b"if(unresolved){colour=mode==3?vec4(1.,0.,1.,1.):vec4(1.,0.,.8,1.);return;}if(mode==3){"
                    if html.count(old)!=1:raise ValueError('身体未决遮挡接口版本已变化')
                    html=html.replace(old,new,1)
                return self.data(html+style,'text/html; charset=utf-8')
            if url=='/api/adaptation-clip':
                id=parse_qs(urlparse(self.path).query).get('id',[''])[0];rows=manifest()['clips'];row=next((x for x in rows if x['id']==id),None)
                if not re.fullmatch(r'[a-z][a-z0-9]*',id) or row is None:return self.json({'error':'动作不存在'},404)
                base=PREVIOUS if row.get('storage')=='previous' else ROOT;path=(base/row['file']).resolve()
                if not path.is_relative_to((base/'data').resolve()):return self.json({'error':'动作路径不匹配'},409)
                blob=path.read_bytes()
                if hashlib.sha256(blob).hexdigest()!=row['sha256']:return self.json({'error':'动作来源校验失败'},409)
                return self.data(blob,'application/json; charset=utf-8')
            if url.startswith('/video/') and url.endswith('.webm'):
                name=url.rsplit('/',1)[-1][:-5];item=read_video_manifest().get(name)
                if not re.fullmatch(r'[a-z][a-z0-9-]*',name) or item is None:return self.json({'error':'视频不存在'},404)
                f=(ROOT/item['file']).resolve()
                if not f.is_relative_to((ROOT/'review').resolve()):return self.json({'error':'视频路径不匹配'},409)
                return self.video(f)
            if url in files:
                f=ROOT/files[url];mime='text/javascript' if f.suffix=='.js' else mimetypes.guess_type(f.name)[0] or 'application/octet-stream';blob=f.read_bytes()
                return self.data(blob,mime+'; charset=utf-8')
            return self.proxy()
        except (OSError,ValueError,KeyError) as exc:return self.json({'error':str(exc)},409)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=9018);args=parser.parse_args();server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler);print(f'Human Motion Continuity R07 http://127.0.0.1:{args.port}/',flush=True)
    try:server.serve_forever()
    finally:server.server_close()
