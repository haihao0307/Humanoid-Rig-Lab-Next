"""Isolated source-data interpolation research, never an acceptance shortcut.

Compact Wendland C2 Hermite interpolation enforces source positions AND normals.
No smoothing term, guessed anatomy, simplification or polygon input is used.
The resulting function still needs original-surface and first-hit acceptance.
Method: Macedo, Gois, Velho, Hermite Interpolation of Implicit Surfaces with RBF.
https://citeseerx.ist.psu.edu/document?doi=f010b581c618dd5c3d9af27d5dbf8d0c201ac965&repid=rep1&type=pdf
"""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
import json, math, time, hashlib, sys
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parent.parent
source=root/'qa/fidelity-r21/offline/original.json'
target=json.loads(source.read_text(encoding='utf8'))
p=np.array(target['positionsYUp'],dtype=np.float64).reshape(-1,3)
n=np.array(target['normalsYUp'],dtype=np.float64).reshape(-1,3)
n/=np.linalg.norm(n,axis=1)[:,None]
radius=float(sys.argv[1]) if len(sys.argv)>1 else .025
N=len(p); start=time.monotonic(); grid={}
for i,c in enumerate(np.floor(p/radius).astype(int)):
    grid.setdefault(tuple(c),[]).append(i)
rows=[]; cols=[]; blocks=[]; plane=np.zeros(N); plane_grad=np.zeros((N,3)); mass=np.zeros(N)
sqrt20=math.sqrt(20)
for i in range(N):
    c=np.floor(p[i]/radius).astype(int)
    ids=np.array([j for dz in (-1,0,1) for dy in (-1,0,1) for dx in (-1,0,1) for j in grid.get(tuple(c+[dx,dy,dz]),[])],dtype=np.int32)
    d=(p[i]-p[ids])/radius; r=np.linalg.norm(d,axis=1); keep=r<1
    ids=ids[keep];d=d[keep];r=r[keep]
    if np.any((r<1e-12)&(ids!=i)):
        raise ValueError('Coincident source samples require separate sheets; do not merge them: '+str(i))
    t=1-r; phi=t**4*(4*r+1)
    A=np.zeros((len(ids),4,4));A[:,0,0]=phi
    off=sqrt20*t[:,None]**3*d
    A[:,0,1:]=off;A[:,1:,0]=-off
    A[:,1:,1:]=t[:,None,None]**3*np.eye(3)[None,:,:]
    safe=np.maximum(r,1e-30)
    A[:,1:,1:]-=3*t[:,None,None]**2*d[:,:,None]*d[:,None,:]/safe[:,None,None]
    rows.append(np.full(len(ids),i,dtype=np.int32));cols.append(ids);blocks.append(A)
    dot=np.sum(n[ids]*d,axis=1)*radius
    plane[i]=np.sum(phi*dot);mass[i]=np.sum(phi)
    plane_grad[i]=np.sum(phi[:,None]*n[ids]-20/radius*t[:,None]**3*d*dot[:,None],axis=0)
row=np.concatenate(rows);col=np.concatenate(cols);A=np.concatenate(blocks);del rows,cols,blocks
rhs=np.column_stack((-plane,(mass[:,None]*n-plane_grad)*radius/sqrt20))
def product(x):
    terms=np.einsum('eij,ej->ei',A,x[col],optimize=False)
    return np.column_stack([np.bincount(row,weights=terms[:,k],minlength=N) for k in range(4)])
print(json.dumps({'samples':N,'supportRadius':radius,'blocks':len(row),'matrixMB':A.nbytes/1e6,'setupSeconds':time.monotonic()-start}),flush=True)

# Spatial block Jacobi changes the solver, not the interpolation equations.
order=np.lexsort(tuple(np.floor(p/.008).astype(int).T))
G=16;groups=[order[k:k+G] for k in range(0,N,G)]
inverse=[]; maps=[{} for _ in groups]
for gi,ids in enumerate(groups):
    for slot,j in enumerate(ids): maps[gi][int(j)]=slot
group_id=np.empty(N,dtype=np.int32)
for gi,ids in enumerate(groups):group_id[ids]=gi
matrices=[np.zeros((len(ids)*4,len(ids)*4)) for ids in groups]
for e,(i,j) in enumerate(zip(row,col)):
    gi=group_id[i]
    if group_id[j]!=gi:continue
    a=maps[gi][int(i)]*4;b=maps[gi][int(j)]*4
    matrices[gi][a:a+4,b:b+4]=A[e]
for mat in matrices:inverse.append(np.linalg.inv(mat))
padding=G*4
inv=np.zeros((len(groups),padding,padding));ids_pad=np.zeros((len(groups),G),dtype=np.int32);valid=np.zeros((len(groups),G))
for gi,ids in enumerate(groups):inv[gi,:len(ids)*4,:len(ids)*4]=inverse[gi];ids_pad[gi,:len(ids)]=ids;valid[gi,:len(ids)]=1
def precondition(v):
    gathered=(v[ids_pad]*valid[:,:,None]).reshape(len(groups),padding)
    solved=np.einsum('gij,gj->gi',inv,gathered,optimize=False).reshape(len(groups),G,4)
    out=np.zeros_like(v)
    for gi,ids in enumerate(groups):out[ids]=solved[gi,:len(ids)]
    return out
x=np.zeros_like(rhs);res=rhs.copy();z=precondition(res);direction=z.copy();rz=np.sum(res*z);initial=float(np.linalg.norm(rhs));iterations=0
for iterations in range(1,2001):
    y=product(direction);den=np.sum(direction*y)
    if not den>0:raise ArithmeticError('Hermite Gram system lost positive definiteness; do not regularize silently')
    alpha=rz/den;x+=alpha*direction;res-=alpha*y
    if iterations%25==0:
        exact=rhs-product(x);err=float(np.linalg.norm(exact)/initial)
        print(json.dumps({'iteration':iterations,'relativeResidual':err,'seconds':time.monotonic()-start}),flush=True)
        if err<1e-10:res=exact;break
    if time.monotonic()-start>600:break
    z=precondition(res);next_rz=np.sum(res*z);direction=z+(next_rz/rz)*direction;rz=next_rz
exact=product(x)-rhs
position_residual=exact[:,0]/mass
gradient_residual=exact[:,1:]*sqrt20/radius/mass[:,None]
norm_error=np.linalg.norm(gradient_residual,axis=1)
report={'schema':'body-source-hermite-research/1','sourceReferenceSHA256':target['referenceSHA256'],'offlineReferenceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceDerivedCalibration':True,'independentWholeBody':False,'sourceFidelityAccepted':False,'intentionalShapeChanges':False,'smoothingRegularization':0,'sourceSamples':N,'constraints':N*4,'radius':radius,'iterations':iterations,'relativeResidual':float(np.linalg.norm(exact)/initial),'maxConstraintValueMM':float(np.max(np.abs(position_residual))*1000),'maxConstraintGradientError':float(np.max(norm_error)),'seconds':time.monotonic()-start,'betweenSampleSurfacesCertified':False,'layersCertified':False,'firstHitsCertified':False}
out=root/'qa/fidelity-r21/offline/hermite-program.json'
out.write_text(json.dumps({'report':report,'positions':p.ravel().tolist(),'normals':n.ravel().tolist(),'coefficients':x.ravel().tolist()},separators=(',',':')),encoding='utf8')
(root/'qa/fidelity-r21/hermite-fit.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
