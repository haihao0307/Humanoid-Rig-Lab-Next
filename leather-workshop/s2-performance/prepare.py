"""One-time R13 -> R14 migration. Normal builds never import this file."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys,tempfile
HERE=Path(__file__).resolve().parent
BASE_HTML='276c0f8d9cc5d038ddfedf870b4c7bef0feffc200afe7b616941d605481bd8cb'
def sha(b):return hashlib.sha256(b).hexdigest()
def one(s,a,b):
 if s.count(a)!=1:raise ValueError('Migration source drift: '+a[:100])
 return s.replace(a,b,1)
PLANE='''/* R14 S2A conservative distance certificate. For any vector n, the
 * distance between convex primitives is at least their positive projected
 * separation divided by |n|. Check CURRENT vertices on every evaluation.
 * Bypass closest-point work only if this lower bound proves both zero
 * barrier and no improvement to the exact running minimum. Unknown/near
 * cases use the original narrow phase. Lagged friction and swept CCD stay.
 * Padding is conservative; it does not loosen any physical tolerance. */
static int last_pruned;
__attribute__((visibility("default"))) int potential_pruned(){return last_pruned;}
static int inactive_plane(double *p,int *ids,double minimum){
 double threshold=(p[4]+max(RANGE,minimum)+1e-9)*p[14];
 if(!__builtin_isfinite(threshold)||!(p[14]>.5))return 0;
 V origin=point(X,ids[0]),n={p[10],p[11],p[12]};
 double a=dot(sub(point(X,ids[1]),origin),n),b=dot(sub(point(X,ids[2]),origin),n),c=dot(sub(point(X,ids[3]),origin),n);
 double separation=p[5]?-max(a,max(b,c)):min(0,a)-max(b,c);
 return separation>threshold;
}
'''
def prepare():
 src=HERE.parent/'r13';dst=HERE.parent/'r14'
 if dst.exists():
  if not (dst/'S2_TASK_ANCHOR.json').is_file():raise ValueError('Unrecognized existing R14; never overwrite')
  return
 if sha((src/'public-lite.html').read_bytes())!=BASE_HTML:raise ValueError('Wrong frozen R13 page')
 oldlock=json.loads((src/'canonical.lock.json').read_text())
 for n,q in oldlock['files'].items():
  if sha((src/n).read_bytes())!=q['sha256']:raise ValueError('R13 drift '+n)
 shutil.copytree(src,dst,ignore=shutil.ignore_patterns('out','qa','__pycache__','node-lib.cjs','public-lite.html','BUILD_RESULT.json','DELIVERY.json'))
 shutil.copytree(src/'qa/reference',dst/'qa/reference')
 p=dst/'native/energy.c';s=p.read_text();s=one(s,'p+=14*NP;','p+=15*NP;');s=one(s,'PAIR+14*i','PAIR+15*i')
 a='__attribute__((visibility("default"))) void potential(int np,int withdiag){';s=one(s,a,PLANE+a+'\n last_pruned=0;')
 a='V pts[4];for(int z=0;z<4;z++)pts[z]=point(X,ids[z]);Q q=p[5]?pt(pts):ee(pts);'
 s=one(s,a,'if(inactive_plane(p,ids,minGap)){last_pruned++;}else{'+a)
 s=one(s,'if(p[13]>0&&MU>0)','}\n  if(p[13]>0&&MU>0)');p.write_text(s)
 p=dst/'src/physics/native-energy.js';s=p.read_text();s=one(s,'14*this.capacity','15*this.capacity');s=one(s,'const o=14*i;','const o=15*i;a[9][o+14]=Math.hypot(...q.n);');p.write_text(s)
 p=dst/'native/toolchain.json';cfg=json.loads(p.read_text());cfg['referenceR13SHA256']=cfg['expectedSHA256'];cfg['referenceR13Bytes']=cfg['expectedBytes'];cfg['sources']={n:sha((dst/'native'/n).read_bytes()) for n in cfg['sources']}
 cv=subprocess.check_output(['clang-18','--version'],text=True).splitlines()[0]
 if cv!=cfg['compilerVersion']:raise ValueError('Not the reviewed clang18 toolchain')
 with tempfile.TemporaryDirectory() as tmp:
  tmp=Path(tmp);c=tmp/'combined.c';w=tmp/'contact.wasm';c.write_bytes(b'\n'.join((dst/'native'/n).read_bytes() for n in cfg['sources']))
  subprocess.run(['clang-18',*cfg['flags'],'-fuse-ld='+shutil.which('wasm-ld-18'),str(c),'-o',str(w)],check=True)
  cfg['expectedSHA256']=sha(w.read_bytes());cfg['expectedBytes']=w.stat().st_size
 cfg['candidatePolicy']='New S2 candidate, NOT an updated R13 golden. Publication requires fresh native-value, geometry, trajectory and browser differential gates.'
 p.write_text(json.dumps(cfg,indent=2)+'\n')
 p=dst/'native/build.py';s=p.read_text();s=one(s,"'identicalToAcceptedKernel':True","'identicalToPinnedCandidate':True,'identicalToR13Kernel':sha(data)==cfg['referenceR13SHA256'],'referenceR13SHA256':cfg['referenceR13SHA256']");p.write_text(s)
 p=dst/'src/app/runtime.js';p.write_text(p.read_text().replace("VERSION='R13.0-S1C'","VERSION='R14.0-S2A'"))
 p=dst/'ui/template.html';p.write_text(p.read_text().replace('R13.0-S1C','R14.0-S2A'))
 p=dst/'build.py';s=p.read_text().replace('R13-S1C','R14-S2A').replace('candidate-r13.html','candidate-r14.html').replace('qa/s1c','qa/s2').replace('UNCOMMITTED-S1C','UNCOMMITTED-S2');p.write_text(s)
 p=dst/'qa-browser-s1c.py';s=p.read_text().replace('R13.0-S1C','R14.0-S2A').replace('candidate-r13.html','candidate-r14.html').replace("/'s1c'/","/'s2'/").replace("'phase':'S1B2'","'phase':'S2A'");(dst/'qa-browser-s2.py').write_text(s);p.unlink()
 for n in ['verify-s2.py','qa-performance.cjs','qa-native-certificate.cjs','qa-browser-performance.py']:shutil.copy2(HERE/n,dst/n)
 anchor={'taskId':'LEATHER-S2A','baseSha':'1ecac82028a570b25eeb5260396f3b206a7513d1','baseBuild':'89f2b71251ec6667c09b1ed043b6714da8fa5094','primaryDefect':'Expensive repeated closest-distance queries for provably inactive contact potentials','protected':['appearance','wear','geometry','thickness','time step','25-iteration budget','CCD','friction','candidate set and order','old previews','root LICENSE','jacket exclusion'],'referenceSet':['R13 kernel and source','six 52-step trajectories','R10 visual regression'],'gates':['native values/gradients/diagonal/min-gap differential','geometry and full trajectories','paired same-machine timings','offline and public browser'],'noImageSubstitute':True,'userVisibleArtifact':'standalone interactive HTML','status':'CANDIDATE_NOT_YET_VERIFIED'}
 (dst/'S2_TASK_ANCHOR.json').write_text(json.dumps(anchor,indent=2)+'\n')
 (dst/'README.md').write_text('''# R14 S2A — measured contact-potential optimization

This candidate starts from fixed R13. The only numerical production changes are the conservative projected-distance certificate in native/energy.c and its explicit 15-double pair ABI in src/physics/native-energy.js. One-time preparation is not used by normal build.py. New native bytes are pinned separately, never substituted for R13 golden bytes. The broadphase, candidate order, narrow-phase fallback, swept CCD, force law, friction, timestep, iterations, appearance and geometry remain protected.

A projection lower bound must exceed BOTH the barrier range and the current exact minimum, with positive numerical padding. Only then is the zero barrier term bypassed. Lagged friction remains evaluated independently. This is not omission of contact candidates. Invalid/zero normals and uncertain cases fall back to the original calculation. All displayed poses remain genuine solver results.

Run build.py, then verify-s2.py. The performance script uses one warm-up and four alternating paired 52-step runs per product; P50/P95, hardware, sample counts and inclusive phase costs are recorded. Wall-clock comparisons are not user-device FPS guarantees. Browser frame and input-to-pose samples are separate; unsupported GPU/queue/GC attribution is labelled unavailable instead of invented.

Progress and delivery are authoritative only in DELIVERY.json and the parent TASK_STATE. S2A is not all of S2, not a new material calibration, and not commercial legal clearance. Three.js, Poly2Tri and source attributions remain unchanged.

- [x] Real production source, not generated images.
- [x] Procedural leather geometry and actual physics retained.
- [ ] New interactive standalone/public browser verification: see fresh DELIVERY.json.
- [ ] User visual acceptance remains pending.

Primary timing references: https://developer.mozilla.org/en-US/docs/Web/API/Performance/timeOrigin and https://developer.mozilla.org/en-US/docs/Web/API/Performance/now .
''')
 lock=json.loads((dst/'canonical.lock.json').read_text());lock['phase']='S2A';lock['files'].pop('qa-browser-s1c.py',None)
 for n in ['verify-s2.py','qa-performance.cjs','qa-native-certificate.cjs','qa-browser-performance.py','qa-browser-s2.py']:lock['files'][n]={}
 for n in list(lock['files']):
  p=dst/n
  if not p.is_file():raise ValueError('Missing declared copied input '+n)
  data=p.read_bytes();lock['files'][n]={**lock['files'][n],'bytes':len(data),'sha256':sha(data),'gitBlob':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()}
 (dst/'canonical.lock.json').write_text(json.dumps(lock,indent=2)+'\n')
 print(json.dumps({'candidateKernel':cfg['expectedSHA256'],'nativeBytes':cfg['expectedBytes'],'root':str(dst)}))
if __name__=='__main__':prepare()
