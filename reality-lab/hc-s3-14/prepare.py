from pathlib import Path
import os,hashlib,json
R=Path(__file__).resolve().parent;P=R.parent
sha=lambda b:hashlib.sha256(b).hexdigest()
base=Path(os.environ.get('RF314_BASE',str(P/'hc-s3-12')));toolkit=os.environ.get('RF314_TOOLKIT')
T=Path(toolkit) if toolkit else P
mesh=Path(os.environ['RF314_MESH_CONTACT'])
pre=Path(os.environ.get('RF314_PREFLIGHT',str(P/'hc-s3-13/adaptive-preflight.mjs')))
source=base/'local-solve.mjs'
files={'local-base.mjs':(source,'b9b7873d279eacc631b7c358dad71db312ffa42d4f18c12fc2b26e8ef88d53d2'),'preflight.mjs':(pre,'0c10284f16e8100a8b9b62669a552208278e75aef57a9d4491b0e4a3577db576'),'rf311-joint-guard.mjs':(T/'hc-s3-11/joint-guard.mjs','f8a7b82c53618ebf8fc9d52ace6f89de4385e7ba17b28b49b6031650ae9da963'),'rf37-contact-probe.mjs':(T/'hc-s3-7/contact-probe.mjs','55349ab8a0d09cad19ae6e9155794e83223ce72077326c7102392a49b24de2ec'),'mesh-contact.mjs':(mesh,'0fe9b8e0840c7b35c4ee3fce9b7d648c220043783ad6166314812472ddde8ff3')}
S=R/'_runtime';S.mkdir(exist_ok=True);proof={}
for name,(path,pin) in files.items():
 b=path.read_bytes();assert sha(b)==pin,(name,sha(b));(S/name).write_bytes(b);proof[name]=pin
original=source.read_text();scope='const scopes=[central,Array.from(oneRing).sort((a,b)=>a-b)].filter((v,i,a)=>i===0||v.length!==a[0].length);'
new='const preflight=planScopes(this,central,Array.from(oneRing).sort((a,b)=>a-b),POLICY);const scopes=preflight.eligible;'
rec='mode:this.localMode,scopes:[],accepted:false,continuousCollision:false';recNew='mode:this.localMode,preflight,scopes:[],accepted:false,continuousCollision:false'
end='   if(!solution){const after=this.patch(current,nodes,faces,exact);'
endNew="   this.__trialObserver?.({nodes:[...nodes],faces:[...faces],positions:current.slice(),seed,status:srec.status});\n"+end
for old in [scope,rec,end]:assert original.count(old)==1
prefix="import {planScopes} from './preflight.mjs';\n"
text=prefix+original.replace(scope,new).replace(rec,recNew).replace(end,endNew)
assert text.removeprefix(prefix).replace(new,scope).replace(recNew,rec).replace(endNew,end).encode()==source.read_bytes()
(S/'reference-solver.mjs').write_text(text);(S/'contact-shape.mjs').write_bytes((R/'contact-shape.mjs').read_bytes())
Q=R/'qa';Q.mkdir(exist_ok=True)
(Q/'ASSEMBLY.json').write_text(json.dumps({'passed':True,'sourcePins':proof,'referenceRemovalExact':True,'referenceSHA256':sha(text.encode()),'candidateSHA256':sha((R/'contact-shape.mjs').read_bytes()),'sourceProductionChanged':False},indent=2))
