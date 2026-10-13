"""Assemble the new surface layer around the exact S0 reference carrier.
No original module, original page, control vertex, UV or reference texture is rewritten.
Only the new output page gets a renderer-access hook, pre-render hook, and lazy reference normals.
"""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,re,urllib.request,time
R=Path(__file__).resolve().parent
BASE='122123275eae1402d75c3bb88c819bc7a0e1f8a7'
S0_PAGE='9a927671a4062d0cebe05c9c6c7d52bda5656ef905fe70edc62bb8131da440d8'
EB1='beb3dda0a28f732e1e387dd68cc0d90f27ce8b7b'
EB1_HASH='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572'
P=argparse.ArgumentParser();P.add_argument('--source',default='LOCAL');A=P.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
page=(R.parent/'source-study-s0/index.html').read_text();assert sha(page.encode())==S0_PAGE,'S0 changed: stop rather than fall back'
# Remove only the additive S0 observer, preserving its underlying frozen R09 carrier.
B=R.parent/'source-study-s0';audit=json.loads((B/'AUDIT.json').read_text())
addon='<style>'+(B/'study.css').read_text()+'</style><script>globalThis.HAT_STUDY_AUDIT='+json.dumps(audit,ensure_ascii=False,separators=(',',':'))+';'+(B/'study.js').read_text().replace('</script','<\\/script')+'</script>'
assert page.count(addon)==1;page=page.replace(addon,'')
assert sha(page.encode())==audit['referencePageSHA256']
payload=re.search(r'<div[^>]*id="payload"[^>]*>(.*?)</div>',page,re.S)[1]
D=json.loads(gzip.decompress(base64.b64decode(payload)))
script=next(s for s in re.findall(r'<script\b[^>]*>(.*?)</script>',page,re.S) if 'Lossless transport' in s)
packed=re.search(r"atob\('([^']+)'",script)[1];original=gzip.decompress(base64.b64decode(packed)).decode();code=original
patches=[('debugParts:()=>({asset,hat,person,scene,camera,controls})','debugParts:()=>({asset,hat,person,scene,camera,controls,renderer})'),(' renderer.render(scene,camera);',' globalThis.__hatSurfaceBeforeRender?.();renderer.render(scene,camera);'),('function queueDetail(a){','function queueDetail(a){\n if(globalThis.HAT_SURFACE_OWNED!==false){stopDetail();a.detailState=a.maps.normal?\'ready\':\'surface-independent\';return;}')]
for old,new in patches:
 assert code.count(old)==1,old
 code=code.replace(old,new)
raw=code.encode();p=gzip.compress(raw,compresslevel=9,mtime=0)
newscript=script.replace(packed,base64.b64encode(p).decode()).replace(sha(original.encode()),sha(raw))
newscript=re.sub(r'runtimePackedBytes:\d+,runtimeRawBytes:\d+',f'runtimePackedBytes:{len(p)},runtimeRawBytes:{len(raw)}',newscript)
assert newscript!=script;page=page.replace(script,newscript)
# Obtain the authoritative EB1 core, verify its digest, keep its notices and provenance.
url=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{EB1}/lighting/eb1/'
for name in ['eb1.js','THIRD_PARTY_NOTICES.md','USER_RECIPE_20261013.json']:
 out=R/'vendor'/name;out.parent.mkdir(exist_ok=True)
 for attempt in range(3):
  try:
   data=urllib.request.urlopen(url+name,timeout=60).read();break
  except Exception:
   if attempt==2:raise
   time.sleep(2)
 if name=='eb1.js':assert sha(data)==EB1_HASH
 out.write_bytes(data)
style='''
.right>:not(#surface-panel){display:none!important}#compare{display:none!important}
#surface-panel{font:13px/1.6 system-ui;color:#263830}#surface-panel h1{font-size:24px;margin:3px 0 12px}#surface-panel h2{font-size:17px;margin:14px 0 7px}
.surface-kicker{letter-spacing:1.5px;font-size:10px;color:#5b7569}.surface-warning{padding:8px 10px;background:#e4eade;border-left:3px solid #69856e}
#surface-panel label{display:block;margin:12px 0 5px}#surface-panel select{width:100%;padding:8px;margin-top:5px;border:1px solid #aab7ad;border-radius:5px;background:#f7f8f2;color:#294139}
#surface-panel input[type=range]{display:block;width:100%;accent-color:#59786a}#surface-panel output{float:right;font-variant-numeric:tabular-nums;color:#556b62}
#surface-panel input[type=number]{width:100%;padding:7px;border:1px solid #b5c0b4;background:#f6f7f2}#surface-panel input[type=color]{float:right;width:65px;height:26px;padding:0;border:1px solid #b8c2b8}
.surface-buttons{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:10px}#surface-panel button{border:1px solid #adbcae;border-radius:4px;background:#f2f6ec;color:#2d473c;padding:6px 4px;cursor:pointer}
#surface-state{padding:8px;background:#edeedf;border-radius:5px;min-height:55px}.surface-small,#surface-note{font-size:11px;color:#5f6d61}#surface-panel details{margin:14px 0;border-top:1px solid #bbc5b9;padding-top:9px}#ps-json{width:100%;height:160px;font:11px monospace}
#eb1-panel{top:auto!important;bottom:12px!important;right:12px!important}#surface-panel [hidden]{display:none!important}
@media(max-width:800px){#surface-panel{font-size:14px}#surface-panel select{min-height:40px}#eb1-panel{max-width:250px!important}}'''
meta={'version':'HAT-SURFACE-S1','sourceSha':A.source,'baseSha':BASE,'sourceStudyBuild':'c4400b817d467b062ab003ac1b5277eedb25aad7','eb1Commit':EB1,'eb1SHA256':EB1_HASH,'surfaceMode':'analytic-no-source-pixels','filmReady':False,'equivalentToSource':False}
add='<style>'+style+'</style><script>globalThis.HAT_SURFACE_OWNED=true;globalThis.HAT_SURFACE_BUILD='+json.dumps(meta,separators=(',',':'))+';'+(R/'vendor/eb1.js').read_text()+'</script><script>'+(R/'surface.js').read_text().replace('</script','<\\/script')+'</script>'
page=page.replace('</body>',add+'</body>');(R/'index.html').write_text(page)
assert re.search(r'<div[^>]*id="payload"[^>]*>(.*?)</div>',page,re.S)[1]==payload
manifest={**meta,'htmlSHA256':sha(page.encode()),'entryBytes':len(page.encode()),'basePayloadSHA256':sha(payload.encode()),'all11ControlUVColorPayloadUnchanged':True,'runtimePatches':[{'before':a,'after':b} for a,b in patches],'originalRuntimeSHA256':sha(original.encode()),'patchedRuntimeSHA256':sha(raw),'proceduralSourceSHA256':sha((R/'surface.js').read_bytes()),'publicVerified':False,'referenceNormals':'lazy, only on explicit reference mode; original bytes and URLs retained','hats':[{'id':h['id'],'author':h['author'],'licence':h['licence'],'controls':len(h['mother']['controls']),'motherSHA256':sha(json.dumps(h['mother'],sort_keys=True,separators=(',',':')).encode())} for h in D['hats']]}
(R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'source':A.source,'bytes':manifest['entryBytes'],'surfaceSHA':manifest['proceduralSourceSHA256'],'basePayloadUnchanged':True,'publicVerified':False}),flush=True)
