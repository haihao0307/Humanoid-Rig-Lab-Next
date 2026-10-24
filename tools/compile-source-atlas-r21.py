"""Offline source-to-piecewise-affine function atlas research.

This is NOT an autonomous mother or a completed parametric conversion. It
retains source facet partition information as an analytic decision program.
No source vertex table, triangle indices, polygon buffers, or display mesh
are emitted. Multiple projected layers remain distinct function branches.
"""
import json, math, time, sys, hashlib
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent.parent
source=root/'qa/fidelity-r21/offline/original.json'
data=json.loads(source.read_text(encoding='utf8'))
profile=sys.argv[2] if len(sys.argv)>2 else 'baseline'
if profile!='baseline':
    case_path=root/('qa/fidelity-r21/offline/case-'+profile+'.json')
    data.update(json.loads(case_path.read_text(encoding='utf8')))
p=np.array(data['positionsYUp']).reshape(-1,3);normal=np.array(data['normalsYUp']).reshape(-1,3)
faces=np.array(data['faces']).reshape(-1,3)
nodes=[];functions=[];leaf_functions=[];evidence=[];chart_roots=[];rects=[];counts=[]
start=time.monotonic();maximum_depth=0;maximum_layers=0;unresolved=[]
EPS=2e-14  # arithmetic classification, never a source acceptance tolerance
def signed_area(poly):return sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))/2
def line(a,b):
    dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
    return (-dy/length,dx/length,(dy*a[0]-dx*a[1])/length)
def distances(poly,l):return [l[0]*a[0]+l[1]*a[1]+l[2] for a in poly]
def split(poly,l):
    ds=distances(poly,l);positive=[];negative=[]
    for i,a in enumerate(poly):
        b=poly[(i+1)%len(poly)];da=ds[i];db=ds[(i+1)%len(poly)]
        if da>=-EPS:positive.append(a)
        if da<=EPS:negative.append(a)
        if (da>EPS and db<-EPS) or (da<-EPS and db>EPS):
            t=da/(da-db);q=(a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]));positive.append(q);negative.append(q)
    def clean(q):
        out=[]
        for a in q:
            if not out or a!=out[-1]:out.append(a)
        if len(out)>1 and out[0]==out[-1]:out.pop()
        return out
    return clean(positive),clean(negative)
def contains(cell,poly):return all(min(distances(cell,line(poly[i],poly[(i+1)%len(poly)])))>=-EPS for i in range(len(poly)) if poly[i]!=poly[(i+1)%len(poly)])
def node_leaf(ids,depth):
    global maximum_depth,maximum_layers
    maximum_depth=max(maximum_depth,depth);maximum_layers=max(maximum_layers,len(ids))
    index=len(nodes);offset=len(leaf_functions);leaf_functions.extend(ids);nodes.append([0,0,0,1,0,0,offset,len(ids)]);return index
def build(polys,cell,depth=0):
    global maximum_depth
    if not polys:return node_leaf([],depth)
    partial=[item for item in polys if not contains(cell,item[0])]
    if not partial:return node_leaf(sorted(set(i for _,i in polys)),depth)
    if depth>=80:
        unresolved.append({'reason':'depth limit','depth':depth,'polygons':len(polys)});return node_leaf([],depth)
    candidates=[]
    sample=[partial[min(len(partial)-1,int(k*len(partial)/min(16,len(partial))))] for k in range(min(16,len(partial)))]
    centres=[(sum(a[0] for a in q)/len(q),sum(a[1] for a in q)/len(q)) for q,_ in polys]
    for poly,_ in sample:
        for i,a in enumerate(poly):
            b=poly[(i+1)%len(poly)]
            if a==b:continue
            l=line(a,b);cd=distances(cell,l)
            if min(cd)>=-EPS or max(cd)<=EPS:continue
            positives=sum(l[0]*c[0]+l[1]*c[1]+l[2]>=0 for c in centres)
            score=abs(positives-len(polys)/2)
            candidates.append((score,l))
    if not candidates:
        unresolved.append({'reason':'arithmetic cell classification','depth':depth,'polygons':len(polys)});return node_leaf([],depth)
    _,chosen=min(candidates,key=lambda v:v[0]);cp,cn=split(cell,chosen)
    if len(cp)<3 or len(cn)<3:
        unresolved.append({'reason':'degenerate split','depth':depth});return node_leaf([],depth)
    positive=[];negative=[]
    for poly,i in polys:
        ds=distances(poly,chosen)
        if min(ds)>=-EPS:positive.append((poly,i))
        elif max(ds)<=EPS:negative.append((poly,i))
        else:
            pp,pn=split(poly,chosen)
            if len(pp)>=3:positive.append((pp,i))
            if len(pn)>=3:negative.append((pn,i))
    index=len(nodes);nodes.append(None)
    left=build(positive,cp,depth+1);right=build(negative,cn,depth+1)
    nodes[index]=[*chosen,0,left,right,0,0]
    return index

