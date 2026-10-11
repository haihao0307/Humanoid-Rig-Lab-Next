"""One-shot, hash-locked R06 -> R07 source migration. Later edit canonical sources/build.py."""
from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent;b=p.parent/'r06'
assert hashlib.sha256((b/'index.html').read_bytes()).hexdigest()=='ec4a548a9486e25be2838614cb3bf369590008cb1d85864c80647da3cbb83498','Wrong immutable R06 baseline'
for f in ['core.js','structure.js','fiber-optics.js','template.html','build.py','test-layers.cjs']:(p/f).write_bytes((b/f).read_bytes())
s=(b/'app.js').read_text()
def replace(a,z,count=1):
 global s
 assert s.count(a)==count,(a[:100],s.count(a),count)
 s=s.replace(a,z)
def block(a,z,new):
 global s
 i=s.index(a);j=s.index(z,i);s=s[:i]+new+s[j:]
replace('R06.0','R07.0',3)
replace("C=KAOPUDenimCore,Natural=KAOPUNaturalYarn", "C=KAOPUDenimCore,Natural=KAOPUNaturalYarn,Sampling=KAOPUDenimSampling")
replace('uniform float uFilterScale,uNearWeight;','uniform float uFilterScale,uNearWeight;')
block('vec3 fiberSurface(', '// Packed reflection', r'''// Periodic in angle, smooth in arc length. Integer angular harmonics avoid a UV seam.
float filteredCos(float phase){vec2 d=vec2(dFdx(phase),dFdy(phase))*uFilterScale;float fp=length(d);return cos(phase)*exp(-dot(d,d)/24.)*(1.-smoothstep(2.4,6.0,fp));}
vec3 fiberSurface(vec3 N,vec3 T,vec2 q,float seed,out float variation){
 float a=q.x,theta=q.y/.18;
 float migration=.34*sin(a*.73+seed*1.91)+.13*sin(a*1.71+seed*.47);
 float twist=a*(1.2+.45*hash(seed+12.))+migration;
 float bundle=filteredCos(theta*7.-twist*2.7+seed)*(.72+.28*sin(a*.51+seed));
 float fine=.55*filteredCos(theta*17.-twist*6.1+seed*2.3)+.30*filteredCos(theta*29.-twist*10.3+seed)+.15*filteredCos(theta*43.-twist*15.7+seed*3.9);
 vec3 B=normalize(cross(T,N));N=normalize(N+B*(bundle*.16+fine*.26));
 variation=1.+bundle*.16+fine*.21;
 return N;
}
''')
replace('vec3 surface=vec3(.045)*sheen*nl*(.45+.55*transverse);','vec3 surface=vec3(.045)*sheen*nl*(.45+.55*transverse)*(.70+.45*uFuzz);')
replace('float footprint=max(length(dFdx(vM)),length(dFdy(vM))),resolved=1.-smoothstep(.025,.15,footprint);','float footprint=max(length(dFdx(vM)),length(dFdy(vM)))*uFilterScale,resolved=1.-smoothstep(.035,.12,footprint);')
replace('col*=1.+resolved*.36*(staple-.5)+.24*(packingNoise-.5);','col*=1.+resolved*.23*(staple-.5)+.16*(packingNoise-.5)*(1.-smoothstep(.18,.65,footprint));')
replace('N=normalize(N+normalize(cross(T,N))*(staple-.5)*.48*resolved);','N=normalize(N+normalize(cross(T,N))*(staple-.5)*.24*resolved);')
replace('vec3 diffuseN=normalize(mix(vMacro*sign(dot(vMacro,uCam-vW)),N,.40));',r'''// Prefilter the same graph's colour on the real yarn surface, not a substitute plane.
float averaged=smoothstep(.45,1.4,footprint/uSize.z);vec2 uv=vM/uSize.xy+.5;
vec2 dx=dFdx(uv)*uFilterScale,dy=dFdy(uv)*uFilterScale;
vec4 meanColor=dot(vMacro,uCam-vW)>=0.?textureGrad(uFrontCol,uv,dx,dy):textureGrad(uBackCol,uv,dx,dy);
col=mix(col,meanColor.rgb/max(meanColor.a,.001),averaged*.92);
vec3 diffuseN=normalize(mix(vMacro*sign(dot(vMacro,uCam-vW)),N,.40*(1.-averaged*.8)));''')
# Continuous coverage and mean-normal treatment for the extreme-distance representation.
block('void main(){vec2 dx=dFdx(vUV)', '`;\nconst seamVS', r'''void main(){if(dot(vN,uCam-vW)<=0.)discard;
vec2 dx=dFdx(vUV)*uFilterScale,dy=dFdy(vUV)*uFilterScale;vec4 tex=textureGrad(uMap,vUV,dx,dy);if(tex.a<.0001)discard;
vec3 nTex=textureGrad(uNormalMap,vUV,dx,dy).xyz*2.-1.;vec3 N0=normalize(vN)*uBack;vec3 B=normalize(cross(vT,N0));mat3 b=mat3(B,normalize(vT),N0);
vec3 N=normalize(mix(normalize(vN),normalize(b*nTex),.10));vec3 c=tex.rgb/max(tex.a,.001);
O=vec4(tone(lighting(c,N,normalize(vT),vW,uFuzz)),tex.a);}
''')
replace('uniform float uMmPerPixel;','uniform float uMmPerPixel,uFocusDistance;')
replace('vec3 right=normalize(cross(normalize(uCam-vW),vT)+vec3(.00001));float r=aMeta.z,w=max(r,uMmPerPixel*.56);\nvAlpha=min(1.,r/w)*(1.-.75*pow(abs(aMeta.y*2.-1.),4.));vSide=aP.w;gl_Position=uVP*vec4(vW+right*aP.w*w,1.);',r'''vec3 right=normalize(cross(normalize(uCam-vW),vT)+vec3(.00001));
vec4 clip=uVP*vec4(vW,1.);float pixel=uMmPerPixel*max(.05,clip.w/uFocusDistance);
float r=aMeta.z,sigma=.55*r,filtered=sqrt(sigma*sigma+.1849*pixel*pixel),w=3.*filtered;
float taper=smoothstep(0.,.09,aMeta.y)*(1.-smoothstep(.74,1.,aMeta.y));
vAlpha=sigma/filtered*taper;vSide=aP.w;gl_Position=uVP*vec4(vW+right*aP.w*w,1.);''')
replace('float a=exp(-vSide*vSide*3.5)*vAlpha*min(1.,uFuzz*1.6);if(a<.004)discard;','float a=exp(-vSide*vSide*4.5)*vAlpha*min(1.,uFuzz*1.6);if(a<.00005)discard;')
replace('c=mix(c,vec3(.25,.239,.212),.20);','c=mix(c,vec3(.20,.193,.178),.10);')
# Fixed 16-crossing chunks prevent clipped damage spans from drawing whole-length tubes.
replace('float t=clamp(aP.x,aRange.x,aRange.y);','float t=clamp(aP.x+floor(aRange.x/16.)*16.,aRange.x,aRange.y);')
replace('vec3 local=yarnSection(t,theta,id,aP.z);',"float sectionScale=aP.z;int caps=int(aRange.w+.5);if(abs(aP.w)>.5&&(aP.w<0.?((caps&1)==0):((caps&2)==0)))sectionScale=0.;vec3 local=yarnSection(t,theta,id,sectionScale);")
replace('let m=tube(kind?graph.nx:graph.ny,step,sides);','let m=tube(16,step,sides);')
replace('const data=naturalData.spans[kind].flat();',"const data=[];for(const [start,end,id] of naturalData.spans[kind])for(let base=Math.floor(start/16)*16;base<end;base+=16){let lo=Math.max(start,base),hi=Math.min(end,base+16);data.push(lo,hi,id,(lo===start?1:0)+(hi===end?2:0));}")
# Arc-length fibre texture on released yarns, not a constant number of stripes per curve.
replace('vec2(vInfo.z*12.,angle*.08)','vec2(vInfo.z,angle*.18)')
replace('vInfo=aInfo;vDiameter=','vInfo=aInfo;vDiameter=')
replace('vec3(.46,.425,.35),vInfo.x>.5?.72:.33','vec3(.29,.276,.247),vInfo.x>.5?.50:.23')
replace('filterScale*1.3','filterScale')
# Bake all four attribute maps at rebuild. Capture is computed, never a downloaded asset.
block('let bakeSize=', '// A bounded 2x', r'''let bakeSize=1024;function bake(){bakeDirty=false;baked.forEach(t=>gl.deleteTexture(t));baked=[];
 let bt=Sampling.target(gl,bakeSize,bakeSize,false,null,0);gl.viewport(0,0,bakeSize,bakeSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);
 let w=graph.p.width,h=graph.p.height,oldFilter=filterScale;filterScale=1;
 for(let back of [1,-1])for(let mode of [1,2]){
  gl.bindFramebuffer(gl.FRAMEBUFFER,bt.draw);if(mode===2)gl.clearColor(.5,.5,back>0?1:0,1);else gl.clearColor(0,0,0,0);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);let view=new Float32Array([1,0,0,0,0,1,0,0,0,0,back,0,0,0,-10,1]);
  let vp=mul(ortho(-w/2,w/2,-h/2,h/2,.1,30),view);drawYarns(yarnProg,vp,[0,0,back*100],1,mode,true);Sampling.resolve(gl,bt);
  gl.bindFramebuffer(gl.FRAMEBUFFER,bt.read);gl.activeTexture(gl.TEXTURE4);let t=texture(bakeSize,bakeSize);baked.push(t);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,bakeSize,bakeSize);gl.generateMipmap(gl.TEXTURE_2D);
 }filterScale=oldFilter;gl.bindFramebuffer(gl.FRAMEBUFFER,null);Sampling.destroy(gl,bt);
}
''')
block('const hdr=', 'function perspective(', r'''const hdr=!!gl.getExtension('EXT_color_buffer_float');let screen,screenFbo,screenColor,screenW=0,screenH=0,farTexture=null;
let blit=program(`#version 300 es\nprecision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`,Sampling.finalShader);let emptyVAO=gl.createVertexArray();
function target(w,h){if(w===screenW&&h===screenH)return;screenW=w;screenH=h;
 if(farTexture){gl.deleteTexture(farTexture);farTexture=null;}screen=Sampling.target(gl,w,h,hdr,screen,4);screenFbo=screen.draw;screenColor=screen.color;}
function saveFarFrame(){Sampling.resolve(gl,screen);gl.bindFramebuffer(gl.FRAMEBUFFER,screen.read);gl.activeTexture(gl.TEXTURE6);
 if(!farTexture){farTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,farTexture);gl.texImage2D(gl.TEXTURE_2D,0,hdr?gl.RGBA16F:gl.RGBA8,screenW,screenH,0,gl.RGBA,hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}
 gl.bindTexture(gl.TEXTURE_2D,farTexture);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,screenW,screenH);
}
'''.replace('\\n','\n'))
# Replace the main render body; one/two representations share exact camera, cloth and loose fibers.
block("let lod='';function render", 'function request()', r'''let lod='';function render(time=0){pending=false;let start=performance.now();if(document.hidden)return;if(state.animate){if(last)clock+=Math.min((time-last)/1000,.05);last=time;}else last=0;
 let rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),cw=Math.max(1,Math.round(rect.width*ratio)),ch=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 if(bakeDirty&&!state.qaAudit)bake();if(!state.qaAudit)makeShadow();
 let ss=Math.max(1,Math.min(2,Math.sqrt((rect.width<700?1100000:2000000)/(cw*ch))));target(Math.round(cw*ss),Math.round(ch*ss));
 let {vp,eye,span,distance,projection}=camera(cw/ch),pixelsPerYarn=ch/span*graph.p.warpPitch,bodyPixels=ch/span*Math.max(graph.p.width,graph.p.height);
 let far=Sampling.farWeight(pixelsPerYarn,bodyPixels,state.qaForceYarns||state.qaAudit),useMip=far===1;filterScale=ss;nearWeight=1-far;
 longMorph=1.-Sampling.smooth(4,6,pixelsPerYarn);sideMorph=0;geomLevel=pixelsPerYarn>4?1:0;
 if(state.qaAudit){longMorph=0;geomLevel=1;}
 lod=useMip?'远景 · 同源像素积分':far>0?'远近连续过渡':geomLevel===1?'实体纱线 · 近景':'实体纱线 · 稳定采样';drawCount=0;
 function scene(mip){gl.bindFramebuffer(gl.FRAMEBUFFER,screenFbo);gl.viewport(0,0,screenW,screenH);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.clearColor(.071,.077,.084,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(!state.qaAudit)drawStudio(eye,cw/ch);
  if(mip){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   for(let side=0;side<2;side++){uniforms(surfProg,vp,eye);uf(surfProg,'uBack',side===0?1:-1);
    for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,baked[side*2+i]);ui(surfProg,i?'uNormalMap':'uMap',i);}
    gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);drawCount++;
   }gl.disable(gl.BLEND);
  }else drawYarns(yarnProg,vp,eye);
  if(!state.qaAudit&&looseMesh){uniforms(looseProg,vp,eye);gl.bindVertexArray(looseMesh.vao);gl.drawElements(gl.TRIANGLES,looseMesh.count,gl.UNSIGNED_INT,0);drawCount++;}
  if(state.seam){uniforms(seamProg,vp,eye);ui(seamProg,'uEdge',0);gl.bindVertexArray(seams.vao);gl.drawElements(gl.TRIANGLES,seams.count,gl.UNSIGNED_INT,0);drawCount++;}
  if(state.fuzz>.01){uniforms(hairProg,vp,eye);uf(hairProg,'uMmPerPixel',span/ch);uf(hairProg,'uFocusDistance',distance);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.bindVertexArray(hairs.vao);gl.drawElements(gl.TRIANGLES,hairs.count,gl.UNSIGNED_INT,0);gl.depthMask(true);gl.disable(gl.BLEND);drawCount++;}
 }
 if(far>0&&far<1){scene(true);saveFarFrame();}else if(farTexture){gl.deleteTexture(farTexture);farTexture=null;}
 scene(useMip);Sampling.resolve(gl,screen);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cw,ch);gl.disable(gl.DEPTH_TEST);gl.useProgram(blit);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,screenColor);ui(blit,'im',0);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,farTexture||dummyTex);ui(blit,'farIm',6);uf(blit,'farBlend',farTexture?far:0);gl.uniform2f(U(blit,'outputSize'),cw,ch);uf(blit,'exposure',state.exposure);ui(blit,'audit',state.qaAudit?1:0);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);drawCount++;frame++;
 $('status').textContent=`${graph.curves.length} 根纱线 · ${state.thickness.toFixed(2)} mm · ${lod}`;
 window.__DENIM_WORKBENCH__.lastFrame={frame,drawCalls:drawCount,lod,pixelsPerYarn,nearWeight,farWeight:far,bodyPixels,bakeSize,sparseEdgeFibers:fiberCount,projection,distanceMm:distance,studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure,shadowSize,shadowDrawCalls,shadowTriangles,backgroundOnlyFog:true},colorPipeline:hdr?'linear-RGBA16F-single-tonemap':'linear-RGBA8-single-tonemap',sampling:{msaaSamples:screen.samples,supersampleRatio:ss,outputIntegration:'4x4 linear pixel footprint',temporalHistory:false,attachmentBytes:screen.attachmentBytes+(farTexture?screenW*screenH*(hdr?8:4):0),note:'attachments only; excludes geometry, mipmaps, driver and browser memory'},scatter:{strength:state.scatter,transmission:state.transmission,kernel:optics.reflectance},structureWarp:state.structure,solidEdgeDrawn:false,geometryOnly:far===0,longMorph,sideMorph,geomLevel,natural:Natural.audit(naturalData),looseTriangles:looseMesh.count/3,brokenEnds:brokenEnds.length,instanceCounts:[...instanceCounts],renderTarget:[screenW,screenH],cpuSubmitMs:performance.now()-start,triangles:(useMip?(carrierMesh.count*2)/3:(mainMeshes[geomLevel*2].count*instanceCounts[0]+mainMeshes[geomLevel*2+1].count*instanceCounts[1])/3)+(!state.qaAudit&&looseMesh?looseMesh.count/3:0)+(state.seam?seams.count/3:0)+(state.fuzz>.01?hairs.count/3:0),transitionDoublePass:far>0&&far<1};if(state.animate)request();
}
''')
replace("state.zoom=2.35;state.panX=3", "state.zoom=5.2;state.panX=3")
replace('Math.min(4.5,state.zoom', 'Math.min(6.,state.zoom')
replace("$('rimReview').onclick=", "$('farReview').onclick=()=>{state.zoom=.22;state.panX=0;state.panY=0;request();};\n$('rimReview').onclick=")
replace("schema:'kaopu.denim_material_profile@2.4'","schema:'kaopu.denim_material_profile@2.5'")
replace("ribbons:'tangent-oriented gaussian coverage'", "ribbons:'perspective-correct Gaussian pixel convolution; integral-preserving opacity',sampling:'offscreen MSAA + linear pixel integration + continuous extreme-distance same-graph LOD; no temporal accumulation'")
replace('KAOPU_Denim_R06_Profile','KAOPU_Denim_R07_Profile')
replace('getGLError:()=>gl.getError()', 'getGLError:()=>gl.isContextLost()?37442:gl.getError()')
replace('})();', "canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.animate=false;window.__DENIM_WORKBENCH__.ready=false;window.__DENIM_WORKBENCH__.contextLost=true;$('error').hidden=false;$('error').textContent='图形上下文已丢失，请重新载入页面。此状态不属于有效渲染。';});\n})();")
(p/'app.js').write_text(s)
# Retain exact parent endpoint IDs. Interpolating Hermite subdivision removes polygonal hair kinks.
n=(b/'natural-yarn.js').read_text()
helper=r'''
function smoothCurve(points,subdivisions=2){if(points.length<3)return points.map(p=>[...p]);const out=[];
 for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],m0=mul(sub(b,points[Math.max(0,i-1)]),i===0?1:.45),m1=mul(sub(points[Math.min(points.length-1,i+2)],a),i+2>=points.length?1:.45);
  for(let j=0;j<subdivisions;j++){let t=j/subdivisions,t2=t*t,t3=t2*t;out.push(a.map((v,k)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*m0[k]+(-2*t3+3*t2)*b[k]+(t3-t2)*m1[k]));}}
 out.push([...points.at(-1)]);return out;
}
'''
n=n.replace('function generate(C,g,damage,fray=1){',helper+'function generate(C,g,damage,fray=1){')
n=n.replace('const stats={...p.stats',"for(const c of [...tubes,...fibers])if(c.role!=='surface'&&c.role!=='clumped'&&c.role!=='stray')c.points=smoothCurve(c.points,2);\n const stats={...p.stats")
n=n.replace(".7+.7*H(seed+51)",".62+.48*H(seed+51)")
n=n.replace(".17*Math.sin(t*.81+phase)",".24*Math.sin(t*.31+phase)+.09*Math.sin(t*.83+phase*.7)")
n=n.replace(".84+.30*Math.sin(Math.PI*u)+.035*Math.sin(t*1.7+phase)",".84+.25*Math.sin(Math.PI*u)+.025*Math.sin(t*.9+phase)")
n=n.replace("for(const c of curves){let off=vertices.length/12;for(let j=0;j<c.points.length;j++){", "for(const c of curves){let off=vertices.length/12,arc=0;for(let j=0;j<c.points.length;j++){if(j)arc+=len(sub(c.points[j],c.points[j-1]));")
n=n.replace('1-.78*t*t','1-.93*sm(t)')
n=n.replace('...T,c.kind,c.id,t);','...T,c.kind,c.id,arc);')
n=n.replace('tubeMesh,hairMesh,audit,H','tubeMesh,hairMesh,audit,H,smoothCurve')
(p/'natural-yarn.js').write_text(n)
t=(p/'template.html').read_text().replace('R06','R07').replace('LAYERED / COTTON','STABLE / COTTON')
t=t.replace('<script>','<script>/*SAMPLING*/</script><script>',1)
t=t.replace('<button id="detail">材质近看</button>', '<button id="detail">材质近看</button><button id="farReview">远景检查</button>')
t=t.replace('棉纤维散射 · 灰棚 · 自然织造','连续纤维 · 稳定采样 · 灰棚')
t=t.replace('破损样布始终保留实体纱线，不另造花纹。','极远处的破损同样由本片纱线捕获覆盖率，纱桥与断丝仍是曲线。远近过渡在线性光中连续混合，不另造花纹。')
t=t.replace('裁口有稀疏的纤维曲线；','细曲线使用连续插值和保积分像素覆盖；')
t=t.replace('真实力学、水洗实验标定、人体接触和影视镜头对标尚未完成。','离屏多重采样会增加显存和绘制开销，极远过渡区需双路绘制；无跨帧叠加。真实力学、水洗实验标定、人体接触和影视镜头对标尚未完成。')
(p/'template.html').write_text(t)
build=(p/'build.py').read_text().replace("[('OPTICS'","[('SAMPLING','sampling.js'),('OPTICS'").replace('R06.0','R07.0').replace('cca5466b1e58b09a9a5c1ce75ea47ee142eafbcb','f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3').replace('denim-workshop/r06','denim-workshop/r07').replace('R01-R05 unchanged','R01-R06 unchanged')
build=build.replace("'filmGradeValidated':False", "'sampling':'offscreen MSAA, Gaussian curve coverage, linear pixel integration, continuous far LOD','filmGradeValidated':False")
(p/'build.py').write_text(build)
test=(p/'test-layers.cjs').read_text().replace("ok(app.includes('state.damage===0')&&app.includes('<180'),'Far-only intact captures');", "ok(app.includes('Sampling.farWeight')&&app.includes('saveFarFrame'),'Continuous same-source far captures');")
test=test.replace("app.includes('uniform float exposure')","require('./sampling.js').finalShader.includes('uniform float exposure')")
(p/'test-layers.cjs').write_text(test)
print('R07 canonical sources created from the frozen R06. No other files changed.')
