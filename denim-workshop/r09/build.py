"""Build readable canonical sources into a standalone gzip-packed HTML.
No CDN, fetch, eval or external decoder; uses native DecompressionStream.
Source JS stays readable in GitHub. gzip mtime=0 makes the payload deterministic.
"""
from pathlib import Path
import json,hashlib,re,gzip,base64
p=Path(__file__).resolve().parent
s=(p/'template.html').read_text()
for k,f in [('BUDGET','runtime-budget.js'),('COMPACT','compact-fibers.js'),('STITCH','lockstitch.js'),('COTTON','cotton-surface.js'),('SAMPLING','sampling.js'),('OPTICS','fiber-optics.js'),('STRUCTURE','structure.js'),('CORE','core.js'),('NATURAL','natural-yarn.js'),('APP','app.js')]:
 assert s.count('/*'+k+'*/')==1
 s=s.replace('/*'+k+'*/',(p/f).read_text())
source_size=len(s.encode());code='\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S));payload=gzip.compress(code.encode(),compresslevel=9,mtime=0)
loader="""<script>(async()=>{try{if(!globalThis.DecompressionStream)throw Error('此浏览器不支持内置解压，请使用较新的 Chrome、Edge、Safari 或 Firefox。');let bytes=Uint8Array.from(atob('PAYLOAD'),c=>c.charCodeAt(0));const code=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();bytes=null;const s=document.createElement('script');s.textContent=code;document.body.appendChild(s);s.remove();}catch(e){const p=document.getElementById('error');p.hidden=false;p.textContent=e.message;console.error(e);}})();</script>""".replace('PAYLOAD',base64.b64encode(payload).decode())
s=re.sub(r'<script>.*?</script>','',s,flags=re.S).replace('</body>',loader+'</body>')
(p/'index.html').write_text(s)
m={'version':'R09.0','parentBuild':'57e8c6c2ce61a1226da302ba3bb239fc5274ae61','entry':'denim-workshop/r09/index.html','bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'readableSourceHtmlBytes':source_size,'engineSourceBytes':len(code.encode()),'engineGzipBytes':len(payload),'runtimeAssets':0,'codec':'gzip + native DecompressionStream, inline script insertion, no eval/CDN','preserved':'R08 cotton surface, 39096 default representative fiber curves, metric weave/damage identities, linear HDR and Gaussian coverage','changes':'compact 24-byte single point records, conservative visibility indices, cached null uniforms/audits, 15Hz bounded moving shadows, controllable animation cap, two-thread geometric stitches','qualityDefault':'balanced; fewer supersamples when yarns span several pixels','referenceMode':'R08 pixel sampling, same dense fibers with compact storage and visibility culling','physics':'analytic shader deformation, NOT a cloth solver','realDeviceFPS':'unverified','oldVersionsChanged':False}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps(m,ensure_ascii=False))
