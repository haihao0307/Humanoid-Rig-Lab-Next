"""Exploratory copies only: separate inactive patina ALU from opaque overdraw.
No copy from this probe is a release. Original thresholds remain untouched.
"""
from pathlib import Path
import os,json,time,io,traceback
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
R=Path('leather-workshop/r17').resolve();O=R/'qa/b1/refinement';O.mkdir(parents=True,exist_ok=True)
BASE=(R/'out/candidate-r17.html').read_text()
HOOK=r'''
const __depthCache=new WeakMap();let __depthEnabled=false,__manual=false,__blocked=false;
function __depthMaterial(mesh,original){let row=__depthCache.get(mesh);if(!row){row=new Map();__depthCache.set(mesh,row);}if(row.has(original))return row.get(original);const base=new T.MeshDepthMaterial({depthPacking:T.BasicDepthPacking,side:original.side,alphaTest:original.alphaTest,map:original.alphaTest>0?original.map:null,alphaMap:original.alphaMap});const m=skinMaterial(base,hero.userData.rig,false);m.colorWrite=false;m.depthWrite=true;m.depthTest=true;m.depthFunc=T.LessEqualDepth;m.polygonOffset=original.polygonOffset;m.polygonOffsetFactor=original.polygonOffsetFactor;m.polygonOffsetUnits=original.polygonOffsetUnits;row.set(original,m);return m;}
function __prepass(){
 const changed=[],hidden=[];let supported=true;hero.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m.transparent||m.transmission>0||m.alphaHash||m.displacementMap||!m.depthTest||!m.depthWrite)supported=false;});if(!supported)return false;
 scene.traverse(o=>{if(!o.isMesh||!o.visible)return;let q=o,within=false;while(q){if(q===hero){within=true;break;}q=q.parent;}if(!within){hidden.push(o);o.visible=false;}else{changed.push([o,o.material]);o.material=Array.isArray(o.material)?o.material.map(m=>__depthMaterial(o,m)):__depthMaterial(o,o.material);}});
 const enabled=renderer.shadowMap.enabled,needs=renderer.shadowMap.needsUpdate;renderer.shadowMap.enabled=false;
 try{__renderNative(scene,camera);}finally{renderer.shadowMap.enabled=enabled;renderer.shadowMap.needsUpdate=needs;for(const [o,m] of changed)o.material=m;for(const o of hidden)o.visible=true;}return true;
}
let __renderNative;function __install(){__renderNative=renderer.render.bind(renderer);renderer.render=function(s,c){if(__depthEnabled&&s===scene&&mode==='products'&&hero?.visible){const did=__prepass(),background=scene.background;if(did)scene.background=null;try{return __renderNative(s,c);}finally{scene.background=background;}}return __renderNative(s,c);};}
const __original=render;render=function(...a){if(__blocked&&!__manual)return;return __original(...a);};
window.__refine={init(depth){__depthEnabled=depth;__install();__blocked=true;},async draw(){const g=renderer.getContext(),ext=g.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)throw Error('No timer query');const q=g.createQuery();g.beginQuery(ext.TIME_ELAPSED_EXT,q);__manual=true;try{render();}finally{__manual=false;g.endQuery(ext.TIME_ELAPSED_EXT);}for(let i=0;i<1200;i++){if(g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE)){const disjoint=g.getParameter(ext.GPU_DISJOINT_EXT),ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);if(disjoint)throw Error('Disjoint timing');return{gpuMS:ms,glError:g.getError(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}await new Promise(r=>setTimeout(r,10));}throw Error('Query timeout');}};
'''
def agezero(s):
 a="if(ageEnabled){s.fragmentShader=s.fragmentShader.replace('#include <common>'";b="if(ageEnabled&&rig.age!==0){s.fragmentShader=s.fragmentShader.replace('#include <common>'";assert s.count(a)==1;s=s.replace(a,b)
 a="roughnessFactor=clamp(roughnessFactor-polish*.16+sunFade*.18,.14,.98);');\n  }\n };m.customProgramCacheKey="
 b="roughnessFactor=clamp(roughnessFactor-polish*.16+sunFade*.18,.14,.98);');\n  }else if(ageEnabled){s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\\nroughnessFactor=clamp(roughnessFactor,.14,.98);');}\n };m.customProgramCacheKey="
 assert s.count(a)==1;s=s.replace(a,b);a="+ageEnabled;return m;";assert s.count(a)==1;return s.replace(a,"+ageEnabled+'-zeroPatina-'+(rig.age===0);return m;")
report={'pass':False,'scope':'Diagnostic alternatives; no production publication or gate relaxation','rows':[],'errors':[]}
def save():(O/'report.json').write_text(json.dumps(report,indent=2))
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);report['browser']=b.version;images={}
 try:
  for label in ['current','zero-patina','depth-prepass','both']:
   s=agezero(BASE) if label in ['zero-patina','both'] else BASE;p=O/(label+'.html');p.write_text(s.replace('boot().catch(fail);',HOOK+'\nboot().catch(fail);'))
   ctx=b.new_context(viewport={'width':1440,'height':1000},offline=True);page=ctx.new_page();page.set_default_timeout(180000);page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda e:report['errors'].append(e.text) if e.type=='error' else None);page.goto(p.as_uri(),wait_until='domcontentloaded');page.wait_for_function('window.LEATHER_ATELIER?.ready',timeout=240000);page.evaluate('d=>__refine.init(d)',label in ['depth-prepass','both']);page.add_style_tag(content='#stageLabel{visibility:hidden!important}')
   for product in ['wallet','swatch','bag']:
    page.evaluate('async id=>{LEATHER_ATELIER.selectProduct(id);LEATHER_ATELIER.configure({craft:"plain",age:0});LEATHER_ATELIER.selectMaterial("heritage");await LEATHER_ATELIER.resetGrab();LEATHER_ATELIER.setView("home");}',product)
    samples=[]
    for k in range(6):
     q=page.evaluate('__refine.draw()');assert q['glError']==0,q
     if k>=2:samples.append(q)
    data=page.locator('#stage').screenshot();(O/(label+'-'+product+'.png')).write_bytes(data);im=Image.open(io.BytesIO(data)).convert('RGB');pixel=None
    if label=='current':images[product]=im
    else:
     diff=ImageChops.difference(images[product],im);pixel={'mean':sum(ImageStat.Stat(diff).mean)/3,'max':max(e[1] for e in diff.getextrema()),'fraction':sum(diff.convert('L').histogram()[3:])/(diff.width*diff.height)}
    row={'variant':label,'product':product,'samples':samples,'medianGPUMS':sorted(x['gpuMS'] for x in samples)[1],'pixels':pixel};report['rows'].append(row);save();print(label,product,row['medianGPUMS'],pixel,flush=True)
   ctx.close()
  assert not report['errors'],report['errors'];report['pass']=True
 except Exception as e:report['error']=str(e);report['trace']=traceback.format_exc();raise
 finally:save();b.close()
