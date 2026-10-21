"""Reuse the byte-pinned S3.11 native harness; explicit substitutions are reviewed here.
All original source execution, original limits, residual channels and checks remain.
"""
from pathlib import Path
import hashlib
R=Path(__file__).resolve().parent
raw=(R.parent/'hc-s3-11/run_native.py').read_bytes()
assert hashlib.sha256(raw).hexdigest()=='bf6ce799a2ace7cc3c5058a65a02a820a55b51db1f89213ae3cf14037f2bbab2'
code=raw.decode()
for old,new in [
 ('RF311','RF312'),
 ("['baseline','guarded']","['reference','local']"),
 ("R.parent/'hc-s3-9/qa/native'/('coverage-'+motion)/'ENDURANCE.json'","R.parent/'hc-s3-11/qa/native'/motion/'guarded/ENDURANCE.json'"),
 ("mode=='baseline'","mode=='reference'"),
 ("f['calls']==f['guideAccepted']+f['normalAccepted']+f['blocked']","f['calls']==f['guideAccepted']+f['normalAccepted']+f['blocked']+f.get('localAccepted',0)"),
 ("reference all43 endpoint states unchanged","reference all43 S3.11 guarded endpoint states unchanged"),
 ("check('joint gate rejects that move',not regression['choices'][0]['decision']['allowed'])","check('joint gate rejects that move',not regression['choices'][0]['decision']['allowed'])\n      check('new solve observes exact native failure state',x['jointGuard']['localExact'] is not None and x['jointGuard']['localExact']['faceOffset']==2598)"),
 ("check('accepted trials satisfy joint tests in recorded examples',all(any(c['kind']==e['selected'] and c['decision']['allowed'] for c in e['choices']) for e in x['jointGuard']['events'] if e['selected']!='blocked'))","check('accepted local solves have explicit validated scope',all(any(s['status']=='LOCAL_FEASIBLE' and s['decision']['allowed'] and s['decision']['remainingCrossingPairs']==0 for s in a['scopes']) for a in x['jointGuard']['localAttempts'] if a['accepted']))"),
 ("check('joint cost is included, observation cost separate',all(f['jointGuard']['guardWallMS']>=0 and f['jointGuard']['observerMS']==0 for f in x['frames']))","check('local solve cost retained and shadow timing separate',all(f['jointGuard']['guardWallMS']>=f['jointGuard']['localMS'] and f['jointGuard']['localObserverMS']==0 for f in x['frames']))")
]:
 assert old in code,old
 code=code.replace(old,new)
exec(compile(code,str(__file__),'exec'),globals())
