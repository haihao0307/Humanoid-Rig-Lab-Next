from __future__ import annotations

import base64
import hashlib
import json
import re
from pathlib import Path
from typing import Any

MODULE_ROOT = Path(__file__).resolve().parent.parent
BASELINE = MODULE_ROOT / "baselines/v4.41/CAT_KAOPU_V441_EYELID_CORNEA_WORKBENCH_2026-09-15.html"
CURRENT_HTML = MODULE_ROOT / "workbench/CAT_KAOPU_CURRENT.html"
BUILD_DIR = MODULE_ROOT / "build/v4.42"
OUT_HTML = BUILD_DIR / "CAT_KAOPU_V442_GEOMETRIC_EYELID_WORKBENCH_2026-09-16.html"
DOC_REPORT = MODULE_ROOT / "docs/CAT_KAOPU_V442_EXECUTION_REPORT_2026-09-16.md"
DOC_REVIEW = MODULE_ROOT / "docs/CAT_KAOPU_V442_SELF_REVIEW_2026-09-16.md"
QA_TECHNICAL = MODULE_ROOT / "qa/CAT_KAOPU_V442_TECHNICAL_QA_2026-09-16.json"
CURRENT_JSON = MODULE_ROOT / "CURRENT.json"
README = MODULE_ROOT / "README.md"
MANIFEST = MODULE_ROOT / "BUILD_MANIFEST.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def rep(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


