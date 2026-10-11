"""Reproduce the interrupted R06 gate. Diagnostic output is never a release."""
from pathlib import Path
import argparse,json,hashlib,struct
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('root');a=p.parse_args();r=Path(a.root).resolve();out=r/'recovery-probe';out.mkdir(exist_ok=True)
s=(r/'standalone.html').read_text()
needle='function apply(){'
assert s.count(needle)==1
s=s.replace(needle,needle+"\n globalThis.__hatRecovery=()=>({state:{...state},source:Array.from(asset.mesh.position),head:person?Array.from(person.geometry.attributes.position.array):[],profile:headProfiles.get(state.head),sourceProfile:asset.fitSource,sourceMeta:asset.meta.id,sourceOrigin:asset.meta.origin});\n",1)
(r/'diagnostic-only.html').write_text(s)
expected=json.loads((r/'qa/numeric/report.json').read_text())['records'][0]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':1000});page.goto((r/'diagnostic-only.html').as_uri());page.wait_for_function('window.hatLab&&hatLab.ready()',timeout=120000)
 for stage,cmd in [('boot',None),('select','hatLab.select("cable")'),('set','hatLab.set({head:0})')]:
  if cmd:page.evaluate(cmd)
  d=page.evaluate('({snapshot:__hatRecovery(),recipe:hatLab.recipe(),hash:hatLab.geometryHash(),headHash:hatLab.headGeometryHash(),geometry:hatLab.debugGeometry()})')
  (out/(stage+'.json')).write_text(json.dumps(d))
  raw=struct.pack('<'+'f'*len(d['geometry']['position']),*d['geometry']['position']);ref=(r/'qa/geometry-dump/native-default--cable--position.bin').read_bytes();aa=struct.unpack('<'+'f'*(len(raw)//4),raw);bb=struct.unpack('<'+'f'*(len(ref)//4),ref);dif=[(i,x,y) for i,(x,y) in enumerate(zip(aa,bb)) if x!=y]
  print(json.dumps({'stage':stage,'browser':d['hash'],'expected':expected['outputHash'],'head':d['headHash'],'expectedHead':expected['headHash'],'state':d['snapshot']['state'],'profileBounds':{k:d['snapshot']['profile'][k] for k in ['ymin','ymax','rows','angles','step']},'different':len(dif),'maxErrorM':max((abs(x-y) for i,x,y in dif),default=0),'firstDifferences':dif[:12]},ensure_ascii=False),flush=True)
 page.screenshot(path=str(out/'actual-browser.png'));b.close()
