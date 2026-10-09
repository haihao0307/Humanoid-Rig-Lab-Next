"""Extract a template prior, not subject ground truth or neural reconstruction.
Requires numpy and scipy. Usage: python extract_reference.py base.obj output.json
Input is pinned MakeHuman hm08 CC0; thresholds belong only to this template.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import label


def extract(source: Path) -> dict:
    raw = source.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    expected = '8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c'
    if digest != expected:
        raise ValueError('This calibration requires the pinned CC0 hm08 base mesh')
    vertices, faces, group = [], [], ''
    for line in raw.decode('utf-8').splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == 'v':
            vertices.append(list(map(float, parts[1:4])))
        elif parts[0] == 'g':
            group = parts[1]
        elif parts[0] == 'f' and group == 'body':
            q = [int(v.split('/')[0]) - 1 for v in parts[1:]]
            faces.extend((q[0], q[i], q[i+1]) for i in range(1, len(q)-1))
    triangles = np.asarray(vertices)[np.asarray(faces)]
    p = triangles
    p = p[(p[:,:,0].max(1)>.08)&(p[:,:,0].min(1)<.60)&(p[:,:,1].max(1)>7.10)&(p[:,:,1].min(1)<7.5)&(p[:,:,2].max(1)>.6)]
    xs, ys = np.linspace(.08,.60,521), np.linspace(7.1,7.5,401)
    depth = np.full((len(ys),len(xs)), -100.)
    for a,b,c in p:
        den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-12:
            continue
        ix=np.flatnonzero((xs>=min(a[0],b[0],c[0]))&(xs<=max(a[0],b[0],c[0])))
        iy=np.flatnonzero((ys>=min(a[1],b[1],c[1]))&(ys<=max(a[1],b[1],c[1])))
        if not len(ix) or not len(iy):
            continue
        x,y=np.meshgrid(xs[ix],ys[iy])
        u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
        v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
        w=1-u-v
        z=np.where((u>=-1e-6)&(v>=-1e-6)&(w>=-1e-6),u*a[2]+v*b[2]+w*c[2],-100)
        depth[np.ix_(iy,ix)] = np.maximum(depth[np.ix_(iy,ix)],z)
    components,_=label((depth>1.)&(depth<1.30)&((ys>7.23)&(ys<7.36))[:,None])
    seed=components[np.argmin(abs(ys-7.29)),np.argmin(abs(xs-.315))]
    if seed == 0:
        raise ValueError('Template eye pocket not found')
    mask=components==seed
    rows=np.array([[x,ys[mask[:,i]].min(),ys[mask[:,i]].max()] for i,x in enumerate(xs) if mask[:,i].sum()>2])
    half=(rows[-1,0]-rows[0,0])/2
    mx=(rows[-1,0]+rows[0,0])/2
    my=(rows[0,1:].mean()+rows[-1,1:].mean())/2
    lower=PchipInterpolator(rows[:,0],rows[:,1]);upper=PchipInterpolator(rows[:,0],rows[:,2])
    rails=[[round(float(t),6),round(float((upper(mx+t*half)-my)/half),6),round(float((lower(mx+t*half)-my)/half),6)] for t in np.linspace(-1,1,33)]
    for k in (0,-1):
        rails[k][1]=rails[k][2]=(rails[k][1]+rails[k][2])/2
    return {'schema':'kaopu/ocular-reference-rails@1','source':'MakeHuman CC0 hm08 base.obj','sourceSHA256':digest,'sourceCommit':'a8bc2d54ff0ac92e78ff71431b1023eda42bf482','sourceHalfWidth':half,'sourceCenter':[mx,my],'derivation':'front-view eye-pocket depth contour; template prior, not Lee measurements','rails':rails}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python extract_reference.py base.obj output.json')
    result=extract(Path(sys.argv[1]))
    Path(sys.argv[2]).write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'sourceSHA256':result['sourceSHA256'],'samples':len(result['rails'])}))
