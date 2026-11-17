"""Build two isolated gray-only legacy test pages without the skin graph.

The source geometry is not modified. Skin-material support and acceptance are
explicitly excluded. The audit variant records the source assets actually read.
"""
from pathlib import Path
import hashlib, json, mmap

work=Path('G:/Three.js/Human/Human-Motion-Continuity-R07-20261106')
src=work/'.runtime/gray-late-phases-r2-research-20261115.html'
items=[
 ('gray-without-skin-graph-research-20261115.html',False),
 ('gray-asset-audit-research-20261115.html',True),
]
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
with src.open('rb') as f:
 m=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
 a=m.find(b'<script type="application/octet-stream" id="saved-graph-field">');assert a>=0
 b=m.find(b'</script>',a)+len(b'</script>');c=m.find(b'<script data-graph-skin="R07">',b);assert c>=b
 d=m.find(b'</script>',c)+len(b'</script>');assert d>c
 lid=m.find(b'<script data-lid-margin="R01">');assert lid>=0
 lid_start=m.find(b'var yt=setInterval(()=>{if(window.__PERSON_LASHES_READY__)',lid);lid_end=m.find(b'</script>',lid_start);assert lid<lid_start<lid_end
 replacements=[
  (a,b,b''),(c,d,b''),(lid_start,lid_end,b"var yt=setInterval(()=>{if(window.__PERSON_LASHES_READY__){clearInterval(yt);try{const e=dt();window.eyelidMargin={ready:true,section:e};window.__EYELID_MARGIN_READY__=true;}catch(t){window.__EYELID_MARGIN_ERROR__=t.stack;console.error(t)}}},100);})();\n"),
  (b'while(!(window.__NATIVE_CROP_R08_READY__&&window.__R05_PRESENTATION_READY__))',b'while(!(window.__IDENTITY_QA__?.model?.()&&window.__IDENTITY_QA__?.viewer?.()&&window.fullCommonWorkbench))'),
  (b'function b(){if(!o)return;let u=o,v=u.geometry,E=v.attributes,w=E.position.array,F=E.normal.array;',b'function b(){if(window.__GRAY_LID_APPLY__)return window.__GRAY_LID_APPLY__(o,a,()=>{h++});if(!o)return;let u=o,v=u.geometry,E=v.attributes,w=E.position.array,F=E.normal.array;'),
  (b'for(let p=0;p<v.position.count;p++){if(v.csType.getX(p)>.1||v.csRegion.getX(p)<.8)continue;',b'for(let __gray_i=0,__gray_support=window.__GRAY_LID_SUPPORT__?.(u);__gray_i<(__gray_support?__gray_support.length:v.position.count);__gray_i++){let p=__gray_support?__gray_support[__gray_i]:__gray_i;if(v.csType.getX(p)>.1||v.csRegion.getX(p)<.8)continue;'),
  (b'let w=new Kd(s,h,u),M=0,R=0,v=0;',b'let w=new (window.__GRAY_MOUTH_ENVELOPE__||Kd)(s,h,u),M=0,R=0,v=0;'),
  (b'p=h.center;d.set(r);let f=JSON.stringify([e.state.gnm.identity',b'p=h.center;d.set(r);window.__GRAY_LIP_ATLAS_BEGIN__?.(t.atlasData,i);let f=JSON.stringify([e.state.gnm.identity'),
  (b'hw(t.atlasData,C.u,C.v,C.upper)*c.furrows*l.microGeometry*C.red*j*(1-C.inner*.85)',b'(window.__GRAY_LIP_ATLAS_SAMPLE__?.(t.atlasData,C.u,C.v,C.upper,D)??hw(t.atlasData,C.u,C.v,C.upper))*c.furrows*l.microGeometry*C.red*j*(1-C.inner*.85)'),
  (b'for(let D of i.active){let C=i.samples[D],I=Bn(d,D).map((le,ae)=>le-p[ae])',b"if(!(window.__GRAY_SKIP_ZERO_LIP_PERFORMANCE__&&l.tissueDepth===1&&['stretchLeft','stretchRight','cornerLeft','cornerRight','pucker','funnel','rollOut','rollIn','press','upperRaise','lowerDepress'].every(k=>a[k]===0)))for(let D of i.active){let C=i.samples[D],I=Bn(d,D).map((le,ae)=>le-p[ae])"),
  (b"await installBodyWorkbenchR01();await personSkin.view('full');",b"""
 // This hidden gray-only reference needs the original eyelid section operator,
 // which the legacy page normally initializes after its unrelated skin graph.
 // Minimal presentation stubs do not supply or claim a skin material.
 window.personSkin??={report:()=>({grayReferenceOnly:true}),view:async()=>{}};
 window.graphSkin??={report:()=>({generation:null,grayReferenceOnly:true})};
 window.__TISSUE_SHADER__??={uniforms:{uFPass:{value:0}}};
 window.__GRAY_LID_HOOK_AVAILABLE__=true;
 window.__GRAY_LID_SUPPORT_HOOK_AVAILABLE__=true;
 window.__GRAY_MOUTH_HOOK_AVAILABLE__=true;
 window.__GRAY_LIP_ATLAS_HOOK_AVAILABLE__=true;
 window.__GRAY_LIP_ZERO_HOOK_AVAILABLE__=true;
 window.__PERSON_SKIN_READY__=true;
 while(!window.__EYELID_MARGIN_READY__){if(window.__LASH_ERROR__||window.__EYELID_MARGIN_ERROR__)throw Error(window.__LASH_ERROR__||window.__EYELID_MARGIN_ERROR__);if(Date.now()-t>300000)throw Error('Gray eyelid reference timeout');await new Promise(r=>setTimeout(r,100));}
 window.installNativeSurfaceSync(window.__IDENTITY_QA__.viewer());
 await installBodyWorkbenchR01();
 """),
 ]
 audit=(b'const config=window.__SKIN_OFFLINE__,entries=config.entries,cache=new Map(),nativeFetch=window.fetch.bind(window);',b"const config=window.__SKIN_OFFLINE__;window.__GRAY_REQUESTED_ASSETS__=new Set;config.entries=new Proxy(config.entries,{get(t,k,r){if(typeof k==='string')window.__GRAY_REQUESTED_ASSETS__.add(k);return Reflect.get(t,k,r)}});const entries=config.entries,cache=new Map(),nativeFetch=window.fetch.bind(window);")
 outputs=[]
 for name,record in items:
  edits=[]
  for old,new in replacements[3:]+([audit] if record else []):
   i=m.find(old);assert i>=0 and m.find(old,i+1)<0,old[:80];edits.append((i,i+len(old),new))
  edits.extend(replacements[:3]);edits.sort();target=work/'.runtime'/name;cursor=0
  with target.open('wb') as out:
   for lo,hi,value in edits:
    assert lo>=cursor
    for p in range(cursor,lo,1024*1024):out.write(m[p:min(p+1024*1024,lo)])
    out.write(value);cursor=hi
   for p in range(cursor,len(m),1024*1024):out.write(m[p:min(p+1024*1024,len(m))])
  outputs.append({'file':name,'bytes':target.stat().st_size,'sha256':sha(target),'assetAudit':record})
 report={'schema':'gray-without-skin-graph-build/1','sourceSHA256':sha(src),'skinGraphOmitted':True,'originalSurfaceDataModified':False,'startupDoesNotWaitForSkinOrHair':True,'skinMaterialSupported':False,'outputs':outputs,'releaseReady':False}
 (work/'review/gray-without-skin-graph-build-20261115.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(report))
