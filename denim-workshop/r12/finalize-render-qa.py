"""Add equivalent paused-pose image check; retain the failed live-wind sequence."""
from pathlib import Path
P=Path(__file__).resolve().parent
p=P/'qa-structure.py';s=p.read_text()
old="  gen=p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()');before=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps')"
new="""  # Identical uploaded physical pose, scene samples and primitive order. Only
  # command scheduling changes. The unbatched path is QA-only, never auto fallback.
  capture(p,'batch-parity-position',{'zoom':.6,'panX':0,'panY':0})
  batched,_=capture(p,'batch-parity-bounded',{'qaSingleBatch':False})
  single,_=capture(p,'batch-parity-single',{'qaSingleBatch':True})
  delta=np.abs(batched.astype(int)-single.astype(int));r['batchPixelParity']={'max':int(delta.max()),'mean':float(delta.mean()),'sameFrozenPhysics':True}
  assert delta.max()<=1 and delta.mean()<.001,r['batchPixelParity']
  capture(p,'batch-parity-restored',{'qaSingleBatch':False,'zoom':1.5,'panX':4,'panY':-1})
  gen=p.evaluate('__DENIM_WORKBENCH__.physicsGeneration()');before=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps')"""
if "r['batchPixelParity']" not in s:
 assert s.count(old)==1,'Unknown physics comparison insertion'
 s=s.replace(old,new)
p.write_text(s)
print('Added same-pose bounded/unbounded equality check, no removed wind, camera or material tests.')
