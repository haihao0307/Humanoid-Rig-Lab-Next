"""Finite-sample gate for the isolated evaluation-only standing candidate."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parent.parent
def check(row):
 try:
  if row['id']!='idlefitarmssole1':return False,'unknown idle candidate'
  data=(ROOT/row['file']).read_bytes();digest=hashlib.sha256(data).hexdigest()
  if digest!=row['sha256']:return False,'clip hash mismatch'
  foot=json.loads((ROOT/'review/idlefitarmssole1-audit.json').read_text(encoding='utf8'))
  body=json.loads((ROOT/'review/idlefitarmssole1-body-audit.json').read_text(encoding='utf8'))['reports'][0]
  motion=json.loads((ROOT/'review/idlefitarmssole1-foot-motion.json').read_text(encoding='utf8'))
  regions=json.loads((ROOT/'review/idle-fitarms-regions.json').read_text(encoding='utf8'))['reports'][0]
  if foot['clipSHA256']!=digest or body['candidateSHA256']!=digest or motion['clipSHA256']!=digest or regions['sha256']!=digest:return False,'evidence hash mismatch'
  if foot['fps']<120 or body['fps']<120 or motion['fps']<120 or foot['insideSamples'] or foot['minClearanceMM']<0:return False,'floor check failed'
  s=body['summary']
  if any(s[k] for k in ['torsoInsideSamples','leftLegInsideSamples','rightLegInsideSamples','torsoLegInsideSamples','legPairInsideSamples']):return False,'body projection check failed'
  for side in 'LR':
   for region in ['heel','fore']:
    v=motion['regions'][side][region]
    if v['maximumHorizontalDriftMM']>2 or v['verticalRangeMM']>2:return False,'foot motion check failed'
   for sample in regions['samples']:
    f=sample['feet'][side]
    if abs(f['solePitchDegrees'])>2 or not (0<=f['heelMinMM']<=5 and 0<=f['foreMinMM']<=5):return False,'sole region check failed'
  return True,'passed finite sampled idle checks; source contact labels unavailable'
 except (OSError,ValueError,KeyError,TypeError) as e:return False,'missing or invalid evidence: '+str(e)
