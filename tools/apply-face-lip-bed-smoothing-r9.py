from pathlib import Path

face = Path('body/FaceAnatomy.js')
text = face.read_text(encoding='utf-8')
old_surface = """  const surface=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (height[at(i,j)]*(1-a)+height[at(i+1,j)]*a)*(1-b)+(height[at(i,j+1)]*(1-a)+height[at(i+1,j+1)]*a)*b;};
  const facePoint=(x,y)=>[x,y+compactNasalUnderturn(x,y),surface(x,y)],faceNormal=(x,y)=>{const e=.00012;return norm(cross(sub(facePoint(x+e,y),facePoint(x-e,y)),sub(facePoint(x,y+e),facePoint(x,y-e))));};
"""
new_surface = """  const surface=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (height[at(i,j)]*(1-a)+height[at(i+1,j)]*a)*(1-b)+(height[at(i,j+1)]*(1-a)+height[at(i+1,j+1)]*a)*b;};
  // The source-fitted skin is intentionally detailed. Reusing every lateral
  // microgradient at the lip free edge creates column-aligned ridges when the
  // mouth opens, so the lip bed receives a bounded one-dimensional low-pass.
  // The blend returns exactly to the original skin at the outer attachment.
  const lipBedSurface=(x,y,t)=>{let sum=0,total=0;for(let k=-4;k<=4;k++){const w=Math.exp(-.5*(k/2.2)**2);sum+=surface(x+k*dx,y)*w;total+=w;}
    const smooth=sum/total,a=clamp((t-.58)/.42,0,1),attach=a*a*(3-2*a);return smooth+(surface(x,y)-smooth)*attach;};
  const facePoint=(x,y)=>[x,y+compactNasalUnderturn(x,y),surface(x,y)],faceNormal=(x,y)=>{const e=.00012;return norm(cross(sub(facePoint(x+e,y),facePoint(x-e,y)),sub(facePoint(x,y+e),facePoint(x,y-e))));};
"""
if text.count(old_surface) != 1:
    raise SystemExit(f'R9 lip-bed insertion anchor mismatch: {text.count(old_surface)}')
text = text.replace(old_surface, new_surface, 1)
old_lip_surface = """  const lipSurface=(x,upper,t)=>{const q=compactLipOutline(x),edge=upper?q.top:q.bottom,r=compactLipRadial(lp.apron*t),y=q.seam+(edge-q.seam)*r;
"""
new_lip_surface = """  const lipSurface=(x,upper,t)=>{const q=compactLipOutline(x),edge=upper?q.top:q.bottom,r=compactLipRadial(lp.apron*t),sideTag=(upper?1:-1)*.000001*(1-3*t*t+2*t*t*t),y=q.seam+(edge-q.seam)*r+sideTag;
"""
if text.count(old_lip_surface) != 1:
    raise SystemExit(f'R9 sealed-edge side-tag anchor mismatch: {text.count(old_lip_surface)}')
text = text.replace(old_lip_surface, new_lip_surface, 1)
old_z = """    const z=surface(x,y)+compactLipReliefDepth(q.u,t,upper)+.000015;
"""
new_z = """    const z=lipBedSurface(x,y,t)+compactLipReliefDepth(q.u,t,upper)+.000015;
"""
if text.count(old_z) != 1:
    raise SystemExit(f'R9 lip-bed use anchor mismatch: {text.count(old_z)}')
face.write_text(text.replace(old_z, new_z, 1), encoding='utf-8', newline='\n')

check_path = Path('tools/check-face-anatomy.mjs')
check = check_path.read_text(encoding='utf-8')
anchor = " check(source.includes('const chinLo=1.4270,chinHi=1.4495')&&source.includes('compactLipContactShadow')&&source.includes('compactLipOpen<.025'),'lower-face Hermite bed, nonuniform contact shadow and closed-mouth cavity gate are explicit');"
addition = "\n check(source.includes('const lipBedSurface=')&&source.includes('smooth+(surface(x,y)-smooth)*attach')&&source.includes('sideTag=(upper?1:-1)*.000001'),'lip free edge is laterally smoothed while a sub-visual side tag preserves upper/lower opening identity');"
if check.count(anchor) != 1:
    raise SystemExit(f'R9 lip-bed source-check anchor mismatch: {check.count(anchor)}')
check_path.write_text(check.replace(anchor, anchor + addition, 1), encoding='utf-8', newline='\n')
