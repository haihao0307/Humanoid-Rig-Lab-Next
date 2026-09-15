from pathlib import Path

face = Path('body/FaceAnatomy.js')
text = face.read_text(encoding='utf-8')
replacements = {
    "whiteRollUpper:.00006,whiteRollLower:.00002,whiteRollCentre:1.040,whiteRollWidth:.052": "whiteRollUpper:.00002,whiteRollLower:.000005,whiteRollCentre:1.030,whiteRollWidth:.038",
    "return (1.-smoothstep(.94,1.12,radial))*smoothstep(0.,.24,1.-abs(q.x));": "return (1.-smoothstep(1.02,1.22,radial))*smoothstep(0.,.24,1.-abs(q.x));",
    "float planeTone=p.y>q.y?.92:1.02;\n    return vec3(.90,.68,.77)*(planeTone+.045*variation);": "float planeTone=p.y>q.y?.92:1.02,outerGate=smoothstep(.1862,.1882,p.z);\n    vec3 outer=vec3(.90,.68,.77)*(planeTone+.045*variation),inner=vec3(.54,.30,.35)*(1.+.025*variation);\n    return mix(inner,outer,outerGate);",
    "return -.000075*(compactLipGrooves(uv,23.,seed)+.22*compactLipGrooves(uv,47.,seed+31.))*compactLipPigment(p);": "float outerGate=smoothstep(.1894,.1901,p.z),openingGate=1.-smoothstep(.04,.18,compactLipOpen);\n    return -.000075*(compactLipGrooves(uv,23.,seed)+.22*compactLipGrooves(uv,47.,seed+31.))*compactLipPigment(p)*outerGate*openingGate;",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'R9 visual correction anchor mismatch: {old!r}, count={count}')
    text = text.replace(old, new, 1)
face.write_text(text, encoding='utf-8', newline='\n')

check_path = Path('tools/check-face-anatomy.mjs')
check = check_path.read_text(encoding='utf-8')
old = "source.includes('whiteRollUpper:.00006')"
new = "source.includes('whiteRollUpper:.00002')"
if check.count(old) != 1:
    raise SystemExit(f'R9 white-roll source contract anchor mismatch: {check.count(old)}')
check = check.replace(old, new, 1)
anchor = "check(source.includes('const chinLo=1.4270,chinHi=1.4495')&&source.includes('compactLipContactShadow')&&source.includes('compactLipOpen<.025'),'lower-face Hermite bed, nonuniform contact shadow and closed-mouth cavity gate are explicit');"
addition = "\n check(source.includes('openingGate=1.-smoothstep(.04,.18,compactLipOpen)'),'open-mouth fallback suppresses procedural grooves until inner and outer mucosa receive separate material domains');"
if check.count(anchor) != 1:
    raise SystemExit(f'R9 opening-gate check anchor mismatch: {check.count(anchor)}')
check_path.write_text(check.replace(anchor, anchor + addition, 1), encoding='utf-8', newline='\n')
