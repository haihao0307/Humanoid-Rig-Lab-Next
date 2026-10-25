"""Exact rational original first hits for selected directed boundary diagnostics.

The original triangles are an offline oracle only. No connectivity is emitted.
This triages logged examples, not the entire continuous ray domain.
"""
from pathlib import Path
from fractions import Fraction as F
import json,hashlib,time,sys
import numpy as np
root=Path(__file__).resolve().parents[3];started=time.monotonic()
report_file=root/(sys.argv[1] if len(sys.argv)>1 else 'qa/fidelity-r24/source-boundary-rays.json')
diagnostic=json.loads(report_file.read_text(encoding='utf8'))
original=json.loads((root/'qa/fidelity-r21/offline/original.json').read_text(encoding='utf8'))
faces=np.array(original['faces']).reshape(-1,3)
fraction=lambda x:F.from_float(float(x))
sub=lambda a,b:[x-y for x,y in zip(a,b)]
cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
q={'scope':__doc__.strip(),'startedUTC':time.time(),'inputSHA256':hashlib.sha256(report_file.read_bytes()).hexdigest(),'sourceFidelityAccepted':False,'visualAccepted':False,'acceptanceTolerance':None,'profiles':[]}
for profile in diagnostic['profiles']:
 id=profile['id'];case_file=root/('qa/fidelity-r24/offline/case-calibration-soft.json' if id=='calibration-soft' else 'qa/fidelity-r21/offline/case-'+id+'.json')
 case=json.loads(case_file.read_text(encoding='utf8'));p=np.array(case['positionsYUp']).reshape(-1,3);points=[list(map(fraction,row)) for row in p]
 mins=np.min(p[faces],axis=1);maxs=np.max(p[faces],axis=1);centres=(mins+maxs)*.5
 def build(ids):
  lo=mins[ids].min(axis=0);hi=maxs[ids].max(axis=0);node={'lo':list(map(fraction,lo)),'hi':list(map(fraction,hi))}
  if len(ids)<=8:node['ids']=ids.tolist()
  else:
   axis=int(np.argmax(hi-lo));order=ids[np.argsort(centres[ids,axis],kind='stable')];middle=len(order)//2
   node['children']=[build(order[:middle]),build(order[middle:])]
  return node
 tree=build(np.arange(len(faces)))
 def ray(origin,direction):
  best=None;hits=[];stack=[tree]
  while stack:
   node=stack.pop();lo=F(0);hi=best;outside=False
   for k in range(3):
    if not direction[k]:
     if origin[k]<node['lo'][k] or origin[k]>node['hi'][k]:outside=True;break
     continue
    a=(node['lo'][k]-origin[k])/direction[k];b=(node['hi'][k]-origin[k])/direction[k]
    if a>b:a,b=b,a
    lo=max(lo,a);hi=b if hi is None else min(hi,b)
    if hi<lo:outside=True;break
   if outside:continue
   if 'children'in node:stack.extend(node['children']);continue
   for face in node['ids']:
    a,b,c=[points[i] for i in faces[face]];e1=sub(b,a);e2=sub(c,a);h=cross(direction,e2);det=dot(e1,h)
    if det<=0:continue
    s=sub(origin,a);u=dot(s,h)
    if u<0 or u>det:continue
    v=dot(direction,cross(s,e1))
    if v<0 or u+v>det:continue
    t=dot(e2,cross(s,e1))/det
    if t<=0 or best is not None and t>best:continue
    if best is None or t<best:best=t;hits=[face]
    elif t==best:hits.append(face)
  return best,sorted(hits)
 mapping=json.loads((root/('qa/fidelity-r24/offline/proof-atlas-full'+(''if id=='baseline' else '-'+id)+'-evidence.json')).read_text(encoding='utf8'))
 record={'id':id,'offlineCaseSHA256':hashlib.sha256(case_file.read_bytes()).hexdigest(),'cases':[]}
 for category,items in [('coverage',profile['examples']),('distance',profile['worst'])]:
  for item in items:
   t,hits=ray(list(map(fraction,item['origin'])),list(map(fraction,item['direction'])))
   out={'category':category,'kind':item['kind'],'sourceId':item['sourceId'],'slant':item['slant'],'origin':item['origin'],'direction':item['direction'],'exactOriginalHit':t is not None,'exactOriginalDistance':float(t) if t is not None else None,'exactFirstSourceCells':hits,'exactDistanceRational':{'numerator':str(t.numerator),'denominator':str(t.denominator)} if t is not None else None}
   for name in ['candidate','original']:
    candidate=item[name];out[name]={'hit':candidate is not None,'coverageMatchesExact':bool(candidate)==(t is not None),'distanceErrorMetres':float(abs(fraction(candidate['t'])-t)) if candidate and t is not None else None,'selectedSourceCellIsExactFirst':(mapping[candidate['field']] if name=='candidate' else candidate['face']) in hits if candidate and hits else False}
   record['cases'].append(out)
 record['candidateCoverageDisagreementsWithExact']=sum(not c['candidate']['coverageMatchesExact'] for c in record['cases']);record['floatOracleCoverageDisagreementsWithExact']=sum(not c['original']['coverageMatchesExact'] for c in record['cases'])
 record['candidateWrongSourceCell']=sum(c['candidate']['hit'] and c['exactOriginalHit'] and not c['candidate']['selectedSourceCellIsExactFirst'] for c in record['cases'])
 q['profiles'].append(record);print(json.dumps({k:v for k,v in record.items() if k not in ['cases']}),flush=True)
q.update({'diagnosticCompleted':True,'seconds':time.monotonic()-started,'toolSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'method':'Exact rational slab bounds and determinant/barycentric comparisons for every visited original cell; no geometric epsilon; all exact first-distance ties retained','notAFullBoundaryAudit':True})
(root/(sys.argv[2] if len(sys.argv)>2 else 'qa/fidelity-r24/source-boundary-rational-triage.json')).write_text(json.dumps(q,indent=2)+'\n',encoding='utf8')
