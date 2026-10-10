from pathlib import Path
import re,hashlib,json
p=Path(__file__).resolve().parent
base=p.parent/'r04'/'index.html'
if not base.exists(): base=Path('/mnt/data/Denim_Material_Workbench_R04.html')
s=base.read_text();assert hashlib.sha256(s.encode()).hexdigest()=='1535f35e53c75091dad619489cc352cd5a9b8647618225043d08f0f458aea515'
core,both=re.findall(r'<script>([\s\S]*?)</script>',s);cut=both.index('/* R04.0');natural,app=both[:cut],both[cut:]
template=s.replace(core,'/*CORE*/').replace(both,'/*NATURAL*/\n/*APP*/')
def rep(a,b):
 global app
 assert a in app,a[:100]
 app=app.replace(a,b)
def region(a,b,new):
 global app
 i=app.index(a);j=app.index(b,i);app=app[:i]+new+app[j:]
rep('shape:1,light:0,seam:true','shape:1,light:2,exposure:1,fog:.65,seam:true')
region('const shade=`','const fs=`', 'const shade=`'+(p/'cotton.glsl').read_text()+'`;\n')
# Preserve exact crossing logic; lower crosswise fill-yarn diameter and introduce
# a low-amplitude carrier relief shared by yarns, rooted frays and seams.
core=core.replace('p.weftPitch*.30','p.weftPitch*.235')
rep('uSize.w*.30','uSize.w*.235')
rep('vec3 delta=B*ra*cs.x*scale+N*rz*cs.y*scale;','float packing=1.+.060*cos(theta*3.+t*pitch*1.3+ph)+.025*cos(theta*7.-t*pitch*.8+ph*.33);vec3 delta=(B*ra*cs.x*scale+N*rz*cs.y*scale)*packing;')
relief='''float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(dot(i,vec2(41,137))),hash(dot(i+vec2(1,0),vec2(41,137))),f.x),mix(hash(dot(i+vec2(0,1),vec2(41,137))),hash(dot(i+1.,vec2(41,137))),f.x),f.y);}
float relief(vec2 m){return .13*sin(m.x*.293+m.y*.187)*sin(m.y*.117+1.31)+.07*sin(m.x*.131-m.y*.337+.79);}
'''
rep('vec3 carrier(vec2 m){', relief+'vec3 carrier(vec2 m){')
rep('return vec3(x,y,z);}', 'return vec3(x,y,z+relief(m));}')
rep('vec3 dx=vec3(1,0,zx),dy=vec3(0,yy,zy);','float a=m.x*.293+m.y*.187,b=m.y*.117+1.31,c=m.x*.131-m.y*.337+.79;zx+=.03809*cos(a)*sin(b)+.00917*cos(c);zy+=.02431*cos(a)*sin(b)+.01521*sin(a)*cos(b)-.02359*cos(c);vec3 dx=vec3(1,0,zx),dy=vec3(0,yy,zy);')
region('void main(){if(uAudit==1)', '\n\n\n`;', '''void main(){if(uShadowPass==1){O=vec4(1);return;}if(uAudit==1){O=vKind==0?vec4(1,0,0,1):vec4(0,1,0,1);return;}
vec3 N=normalize(vN),T=normalize(vT);float variation;float pitch=vKind==0?uSize.w:uSize.z;
N=fiberSurface(N,T,vec2(vLocal.x*pitch,vLocal.y*.18),vId,variation);
float front=dot(N,vMacro),crown=mix(1.-vCrown,vCrown,step(0.,front));
vec3 col=yarnColor(vM,float(vKind),vId,crown)*variation*(.87+.13*abs(front));
// Short staple mottling is filtered before it drops below one pixel.
float footprint=max(length(dFdx(vM)),length(dFdy(vM))),resolved=1.-smoothstep(.025,.15,footprint);
float staple=n2(vec2(vLocal.x*pitch*8.,vLocal.y*2.8)+vId*7.17);
float packingNoise=n2(vec2(vLocal.x*pitch*1.3,vLocal.y*1.6)+vId*3.41);
col*=1.+resolved*.36*(staple-.5)+.24*(packingNoise-.5);
N=normalize(N+normalize(cross(T,N))*(staple-.5)*.48*resolved);
if(uBake==1){O=vec4(col,1);return;}if(uBake==2){O=vec4(N*.5+.5,1);return;}
vec3 diffuseN=normalize(mix(vMacro*sign(dot(N,vMacro)),N,.55));
O=vec4(tone(lighting(col,diffuseN,T,vW,uFuzz)),1.);}
''')
rep('void main(){O=vec4(tone(lighting(uEdge', 'void main(){if(uShadowPass==1){O=vec4(1);return;}O=vec4(tone(lighting(uEdge')
region('const hairVS=`', 'const looseVS=`', '''const hairVS=`#version 300 es
${common}
in vec4 aP;in vec3 aMeta;in vec3 aTangent;uniform mat4 uVP;uniform vec3 uCam;uniform float uMmPerPixel;
out vec3 vW,vN,vT;out vec2 vM;out float vSide,vAlpha;flat out float vFamily;
void main(){mat3 b=basis(aP.xy);vM=aP.xy;vW=carrier(aP.xy)+b[2]*aP.z;vN=normalize(b[2]);vT=normalize(b*aTangent);vFamily=aMeta.x;
vec3 right=normalize(cross(normalize(uCam-vW),vT)+vec3(.00001));float r=aMeta.z,w=max(r,uMmPerPixel*.56);
vAlpha=min(1.,r/w)*(1.-.65*aMeta.y*aMeta.y);vSide=aP.w;gl_Position=uVP*vec4(vW+right*aP.w*w,1.);}`;
const hairFS=`#version 300 es
${fragCommon}${shade}
in vec3 vW,vN,vT;in vec2 vM;in float vSide,vAlpha;flat in float vFamily;out vec4 O;
void main(){float a=exp(-vSide*vSide*3.5)*vAlpha*min(1.,uFuzz*1.6);if(a<.004)discard;
vec3 c=yarnColor(vM,vFamily,23.,1.);c=mix(c,vec3(.19,.186,.171),.10);
vec3 V=normalize(uCam-vW),L=normalize(uKeyPos-vW);float cyl=sqrt(max(.01,1.-pow(dot(normalize(vT),L),2.)));
vec3 N=normalize(mix(vN,V,.45));vec3 lit=lighting(c,N,normalize(vT),vW,.9);
// Forward scatter and soft fiber coverage, not opaque metallic wire highlights.
lit+=c*uKeyColor*(.08*cyl+.04*pow(sat(dot(-L,V)),3.));O=vec4(tone(lit),a);}`;
''')
region('void main(){vec3 N=normalize(vN);if(!gl_FrontFacing)', '\nfunction program(', '''void main(){if(uShadowPass==1){O=vec4(1);return;}vec3 N=normalize(vN),T=normalize(vT);if(!gl_FrontFacing)N=-N;
float variation;vec3 B=normalize(cross(T,vec3(.01,.03,1)));float angle=atan(dot(N,cross(B,T)),dot(N,B));
N=fiberSurface(N,T,vec2(vInfo.z*12.,angle*.08),vInfo.y,variation);
vec3 col=yarnColor(vM,vInfo.x,vInfo.y,1.);col=mix(col,vec3(.24,.219,.181),.24)*variation;
O=vec4(tone(lighting(col,N,T,vW,.9)),1.);}`;
''')
# Switch fine curves from screen-horizontal ribbons to tangent-aware camera ribbons.
rep("hairs=mesh(hd.vertices,hd.indices,hairProg,'aP',4,7);", "hairs=mesh(hd.vertices,hd.indices,hairProg,'aP',4,10);")
rep('gl.vertexAttribPointer(am,3,gl.FLOAT,false,28,16);', "gl.vertexAttribPointer(am,3,gl.FLOAT,false,40,16);let ht=gl.getAttribLocation(hairProg,'aTangent');gl.enableVertexAttribArray(ht);gl.vertexAttribPointer(ht,3,gl.FLOAT,false,40,28);")
rep("mat(p,'uVP',vp);}","mat(p,'uVP',vp);shadowUniforms(p);}")
rep("let lod='';",(p/'studio.js').read_text()+"\nlet lod='';")
rep('let preCam=camera(cw/ch)', 'if(!state.qaAudit)makeShadow();\nlet preCam=camera(cw/ch)')
rep('let useMip=desiredMip;', 'if(!state.qaAudit)drawStudio(eye,cw/ch);\nlet useMip=desiredMip;')
rep('solidEdgeDrawn:false,geometryOnly:', "studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure,shadowSize,shadowDrawCalls,shadowTriangles,backgroundOnlyFog:true},solidEdgeDrawn:false,geometryOnly:")
rep('display:{shape:state.shape,light:state.light,seam:state.seam}',"display:{shape:state.shape,light:state.light,seam:state.seam,studio:{background:'gray-studio-planes',fog:state.fog,exposure:state.exposure}},fiberModel:{body:'band-limited longitudinal staple variation',sheen:'broad cloth lobe',scatter:'bounded real-time approximation, not Jensen dipole',ribbons:'tangent-oriented gaussian coverage'}")
rep("hairs=mesh(hd.vertices,hd.indices,hairProg,'aP',4,10);", "hairs=mesh(hd.vertices,hd.indices,hairProg,'aP',4,10);hairs.farCount=naturalData.fibers.filter(c=>c.role!=='sheath').reduce((n,c)=>n+(c.points.length-1)*6,0);")
rep('gl.drawElements(gl.TRIANGLES,hairs.count,gl.UNSIGNED_INT,0)', 'gl.drawElements(gl.TRIANGLES,useMip?hairs.farCount:hairs.count,gl.UNSIGNED_INT,0)')
rep('(state.fuzz>.01?hairs.count/3:0)', '(state.fuzz>.01?(useMip?hairs.farCount:hairs.count)/3:0)')
rep("window.__DENIM_WORKBENCH__={ready", "for(const key of ['exposure','fog'])$(key).oninput=e=>{state[key]=+e.target.value;$(key+'Val').textContent=state[key].toFixed(2);request();};\nwindow.__DENIM_WORKBENCH__={ready")
rep("$('seam').checked=state.seam;}","$('seam').checked=state.seam;for(const key of ['exposure','fog']){$(key).value=state[key];$(key+'Val').textContent=state[key].toFixed(2);}}")
# Surface fibers: deterministic density along actual parent curves, small loops
# and irregular ends; use finite-radius ray-facing ribbons with tangent data.
a=natural.index(' // Loop-like surface flyaways');b=natural.index(' const stats=',a)
natural=natural[:a]+''' // Fiber density is sampled on parent yarns, biased toward visible warp crowns.
 for(let j=0;j<11500;j++){let kind=H(j+410)<.86?0:1,id=Math.floor(H(j+893)*(kind?g.ny:g.nx)),full=kind?g.nx:g.ny,t=H(j+19)*full;
  if(!p.spans[kind].some(r=>r[2]===id&&t>=r[0]&&t<=r[1]))continue;
  let face=H(j+833)>.83?-1:1,angle=face*(.68+H(j+152)*1.72),rz=g.rz*(kind?.68:1),ra=kind?g.p.weftPitch*.235:g.p.warpPitch*.49;
  let extent=.16+H(j+13)**1.6*1.16,pitch=kind?g.p.warpPitch:g.p.weftPitch,pts=[];
  let loopy=H(j+391)<.67,phase=H(j+277)*6.283;
  for(let k=0;k<=9;k++){let u=k/9,tt=clamp(t+extent*u/pitch,0,full),q=organicPoint(C,g,kind,id,tt),spin=angle+.26*u*Math.sin(phase);
   q[kind?1:0]+=Math.cos(spin)*ra*(.84+.16*Math.sin(Math.PI*u));
   q[2]+=Math.sin(spin)*rz+face*(loopy?(.035+.09*H(j+411))*Math.sin(Math.PI*u):(.08+.10*H(j+411))*u);
   pts.push(q);
  }
  fiber(pts,kind,.005+.005*H(j+414),`surface:${Math.floor(j/5)}`,'surface');
 }
''' +natural[b:]
a=natural.index('function hairMesh(');b=natural.index('function audit(',a)
natural=natural[:a]+'''function hairMesh(fibers){let vertices=[],indices=[];
 for(const c of fibers){let off=vertices.length/10;
  for(let j=0;j<c.points.length;j++){let t=j/(c.points.length-1),T=norm(sub(c.points[Math.min(j+1,c.points.length-1)],c.points[Math.max(0,j-1)]));
   for(const side of [-1,1])vertices.push(...c.points[j],side,c.kind,t,c.radius,...T);
  }for(let j=0;j<c.points.length-1;j++){let k=off+j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
 }return {vertices,indices};}
''' +natural[b:]
natural=natural.replace(' const stats=', (p/'sheath.js').read_text()+'\n const stats=')
natural=natural.replace('...p.stats,edgeClumps:', "...p.stats,sheathCurves:fibers.filter(f=>f.role==='sheath').length,surfaceFlyaways:fibers.filter(f=>f.role==='surface').length,edgeClumps:")
app=app.replace('R04.0','R05.0').replace('KAOPU_Denim_R04','KAOPU_Denim_R05').replace('@2.2','@2.3')
template=template.replace('R04','R05').replace('NATURAL YARN','FIBER / STUDIO').replace('残留纱桥 · 悬垂断线 · 束状毛边','棉纤维 · 柔光灰棚 · 真实纱桥')
template=template.replace('</style>', '''
#heading{background:#e0e3e8c7;padding:8px 12px;border-radius:7px}#heading small,#heading p{color:#52616f}#heading h1{color:#273643}#tools button{background:#e2e6eacb;color:#263543}#footer{color:#304454}#stage{background:#a9acb0}.title{color:#243442}.title p{color:#4b5c6b}.title h2{color:#1f303e}.tools button{background:#e4e7eacc;color:#25313a;border:1px solid #a5afb8}.bottom{color:#334250}.overlay{color:#232c36}.overlay p{color:#4d5963}.overlay h2{color:#1f2a34}.bar{background:rgba(240,242,244,.7);color:#333c47;border:1px solid #a6aeb6;border-radius:6px}.viewtools button{background:#e4e7eacc;color:#25313a;border:1px solid #a5afb8}#status{color:#263342}
</style>''')
# Add only two stage controls; existing material controls are untouched.
pos=template.index('<select id="light"');end=template.index('</select>',pos)+len('</select>')
template=template[:end]+'''<label>棚景曝光 <span id="exposureVal">1.00</span></label><input id="exposure" type="range" min="0.55" max="1.65" step="0.01" value="1"><label>远背景轻雾 <span id="fogVal">0.65</span></label><input id="fog" type="range" min="0" max="1" step="0.01" value="0.65">'''+template[end:]
for name,text in [('core.js',core),('app.js',app),('natural-yarn.js',natural),('template.html',template)]: (p/name).write_text(text)
html=template.replace('/*CORE*/',core).replace('/*NATURAL*/',natural).replace('/*APP*/',app)
(p/'index.html').write_text(html);print('built',len(html.encode()),hashlib.sha256(html.encode()).hexdigest())
