"""Compile source domains without geometric epsilon expansion or triangles."""
from pathlib import Path
import sys,json
root=Path(__file__).resolve().parent.parent
profile=sys.argv[1] if len(sys.argv)>1 else 'baseline'
sys.argv=[str(__file__),'full',profile]
source=(root/'tools/compile-source-atlas-r21.py').read_text(encoding='utf8')
begin=source.index('def signed_area(');end=source.index('def node_leaf(')
source=source[:begin]+(root/'tools/research/r24/exact-domain-functions.py').read_text(encoding='utf8')+'\n'+source[end:]
source=source.replace('EPS=2e-14','EPS=0')
source=source.replace('centres=[(sum(a[0] for a in q)/len(q),sum(a[1] for a in q)/len(q))','centres=[(sum(a[0]/a[2] for a in q)/len(q),sum(a[1]/a[2] for a in q)/len(q))')
source=source.replace('nodes[index]=[*chosen,0,left,right,0,0]','nodes[index]=[*line_float(chosen),0,left,right,0,0]')
source=source.replace('poly=[tuple(a) for a in uv]','poly=[point_from_real(a) for a in uv]')
source=source.replace('lo=[min(a[k] for a in uv) for k in (0,1)];hi=[max(a[k] for a in uv) for k in (0,1)]','lo=[min(a[k]/a[2] for a in uv) for k in (0,1)];hi=[max(a[k]/a[2] for a in uv) for k in (0,1)]')
source=source.replace('cell=[(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]','cell=[point_from_real(p) for p in [(lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1])]]')
if profile=='calibration-soft':source=source.replace("qa/fidelity-r21/offline/case-","qa/fidelity-r24/offline/case-")
source=source.replace('qa/fidelity-r21/offline/atlas-','qa/fidelity-r24/offline/exact-atlas-').replace('qa/fidelity-r21/atlas-','qa/fidelity-r24/exact-atlas-')
exec(compile(source,str(root/'tools/compile-source-atlas-r21.py'),'exec'))
file=root/('qa/fidelity-r24/offline/exact-atlas-full'+('' if profile=='baseline' else '-'+profile)+'.json')
result=json.loads(file.read_text(encoding='utf8'));old=root/(('qa/fidelity-r24/offline/atlas-full-calibration-soft.json') if profile=='calibration-soft' else 'qa/fidelity-r21/offline/atlas-full'+('' if profile=='baseline' else '-'+profile)+'.json');prior=json.loads(old.read_text(encoding='utf8'))
if result['functions']!=prior['functions']:raise RuntimeError('Original surface coefficients changed')
result['sourcePalmCoefficients']=prior['sourcePalmCoefficients'];result['sourceSkinCoefficients']=prior['sourceSkinCoefficients'];result['report'].update({'exactDomainClassification':True,'domainExpansionEpsilon':0,'sourceSurfaceCoefficientsUnchanged':True})
file.write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
(root/('qa/fidelity-r24/exact-domain-'+profile+'.json')).write_text(json.dumps(result['report'],indent=2),encoding='utf8')
