from pathlib import Path
import hashlib,json,re,subprocess
P=Path(__file__).resolve().parent
source=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
three=(P/'three.module.js').read_text();eb1=(P/'eb1.js').read_text();app=(P/'app.js').read_text();html=(P/'index.source.html').read_text()
assert hashlib.sha256(eb1.encode()).hexdigest()=='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572'
# C3 refines the actual C2 fiber populations. No generated picture enters the runtime.
pairs=[
 ("length:74,under:32,curl:.48,comb:.66,clump:.42,rough:.68,root:'#3a2c22',mid:'#907760',tip:'#c9bba5'", "length:92,under:32,curl:.58,comb:.78,clump:.72,rough:.58,root:'#30281f',mid:'#685848',tip:'#b6a58e'"),
 ('attribute vec3 aRoot,aNormal,aGroom,aCluster;attribute vec4 aRandom;', 'attribute vec3 aRoot,aNormal,aGroom,aCluster;attribute vec2 aTuft;attribute vec4 aRandom;'),
 ('varying vec3 vN,vTangent,vPosition;', 'varying vec3 vN,vTangent,vPosition;varying vec2 vTuft;'),
 ('vGuard=guard;', 'vGuard=guard;vTuft=aTuft;'),
 ('*(1.+fly*.19);','*(1.+fly*.19)*(.78+.23*aTuft.y+.16*aTuft.x);'),
 ('aCluster*uClump*t*t*.85','aCluster*uClump*t*t*mix(1.12,.80,guard)'),
 ('mix(.10,.025,guard)','mix(.10,.058,guard)'),
 ('uThickness*mix(.80,1.,guard)','uThickness*mix(.80,1.65,guard)'),
 ('base*=.72+.53*vRnd;', 'base=mix(mix(uRoot,uMid,.32+.33*vT),base,vGuard);base*=.79+.40*vRnd;base*=.70+.30*vTuft.y;'),
 ('float occlusion=mix(.33,1.,sqrt(vDepth));','float occlusion=mix(.25,1.,sqrt(vDepth))*(.68+.32*vTuft.y);'),
 ('clusters=new Float32Array(count*3);','clusters=new Float32Array(count*3),tufts=new Float32Array(count*2);'),
 ('Math.floor(u*24),cy=Math.floor(v*40)','Math.floor(u*16),cy=Math.floor(v*22)'),
 ('(cx+.28+.44*jj)/24','(cx+.28+.44*jj)/16'),
 ('(cy+.25+.5*(1-jj))/40','(cy+.25+.5*(1-jj))/22'),
 ('clusters.set(delta.toArray(),i*3);','clusters.set(delta.toArray(),i*3);tufts[i*2]=jj;tufts[i*2+1]=Math.exp(-4*((u-cu)*16)**2-4*((v-cv)*22)**2);'),
 ("['aCluster',clusters,3]","['aCluster',clusters,3],['aTuft',tufts,2]"),
 ("plain?'#36231c':p.root", "plain?'#59483b':p.root"),
 ("mesh.castShadow=true;mesh.receiveShadow=true;subject.add(mesh);growth.push(mesh)", "mesh.castShadow=!piece.name.includes('圆肩');mesh.receiveShadow=!piece.name.includes('圆肩');subject.add(mesh);growth.push(mesh)"),
 ('diffuseColor.rgb*=.88+.19*grain+.09*macroGrain;', 'float pixelSpan=length(fwidth(vMaterialPoint))*2100.;float filterGrain=1.-smoothstep(.7,2.5,pixelSpan);diffuseColor.rgb*=mix(1.02,.88+.19*grain+.09*macroGrain,filterGrain);')
]
for old,new in pairs:
 assert old in app,'C3 source anchor absent: '+old[:100]
 app=app.replace(old,new)
# Diagnostic readback budget only. No alternate geometry or lowered rendering quality.
app=app.replace('performance.now()-start>15000','performance.now()-start>90000')
(P/'app.js').write_text(app)
# A new build must not carry an earlier candidate's success receipt.
for relative in ['qa/BROWSER_REPORT.json','qa/PUBLIC_REPORT.json','DELIVERY.json']:
 (P/relative).unlink(missing_ok=True)
m=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',three);assert m
exports=[]
for entry in m.group(1).split(','):
 names=entry.strip().split(' as ');exports.append(names[-1]+':'+names[0] if len(names)>1 else names[0])
bundle='const T=(()=>{\n'+three[:m.start()]+'\nreturn {'+','.join(exports)+'};})();\n'+app.replace("import * as T from './three.module.js';",'',1)
meta={'version':'FUR-ATELIER-R02','revision':'C3','sourceCommit':source,'baseline':'0058e6337ee82a7fb664fb58df94fd2406bb1c15','three':'r169','eb1':'1.1.0','referenceImageInRuntime':False,'externalModel':False,'captureTimeoutMs':90000,'hardwarePerformanceCertified':False}
html=html.replace('<script src="eb1.js"></script>','<script>'+eb1+'</script>')
html=html.replace('<script type="module" src="app.js"></script>','<script>window.FUR_BUILD='+json.dumps(meta)+';\n'+bundle+'</script>')
assert '<script src=' not in html
(P/'preview.html').write_text(html)
meta['files']={n:{'bytes':(P/n).stat().st_size,'sha256':hashlib.sha256((P/n).read_bytes()).hexdigest()} for n in ['app.js','preview.html','index.source.html','eb1.js']}
(P/'BUILD_MANIFEST.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,indent=2))
