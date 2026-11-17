"""Local research preview of the unified gray person; leaves engine/workbench untouched."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs
from urllib.request import urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path
import argparse, gzip, importlib.util, json, mimetypes, re, shutil, sys, threading
WORK=Path(__file__).resolve().parents[2]; HUMAN=WORK.parent; HERE=Path(__file__).resolve().parent
RUNTIME=WORK/'.runtime'; REVIEW=WORK/'review'; RESEARCH=WORK/'research'
PERSON=HUMAN/'Photo-Body-Skin-R01-20261112'; BODY=HUMAN/'Human-Body-Reconstruction-R01-20261023'; LEGACY=BODY/'qa/legacy-comparison'; LEGACY_PAGE=RUNTIME/'gray-late-phases-r2-research-20261115.html'
REFERENCE_ASSETS=RUNTIME/'gray-reference-assets';REFERENCE_MANIFEST=RUNTIME/'gray-reference-assets-manifest-20261115.json';REFERENCE_HASHES=set(json.loads(REFERENCE_MANIFEST.read_text(encoding='utf-8'))['assets']) if REFERENCE_MANIFEST.is_file() else set()
ASSETS={'/asset/gray-mesh':PERSON/'default-head/data/unified-gray-r06.f32','/asset/gray-map':RUNTIME/'gray-source-correspondence-r2-20261115.bin','/asset/gray-patch':RUNTIME/'gray-display-function-corner-patch-20261115.bin','/asset/head':RUNTIME/'gray-head-precontour-binding-20261115.bin','/asset/body':RUNTIME/'gray-body-control-binding-20261115.json.gz','/asset/skeleton':RUNTIME/'gray-action-skeleton-20261115.json','/asset/operator':RUNTIME/'gray-display-neck-corrective-operator-20261115.json.gz','/asset/config':RUNTIME/'gray-action-controls-config-20261115.json','/asset/identity':REVIEW/'full-person-candidate-identity-20261114.json','/asset/poster':WORK/'review/gray-independent-no-skin-fields-m2m_attack_ground_pound-32-20261115.png'}
MODULES={name:RESEARCH/name for name in ['gray-action-controls.mjs','gray-gpu-display.mjs','gray-only-lid-chart-gate.mjs','gray-fast-lid-apply.mjs','gray-only-bounds-gate.mjs','gray-only-material-propagation-gate.mjs','gray-gpu-source-refinement.mjs','gray-gpu-subdivision.mjs','gray-gpu-normals.mjs','gray-gpu-fairing.mjs','gray-action-skeleton.mjs','gray-cpu-controls.mjs','gray-display-neck-corrector.mjs','full-rig-candidate-loader.mjs','full-rig-metadata-digest.mjs']}
ATLAS_MODULE=None;ATLAS_MODULE_LOCK=threading.Lock()
def atlas_source():
 global ATLAS_MODULE
 with ATLAS_MODULE_LOCK:
  if ATLAS_MODULE is None:
   sys.path.insert(0,str(WORK));spec=importlib.util.spec_from_file_location('gray_research_atlas_source',WORK/'server.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);ATLAS_MODULE=module
  return ATLAS_MODULE
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send_data(self,body,mime='application/json; charset=utf-8',status=200,encoding=None):
  self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)))
  if encoding:self.send_header('Content-Encoding',encoding)
  self.end_headers();self.wfile.write(body)
 def send_file(self,p,mime=None,legacy=False,immutable=False):
  if not p.is_file():return self.send_data(b'{"error":"resource unavailable"}',status=404)
  size=p.stat().st_size
  with p.open('rb') as f:
   first=f.read(65536) if legacy else b''
   if legacy:
    old=b'file:///G:/Three.js/Human/Human-Body-Reconstruction-R01-20261023/qa/legacy-comparison/'
    new=b'/legacy-assets/'
    if first.count(old)!=1:raise ValueError('legacy preview source changed')
    first=first.replace(old,new,1);size+=len(new)-len(old)
    inject=b'<script>WebGL2RenderingContext.prototype.drawElements=function(){};</script>'
    if first.count(b'<head>')!=1:raise ValueError('legacy head changed')
    first=first.replace(b'<head>',b'<head>'+inject,1);size+=len(inject)
   self.send_response(200);self.send_header('Content-Type',mime or mimetypes.guess_type(p.name)[0] or 'application/octet-stream');self.send_header('Content-Length',str(size));self.send_header('Cache-Control','private, max-age=31536000, immutable' if immutable else 'no-store');self.end_headers()
   if first:self.wfile.write(first)
   shutil.copyfileobj(f,self.wfile,1024*1024)
 def do_GET(self):
  parsed=urlsplit(self.path);path=parsed.path
  try:
   if path=='/':return self.send_file(HERE/'index.html','text/html; charset=utf-8')
   if path in ['/app.mjs','/style.css']:return self.send_file(HERE/path[1:],'text/javascript; charset=utf-8' if path.endswith('.mjs') else 'text/css; charset=utf-8')
   if path=='/legacy':return self.send_file(LEGACY_PAGE,'text/html; charset=utf-8',True)
   if path.startswith('/offline-asset/'):
    identity=path.removeprefix('/offline-asset/')
    if not re.fullmatch(r'[a-f0-9]{64}',identity) or identity not in REFERENCE_HASHES:raise ValueError('invalid reference asset')
    return self.send_file(REFERENCE_ASSETS/(identity+'.bin'),'application/octet-stream',immutable=True)
   if path.startswith('/legacy-assets/'):
    name=path.removeprefix('/legacy-assets/');p=(LEGACY/name).resolve()
    if not p.is_relative_to(LEGACY.resolve()):raise ValueError('invalid resource')
    return self.send_file(p)
   if path.startswith('/module/'):
    name=path.removeprefix('/module/')
    if name not in MODULES:raise ValueError('invalid module')
    return self.send_file(MODULES[name],'text/javascript; charset=utf-8')
   if path in ASSETS:
    p=ASSETS[path]
    if p.suffix=='.gz':return self.send_data(gzip.decompress(p.read_bytes()),'application/octet-stream')
    return self.send_file(p)
   if path=='/api/research-config':
    load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
    state=load(BODY/'qa/fidelity-r21/offline/case-baseline.json')['sourceState'];state['owners']['headRig']='body'
    data={'state':state,'headMeta':load(REVIEW/'gray-head-precontour-binding-20261115.json'),'bodyMeta':load(REVIEW/'gray-body-control-binding-build-20261115.json'),'rigMeta':load(REVIEW/'gray-action-skeleton-build-20261115.json'),'operatorMeta':load(REVIEW/'gray-display-neck-corrective-build-20261115.json'),'configMeta':load(REVIEW/'gray-action-controls-config-build-20261115.json'),'meshMeta':load(REVIEW/'gray-function-corner-resolution-20261115.json')}
    return self.send_data(json.dumps(data,ensure_ascii=False).encode())
   if path in ('/api/research-rig','/api/research-rig-data'):
    name=parse_qs(parsed.query).get('id',[''])[0]
    if not re.fullmatch(r'[a-z0-9_]+',name):raise ValueError('invalid action')
    return self.send_file(RUNTIME/'full-rig-candidates-v5'/(name+('.json' if path.endswith('rig') else '.bin')),'application/json; charset=utf-8' if path.endswith('rig') else 'application/octet-stream')
   if path=='/api/research-body-track':
    name=parse_qs(parsed.query).get('id',[''])[0]
    if not re.fullmatch(r'[a-z0-9_]+',name):raise ValueError('invalid action')
    row,data=atlas_source().atlas_candidate(name);frames=data['frames']
    if len(frames)!=row['frames'] or data.get('id')!=name:raise ValueError('action source does not match its catalog')
    packet={'schema':'gray-body-motion-track/1','id':name,'candidateSHA256':row['sha256'],'frames':len(frames),'times':[f['time'] for f in frames],'poses':[f['pose'] for f in frames]}
    raw=json.dumps(packet,ensure_ascii=True,separators=(',',':'),allow_nan=False).encode('utf-8')
    return self.send_data(gzip.compress(raw,compresslevel=3),encoding='gzip')
   if path=='/source-demo.js' or path.startswith('/atlas-source/') or path in ('/api/atlas-catalog','/api/atlas-thumbnails','/api/atlas-candidate','/api/atlas-segment','/api/atlas-source-info'):
    with urlopen('http://127.0.0.1:9018'+self.path,timeout=90) as response:
     self.send_response(response.status);self.send_header('Content-Type',response.headers.get('Content-Type','application/octet-stream'));length=response.headers.get('Content-Length')
     if length:self.send_header('Content-Length',length)
     self.send_header('Cache-Control','no-store');self.end_headers();shutil.copyfileobj(response,self.wfile,1024*1024)
    return
   return self.send_data(b'{"error":"not found"}',status=404)
  except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
  except (OSError,ValueError,HTTPError,URLError) as e:
   try:self.send_data(json.dumps({'error':str(e)},ensure_ascii=False).encode(),status=503)
   except (BrokenPipeError,ConnectionResetError):pass
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=19057);p.add_argument('--without-skin-graph-research',action='store_true');p.add_argument('--asset-audit-research',action='store_true');p.add_argument('--externalized-reference-research',action='store_true');args=p.parse_args()
 if args.externalized_reference_research:LEGACY_PAGE=RUNTIME/'gray-externalized-reference-research-20261115.html'
 elif args.asset_audit_research:LEGACY_PAGE=RUNTIME/'gray-asset-audit-research-20261115.html'
 elif args.without_skin_graph_research:LEGACY_PAGE=RUNTIME/'gray-without-skin-graph-research-20261115.html'
 server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler);print(f'http://127.0.0.1:{args.port}/',flush=True)
 try:server.serve_forever()
 finally:server.server_close()