mode=sys.argv[1] if len(sys.argv)>1 else 'torso'
by_chart=[[] for _ in range(6)]
for face_id,ids in enumerate(faces):
    points=p[ids];gn=np.cross(points[1]-points[0],points[2]-points[0]);axis=int(np.argmax(np.abs(gn)))
    if np.linalg.norm(gn)==0:continue
    if mode=='torso':
        bones=[data['dominantBones'][int(i)] for i in ids]
        if not all(any(s in b for s in ('spine','pelvis','root','breast')) for b in bones):continue
        if not (np.min(points[:,1])>-.38 and np.max(points[:,1])<.50):continue
        if not (axis==2 and gn[2]>0):continue
    u=(axis+1)%3;v=(axis+2)%3;uv=points[:,[u,v]];design=np.column_stack((uv,np.ones(3)))
    try:
        coeff=np.linalg.solve(design,points[:,axis]);nc=np.linalg.solve(design,normal[ids])
    except np.linalg.LinAlgError:
        unresolved.append({'reason':'singular original projection','sourceFace':face_id});continue
    poly=[tuple(a) for a in uv]
    if signed_area(poly)<0:poly.reverse()
    function_id=len(functions);functions.append([*coeff,*nc.T.ravel()]);evidence.append(face_id)
    chart=axis*2+(0 if gn[axis]>0 else 1);by_chart[chart].append((poly,function_id))
for chart,polys in enumerate(by_chart):
    if not polys:chart_roots.append(-1);rects.append([0,0,0,0]);counts.append(0);continue
    uv=[a for q,_ in polys for a in q];lo=[min(a[k] for a in uv) for k in (0,1)];hi=[max(a[k] for a in uv) for k in (0,1)]
    cell=[(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]
    before=len(nodes);chart_roots.append(build(polys,cell));rects.append([lo[0],hi[0],lo[1],hi[1]]);counts.append(len(nodes)-before)
    print(json.dumps({'chart':chart,'functions':len(polys),'decisionNodes':counts[-1],'seconds':time.monotonic()-start,'unresolved':len(unresolved)}),flush=True)
report={'schema':'source-affine-atlas-research/1','mode':mode,'profile':profile,'sourceMaterialSide':0,'sourceReferenceSHA256':data['referenceSHA256'],'offlineReferenceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceDerivedCalibration':True,'sourceFacetPartitionInformationRetained':True,'completedMotherConversion':False,'autonomousMother':False,'parameterVariationImplemented':False,'sourceFidelityAccepted':False,'acceptanceTolerance':None,'sourceTrianglesInOfflineReference':len(faces),'functions':len(functions),'decisionNodes':len(nodes),'maxDepth':maximum_depth,'maxProjectedLayers':maximum_layers,'unresolved':unresolved,'seconds':time.monotonic()-start,'runtimeVertices':0,'runtimeTriangleIndices':0,'runtimePolygonBuffers':0}
program={'report':report,'bounds':[[float(np.min(p[:,k])),float(np.max(p[:,k]))] for k in range(3)],'chartRoots':chart_roots,'chartRects':rects,'nodes':nodes,'functions':functions,'leafFunctions':leaf_functions}
suffix=mode+('-'+profile if profile!='baseline' else '')
out=root/('qa/fidelity-r21/offline/atlas-'+suffix+'.json');out.write_text(json.dumps(program,separators=(',',':')),encoding='utf8')
(root/('qa/fidelity-r21/atlas-'+suffix+'-compile.json')).write_text(json.dumps(report,indent=2),encoding='utf8')
(root/('qa/fidelity-r21/offline/atlas-'+suffix+'-evidence.json')).write_text(json.dumps(evidence),encoding='utf8')
print(json.dumps(report),flush=True)
