"""One-time hash-locked R11 -> R12. Never edits R11 or the named archive.
After generation, edit canonical source files and run build.py.
"""
from pathlib import Path
import hashlib, shutil
P=Path(__file__).resolve().parent;S=P.parent/'r11'
assert not (P/'app.js').exists(),'Canonical R12 exists; do not overwrite it'
assert hashlib.sha256((S/'index.html').read_bytes()).hexdigest()=='bed84afcfa5603dd242e3b96999de9b5954928aaba37f2e06ab95d91b26e0d4d'
for f in ['app.js','core.js','cotton-surface.js','natural-yarn.js','runtime-budget.js','stitches.js','sampling.js','fiber-optics.js','structure.js','distance-lod.js','noise-kernel.js','build.py','template.html','LICENSE','THIRD_PARTY_NOTICES.md','HELPER_PROVENANCE.md']:
 shutil.copy2(S/f,P/f)
shutil.copy2(S/'PROVENANCE_RECORD.json',P/'PARENT_HELPER_PROVENANCE.json')
def edit(f,fn):
 p=P/f;p.write_text(fn(p.read_text()))
def natural(s):
 s=s.replace('let serial=0;','let serial=0,physicalSerial=0;')
 s=s.replace('function fiber(points,kind,radius,group,role){fibers.push({points,kind,radius,group,role});}', 'function fiber(points,kind,radius,group,role,physicalIndex=0,bindingScale=1){fibers.push({points,kind,radius,group,role,physicalIndex,bindingScale});}')
 s=s.replace('function children(points,kind,baseRadius,group,count=7)', 'function children(points,kind,baseRadius,group,count=7,physicalIndex=0)')
 s=s.replace("group,stray?'stray':'clumped');", "group,stray?'stray':'clumped',physicalIndex,scale);")
 s=s.replace("for(const r of list){tubes.push(r);children(r.points,r.kind,r.radius,key,r.partial?7:5);}", "for(const r of list){r.physicalIndex=++physicalSerial;tubes.push(r);children(r.points,r.kind,r.radius,key,r.partial?7:5,r.physicalIndex);}")
 a=s.index('function tubeMesh(curves)');b=s.index('function hairMesh',a)
 m=s[a:b].replace('vertices.length/12','vertices.length/14').replace('c.kind,c.id,arc);','c.kind,c.id,arc,c.physicalIndex||0,t);')
 s=s[:a]+m+s[b:]
 s=s.replace('={plan,generate,organicPoint', '={contour,plan,generate,organicPoint')
 s=s.replace("note:'Static anchored guides; not stress-based tear dynamics or a collision proof.'", "note:'Rest guides; released curves bind to R12 XPBD chains at runtime. No adaptive tearing or collision proof.'")
 return s