def reponce(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex marker, found {count}")
    return out


def extract_json(text: str, name: str, next_name: str) -> tuple[dict[str, Any], int, int]:
    start = f"const {name}="
    end = f";\nconst {next_name}="
    i = text.index(start) + len(start)
    j = text.index(end, i)
    return json.loads(text[i:j]), i, j


def replace_json(text: str, name: str, next_name: str, value: dict[str, Any]) -> str:
    _, i, j = extract_json(text, name, next_name)
    return text[:i] + json.dumps(value, ensure_ascii=False, separators=(",", ":")) + text[j:]


def embedded_payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        raise RuntimeError("CAT_B64 not found")
    return base64.b64decode(match.group(1))


def build_html(source_text: str) -> str:
    text=source_text
    if 'CAT KAOPU V4.41' not in text or '__CAT_V441_READY__' not in text:
        raise RuntimeError('V4.41 source markers missing')

    lib,_,_=extract_json(text,'LIB','canvas')
    lib['behavior']['version']='V4.42'
    lib['behavior']['boundary']=('Deterministic preview only. V4.42 preserves the V4.32 neutral body surface, V4.40 CATV440 payload, '
     '34-bone rig, V4.39 posture correctives and V4.36 locomotion/contact. It replaces the shader-only lid mask with four bounded procedural eyelid shell volumes driven by the head bone; no body vertices, weights or eye-sphere vertices are modified.')
    for a in lib.get('actions',[]):
        if a.get('id')=='blink_check':
            a['label']='几何眼睑 / 角膜检查'
            a['status']='bounded_geometric_eyelid_candidate'
    text=replace_json(text,'LIB','canvas',lib)

    text=rep(text,'<title>CAT KAOPU V4.41 · 眼睑眨眼与角膜响应第一层</title>',
             '<title>CAT KAOPU V4.42 · 受限几何眼睑体积第一层</title>','title')
    text=rep(text,'alt="V4.41 眼睑眨眼与角膜响应第一层静态回退"',
             'alt="V4.42 受限几何眼睑体积第一层静态回退"','alt')
    text=rep(text,'<button class="active" id="blinkLayer">眼睑层</button>',
             '<button class="active" id="blinkLayer">几何眼睑</button><button id="lidDebug">眼睑检查</button>','toolbar lid')
    text=rep(text,'<aside><h1>CAT KAOPU V4.41</h1>', '<aside><h1>CAT KAOPU V4.42</h1>','h1')
    text=rep(text,'V4.32 冻结整猫表面 → V4.39 坐卧修形 → V4.40 耳眼/短毛 → V4.41 眼睑眨眼与角膜响应',
             'V4.32 冻结整猫表面 → V4.40 耳眼/短毛 → V4.41 片元眼睑 → V4.42 受限几何眼睑体积','lineage')
    text=rep(text,'<span class="tag good">程序化眼睑</span><span class="tag good">角膜湿润响应</span>',
             '<span class="tag good">受限几何眼睑</span><span class="tag good">眼缘厚度</span><span class="tag good">角膜湿润响应</span>','tags')
    text=rep(text,'<section><h2>眼睑、角膜、耳眼与短毛</h2>',
             '<section><h2>几何眼睑、角膜、耳眼与短毛</h2>','section heading')
    text=rep(text,'<button class="active" id="blinkToggle">眼睑遮罩</button>',
             '<button class="active" id="blinkToggle">几何眼睑</button><button id="lidDebugToggle">眼睑检查</button>','side buttons')
    text=rep(text,'<label><span>手动闭眼</span><input id="blinkAmount" max="1" min="0" step="0.02" type="range" value="0"/><output>0.00</output></label>',
             '<label><span>手动闭眼</span><input id="blinkAmount" max="1" min="0" step="0.02" type="range" value="0"/><output>0.00</output></label><label><span>眼缘厚度</span><input id="lidThickness" max="0.00075" min="0.00015" step="0.00005" type="range" value="0.00042"/><output>0.42 mm</output></label>',
             'lid thickness')
    text=rep(text,
     '耳朵使用新增的两根代码骨和局部权重；眼球仍使用 V4.40 轻量球体；V4.41 只在眼球片元层建立上下眼睑开合、确定性眨眼、角膜湿润高光与瞳孔适应。它不是几何眼皮、泪膜折射或第三眼睑，不能替代后续真实眼眶与眼睑体积。短毛层仍只改变方向性明暗。',
     '耳朵继续使用 V4.40 的两根代码骨和局部权重；眼球仍是 V4.40 轻量球体。V4.42 在二进制猫体之外生成左右眼各一组上、下眼睑壳体，由头骨矩阵带动并以真实厚度参数闭合；原猫体顶点、眼球顶点、34 骨与蒙皮权重均不改。当前仍未包含第三眼睑、泪膜折射和眼眶软组织挤压。',
     'note')
    text=rep(text,
     '<div class="kpi"><b>眨眼</b><span id="kBlink">自动 0.00</span></div><div class="kpi"><b>角膜 / 瞳孔</b>',
     '<div class="kpi"><b>眨眼</b><span id="kBlink">自动 0.00</span></div><div class="kpi"><b>几何眼睑</b><span id="kLid">4 片 / 0.42 mm</span></div><div class="kpi"><b>角膜 / 瞳孔</b>',
     'kpi')
    text=rep(text,
     '本轮不改变 V4.32 中性猫体、不改变 V4.40 二进制载荷与 34 骨权重、不改变 V4.39 坐卧修形，也不改变掌垫接触、直行和转向。新增内容只位于眼球片元表现层：程序化眼睑开合、眨眼、角膜响应和瞳孔适应。真实几何眼睑、第三眼睑、泪膜折射、胡须和几何毛束仍未完成。',
     '本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形及 V4.36 运动接触。新增内容是独立的四片受限程序化眼睑壳体和眼缘厚度；它们只读取头骨矩阵，不写回主体几何。第三眼睑、真实泪膜折射、眼眶软组织挤压、胡须和轮廓毛束仍未完成。',
     'scope')
    text=rep(text,
     '先检查“眼睑 / 角膜检查”：自动眨眼应完整闭合并恢复，手动闭眼 0→1 不得移动眼球几何；再检查不同瞳孔适应和角膜湿润值，确认高光与瞳孔宽度变化受限。随后检查耳眼追踪、站立、坐姿、趴卧、直行和转向，确认 V4.39 修形与 V4.36 运动没有回归。',
     '先检查“几何眼睑 / 角膜检查”：正面、三分之四和侧面下，上眼睑应承担主要闭合行程，下眼睑只小幅上提；闭眼不得露出虹膜，也不能形成贴在眼球上的灰色圆片。再调节眼缘厚度和检查色，确认壳体不穿出头脸轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。',
     'test')

    # state variables
    text=rep(text,
     'let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;',
     'let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;',
     'state vars')

    # Replace eye fragment shader: eye only, no shader lid mask.
    fs_pat=r"const fs=`#version 300 es\n[\s\S]*?`;\nconst lineVS=`#version 300 es"
    new_fs=r'''const fs=`#version 300 es
    precision highp float;in vec3 vN;flat in float vPart;in vec3 vWeightColor;in float vCorr;in vec3 vEyeDir;in vec3 vFurT;in vec3 vBindP;uniform float uWeightMode;uniform float uCorrectiveDebug;uniform vec2 uGaze;uniform float uEyeEnabled;uniform float uCornea;uniform float uPupilAdapt;uniform float uFurEnabled;uniform float uFurStrength;uniform float uFurDebug;out vec4 outColor;vec3 heat(float x){x=clamp(x,0.,1.);return mix(mix(vec3(.03,.18,.40),vec3(.06,.85,.72),smoothstep(0.,.5,x)),vec3(1.,.28,.08),smoothstep(.5,1.,x));}float hash31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));if(vPart>.5&&uEyeEnabled>.5){float cy=cos(uGaze.x),sy=sin(uGaze.x),cp=cos(uGaze.y),sp=sin(uGaze.y);vec3 g=normalize(vec3(cp*cy,cp*sy,sp));vec3 r=normalize(cross(vec3(0.,0.,1.),g));if(length(r)<.01)r=vec3(0.,1.,0.);vec3 u=normalize(cross(g,r));vec3 e=normalize(vEyeDir);float ex=dot(e,r),ey=dot(e,u),ef=dot(e,g);float iris=1.-smoothstep(.34,.43,sqrt(ex*ex+ey*ey));iris*=smoothstep(.25,.55,ef);float pupilHalf=mix(.018,.082,clamp(uPupilAdapt,0.,1.));float pupil=(1.-smoothstep(pupilHalf,pupilHalf+.025,abs(ex)))*(1.-smoothstep(.17,.25,abs(ey)))*smoothstep(.35,.72,ef);vec3 irisCol=mix(vec3(.12,.055,.015),vec3(.68,.48,.13),.75+.25*clamp(ey*2.+.5,0.,1.));vec3 eyeCol=mix(vec3(.025,.018,.012),irisCol,iris);eyeCol=mix(eyeCol,vec3(.003),pupil);float baseSpec=pow(max(dot(n,normalize(vec3(.52,-.35,.78))),0.),54.);eyeCol+=vec3(.72,.78,.82)*baseSpec*.65;vec3 h=normalize(l1+g);float wetSpec=pow(max(dot(n,h),0.),mix(42.,108.,clamp(uCornea,0.,1.)));float fres=pow(1.-max(ef,0.),3.);eyeCol+=vec3(.82,.90,.94)*wetSpec*.46*uCornea+vec3(.08,.12,.14)*fres*.34*uCornea;outColor=vec4(pow(max(eyeCol,vec3(0.)),vec3(1./2.2)),1.);return;}float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;vec3 base=uWeightMode>.5?vWeightColor:vec3(.69,.655,.59);if(uCorrectiveDebug>.5)base=heat(vCorr/.008);if(uFurDebug>.5&&vPart<.5){vec3 t=normalize(vFurT);base=.5+.5*t;d=.82;}else if(uFurEnabled>.5&&vPart<.5&&uWeightMode<.5&&uCorrectiveDebug<.5){vec3 t=normalize(vFurT);vec3 lt=normalize(l1-n*dot(l1,n)+vec3(.0001));float aniso=pow(abs(dot(t,lt)),5.);float micro=hash31(floor(vBindP*720.));base*=1.+(micro-.5)*.055*uFurStrength;base+=vec3(.11,.095,.075)*aniso*.18*uFurStrength;d*=1.+(aniso-.35)*.08*uFurStrength;}vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`;
    const lineVS=`#version 300 es'''
    text=reponce(text,fs_pat,new_fs,'fs',flags=re.S)

    # Add lid shaders and program.
    program_old="const pr=program(gl,vs,fs),lpr=program(gl,lineVS,lineFS);gl.useProgram(pr);"
    lid_program=r'''const lidVS=`#version 300 es
precision highp float;layout(location=0)in vec4 aParam;layout(location=1)in vec3 aCenter;layout(location=2)in vec3 aRadius;layout(location=3)in float aRim;layout(location=4)in vec3 aOuterPos;layout(location=5)in vec3 aOuterNor;uniform mat4 uPV;uniform mat4 uHead;uniform float uBlink;uniform float uThicknessM;out vec3 vN;out float vRim;out float vLid;out float vClosure;out float vBand;void main(){float ex=aParam.x,t=aParam.y,lid=aParam.z;float q=sqrt(max(.0001,1.-ex*ex));float close=smoothstep(0.,1.,clamp(uBlink,0.,1.));float side=sign(aCenter.y),medial=ex*side;float openInner=lid>0.?((.39-.025*medial)*q):((-.16-.015*medial)*q);float seamCenter=(-.135+.060*medial+.025*(1.-q))*q;float seam=seamCenter+(lid>0.?-.012:.012)*q;float lidClose=lid>0.?smoothstep(0.,1.,close):pow(close,1.18);float inner=mix(openInner,seam,lidClose);float innerEf=sqrt(max(.0001,1.-ex*ex-inner*inner));float rMean=max(.0001,(aRadius.x+aRadius.y+aRadius.z)/3.);float frontScale=1.+uThicknessM/rMean;vec3 innerDir=normalize(vec3(innerEf,ex,inner));vec3 innerP=aCenter+aRadius*innerDir*frontScale;vec3 innerN=normalize(vec3(innerDir.x/max(aRadius.x,.0001),innerDir.y/max(aRadius.y,.0001),innerDir.z/max(aRadius.z,.0001)));float tt=smoothstep(0.,1.,t);vec3 closeNormal=normalize(vec3(1.,ex*.10,inner*.08));innerN=normalize(mix(innerN,closeNormal,close*(1.-tt)*.58));vec3 p,n;if(aParam.w<.5){vec3 outerN=normalize(aOuterNor);vec3 outerP=aOuterPos+outerN*uThicknessM*.16;p=mix(innerP,outerP,tt);p.x+=close*(lid>0.?uThicknessM*.46:-uThicknessM*.16)*(1.-tt);n=normalize(mix(innerN,outerN,tt));}else{float shell=aParam.w<1.5?frontScale:1.-uThicknessM/rMean*.35;p=aCenter+aRadius*innerDir*shell;p.x+=close*(lid>0.?uThicknessM*.46:-uThicknessM*.16);vec3 rimNormal=normalize(vec3(.42,0.,-lid*.91));n=normalize(mix(innerN,rimNormal,step(.5,aRim)));}vec4 wp=uHead*vec4(p,1.);gl_Position=uPV*wp;vN=normalize(mat3(uHead)*n);vRim=aRim;vLid=lid;vClosure=close;vBand=t;}`;
    const lidFS=`#version 300 es
    precision highp float;in vec3 vN;in float vRim;in float vLid;in float vClosure;in float vBand;uniform float uDebug;out vec4 outColor;void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;vec3 base=vec3(.69,.655,.59);float rim=smoothstep(.15,.85,vRim);float closedGate=smoothstep(.72,.98,vClosure);float seamBand=(1.-smoothstep(.012,.100,vBand))*closedGate;float seamDark=seamBand*step(0.,vLid);float foldBand=(smoothstep(.10,.17,vBand)-smoothstep(.20,.30,vBand))*closedGate*step(0.,vLid);float edgeAlpha=1.-smoothstep(.60,1.,vBand);base*=vLid>0.?.975:1.015;base*=mix(1.,.60,rim);base*=1.-.14*rim*smoothstep(.45,.95,vClosure);base*=1.-.64*seamDark;base*=1.-.13*foldBand;float soft=pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);vec3 col=base*d+vec3(.025,.04,.045)*soft;if(uDebug>.5)col=mix(vec3(.08,.52,.92),vec3(1.,.30,.07),step(0.,vLid))*(.55+.45*max(dot(n,l1),0.));outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),uDebug>.5?1.:edgeAlpha);}`;
    const pr=program(gl,vs,fs),lpr=program(gl,lineVS,lineFS),lidPr=program(gl,lidVS,lidFS);gl.useProgram(pr);'''
    text=rep(text,program_old,lid_program,'programs')

    # Add geometry builder before mesh VAO.
    marker="// V4.34 hotfix: isolate mesh, grid and skeleton vertex state in separate VAOs."
    geom_code=r'''function buildGeometricEyelids(mesh){
const groups=[[],[]];for(let i=0;i<mesh.vc;i++){if(mesh.part[i]>.5)groups[mesh.pos[i*3+1]>=0?0:1].push(i)}
const specs=groups.map(ids=>{if(!ids.length)throw new Error('V4.42 眼球顶点缺失');const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity],c=[0,0,0];for(const i of ids)for(let k=0;k<3;k++){const v=mesh.pos[i*3+k];mn[k]=Math.min(mn[k],v);mx[k]=Math.max(mx[k],v);c[k]+=v}for(let k=0;k<3;k++)c[k]/=ids.length;return{center:c,radius:[(mx[0]-mn[0])*.5,(mx[1]-mn[1])*.5,(mx[2]-mn[2])*.5]}});
const bodyTris=[];for(let k=0;k<mesh.idx.length;k+=3){const a=mesh.idx[k],b=mesh.idx[k+1],c=mesh.idx[k+2];if(mesh.part[a]<.5&&mesh.part[b]<.5&&mesh.part[c]<.5)bodyTris.push(a,b,c)}
function sampleFace(spec,y,z,ex,ey){let bestX=-1e9,bestP=null,bestN=null;const minX=spec.center[0]-spec.radius[0]*1.8,maxX=spec.center[0]+spec.radius[0]*2.;for(let k=0;k<bodyTris.length;k+=3){const ia=bodyTris[k],ib=bodyTris[k+1],ic=bodyTris[k+2],ao=ia*3,bo=ib*3,co=ic*3,ay=mesh.pos[ao+1],az=mesh.pos[ao+2],by=mesh.pos[bo+1],bz=mesh.pos[bo+2],cy=mesh.pos[co+1],cz=mesh.pos[co+2],den=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(den)<1e-12)continue;const wa=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/den,wb=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/den,wc=1-wa-wb;if(wa<-.001||wb<-.001||wc<-.001)continue;const x=wa*mesh.pos[ao]+wb*mesh.pos[bo]+wc*mesh.pos[co];if(x<minX||x>maxX||x<=bestX)continue;let nx=wa*mesh.nor[ao]+wb*mesh.nor[bo]+wc*mesh.nor[co],ny=wa*mesh.nor[ao+1]+wb*mesh.nor[bo+1]+wc*mesh.nor[co+1],nz=wa*mesh.nor[ao+2]+wb*mesh.nor[bo+2]+wc*mesh.nor[co+2],nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;bestX=x;bestP=[x,y,z];bestN=[nx,ny,nz]}if(bestP)return{p:bestP,n:bestN};const ef=Math.sqrt(Math.max(.0001,1.-ex*ex-ey*ey)),dx=ef,dy=ex,dz=ey,dl=Math.hypot(dx,dy,dz)||1,ux=dx/dl,uy=dy/dl,uz=dz/dl,nx=ux/Math.max(spec.radius[0],.0001),ny=uy/Math.max(spec.radius[1],.0001),nz=uz/Math.max(spec.radius[2],.0001),nl=Math.hypot(nx,ny,nz)||1;return{p:[spec.center[0]+spec.radius[0]*ux*1.018,spec.center[1]+spec.radius[1]*uy*1.018,spec.center[2]+spec.radius[2]*uz*1.018],n:[nx/nl,ny/nl,nz/nl]}}
const param=[],center=[],radius=[],rim=[],outerPos=[],outerNor=[],idx=[];let vcount=0;const cols=40,rows=6,xmax=.995;function push(spec,ex,t,lid,mode,isRim,outer){param.push(ex,t,lid,mode);center.push(...spec.center);radius.push(...spec.radius);rim.push(isRim?1:0);outerPos.push(...outer.p);outerNor.push(...outer.n);return vcount++}
for(const spec of specs)for(const lid of[1,-1]){const outerFactor=lid>0?.96:-.90,outer=[];for(let i=0;i<=cols;i++){const ex=-xmax+2*xmax*i/cols,q=Math.sqrt(Math.max(.0001,1.-ex*ex)),ey=outerFactor*q,y=spec.center[1]+spec.radius[1]*ex,z=spec.center[2]+spec.radius[2]*ey;outer.push(sampleFace(spec,y,z,ex,ey))}const base=vcount;for(let i=0;i<=cols;i++){const ex=-xmax+2*xmax*i/cols;for(let j=0;j<=rows;j++)push(spec,ex,j/rows,lid,0,false,outer[i])}for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const a=base+i*(rows+1)+j,b=a+rows+1;idx.push(a,b,a+1,a+1,b,b+1)}const rb=vcount;for(let i=0;i<=cols;i++){const ex=-xmax+2*xmax*i/cols;push(spec,ex,0,lid,1,true,outer[i]);push(spec,ex,0,lid,2,true,outer[i])}for(let i=0;i<cols;i++){const a=rb+i*2,b=a+2;idx.push(a,b,a+1,a+1,b,b+1)}}return{param:new Float32Array(param),center:new Float32Array(center),radius:new Float32Array(radius),rim:new Float32Array(rim),outerPos:new Float32Array(outerPos),outerNor:new Float32Array(outerNor),idx:new Uint16Array(idx),vertices:vcount,triangles:idx.length/3,eyeSpecs:specs,fitMode:'head_surface_raycast'}}
    const lidMesh=buildGeometricEyelids(m),headBoneIndex=RIG.nameToIndex.head;
    '''
    text=rep(text,marker,geom_code+marker,'geometry builder')

    # Add lid VAO and uniforms after mesh VAO setup/U definitions.
    old="const U={pv:gl.getUniformLocation(pr,'uPV'),bones:gl.getUniformLocation(pr,'uBones[0]'),weight:gl.getUniformLocation(pr,'uWeightMode'),posture:gl.getUniformLocation(pr,'uPostureCorrection'),corrective:gl.getUniformLocation(pr,'uCorrectiveEnabled'),normalCorrective:gl.getUniformLocation(pr,'uNormalCorrectiveEnabled'),debug:gl.getUniformLocation(pr,'uCorrectiveDebug'),gaze:gl.getUniformLocation(pr,'uGaze'),eye:gl.getUniformLocation(pr,'uEyeEnabled'),lid:gl.getUniformLocation(pr,'uLidEnabled'),blink:gl.getUniformLocation(pr,'uBlink'),cornea:gl.getUniformLocation(pr,'uCornea'),pupil:gl.getUniformLocation(pr,'uPupilAdapt'),fur:gl.getUniformLocation(pr,'uFurEnabled'),furStrength:gl.getUniformLocation(pr,'uFurStrength'),furDebug:gl.getUniformLocation(pr,'uFurDebug')},LU={pv:gl.getUniformLocation(lpr,'uPV'),color:gl.getUniformLocation(lpr,'uColor')};"
    new="const U={pv:gl.getUniformLocation(pr,'uPV'),bones:gl.getUniformLocation(pr,'uBones[0]'),weight:gl.getUniformLocation(pr,'uWeightMode'),posture:gl.getUniformLocation(pr,'uPostureCorrection'),corrective:gl.getUniformLocation(pr,'uCorrectiveEnabled'),normalCorrective:gl.getUniformLocation(pr,'uNormalCorrectiveEnabled'),debug:gl.getUniformLocation(pr,'uCorrectiveDebug'),gaze:gl.getUniformLocation(pr,'uGaze'),eye:gl.getUniformLocation(pr,'uEyeEnabled'),cornea:gl.getUniformLocation(pr,'uCornea'),pupil:gl.getUniformLocation(pr,'uPupilAdapt'),fur:gl.getUniformLocation(pr,'uFurEnabled'),furStrength:gl.getUniformLocation(pr,'uFurStrength'),furDebug:gl.getUniformLocation(pr,'uFurDebug')},LU={pv:gl.getUniformLocation(lpr,'uPV'),color:gl.getUniformLocation(lpr,'uColor')};\nconst lidVao=gl.createVertexArray();gl.bindVertexArray(lidVao);const lidParamBuf=attr(0,lidMesh.param,4,gl.FLOAT),lidCenterBuf=attr(1,lidMesh.center,3,gl.FLOAT),lidRadiusBuf=attr(2,lidMesh.radius,3,gl.FLOAT),lidRimBuf=attr(3,lidMesh.rim,1,gl.FLOAT),lidOuterPosBuf=attr(4,lidMesh.outerPos,3,gl.FLOAT),lidOuterNorBuf=attr(5,lidMesh.outerNor,3,gl.FLOAT),lidIb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,lidIb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,lidMesh.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);const LidU={pv:gl.getUniformLocation(lidPr,'uPV'),head:gl.getUniformLocation(lidPr,'uHead'),blink:gl.getUniformLocation(lidPr,'uBlink'),thickness:gl.getUniformLocation(lidPr,'uThicknessM'),debug:gl.getUniformLocation(lidPr,'uDebug')};"
    text=rep(text,old,new,'lid vao')

    # Frame draw injection. Disable old shader lid and draw geometry.
    old_frame_draw="gl.uniform1f(U.eye,eyeLayerEnabled?1:0);gl.uniform1f(U.lid,blinkLayerEnabled?1:0);gl.uniform1f(U.blink,expressionState.blink);gl.uniform1f(U.cornea,corneaLayerEnabled?corneaResponse:0);gl.uniform1f(U.pupil,pupilAdapt);gl.uniform1f(U.fur,furLayerEnabled?1:0);gl.uniform1f(U.furStrength,furStrength);gl.uniform1f(U.furDebug,furDebugEnabled?1:0);gl.drawElements(gl.TRIANGLES,m.ic,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);drawLines(pv,mats.jpos);"
    new_frame_draw="gl.uniform1f(U.eye,eyeLayerEnabled?1:0);gl.uniform1f(U.cornea,corneaLayerEnabled?corneaResponse:0);gl.uniform1f(U.pupil,pupilAdapt);gl.uniform1f(U.fur,furLayerEnabled?1:0);gl.uniform1f(U.furStrength,furStrength);gl.uniform1f(U.furDebug,furDebugEnabled?1:0);gl.drawElements(gl.TRIANGLES,m.ic,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);if(blinkLayerEnabled){gl.useProgram(lidPr);gl.bindVertexArray(lidVao);gl.uniformMatrix4fv(LidU.pv,false,pv);gl.uniformMatrix4fv(LidU.head,false,mats.skin.subarray(headBoneIndex*16,headBoneIndex*16+16));gl.uniform1f(LidU.blink,expressionState.blink);gl.uniform1f(LidU.thickness,lidThickness);gl.uniform1f(LidU.debug,lidDebugEnabled?1:0);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawElements(gl.TRIANGLES,lidMesh.idx.length,gl.UNSIGNED_SHORT,0);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null)}drawLines(pv,mats.jpos);"
    text=rep(text,old_frame_draw,new_frame_draw,'frame draw')

    # KPI and metrics.
    text=rep(text,"$('#kBlink').textContent=(expressionState.blinkMode==='auto'?'自动 ':'手动 ')+expressionState.blink.toFixed(2);$('#kCornea')",
             "$('#kBlink').textContent=(expressionState.blinkMode==='auto'?'自动 ':'手动 ')+expressionState.blink.toFixed(2);$('#kLid').textContent=(blinkLayerEnabled?'4 片 / ':'关闭 / ')+(lidThickness*1000).toFixed(2)+' mm';$('#kCornea')",'kpi runtime')
    text=rep(text,'expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},camera:',
             'expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,lidDebugEnabled,lidThickness,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},eyelidGeometry:{enabled:blinkLayerEnabled,debug:lidDebugEnabled,thicknessM:lidThickness,vertices:lidMesh.vertices,triangles:lidMesh.triangles,headBoneIndex},camera:',
             'metrics')

    # Controls.
    text=rep(text,"layerSlider('#blinkAmount',v=>{manualBlink=v;autoBlink=false;$('#autoBlink').classList.remove('active');$('#autoBlink').textContent='手动眨眼'});layerSlider('#corneaResponse',v=>corneaResponse=v);",
             "layerSlider('#blinkAmount',v=>{manualBlink=v;autoBlink=false;$('#autoBlink').classList.remove('active');$('#autoBlink').textContent='手动眨眼'});layerSlider('#lidThickness',v=>lidThickness=v,v=>(v*1000).toFixed(2)+' mm');layerSlider('#corneaResponse',v=>corneaResponse=v);",
             'lid slider')
    text=rep(text,"$('#blinkToggle').onclick=e=>{blinkLayerEnabled=!blinkLayerEnabled;e.currentTarget.classList.toggle('active',blinkLayerEnabled)};$('#corneaToggle')",
             "$('#blinkToggle').onclick=e=>{blinkLayerEnabled=!blinkLayerEnabled;e.currentTarget.classList.toggle('active',blinkLayerEnabled)};$('#lidDebugToggle').onclick=e=>{lidDebugEnabled=!lidDebugEnabled;e.currentTarget.classList.toggle('active',lidDebugEnabled)};$('#corneaToggle')",
             'lid debug control')
    text=rep(text,"$('#eyeLayer').onclick=$('#eyeToggle').onclick;$('#blinkLayer').onclick=$('#blinkToggle').onclick;$('#corneaLayer')",
             "$('#eyeLayer').onclick=$('#eyeToggle').onclick;$('#blinkLayer').onclick=$('#blinkToggle').onclick;$('#lidDebug').onclick=$('#lidDebugToggle').onclick;$('#corneaLayer')",
             'toolbar debug')

    # Stats and API.
    text=rep(text,'proceduralEyelid:true,deterministicBlink:true,cornealResponse:true,pupilAdaptation:true,shortFurDirectionField:true',
             'proceduralEyelid:false,geometricEyelidVolume:true,geometricEyelidPieces:4,geometricEyelidVertices:lidMesh.vertices,geometricEyelidTriangles:lidMesh.triangles,deterministicBlink:true,cornealResponse:true,pupilAdaptation:true,shortFurDirectionField:true',
             'stats features')
    text=rep(text,"if(cfg.blink!==undefined){manualBlink=Math.max(0,Math.min(1,+cfg.blink));if(cfg.autoBlink===undefined)autoBlink=false}if(cfg.cornea!==undefined)",
             "if(cfg.blink!==undefined){manualBlink=Math.max(0,Math.min(1,+cfg.blink));if(cfg.autoBlink===undefined)autoBlink=false}if(cfg.lidThickness!==undefined)lidThickness=Math.max(.00015,Math.min(.00075,+cfg.lidThickness));if(cfg.lidDebug!==undefined)lidDebugEnabled=!!cfg.lidDebug;if(cfg.cornea!==undefined)",
             'api set')
    text=rep(text,'return{autoExpression,autoBlink,manualGazeYaw,manualGazePitch,manualEarLeft,manualEarRight,manualBlink,corneaResponse,pupilAdapt,furStrength,eyeLayerEnabled,blinkLayerEnabled,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,furDebugEnabled}};',
             'return{autoExpression,autoBlink,manualGazeYaw,manualGazePitch,manualEarLeft,manualEarRight,manualBlink,lidThickness,lidDebugEnabled,corneaResponse,pupilAdapt,furStrength,eyeLayerEnabled,blinkLayerEnabled,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,furDebugEnabled}};',
             'api return')

    # Version public API and render markers.
    text=text.replace('__CAT_V441_','__CAT_V442_')
    text=rep(text,"window.__CAT_V442_RENDER_STATE__='eyelid-cornea-response'",
             "window.__CAT_V442_RENDER_STATE__='bounded-geometric-eyelid-volume'",'render state')
    text=rep(text,"window.__CAT_V442_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',payload:'CATV440'};",
             "window.__CAT_V442_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',payload:'CATV440'};window.__CAT_V442_EYELID_GEOMETRY__={pieces:4,vertices:lidMesh.vertices,triangles:lidMesh.triangles,fitMode:lidMesh.fitMode,headBoneIndex,source:'procedural-bounded-shells'};",
             'baseline geometry api')

    return text


def write_metadata(source_text: str, output_text: str) -> None:
    source_payload = embedded_payload(source_text)
    output_payload = embedded_payload(output_text)
    source_rig, _, _ = extract_json(source_text, "RIG", "LIB")
    output_rig, _, _ = extract_json(output_text, "RIG", "LIB")

    checks = {
        "schema": "cat_kaopu/v442_technical_qa@1.0",
        "version": "V4.42",
        "sourceBaseline": str(BASELINE.relative_to(MODULE_ROOT)),
        "outputWorkbench": str(CURRENT_HTML.relative_to(MODULE_ROOT)),
        "sourceHtmlSha256": sha256_bytes(source_text.encode("utf-8")),
        "outputHtmlSha256": sha256_bytes(output_text.encode("utf-8")),
        "sourcePayloadSha256": sha256_bytes(source_payload),
        "outputPayloadSha256": sha256_bytes(output_payload),
        "payloadByteIdentical": source_payload == output_payload,
        "rigJsonIdentical": source_rig == output_rig,
        "boneCount": len(output_rig.get("bones", [])),
        "neutralBodySurfaceChanged": False,
        "skinWeightsChanged": False,
        "addedGeometry": {
            "type": "four bounded procedural eyelid shell volumes",
            "headBoneDriven": True,
            "writesBackToPayload": False,
        },
        "requiredMarkers": {
            "readyApi": "__CAT_V442_READY__" in output_text,
            "geometryApi": "__CAT_V442_EYELID_GEOMETRY__" in output_text,
            "geometryBuilder": "buildGeometricEyelids" in output_text,
            "lidVertexShader": "const lidVS=`#version 300 es" in output_text,
            "lidFragmentShader": "const lidFS=`#version 300 es" in output_text,
            "lidThicknessControl": 'id="lidThickness"' in output_text,
            "shaderMaskDisabled": "uLidEnabled" not in output_text and "float aperture" not in output_text,
            "geometryDraw": "gl.drawElements(gl.TRIANGLES,lidMesh.idx.length" in output_text,
        },
        "runtimeDependencies": {
            "externalModel": False,
            "externalTexture": False,
            "externalAnimation": False,
        },
        "visualAcceptance": False,
        "productionReady": False,
    }
    if not checks["payloadByteIdentical"]:
        raise RuntimeError("V4.42 changed the V4.40 CATV440 payload")
    if not checks["rigJsonIdentical"]:
        raise RuntimeError("V4.42 changed the 34-bone rig")
    if checks["boneCount"] != 34:
        raise RuntimeError(f"expected 34 bones, found {checks['boneCount']}")
    if not all(checks["requiredMarkers"].values()):
        raise RuntimeError(f"missing V4.42 marker: {checks['requiredMarkers']}")

    QA_TECHNICAL.parent.mkdir(parents=True, exist_ok=True)
    QA_TECHNICAL.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    current = json.loads(CURRENT_JSON.read_text(encoding="utf-8"))
    current["date"] = "2026-09-16"
    current["currentVersion"] = "V4.42"
    current["currentEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["repoOverlayEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["sourceHandoff"] = current.get("sourceHandoff") or current.get("handoff")
    current["currentLayer"] = "four bounded procedural geometric eyelid shell volumes + deterministic blink + corneal response"
    current.setdefault("frozenBaselines", {})["expressionPayload"] = "V4.40 CATV440 payload and 34-bone rig unchanged; V4.41 eye/cornea controls inherited"
    current["runtimeDependencies"] = {"externalModel": False, "externalTexture": False, "externalAnimation": False}
    current.setdefault("geometry", {}).update({
        "eyelidVertices": 1476,
        "eyelidTriangles": 2240,
        "eyelidPieces": 4,
        "eyelidGeometryStorage": "runtime-generated outside CATV440",
    })
    current["acceptance"] = {
        "surfaceUserAccepted": True,
        "visualAcceptance": False,
        "productionReady": False,
        "userReviewRequired": True,
    }
    current["technicalInvariants"] = {
        "embeddedPayloadSha256": sha256_bytes(output_payload),
        "sourcePayloadSha256": sha256_bytes(source_payload),
        "payloadUnchangedFromV440": source_payload == output_payload,
        "rigJsonIdenticalToV441": source_rig == output_rig,
        "boneCount": 34,
        "neutralSurfaceChanged": False,
        "skinWeightsChanged": False,
        "addedGeometry": "four head-bone-driven eyelid shell volumes outside CATV440",
    }
    current["nextProductionGate"] = [
        "user visual review of open, half-blink and closed eyelids from front, three-quarter and side views",
        "refine inner and outer canthus curves only if the four shell volumes remain inside the frozen head silhouette",
        "add bounded third-eyelid study only after primary upper/lower closure is accepted",
        "bounded ear-root corrective for larger ear poses",
        "repair V4.39 sit/lie paw and chest-abdomen support before silhouette fur",
    ]
    current.setdefault("github", {})["existingBranch"] = "codex/cat-kaopu-v440-mainline-20260915"
    current["github"]["sourceBranchHead"] = "1b5396be0b52513fc70f9183d260bccee85a9984"
    current["github"]["existingBranchHead"] = None
    current["github"]["recommendedNewBranch"] = "codex/cat-kaopu-v440-mainline-20260915"
    CURRENT_JSON.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    README.write_text(
        """# Cat Kaopu module — V4.42 geometric eyelid candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.42 builder: `tools/build_cat_v442_geometric_eyelid.py`

V4.41 frozen source: `baselines/v4.41/CAT_KAOPU_V441_EYELID_CORNEA_WORKBENCH_2026-09-15.html`

Run module verification:

```bash
python tools/verify_cat_v442_module.py
```

V4.42 removes the fake shader lid mask from the eye sphere and adds four bounded procedural eyelid shell volumes. The shells are generated outside the CATV440 payload, follow the existing head bone, expose a real edge-thickness control and retain deterministic blink, pupil adaptation and corneal response.

The V4.32 body surface, CATV440 binary payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. `visualAcceptance=false` and `productionReady=false` remain in force until user review.
""",
        encoding="utf-8",
    )

    DOC_REPORT.parent.mkdir(parents=True, exist_ok=True)
    DOC_REPORT.write_text(
        f"""# CAT KAOPU V4.42 执行报告

## 本轮目标

把 V4.41 贴在眼球表面的片元遮罩替换为独立、受限、可测厚的眼睑几何体积，同时继续冻结 V4.32 中性猫体、V4.40 `CATV440` 载荷、34 骨和全部既有运动修形。

## 实际实现

- 从 V4.40 眼球顶点边界自动推导左右眼中心和三轴半径，不另外导入模型。
- 为左右眼各生成上、下眼睑壳体，共四片；壳体包含可见表面和内缘厚度壁。
- 上眼睑承担主要闭合行程，下眼睑只小幅上提，闭合缝位置连续。
- 几何眼睑只读取 `head` 骨矩阵；不修改猫体顶点、眼球顶点、RIG、蒙皮权重或二进制载荷。
- V4.41 的确定性眨眼、角膜响应、瞳孔适应、耳眼控制和短毛方向场继续保留。
- 增加眼缘厚度、几何检查色、运行指标和公开 QA 接口。

## 冻结层验证

- V4.41 源载荷 SHA-256：`{sha256_bytes(source_payload)}`
- V4.42 输出载荷 SHA-256：`{sha256_bytes(output_payload)}`
- 二进制载荷逐字节一致：`{str(source_payload == output_payload).lower()}`
- `RIG` JSON 完全一致：`{str(source_rig == output_rig).lower()}`
- 骨骼数量：`{len(output_rig.get('bones', []))}`

## 明确限制

V4.42 是受限的程序化壳体，不是完整眼眶软组织模拟。它已有独立几何和眼缘厚度，但尚未建立第三眼睑、泪膜折射、眼睑与眉弓/面颊的软组织挤压、睫毛或毛束。当前状态保持 `visualAcceptance=false`、`productionReady=false`。
""",
        encoding="utf-8",
    )

    DOC_REVIEW.write_text(
        """# CAT KAOPU V4.42 自检记录

## 已通过的结构检查

1. V4.41 与 V4.42 的 `CATV440` 嵌入载荷逐字节一致。
2. `RIG` JSON、34 根骨骼、耳骨索引和蒙皮权重未改变。
3. V4.32 中性猫体、V4.39 坐卧修形与 V4.36 运动逻辑没有写入性修改。
4. 眼睑由四片独立程序化壳体构成，并由既有头骨矩阵驱动。
5. 原眼球片元遮罩已经停用，眼球着色只保留虹膜、竖瞳和角膜响应。
6. 页面仍不读取外部模型、贴图或动画。

## 必须进行的视觉检查

1. 正面、三分之四和侧面下，开眼时眼缘是否与头脸自然衔接。
2. 半闭眼时是否以上眼睑运动为主，并保持左右一致。
3. 完全闭眼时是否遮住虹膜、没有球面灰片、穿模或明显裂缝。
4. 眼缘厚度 0.15–0.75 mm 范围内是否始终位于冻结头部轮廓内部。
5. 站立、坐姿、趴卧、行走、转向和耳眼追踪是否无回归。

## 不能混淆的结论

“增加了几何眼睑”不等于眼部系统完成。当前几何是受限壳体，不含第三眼睑、泪膜折射和眼眶软组织挤压；在用户完成多视角视觉验收前，不得标记为生产可用。
""",
        encoding="utf-8",
    )


def write_manifest() -> None:
    files = []
    for path in sorted(MODULE_ROOT.rglob("*")):
        if not path.is_file() or path == MANIFEST or "__pycache__" in path.parts:
            continue
        rel = path.relative_to(MODULE_ROOT).as_posix()
        files.append({"path": rel, "bytes": path.stat().st_size, "sha256": sha256_file(path)})
    manifest = {
        "schema": "cat_kaopu/module_build_manifest@1.2",
        "version": "V4.42",
        "buildId": "cat-kaopu-v442-geometric-eyelid-20260916",
        "currentEntry": "workbench/CAT_KAOPU_CURRENT.html",
        "runtimePayload": "runtime/cat_v440.bin",
        "frozenBaselines": {
            "neutralSurface": "V4.32",
            "baseSkinWeights": "V4.34 except bounded ear region introduced in V4.40",
            "camera": "V4.34.1",
            "locomotionRegression": "V4.36",
            "postureCorrective": "V4.39",
            "eyeExpression": "V4.41",
            "binaryPayload": "V4.40 CATV440 unchanged",
        },
        "addedGeometry": "four bounded head-bone-driven eyelid shell volumes",
        "visualAcceptance": False,
        "productionReady": False,
        "files": files,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if not BASELINE.exists():
        raise RuntimeError(f"V4.41 baseline missing: {BASELINE}")
    source_text = BASELINE.read_text(encoding="utf-8")
    output_text = build_html(source_text)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    CURRENT_HTML.parent.mkdir(parents=True, exist_ok=True)
    OUT_HTML.write_text(output_text, encoding="utf-8")
    CURRENT_HTML.write_text(output_text, encoding="utf-8")
    write_metadata(source_text, output_text)
    write_manifest()
    print(
        json.dumps(
            {
                "version": "V4.42",
                "source": str(BASELINE),
                "output": str(CURRENT_HTML),
                "htmlSha256": sha256_bytes(output_text.encode("utf-8")),
                "payloadSha256": sha256_bytes(embedded_payload(output_text)),
                "payloadUnchanged": embedded_payload(source_text) == embedded_payload(output_text),
                "visualAcceptance": False,
                "productionReady": False,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
