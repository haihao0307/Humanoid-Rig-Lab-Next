"""Source position interpolation; keep source shading directions separate.

No Tikhonov smoothing, coefficient clipping, estimated anatomy or polygons in
the fitted function. Position interpolation is not full-surface acceptance.
"""
import os
os.environ['OPENBLAS_NUM_THREADS']='8'
import sys,time,json,math,hashlib
from pathlib import Path
import numpy as np
here=Path(__file__).resolve().parent
sys.argv=[sys.argv[0],'.05']
prefix=(here/'fit-hermite-r21.py').read_text(encoding='utf8').split('# Spatial block Jacobi')[0]
prefix=prefix.replace("os.environ['OPENBLAS_NUM_THREADS']='1'","os.environ['OPENBLAS_NUM_THREADS']='8'")
exec(compile(prefix,str(here/'fit-hermite-r21.py'),'exec'))
D=np.zeros((N,N),dtype=np.float64);D[row,col]=A[:,0,0];del A
b=-plane
print(json.dumps({'phase':'source position factorization','equations':N,'matrixBytes':D.nbytes}),flush=True)
L=np.linalg.cholesky(D);del D
LT=L.T.copy()
def solve(b):
    y=np.empty(N);x=np.empty(N)
    for i in range(N):y[i]=(b[i]-np.dot(L[i,:i],y[:i]))/L[i,i]
    for i in range(N-1,-1,-1):x[i]=(y[i]-np.dot(LT[i,i+1:],x[i+1:]))/LT[i,i]
    return x
x=solve(b)
# Independently rebuild original scalar rows for residuals (not L L^T).
K=np.zeros(len(row))
d=(p[row]-p[col])/radius;r=np.linalg.norm(d,axis=1);t=1-r;K=t**4*(4*r+1)
def multiply(x):return np.bincount(row,weights=K*x[col],minlength=N)
for step in range(3):
    res=b-multiply(x);relative=float(np.linalg.norm(res)/np.linalg.norm(b))
    print(json.dumps({'phase':'source position residual','step':step,'relativeResidual':relative,'seconds':time.monotonic()-start}),flush=True)
    if relative<1e-11:break
    x+=solve(res)
report={'schema':'body-source-position-function/1','solver':'original unregularized scalar interpolation system; Cholesky','sourceReferenceSHA256':target['referenceSHA256'],'offlineReferenceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceDerivedCalibration':True,'independentWholeBody':False,'sourceFidelityAccepted':False,'intentionalShapeChanges':False,'smoothingRegularization':0,'sourceSamples':N,'constraints':N,'radius':radius,'relativeResidual':relative,'maxConstraintValueMM':float(np.max(np.abs(multiply(x)+plane)/mass)*1000),'seconds':time.monotonic()-start,'sourceNormalsSeparate':True,'betweenSampleSurfacesCertified':False,'layersCertified':False,'firstHitsCertified':False}
out=root/'qa/fidelity-r21/offline/source-position-program.json'
out.write_text(json.dumps({'report':report,'positions':p.ravel().tolist(),'normals':n.ravel().tolist(),'offsets':x.tolist()},separators=(',',':')),encoding='utf8')
(root/'qa/fidelity-r21/source-position-fit.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
