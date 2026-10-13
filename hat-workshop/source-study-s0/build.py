"""Additive study viewer around frozen imported hats. No new ownership claim over assets."""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,io,re
from collections import Counter
from PIL import Image
R=Path(__file__).resolve().parent
BASE='fbc80722683b73bc63bf2d55d2891f118037d800'
PAGE_SHA='ccb19a5b1a2fc1fe3e529151fe941b8bc4901799be4a5e47ac686fa81c1d7e53'
P=argparse.ArgumentParser();P.add_argument('--reference',required=True);P.add_argument('--source',default='LOCAL');A=P.parse_args()
B=Path(A.reference);page=(B/'index.html').read_text();sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(page.encode())==PAGE_SHA,'Wrong reference page'
m=re.search(r'<div[^>]*id="payload"[^>]*>(.*?)</div>',page,re.S);assert m
D=json.loads(gzip.decompress(base64.b64decode(m[1].strip())))
original=json.loads((B/'BUILD_MANIFEST.json').read_text());rows=[]
def components(faces,corner_uv=None):
    parent=list(range(len(faces)));edges={}
    def root(a):
        while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
        return a
    for fi,f in enumerate(faces):
        for j,a in enumerate(f):
            b=f[(j+1)%len(f)]
            x=(a,) if corner_uv is None else (a,*[round(v,7) for v in corner_uv[fi][j]])
            y=(b,) if corner_uv is None else (b,*[round(v,7) for v in corner_uv[fi][(j+1)%len(f)]])
            key=tuple(sorted((x,y)))
            if key in edges:parent[root(fi)]=root(edges[key])
            else:edges[key]=fi
    return sorted(Counter(root(i) for i in range(len(faces))).values(),reverse=True)
def image_info(raw):
    im=Image.open(io.BytesIO(raw));out={'width':im.width,'height':im.height,'mode':im.mode,'bytes':len(raw),'sha256':sha(raw)}
    if 'A' in im.getbands():
        hist=im.getchannel('A').histogram();out['alphaBelowQuarterFraction']=round(sum(hist[:64])/(im.width*im.height),6)
    return out
for h in D['hats']:
    mother=h['mother'];record=next(x for x in original['sourcePreservation'] if x['hat']==h['id'])
    ch=sha(json.dumps(mother,sort_keys=True,separators=(',',':')).encode());assert ch==record['sourceControlHash']
    color=base64.b64decode(h['textures']['color'].split(',')[1]);assert sha(color)==record['colorByteSHA256']
    n=(B/'details'/(h['id']+'.webp')).read_bytes() if h.get('normalSource') else None
    if n:assert sha(n)==record['normalByteSHA256']
    topology=components(mother['faces']);uv=components(mother['faces'],mother['cornerUV'])
    rows.append({'id':h['id'],'title':h['title'],'author':h['author'],'licenceAsRecorded':h['licence'],'referenceURL':h['referenceURL'],
        'controls':len(mother['controls']),'polygons':len(mother['faces']),'faceDegrees':dict(Counter(map(len,mother['faces']))),'subdivision':mother['subdivision'],'smoothUV':mother['smoothUV'],
        'connectedComponents':len(topology),'componentFaceCounts':topology,'uvIslands':len(uv),'uvIslandFaceCounts':uv,
        'controlSHA256':ch,'color':image_info(color),'normal':image_info(n) if n else None,
        'sourceEnvelopeMM':[round((b-a)*1000,3) for a,b in zip(h['sourceBounds'][0],h['sourceBounds'][1])],
        'fitOrigin':h['origin'],'diffuseColor':h.get('diffuseColor'),'ownReconstructionStatus':'not_accepted','layerReplacementStatus':{'shape':'not_started','uv':'not_started','surface':'not_started'},
        'pendingAnalysis':['Name connected components anatomically; component is not automatically a sewn panel','Separate relief visible in geometry from relief in maps','Measure silhouette and section anchors in common camera','Recover author construction process only where source files substantiate it']})
audit={'version':'HAT-STUDY-S0','sourceSha':A.source,'referenceCommit':BASE,'referencePageSHA256':PAGE_SHA,'referenceRuntime':'R09 renderer plus source-form switch; not the original author renderer',
    'scope':'All eleven existing imported hats. Study assets remain third-party; no reconstruction is passed by restoring them.',
    'observations':{'hats':len(rows),'normalMapCount':sum(r['normal'] is not None for r in rows),'colorMapCount':len(rows),'proceduralSourceMode':False,
        'importedRendererMaterial':'MeshPhysicalMaterial + individual diffuseColor + sRGB color + tangent normal where supplied',
        'sharedRendererDefaults':{'roughness':.86,'normalScale':[.8,.8],'sheen':.65,'sheenRoughness':.85,'specularIntensity':.18,'envMapIntensity':.45,'alphaTest':.25},
        'warning':'Shared shader defaults are prior importer settings, not proven original author BSDF or measured material parameters.'},'hats':rows,'filmReady':False,'reconstructionComplete':False}
assert len(rows)==11
(R/'AUDIT.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
addon='<style>'+(R/'study.css').read_text()+'</style><script>globalThis.HAT_STUDY_AUDIT='+json.dumps(audit,ensure_ascii=False,separators=(',',':'))+';'+(R/'study.js').read_text().replace('</script','<\\/script')+'</script>'
assert page.count('</body>')==1
output=page.replace('</body>',addon+'</body>')
(R/'index.html').write_text(output)
manifest={'version':'HAT-STUDY-S0','sourceSha':A.source,'referenceCommit':BASE,'referencePageSHA256':PAGE_SHA,'referencePageRecoverableByteExactly':output.replace(addon,'')==page,'entryBytes':len(output.encode()),'htmlSHA256':sha(output.encode()),'auditSHA256':sha((R/'AUDIT.json').read_bytes()),'allOriginalControlAndTextureHashesChecked':True,'originalRuntimeEdited':False,'filmReady':False,'reconstructionComplete':False,'publicVerified':False}
(R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'manifest':manifest,'hats':[{k:r[k] for k in ['id','controls','polygons','subdivision','uvIslands','connectedComponents']} for r in rows]},ensure_ascii=False))