edit('natural-yarn.js',natural)
edit('runtime-budget.js',lambda s:s.replace("meta.set([c.radius,c.kind,c.parentId??23,c.role==='sheath'||c.role==='surface'?1:0],i*4);", "meta.set([c.radius,c.kind,(c.parentId??23)+(c.physicalIndex||0)*1024,c.physicalIndex?2+(c.bindingScale??1):(c.role==='sheath'||c.role==='surface'?1:0)],i*4);"))
def app(s):
 s=s.replace('R11.0','R12.0')
 s=s.replace("weave:0,cotton:","weave:0,gsm:450,autoMass:true,warpStiffness:1,weftStiffness:1,bendStiffness:1,cotton:")
 # Same static frame used by rest material and physical curve rest positions.
 old='void materialFrame(vec2 m,out vec3 base,out mat3 b){vec2 warped=clothField(m);mat3 raw;rawFrame(warped,base,raw);mat2 j=clothJacobian(m);vec3 x=raw[0]*j[0][0]+raw[1]*j[0][1],y=raw[0]*j[1][0]+raw[1]*j[1][1];b=mat3(x,y,normalize(cross(x,y)));dynamicFrame(m,base,b);}'
 assert old in s
 new=old.replace('void materialFrame','void materialStaticFrame').replace('dynamicFrame(m,base,b);','')+'''
void materialFrame(vec2 m,out vec3 base,out mat3 b){materialStaticFrame(m,base,b);dynamicFrame(m,base,b);}
void releasedFrame(vec3 m,vec3 localN,vec3 localT,float binding,float u,out vec3 W,out vec3 N,out vec3 T){mat3 b;vec3 base;
 if(uPhysics==1&&binding>.5){materialStaticFrame(m.xy,base,b);vec4 d=releasedDelta(binding,u);W=base+b[2]*m.z+d.xyz;T=normalize(b*localT);float e=.025;vec3 dd=releasedDelta(binding,min(1.,u+e)).xyz-releasedDelta(binding,max(0.,u-e)).xyz;T=normalize(T+dd/(max(.001,d.w)*(min(1.,u+e)-max(0.,u-e))));N=b*localN;N=normalize(N-T*dot(N,T));}
 else{materialFrame(m.xy,base,b);W=base+b[2]*m.z;N=normalize(b*localN);T=normalize(b*localT);}
}
'''
 s=s.replace(old,new)
 old='mat3 b;vec3 base;materialFrame(aP.xy,base,b);vM=aP.xy;vW=base+b[2]*aP.z;vN=normalize(b[2]);vT=normalize(b*aTangent.xyz);vFamily=aMeta.x;vId=aMeta.w;vDiameter=2.*aMeta.z;vRole=aTangent.w;'
 assert old in s
 s=s.replace(old,'float binding=floor(aMeta.w/1024.);releasedFrame(aP.xyz,vec3(0,0,1),aTangent.xyz,binding,clamp(aMeta.y*(aTangent.w>=2.?aTangent.w-2.:1.),0.,1.),vW,vN,vT);vM=aP.xy;vFamily=aMeta.x;vId=mod(aMeta.w,1024.);vDiameter=2.*aMeta.z;vRole=aTangent.w>=2.?0.:aTangent.w;')
 s=s.replace('in vec3 aP;in vec3 aNormal;in vec3 aTangent;in vec3 aInfo;uniform mat4 uVP;', 'in vec3 aP;in vec3 aNormal;in vec3 aTangent;in vec3 aInfo;in vec2 aBind;uniform mat4 uVP;')
 s=s.replace('void main(){mat3 b;vec3 base;materialFrame(aP.xy,base,b);vW=base+b[2]*aP.z;vM=aP.xy;vN=normalize(b*aNormal);vT=normalize(b*aTangent);vInfo=aInfo;vDiameter=2.*length(aNormal);gl_Position=uVP*vec4(vW,1.);}', 'void main(){releasedFrame(aP,normalize(aNormal),aTangent,aBind.x,aBind.y,vW,vN,vT);vM=aP.xy;vInfo=aInfo;vDiameter=2.*length(aNormal);gl_Position=uVP*vec4(vW,1.);}')
 # Dynamic guide binding adds two floats, not a second copy of the geometry.
 s=s.replace("looseProg,'aP',3,12)","looseProg,'aP',3,14)")
 # Attribute wiring for the loose mesh only.
 a=s.index('function build()');b=s.index('function uniforms',a);part=s[a:b]
 # inspectable strict replacements apply only to pointer sizes inside loose attribute setup
 part=part.replace("for(const [name,size,offset] of [['aNormal',3,12],['aTangent',3,24],['aInfo',3,36]])", "for(const [name,size,offset] of [['aNormal',3,12],['aTangent',3,24],['aInfo',3,36],['aBind',2,48]])")
 part=part.replace('gl.vertexAttribPointer(at,size,gl.FLOAT,false,48,offset)','gl.vertexAttribPointer(at,size,gl.FLOAT,false,56,offset)')
 s=s[:a]+part+s[b:]
 s=s.replace('let physicsShape=1;',"let physicsShape=1,physicsConfigKey='';")
 # Hook a structure transaction at render-time; no LOD/camera/frame fields in key.
 marker="let lod='';function render"
 insert="""function physicsParameters(){return {wind:state.windSpeed,drive:state.drive};}
function configurePhysics(){const key=[state.shape,state.structure,state.weave,state.thickness,state.gsm,state.autoMass,state.warpStiffness,state.weftStiffness,state.bendStiffness,state.damage,state.slub,state.cotton,state.fray].join('|');if(physicsConfigKey===key)return;physicsConfigKey=key;dynamics.configure(KAOPUClothTopology.input(Natural,graph,naturalData,state),physicsParameters());}
"""
 assert marker in s;s=s.replace(marker,insert+marker)
 s=s.replace('if(physicsShape!==state.shape){physicsShape=state.shape;dynamics.reset({shape:state.shape});}dynamics.upload();', 'configurePhysics();dynamics.upload();')
 s=s.replace("dynamics.active&&!flat&&!bakeMode&&!state.qaAudit?1:0", "dynamics.active&&dynamics.ready&&!flat&&!bakeMode&&!state.qaAudit?1:0")
 s=s.replace("ui(p,'uClothDelta',10);", "ui(p,'uClothDelta',10);gl.activeTexture(gl.TEXTURE11);gl.bindTexture(gl.TEXTURE_2D,dynamics.curveTexture);ui(p,'uReleasedDelta',11);")
 s=s.replace("options:{shape:state.shape,wind:state.windSpeed,drive:state.drive}", "options:physicsParameters()")
 s=s.replace("damageProxy:state.damage>=2?'continuous cloth proxy; fray strands not independently solved':'intact'", "damageProxy:state.damage>=2?'hole-aware sheet plus two-way released-yarn chains':'intact directional cloth'")
 s=s.replace("clothSolver:'XPBD cloth proxy in worker; not full garment'", "clothSolver:'damaged-sheet and released-yarn XPBD; no self-collision or full garment'")
 s=s.replace("physicalSimulation:false},display:","topologyCoupled:true,adaptiveTearing:false},display:")
 s=s.replace("seed:'fixed-r08',noiseKernel", "seed:'fixed-r08',mechanics:{model:'damage-xpbd@1',gsm:state.gsm,autoMass:state.autoMass,warpStiffness:state.warpStiffness,weftStiffness:state.weftStiffness,bendStiffness:state.bendStiffness},noiseKernel")
 s=s.replace("const patch={},parts=", "const patch={},parts=")
 s=s.replace("display:['shape','light','exposure','fog','structure']};", "display:['shape','light','exposure','fog','structure'],mechanics:['gsm','warpStiffness','weftStiffness','bendStiffness']};")
 s=s.replace("const limits={weave:[0,3]", "const limits={gsm:[100,900],warpStiffness:[.2,3],weftStiffness:[.2,3],bendStiffness:[.2,3],weave:[0,3]")
 s=s.replace("patch.preset=r.finish.preset;patch.seam=r.sewing.enabled;", "if(r.mechanics?.model!=='damage-xpbd@1'||typeof r.mechanics.autoMass!=='boolean')throw Error('本版需要 R12 结构物理配方');patch.autoMass=r.mechanics.autoMass;patch.preset=r.finish.preset;patch.seam=r.sewing.enabled;")
 s=s.replace("请使用 R11 配方", "请使用 R12 配方").replace("旧配方应在牛仔布成果一档打开", "旧配方应在对应历史版本打开")
 s=s.replace("物理代理 ${dynamics.report?.nodes||475} 点 ·", "物理点 ${dynamics.report?.nodes||475} ·")
 s=s.replace("近景按需 ${p.detailResidency", "有效面点 ${dynamics.report?.topology?.activeSheetNodes??'等待'} / 空洞点 ${dynamics.report?.topology?.inactiveHoleNodes??'等待'}\\n移除面约束 ${dynamics.report?.topology?.removedSheetConstraints??'等待'} · 残桥 ${dynamics.report?.topology?.retainedBridgeCount??0}\\n结构质量 ${dynamics.report?.topology?(dynamics.report.topology.totalMassKg*1000).toFixed(3)+' g':'等待'} · 面密度 ${dynamics.report?.topology?(dynamics.report.topology.material.arealDensityKgM2*1000).toFixed(0)+' g/m²':'等待'}\\n近景按需 ${p.detailResidency")
 # Public QA reads a versioned configuration, not a stale previous-generation sample.
 s=s.replace("physicsReport:()=>dynamics.report,", "physicsReport:()=>dynamics.report,physicsReady:()=>dynamics.ready,physicsGeneration:()=>dynamics.generation,")
 s=s.replace("state.animate=false;state.motionModel='xpbd';dynamics.active=true;dynamics.play(false);", "configurePhysics();state.animate=false;state.motionModel='xpbd';dynamics.active=true;dynamics.play(false);")
 # A small independently controllable material panel; no artificial forced pose.
 at=s.index('window.__DENIM_WORKBENCH__=')
 s=s[:at]+"""for(const key of ['gsm','warpStiffness','weftStiffness','bendStiffness'])$(key).oninput=e=>{state[key]=Number(e.target.value);$(key+'Val').textContent=state[key].toFixed(key==='gsm'?0:2);request();};
$('autoMass').onchange=e=>{state.autoMass=e.target.checked;request();};
$('materialThin').onclick=()=>window.__DENIM_WORKBENCH__.setState({thickness:.45,autoMass:true});
$('materialThick').onclick=()=>window.__DENIM_WORKBENCH__.setState({thickness:1.05,autoMass:true});
$('damageLoad').onclick=()=>window.__DENIM_WORKBENCH__.setState({damage:4,zoom:1.5,panX:4,panY:-1,animate:true,motionModel:'xpbd',windSpeed:1.1});
"""+s[at:]
 return s
