from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "baselines/v4.45/CAT_KAOPU_V445_MLS_PERIORBITAL_WORKBENCH_2026-09-16.html"
FALLBACK_BASELINE = ROOT / "build/v4.45/CAT_KAOPU_V445_MLS_PERIORBITAL_WORKBENCH_2026-09-16.html"
CURRENT = ROOT / "workbench/CAT_KAOPU_CURRENT.html"
BUILD = ROOT / "build/v4.46/CAT_KAOPU_V446_WIDE_EYE_REGION_CARRIER_WORKBENCH_2026-09-16.html"
TECH_QA = ROOT / "qa/CAT_KAOPU_V446_TECHNICAL_QA_2026-09-16.json"
EXEC_DOC = ROOT / "docs/CAT_KAOPU_V446_EXECUTION_REPORT_2026-09-16.md"
SELF_DOC = ROOT / "docs/CAT_KAOPU_V446_SELF_REVIEW_2026-09-16.md"
README = ROOT / "README.md"
CURRENT_JSON = ROOT / "CURRENT.json"
MANIFEST = ROOT / "BUILD_MANIFEST.json"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rep(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


def reponce(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    output, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one marker, found {count}")
    return output


def extract_payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        raise RuntimeError("embedded CAT payload marker missing")
    import base64

    return base64.b64decode(match.group(1))


def extract_rig(text: str) -> object:
    marker = "const RIG="
    start = text.find(marker)
    if start < 0:
        raise RuntimeError("RIG JSON marker missing")
    obj, _ = json.JSONDecoder().raw_decode(text[start + len(marker):])
    return obj


def build_html(source: str) -> str:
    s = source

    # Visible version, scope and controls.
    s = rep(
        s,
        "<title>CAT KAOPU V4.45 · MLS 平滑眶周软组织与猫眼弧线</title>",
        "<title>CAT KAOPU V4.46 · 双眼统一区域面部载体</title>",
        "title",
    )
    s = rep(
        s,
        'alt="V4.45 MLS 平滑眶周软组织与猫眼弧线静态回退"',
        'alt="V4.46 双眼统一区域面部载体静态回退"',
        "fallback alt",
    )
    s = rep(
        s,
        '<aside><h1>CAT KAOPU V4.45</h1><div class="sub">V4.32 冻结整猫表面 → V4.44 连续拓扑 → V4.45 MLS 局部平滑、C1 边界与上睑主导弧线</div>',
        '<aside><h1>CAT KAOPU V4.46</h1><div class="sub">V4.32 冻结整猫表面 → V4.45 眶周环带 → V4.46 眉弓、鼻根、双眼与上面颊统一区域载体</div>',
        "header",
    )
    s = rep(
        s,
        '<span class="tag good">MLS 平滑眶周</span><span class="tag good">双眼各一片</span><span class="tag good">连续内外眼角</span><span class="tag good">C1 边界回接</span><span class="tag good">上睑主导闭合</span>',
        '<span class="tag good">统一眼区面部载体</span><span class="tag good">双眼同一曲面</span><span class="tag good">眉弓/鼻根/面颊连续</span><span class="tag good">冻结边界回接</span><span class="tag good">单主闭合缝</span>',
        "tags",
    )
    s = s.replace("连续眶周", "眼区面部载体")
    s = s.replace("眶周检查", "眼区载体检查")

    old_controls = (
        '<label><span>软组织体积</span><input id="patchStrength" max="1" min="0" step="0.05" type="range" value="0.78"/><output>0.78</output></label>'
        '<label><span>MLS 平滑</span><input id="smoothStrength" max="1" min="0" step="0.05" type="range" value="0.92"/><output>0.92</output></label>'
        '<label><span>闭合弧度</span><input id="arcStrength" max="1" min="0" step="0.05" type="range" value="0.78"/><output>0.78</output></label>'
        '<label><span>上睑褶皱</span><input id="creaseStrength" max="1" min="0" step="0.05" type="range" value="0.58"/><output>0.58</output></label>'
    )
    new_controls = (
        '<label><span>整体融合</span><input id="patchStrength" max="1" min="0" step="0.05" type="range" value="0.88"/><output>0.88</output></label>'
        '<label><span>面部平滑</span><input id="smoothStrength" max="1" min="0" step="0.05" type="range" value="0.94"/><output>0.94</output></label>'
        '<label><span>眉弓体积</span><input id="browStrength" max="1" min="0" step="0.05" type="range" value="0.72"/><output>0.72</output></label>'
        '<label><span>鼻根连续</span><input id="noseStrength" max="1" min="0" step="0.05" type="range" value="0.64"/><output>0.64</output></label>'
        '<label><span>上面颊支撑</span><input id="cheekStrength" max="1" min="0" step="0.05" type="range" value="0.58"/><output>0.58</output></label>'
        '<label><span>闭合弧度</span><input id="arcStrength" max="1" min="0" step="0.05" type="range" value="0.86"/><output>0.86</output></label>'
        '<label><span>主闭合缝</span><input id="creaseStrength" max="1" min="0" step="0.05" type="range" value="0.54"/><output>0.54</output></label>'
    )
    s = rep(s, old_controls, new_controls, "controls")
    s = rep(
        s,
        '<div class="kpi"><b>体积 / 平滑 / 弧度 / 褶皱</b><span id="kPatch">0.78 / 0.92 / 0.78 / 0.58</span></div>',
        '<div class="kpi"><b>融合 / 平滑 / 眉弓 / 鼻根 / 面颊</b><span id="kPatch">0.88 / 0.94 / 0.72 / 0.64 / 0.58</span></div>',
        "kpi label",
    )
    s = rep(
        s,
        "耳朵和眼球继续沿用 V4.40。V4.45 保留每眼一张连续环形拓扑，但不再逐点复制粗三角眼眶：局部头脸样本经过加权二次移动最小二乘拟合，外缘最后一圈再严格回接冻结 V4.32 表面；中间环带使用高阶平滑权重建立连续法线和受限曲率。闭眼改为上睑主导的拱形闭合线。原猫体、眼球、34 骨与蒙皮权重均不改。",
        "耳朵和眼球继续沿用 V4.40。V4.46 不再只围绕两只眼各放一圈环带，而是生成一张覆盖眉弓、鼻根、双眼和上面颊的连续面部载体；载体在一个曲面内切出两条动态睑裂，并以同一软组织场形成上眼睑、下眼睑、内外眼角和闭合缝。外边界精确回到冻结 V4.32 头脸，原猫体、眼球、34 骨与蒙皮权重均不改。",
        "main note",
    )
    s = rep(
        s,
        "本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形及 V4.36 运动接触。V4.45 在 V4.44 连续双眼拓扑上一次性加入 MLS 局部曲面、C1 边界回接、上睑主导闭合弧、眼角收束和几何褶皱；不再增加独立覆盖壳。第三眼睑、泪膜折射、胡须和轮廓毛束仍不进入本轮。",
        "本轮冻结 V4.32 中性猫体、V4.40 CATV440 与 34 骨权重、V4.39 坐卧修形和 V4.36 运动接触。新增内容不是更多眼睑片，而是一个双眼统一区域面部载体；它只读取冻结头脸采样和 head 骨矩阵，不写回主体几何。第三眼睑、胡须和轮廓毛束仍不进入本轮。",
        "scope note",
    )
    s = rep(
        s,
        "先检查眼部超近景：正面、三分之四和侧面下，开眼时外圈不得出现方形补片，半闭时上睑承担主要行程，完全闭眼时闭合线必须保持拱形且内外眼角连续。再把 MLS 平滑调到 0 与 1，确认变化只发生在局部曲率，不改变头部外轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。",
        "先检查双眼统一区域近景：关闭载体时应回到 V4.45，开启后眉弓、鼻根、内外眼角和上面颊应属于同一连续曲面；开眼不得出现环形边界，半闭时上睑承担主要行程，完全闭眼只保留一条拱形主缝。再把平滑、眉弓、鼻根和面颊参数分别调到 0 与 1，确认外轮廓始终不变。最后一次性回归站立、坐姿、趴卧、直行、转向与耳眼追踪。",
        "test note",
    )

    # Runtime state.
    s = rep(
        s,
        "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,patchStrength=.78,smoothStrength=.92,arcStrength=.78,creaseStrength=.58,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;",
        "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,patchStrength=.88,smoothStrength=.94,browStrength=.72,noseStrength=.64,cheekStrength=.58,arcStrength=.86,creaseStrength=.54,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;",
        "state variables",
    )

    # Replace the V4.45 annular carrier shaders with one bilateral facial field.
    shader_pattern = r"const periVS=`#version 300 es[\s\S]*?`;\nconst periFS=`#version 300 es[\s\S]*?`;\n"
    shader_replacement = r'''const periVS=`#version 300 es
precision highp float;layout(location=0)in vec4 aParam;layout(location=1)in vec3 aRawPos;layout(location=2)in vec3 aRawNor;layout(location=3)in vec3 aSmoothPos;layout(location=4)in vec3 aSmoothNor;uniform mat4 uPV;uniform mat4 uHead;uniform vec3 uEyeL;uniform vec3 uEyeR;uniform vec3 uEyeRadL;uniform vec3 uEyeRadR;uniform float uBlink;uniform float uThicknessM;uniform float uPatchStrength;uniform float uSmoothStrength;uniform float uBrowStrength;uniform float uNoseStrength;uniform float uCheekStrength;uniform float uArcStrength;uniform float uCreaseStrength;out vec3 vN;out vec3 vLocal;out vec2 vEyeCoord;out vec3 vCurves;out float vNearEye;out float vBoundary;out float vBlink;out float vUpperField;out float vDomain;float smooth01(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}float smoother(float x){x=clamp(x,0.,1.);return x*x*x*(x*(x*6.-15.)+10.);}void main(){float edge=aParam.z,domain=aParam.w;if(domain<.34){gl_Position=vec4(2.,2.,2.,1.);vN=vec3(1.,0.,0.);vLocal=aRawPos;vEyeCoord=vec2(9.);vCurves=vec3(0.);vNearEye=0.;vBoundary=1.;vBlink=uBlink;vUpperField=0.;vDomain=0.;return;}float boundary=1.-smoother(edge/.135),field=(1.-boundary)*uPatchStrength;vec3 p=mix(aRawPos,aSmoothPos,uSmoothStrength*(1.-boundary)),n=normalize(mix(aRawNor,aSmoothNor,uSmoothStrength*(1.-boundary)));float useL=step(abs(p.y-uEyeL.y),abs(p.y-uEyeR.y));vec3 ec=mix(uEyeR,uEyeL,useL),er=mix(uEyeRadR,uEyeRadL,useL);float hy=(p.y-ec.y)/max(er.y,.0001),vz=(p.z-ec.z)/max(er.z,.0001),side=sign(ec.y),lateral=hy*side,medial=smooth01((-lateral-.16)/.82),absH=abs(hy),q=sqrt(max(.0008,1.-min(.999,hy*hy))),arc=pow(max(0.,1.-pow(absH/.58,2.)),mix(.44,.64,medial)),corner=-.020+.082*lateral+.014*(1.-q),upperOpen=corner+(.39-.025*lateral)*arc,lowerOpen=corner-(.235+.015*lateral)*arc,arch=(.060+.070*uArcStrength+.018*medial)*arc,seam=corner+arch+.010*lateral*arc,blink=smooth01(uBlink),upperClose=smoother(blink),lowerClose=pow(blink,1.48),upper=mix(upperOpen,seam,upperClose),lower=mix(lowerOpen,seam,lowerClose);float eyeR=sqrt(pow(hy/.92,2.)+pow((vz-.02)/1.22,2.)),nearEye=(1.-smoothstep(.70,1.42,eyeR))*(1.-smoothstep(1.02,1.28,abs(hy))),shy=hy/1.28,shz=(vz-.02)/1.44,shellR2=shy*shy+shz*shz,insideShell=1.-smoothstep(.88,1.18,shellR2),orbitalX=ec.x+er.x*(1.075-.205*min(shellR2,1.25))+uThicknessM*.36,shellBlend=nearEye*insideShell*field*.96;vec3 shellN=normalize(vec3(1.,.33*hy,.25*(vz-.02)));p.x=mix(p.x,max(p.x,orbitalX),shellBlend);n=normalize(mix(n,shellN,shellBlend*.88));float brow=exp(-pow(hy/1.18,2.)-pow((vz-1.36)/.62,2.))*nearEye,cheek=exp(-pow((abs(hy)-.90)/.70,2.)-pow((vz+1.12)/.70,2.))*nearEye,nose=exp(-pow(p.y/.0125,2.)-pow((p.z-(.5*(uEyeL.z+uEyeR.z)+.008))/.027,2.));p.x+=field*(uBrowStrength*brow*.00125+uCheekStrength*cheek*.00092+uNoseStrength*nose*.00108);float edgeDist=min(abs(vz-upper),abs(vz-lower)),lidBand=(1.-smoothstep(.055,.26,edgeDist))*nearEye,upperField=smoothstep(lower-.002,upper+.002,vz);p.x+=field*lidBand*(.00018+.00026*mix(.35,1.,upperField));float closed=smoothstep(.70,.985,blink),seamBand=(1.-smoothstep(.025,.145,abs(vz-seam)))*nearEye*closed;p.x+=field*seamBand*uCreaseStrength*.00028;n=normalize(mix(n,vec3(.96,-hy*.05,.18),field*seamBand*.18));vec4 wp=uHead*vec4(p,1.);gl_Position=uPV*wp;vN=normalize(mat3(uHead)*n);vLocal=p;vEyeCoord=vec2(hy,vz);vCurves=vec3(lower,upper,seam);vNearEye=nearEye;vBoundary=boundary;vBlink=blink;vUpperField=upperField;vDomain=domain;}`;
const periFS=`#version 300 es
precision highp float;in vec3 vN;in vec3 vLocal;in vec2 vEyeCoord;in vec3 vCurves;in float vNearEye;in float vBoundary;in float vBlink;in float vUpperField;in float vDomain;uniform float uPatchStrength;uniform float uSmoothStrength;uniform float uBrowStrength;uniform float uNoseStrength;uniform float uCheekStrength;uniform float uArcStrength;uniform float uCreaseStrength;uniform float uDebug;out vec4 outColor;void main(){if(vDomain<.34)discard;float hx=vEyeCoord.x,vz=vEyeCoord.y,lower=vCurves.x,upper=vCurves.y,seam=vCurves.z;bool inAperture=abs(hx)<.62&&vz>lower+.010&&vz<upper-.010&&vNearEye>.10;if(inAperture)discard;vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19,edgeDist=min(abs(vz-lower),abs(vz-upper)),rim=(1.-smoothstep(.014,.060,edgeDist))*vNearEye,closed=smoothstep(.72,.985,vBlink),seamBand=(1.-smoothstep(.012,.070,abs(vz-seam)))*vNearEye*closed;vec3 base=vec3(.69,.655,.59);base*=1.-.10*rim;base*=1.-.38*seamBand*uCreaseStrength;float wet=(1.-smoothstep(.006,.032,edgeDist))*vNearEye*(1.-closed);vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);col+=wet*vec3(.12,.10,.07);if(uDebug>.5){float feature=max(max(uBrowStrength*(1.-vUpperField),uCheekStrength*vUpperField),uNoseStrength*(1.-abs(vLocal.y)/.05));vec3 uv=vec3(.10+.75*clamp((vLocal.y+.05)/.10,0.,1.),.12+.72*clamp((vLocal.z-.17)/.08,0.,1.),.86);col=mix(uv,vec3(.1,.95,.35),vBoundary);col=mix(col,vec3(1.,.24,.08),rim*.65);col=mix(col,vec3(1.,.86,.10),feature*.15);}outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`;
'''
    s = reponce(s, shader_pattern, shader_replacement, "wide face shaders", re.S)

    # Replace the annular geometry builder with a broad bilateral facial carrier.
    geometry_pattern = r"function buildSmoothPeriorbital\(mesh,eyeSpecs\)\{[\s\S]*?const periMesh=buildSmoothPeriorbital\(m,lidMesh\.eyeSpecs\);"
    geometry_replacement = r'''function buildWideEyeRegionCarrier(mesh,eyeSpecs){
function max0(x){return x>0?x:0}
const headVerts=[];for(let i=0;i<mesh.vc;i++){if(mesh.part[i]>.5)continue;const x=mesh.pos[i*3],y=mesh.pos[i*3+1],z=mesh.pos[i*3+2];if(x>.145&&z>.155&&z<.265&&Math.abs(y)<.075)headVerts.push({p:[x,y,z],n:[mesh.nor[i*3],mesh.nor[i*3+1],mesh.nor[i*3+2]]})}
const headTris=[];for(let k=0;k<mesh.idx.length;k+=3){const a=mesh.idx[k],b=mesh.idx[k+1],c=mesh.idx[k+2],ao=a*3,bo=b*3,co=c*3;if(mesh.part[a]>.5||mesh.part[b]>.5||mesh.part[c]>.5)continue;const z=(mesh.pos[ao+2]+mesh.pos[bo+2]+mesh.pos[co+2])/3,y=(mesh.pos[ao+1]+mesh.pos[bo+1]+mesh.pos[co+1])/3,x=(mesh.pos[ao]+mesh.pos[bo]+mesh.pos[co])/3;if(x>.14&&z>.15&&z<.27&&Math.abs(y)<.08)headTris.push(a,b,c)}
function rawFace(y,z){let bestX=-1e9,bestP=null,bestN=null;for(let k=0;k<headTris.length;k+=3){const ia=headTris[k],ib=headTris[k+1],ic=headTris[k+2],ao=ia*3,bo=ib*3,co=ic*3,ay=mesh.pos[ao+1],az=mesh.pos[ao+2],by=mesh.pos[bo+1],bz=mesh.pos[bo+2],cy=mesh.pos[co+1],cz=mesh.pos[co+2],den=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(den)<1e-12)continue;const wa=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/den,wb=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/den,wc=1-wa-wb;if(wa<-.001||wb<-.001||wc<-.001)continue;const x=wa*mesh.pos[ao]+wb*mesh.pos[bo]+wc*mesh.pos[co];if(x<=bestX)continue;let nx=wa*mesh.nor[ao]+wb*mesh.nor[bo]+wc*mesh.nor[co],ny=wa*mesh.nor[ao+1]+wb*mesh.nor[bo+1]+wc*mesh.nor[co+1],nz=wa*mesh.nor[ao+2]+wb*mesh.nor[bo+2]+wc*mesh.nor[co+2],nl=Math.hypot(nx,ny,nz)||1;bestX=x;bestP=[x,y,z];bestN=[nx/nl,ny/nl,nz/nl]}if(bestP)return{p:bestP,n:bestN,valid:1};const near=[];for(const v of headVerts){const dy=v.p[1]-y,dz=v.p[2]-z,d=dy*dy+dz*dz;let q=near.length;while(q>0&&near[q-1].d>d)q--;near.splice(q,0,{d,v});if(near.length>16)near.pop()}if(near.length){let sw=0,sx=0,nx=0,ny=0,nz=0;for(const q of near){const w=1/Math.pow(q.d+2e-6,1.18);sw+=w;sx+=q.v.p[0]*w;nx+=q.v.n[0]*w;ny+=q.v.n[1]*w;nz+=q.v.n[2]*w}const nl=Math.hypot(nx,ny,nz)||1;return{p:[sx/sw,y,z],n:[nx/nl,ny/nl,nz/nl],valid:0}}return{p:[.19,y,z],n:[1,0,0],valid:0}}
const sorted=eyeSpecs.slice().sort((a,b)=>b.center[1]-a.center[1]),eyeL=sorted[0],eyeR=sorted[1],rY=Math.max(eyeL.radius[1],eyeR.radius[1]),rZ=Math.max(eyeL.radius[2],eyeR.radius[2]),cz=.5*(eyeL.center[2]+eyeR.center[2]),yHalf=Math.max(Math.abs(eyeL.center[1]),Math.abs(eyeR.center[1]))+rY*3.65,zMin=cz-rZ*3.45,zMax=cz+rZ*3.85,cols=96,rows=68,count=(cols+1)*(rows+1),raw=Array(count),smooth=Array(count);function at(i,j){return j*(cols+1)+i}for(let j=0;j<=rows;j++){const v=j/rows,z=zMin+(zMax-zMin)*v;for(let i=0;i<=cols;i++){const u=i/cols,y=-yHalf+2*yHalf*u,r=rawFace(y,z);raw[at(i,j)]={p:r.p.slice(),n:r.n.slice(),valid:r.valid};smooth[at(i,j)]={p:r.p.slice(),n:r.n.slice()}}}
for(let it=0;it<14;it++){const next=smooth.map(v=>({p:v.p.slice(),n:v.n.slice()}));for(let j=1;j<rows;j++)for(let i=1;i<cols;i++){const id=at(i,j),cur=smooth[id],neigh=[smooth[at(i-1,j)],smooth[at(i+1,j)],smooth[at(i,j-1)],smooth[at(i,j+1)],smooth[at(i-1,j-1)],smooth[at(i+1,j-1)],smooth[at(i-1,j+1)],smooth[at(i+1,j+1)]],y=cur.p[1],z=cur.p[2],nose=Math.exp(-Math.pow(y/.014,2))*Math.exp(-Math.pow((z-(cz+.004))/.032,2)),edge=Math.min(i/cols,1-i/cols,j/rows,1-j/rows),edgeLock=1-Math.min(1,edge/.13);let sx=0,sw=0,nx=0,ny=0,nz=0;for(const q of neigh){const dx=q.p[0]-cur.p[0],w=Math.exp(-Math.pow(dx/.0032,2));sx+=q.p[0]*w;sw+=w;nx+=q.n[0]*w;ny+=q.n[1]*w;nz+=q.n[2]*w}const avg=sx/Math.max(sw,1e-8),alpha=.42*(1-.70*nose)*(1-edgeLock),target=cur.p[0]*(1-alpha)+avg*alpha,base=raw[id].p[0];next[id].p[0]=Math.max(base-.0032,Math.min(base+.0032,target));const nl=Math.hypot(nx,ny,nz)||1;next[id].n=[nx/nl,ny/nl,nz/nl]}for(let i=0;i<=cols;i++){next[at(i,0)]={p:raw[at(i,0)].p.slice(),n:raw[at(i,0)].n.slice()};next[at(i,rows)]={p:raw[at(i,rows)].p.slice(),n:raw[at(i,rows)].n.slice()}}for(let j=0;j<=rows;j++){next[at(0,j)]={p:raw[at(0,j)].p.slice(),n:raw[at(0,j)].n.slice()};next[at(cols,j)]={p:raw[at(cols,j)].p.slice(),n:raw[at(cols,j)].n.slice()}}for(let k=0;k<count;k++)smooth[k]=next[k]}
for(let j=1;j<rows;j++)for(let i=1;i<cols;i++){const a=smooth[at(i-1,j)].p,b=smooth[at(i+1,j)].p,c=smooth[at(i,j-1)].p,d=smooth[at(i,j+1)].p,uy=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],uz=[d[0]-c[0],d[1]-c[1],d[2]-c[2]],n=[uy[1]*uz[2]-uy[2]*uz[1],uy[2]*uz[0]-uy[0]*uz[2],uy[0]*uz[1]-uy[1]*uz[0]];if(n[0]<0){n[0]*=-1;n[1]*=-1;n[2]*=-1}const nl=Math.hypot(...n)||1;smooth[at(i,j)].n=[n[0]/nl,n[1]/nl,n[2]/nl]}
const param=[],rawPos=[],rawNor=[],smoothPos=[],smoothNor=[],idx=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,v=j/rows,id=at(i,j),xn=(u-.5)/.5,zn=(v-.50)/.50,lower=max0(-zn),upperZ=max0(zn),width=.92-.23*lower*lower-.10*upperZ*upperZ,metric=Math.pow(Math.abs(xn)/Math.max(.35,width),3.2)+Math.pow(Math.abs(zn),3.0),domain=1-Math.min(1,Math.max(0,(metric-.82)/.18)),edge=.16*Math.max(0,1-metric);param.push(u,v,edge,domain);rawPos.push(...raw[id].p);rawNor.push(...raw[id].n);smoothPos.push(...smooth[id].p);smoothNor.push(...smooth[id].n)}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);idx.push(a,b,c,b,d,c)}return{param:new Float32Array(param),rawPos:new Float32Array(rawPos),rawNor:new Float32Array(rawNor),smoothPos:new Float32Array(smoothPos),smoothNor:new Float32Array(smoothNor),idx:new Uint16Array(idx),vertices:count,triangles:idx.length/3,pieces:1,cols,rows,eyeL,eyeR,fitMode:'wide_bilateral_face_field_bilateral_smooth_exact_frozen_boundary'}}
const periMesh=buildWideEyeRegionCarrier(m,lidMesh.eyeSpecs);'''
    s = reponce(s, geometry_pattern, geometry_replacement, "wide face geometry", re.S)

    # Replace the V4.45 periorbital VAO and uniforms.
    vao_pattern = r"const periVao=gl\.createVertexArray\(\);gl\.bindVertexArray\(periVao\);const periParamBuf=.*?const PeriU=\{.*?\};"
    vao_replacement = (
        "const periVao=gl.createVertexArray();gl.bindVertexArray(periVao);"
        "const periParamBuf=attr(0,periMesh.param,4,gl.FLOAT),periRawPosBuf=attr(1,periMesh.rawPos,3,gl.FLOAT),"
        "periRawNorBuf=attr(2,periMesh.rawNor,3,gl.FLOAT),periSmoothPosBuf=attr(3,periMesh.smoothPos,3,gl.FLOAT),"
        "periSmoothNorBuf=attr(4,periMesh.smoothNor,3,gl.FLOAT),periIb=gl.createBuffer();"
        "gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,periIb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,periMesh.idx,gl.STATIC_DRAW);"
        "gl.bindVertexArray(null);const PeriU={pv:gl.getUniformLocation(periPr,'uPV'),head:gl.getUniformLocation(periPr,'uHead'),"
        "eyeL:gl.getUniformLocation(periPr,'uEyeL'),eyeR:gl.getUniformLocation(periPr,'uEyeR'),"
        "eyeRadL:gl.getUniformLocation(periPr,'uEyeRadL'),eyeRadR:gl.getUniformLocation(periPr,'uEyeRadR'),"
        "blink:gl.getUniformLocation(periPr,'uBlink'),thickness:gl.getUniformLocation(periPr,'uThicknessM'),"
        "patch:gl.getUniformLocation(periPr,'uPatchStrength'),smooth:gl.getUniformLocation(periPr,'uSmoothStrength'),"
        "brow:gl.getUniformLocation(periPr,'uBrowStrength'),nose:gl.getUniformLocation(periPr,'uNoseStrength'),"
        "cheek:gl.getUniformLocation(periPr,'uCheekStrength'),arc:gl.getUniformLocation(periPr,'uArcStrength'),"
        "crease:gl.getUniformLocation(periPr,'uCreaseStrength'),debug:gl.getUniformLocation(periPr,'uDebug')};"
    )
    s = reponce(s, vao_pattern, vao_replacement, "wide face VAO", re.S)

    # Replace draw pass.
    draw_pattern = r"if\(blinkLayerEnabled\)\{gl\.useProgram\(periPr\);gl\.bindVertexArray\(periVao\);.*?gl\.bindVertexArray\(null\)\}drawLines"
    draw_replacement = (
        "if(blinkLayerEnabled){gl.useProgram(periPr);gl.bindVertexArray(periVao);"
        "gl.uniformMatrix4fv(PeriU.pv,false,pv);"
        "gl.uniformMatrix4fv(PeriU.head,false,mats.skin.subarray(headBoneIndex*16,headBoneIndex*16+16));"
        "gl.uniform3f(PeriU.eyeL,...periMesh.eyeL.center);gl.uniform3f(PeriU.eyeR,...periMesh.eyeR.center);"
        "gl.uniform3f(PeriU.eyeRadL,...periMesh.eyeL.radius);gl.uniform3f(PeriU.eyeRadR,...periMesh.eyeR.radius);"
        "gl.uniform1f(PeriU.blink,expressionState.blink);gl.uniform1f(PeriU.thickness,lidThickness);"
        "gl.uniform1f(PeriU.patch,patchStrength);gl.uniform1f(PeriU.smooth,smoothStrength);"
        "gl.uniform1f(PeriU.brow,browStrength);gl.uniform1f(PeriU.nose,noseStrength);gl.uniform1f(PeriU.cheek,cheekStrength);"
        "gl.uniform1f(PeriU.arc,arcStrength);gl.uniform1f(PeriU.crease,creaseStrength);"
        "gl.uniform1f(PeriU.debug,lidDebugEnabled?1:0);gl.disable(gl.CULL_FACE);"
        "gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1.,-1.);"
        "gl.drawElements(gl.TRIANGLES,periMesh.idx.length,gl.UNSIGNED_SHORT,0);"
        "gl.disable(gl.POLYGON_OFFSET_FILL);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null)}drawLines"
    )
    s = reponce(s, draw_pattern, draw_replacement, "wide face draw", re.S)

    # Runtime KPI, metrics and controls.
    s = rep(
        s,
        "$('#kPatch').textContent=patchStrength.toFixed(2)+' / '+smoothStrength.toFixed(2)+' / '+arcStrength.toFixed(2)+' / '+creaseStrength.toFixed(2);",
        "$('#kPatch').textContent=patchStrength.toFixed(2)+' / '+smoothStrength.toFixed(2)+' / '+browStrength.toFixed(2)+' / '+noseStrength.toFixed(2)+' / '+cheekStrength.toFixed(2);",
        "KPI runtime",
    )
    s = rep(
        s,
        "patchStrength,smoothStrength,arcStrength,creaseStrength,corneaLayerEnabled",
        "patchStrength,smoothStrength,browStrength,noseStrength,cheekStrength,arcStrength,creaseStrength,corneaLayerEnabled",
        "metrics state",
    )
    s = rep(
        s,
        "vertices:periMesh.vertices,triangles:periMesh.triangles,pieces:periMesh.pieces,segments:periMesh.segments,rings:periMesh.rings,fitMode:periMesh.fitMode,headBoneIndex",
        "vertices:periMesh.vertices,triangles:periMesh.triangles,pieces:periMesh.pieces,cols:periMesh.cols,rows:periMesh.rows,fitMode:periMesh.fitMode,headBoneIndex",
        "geometry metrics",
    )
    s = rep(
        s,
        "layerSlider('#patchStrength',v=>patchStrength=v);layerSlider('#smoothStrength',v=>smoothStrength=v);layerSlider('#arcStrength',v=>arcStrength=v);layerSlider('#creaseStrength',v=>creaseStrength=v);",
        "layerSlider('#patchStrength',v=>patchStrength=v);layerSlider('#smoothStrength',v=>smoothStrength=v);layerSlider('#browStrength',v=>browStrength=v);layerSlider('#noseStrength',v=>noseStrength=v);layerSlider('#cheekStrength',v=>cheekStrength=v);layerSlider('#arcStrength',v=>arcStrength=v);layerSlider('#creaseStrength',v=>creaseStrength=v);",
        "control wiring",
    )

    # Public APIs and stats.
    s = rep(
        s,
        "if(cfg.smoothStrength!==undefined)smoothStrength=Math.max(0,Math.min(1,+cfg.smoothStrength));if(cfg.arcStrength!==undefined)",
        "if(cfg.smoothStrength!==undefined)smoothStrength=Math.max(0,Math.min(1,+cfg.smoothStrength));if(cfg.browStrength!==undefined)browStrength=Math.max(0,Math.min(1,+cfg.browStrength));if(cfg.noseStrength!==undefined)noseStrength=Math.max(0,Math.min(1,+cfg.noseStrength));if(cfg.cheekStrength!==undefined)cheekStrength=Math.max(0,Math.min(1,+cfg.cheekStrength));if(cfg.arcStrength!==undefined)",
        "public setters",
    )
    s = rep(
        s,
        "manualBlink,lidThickness,lidDebugEnabled,patchStrength,smoothStrength,arcStrength,creaseStrength,corneaResponse",
        "manualBlink,lidThickness,lidDebugEnabled,patchStrength,smoothStrength,browStrength,noseStrength,cheekStrength,arcStrength,creaseStrength,corneaResponse",
        "public return",
    )
    s = reponce(
        s,
        r"window\.__CAT_V445_STATS__=\{.*?\};window\.__CAT_V445_SET_EXPRESSION__=",
        "window.__CAT_V445_STATS__={vertices:m.vc,triangles:m.ic/3,bones:boneCount,maxInfluences:4,neutralSurface:'V4.32-frozen',weightBaseline:'V4.34-frozen',cameraHotfix:true,padContactPlane:true,gaitPhaseRefine:true,turnMotion:true,innerOuterStride:true,scapulaTranslation:true,sitTransition:true,lieTransition:true,poseCorrectiveLayer:true,regionalRefinement:true,poseTargetNormals:true,earBones:true,proceduralEye:true,proceduralEyelid:false,geometricEyelidVolume:false,wideEyeRegionCarrier:true,bilateralFaceField:true,browNasalCheekContinuity:true,singlePrimaryClosureSeam:true,frozenBoundaryReturn:true,eyeRegionPieces:periMesh.pieces,eyeRegionVertices:periMesh.vertices,eyeRegionTriangles:periMesh.triangles,eyeRegionCols:periMesh.cols,eyeRegionRows:periMesh.rows,legacyV445PeriorbitalAvailable:true,deterministicBlink:true,cornealResponse:true,pupilAdaptation:true,shortFurDirectionField:true,correctiveRepresentation:'two-int16-position-residuals-plus-two-snorm16-pose-normal-fields',correctiveScaleM:1e-5,correctiveActions:['sit_cycle','sit_hold','lie_cycle','lie_hold'],neutralInvariant:true,locomotionInvariant:true,rootMotion:true,desiredFinalPose:true,externalModel:false,externalTexture:false,externalAnimation:false};window.__CAT_V445_SET_EXPRESSION__=",
        "stats object",
        re.S,
    )
    s = reponce(
        s,
        r"window\.__CAT_V445_PERIORBITAL_GEOMETRY__=\{.*?\};window\.__CAT_V445_EYELID_GEOMETRY__=",
        "window.__CAT_V445_EYE_REGION_GEOMETRY__={pieces:periMesh.pieces,vertices:periMesh.vertices,triangles:periMesh.triangles,cols:periMesh.cols,rows:periMesh.rows,fitMode:periMesh.fitMode,headBoneIndex,source:'single-bilateral-wide-eye-region-face-field'};window.__CAT_V445_EYELID_GEOMETRY__=",
        "geometry API",
        re.S,
    )

    s = s.replace("window.__CAT_V445_RENDER_STATE__='mls-smoothed-c1-periorbital-soft-tissue'", "window.__CAT_V445_RENDER_STATE__='wide-bilateral-eye-region-face-carrier'")
    s = s.replace('"version":"V4.45"', '"version":"V4.46"')
    s = s.replace("__CAT_V445_", "__CAT_V446_")
    s = s.replace("CAT KAOPU V4.45", "CAT KAOPU V4.46")
    s = s.replace("window.__CAT_V446_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',payload:'CATV440'}", "window.__CAT_V446_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',wideFaceSource:'V4.45',payload:'CATV440'}")
    s = s.replace("window.__CAT_V446_RENDER_STATE__='wide-bilateral-eye-region-face-carrier'", "window.__CAT_V446_RENDER_STATE__='wide-bilateral-eye-region-face-carrier-v1'")
    return s


def write_docs(payload_hash: str, html_hash: str, source_hash: str) -> None:
    README.write_text(
        "# Cat Kaopu module — V4.46 wide eye-region face carrier candidate\n\n"
        "Current entry: `workbench/CAT_KAOPU_CURRENT.html`\n\n"
        "Runtime payload: `runtime/cat_v440.bin` (unchanged)\n\n"
        "V4.46 replaces the narrow per-eye ring presentation with one bilateral facial carrier covering the brow, nasal root, both eyes and upper cheeks. Two dynamic apertures are cut from the same surface, so the eyelids, canthi, nasal bridge and cheek support share one continuous deformation field. The carrier is generated outside CATV440, follows the existing head bone and returns exactly to the frozen V4.32 boundary.\n\n"
        "`visualAcceptance=false` and `productionReady=false` remain until close-up review.\n",
        encoding="utf-8",
    )
    EXEC_DOC.parent.mkdir(parents=True, exist_ok=True)
    EXEC_DOC.write_text(
        "# CAT KAOPU V4.46 执行记录\n\n"
        "本轮直接越过继续增加眶周环带的低效路线，建立一个覆盖眉弓、鼻根、双眼和上面颊的双眼统一区域面部载体。载体为单张高分辨率网格，在同一曲面中切出两条动态睑裂，并统一生成眼睑体积、眼角、闭合缝、眉弓、鼻根和面颊支撑。\n\n"
        f"- 源 HTML SHA-256：`{source_hash}`\n"
        f"- 输出 HTML SHA-256：`{html_hash}`\n"
        f"- CATV440 SHA-256：`{payload_hash}`\n"
        "- 中性表面、RIG、蒙皮、姿势修形与运动链均未修改。\n"
        "- 当前仍为视觉候选。\n",
        encoding="utf-8",
    )
    SELF_DOC.write_text(
        "# CAT KAOPU V4.46 自检\n\n"
        "检查重点：双眼是否确实属于同一面部载体；鼻根是否连续；开眼时是否仍有环形补片边界；半闭和全闭是否只形成一条主要闭合缝；正面、三分之四和侧面是否保持头部外轮廓。\n\n"
        "本轮禁止进入第三眼睑、胡须、轮廓毛发或重新修改 V4.32 整猫表面。\n",
        encoding="utf-8",
    )


def write_current(payload_hash: str, html_hash: str) -> None:
    current = {
        "schema": "cat_kaopu/full_handoff_current@1.0",
        "date": "2026-09-16",
        "currentVersion": "V4.46",
        "currentEntry": "workbench/CAT_KAOPU_CURRENT.html",
        "runtimePayload": "runtime/cat_v440.bin",
        "currentLayer": "single bilateral wide eye-region facial carrier with two dynamic palpebral apertures",
        "frozenBaselines": {
            "neutralSurface": "V4.32",
            "baseSkinWeights": "V4.34 except bounded ear region introduced in V4.40",
            "camera": "V4.34.1",
            "locomotionRegression": "V4.36",
            "postureCorrective": "V4.39",
            "payload": "V4.40 CATV440 and 34-bone RIG unchanged",
        },
        "geometry": {
            "bodyVertices": 3948,
            "bodyTriangles": 7884,
            "bones": 34,
            "wideEyeRegionVertices": 6693,
            "wideEyeRegionTriangles": 13056,
            "wideEyeRegionPieces": 1,
            "wideEyeRegionCols": 96,
            "wideEyeRegionRows": 68,
            "storage": "runtime-generated outside CATV440",
        },
        "acceptance": {
            "visualAcceptance": False,
            "productionReady": False,
            "userReviewRequired": True,
        },
        "technicalInvariants": {
            "embeddedPayloadSha256": payload_hash,
            "payloadUnchangedFromV440": True,
            "rigJsonIdenticalToV445": True,
            "neutralSurfaceChanged": False,
            "skinWeightsChanged": False,
            "outputHtmlSha256": html_hash,
        },
        "github": {
            "repository": "haihao0307/Humanoid-Rig-Lab-Next",
            "branch": "codex/cat-kaopu-v446-wide-eye-region-carrier-20260916",
            "modulePath": "cat-kaopu/",
        },
        "nextProductionGate": [
            "front/three-quarter/side ultra-close open, half and closed review",
            "carrier off/on comparison against V4.45",
            "confirm one primary closure seam and no ring-shaped patch boundary",
            "confirm brow, nasal root, canthi and upper cheek remain continuous",
            "do not begin third eyelid or silhouette fur before this gate",
        ],
    }
    CURRENT_JSON.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_manifest() -> None:
    files = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path == MANIFEST or ".git" in path.parts:
            continue
        data = path.read_bytes()
        files.append({"path": str(path.relative_to(ROOT)), "bytes": len(data), "sha256": sha(data)})
    manifest = {
        "schema": "cat_kaopu/module_build_manifest@1.4",
        "version": "V4.46",
        "buildId": "cat-kaopu-v446-wide-eye-region-carrier-20260916",
        "currentEntry": "workbench/CAT_KAOPU_CURRENT.html",
        "runtimePayload": "runtime/cat_v440.bin",
        "visualAcceptance": False,
        "productionReady": False,
        "manifestSelfExcluded": True,
        "files": files,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    source_path = BASELINE if BASELINE.exists() else FALLBACK_BASELINE
    if not source_path.exists():
        raise SystemExit(f"V4.45 baseline missing: {BASELINE} and {FALLBACK_BASELINE}")
    source = source_path.read_text(encoding="utf-8")
    output = build_html(source)
    source_payload = extract_payload(source)
    output_payload = extract_payload(output)
    source_rig = extract_rig(source)
    output_rig = extract_rig(output)
    if source_payload != output_payload:
        raise SystemExit("V4.46 changed CATV440 payload")
    if source_rig != output_rig:
        raise SystemExit("V4.46 changed RIG JSON")
    if len(output_rig.get("bones", [])) != 34:
        raise SystemExit("V4.46 bone count changed")
    required = {
        "readyApi": "__CAT_V446_READY__" in output,
        "wideCarrierBuilder": "function buildWideEyeRegionCarrier" in output,
        "wideCarrierGeometryApi": "__CAT_V446_EYE_REGION_GEOMETRY__" in output,
        "singleCarrier": "pieces:1" in output,
        "browControl": 'id="browStrength"' in output,
        "noseControl": 'id="noseStrength"' in output,
        "cheekControl": 'id="cheekStrength"' in output,
        "dynamicDualAperture": "bool inAperture" in output,
        "opaqueDraw": "gl.enable(gl.POLYGON_OFFSET_FILL)" in output,
        "legacyV445ApiRemoved": "__CAT_V445_READY__" not in output,
    }
    if not all(required.values()):
        raise SystemExit(f"V4.46 required marker failure: {required}")

    CURRENT.parent.mkdir(parents=True, exist_ok=True)
    BUILD.parent.mkdir(parents=True, exist_ok=True)
    CURRENT.write_text(output, encoding="utf-8")
    BUILD.write_text(output, encoding="utf-8")
    payload_hash = sha(output_payload)
    html_hash = sha(output.encode("utf-8"))
    source_hash = sha(source.encode("utf-8"))
    checks = {
        "schema": "cat_kaopu/v446_technical_qa@1.0",
        "version": "V4.46",
        "sourceBaseline": str(source_path.relative_to(ROOT)),
        "outputWorkbench": str(CURRENT.relative_to(ROOT)),
        "sourceHtmlSha256": source_hash,
        "outputHtmlSha256": html_hash,
        "sourcePayloadSha256": sha(source_payload),
        "outputPayloadSha256": payload_hash,
        "payloadByteIdentical": source_payload == output_payload,
        "rigJsonIdentical": source_rig == output_rig,
        "boneCount": len(output_rig.get("bones", [])),
        "neutralBodySurfaceChanged": False,
        "skinWeightsChanged": False,
        "addedGeometry": {
            "type": "single bilateral wide eye-region facial carrier",
            "pieces": 1,
            "cols": 96,
            "rows": 68,
            "vertices": 6693,
            "triangles": 13056,
            "headBoneDriven": True,
            "frozenBoundaryReturn": True,
            "writesBackToPayload": False,
        },
        "requiredMarkers": required,
        "runtimeDependencies": {"externalModel": False, "externalTexture": False, "externalAnimation": False},
        "visualAcceptance": False,
        "productionReady": False,
    }
    TECH_QA.parent.mkdir(parents=True, exist_ok=True)
    TECH_QA.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_docs(payload_hash, html_hash, source_hash)
    write_current(payload_hash, html_hash)
    write_manifest()
    print(json.dumps({"version": "V4.46", "htmlSha256": html_hash, "payloadSha256": payload_hash, "required": required}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
