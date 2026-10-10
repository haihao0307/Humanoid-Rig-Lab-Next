"""Extract ORIGINAL cached CAD geometry, curve samples and typed GH records.
No new shoe silhouette, deformed output or purported sewing solution is invented here.
GPL-3.0 study of the supplied SymbioticShoes project; source files remain the authority.
"""
from pathlib import Path
import os, json, hashlib, math, uuid, struct, re, zlib
import numpy as np
import rhino3dm as r
from shapely.geometry import Polygon
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1]
SRC=Path(os.environ.get('SHOE_TEACHER',str(ROOT.parent/'intake/teacher')))
SHA='69e98e7f2e576cea09ef0bcb117b52d4f1cdabb6'
def sha(b): return hashlib.sha256(b).hexdigest()
def xyz(p): return [p.X,p.Y,p.Z]
def sample(c,tol=.015):
    # Closed curves MUST NOT use coincident start/end as one accepted chord.
    # Start with 64 intervals and inspect all quarter points on every interval.
    def point(t):return np.array(xyz(c.PointAt(t)))
    def rec(a,b,pa,pb,depth=0):
        ts=[a+(b-a)*s for s in [.25,.5,.75]]; ps=[point(t) for t in ts]
        dv=pb-pa; ll=float(dv@dv)
        err=max(float(np.linalg.norm(p-(pa+np.clip((p-pa)@dv/max(ll,1e-30),0,1)*dv))) for p in ps)
        if (err<=tol and ll<=9) or depth==16:return [pa.tolist()]
        return rec(a,ts[1],pa,ps[1],depth+1)+rec(ts[1],b,ps[1],pb,depth+1)
    a,b=c.Domain.T0,c.Domain.T1;out=[]
    for i in range(64):
        x=a+(b-a)*i/64;y=a+(b-a)*(i+1)/64
        out+=rec(x,y,point(x),point(y))
    out.append(point(b).tolist())
    return out

def mesh(model,index):
    obj=model.Objects[index];g=obj.Geometry;pos=[];norm=[];idx=[];parts=[]
    meshes=[(i,f.GetMesh(r.MeshType.Any)) for i,f in enumerate(g.Faces)] if isinstance(g,r.Brep) else [(0,g)]
    for i,m in meshes:
        if m is None:raise ValueError('Missing native cached mesh '+str(index))
        off=len(pos)//3;start=len(idx)
        pos.extend(v for p in m.Vertices for v in xyz(p))
        if len(m.Normals)==len(m.Vertices):norm.extend(v for p in m.Normals for v in xyz(p))
        else:norm=[]
        for f in m.Faces:
            a,b,c,d=map(int,f);idx.extend([off+a,off+b,off+c])
            if c!=d:idx.extend([off+a,off+c,off+d])
        parts.append({'sourceFace':i,'indexStart':start,'indexCount':len(idx)-start})
    v=np.array(pos,dtype='<f8').reshape(-1,3)
    return {'objectIndex':index,'id':str(obj.Attributes.Id),'layer':model.Layers[obj.Attributes.LayerIndex].Name,'name':obj.Attributes.Name,'positions':pos,'normals':norm if len(norm)==len(pos) else None,'indices':idx,'faceRanges':parts,'bbox':[v.min(0).tolist(),v.max(0).tolist()],'positionsSha256':sha(v.tobytes()),'indicesSha256':sha(np.array(idx,dtype='<u4').tobytes())}

def footprints(obj):
    v=np.array(obj['positions']).reshape(-1,3);tri=np.array(obj['indices']).reshape(-1,3)
    ps=[Polygon(v[t,:2]) for t in tri];u=unary_union([p for p in ps if p.area>1e-7]).buffer(0)
    gs=[u] if u.geom_type=='Polygon' else list(u.geoms)
    return [{'outer':list(map(list,p.exterior.coords)),'holes':[list(map(list,h.coords)) for h in p.interiors if Polygon(h).area>1e-6],'ignoredProjectionSlivers':sum(Polygon(h).area<=1e-6 for h in p.interiors),'projectionAreaFloorMm2':1e-6,'areaMm2':p.area} for p in gs if p.area>.01]

model=r.File3dm.Read(str(SRC/'Parametric shoe last.3dm'))
if str(model.Settings.ModelUnitSystem)!='UnitSystem.Millimeters':raise ValueError('Source unit mismatch')
last=mesh(model,32);base=mesh(model,1)
curves=[]
for i in [29,30,31]:
    obj=model.Objects[i];pts=sample(obj.Geometry);a=np.array(pts)
    curves.append({'objectIndex':i,'id':str(obj.Attributes.Id),'closed':bool(obj.Geometry.IsClosed),'points':pts,'lengthMm':float(np.linalg.norm(np.diff(a,axis=0),axis=1).sum()),'nominalChordToleranceMm':.015})
# Exact GH Curve input references resolved by RefID to objects 10/7/11/12/8,
# and Curve node94 references edge0 of Brep14. This is not a guessed association.
labels=[(10,'toe','Toe box / 鞋头',3,None),(7,'ball','Ball / 前掌',22,None),(11,'waist','Waist / 腰围',40,None),(12,'instep','Instep / 跗围',58,None),(8,'ankle','Ankle / 上口',76,None),(14,'sole','Sole / 水平周线',94,0)]
sections=[]
for i,key,cn,node,edge in labels:
    obj=model.Objects[i];c=obj.Geometry if edge is None else obj.Geometry.Edges[edge]
    pts=sample(c);p=np.array(pts);L=float(np.linalg.norm(np.diff(p,axis=0),axis=1).sum())
    assert c.IsClosed and L>50 and np.linalg.norm(p[0]-p[-1])<1e-5
    sections.append({'objectIndex':i,'edgeIndex':edge,'ghNodeIndex':node,'id':str(obj.Attributes.Id),'key':key,'label':cn,'semanticStatus':'RESOLVED_GH_REFID','closed':True,'lengthMm':L,'points':pts,'nominalChordToleranceMm':.015})