edit('app.js',app)
def final_app(s):
 s=s.replace("for(const [name,off] of [['aNormal',3],['aTangent',6],['aInfo',9]])", "for(const [name,size,off] of [['aNormal',3,3],['aTangent',3,6],['aInfo',3,9],['aBind',2,12]])")
 a=s.index('gl.bindVertexArray(looseMesh.vao);gl.bindBuffer');b=s.index('gl.bindVertexArray(null);bakeDirty',a);s=s[:a]+s[a:b].replace('gl.vertexAttribPointer(at,3,gl.FLOAT,false,48,off*4)','gl.vertexAttribPointer(at,size,gl.FLOAT,false,56,off*4)')+s[b:]
 s=s.replace("ui(p,'uReleasedDelta',11);", "ui(p,'uReleasedDelta',11);gl.uniform2f(U(p,'uPhysicsSize'),graph.p.width,graph.p.height);")
 s=s.replace('function updateText(){', "function updateText(){for(const key of ['gsm','warpStiffness','weftStiffness','bendStiffness']){$(key).value=state[key];$(key+'Val').textContent=state[key].toFixed(key==='gsm'?0:2);}$('autoMass').checked=state.autoMass;")
 return s.replace('KAOPU_Denim_R09_Full_Diagnostic','KAOPU_Denim_R12_Full_Diagnostic').replace('KAOPU_Denim_R11_Profile','KAOPU_Denim_R12_Profile')
