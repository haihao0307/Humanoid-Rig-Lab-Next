"""Correct the loose-cotton response independently of packed cloth body shading."""
from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'app.js').read_text()
# The packed weave's dark base must not make pale exposed weft remnants black.
old="vec3 col=yarnColor(vM,vInfo.x,vInfo.y,1.);col=mix(col,vec3(.24,.219,.181),.24)*variation;\nO=vec4(tone(lighting(col,N,T,vW,.9)),1.);"
new="vec3 col=yarnColor(vM,vInfo.x,vInfo.y,1.);col=mix(col,vec3(.46,.425,.35),vInfo.x>.5?.72:.33)*variation;\nvec3 softN=normalize(mix(normalize(uCam-vW),N,.55));\nO=vec4(tone(lighting(col,softN,T,vW,.9)),1.);"
assert old in s or new in s
s=s.replace(old,new)
# This small constituent-fiber lightening is bounded; keep the blue yarn core.
s=s.replace("c=mix(c,vec3(.19,.186,.171),.10);", "c=mix(c,vec3(.25,.239,.212),.20);")
(p/'app.js').write_text(s)
