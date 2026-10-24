"""Compile original body palette attributes into analytic chart functions.
No source attributes are baked into colour images. Other optical layers remain
explicitly unimplemented in this inspection viewer.
"""
import json,hashlib,time
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent.parent
base=json.loads((root/'qa/fidelity-r21/offline/original.json').read_text(encoding='utf8'))
materials=json.loads((root/'qa/fidelity-r21/offline/source-body-material.json').read_text(encoding='utf8'))
faces=np.array(base['faces']).reshape(-1,3);reports=[]
for profile,material in materials['profiles'].items():
    if not all(material['masks'].values()):raise RuntimeError('Body shader constant-mask proof failed: '+profile)
    case=json.loads((root/('qa/fidelity-r21/offline/case-'+profile+'.json')).read_text(encoding='utf8'))
    p=np.array(case['positionsYUp']).reshape(-1,3);palm=np.array(material['palm'])
    suffix='full'+('' if profile=='baseline' else '-'+profile)
    path=root/('qa/fidelity-r21/offline/atlas-'+suffix+'.json')
    atlas=json.loads(path.read_text(encoding='utf8'));evidence=json.loads((root/('qa/fidelity-r21/offline/atlas-'+suffix+'-evidence.json')).read_text(encoding='utf8'))
    coefficients=[];error=0
    for face in evidence:
        ids=faces[face];points=p[ids];gn=np.cross(points[1]-points[0],points[2]-points[0]);axis=int(np.argmax(np.abs(gn)));u=(axis+1)%3;v=(axis+2)%3
        design=np.column_stack((points[:,[u,v]],np.ones(3)));c=np.linalg.solve(design,palm[ids]);coefficients.append(c.tolist());error=max(error,float(np.max(np.abs(design@c-palm[ids]))))
    atlas['sourcePalmCoefficients']=coefficients;atlas['report']['sourceBodyPaletteAttributePreserved']=True
    path.write_text(json.dumps(atlas,separators=(',',':')),encoding='utf8')
    reports.append({'profile':profile,'functions':len(coefficients),'maximumAttributeResidual':error,'masks':material['masks']})
(root/'qa/fidelity-r21/source-palette-attributes.json').write_text(json.dumps({'sourceReferenceSHA256':materials['referenceSHA256'],'bodySourceOnly':True,'originalSkinOpticsRestored':False,'profiles':reports},indent=2),encoding='utf8')
print(json.dumps(reports))
