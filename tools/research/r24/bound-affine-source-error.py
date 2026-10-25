"""Offline whole-patch coefficient error bounds in exact rational arithmetic.

No finite-precision ray, Float64 domain decision, first-hit/edge ownership,
normal shader, material or visual acceptance is established by these bounds.
Original connectivity is only read as an offline reference and never emitted.
"""
from pathlib import Path
from fractions import Fraction as F
import json,sys,hashlib,gzip,math,time
import numpy as np
root=Path(__file__).resolve().parents[3]
profile=sys.argv[1] if len(sys.argv)>1 else 'baseline'
started=time.monotonic()
package_file=root/'data/body-source-atlas-r24.json'
package=json.loads(package_file.read_text(encoding='utf8'))
selected=next(p for p in package['profiles'] if p['id']==profile)
descriptor=package['blobs'][selected['arrays']['functionCoefficients']]
compressed=(root/descriptor['file']).read_bytes()
if hashlib.sha256(compressed).hexdigest()!=descriptor['compressedSHA256']:raise RuntimeError('Compressed coefficient identity changed')
raw=gzip.decompress(compressed)
if descriptor['encoding']=='gzip-byte-shuffle':
 raw=np.frombuffer(raw,dtype=np.uint8).reshape(8,-1).T.copy().tobytes()
if hashlib.sha256(raw).hexdigest()!=descriptor['sha256']:raise RuntimeError('Raw coefficient identity changed')
coefficients=np.frombuffer(raw,dtype='<f8').reshape(-1,12)
def stored_attributes(name,width):
 d=package['blobs'][selected['arrays'][name]];packed=(root/d['file']).read_bytes()
 if hashlib.sha256(packed).hexdigest()!=d['compressedSHA256']:raise RuntimeError('Attribute cache changed '+name)
 r=gzip.decompress(packed)
 if d['encoding']=='gzip-byte-shuffle':r=np.frombuffer(r,dtype=np.uint8).reshape(8,-1).T.copy().tobytes()
 if hashlib.sha256(r).hexdigest()!=d['sha256']:raise RuntimeError('Attribute coefficients changed '+name)
 return np.frombuffer(r,dtype='<f8').reshape(-1,width)
skin_coefficients=stored_attributes('sourceSkinCoefficients',12)
palm_coefficients=stored_attributes('sourcePalmCoefficients',3)
original_path=root/'qa/fidelity-r21/offline/original.json'
data=json.loads(original_path.read_text(encoding='utf8'))
case_path=None
if profile!='baseline':
 case_path=root/('qa/fidelity-r24/offline/case-calibration-soft.json' if profile=='calibration-soft' else 'qa/fidelity-r21/offline/case-'+profile+'.json')
 data.update(json.loads(case_path.read_text(encoding='utf8')))
suffix='' if profile=='baseline' else '-'+profile
evidence_path=root/('qa/fidelity-r24/offline/proof-atlas-full'+suffix+'-evidence.json')
evidence=json.loads(evidence_path.read_text(encoding='utf8'))
if len(evidence)!=len(coefficients):raise RuntimeError('Source function identity layout changed')
points=np.array(data['positionsYUp']).reshape(-1,3)
normals=np.array(data['normalsYUp']).reshape(-1,3)
faces=np.array(data['faces']).reshape(-1,3)
skin_path=root/'qa/fidelity-r21/offline/source-body-skin.json'
palm_path=root/'qa/fidelity-r21/offline/source-body-material.json'
if profile=='calibration-soft':
 skin=data['skin'];palm=np.array(skin['extra']).reshape(-1,4)[:,2]
else:
 skin=json.loads(skin_path.read_text(encoding='utf8'))['profiles'][profile]
 palm=np.array(json.loads(palm_path.read_text(encoding='utf8'))['profiles'][profile]['palm'])
