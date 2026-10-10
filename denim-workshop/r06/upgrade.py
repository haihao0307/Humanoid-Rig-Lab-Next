from pathlib import Path
import re,hashlib,json
p=Path(__file__).resolve().parent
base=(p.parent/'r05'/'index.html').read_text()
assert hashlib.sha256(base.encode()).hexdigest()=='f2de9b5567c49c8085e460baeddf4b3924dfe3f0e9e2db82489453c88868fc92'
core,both=re.findall(r'<script>([\s\S]*?)</script>',base);i=both.index('/* R05.0');nat,app=both[:i],both[i:]
template=base.replace(core,'/*CORE*/').replace(both,'/*NATURAL*/\n/*APP*/')
def rep(old,new):
 global app
 assert old in app,old[:100]
 app=app.replace(old,new)
def region(start,end,new):
 global app
 i=app.index(start);j=app.index(end,i);app=app[:i]+new+app[j:]
rep('const common=`','const optics=KAOPUFiberOptics.integrate();const common=`')
rep('fog:.65,seam:true','fog:.65,scatter:.85,transmission:.55,structure:1,seam:true')
rep('vec3 carrier(vec2 m){','vec3 carrierRaw(vec2 m){');rep('mat3 basis(vec2 m){','mat3 basisRaw(vec2 m){')
rep('const vs=`', 'const vs=`')
# Append shared material binding after the inherited carrier and its derivatives.
rep('return mat3(dx,dy,normalize(cross(dx,dy)));}\n`;', 'return mat3(dx,dy,normalize(cross(dx,dy)));}\n${KAOPUClothStructure.glsl}\n`;')
# Approximation should change shading without adding a replacement surface.
region('vec3 cottonLight(', '\n`;\nconst fs=',(p/'scattering.glsl').read_text())
# Material-space irregularity not arbitrary per-frame noise.
rep('clamp(irregular,.79,1.03)','clamp(irregular,.84,1.09)')
# Remove hard discontinuities at the light-facing half of each tube.
rep('mix(vMacro*sign(dot(N,vMacro)),N,.55)', 'mix(vMacro*sign(dot(vMacro,uCam-vW)),N,.40)')
# packed warp/weft contrast softened; still distinct yarn identity and dye layers
rep('vec3 blue=vec3(.019,.041,.071),core=vec3(.115,.110,.098);','vec3 blue=vec3(.022,.040,.068),core=vec3(.100,.100,.092);')
rep('warp*=.84+.25*along+.16*noise1(id*.321+29.);','warp*=.78+.34*along+.24*noise1(id*.321+29.);')
rep('warp*=.94+.12*noise1(m.y*.38+id*7.17);','warp*=.90+.22*noise1(m.y*.38+id*7.17);')
# output linear radiance for all shaders, tone map once after blending and downsample.
region('vec3 tone(vec3 x){','float hash2(', 'vec3 tone(vec3 x){return max(x,vec3(0));}\n')
rep('let screenFbo,screenColor',"const hdr=!!gl.getExtension('EXT_color_buffer_float');let screenFbo,screenColor")
rep('uniform sampler2D im;in vec2 uv;out vec4 O;void main(){O=texture(im,uv);}', '''uniform sampler2D im;uniform float exposure;uniform int audit;in vec2 uv;out vec4 O;void main(){vec3 c=texture(im,uv).rgb;if(audit==0){c*=exposure;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);c=pow(clamp(c,0.,1.),vec3(1./2.2));}O=vec4(c,1); }''')
rep('screenColor=texture(w,h);gl.bindTexture(gl.TEXTURE_2D,screenColor);','screenColor=texture(w,h);gl.bindTexture(gl.TEXTURE_2D,screenColor);if(hdr)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);')
rep("ui(blit,'im',0);", "ui(blit,'im',0);uf(blit,'exposure',state.exposure);ui(blit,'audit',state.qaAudit?1:0);")
rep("mat(p,'uVP',vp);shadowUniforms(p);", "mat(p,'uVP',vp);uf(p,'uScatter',state.scatter);uf(p,'uTransmit',state.transmission);uf(p,'uStructure',flat?0:state.structure);v3(p,'uDiffusionR',optics.reflectance);v3(p,'uDiffusionCenter',optics.weights[0]);shadowUniforms(p);")
# Actual fiber identity and diameter. Normals store radius for loose strands.
rep('out vec3 vW;out vec3 vN;out vec3 vT;out vec3 vInfo;out vec2 vM;', 'out vec3 vW;out vec3 vN;out vec3 vT;out vec3 vInfo;out vec2 vM;out float vDiameter;')
rep('vInfo=aInfo;gl_Position=', 'vInfo=aInfo;vDiameter=2.*length(aNormal);gl_Position=')
rep('in vec3 vW;in vec3 vN;in vec3 vT;in vec3 vInfo;in vec2 vM;out vec4 O;', 'in vec3 vW;in vec3 vN;in vec3 vT;in vec3 vInfo;in vec2 vM;in float vDiameter;out vec4 O;')
rep('lighting(col,softN,T,vW,.9)','layeredLighting(col,softN,T,vW,.9,vDiameter)')
# Fine ribbons: smooth projected-width coverage, correct fiber identity.
rep('in vec4 aP;in vec3 aMeta;in vec3 aTangent;', 'in vec4 aP;in vec4 aMeta;in vec4 aTangent;')
rep('out float vSide,vAlpha;flat out float vFamily;', 'out float vSide,vAlpha;flat out float vFamily,vId,vDiameter;')
rep('vT=normalize(b*aTangent);vFamily=aMeta.x;', 'vT=normalize(b*aTangent.xyz);vFamily=aMeta.x;vId=aMeta.w;vDiameter=2.*aMeta.z;')
rep('vAlpha=min(1.,r/w)*(1.-.65*aMeta.y*aMeta.y);', 'vAlpha=min(1.,r/w)*(1.-.75*pow(abs(aMeta.y*2.-1.),4.));')
rep('flat in float vFamily;out vec4 O;', 'flat in float vFamily,vId,vDiameter;out vec4 O;')
rep('yarnColor(vM,vFamily,23.,1.)','yarnColor(vM,vFamily,vId,1.)')
rep('vec3 lit=lighting(c,N,normalize(vT),vW,.9);', '''vec3 T=normalize(vT),R=safeUnit(vec3(40,95,-110)-vW);float shadow=visibilityTap(vW);
vec3 lit=(fiberReflect(c,N,T,V,L)+fiberTransmission(c,N,T,V,L,vDiameter))*uKeyColor*(.7+.3*shadow);
vec3 rim=uLight==4?vec3(3.2,3.35,3.55):vec3(.50,.55,.65);
lit+=(fiberReflect(c,N,T,V,R)+fiberTransmission(c,N,T,V,R,vDiameter))*rim;
lit+=c*(.32+uScatter*.25);''')
rep('lit+=c*uKeyColor*(.08*cyl+.04*pow(sat(dot(-L,V)),3.));','// Transmission now comes from finite optical depth, not an added unshadowed wire highlight.\n')
rep("hairs=mesh(hd.vertices,hd.indices,hairProg,'aP',4,10)","hairs=mesh(hd.vertices,hd.indices,hairProg,'aP',4,12)")
rep('gl.vertexAttribPointer(am,3,gl.FLOAT,false,40,16)','gl.vertexAttribPointer(am,4,gl.FLOAT,false,48,16)')
rep('gl.vertexAttribPointer(ht,3,gl.FLOAT,false,40,28)','gl.vertexAttribPointer(ht,4,gl.FLOAT,false,48,32)')
rep("shadowTriangles,backgroundOnlyFog:true}", "shadowTriangles,backgroundOnlyFog:true},colorPipeline:hdr?'linear-RGBA16F-single-tonemap':'linear-RGBA8-single-tonemap',scatter:{strength:state.scatter,transmission:state.transmission,kernel:optics.reflectance},structureWarp:state.structure")
rep('state.animate?clock:0].join', 'state.structure,state.animate?clock:0].join')
rep('if(state.light===3){keyPos=', 'if(state.light===4){keyPos=[-95,95,140];keyColor=[.55,.58,.65];fillColor=[.22,.23,.26];}\n if(state.light===3){keyPos=')
# Finite staples replace full-length regular wire helices. Migrate in/out of yarn.
a=nat.index(' // Representative outer staple');e=nat.index(' const stats=',a)
nat=nat[:a]+''' // Finite outer staples. Radius migration buries the ends in the parent,
 // rather than drawing three uninterrupted metallic helices for its full length.
 for(let kind=0;kind<2;kind++)for(const span of p.spans[kind]){
  let [start,end,id]=span,pitch=kind?g.p.warpPitch:g.p.weftPitch;
  for(let strand=0;strand<2;strand++)for(let slot=0;slot<Math.ceil((end-start)*pitch/6);slot++){
   let seed=id*311+kind*989+strand*127+slot*383,phase=H(seed+31)*6.283;
   let lo=start+slot*6/pitch+H(seed+8)*2/pitch,hi=Math.min(end,lo+(3.+6.*H(seed+17))/pitch);if(hi<=lo)continue;
   let pts=[],steps=Math.max(8,Math.ceil((hi-lo)*1.8));
   for(let j=0;j<=steps;j++){
    let u=j/steps,t=mix(lo,hi,u),q=organicPoint(C,g,kind,id,t),theta=phase+t*pitch*(.7+.7*H(seed+51))+.17*Math.sin(t*.81+phase);
    let deriv=(C.sample(g.d,kind,id,t+.01)-C.sample(g.d,kind,id,t-.01))*g.lift/(.02*pitch);
    let T=norm(kind?[1,0,deriv]:[0,1,deriv]),B=kind?[0,1,0]:[1,0,0],V=norm(kind?cross(T,B):cross(B,T));
    let ph=id+kind*79,bulge=.5+.5*Math.sin(t*.107+ph*.63);
    let ra=kind?g.p.weftPitch*.235:g.p.warpPitch*.49,rz=g.rz*(kind?.68:1);
    let migrate=.84+.30*Math.sin(Math.PI*u)+.035*Math.sin(t*1.7+phase);
    q=add(q,add(mul(B,ra*migrate*Math.cos(theta)),mul(V,rz*migrate*Math.sin(theta))));pts.push(q);
   }
   const c={points:pts,kind,radius:.005+.0035*H(seed+21),group:`sheath:${kind}:${id}`,role:'sheath',parentId:id};fibers.push(c);
  }
 }
''' +nat[e:]
# Decimate short surface flyaway population but improve actual placement and brightness.
nat=nat.replace('j<11500','j<6500')
nat=nat.replace("fiber(pts,kind,.005+.005*H(j+414),`surface:${Math.floor(j/5)}`,'surface');", "fibers.push({points:pts,kind,radius:.004+.004*H(j+414),group:`surface:${Math.floor(j/5)}`,role:'surface',parentId:id});")
# Radial clump cohesion expands unevenly toward ends, preserving current roots.
nat=nat.replace("vertices.push(...pos,...n,...T,c.kind,c.id,t)","vertices.push(...pos,...mul(n,r),...T,c.kind,c.id,t)")
a=nat.index('function hairMesh(');e=nat.index('function audit(',a)
nat=nat[:a]+'''function hairMesh(fibers){let vertices=[],indices=[];
 for(const c of fibers){let off=vertices.length/12;
  for(let j=0;j<c.points.length;j++){let t=j/(c.points.length-1),T=norm(sub(c.points[Math.min(j+1,c.points.length-1)],c.points[Math.max(0,j-1)]));
   for(const side of [-1,1])vertices.push(...c.points[j],side,c.kind,t,c.radius,c.parentId??23,...T,c.role==='sheath'?1:0);
  }for(let j=0;j<c.points.length-1;j++){let k=off+j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
 }return {vertices,indices};}
''' +nat[e:]
# Ragged contour: irregular scan bounds, rather than a perfect ellipse.
a=nat.index('function windowAt(');e=nat.index('function plan(',a)
nat=nat[:a]+'''function contour(damage){const rx=damage===4?30.5:22,ry=damage===4?14.5:9.2;let points=[];
 for(let j=0;j<128;j++){const t=j/128*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
  const r=1+.105*Math.sin(3*t+.82)+.070*Math.sin(7*t+1.39)+.028*Math.sin(13*t+.51);
  points.push([4+rx*Math.sign(c)*Math.abs(c)**.78*r+1.1*Math.sin(5*t),-1+ry*Math.sign(s)*Math.abs(s)**.91*r+1.2*Math.cos(4*t+.7)]);
 }return points;}
function windowAt(g,kind,id,damage){if(damage<2)return null;const full=kind?g.nx:g.ny;
 let m=kind?(id+.5)*g.p.weftPitch-g.p.height/2:(id+.5)*g.p.warpPitch-g.p.width/2;
 const points=contour(damage),hits=[],axis=kind?1:0;
 for(let j=0;j<points.length;j++){let a=points[j],b=points[(j+1)%points.length];if((a[axis]<=m&&b[axis]>m)||(b[axis]<=m&&a[axis]>m)){let u=(m-a[axis])/(b[axis]-a[axis]);hits.push(mix(a[1-axis],b[1-axis],u));}}
 if(hits.length<2)return null;hits.sort((a,b)=>a-b);
 const pitch=kind?g.p.warpPitch:g.p.weftPitch,origin=kind?g.p.width/2:g.p.height/2;
 return [clamp((hits[0]+origin)/pitch,.08,full-.08),clamp((hits.at(-1)+origin)/pitch,.08,full-.08)];}
''' +nat[e:]
rep('qaAudit:true,qaForceYarns:true','qaAudit:true,structure:0,qaForceYarns:true')
# Late exports and controls.
rep("for(const key of ['exposure','fog'])", "for(const key of ['exposure','fog','scatter','transmission'])")
rep("display:{shape:state.shape", "display:{shape:state.shape")
rep("fiberModel:{body:", "fiberModel:{structureWarp:state.structure,diffusion:optics,scatterStrength:state.scatter,transmissionStrength:state.transmission,body:")
rep("scatter:'bounded real-time approximation, not Jensen dipole'", "scatter:'Jensen radial kernel quadrature plus finite-depth single transmission; local real-time approximation, not full calibrated BSSRDF'")
rep("$('showFray').onclick=", "$('rimReview').onclick=()=>{state.light=4;state.zoom=1.45;state.yaw=-.3;state.pitch=.18;state.panX=4;state.panY=-1;updateText();request();};\n$('showFray').onclick=")
rep("getGraph:()=>graph,", "getOptics:()=>optics,getGraph:()=>graph,")
app=app.replace('R05.0','R06.0').replace('KAOPU_Denim_R05','KAOPU_Denim_R06').replace('@2.3','@2.4')
template=template.replace('R05','R06').replace('FIBER / STUDIO','LAYERED / COTTON').replace('棉纤维 · 柔光灰棚 · 真实纱桥','棉纤维散射 · 灰棚 · 自然织造')
template=template.replace('/*CORE*/','/*OPTICS*/\n/*STRUCTURE*/\n/*CORE*/')
# Add the fifth inspection light without replacing the existing four lights.
idx=template.index('<select id="light"');end=template.index('</select>',idx)
template=template[:end]+'<option value="4">纤维逆光 / 散射检查</option>'+template[end:]
end=template.index('<label>棚景曝光')
template=template[:end]+'''<label>束内柔散射 <span id="scatterVal">0.85</span></label><input id="scatter" type="range" min="0" max="1" step="0.01" value=".85"><label>细纤维透光 <span id="transmissionVal">0.55</span></label><input id="transmission" type="range" min="0" max="1" step="0.01" value=".55">'''+template[end:]
template=template.replace('<button id="full">','<button id="rimReview">纤维逆光</button><button id="full">')
for name,text in [('app.js',app),('natural-yarn.js',nat),('core.js',core),('template.html',template)]: (p/name).write_text(text)
s=template
for k,f in [('OPTICS','fiber-optics.js'),('STRUCTURE','structure.js'),('CORE','core.js'),('NATURAL','natural-yarn.js'),('APP','app.js')]:s=s.replace('/*'+k+'*/',(p/f).read_text())
(p/'index.html').write_text(s)
print('R06',len(s.encode()),hashlib.sha256(s.encode()).hexdigest())
