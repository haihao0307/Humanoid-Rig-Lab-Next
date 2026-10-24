"""Direct solution of the SAME unregularized source constraints.

Research only. No change of the equations, input, normals, or acceptance limits.
The larger compact support covers sparse original body observations; the old
iterative solve did not converge at this support. No coefficient clipping.
"""
import os
os.environ['OPENBLAS_NUM_THREADS']='8'
import sys, time, json, math, hashlib
from pathlib import Path
import numpy as np
here=Path(__file__).resolve().parent
sys.argv=[sys.argv[0],'.05']
prefix=(here/'fit-hermite-r21.py').read_text(encoding='utf8').split('# Spatial block Jacobi')[0]
prefix=prefix.replace("os.environ['OPENBLAS_NUM_THREADS']='1'","os.environ['OPENBLAS_NUM_THREADS']='8'")
exec(compile(prefix,str(here/'fit-hermite-r21.py'),'exec'))
dimension=N*4
print(json.dumps({'phase':'assemble dense exact system','dimension':dimension,'matrixBytes':dimension**2*8}),flush=True)
dense=np.zeros((dimension,dimension),dtype=np.float64,order='C')
for a in range(4):
    for b in range(4):dense[row*4+a,col*4+b]=A[:,a,b]
print(json.dumps({'phase':'factor original SPD system','seconds':time.monotonic()-start}),flush=True)
L=np.linalg.cholesky(dense);del dense
LT=L.T.copy()
def solve(b):
    b=b.reshape(-1);y=np.empty_like(b);x=np.empty_like(b)
    for i in range(dimension):y[i]=(b[i]-np.dot(L[i,:i],y[:i]))/L[i,i]
    for i in range(dimension-1,-1,-1):x[i]=(y[i]-np.dot(LT[i,i+1:],x[i+1:]))/LT[i,i]
    return x.reshape(N,4)
x=solve(rhs);initial=float(np.linalg.norm(rhs))
for step in range(3):
    residual=rhs-product(x);error=float(np.linalg.norm(residual)/initial)
    print(json.dumps({'phase':'direct solve residual','step':step,'relativeResidual':error,'seconds':time.monotonic()-start}),flush=True)
    if error<1e-11:break
    x+=solve(residual)
exact=product(x)-rhs
position_residual=exact[:,0]/mass;gradient_residual=exact[:,1:]*sqrt20/radius/mass[:,None]
report={'schema':'body-source-hermite-research/1','solver':'unregularized dense Cholesky and original-system residual refinement','sourceReferenceSHA256':target['referenceSHA256'],'offlineReferenceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceDerivedCalibration':True,'independentWholeBody':False,'sourceFidelityAccepted':False,'intentionalShapeChanges':False,'smoothingRegularization':0,'sourceSamples':N,'constraints':N*4,'radius':radius,'relativeResidual':float(np.linalg.norm(exact)/initial),'maxConstraintValueMM':float(np.max(np.abs(position_residual))*1000),'maxConstraintGradientError':float(np.max(np.linalg.norm(gradient_residual,axis=1))),'seconds':time.monotonic()-start,'betweenSampleSurfacesCertified':False,'layersCertified':False,'firstHitsCertified':False}
out=root/'qa/fidelity-r21/offline/hermite-program.json'
out.write_text(json.dumps({'report':report,'positions':p.ravel().tolist(),'normals':n.ravel().tolist(),'coefficients':x.ravel().tolist()},separators=(',',':')),encoding='utf8')
(root/'qa/fidelity-r21/hermite-fit.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