skin_values=np.column_stack((np.array(skin['rest']).reshape(-1,3),np.array(skin['extra']).reshape(-1,4)[:,1],palm))
attribute_max=[F(0) for _ in range(5)];attribute_worst=[None]*5
position_max=F(0);normal_raw_max=F(0);normal_unit_max=F(0);minimum_normal_lower=None
position_worst=None;normal_worst=None;unbounded=[]
fraction=lambda x:F.from_float(float(x))
fallback_count=0
def convex_normal_minimum_squared(vertices):
 dot=lambda a,b:sum(x*y for x,y in zip(a,b))
 subtract=lambda a,b:[x-y for x,y in zip(a,b)]
 best=min(dot(a,a) for a in vertices)
 for i,j in [(0,1),(1,2),(2,0)]:
  a=vertices[i];delta=subtract(vertices[j],a);squared=dot(delta,delta)
  if not squared:continue
  t=-dot(a,delta)/squared
  if 0<t<1:
   point=[a[k]+t*delta[k] for k in range(3)];best=min(best,dot(point,point))
 a=vertices[0];u=subtract(vertices[1],a);v=subtract(vertices[2],a)
 aa=dot(u,u);ab=dot(u,v);bb=dot(v,v);det=aa*bb-ab*ab
 if det>0:
  r=-dot(a,u);s=-dot(a,v);x=(r*bb-s*ab)/det;y=(s*aa-r*ab)/det
  if x>=0 and y>=0 and x+y<=1:
   point=[a[k]+x*u[k]+y*v[k] for k in range(3)];best=min(best,dot(point,point))
 if best<0:raise RuntimeError('Negative exact squared norm')
 return best
for function_id,source_face in enumerate(evidence):
 ids=faces[source_face];p=points[ids];n=normals[ids]
 gn=np.cross(p[1]-p[0],p[2]-p[0]);axis=int(np.argmax(np.abs(gn)))
 if not np.any(gn):raise RuntimeError('Degenerate source emitted as function')
 u=(axis+1)%3;v=(axis+2)%3
 c=list(map(fraction,coefficients[function_id]))
 sc=list(map(fraction,skin_coefficients[function_id]))+list(map(fraction,palm_coefficients[function_id]))
 ns=[list(map(fraction,row)) for row in n]
 error=F(0)
 for vertex in range(3):
  U=fraction(p[vertex,u]);V=fraction(p[vertex,v])
  residual=abs(c[0]*U+c[1]*V+c[2]-fraction(p[vertex,axis]))
  if residual>position_max:position_max=residual;position_worst={'function':function_id,'offlineSourceCell':int(source_face),'corner':vertex,'axis':axis}
  normal_error=sum(abs(c[3+k*3]*U+c[4+k*3]*V+c[5+k*3]-ns[vertex][k]) for k in range(3))
  error=max(error,normal_error)
  for k in range(5):
   residual=abs(sc[k*3]*U+sc[k*3+1]*V+sc[k*3+2]-fraction(skin_values[ids[vertex],k]))
   if residual>attribute_max[k]:attribute_max[k]=residual;attribute_worst[k]={'function':function_id,'offlineSourceCell':int(source_face),'corner':vertex}
 normal_raw_max=max(normal_raw_max,error)
 # Any interpolated source normal N lies in the corner-normal convex hull.
 # N dot D >= min(corner dot D), and |D| <= |D|_1, exactly.
 direction=[sum(ns[i][k] for i in range(3)) for k in range(3)]
 upper_direction_length=sum(abs(x) for x in direction)
 lower_dot=min(sum(row[k]*direction[k] for k in range(3)) for row in ns)
 if not upper_direction_length or lower_dot<=0:
  # Exact constrained quadratic fallback covers a triangle of normal vectors
  # that the inexpensive separating-direction certificate cannot separate.
  fallback_count+=1;squared=convex_normal_minimum_squared(ns)
  lower=F(math.isqrt(squared.numerator*squared.denominator),squared.denominator)
  if not lower:
   unbounded.append({'function':function_id,'offlineSourceCell':int(source_face),'reason':'convex normal hull reaches zero or no positive rational sqrt lower bound'});continue
 else:lower=lower_dot/upper_direction_length
 if minimum_normal_lower is None or lower<minimum_normal_lower:minimum_normal_lower=lower
 if error>=lower:
  unbounded.append({'function':function_id,'offlineSourceCell':int(source_face),'reason':'stored normal error reaches source lower bound'});continue
 unit_error=2*error/lower
 if unit_error>normal_unit_max:normal_unit_max=unit_error;normal_worst={'function':function_id,'offlineSourceCell':int(source_face)}
