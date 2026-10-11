"""Readable bounded corrections found by real R05 browser review.
Executed after strict source restoration; resulting production sources are committed.
"""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
receipts=[]
def edit(path, changes):
    p=root/path
    s=p.read_text()
    before=hashlib.sha256(s.encode()).hexdigest()
    for old,new in changes:
        assert s.count(old)==1, (path,old,s.count(old))
        s=s.replace(old,new)
    p.write_text(s)
    receipts.append({'path':path,'before':before,'after':hashlib.sha256(s.encode()).hexdigest()})
edit('src/model.mjs',[
 ('const result=super.build(s);',"const result=super.build({...s,selected:'all'});"),
 ('g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();','const originalNormals=g.attributes.normal.array.slice();g.computeVertexNormals();const shaded=g.attributes.normal.array;for(let i=0;i<n*2;i++){const j=i%n,w=i<n?0:Math.min(1,Math.max(0,(s.thickness[part.id]-actual[j])/Math.max(.001,s.thickness[part.id]*.65)));const v=norm([0,1,2].map(k=>originalNormals[i*3+k]*(1-w)+shaded[i*3+k]*w));for(let k=0;k<3;k++)shaded[i*3+k]=v[k];}g.computeBoundingBox();g.computeBoundingSphere();'),
 ('g.userData.report.restUVTileMm=96;','g.userData.report.restUVTileMm=96;for(let i=0;i<g.attributes.uv.array.length;i++)g.attributes.uv.array[i]*=50/96;'),
 ("g.userData.report.appearanceUV=atlas&&s.view!=='flat'?'CONFORMAL_SURFACE_MILLIMETRES':'ORIGINAL_PATTERN';","g.userData.report.appearanceUV=atlas&&s.view!=='flat'?'CONFORMAL_SURFACE_MILLIMETRES':'ORIGINAL_PATTERN';if(atlas&&s.view!=='flat')g.userData.report.fineAppearanceUV=metricStats(points,template.triangles,Array.from({length:n},(_,i)=>[uv[i*2]*96,uv[i*2+1]*96]));")
])
edit('src/materials.mjs',[
 ('const flesh=mats[1];','const flesh=mats[1];flesh.normalScale.set(.1,.1);flesh.roughness=.98;flesh.sheen=.12;'),
 ("if(part.kind==='footbed')","flesh.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\\nvec4 leatherTexel=texture2D(map,vMapUv);leatherTexel.rgb=mix(vec3(.08401343,.02765351,.00580022),leatherTexel.rgb,.22);diffuseColor*=leatherTexel;\\n#endif');};flesh.customProgramCacheKey=()=> 'r05-matte-flesh-mean-transfer';\n  if(part.kind==='footbed')"),
 ("top.name='DERIVED_P19_SOCKLINER';","top.onBeforeCompile=flesh.onBeforeCompile;top.customProgramCacheKey=flesh.customProgramCacheKey;top.name='DERIVED_P19_SOCKLINER';")
])
edit('tests/kernel.mjs',[
 ("const holeProbes=[];", "check('P29 may be selected without passing its new ID into the frozen nine-part validator',()=>{const selected=validate({...state,selected:'29'});const pp=model.build(selected);assert.equal(pp.length,10);assert.ok(pp.some(p=>p.id===29));pp.forEach(p=>p.geometry.dispose());});\ncheck('actual fine UV limitation is reported instead of coarse chart approval',()=>{assert.ok(report.parts.find(p=>p.id===28).fineAppearanceUV);assert.ok(report.parts.find(p=>p.id===28).fineAppearanceUV.p95>5);});\nconst holeProbes=[];")
])
(root/'REFINEMENT_RECEIPT.json').write_text(json.dumps({'reason':'actual P29 selection failure and faceted-highlight regression in pass1; retain source analytic normals outside skive; report fine UV separately','files':receipts},indent=2))
print('Applied',len(receipts),'checked readable refinement edits')
