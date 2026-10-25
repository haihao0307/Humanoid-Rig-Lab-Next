"""Offline exact split conservation, before Float64 decision encoding.

This is not a proof of every finite-precision runtime ray, boundary ownership,
source normals/material appearance, or source-fidelity acceptance.
"""
from pathlib import Path
from fractions import Fraction
import sys,json,hashlib,time
import numpy as np
root=Path(__file__).resolve().parents[3]
profile=sys.argv[1] if len(sys.argv)>1 else 'baseline'
source=(root/'tools/compile-source-atlas-r21.py').read_text(encoding='utf8')
helper=(root/'tools/research/r24/exact-domain-functions.py').read_text(encoding='utf8')
audit='''
from fractions import Fraction
proof_splits=0
proof_positive_piece_checks=0
def exact_area(poly):
 if len(poly)<3:return Fraction(0)
 return sum((Fraction(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1],poly[i][2]*poly[(i+1)%len(poly)][2]) for i in range(len(poly))),Fraction(0))/2
unchecked_split=split
def split(poly,line):
 global proof_splits,proof_positive_piece_checks
 before=exact_area(poly);positive,negative=unchecked_split(poly,line);a=exact_area(positive);b=exact_area(negative)
 if before<0 or a<0 or b<0 or a+b!=before:raise RuntimeError('Exact source split area changed')
 proof_splits+=1;proof_positive_piece_checks+=int(bool(positive))+int(bool(negative))
 return positive,negative
'''
begin=source.index('def signed_area(');end=source.index('def node_leaf(')
source=source[:begin]+helper+'\n'+audit+'\n'+source[end:]
source=source.replace('EPS=2e-14','EPS=0').replace('centres=[(sum(a[0] for a in q)/len(q),sum(a[1] for a in q)/len(q))','centres=[(sum(a[0]/a[2] for a in q)/len(q),sum(a[1]/a[2] for a in q)/len(q))').replace('nodes[index]=[*chosen,0,left,right,0,0]','nodes[index]=[*line_float(chosen),0,left,right,0,0]').replace('poly=[tuple(a) for a in uv]','poly=[point_from_real(a) for a in uv]').replace('lo=[min(a[k] for a in uv) for k in (0,1)];hi=[max(a[k] for a in uv) for k in (0,1)]','lo=[min(a[k]/a[2] for a in uv) for k in (0,1)];hi=[max(a[k]/a[2] for a in uv) for k in (0,1)]').replace('cell=[(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]','cell=[point_from_real(p) for p in [(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]]')
if profile=='calibration-soft':source=source.replace('qa/fidelity-r21/offline/case-','qa/fidelity-r24/offline/case-')
source=source.replace('qa/fidelity-r21/offline/atlas-','qa/fidelity-r24/offline/proof-atlas-').replace('qa/fidelity-r21/atlas-','qa/fidelity-r24/offline/proof-atlas-')
sys.argv=[str(root/'tools/compile-source-atlas-r21.py'),'full',profile]
namespace={'__file__':str(root/'tools/compile-source-atlas-r21.py'),'__name__':'__source_domain_proof__'}
started=time.monotonic();exec(compile(source,namespace['__file__'],'exec'),namespace)
program=namespace['program'];package=json.loads((root/'data/body-source-atlas-r24.json').read_text(encoding='utf8'));selected=next(p for p in package['profiles'] if p['id']==profile)
nodes=np.array(program['nodes']);arrays={'nodeLines':np.asarray([n[:3] for n in program['nodes']],dtype='<f8'),'nodeLinks':np.asarray([n[3:] for n in program['nodes']],dtype='<u4'),'leafFunctionIds':np.asarray(program['leafFunctions'],dtype='<u4'),'functionCoefficients':np.asarray(program['functions'],dtype='<f8')}
checks=[]
for name,array in arrays.items():
 expected=package['blobs'][selected['arrays'][name]]['sha256'];actual=hashlib.sha256(array.tobytes()).hexdigest();checks.append({'array':name,'sha256':actual,'matchesSelectedRuntime':actual==expected})
 if actual!=expected:raise RuntimeError('Proof changed selected coefficient words '+name)
report={'scope':'Offline exact rational split area conservation before Float64 line encoding; not a global finite-precision ray or boundary-ownership proof','profile':profile,'sourceFidelityAccepted':False,'visualAccepted':False,'acceptanceTolerance':None,'offlineReferenceOnly':True,'runtimeCharacterFaces':0,'exactSplitAssertions':namespace['proof_splits'],'positivePieceChecks':namespace['proof_positive_piece_checks'],'arrayChecks':checks,'selectedProgramSHA256':selected['sourceProgramSHA256'],'sourcePackageSHA256':hashlib.sha256((root/'data/body-source-atlas-r24.json').read_bytes()).hexdigest(),'unresolved':program['report']['unresolved'],'seconds':time.monotonic()-started,'passed':all(c['matchesSelectedRuntime'] for c in checks) and not program['report']['unresolved']}
(root/f'qa/fidelity-r24/exact-area-proof-{profile}.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