upper=lambda x:math.nextafter(float(x),math.inf) if x else 0
exact=lambda x:{'numerator':str(x.numerator),'denominator':str(x.denominator)}
report={'scope':__doc__.strip(),'profile':profile,'sourceFidelityAccepted':False,'visualAccepted':False,'acceptanceTolerance':None,'offlineReferenceOnly':True,'runtimeFacesGenerated':0,'functionCount':len(coefficients),'originalNondegenerateCells':int(sum(bool(np.any(np.cross(points[f[1]]-points[f[0]],points[f[2]]-points[f[0]]))) for f in faces)),'sourcePackageSHA256':hashlib.sha256(package_file.read_bytes()).hexdigest(),'coefficientSHA256':descriptor['sha256'],'offlineOriginalSHA256':hashlib.sha256(original_path.read_bytes()).hexdigest(),'offlineCaseSHA256':hashlib.sha256(case_path.read_bytes()).hexdigest() if case_path else None,'evidenceMappingSHA256':hashlib.sha256(evidence_path.read_bytes()).hexdigest(),'wholeClosedSourcePatchRealArithmeticPositionBoundMetresUpper':upper(position_max),'positionBoundExact':exact(position_max),'worstPosition':position_worst,'wholeClosedSourcePatchRawNormalL1BoundUpper':upper(normal_raw_max),'wholeClosedSourcePatchNormalizedNormalL2BoundUpper':upper(normal_unit_max) if not unbounded else None,'normalizedNormalBoundExact':exact(normal_unit_max) if not unbounded else None,'worstNormal':normal_worst,'sourceNormalLowerBoundMinimum':float(minimum_normal_lower) if minimum_normal_lower else None,'exactConstrainedNormalFallbacks':fallback_count,'normalCellsWithoutProvenBound':unbounded,'finiteArithmeticEvaluationOrRayErrorIncluded':False,'float64DomainOwnershipIncluded':False,'sourceShaderNormalEquivalenceIncluded':False,'materialErrorIncluded':False,'diagnosticCompleted':True,'seconds':time.monotonic()-started}
if report['functionCount']!=report['originalNondegenerateCells']:raise RuntimeError('Missing nondegenerate original cells')
report.update({'toolSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'originalSkinAttributeSHA256':hashlib.sha256(skin_path.read_bytes()).hexdigest() if profile!='calibration-soft' else report['offlineCaseSHA256'],'originalPalmAttributeSHA256':hashlib.sha256(palm_path.read_bytes()).hexdigest() if profile!='calibration-soft' else report['offlineCaseSHA256'],'wholeClosedSourcePatchAttributeBounds':{name:{'realArithmeticAbsoluteErrorUpper':upper(attribute_max[k]),'boundExact':exact(attribute_max[k]),'worst':attribute_worst[k]} for k,name in enumerate(['restX','restY','restZ','dry','palm'])},'nonlinearMaterialShaderAndTextureFilteringIncluded':False})
(root/('qa/fidelity-r24/affine-source-bound-'+profile+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:report[k] for k in ['profile','functionCount','wholeClosedSourcePatchRealArithmeticPositionBoundMetresUpper','wholeClosedSourcePatchNormalizedNormalL2BoundUpper','seconds']}),flush=True)
