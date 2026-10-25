"""Isolated exact source-plane/domain prototype, not selected by the viewer.

Compilation may read offline original faces. The exported function program
contains only analytic plane/domain coefficients, decision links and function
IDs; no original point table or vertex/face connectivity is emitted. It still
retains original facet partition information and is not an autonomous mother.
"""
from pathlib import Path
from fractions import Fraction as F
from math import gcd,lcm
import json,sys,hashlib,time
root=Path(__file__).resolve().parents[3];profile=sys.argv[1] if len(sys.argv)>1 else 'baseline';started=time.monotonic()
source=(root/'tools/compile-source-atlas-r21.py').read_text(encoding='utf8');helper=(root/'tools/research/r24/exact-domain-functions.py').read_text(encoding='utf8')
begin=source.index('def signed_area(');end=source.index('def node_leaf(');source=source[:begin]+helper+'\nexact_lines={}\n'+source[end:]
source=source.replace('EPS=2e-14','EPS=0').replace('centres=[(sum(a[0] for a in q)/len(q),sum(a[1] for a in q)/len(q))','centres=[(sum(a[0]/a[2] for a in q)/len(q),sum(a[1]/a[2] for a in q)/len(q))').replace('nodes[index]=[*chosen,0,left,right,0,0]','nodes[index]=[*line_float(chosen),0,left,right,0,0];exact_lines[index]=tuple(chosen)').replace('poly=[tuple(a) for a in uv]','poly=[point_from_real(a) for a in uv]').replace('lo=[min(a[k] for a in uv) for k in (0,1)];hi=[max(a[k] for a in uv) for k in (0,1)]','lo=[min(a[k]/a[2] for a in uv) for k in (0,1)];hi=[max(a[k]/a[2] for a in uv) for k in (0,1)]').replace('cell=[(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]','cell=[point_from_real(p) for p in [(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]]')
if profile=='calibration-soft':source=source.replace('qa/fidelity-r21/offline/case-','qa/fidelity-r24/offline/case-')
source=source.replace('qa/fidelity-r21/offline/atlas-','qa/fidelity-r24/offline/rational-atlas-').replace('qa/fidelity-r21/atlas-','qa/fidelity-r24/offline/rational-atlas-')
sys.argv=[str(root/'tools/compile-source-atlas-r21.py'),'full',profile];space={'__file__':str(root/'tools/compile-source-atlas-r21.py'),'__name__':'__rational_domain_research__'};exec(compile(source,space['__file__'],'exec'),space)
fraction=lambda x:F.from_float(float(x))
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
planes=[]
for original_cell in space['evidence']:
 ids=space['faces'][original_cell];points=[list(map(fraction,space['p'][i])) for i in ids];a,b,c=points
 normal=cross([b[k]-a[k] for k in range(3)],[c[k]-a[k] for k in range(3)]);values=normal+[-dot(normal,a)];denominator=lcm(*(v.denominator for v in values));integers=[v.numerator*(denominator//v.denominator) for v in values];divisor=gcd(*integers);planes.append([v//divisor for v in integers])
compiled=space['program'];program={'schema':'body-source-rational-functions-research/1','profile':profile,'chartRoots':compiled['chartRoots'],'chartRects':compiled['chartRects'],'bounds':compiled['bounds'],'nodeLinks':[list(map(int,node[3:])) for node in compiled['nodes']],'decisionPlanes':{str(i):list(map(str,line)) for i,line in space['exact_lines'].items()},'functionPlanes':[list(map(str,plane)) for plane in planes],'leafFunctionIds':compiled['leafFunctions'],'characterFaces':0,'sourceFacetPartitionInformationRetained':True,'completedMotherConversion':False,'sourceFidelityAccepted':False,'visualAccepted':False,'selectedByDefault':False}
package_file=root/('qa/fidelity-r24/offline/rational-functions-'+profile+'.json');package_file.write_text(json.dumps(program,separators=(',',':')),encoding='utf8')
links=program['nodeLinks'];leaf=program['leafFunctionIds'];lines=space['exact_lines'];rects=[[fraction(v) for v in r]for r in program['chartRects']];bounds=[[fraction(v)for v in b]for b in program['bounds']]
def function_ray(origin,direction):
 best=None;best_ids=[]
 for chart,root_node in enumerate(program['chartRoots']):
  if root_node<0:continue
  axis=chart//2;u=(axis+1)%3;v=(axis+2)%3;lo=F(0);hi=best;outside=False
  for k,minv,maxv in [(u,rects[chart][0],rects[chart][1]),(v,rects[chart][2],rects[chart][3]),(axis,bounds[axis][0],bounds[axis][1])]:
   if not direction[k]:
    if origin[k]<minv or origin[k]>maxv:outside=True;break
   else:
    a=(minv-origin[k])/direction[k];b=(maxv-origin[k])/direction[k]
    if a>b:a,b=b,a
    lo=max(lo,a);hi=b if hi is None else min(hi,b)
    if hi<lo:outside=True;break
  if outside:continue
  stack=[(root_node,lo,hi)]
  while stack:
   index,a,b=stack.pop()
   if best is not None and a>best:continue
   node=links[index]
   if node[0]==1:
    for at in range(node[3],node[3]+node[4]):
     function=leaf[at];plane=planes[function];rate=dot(plane[:3],direction)
     if rate>=0:continue
     t=-(dot(plane[:3],origin)+plane[3])/rate
     if t<=0 or t<a or b is not None and t>b or best is not None and t>best:continue
     if best is None or t<best:best=t;best_ids=[function]
     elif function not in best_ids:best_ids.append(function)
   else:
    line=lines[index];s=line[0]*origin[u]+line[1]*origin[v]+line[2];rate=line[0]*direction[u]+line[1]*direction[v]
    if not rate:
     if s>=0:stack.append((node[1],a,b))
     if s<=0:stack.append((node[2],a,b))
     continue
    split=-s/rate
    near,far=(node[1],node[2])if rate<0 else(node[2],node[1])
    if split<a:stack.append((far,a,b))
    elif b is not None and split>b:stack.append((near,a,b))
    else:stack.append((far,split,b));stack.append((near,a,split))
 return best,sorted(best_ids)
triage=json.loads((root/'qa/fidelity-r24/source-boundary-rational-triage.json').read_text(encoding='utf8'));reference=next(p for p in triage['profiles']if p['id']==profile);cases=[]
for item in reference['cases']:
 t,ids=function_ray(list(map(fraction,item['origin'])),list(map(fraction,item['direction'])));expected=item['exactDistanceRational'];expected=F(int(expected['numerator']),int(expected['denominator']))if expected else None
 cases.append({'kind':item['kind'],'sourceId':item['sourceId'],'slant':item['slant'],'coverageExactlyMatchesOriginal':(t is None)==(expected is None),'firstDistanceExactlyMatchesOriginal':t==expected,'functionIDs':ids,'functionsRemainSourceDerived':True})
q={'profile':profile,'scope':__doc__.strip(),'sourceFidelityAccepted':False,'visualAccepted':False,'acceptanceTolerance':None,'selectedByDefault':False,'characterFaces':0,'sourceFacetPartitionInformationRetained':True,'completedMotherConversion':False,'exactIntegerDecisionPlanes':len(lines),'exactIntegerFunctionPlanes':len(planes),'functionPackageSHA256':hashlib.sha256(package_file.read_bytes()).hexdigest(),'functionPackageBytes':package_file.stat().st_size,'allOriginalVerticesAndConnectivityAbsent':True,'currentSurfaceCoefficientsNotApproximated':True,'cases':cases,'allLoggedCasesExact':all(c['coverageExactlyMatchesOriginal']and c['firstDistanceExactlyMatchesOriginal']for c in cases),'diagnosticCompleted':True,'continuousRayDomainProven':False,'displayIntegrationComplete':False,'seconds':time.monotonic()-started,'notes':'An exact function-only first-hit kernel for logged boundary cases. Original facet domains are still retained; no rendering, material, visual or autonomous mother acceptance follows.'}
(root/('qa/fidelity-r24/rational-domain-prototype-'+profile+'.json')).write_text(json.dumps(q,indent=2)+'\n',encoding='utf8');print(json.dumps({k:q[k]for k in ['profile','exactIntegerDecisionPlanes','exactIntegerFunctionPlanes','functionPackageBytes','allLoggedCasesExact','seconds']}),flush=True)
