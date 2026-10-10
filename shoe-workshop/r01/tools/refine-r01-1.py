"""One-time, checked source migration from the preserved R01 source to R01.1.
The resulting ordinary source files are committed with the verified build.
This is not a runtime patch. Never mutates the human source or main branch.
"""
from pathlib import Path
import hashlib,json,re
root=Path(__file__).resolve().parents[1]
stamp=root/'R01_1_SOURCE_UPGRADE.json'
if stamp.exists():
    print('R01.1 source migration already recorded; current authored sources retained')
    raise SystemExit(0)
paths=['src/geometry.mjs','src/app.mjs','src/materials.mjs','tools/build.mjs','tools/test.mjs']
before={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
p=root/'src/geometry.mjs';s=p.read_text()
a=s.index('export function shoeLast(');b=s.index('export function createShoe(',a)
s=s[:a]+"export {shoeLast} from './design-envelope.mjs';\n"+s[b:]
s="import {shoeLast} from './design-envelope.mjs';\n"+s
s=s.replace('for(let i=1;i<=180;i++)idx.push(0,i+1,i);',"for(let i=1;i<=180;i++){if(name==='完整足床')idx.push(0,i,i+1);else idx.push(0,i+1,i);}")
s=s.replace("  upper.add(makeMesh(shell,[pal.skin,pal.lining],'有厚度的连续鞋面'));", "  const colors=[];const pa=shell.attributes.position;for(let k=0;k<pa.count;k++){const z=pa.getZ(k)/L,amount=style.sneaker?1:(1-.25*Math.exp(-Math.pow((z-.95)/.18,2))-.10*Math.exp(-Math.pow((z-.04)/.16,2)));colors.push(amount,amount,amount);}shell.setAttribute('color',new T.Float32BufferAttribute(colors,3));\n  const shellMat=pal.skin.clone();shellMat.vertexColors=true;root.userData.extraMaterials=[shellMat];upper.add(makeMesh(shell,[shellMat,pal.lining],'有厚度的连续鞋面'));")
a=s.index('  if(style.cap){');b=s.index('\n  }',a)
s=s[:a]+'''  if(style.cap){
   const contour=offset=>Array.from({length:100},(_,i)=>{const u=i/99*2-1,z=L*.79+offset+.0028*scale*(1-u*u),x=S.center(z/L)+S.width(z/L)*u*.985;return V(x,S.upperAt(x,z)+.0007*scale,z);});
   seams.add(tube(contour(0),.00042*scale,pal.edge,'帽头拼接边'));
   for(const off of [-.0018,-.0043])seams.add(stitches(contour(off*scale),pal.thread,.0031*scale,.00017*scale));'''+s[b:]
a=s.index('  const z0=',s.index(' if(style.lace){'));b=s.index("  upper.add(makeMesh(solidPatch(tongueFn",a)
s=s[:a]+'''  const z0=L*.71,z1=L*.46,tw=.018*scale;
  const tongueFn=(u,v)=>{const z=lerp(z0,z1,v),x=(u-.5)*tw*2.04+S.center(z/L);return V(x,S.upperAt(x,z)+.0032*scale,z);};
'''+s[b:]
a=s.index('   const panel=');b=s.index('\n',a)
s=s[:a]+'''   const panel=(u,v)=>{const z=lerp(L*.72,L*.47,v),xin=sign*tw,xout=sign*(tw+.013*scale+.006*scale*Math.sin(v*PI)),x=lerp(xout,xin,u)+S.center(z/L),y=S.upperAt(x,z)+.0050*scale;return V(x,y,z);};'''+s[b:]
a=s.index('  const saddle=');b=s.index('\n',a)
s=s[:a]+'''  const saddle=(u,v)=>{const z=L*(.59+(v-.5)*.09),x=S.center(z/L)+(u-.5)*S.width(z/L)*1.82;return V(x,S.upperAt(x,z)+.003*scale,z);};'''+s[b:]
a=s.index('   const strap=');b=s.index('\n',a)
s=s[:a]+'''   const strap=(u,v)=>{const zz=z+(v-.5)*span,s=zz/L,x=S.center(s)+(u-.5)*S.width(s)*2.08,y=S.upperAt(x,zz)+.0055*scale;return V(x,y,zz);};'''+s[b:]
s=s.replace('root.userData={style:', 'root.userData={extraMaterials:root.userData.extraMaterials||[],style:').replace('soleHeight:bottom}', 'soleHeight:bottom,minimumSampleClearance:S.minimumSampleClearance,roofRange:S.roofRange}')
s=s.replace('group.clear();}', 'for(const m of group.userData.extraMaterials||[])m.dispose();group.clear();}')
p.write_text(s)
p=root/'src/app.mjs';s=p.read_text().replace("const VERSION='R01.0'", "const VERSION='R01.1'")
s=re.sub(r'dirty=\d+', 'dirty=1',s).replace('controls.enableDamping=true','controls.enableDamping=false')
s=s.replace('renderer.debug.checkShaderErrors=true;', 'renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.debug.checkShaderErrors=true;')
s=s.replace('rebuildCount++;dirty=1;', 'rebuildCount++;renderer.shadowMap.needsUpdate=true;dirty=1;')
s=s.replace("key.color.set(warm?'#ffe2b1':'#fff7e8');dirty=1;", "key.color.set(warm?'#ffe2b1':'#fff7e8');renderer.shadowMap.needsUpdate=true;dirty=1;")
s=s.replace('renderer.setSize(r.width,r.height);', 'if(renderer.domElement.width!==Math.round(r.width*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(r.height*renderer.getPixelRatio()))renderer.setSize(r.width,r.height,false);')
s=s.replace('dark?1.25:warm?1.08:1.14','dark?1.0:warm?.96:1.02').replace('R.toneMappingExposure=1.12','R.toneMappingExposure=1.02')
s=s.replace('scene.environment=makeEnvironment(renderer);','scene.environment=makeEnvironment(renderer);scene.environmentIntensity=.72;').replace("const s=new T.Scene();s.background", "const s=new T.Scene();s.environmentIntensity=.72;s.background")
s=s.replace('if(s.source&&s.source.commit!==pack.sourceCommit)', 'if(s.source&&(s.source.commit!==pack.sourceCommit||s.source.sourceModelSha256!==pack.sourceModelSha256))')
s=s.replace("if(!['studio','wear','person','exploded','measure','last'].includes(s.mode)","if(!['hero','side','front','top','sole','macro'].includes(s.view)||!['studio','wear','person','exploded','measure','last'].includes(s.mode)")
s=s.replace("'R01 · 6 种结构", "'R01.1 · 6 种结构")
p.write_text(s)
p=root/'src/materials.mjs';p.write_text(p.read_text().replace('roughness:.36,clearcoat:.25,clearcoatRoughness:.28','roughness:.43,clearcoat:.15,clearcoatRoughness:.32'))
p=root/'tools/build.mjs';s=p.read_text().replace("version:'R01.0'","version:'R01.1'").replace("'src/geometry.mjs','src/materials.mjs'","'src/geometry.mjs','src/design-envelope.mjs','src/materials.mjs'")
p.write_text(s)
p=root/'tools/test.mjs';s=p.read_text().replace("await page.locator('#viewport canvas').screenshot()", "await page.screenshot({timeout:90000})")
s=s.replace("const settle=async()=>{await page.evaluate(()=>SHOE_QA.render());await page.waitForTimeout(180);};", "const settle=async()=>{await page.waitForTimeout(160);await page.evaluate(()=>SHOE_QA.render());};")
s=s.replace("await page.screenshot({path:path.join(evidence,'01-derby-desktop.png')});", "await page.screenshot({path:path.join(evidence,'01-derby-desktop.png'),timeout:90000});")
s=s.replace("s.invalid===0&&s.person===person&&s.mode==='wear'", "s.invalid===0&&s.person===person&&s.mode==='wear'&&s.shoeDimensions.every(d=>d.minimumSampleClearance>=0)")
s=s.replace("check('no-javascript-or-shader-errors'", "const idle1=await page.evaluate(()=>SHOE_QA.stats().rendered);await page.waitForTimeout(700);const idle2=await page.evaluate(()=>SHOE_QA.stats().rendered);check('static-view-does-not-redraw',idle2-idle1<=1,{idle1,idle2});\n check('no-javascript-or-shader-errors'")
p.write_text(s)
stamp.write_text(json.dumps({'schema':'kaopu-shoe-source-upgrade/1','from':'043ee50c0956dd2150913e77497ff219f37f98f7','to':'R01.1','before':before,'after':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}},indent=2))
print('R01.1 source files upgraded; browser and visual QA still required')
