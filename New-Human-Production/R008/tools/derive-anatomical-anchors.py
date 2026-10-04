"""Derive explicitly estimated registration landmarks from the licensed atlas.
These are NOT measured functional joint centres. No source vertices are exported.
"""
import argparse,json,zipfile,hashlib,re,numpy as np
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',default='/tmp/anatomy-source-research/partof_BP3D_4.0_obj_99.zip');p.add_argument('--manifest',default='/tmp/anatomy-source-research/skeleton_202_manifest.json');a=p.parse_args()
z=zipfile.ZipFile(a.source);manifest=json.load(open(a.manifest));meshes=[b for b in manifest['meshes'] if not b.get('duplicateOf')];byname={b['name']:b for b in meshes};cache={}
def verts(name):
 b=byname[name];id=b['sourceMeshId']
 if id not in cache: cache[id]=np.array([[float(v) for v in line.split()[1:4]] for line in z.read(b['archiveMember']).decode().splitlines() if line.startswith('v ')])
 return cache[id]
def centre(name):return np.median(verts(name),axis=0)
def end(name,top=True,fraction=.08):
 v=verts(name);lo,hi=v[:,2].min(),v[:,2].max();cut=hi-fraction*(hi-lo) if top else lo+fraction*(hi-lo);return np.mean(v[v[:,2]>cut] if top else v[v[:,2]<cut],axis=0)
def sphere_top(name,fraction):
 v=verts(name);v=v[v[:,2]>v[:,2].max()-fraction*np.ptp(v[:,2])];result=np.linalg.lstsq(np.c_[2*v,np.ones(len(v))],(v*v).sum(1),rcond=None)[0];return result[:3]
def convert(p):return [round(float(p[0])*.001,8),round(float(p[2])*.001,8),round(-float(p[1])*.001,8)]
roles={};tips={};metacarpalBases={};methods={}
for side,s in [('left','l'),('right','r')]:
 roles['upperarm_'+s]=sphere_top(side+' humerus',.10)
 roles['lowerarm_'+s]=end(side+' humerus',False,.05)
 roles['hand_'+s]=(end(side+' radius',False,.05)+end(side+' ulna',False,.05))*.5
 roles['thigh_'+s]=sphere_top(side+' femur',.04)
 roles['calf_'+s]=(end(side+' femur',False,.04)+end(side+' tibia',True,.03))*.5
 roles['foot_'+s]=end(side+' tibia',False,.03)
 roles['ball_'+s]=np.mean([end(side+' '+n+' metatarsal bone',False,.08)for n in ['first','second','third','fourth','fifth']],axis=0)
 for ordinal,digit in [('second','index'),('third','middle'),('fourth','ring'),('fifth','pinky')]:metacarpalBases[digit+'_'+s]=end(side+' '+ordinal+' metacarpal bone',True,.15)
 roles['clavicle_'+s]=end(side+' clavicle',True,.2)
 # The clavicle medial endpoint is identified along anatomical left/right.
 v=verts(side+' clavicle');d=np.abs(v[:,0]);roles['clavicle_'+s]=np.mean(v[d<np.quantile(d,.10)],axis=0)
 for digit,name in [('index','index finger'),('middle','middle finger'),('ring','ring finger'),('pinky','little finger')]:
  labels=[f'proximal phalanx of {side} {name}',f'middle phalanx of {side} {name}',f'distal phalanx of {side} {name}']
  for i,label in enumerate(labels): roles[f'{digit}_{i+1}_{s}']=end(label,True,.15)
  tips[f'{digit}_{s}']=end(labels[-1],False,.15)
 labels=[side+' first metacarpal bone',f'proximal phalanx of {side} thumb',f'distal phalanx of {side} thumb']
 for i,label in enumerate(labels):roles[f'thumb_{i+1}_{s}']=end(label,True,.15)
 tips['thumb_'+s]=end(labels[-1],False,.15)
roles['pelvis']=(roles['thigh_l']+roles['thigh_r'])*.5+np.array([0,0,35.])
for role,label in [('spineLower','fourth lumbar vertebra'),('spineMiddle','twelfth thoracic vertebra'),('chest','sixth thoracic vertebra'),('neck','seventh cervical vertebra'),('head','atlas')]:
 roles[role]=centre(label)
 # A registration centre near vertebral body rather than posterior processes.
 v=verts(label);roles[role][1]=np.quantile(v[:,1],.25)
lo=np.min([b['bboxMm'][0]for b in meshes],axis=0);hi=np.max([b['bboxMm'][1]for b in meshes],axis=0)
data={'schema':'human/anatomical-atlas-landmarks@1','source':'BodyParts3D 4.0','sourceArchiveSha256':hashlib.sha256(Path(a.source).read_bytes()).hexdigest(),'evidence':'algorithmically-estimated-registration-landmarks-not-functional-joint-measurements','unit':'metre','axes':'x anatomical left; y superior; z anterior','height':round(float(hi[2]-lo[2])*.001,8),'floor':float(lo[2])*.001,'top':float(hi[2])*.001,'roles':{k:convert(v)for k,v in roles.items()},'tips':{k:convert(v)for k,v in tips.items()},'metacarpalBases':{k:convert(v)for k,v in metacarpalBases.items()},'derivation':{'shoulder':'least-squares sphere fit to upper 10 percent humerus height','hip':'least-squares sphere fit to upper 4 percent femur height','elbow':'mean lower 5 percent humerus height','knee':'mean distal femur and proximal tibia cap centres','wrist':'mean distal radius and ulna cap centres','ankle':'mean distal tibia cap centre','spine':'vertebral median with anterior quartile in posterior axis','digits':'proximal/distal height-cap centres','pelvis':'hip midpoint plus 35 mm superior shared atlas registration prior'},'limitations':['Not subject-specific measured joints','No cartilage/joint centre calibration','No recovered muscle attachments','Atlas-to-character scaling changes morphology; report registration separately from source-fit fidelity']}
out=Path(__file__).resolve().parents[1]/'AnatomicalLandmarks.mjs';out.write_text('// Reproducible atlas-only estimated landmarks; no character-specific coordinates.\nexport const ANATOMICAL_LANDMARKS='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n');print(json.dumps({'output':str(out),'roles':len(roles),'sourceHeight':data['height']}))
