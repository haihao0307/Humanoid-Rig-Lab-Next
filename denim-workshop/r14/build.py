"""Deterministic standalone HTML: gzip-compressed executable source, native decoder.
No external JS, textures, mesh blobs, CDN, server or first-use precache.
"""
from pathlib import Path
import json,hashlib,gzip,base64,re
P=Path(__file__).resolve().parent
MODULES=[('SAMPLING','sampling.js'),('OPTICS','fiber-optics.js'),('STRUCTURE','structure.js'),('CORE','core.js'),('COTTON','cotton-surface.js'),('NATURAL','natural-yarn.js'),('BUDGET','runtime-budget.js'),('STITCHES','stitches.js'),('TOPOLOGY','cloth-topology.js'),('FAILURE','failure-physics.js'),('BENDING','bend-cloth.js'),('DYNAMICS','dynamics.js'),('LOD','distance-lod.js'),('NOISE','noise-kernel.js'),('APP','app.js')]
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
    compressed=bytearray(gzip.compress(source,compresslevel=9,mtime=0));compressed[9]=255;compressed=bytes(compressed)
    assert gzip.decompress(compressed)==source
    payload=base64.b64encode(compressed).decode()
    shell=re.sub(r'<script>[\s\S]*?</script>','',plain)
    boot='''<script>(async()=>{const boot=document.currentScript;try{if(!('DecompressionStream'in window))throw Error('此精简版需要支持原生 gzip 解压的浏览器');const bytes=Uint8Array.from(atob('''+json.dumps(payload)+'''),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));const source=await new Response(stream).text();const node=document.createElement('script');node.textContent=source;document.body.appendChild(node);node.remove();boot?.remove();}catch(e){const box=document.getElementById('error');box.hidden=false;box.textContent='运行时装配失败：'+e.message;}})();</script>'''
    result=shell.replace('</body>',boot+'</body>')
    result=result.replace('</body>','<!--\n'+(P/'LICENSE').read_text()+'\n'+(P/'THIRD_PARTY_NOTICES.md').read_text()+'\n--></body>');data=result.encode();(P/'index.html').write_bytes(data)
    manifest={'version':'R14.0','baseCommit':'400e0d217c1b73015f2e052a0947556bb285c333','entry':'denim-workshop/r14/index.html','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'unpackedHtmlBytes':len(plain.encode()),'runtimeSourceBytes':len(source),'runtimeSourceSha256':hashlib.sha256(source).hexdigest(),'packedRuntimeBytes':len(compressed),'packing':'gzip, native DecompressionStream, inline base64, no network','runtimeAssets':0,'sourceHashes':{file:hashlib.sha256((P/file).read_bytes()).hexdigest() for _,file in MODULES},'qualityDefault':'R08 near sampling preserved; local-footprint filtered middle/far; Float32 micro layer generated on demand','efficientMode':'explicit lower internal pixel resolution, same 4x offscreen MSAA where available','publicDeliveryVerified':False,'actualFileNavigationVerified':False,'physicalClothSolver':'R14 continuous table-supported sheet with coupled curvature bending and a thickness-scaled radius barrier, surface contact and finite edge grip; old material mode preserved, new tearing paused; not full CCD or measured cloth','realDeviceFPSVerified':False}
    (P/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2));return manifest
if __name__=='__main__':print(json.dumps(build()))
