"""One-time, hash-locked R07 -> R08 source migration.
After generation, edit the canonical JS/HTML sources and run build.py.
Refuses to overwrite a generated app.js; never changes R07 or another workbench.
"""
from pathlib import Path
import shutil,hashlib
D=Path(__file__).resolve().parent;S=D.parent/'r07'
assert not (D/'app.js').exists(), 'Canonical sources already exist; edit them and use build.py'
parent=(S/'template.html').read_text()
for key,file in [('SAMPLING','sampling.js'),('OPTICS','fiber-optics.js'),('STRUCTURE','structure.js'),('CORE','core.js'),('NATURAL','natural-yarn.js'),('APP','app.js')]:
    assert parent.count('/*'+key+'*/')==1
    parent=parent.replace('/*'+key+'*/',(S/file).read_text())
assert hashlib.sha256(parent.encode()).hexdigest()=='da52a22edc0da2365d25791a46c20c5669cd5ce7df86b51372c7d79291dd2b5a','R07 source no longer matches the frozen build'
for file in ['app.js','natural-yarn.js','core.js','structure.js','fiber-optics.js','sampling.js','template.html','test-layers.cjs','test-stability.cjs','build.py']:
    shutil.copy2(S/file,D/file)
p=D/'app.js';s=p.read_text().replace('R07.0','R08.0').replace('KAOPU_Denim_R07','KAOPU_Denim_R08').replace('@2.5','@2.6')
s=s.replace('weave:0,thickness:.70','weave:0,cotton:.78,staple:.72,nap:.70,thickness:.70')
s=s.replace('${KAOPUClothStructure.glsl}', '${KAOPUClothStructure.glsl}\n${KAOPUCottonSurface.shapeGLSL}')
s=s.replace('float packing=1.+.060*cos(theta*3.+t*pitch*1.3+ph)+.025*cos(theta*7.-t*pitch*.8+ph*.33);','float packing=cottonPacking(theta,t*pitch,ph).x;')
a=s.index('// Band-limited fiber lanes');b=s.index('// Packed reflection',a)
s=s[:a]+'${KAOPUCottonSurface.surfaceGLSL}\n'+s[b:]
s=s.replace('float ra=(uKind==0?uSize.z*.49:uSize.w*.235);vec3 normal=normalize(B*(cos(theta)/ra)+N0*(sin(theta)/uParam.y));','vec3 dt=yarnSection(t,theta+.004,id,1.)-yarnSection(t,theta-.004,id,1.);vec3 normal=normalize(uKind==0?cross(tangent,dt):cross(dt,tangent));')
a=s.index('// Short staple mottling');b=s.index('if(uBake==1)',a)
s=s[:a]+'''// Raised finite staples carry dye variation and broad local fiber occlusion.
float footprint=max(length(dFdx(vM)),length(dFdy(vM)))*uFilterScale;
float resolved=1.-smoothstep(.026,.10,footprint);
float fleck=clamp((variation-1.)*2.7,0.,1.);
vec3 pale=vec3(.115,.110,.100);
col=mix(col,pale,clamp(uAbrasion*.32*fleck*max(.15,crown),0.,.30));
col*=mix(1.,.92+.08*abs(front),uCotton);
'''+s[b:]
s=s.replace('vec3 surface=vec3(.045)*sheen','vec3 surface=vec3(.045)*(1.-.30*uCotton)*sheen')
s=s.replace('slub:state.slub});createRanges();','slub:state.slub,cotton:state.cotton});createRanges();')
s=s.replace("uf(p,'uSlub',state.slub);","uf(p,'uCotton',state.cotton);uf(p,'uStaple',state.staple);uf(p,'uNap',state.nap);uf(p,'uSlub',state.slub);")
s=s.replace('state.weave,state.thickness,state.slub,','state.weave,state.thickness,state.slub,state.cotton,state.staple,')
s=s.replace("['weave','thickness','slub','damage','fray']","['weave','thickness','slub','cotton','damage','fray']")
s=s.replace("['wash','abrasion','backstain','slub','preset']","['wash','abrasion','backstain','slub','cotton','staple','preset']")
s=s.replace('flat out float vFamily,vId,vDiameter;','flat out float vFamily,vId,vDiameter,vRole;')
s=s.replace('vDiameter=2.*aMeta.z;','vDiameter=2.*aMeta.z;vRole=aTangent.w;')
s=s.replace('flat in float vFamily,vId,vDiameter;','flat in float vFamily,vId,vDiameter,vRole;')
s=s.replace('vAlpha*min(1.,uFuzz*1.6)','vAlpha*min(1.,uFuzz*1.6)*mix(1.,uNap*1.6,step(.5,vRole))')
s=s.replace('surface:{fuzz:state.fuzz,fray:state.fray}','surface:{fuzz:state.fuzz,fray:state.fray,cotton:state.cotton,staple:state.staple,nap:state.nap}')
s=s.replace("body:'band-limited longitudinal staple variation'","body:'finite staggered staples in periodic angular yarn coordinates; differential cross-section normal',cottonModel:'art-directed candidate, not CT-fitted'")
s=s.replace('structureWarp:state.structure,solidEdgeDrawn:','closeSurface:{cotton:state.cotton,staple:state.staple,nap:state.nap,angularLanes:64,finiteStaples:true},structureWarp:state.structure,solidEdgeDrawn:')
a=s.index('let bakeTimer;')
s=s[:a]+'''for(const key of ['cotton','staple','nap'])$(key).oninput=e=>{
 state[key]=+e.target.value;$(key+'Val').textContent=state[key].toFixed(2);clearTimeout(bakeTimer);
 if(key==='cotton')bakeTimer=setTimeout(build,120);
 else if(key==='staple'){bakeDirty=true;request();}else request();
};
'''+s[a:]
s=s.replace("for(const key of ['exposure','fog','scatter','transmission']){$(key).value","for(const key of ['exposure','fog','scatter','transmission','cotton','staple','nap']){$(key).value")
# 16-sided close envelopes morph continuously to the old 8-sided sampling lattice.
s=s.replace('1.57079632679','0.785398163397').replace('[[2,8],[4,8],[2,4]]','[[2,8],[4,16],[2,4]]')
s=s.replace('sideMorph=0;geomLevel=pixelsPerYarn>4?1:0;','sideMorph=pixelsPerYarn>4?1.-Sampling.smooth(4,8,pixelsPerYarn):0.;geomLevel=pixelsPerYarn>4?1:0;')
s=s.replace('c=mix(c,vec3(.20,.193,.178),.10);','c=mix(c,vec3(.20,.193,.178),.10+(.22*uWash+.36*uAbrasion)*(.5+.5*sin(vLife*3.14159265)));')
s=s.replace('out float vSide,vAlpha;','out float vSide,vAlpha,vLife;').replace('vAlpha=sigma/filtered*taper;','vLife=aMeta.y;vAlpha=sigma/filtered*taper;').replace('in float vSide,vAlpha;','in float vSide,vAlpha,vLife;')
s=s.replace('return {vao,vb,ib,count:indices.length};','return {vao,vb,ib,count:indices.length,bufferBytes:(data.length+indices.length)*4};')
s=s.replace('closeSurface:{cotton:state.cotton','geometryBufferBytes:[...mainMeshes,carrierMesh,seams,looseMesh,hairs].reduce((a,m)=>a+(m?.bufferBytes||0),0)+instanceCounts.reduce((a,n)=>a+n*16,0),closeSurface:{cotton:state.cotton')
p.write_text(s)
p=D/'natural-yarn.js';s=p.read_text()
s=s.replace('const clamp=',"const Cotton=typeof KAOPUCottonSurface!=='undefined'?KAOPUCottonSurface:require('./cotton-surface.js');\nconst clamp=",1)
s=s.replace('const packing=1+.060*Math.cos(theta*3+t*pitch*1.3+ph)+.025*Math.cos(theta*7-t*pitch*.8+ph*.33);','const packing=Cotton.packing(theta,t*pitch,ph,g.p.cotton??.78);')
s=s.replace('j<6500','j<18000').replace('let extent=.16+H(j+13)**1.6*1.16','let extent=.22+H(j+13)**1.6*1.26')
s=s.replace('spin=angle+.26*u*Math.sin(phase)','spin=angle+u*(.18+.46*H(j+177))*Math.sin(phase)+.08*Math.sin(Math.PI*u)*Math.sin(phase+u*4.)')
s=s.replace('spin,.92+.08*Math.sin(Math.PI*u)','spin,.975+.055*Math.sin(Math.PI*u)**2')
s=s.replace("role:'surface',parentId:id","role:'surface',parentId:id,rootT:t")
s=s.replace('strand<3','strand<2').replace('(end-start)*pitch/6','(end-start)*pitch/3')
s=s.replace('slot*6/pitch+H(seed+8)*2/pitch','slot*3/pitch+H(seed+8)*1.1/pitch').replace('(3.+6.*H(seed+17))/pitch','(1.2+2.8*H(seed+17))/pitch').replace('Math.ceil((hi-lo)*1.8)','Math.ceil((hi-lo)*pitch/.14)')
s=s.replace('.90+.16*Math.sin(Math.PI*u)+.020*Math.sin(t*.9+phase)','.974+.074*Math.sin(Math.PI*u)**2+.009*Math.sin(t*1.17+phase)*Math.sin(Math.PI*u)')
s=s.replace("c.role==='sheath'?1:0","c.role==='sheath'||c.role==='surface'?1:0")
p.write_text(s)
p=D/'template.html';s=p.read_text().replace('R07','R08').replace('STABLE / COTTON','FINITE STAPLES').replace('连续纤维 · 稳定采样 · 灰棚','棉纱近景 · 短纤维 · 稳定采样')
s=s.replace('<section><h2>整理 / WASH & WEAR</h2>','''<section><h2>近景棉纱 / COTTON</h2><label>纱束非规整度<span id="cottonVal">0.78</span></label><input id="cotton" aria-label="纱束非规整度" type="range" min="0" max="1" step="0.01" value=".78"><label>有限短纤维层次<span id="stapleVal">0.72</span></label><input id="staple" aria-label="有限短纤维层次" type="range" min="0" max="1" step="0.01" value=".72"><label>贴面毛羽显露<span id="napVal">0.70</span></label><input id="nap" aria-label="贴面毛羽显露" type="range" min="0" max="1" step="0.01" value=".70"><p class="note">短纤维在父纱线上有限露出、错开起止。参数是外观候选，不是棉纱实测物性。</p></section><section><h2>整理 / WASH & WEAR</h2>''')
s=s.replace('/*NATURAL*/','/*COTTON*/\n/*NATURAL*/')
s=s.replace('</style>','@media(max-width:750px){#heading{top:12px;right:14px;left:14px;padding:5px 9px}#heading small{font-size:9px}#heading h1{font-size:17px;margin:2px 0}#heading p{font-size:9px}#tools{top:112px;gap:4px}#tools button{font-size:11px;padding:6px 8px}}\n</style>')
p.write_text(s)
p=D/'build.py';s=p.read_text().replace("[('SAMPLING','sampling.js')","[('COTTON','cotton-surface.js'),('SAMPLING','sampling.js')").replace('R07.0','R08.0').replace('r07/index','r08/index').replace('f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3','fa143743b1b0f3d74ff827664d06ff119ef87063').replace('R01-R06 unchanged','R01-R07 unchanged')
p.write_text(s)
print('R08 canonical sources generated; R07 source unchanged')
