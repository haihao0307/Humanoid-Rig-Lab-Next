"""Deterministic standalone HTML: gzip-compressed executable source, native decoder.
No external JS, textures, mesh blobs, CDN, server or first-use precache.
"""
from pathlib import Path
import json,hashlib,gzip,base64,re
P=Path(__file__).resolve().parent
MODULES=[('SAMPLING','sampling.js'),('OPTICS','fiber-optics.js'),('STRUCTURE','structure.js'),('CORE','core.js'),('COTTON','cotton-surface.js'),('NATURAL','natural-yarn.js'),('BUDGET','runtime-budget.js'),('STITCHES','stitches.js'),('DYNAMICS','dynamics.js'),('APP','app.js')]
def assemble():
    s=(P/'template.html').read_text()
    for key,file in MODULES:
        marker='/*'+key+'*/'
        assert s.count(marker)==1,(key,'missing or duplicated marker')
        s=s.replace(marker,(P/file).read_text())
    return s

def build():
    plain=assemble();blocks=re.findall(r'<script>([\s\S]*?)</script>',plain)
    assert len(blocks)==3,'Unexpected script structure'
    source='\n;\n'.join(blocks).encode()
    compressed=gzip.compress(source,compresslevel=9,mtime=0)
    assert gzip.decompress(compressed)==source
    payload=base64.b64encode(compressed).decode()
    shell=re.sub(r'<script>[\s\S]*?</script>','',plain)
    boot='''<script>(async()=>{const boot=document.currentScript;try{if(!('DecompressionStream'in window))throw Error('此精简版需要支持原生 gzip 解压的浏览器');const bytes=Uint8Array.from(atob('''+json.dumps(payload)+'''),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));const source=await new Response(stream).text();const node=document.createElement('script');node.textContent=source;document.body.appendChild(node);node.remove();boot?.remove();}catch(e){const box=document.getElementById('error');box.hidden=false;box.textContent='运行时装配失败：'+e.message;}})();</script>'''
    result=shell.replace('</body>',boot+'</body>')
    data=result.encode();(P/'index.html').write_bytes(data)
    manifest={'version':'R09.1','baseCommit':'57e8c6c2ce61a1226da302ba3bb239fc5274ae61','entry':'denim-workshop/r09/index.html','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'unpackedHtmlBytes':len(plain.encode()),'runtimeSourceBytes':len(source),'runtimeSourceSha256':hashlib.sha256(source).hexdigest(),'packedRuntimeBytes':len(compressed),'packing':'gzip, native DecompressionStream, inline base64, no network','runtimeAssets':0,'sourceHashes':{file:hashlib.sha256((P/file).read_bytes()).hexdigest() for _,file in MODULES},'qualityDefault':'R08 equivalent sampling, Float32 points, no visible-point decimation','efficientMode':'explicit lower internal pixel resolution, same 4x offscreen MSAA where available','publicDeliveryVerified':False,'actualFileNavigationVerified':False,'physicalClothSolver':'475-node XPBD proxy; not full garment, no self collision','realDeviceFPSVerified':False}
    (P/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2));return manifest
if __name__=='__main__':print(json.dumps(build()))
