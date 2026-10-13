"""One-time canonical S2 source edit; never imported by ordinary build.py.
Remove temporary arrays from the hot native contact bridge. Preserve the exact
15/9-double ABIs, contact order, fallbacks and solver/CCD arithmetic.
"""
from pathlib import Path
import hashlib,json,shutil,subprocess
HERE=Path(__file__).resolve().parent
R=HERE.parent/'r14'
def sha(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def once(s,a,b):
 if s.count(a)!=1:raise ValueError('Reviewed source drift: '+a[:90])
 return s.replace(a,b,1)
def apply():
 p=R/'src/physics/native-energy.js';raw=p.read_bytes();s=raw.decode();marker='S2_SCALAR_CONTACT_PACKING'
 lockpath=R/'canonical.lock.json';lock=json.loads(lockpath.read_text())
 if marker in s:
  for n in ['src/physics/native-energy.js','qa-performance.cjs','qa-packing.cjs']:
   assert sha((R/n).read_bytes())==lock['files'][n]['sha256'],n
  print('Scalar contact bridge already registered');return
 if blob(raw)!='e118b44d1a4eda2a220b80396c56be49d20fc765':raise ValueError('Unexpected native bridge; do not overwrite')
 s=once(s,'Math.hypot(...q.n)','Math.hypot(q.n[0],q.n[1],q.n[2])')
 s=once(s,'const p=pairs[offset+i];w[16].set([...p.ids,p.gap,p.pt?1:0,...(p.previous?.n||[0,0,0])],9*i);','const p=pairs[offset+i],k=9*i,ids=p.ids,normal=p.previous?.n,buffer=w[16];buffer[k]=ids[0];buffer[k+1]=ids[1];buffer[k+2]=ids[2];buffer[k+3]=ids[3];buffer[k+4]=p.gap;buffer[k+5]=p.pt?1:0;buffer[k+6]=normal?normal[0]:0;buffer[k+7]=normal?normal[1]:0;buffer[k+8]=normal?normal[2]:0;')
 s='// S2_SCALAR_CONTACT_PACKING: exact scalar ABI writes; no candidate or native math removed.\n'+s
 perf=R/'qa-performance.cjs';bench=perf.read_text()
 if blob(perf.read_bytes())!='e26a15065bcbc3ac13621a7ac3db7a133dd63b5f':raise ValueError('Unexpected performance harness')
 bench=once(bench,"const out=path.join(__dirname,'qa/s2');", "require('./qa-packing.cjs');\nconst out=path.join(__dirname,'qa/s2');")
 bench=once(bench,'play(a);play(b);const trials=[];', 'for(let warmup=0;warmup<2;warmup++){play(a);play(b);}const trials=[];')
 bench=once(bench,'round<4','round<8');bench=once(bench,'pairedReplays:4','pairedReplays:8')
 bench=once(bench,'One warm-up per version and product; four alternating paired deterministic 52-step replays, 208 timed substeps per version per product.', 'Two warm-ups per version and product; eight alternating paired deterministic 52-step replays, 416 timed substeps per version per product. Sample count fixed before this candidate run; previous failed attempt retained. Same performance thresholds: every ratio >0.95 and median product ratio >1.03.')
 assert 'products.every(p=>p.solveSpeedRatio>.95)&&report.medianSpeedRatio>1.03' in bench
 p.write_text(s);perf.write_text(bench);shutil.copy2(HERE/'qa-packing.cjs',R/'qa-packing.cjs')
 for n in ['src/physics/native-energy.js','qa-performance.cjs','qa-packing.cjs']:
  data=(R/n).read_bytes();lock['files'][n]={**lock['files'].get(n,{}),'bytes':len(data),'sha256':sha(data),'gitBlob':blob(data)}
 lockpath.write_text(json.dumps(lock,indent=2)+'\n')
 subprocess.run(['node','--check',str(p)],check=True);subprocess.run(['node','--check',str(perf)],check=True);subprocess.run(['node','--check',str(R/'qa-packing.cjs')],check=True)
 (R/'PACKING_OPTIMIZATION.md').write_text('''# Contact bridge packing — 2026-10-13

The first recovery run 38344361385 fixed browser timing boot and passed source/numerical/geometry/browser gates, but its same-machine performance gate failed: wallet ratio 1.086289, swatch 0.977040, bag 1.025242; median 1.025242 did not exceed 1.03. It was not published. The prior successful partial run is not substituted for this failure.

The next candidate removes temporary spread arrays from every packed CCD candidate and avoids the iterator in three-component normal length calculation. Float64 values, count, order, capacity batching, null-normal fallback, lagged friction, narrow-phase rules and native code remain unchanged. New code is normal readable canonical source, not a runtime string patch. The already-separate R14 potential certificate remains protected by 480 varied native-value comparisons and complete trajectory regressions.

The actual production clip method is compared with R13 using bounded fake buffers for 24 batches/normal combinations, including absent normals, signed zero, cache reuse and capacity rollover; all packed bytes, returned fractions and event counts must match. The full coupled solver/CCD and geometry tests still run separately.

Benchmark policy is declared before the new run: two warmups and eight alternating paired replays per product, 416 timed substeps per version/product. Thresholds remain every ratio >0.95 and median product ratio >1.03. Do not discard failed reports, publish on correctness alone, use the old lucky run, or describe software-runner measurements as user-device FPS.
''')
 readme=R/'README.md';t=readme.read_text().replace('one warm-up and four alternating paired 52-step runs','two warm-ups and eight alternating paired 52-step runs')
 t+='\nS2 recovery also replaces temporary contact-serialization arrays with exact scalar Float64 writes. See PACKING_OPTIMIZATION.md; it preserves native arithmetic and does not remove collision candidates.\n'
 readme.write_text(t)
 print('Canonical bridge, packing regression and predeclared longer benchmark registered')
if __name__=='__main__':apply()
