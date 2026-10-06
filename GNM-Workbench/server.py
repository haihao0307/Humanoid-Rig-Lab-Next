"""Local-only GNM runtime service. The legacy R008 generator is never imported."""
from pathlib import Path
import argparse,threading,json,time,os,gzip,traceback
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent
STATE={'percent':2,'stage':'启动 GNM 服务','ready':False,'error':None,'updated':time.time()}
ENGINE=None;META=None;LOCK=threading.Lock()
def progress(percent,stage):STATE.update(percent=percent,stage=stage,updated=time.time())
def load():
    global ENGINE,META
    try:
        progress(5,'导入 GNM 官方 NumPy 后端')
        from gnm_bridge import GNMBridge
        ENGINE=GNMBridge(progress)
        META=gzip.compress(json.dumps(ENGINE.meta,ensure_ascii=False,separators=(',',':')).encode(),compresslevel=3)
        STATE.update(ready=True,percent=100,stage='GNM 模型准备完成',updated=time.time())
    except Exception as error:
        STATE.update(error=str(error),stage='加载失败',updated=time.time());traceback.print_exc()

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,data,status=200,content_type='application/json',compressed=False):
        if isinstance(data,(dict,list)):data=json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()
        if isinstance(data,str):data=data.encode()
        self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
        if compressed:self.send_header('Content-Encoding','gzip')
        self.end_headers();self.wfile.write(data)
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/health':return self.send({'subject':'gnm-head-r29','pid':os.getpid(),'ready':STATE['ready']})
        if path=='/api/status':return self.send(STATE)
        if path.startswith('/api/') and not STATE['ready']:return self.send({'error':STATE['error'] or 'GNM 尚在加载'},503)
        if path=='/api/meta':return self.send(META,compressed=True)
        if path=='/api/session':
            file=ROOT/'gnm-session.json'
            return self.send(json.loads(file.read_text(encoding='utf8')) if file.exists() else ENGINE.empty_recipe())
        if path=='/favicon.ico':return self.send(b'',204,'image/x-icon')
        public={'/':ROOT/'index.html','/index.html':ROOT/'index.html','/app.mjs':ROOT/'app.mjs','/GnmMeasurements.mjs':ROOT/'GnmMeasurements.mjs','/source-provenance.json':ROOT/'source-provenance.json','/GNM-Workbench/app.mjs':ROOT/'app.mjs','/GNM-Workbench/GnmMeasurements.mjs':ROOT/'GnmMeasurements.mjs'}
        for name in ['three.module.js','three.core.js','OrbitControls.js']:public['/vendor/'+name]=REPO/'New-Human-Production/R008/vendor'/name
        for name in ['FaceMeasurements.mjs','FaceLandmarks.mjs']:public['/shared/'+name]=REPO/'New-Human-Production/R008'/name
        if path not in public or not public[path].is_file():return self.send({'error':'Not in GNM runtime'},404)
        file=public[path];content_type='text/html;charset=utf-8' if file.suffix=='.html' else 'application/json' if file.suffix=='.json' else 'text/javascript;charset=utf-8'
        return self.send(file.read_bytes(),content_type=content_type)
    def do_POST(self):
        path=urlparse(self.path).path
        origin=self.headers.get('Origin')
        if origin and origin not in [f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}']:return self.send({'error':'Origin mismatch'},403)
        if not STATE['ready']:return self.send({'error':'GNM 尚在加载'},503)
        if path not in ['/api/mesh','/api/save']:return self.send({'error':'Unknown action'},404)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=65536:raise ValueError('请求尺寸无效')
            data=json.loads(self.rfile.read(size))
            with LOCK:result=ENGINE.evaluate(data)
            if path=='/api/save':
                # Persist only coefficients, targets and source identity.
                saved={key:data[key] for key in ['schema','modelSHA256','identity','expression','rotations','translation','semantic']}
                file=ROOT/'gnm-session.json';temp=file.with_suffix('.json.tmp');temp.write_text(json.dumps(saved,ensure_ascii=False,indent=2)+'\n',encoding='utf8');temp.replace(file)
                return self.send({'saved':True,'storedVertexArrays':0})
            return self.send(result)
        except (ValueError,TypeError,KeyError,json.JSONDecodeError) as error:return self.send({'error':str(error)},400)
        except Exception as error:traceback.print_exc();return self.send({'error':str(error)},500)
def main():
    args=argparse.ArgumentParser();args.add_argument('--port',type=int,default=8880);port=args.parse_args().port
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler);threading.Thread(target=load,daemon=True).start()
    print(f'GNM workbench http://127.0.0.1:{port}/ pid={os.getpid()}',flush=True);server.serve_forever()
if __name__=='__main__':main()