panels=[]
for i in [22,23,28,24,25,27,19,20,21]:
    obj=mesh(model,i);obj['footprints']=footprints(obj);obj['roleStatus']='SOURCE_LAYER_ONLY; exact seam pairing is UNKNOWN';panels.append(obj)
# Extract only well-typed top-level node inventory from GH, do not claim a complete executor.
gh=(SRC/'Parametric deformation of shoe last.gh').read_bytes();raw=None
for offset in range(80):
    try:
        b=zlib.decompress(gh[offset:],-15)
        if b.startswith(b'\x04Root'):raw=b;break
    except zlib.error:pass
if raw is None:raise ValueError('Cannot decode original GH archive')
pat=re.compile(b'\x06Object(.{4})\x02\x00\x00\x00\x01\x00\x00\x00\x04GUID',re.S)
starts=[(m.start(),struct.unpack('<i',m.group(1))[0]) for m in pat.finditer(raw)]
def text(block,name):
    token=bytes([len(name)])+name.encode()+b'\xff'*4+struct.pack('<i',10);at=block.find(token)
    if at<0:return None
    p=at+len(token);n=0;s=0
    for j in range(5):
        v=block[p];p+=1;n|=(v&127)<<s
        if not v&128:break
        s+=7
    return block[p:p+n].decode('utf8',errors='replace')
def number(block,name):
    t=bytes([len(name)])+name.encode()+b'\xff'*4+struct.pack('<i',6);at=block.find(t)
    return None if at<0 else struct.unpack('<d',block[at+len(t):at+len(t)+8])[0]
ids={str(o.Attributes.Id) for o in model.Objects};nodes=[];refs=[];sliders=[]
for j,(at,index) in enumerate(starts):
    block=raw[at:starts[j+1][0] if j+1<len(starts) else len(raw)]
    name=text(block,'Name');nick=text(block,'NickName')
    row={'index':index,'name':name,'nickname':nick}
    tt=b'\x05RefID'+b'\xff'*4+struct.pack('<i',9)
    rids=[]
    for mm in re.finditer(re.escape(tt),block):
        p=mm.end();rid=str(uuid.UUID(bytes_le=block[p:p+16]));rids.append(rid);refs.append({'nodeIndex':index,'name':name,'refId':rid,'foundInSupplied3dm':rid in ids,'sourceObjectIndex':next((i for i,o in enumerate(model.Objects) if str(o.Attributes.Id)==rid),None)})
    if rids:row['externalRefs']=rids
    if name=='Number Slider':
        row.update({k:number(block,n) for k,n in [('minimum','Min'),('maximum','Max'),('value','Value')]});sliders.append(row.copy())
    if (v:=text(block,'UserText')) is not None:row['text']=v
    nodes.append(row)
audit={'schema':'kaopu-gh-source-inventory/1','readLevel':'TYPED_RECORD_INVENTORY_NOT_EXECUTED','topLevelObjectRecords':len(nodes),'sliderRecords':len(sliders),'externalReferences':refs,'missingReferenceCount':sum(not v['foundInSupplied3dm'] for v in refs),'selectedSourceInputs':[s for s in sliders if s['nickname'] in ['Toe box','Ball','Waist','Instep','Ankle','Sole']][:6],'falloffExpressions':sorted(set(n['text'] for n in nodes if n.get('text') and '1/x' in n['text'])),'nodes':nodes,'scope':'No Rhino/Grasshopper engine execution. Existing RefIDs audited against supplied 3dm. Runtime edits below are independent, NOT 1:1 Grasshopper output.'}
result={'schema':'kaopu-shoe-teacher-cad/2','version':'R02-S1','author':'Sara Alvarez Vinagre','repo':'saraalvin/SymbioticShoes','sourceCommit':SHA,'units':'mm','representation':'unaltered native cached mesh vertices + sampled native curves','originalPipeline':'trace on last -> extract flat pieces -> assemble TPE on last','patternLinkStatus':'UNKNOWN: original flat panels have no verified source-to-surface/seam correspondence','ghExecutionStatus':'NOT_EXECUTED_NATIVE_ENGINE','last':last,'baseLast':base,'styleCurves':curves,'sections':sections,'panels':panels,'sourceAudit':{k:v for k,v in audit.items() if k!='nodes'},'files':[]}
for f in ['Parametric shoe last.3dm','Parametric deformation of shoe last.gh','ClassicDerby_EU39.3dm','LICENSE']:
    p=SRC/f;b=p.read_bytes();result['files'].append({'name':f,'bytes':len(b),'sha256':sha(b)})
(ROOT/'assets').mkdir(exist_ok=True)
(ROOT/'assets/teacher.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
(ROOT/'assets/GH-SOURCE-AUDIT.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
print(json.dumps({'meshVertices':len(base['positions'])//3,'meshTriangles':len(base['indices'])//3,'curveLengths':[(c['objectIndex'],c['lengthMm']) for c in sections],'patterns':len(panels),'ghMissingRefs':audit['missingReferenceCount'],'bytes':(ROOT/'assets/teacher.json').stat().st_size},indent=2))