edit('app.js',final_app)

def template(s):
 s=s.replace('R11.0','R12.0').replace('/*DYNAMICS*/','/*TOPOLOGY*/\n/*DYNAMICS*/')
 panel='''<section><h2>结构物理 / R12</h2><p class="note">孔内面节点与连接移除；残留纱桥双端传力，尾丝单端附着。数值是未标定候选，不是实测物性。</p><label>名义面密度 g/m²<span id="gsmVal">450</span></label><input id="gsm" type="range" min="100" max="900" step="10" value="450"><label><input type="checkbox" id="autoMass" checked>按厚度估算质量（取消后用输入面密度）</label><label>经向刚度倍率<span id="warpStiffnessVal">1.00</span></label><input id="warpStiffness" type="range" min=".2" max="3" step=".05" value="1"><label>纬向刚度倍率<span id="weftStiffnessVal">1.00</span></label><input id="weftStiffness" type="range" min=".2" max="3" step=".05" value="1"><label>弯曲刚度倍率<span id="bendStiffnessVal">1.00</span></label><input id="bendStiffness" type="range" min=".2" max="3" step=".05" value="1"><div class="row"><button id="materialThin">薄料受力</button><button id="materialThick">厚料受力</button></div><button id="damageLoad">大破口 · 风吹受力检查</button><p class="note">修改结构/物性会重置求解；镜头、画质与距离切换不会。未实现自碰撞、动态撕裂或针脚张力。</p></section>'''
 # Place in the scrollable controls, leave canvas/tools positions unchanged.
 at=s.index('<section>');s=s[:at]+panel+s[at:]
 return s
edit('template.html',template)
def build(s):
 s=s.replace("('DYNAMICS','dynamics.js')", "('TOPOLOGY','cloth-topology.js'),('DYNAMICS','dynamics.js')")
 s=s.replace('R11.0','R12.0').replace('r11/index.html','r12/index.html').replace('3daabc3436ecf6e5297d56869712449ca145ab5e','086414b317f313bf9465ea957753ae7e84453f6f')
 s=s.replace("compressed=gzip.compress(source,compresslevel=9,mtime=0)", "compressed=bytearray(gzip.compress(source,compresslevel=9,mtime=0));compressed[9]=255;compressed=bytes(compressed)")
 s=s.replace('475-node XPBD proxy; not full garment, no self collision','hole-aware sheet plus released-yarn proxy chains; not full garment, no self collision')
 return s
edit('build.py',build)
print('R12 canonical files generated; parent untouched')
