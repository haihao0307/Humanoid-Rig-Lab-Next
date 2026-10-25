"""One isolated source-parameter calibration; original compiler arithmetic."""
from pathlib import Path
import sys,json,hashlib
import numpy as np
root=Path(__file__).resolve().parent.parent
sys.argv=[str(__file__),'full','calibration-soft']
source=(root/'tools/compile-source-atlas-r21.py').read_text(encoding='utf8')
source=source.replace("qa/fidelity-r21/offline/case-","qa/fidelity-r24/offline/case-")
source=source.replace("qa/fidelity-r21/offline/atlas-","qa/fidelity-r24/offline/atlas-")
source=source.replace("qa/fidelity-r21/atlas-","qa/fidelity-r24/atlas-")
exec(compile(source,str(root/'tools/compile-source-atlas-r21.py'),'exec'))
case=json.loads((root/'qa/fidelity-r24/offline/case-calibration-soft.json').read_text(encoding='utf8'))
base=json.loads((root/'qa/fidelity-r21/offline/original.json').read_text(encoding='utf8'))
atlas_path=root/'qa/fidelity-r24/offline/atlas-full-calibration-soft.json'
atlas=json.loads(atlas_path.read_text(encoding='utf8'))
evidence=json.loads((root/'qa/fidelity-r24/offline/atlas-full-calibration-soft-evidence.json').read_text(encoding='utf8'))
faces=np.asarray(base['faces']).reshape(-1,3);points=np.asarray(case['positionsYUp']).reshape(-1,3);skin=case['skin'];extra=np.asarray(skin['extra']).reshape(-1,4);regions=np.asarray(skin['region']).reshape(-1,4)
if np.any(extra[:,0]!=0) or np.any(regions[:,1:]!=0) or np.any(regions[:,0]!=1) or np.any(skin['type']):raise RuntimeError('Original body masks changed')
values=np.column_stack((np.asarray(skin['rest']).reshape(-1,3),extra[:,1]));palms=extra[:,2];palm_coeff=[];skin_coeff=[];maximum=0.
for face in evidence:
 ids=faces[face];p=points[ids];axis=int(np.argmax(np.abs(np.cross(p[1]-p[0],p[2]-p[0]))));u=(axis+1)%3;v=(axis+2)%3;design=np.column_stack((p[:,[u,v]],np.ones(3)));c=np.linalg.solve(design,values[ids]);pc=np.linalg.solve(design,palms[ids]);palm_coeff.append(pc.tolist());skin_coeff.append(c.T.flatten().tolist());maximum=max(maximum,float(np.max(np.abs(design@c-values[ids]))),float(np.max(np.abs(design@pc-palms[ids]))))
atlas['sourcePalmCoefficients']=palm_coeff;atlas['sourceSkinCoefficients']=skin_coeff;atlas['report'].update({'sourceBodyPaletteAttributePreserved':True,'sourceRestAndDrynessPreserved':True,'sourceParameterCalibrationOnly':True,'maximumAttributeArithmeticResidual':maximum,'sourceStateSHA256':hashlib.sha256(json.dumps(case['sourceState'],separators=(',',':'),ensure_ascii=False).encode()).hexdigest()})
atlas_path.write_text(json.dumps(atlas,separators=(',',':')),encoding='utf8')
(root/'qa/fidelity-r24/calibration-compile.json').write_text(json.dumps(atlas['report'],indent=2),encoding='utf8')
print(json.dumps({'calibrationFunctions':len(skin_coeff),'maximumAttributeArithmeticResidual':maximum}),flush=True)
