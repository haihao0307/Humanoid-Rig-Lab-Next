"""Idempotent pre-bootstrap corrections; edits only the new R05 source modules."""
from pathlib import Path
p=Path(__file__).resolve().parent
changes={
'cotton.glsl':[('(.48+.52*vis)','(.80+.20*vis)')],
'studio.js':[
 ('P.xy*vec2(.004,.003)','(P.xy-vec2(-35,20))*vec2(.007,.006)'),
 ('.72+.22*max(0.,dot(N,normalize(uKeyPos-P)))+.14*softPool','.65+.18*max(0.,dot(N,normalize(uKeyPos-P)))+.23*softPool'),
 ('c*=.88+.12*visibility(P,8.);','c*=.76+.24*visibility(P,8.);')],
'upgrade.py':[
 ('resolved*.68*(staple-.5)+.30*(packingNoise-.5)','resolved*.36*(staple-.5)+.24*(packingNoise-.5)'),
 ('(staple-.5)*.85*resolved','(staple-.5)*.48*resolved')]
}
for name,pairs in changes.items():
 s=(p/name).read_text()
 for old,new in pairs:
  assert old in s or new in s,(name,old)
  s=s.replace(old,new)
 (p/name).write_text(s)
