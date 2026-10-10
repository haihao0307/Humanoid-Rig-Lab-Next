from pathlib import Path
import re,hashlib
p=Path(__file__).resolve().parent
base=p.parent/'r03'/'index.html'
if not base.exists():base=p/'original.html'
s=base.read_text();assert hashlib.sha256(s.encode()).hexdigest()=='2e92a73364d0f864ce7a8077b2e220e75291bdd72da367f9ca649f40eec73b40'
scripts=re.findall(r'<script>([\s\S]*?)</script>',s);core,app=scripts
# A bounded migration from the immutable R03 build, not a replacement workbench.
template=s.replace(core,'/*CORE*/').replace(app,'/*NATURAL*/\n/*APP*/')
def rep(a,b):
 global app
 assert a in app, a[:100]
 app=app.replace(a,b)
def region(a,b,new):
 global app
 start=app.index(a);end=app.index(b,start);app=app[:start]+new+app[end:]
rep('C=KAOPUDenimCore,canvas=', 'C=KAOPUDenimCore,Natural=KAOPUNaturalYarn,canvas=')
rep("slub:.38,wash:.23", "slub:.55,wash:.23")
rep('let carrierMesh,seams,edges,hairs,instances=', 'let naturalData,looseMesh;let carrierMesh,seams,edges,hairs,instances=')
region('function createRanges(){','function build(){', '''function createRanges(){instances.forEach(b=>gl.deleteBuffer(b));instances=[];brokenEnds=[];graph.cuts=[];
 naturalData=Natural.generate(C,graph,state.damage,state.fray);
 for(let kind=0;kind<2;kind++){const data=naturalData.spans[kind].flat();
  for(let id=0;id<(kind?graph.ny:graph.nx);id++)graph.cuts.push({family:kind?'weft':'warp',index:id,spans:naturalData.spans[kind].filter(s=>s[2]===id).map(s=>s.slice(0,2))});
  let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);instances.push(b);instanceCounts[kind]=data.length/4;
 }
 brokenEnds=naturalData.released.filter(r=>r.type==='tail');
}
''')
rep('destroy(edges);destroy(hairs);graph=', 'destroy(edges);destroy(hairs);destroy(looseMesh);graph=')
region('let ha=[],hi=[],seed=23451;', 'function uniforms(', '''let hd=Natural.hairMesh(naturalData.fibers);fiberCount=naturalData.fibers.length;
 hairs=mesh(hd.vertices,hd.indices,hairProg,'aP',4,7);gl.bindVertexArray(hairs.vao);gl.bindBuffer(gl.ARRAY_BUFFER,hairs.vb);let am=gl.getAttribLocation(hairProg,'aMeta');gl.enableVertexAttribArray(am);gl.vertexAttribPointer(am,3,gl.FLOAT,false,28,16);
 const ld=Natural.tubeMesh(naturalData.tubes);looseMesh=mesh(ld.vertices,ld.indices,looseProg,'aP',3,12);
 gl.bindVertexArray(looseMesh.vao);gl.bindBuffer(gl.ARRAY_BUFFER,looseMesh.vb);for(const [name,off] of [['aNormal',3],['aTangent',6],['aInfo',9]]){let at=gl.getAttribLocation(looseProg,name);if(at>=0){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,3,gl.FLOAT,false,48,off*4);}}
 gl.bindVertexArray(null);bakeDirty=true;updateText();request();}
''')
# The new release strands attach to exact centers. No secondary end offset.
region(' float full=uKind==0?', ' float pitch=uKind==0?uSize.w:uSize.z;float deriv=', '')
rep('float irregular=1.+uSlub*(.13*(hash(ph)*2.-1.)+.16*(bulge-.5));','float irregular=1.+uSlub*(.20*(hash(ph)*2.-1.)+.24*(bulge-.5)+.045*sin(t*.61+ph));')
rep('float rz=uParam.y*(uKind==0?1.:.68)*(1.+uSlub*.08*(bulge-.5));','float rz=uParam.y*(uKind==0?1.:.68)*(1.+uSlub*.14*(bulge-.5));')
rep('float h=liftAt(t,id,uKind)-(uKind==1?uParam.y*.18:0.);','float gate=sin(3.14159265*(t-.5));float h=liftAt(t,id,uKind)-(uKind==1?uParam.y*.18:0.)+.023*uSlub*gate*gate*sin(t*.48+ph*.67);')
rep('float wobble=.013*uSlub*sin(6.2831853*(t-.5))*sin(t*.21+ph);','float wobble=uSlub*gate*(.036*sin(t*.37+ph*.71)+.021*sin(t*.113+ph*1.9));')
rep('vec3(.155,.151,.139)','vec3(.125,.121,.108)')
rep('*(.32+.32*n):0.', '*(.22+.27*n):0.')
rep('warp*=.88+.18*hash(id*1.74)+.14*slub;','warp*=.91+.12*hash(id*1.74)+.16*slub;warp*=.95+.11*noise1(m.y*.025+id*.18)+.045*sin(m.y*.42+id*.69);')
rep('float cavity=.56+.44*abs(front);','float cavity=.80+.20*abs(front);')
rep('N,.76)', 'N,.43)')
rep('float roughSpec=pow(sat(dot(N,H)),9.)*.008;', 'float roughSpec=pow(sat(dot(N,H)),5.)*.003;')
rep('.008*fuzz*tangentLobe', '.0035*fuzz*tangentLobe')
rep('in vec4 aP;in vec2 aMeta;', 'in vec4 aP;in vec3 aMeta;')
rep('float r=.010,w=max(r,uMmPerPixel*.52);', 'float r=aMeta.z,w=max(r,uMmPerPixel*.52);')
# Additional actual finite-width yarns for one-ended tails, two-ended bridges and clumps.
rep('function program(v,f){', '''const looseVS=`#version 300 es
${common}
in vec3 aP;in vec3 aNormal;in vec3 aTangent;in vec3 aInfo;uniform mat4 uVP;
out vec3 vW;out vec3 vN;out vec3 vT;out vec3 vInfo;out vec2 vM;
void main(){mat3 b=basis(aP.xy);vW=carrier(aP.xy)+b[2]*aP.z;vM=aP.xy;vN=normalize(b*aNormal);vT=normalize(b*aTangent);vInfo=aInfo;gl_Position=uVP*vec4(vW,1.);}`;
const looseFS=`#version 300 es
${fragCommon}${shade}
in vec3 vW;in vec3 vN;in vec3 vT;in vec3 vInfo;in vec2 vM;out vec4 O;
void main(){vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;vec3 col=yarnColor(vM,vInfo.x,vInfo.y,1.);col=mix(col,vec3(.21,.201,.177),.28);float irregular=noise1(vInfo.z*18.+vInfo.y*.7);col*=.88+.20*irregular;O=vec4(tone(lighting(col,N,normalize(vT),vW,.75)),1.);}`;
function program(v,f){''')
rep('let yarnProg,surfProg,seamProg,hairProg;', 'let yarnProg,surfProg,seamProg,hairProg,looseProg;')
rep('hairProg=program(hairVS,hairFS);', 'hairProg=program(hairVS,hairFS);looseProg=program(looseVS,looseFS);')
rep("if(state.seam){uniforms(seamProg", "if(!state.qaAudit&&looseMesh){uniforms(looseProg,vp,eye);gl.bindVertexArray(looseMesh.vao);gl.drawElements(gl.TRIANGLES,looseMesh.count,gl.UNSIGNED_INT,0);drawCount++;}\nif(state.seam){uniforms(seamProg")
rep('+(state.seam?seams.count/3:0)', '+(!state.qaAudit&&looseMesh?looseMesh.count/3:0)+(state.seam?seams.count/3:0)')
rep('brokenEnds:brokenEnds.length,instanceCounts:', 'natural:Natural.audit(naturalData),looseTriangles:looseMesh.count/3,brokenEnds:brokenEnds.length,instanceCounts:')
rep("cuts:graph.cuts,physicalSimulation:false", "cuts:graph.cuts,released:naturalData.tubes.filter(c=>c.type!=='edge').map(c=>({type:c.type,family:c.kind?'weft':'warp',id:c.id,parents:c.parents,group:c.group,radiusMm:c.radius,points:c.points})),clumps:naturalData.groups,physicalSimulation:false")
rep("schema:'kaopu.denim_material_profile@2.1'", "schema:'kaopu.denim_material_profile@2.2'")
rep("audit:()=>C.audit(graph)", "naturalAudit:()=>Natural.audit(naturalData),getNatural:()=>naturalData,audit:()=>C.audit(graph)")
rep("['weave','thickness','damage','fray']", "['weave','thickness','slub','damage','fray']")
rep("if(k==='thickness'){", "if(k==='thickness'||k==='slub'){")
rep('updateText();bakeDirty=true;request();});', 'updateText();build();});')
# Normal/default view uses the still-geometric middle level; preserve close fidelity.
rep('smooth(1.4,2.4,pixelsPerYarn)', 'smooth(4.,6.,pixelsPerYarn)')
rep('pixelsPerYarn>1.4?1:', 'pixelsPerYarn>4.?1:')
# Version and scoped UI, no unrelated redesign.
app=app.replace('R03.0','R04.0').replace('R03.1','R04.0').replace('KAOPU_Denim_R03','KAOPU_Denim_R04')
template=template.replace('R03','R04').replace('GEOMETRY','NATURAL YARN').replace('实体布边 · 透视 · 洗旧与破损','残留纱桥 · 悬垂断线 · 束状毛边')
template=template.replace('磨破露白纬</option>','磨破 / 混合白纬纱桥</option>').replace('毛边贯穿破洞</option>','破洞 / 残留与下垂</option>').replace('大面积破布 / 残留纱桥','破布 / 线束与悬垂纱桥')
template=template.replace('布边散丝长度','毛边线束长度').replace('破口由经纬纱段断开形成，不是黑色斑块。','破口保留两端连接的纱桥、单端下垂断线和松散线束。')
template=template.replace('<select id="damage"','<button id="showFray" style="width:100%;margin-bottom:10px">查看本轮：线束与悬垂破口</button><select id="damage"')
rep("$('damage').onchange=", "$('showFray').onclick=()=>{Object.assign(state,presets.vintage,{preset:'vintage',damage:4,shape:1,seam:false,zoom:1.4,yaw:-.17,pitch:.20,panX:4,panY:-1});build();};\n$('damage').onchange=")
for name,text in [('core.js',core),('app.js',app),('template.html',template)]: (p/name).write_text(text)
print('R04 canonical authoring source upgraded from verified R03')
