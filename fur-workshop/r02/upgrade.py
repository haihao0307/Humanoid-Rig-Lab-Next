"""Deterministic R02 expansion from hash-locked R01. R01 files remain read-only."""
from pathlib import Path
import hashlib,shutil
P=Path(__file__).resolve().parent;B=P.parent/'r01'
s=(B/'app.js').read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='d4bf3bb047bb4f96869eb5cfcdb4d821540210c3bdfc8f2d9294dc4531e6f865'
s=s.replace('FUR-ATELIER-R01','FUR-ATELIER-R02').replace("let presetKey='ivory',p={...PRESETS.ivory},view='coat'","let presetKey='fox',p={...PRESETS.fox},view='collar'")
s=s.replace('density=1,wind=.28,simulating=true','density=1,wind=.12,simulating=false').replace('const MAX=280000','const MAX=260000')
s=s.replace("fox:{name:'暖棕长毛',sub:'长针毛 · 自然下垂',length:88,under:17,curl:.28,comb:.78,clump:.43,rough:.52,root:'#423027',mid:'#a78059',tip:'#d6bb8b',thickness:.17}","fox:{name:'棕褐厚毛领',sub:'密底绒 · 分束针毛 · 暗根浅尖',length:74,under:32,curl:.48,comb:.66,clump:.42,rough:.68,root:'#291b15',mid:'#70513b',tip:'#bea88a',thickness:.13}")
s=s.replace('length:38,under:7','length:38,under:23').replace('length:66,under:12','length:66,under:31').replace('length:55,under:13','length:55,under:28')
s=s.replace('uZoneOnly:{value:0}','uZoneOnly:{value:0},uDensity:{value:1},uCoverageDebug:{value:0}')
a=s.index('const vertex=`');b=s.index('function syncLight()',a)
s=s[:a]+'''// R02: each ribbon represents one fiber, not a photographed multi-hair card.
const vertex=`
attribute vec3 aRoot,aNormal,aGroom,aCluster;attribute vec4 aRandom;attribute vec2 aGuide;attribute float aZone;
uniform float uLength,uUnder,uCurl,uComb,uClump,uThickness,uHeight,uFov,uLayer,uZoneOnly;
uniform sampler2D uGuide;varying float vT,vAcross,vCover,vRnd,vGuard,vDepth;
varying vec3 vN,vTangent,vPosition;
vec3 curve(float t,float len,float guard,vec3 dynamics){
 vec3 n=aNormal,g=aGroom,b=normalize(cross(n,g));float phase=aRandom.x*6.283185;
 float spread=(aRandom.z-.5)*mix(1.65,.26,guard);vec3 flow=normalize(g*cos(spread)+b*sin(spread));
 float lift=mix(.95,.60,guard)*(1.-uComb*.22);
 float wave=sin(phase+t*mix(21.,8.,guard))-sin(phase),curl=len*uCurl*mix(.10,.025,guard)*t;
 return aRoot+n*(.0003+len*lift*(t-.22*t*t))+flow*len*(.18+.66*uComb)*t
  +aCluster*uClump*t*t*.85+b*curl*wave+n*curl*.55*(cos(phase+t*17.)-cos(phase))
  +vec3(0.,-1.,0.)*len*.10*guard*t*t+dynamics*t*t*mix(.25,1.,guard);
}
void main(){
 float guard=step(.73,aRandom.w),fly=step(.997,aRandom.w);vGuard=guard;
 float len=mix(uUnder*(.60+.64*aRandom.y),uLength*(.67+.44*aRandom.y),guard)*(1.+fly*.19);
 bool hidden=(uLayer>.5&&uLayer<1.5&&guard>.5)||(uLayer>1.5&&guard<.5)||(uZoneOnly>.5&&aZone<.5);
 float t=position.y;vec3 dyn=texture2D(uGuide,aGuide).xyz*min(1.,len/.06);
 vec3 q=curve(t,len,guard,dyn),nq=curve(t+.008,len,guard,dyn);vec4 mv=modelViewMatrix*vec4(q,1.);
 vec3 tangent=normalize(mat3(modelViewMatrix)*(nq-q)),eye=normalize(-mv.xyz),side=cross(tangent,eye);
 side=length(side)<.001?vec3(1.,0.,0.):normalize(side);
 float taper=1.-smoothstep(.5,1.,t),diameter=uThickness*mix(.80,1.,guard)*(.74+.53*aRandom.z)*max(.012,taper);
 float px=2.*abs(mv.z)*uFov/uHeight,expanded=max(diameter,px*.95);
 vCover=clamp(diameter/max(expanded,.000001),0.,1.);vAcross=position.x;vT=t;vRnd=aRandom.x;
 vDepth=clamp(dot(q-aRoot,aNormal)/max(uUnder*.78,.0001),0.,1.);
 vN=normalize(mat3(modelMatrix)*aNormal);vTangent=normalize(mat3(modelMatrix)*(nq-q));vPosition=(modelMatrix*vec4(q,1.)).xyz;
 mv.xyz+=side*position.x*expanded*.5;gl_Position=hidden?vec4(2.,2.,2.,1.):projectionMatrix*mv;
}`;
const fragment=`
uniform vec3 uRoot,uMid,uTip,uKey,uRim,uKC,uRC,uEnvUp,uEnvDown;uniform float uRough,uDensity,uCoverageDebug;
varying float vT,vAcross,vCover,vRnd,vGuard,vDepth;varying vec3 vN,vTangent,vPosition;
vec3 illuminate(vec3 L,vec3 energy,vec3 base,vec3 N,vec3 tangent,vec3 V){
 float wrap=clamp((dot(N,L)+.60)/1.60,0.,1.),fiber=sqrt(max(.002,1.-pow(dot(tangent,L),2.)));
 vec3 H=normalize(L+V);float shift=dot(normalize(tangent+N*.07),H);
 float spec=pow(sqrt(max(0.,1.-shift*shift)),mix(90.,22.,uRough));
 float shift2=dot(normalize(tangent-N*.16),H),broad=pow(sqrt(max(0.,1.-shift2*shift2)),mix(30.,8.,uRough));
 // Local optical-depth approximation; not full multiple scattering or opacity shadow maps.
 float tr=exp(-1.25*uDensity*(1.-vDepth)/max(.25,abs(dot(N,L))));
 float multi=.16*(1.-tr),back=pow(max(dot(-L,V),0.),5.)*.14*vDepth;
 return energy*(base*(.40*wrap*fiber*(.3+.7*tr)+multi+back)+vec3(.035)*spec*wrap*tr+base*broad*.11*wrap*tr);
}
void main(){
 float edge=1.-smoothstep(.45,1.,abs(vAcross)),alpha=edge*vCover;if(alpha<.035)discard;
 vec3 N=normalize(vN),tangent=normalize(vTangent),V=normalize(cameraPosition-vPosition);
 vec3 base=mix(uRoot,uMid,smoothstep(0.,.48,vT));base=mix(base,uTip,smoothstep(.40,.94,vT)*(.28+.52*vRnd)*mix(.35,1.,vGuard));base*=.72+.53*vRnd;
 vec3 env=mix(uEnvDown,uEnvUp,clamp(N.y*.5+.5,0.,1.));float occlusion=mix(.33,1.,sqrt(vDepth));
 vec3 col=base*env*.67*occlusion+illuminate(uKey,uKC,base,N,tangent,V)+illuminate(uRim,uRC,base,N,tangent,V);
 if(uCoverageDebug>.5)col=vec3(0.,1.,0.);gl_FragColor=vec4(col,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const furMaterial=new T.ShaderMaterial({uniforms:U,vertexShader:vertex,fragmentShader:fragment,transparent:false,depthWrite:true,alphaToCoverage:true,side:T.DoubleSide,forceSinglePass:true});
''' +s[b:]
a=s.index("   add(sign<0?'右翻领'");b=s.index("  }\n  add('后领'",a)
s=s[:a]+'''   add(sign<0?'右翻领':'左翻领',(u,v)=>{
    const a=u*2*PI,center=v3(sign*(.142+.100*Math.sin(v*PI)-.025*v),1.575-.545*v,.083+.130*Math.sin(v*PI*.58));
    const tangent=v3(sign*(.100*PI*Math.cos(v*PI)-.025),-.545,.130*PI*.58*Math.cos(v*PI*.58)).normalize();
    const across=v3(sign,0,0).addScaledVector(tangent,-sign*tangent.x).normalize(),front=new T.Vector3().crossVectors(tangent,across).normalize();
    const end=Math.pow(Math.sin(PI*(.055+.94*v)),.34),rad=.075*end;
    return center.addScaledVector(across,Math.cos(a)*rad).addScaledVector(front,Math.sin(a)*rad*.36);
   },1,false);
''' +s[b:]
s=s.replace('mesh.userData.zone=piece.zone;','mesh.userData.zone=piece.zone;mesh.userData.piece=piece;')
s=s.replace("pieces=makePieces();pieces.forEach(meshPiece);let area=pieces.reduce((s,x)=>s+x.area,0),count=view==='hat'?145000:view==='swatch'?130000:MAX;","pieces=makePieces();pieces.forEach(meshPiece);const active=pieces.filter(x=>view!=='collar'||x.zone===1);let area=active.reduce((s,x)=>s+x.area*(x.zone?3:1),0),count=view==='hat'?210000:view==='swatch'?170000:MAX;")
s=s.replace('let r=rand()*area,piece=pieces[0];for(const x of pieces){r-=x.area;','let r=rand()*area,piece=active[0];for(const x of active){r-=x.area*(x.zone?3:1);')
s=s.replace('zones=new Float32Array(count);','zones=new Float32Array(count),clusters=new Float32Array(count*3);')
a=s.index('  const {q,n,u,v}=pickSurface(piece);');b=s.index('  randoms.set(',a)
s=s[:a]+'''  const {q,n,u,v}=pickSurface(piece);let preferred=piece.zone?v3(Math.sign(q.x)*(.55+.25*(1-v)),-.85,.08):v3(0,-1,0);
  let g=preferred.addScaledVector(n,-preferred.dot(n));if(g.length()<.08)g=v3(0,0,1).addScaledVector(n,-n.z);if(g.length()<.08)g=v3(1,0,0).addScaledVector(n,-n.x);
  g.normalize();roots.set(q.toArray(),i*3);normals.set(n.toArray(),i*3);grooms.set(g.toArray(),i*3);
  const cx=Math.floor(u*24),cy=Math.floor(v*40),jitter=Math.sin(cx*73.17+cy*31.31+piece.idx*17.7)*43758.5453;
  const jj=jitter-Math.floor(jitter),cu=clamp((cx+.28+.44*jj)/24,0,1),cv=clamp((cy+.25+.5*(1-jj))/40,0,1);
  const delta=piece.fn(cu,cv).sub(q);delta.addScaledVector(n,-delta.dot(n));clusters.set(delta.toArray(),i*3);
''' +s[b:]
s=s.replace("['aZone',zones,1]","['aZone',zones,1],['aCluster',clusters,3]")
s=s.replace('fur.geometry.instanceCount=Math.floor(fur.geometry.userData.capacity*density);','fur.geometry.instanceCount=Math.floor(fur.geometry.userData.capacity*density);U.uDensity.value=density;')
a=s.index(' for(const b of bases){let leather');b=s.index(" $('#title-material')",a)
s=s[:a]+''' for(const b of bases){const plain=view==='collar'&&!b.userData.zone;b.material.color.set(plain?'#36231c':p.root);b.material.roughness=.98;b.material.sheen=plain?.16:.3;b.material.sheenRoughness=.95;b.material.sheenColor.set(plain?'#544333':p.mid);}
''' +s[b:]
s=s.replace("orbit.azimuth=which==='back'?PI+.2:which==='side'?1.5:.34","orbit.azimuth=which==='back'?PI+.2:which==='side'?1.5:.08").replace("which==='collar'?1.15","which==='collar'?1.46").replace("which==='macro'?.15:0","which==='macro'?.20:0").replace("which==='collar'?1.37","which==='collar'?1.32").replace("which==='macro'?.215","which==='macro'?.27")
s=s.replace("cameraPreset(initialHash.get('camera')||'full')","cameraPreset(initialHash.get('camera')||'collar')")
s=s.replace("setPreset('ivory');density=1","setPreset('fox');density=1").replace("setView('coat');};","setView('collar');cameraPreset('collar');};")
s=s.replace('externalCoatMesh:false,videoVerified:false','externalCoatMesh:false,videoVerified:false,activeRootZones:Array.from(new Set(fur.geometry.attributes.aZone.array)),samples:gl.getParameter(gl.SAMPLES),depthResolving:true')
s=s.replace("window.FUR={version:","window.FUR={coverageDebug(x){U.uCoverageDebug.value=x?1:0;renderDirty=true;},version:")
(P/'app.js').write_text(s)
h=(B/'index.source.html').read_text().replace('R01','R02').replace('value=".28"','value=".12"').replace('暂停毛梢</button>','启动微风</button>').replace('max="25"','max="42"').replace('暖棕长毛','棕褐厚毛领')
h=h.replace('data-view="coat" class="selected"','data-view="coat"').replace('data-view="collar">','data-view="collar" class="selected">')
h=h.replace('底绒的厚度，针毛的光泽。','厚底绒遮底，针毛形成轮廓。')
(P/'index.source.html').write_text(h)
for name in ['eb1.js','three.module.js','THREE-LICENSE.txt','EB1-THIRD_PARTY_NOTICES.md']:shutil.copyfile(B/name,P/name)
assert hashlib.sha256((P/'eb1.js').read_bytes()).hexdigest()=='39f747e36f905eaf9e760236315ae649bcab4ffd4feb62290017c7c5da650572'
print('R02 expanded; R01 kept read-only.')
