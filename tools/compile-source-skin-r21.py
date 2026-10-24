"""Original rest coordinates and dryness, compiled into source chart functions.
No invented surface detail, vertex table or source connectivity in runtime.
"""
import json
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent.parent
base=json.loads((root/'qa/fidelity-r21/offline/original.json').read_text(encoding='utf8'))
source=json.loads((root/'qa/fidelity-r21/offline/source-body-skin.json').read_text(encoding='utf8'))
programs=json.loads((root/'qa/fidelity-r21/offline/source-material-programs.json').read_text(encoding='utf8'))
faces=np.array(base['faces']).reshape(-1,3);reports=[]
keys=['csDetail','csAge','uSDOil','uSDHydration','uSDDry','uSDSweat']
uniforms={k:programs[0]['uniforms'][k] for k in keys}
if not all(all(p['uniforms'][k]==uniforms[k] for k in keys) for p in programs):raise RuntimeError('Original shader controls differ')
for profile,skin in source['profiles'].items():
    extra=np.array(skin['extra']).reshape(-1,4);regions=np.array(skin['region']).reshape(-1,4)
    if np.any(extra[:,0]!=0) or np.any(regions[:,1:]!=0) or np.any(regions[:,0]!=1) or np.any(skin['type']):raise RuntimeError('Original constant body masks changed')
    values=np.column_stack((np.array(skin['rest']).reshape(-1,3),extra[:,1]))
    case=json.loads((root/('qa/fidelity-r21/offline/case-'+profile+'.json')).read_text(encoding='utf8'))
    points=np.array(case['positionsYUp']).reshape(-1,3)
    suffix='full'+('' if profile=='baseline' else '-'+profile)
    path=root/('qa/fidelity-r21/offline/atlas-'+suffix+'.json');atlas=json.loads(path.read_text(encoding='utf8'))
    evidence=json.loads((root/('qa/fidelity-r21/offline/atlas-'+suffix+'-evidence.json')).read_text(encoding='utf8'))
    coefficients=[];error=0
    for face in evidence:
        ids=faces[face];p=points[ids];axis=int(np.argmax(np.abs(np.cross(p[1]-p[0],p[2]-p[0]))));u=(axis+1)%3;v=(axis+2)%3
        design=np.column_stack((p[:,[u,v]],np.ones(3)));c=np.linalg.solve(design,values[ids]);coefficients.append(c.T.flatten().tolist());error=max(error,float(np.max(np.abs(design@c-values[ids]))))
    atlas['sourceSkinCoefficients']=coefficients;atlas['report']['sourceRestAndDrynessPreserved']=True
    path.write_text(json.dumps(atlas,separators=(',',':')),encoding='utf8');reports.append({'id':profile,'functions':len(coefficients),'maximumAttributeResidual':error})
report={'sourceReferenceSHA256':source['referenceSHA256'],'sourceSkinControls':uniforms,'constantThinZero':True,'constantBodyMasksVerified':True,'fullSkinOpticsRestored':False,'sourceFidelityAccepted':False,'profiles':reports}
(root/'qa/fidelity-r21/source-skin-attributes.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
