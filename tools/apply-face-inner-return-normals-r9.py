from pathlib import Path

face = Path('body/FaceAnatomy.js')
text = face.read_text(encoding='utf-8')
old = """    for(let i=0;i<=lp.columns;i++)for(let j=0;j<=rows;j++){
      const x=lp.centreX+lp.halfWidth*(-.998+1.996*i/lp.columns),t=j/rows,e=.00005,a=sub(innerPoint(x+e,t),innerPoint(x-e,t)),b=sub(innerPoint(x,Math.min(1,t+.0001)),innerPoint(x,Math.max(0,t-.0001)));
      let normal=norm(cross(b,a));if(!upper)normal=mul(normal,-1);lipP.push(...innerPoint(x,t));lipN.push(...compactEyeEncodeNormal(normal));
    }
"""
new = """    for(let i=0;i<=lp.columns;i++)for(let j=0;j<=rows;j++){
      const x=lp.centreX+lp.halfWidth*(-.998+1.996*i/lp.columns),t=j/rows,q=compactLipOutline(x),angle=t*Math.PI/2;
      // Exclude inherited skin-triangle gradients from inner-return normals.
      // They produced false vertical bands that looked like teeth on opening.
      const normal=norm([-.10*q.u*Math.sin(angle),upper?-Math.cos(angle):Math.cos(angle),-Math.sin(angle)]);
      lipP.push(...innerPoint(x,t));lipN.push(...compactEyeEncodeNormal(normal));
    }
"""
if text.count(old) != 1:
    raise SystemExit(f'R9 inner-return normal anchor mismatch: {text.count(old)}')
face.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')

check_path = Path('tools/check-face-anatomy.mjs')
check = check_path.read_text(encoding='utf-8')
anchor = " check(source.includes('const chinLo=1.4270,chinHi=1.4495')&&source.includes('compactLipContactShadow')&&source.includes('compactLipOpen<.025'),'lower-face Hermite bed, nonuniform contact shadow and closed-mouth cavity gate are explicit');"
addition = "\n check(source.includes('upper?-Math.cos(angle):Math.cos(angle)')&&source.includes('false vertical')&&source.includes('inner-return normals'),'inner vermilion normals are independent of noisy inherited skin triangles');"
if check.count(anchor) != 1:
    raise SystemExit(f'R9 inner-return source-check anchor mismatch: {check.count(anchor)}')
check_path.write_text(check.replace(anchor, anchor + addition, 1), encoding='utf-8', newline='\n')
