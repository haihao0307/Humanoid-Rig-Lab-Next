"""B1 diagnostic copies. Removed drawing/material variants locate costs only and may not ship."""
from pathlib import Path
import os,json,traceback,io
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
R=Path('leather-workshop/r17').resolve();O=R/'qa/b1/hotspots';O.mkdir(parents=True,exist_ok=True)
BASE=(R/'out/candidate-r17.html').read_text()
HOOK=r'''
let __manual=false,__blocked=false;const __original=render;
render=function(...a){if(__blocked&&!__manual)return;return __original(...a);};
window.__probe={setup(variant){__blocked=true;const floor=scene.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry');
if(variant==='no-floor')floor.visible=false;
if(variant==='no-environment')scene.environment=null;
if(variant==='no-shadows')renderer.shadowMap.enabled=false;
if(variant==='basic-floor')floor.material=new T.MeshBasicMaterial({color:floor.material.color});
if(variant==='basic-hero')hero.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(m=>skinMaterial(new T.MeshBasicMaterial({color:m.color,map:m.map,side:m.side}),hero.userData.rig,false)):skinMaterial(new T.MeshBasicMaterial({color:o.material.color,map:o.material.map,side:o.material.side}),hero.userData.rig,false);});
if(variant==='no-yarn')hero.traverse(o=>{if(o.userData.thread)o.visible=false;});
},async sample(){const g=renderer.getContext(),ext=g.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)throw Error('No timer');const q=g.createQuery();g.beginQuery(ext.TIME_ELAPSED_EXT,q);__manual=true;try{render();}finally{__manual=false;g.endQuery(ext.TIME_ELAPSED_EXT);}for(let i=0;i<1200;i++){if(g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE)){const bad=g.getParameter(ext.GPU_DISJOINT_EXT),ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);if(bad)throw Error('disjoint');return {gpuMS:ms,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,error:g.getError()};}await new Promise(r=>setTimeout(r,10));}throw Error('query timeout');}};
'''
report={'pass':False,'scope':'Root-cause diagnostic variants; not publication or reduced-quality candidates','rows':[],'errors':[]}
def save():(O/'report.json').write_text(json.dumps(report,indent=2))
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);report['browser']=b.version;reference=None
 try:
  for label in ['current','alpha-true','no-floor','no-environment','no-shadows','basic-floor','basic-hero','no-yarn']:
   s=BASE
   if label=='alpha-true':
    old="antialias:true,alpha:false,preserveDrawingBuffer:true";assert s.count(old)==1;s=s.replace(old,"antialias:true,alpha:true,preserveDrawingBuffer:true")
   copy=O/(label+'.html');copy.write_text(s.replace('boot().catch(fail);',HOOK+'\nboot().catch(fail);'))
   ctx=b.new_context(viewport={'width':1440,'height':1000},offline=True);p=ctx.new_page();p.set_default_timeout(180000);p.on('pageerror',lambda e:report['errors'].append(str(e)));p.goto(copy.as_uri(),wait_until='domcontentloaded');p.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000)
   p.evaluate('async()=>{LEATHER_ATELIER.selectProduct("wallet");LEATHER_ATELIER.configure({craft:"plain"});LEATHER_ATELIER.selectMaterial("heritage");await LEATHER_ATELIER.resetGrab();LEATHER_ATELIER.setView("home");}');p.evaluate('v=>__probe.setup(v)',label)
   rows=[]
   for k in range(5):
    q=p.evaluate('__probe.sample()');assert q['error']==0,q
    if k>=2:rows.append(q)
   p.add_style_tag(content='#stageLabel{visibility:hidden!important}');data=p.locator('#stage').screenshot();(O/(label+'.png')).write_bytes(data);im=Image.open(io.BytesIO(data)).convert('RGB');pixels=None
   if reference is None:reference=im
   else:
    d=ImageChops.difference(reference,im);pixels={'mean':sum(ImageStat.Stat(d).mean)/3,'max':max(v[1] for v in d.getextrema())}
   row={'variant':label,'medianGPUMS':sorted(q['gpuMS'] for q in rows)[1],'samples':rows,'pixels':pixels};report['rows'].append(row);save();print(label,row['medianGPUMS'],pixels,flush=True);ctx.close()
  assert not report['errors'];report['pass']=True
 except Exception as e:report['error']=str(e);report['trace']=traceback.format_exc();raise
 finally:save();b.close()
