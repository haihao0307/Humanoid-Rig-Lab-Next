from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / 'baselines/v4.44/CAT_KAOPU_V444_CONTINUOUS_PERIORBITAL_WORKBENCH_2026-09-16.html'
CURRENT = ROOT / 'workbench/CAT_KAOPU_CURRENT.html'
BUILD = ROOT / 'build/v4.45/CAT_KAOPU_V445_MLS_PERIORBITAL_WORKBENCH_2026-09-16.html'
TECH_QA = ROOT / 'qa/CAT_KAOPU_V445_TECHNICAL_QA_2026-09-16.json'
EXEC_DOC = ROOT / 'docs/CAT_KAOPU_V445_EXECUTION_REPORT_2026-09-16.md'
SELF_DOC = ROOT / 'docs/CAT_KAOPU_V445_SELF_REVIEW_2026-09-16.md'

def rep(text, old, new, label):
    c=text.count(old)
    if c!=1: raise RuntimeError(f'{label}: {c}')
    return text.replace(old,new,1)

def reponce(text, pat, repl, label, flags=0):
    out,c=re.subn(pat,repl,text,count=1,flags=flags)
    if c!=1: raise RuntimeError(f'{label}: {c}')
    return out

s=BASELINE.read_text(encoding='utf-8')
# UI/version
s=rep(s,'<title>CAT KAOPU V4.44 · 双眼连续眶周载体第一阶段</title>','<title>CAT KAOPU V4.45 · MLS 平滑眶周软组织与猫眼弧线</title>','title')
s=rep(s,'alt="V4.44 双眼连续眶周载体第一阶段静态回退"','alt="V4.45 MLS 平滑眶周软组织与猫眼弧线静态回退"','alt')
s=rep(s,'<aside><h1>CAT KAOPU V4.44</h1><div class="sub">V4.32 冻结整猫表面 → V4.42 四片眼睑 → V4.43 过渡壳实验 → V4.44 双眼连续眶周载体</div>',
      '<aside><h1>CAT KAOPU V4.45</h1><div class="sub">V4.32 冻结整猫表面 → V4.44 连续拓扑 → V4.45 MLS 局部平滑、C1 边界与上睑主导弧线</div>','header')
s=rep(s,'<span class="tag good">连续眶周载体</span><span class="tag good">双眼各一片</span><span class="tag good">连续内外眼角</span>',
      '<span class="tag good">MLS 平滑眶周</span><span class="tag good">双眼各一片</span><span class="tag good">连续内外眼角</span><span class="tag good">C1 边界回接</span><span class="tag good">上睑主导闭合</span>','tags')
old_controls='<label><span>眶周融合</span><input id="patchStrength" max="1" min="0" step="0.05" type="range" value="0.86"/><output>0.86</output></label><label><span>闭眼褶皱</span><input id="creaseStrength" max="1" min="0" step="0.05" type="range" value="0.52"/><output>0.52</output></label>'
new_controls='<label><span>软组织体积</span><input id="patchStrength" max="1" min="0" step="0.05" type="range" value="0.78"/><output>0.78</output></label><label><span>MLS 平滑</span><input id="smoothStrength" max="1" min="0" step="0.05" type="range" value="0.92"/><output>0.92</output></label><label><span>闭合弧度</span><input id="arcStrength" max="1" min="0" step="0.05" type="range" value="0.78"/><output>0.78</output></label><label><span>上睑褶皱</span><input id="creaseStrength" max="1" min="0" step="0.05" type="range" value="0.58"/><output>0.58</output></label>'
s=rep(s,old_controls,new_controls,'controls')
s=rep(s,'耳朵和眼球继续沿用 V4.40。V4.44 不再默认渲染上、下四片独立眼睑条带，而是为左右眼各生成一张连续环形眶周载体；内边界形成可眨动睑裂，外边界采样冻结眉弓、鼻根和面颊，内外眼角天然属于同一拓扑。原猫体、眼球、34 骨与蒙皮权重均不改。',
      '耳朵和眼球继续沿用 V4.40。V4.45 保留每眼一张连续环形拓扑，但不再逐点复制粗三角眼眶：局部头脸样本经过加权二次移动最小二乘拟合，外缘最后一圈再严格回接冻结 V4.32 表面；中间环带使用高阶平滑权重建立连续法线和受限曲率。闭眼改为上睑主导的拱形闭合线。原猫体、眼球、34 骨与蒙皮权重均不改。','note')
# KPI label/value
s=rep(s,'<div class="kpi"><b>融合 / 褶皱</b><span id="kPatch">0.86 / 0.52</span></div>',
      '<div class="kpi"><b>体积 / 平滑 / 弧度 / 褶皱</b><span id="kPatch">0.78 / 0.92 / 0.78 / 0.58</span></div>','kpi')
# scope/test notes
s=rep(s,'本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形及 V4.36 运动接触。新增内容是左右眼各一张连续眶周载体，载体只读取冻结头脸采样和 head 骨矩阵，不写回主体几何。V4.42/V4.43 保留为历史基线但不作为默认渲染层。第三眼睑、泪膜折射、胡须和轮廓毛束仍未开始。',
      '本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形及 V4.36 运动接触。V4.45 在 V4.44 连续双眼拓扑上一次性加入 MLS 局部曲面、C1 边界回接、上睑主导闭合弧、眼角收束和几何褶皱；不再增加独立覆盖壳。第三眼睑、泪膜折射、胡须和轮廓毛束仍不进入本轮。','scope')
s=rep(s,'先在眼部近景检查开眼、半闭和完全闭眼：内外眼角应保持连续，不能再出现上、下眼睑条带的矩形端头；完全闭眼时上眼睑承担主要行程，下眼睑只提供支撑。再调节眶周融合、闭眼褶皱和检查色，确认外边界始终回到冻结头脸且不改变头部轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。',
      '先检查眼部超近景：正面、三分之四和侧面下，开眼时外圈不得出现方形补片，半闭时上睑承担主要行程，完全闭眼时闭合线必须保持拱形且内外眼角连续。再把 MLS 平滑调到 0 与 1，确认变化只发生在局部曲率，不改变头部外轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。','test')
# state vars
s=rep(s,'let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,patchStrength=.86,creaseStrength=.52,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;',
      'let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,patchStrength=.78,smoothStrength=.92,arcStrength=.78,creaseStrength=.58,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;','state')
# shaders replacement
shader_pat=r"const periVS=`#version 300 es[\s\S]*?`;\nconst periFS=`#version 300 es[\s\S]*?`;\n"
shader_new=r'''const periVS=`#version 300 es
precision highp float;layout(location=0)in vec4 aParam;layout(location=1)in vec3 aCenter;layout(location=2)in vec3 aRadius;layout(location=3)in vec3 aSmoothPos;layout(location=4)in vec3 aSmoothNor;layout(location=5)in vec3 aRawPos;layout(location=6)in vec3 aRawNor;uniform mat4 uPV;uniform mat4 uHead;uniform float uBlink;uniform float uThicknessM;uniform float uPatchStrength;uniform float uSmoothStrength;uniform float uArcStrength;uniform float uCreaseStrength;out vec3 vN;out float vBand;out float vUpper;out float vBlink;out float vCanthus;out float vBoundary;float smooth01(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}float smoother(float x){x=clamp(x,0.,1.);return x*x*x*(x*(x*6.-15.)+10.);}void main(){float theta=aParam.x,t=aParam.y,c=cos(theta),s=sin(theta),upper=step(0.,s),absS=abs(s),hx=.54*c,side=sign(aCenter.y),lateral=hx*side,medial=smooth01((-lateral-.16)/.82),arc=pow(absS,mix(.80,1.10,medial)),q=sqrt(max(.0008,1.-hx*hx)),corner=-.020+.082*lateral+.014*(1.-q),upperOpen=corner+(.39-.025*lateral)*arc,lowerOpen=corner-(.235+.015*lateral)*arc,arch=(.060+.065*uArcStrength+.018*medial)*arc,seam=corner+arch+.010*lateral*arc,blink=smooth01(uBlink),upperClose=smoother(blink),lowerClose=pow(blink,1.48),openZ=mix(lowerOpen,upperOpen,upper),closeW=mix(lowerClose,upperClose,upper),innerZ=mix(openZ,seam,closeW),innerEf=sqrt(max(.0008,1.-hx*hx-innerZ*innerZ)),rMean=max(.0001,(aRadius.x+aRadius.y+aRadius.z)/3.),frontScale=1.+uThicknessM/rMean;vec3 innerDir=normalize(vec3(innerEf,hx,innerZ)),innerP=aCenter+aRadius*innerDir*frontScale,innerN=normalize(vec3(innerDir.x/max(aRadius.x,.0001),innerDir.y/max(aRadius.y,.0001),innerDir.z/max(aRadius.z,.0001)));float tt=smoother(t),boundary=smoother((t-.86)/.14),canthus=smoothstep(.018,.22,absS);vec3 smoothP=mix(aRawPos,aSmoothPos,uSmoothStrength),smoothN=normalize(mix(aRawNor,aSmoothNor,uSmoothStrength));vec3 p=mix(innerP,smoothP,tt),n=normalize(mix(innerN,smoothN,tt));p=mix(p,aRawPos,boundary);n=normalize(mix(n,aRawNor,boundary));float innerW=1.-tt,tissueBand=4.*tt*(1.-tt),upperBias=mix(.36,1.,upper),tissueLift=uPatchStrength*canthus*(.00008*innerW+.00042*tissueBand*upperBias);p+=n*tissueLift;float creaseBand=(smoothstep(.16,.30,t)-smoothstep(.42,.62,t))*upper,crease=uCreaseStrength*blink*creaseBand*canthus;p.x+=crease*(.00042+.00018*uArcStrength);p.z+=crease*.00016;float lowerSupport=(1.-upper)*blink*tissueBand*canthus;p.x+=lowerSupport*.00007;vec3 closedN=normalize(vec3(.93,hx*.12,.22+.12*uArcStrength));n=normalize(mix(n,closedN,crease*.24));vec4 wp=uHead*vec4(p,1.);gl_Position=uPV*wp;vN=normalize(mat3(uHead)*n);vBand=tt;vUpper=upper;vBlink=blink;vCanthus=canthus;vBoundary=boundary;}`;
const periFS=`#version 300 es
precision highp float;in vec3 vN;in float vBand;in float vUpper;in float vBlink;in float vCanthus;in float vBoundary;uniform float uPatchStrength;uniform float uSmoothStrength;uniform float uArcStrength;uniform float uCreaseStrength;uniform float uDebug;out vec4 outColor;void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19,closed=smoothstep(.72,.98,vBlink),inner=1.-smoothstep(.02,.24,vBand),seam=(1.-smoothstep(.012,.072,vBand))*closed*vUpper,fold=(smoothstep(.16,.30,vBand)-smoothstep(.42,.62,vBand))*closed*vUpper*uCreaseStrength;vec3 base=vec3(.69,.655,.59);base*=mix(.992,.975,vUpper);base*=1.-.48*seam-.11*fold;base*=1.-.018*uSmoothStrength*(1.-vBoundary);vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);if(uDebug>.5){vec3 ring=mix(vec3(.05,.55,.95),vec3(1.,.34,.06),vUpper);col=mix(ring,vec3(.15,.95,.45),vBoundary)*(.55+.45*max(dot(n,l1),0.));}outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`;
'''
s=reponce(s,shader_pat,shader_new,'shaders',re.S)
# geometry replacement
geom_pat=r"function buildContinuousPeriorbital\(mesh,eyeSpecs\)\{[\s\S]*?\}\nconst periMesh=buildContinuousPeriorbital\(m,lidMesh\.eyeSpecs\);"
geom_new=r'''function buildSmoothPeriorbital(mesh,eyeSpecs){
const bodyVerts=[];for(let i=0;i<mesh.vc;i++){if(mesh.part[i]>.5)continue;bodyVerts.push({p:[mesh.pos[i*3],mesh.pos[i*3+1],mesh.pos[i*3+2]],n:[mesh.nor[i*3],mesh.nor[i*3+1],mesh.nor[i*3+2]]})}
const bodyTris=[];for(let k=0;k<mesh.idx.length;k+=3){const a=mesh.idx[k],b=mesh.idx[k+1],c=mesh.idx[k+2];if(mesh.part[a]<.5&&mesh.part[b]<.5&&mesh.part[c]<.5)bodyTris.push(a,b,c)}
function smooth01(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
function solve(A,b){const n=b.length,M=A.map((r,i)=>r.slice().concat(b[i]));for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-11)return null;[M[c],M[p]]=[M[p],M[c]];const q=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=q;for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c];for(let j=c;j<=n;j++)M[r][j]-=f*M[c][j]}}return M.map(r=>r[n])}
function rawFace(spec,y,z,hx,ez){let bestX=-1e9,bestP=null,bestN=null;const minX=spec.center[0]-spec.radius[0]*2.5,maxX=spec.center[0]+spec.radius[0]*2.6;for(let k=0;k<bodyTris.length;k+=3){const ia=bodyTris[k],ib=bodyTris[k+1],ic=bodyTris[k+2],ao=ia*3,bo=ib*3,co=ic*3,ay=mesh.pos[ao+1],az=mesh.pos[ao+2],by=mesh.pos[bo+1],bz=mesh.pos[bo+2],cy=mesh.pos[co+1],cz=mesh.pos[co+2],den=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(den)<1e-12)continue;const wa=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/den,wb=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/den,wc=1-wa-wb;if(wa<-.001||wb<-.001||wc<-.001)continue;const x=wa*mesh.pos[ao]+wb*mesh.pos[bo]+wc*mesh.pos[co];if(x<minX||x>maxX||x<=bestX)continue;let nx=wa*mesh.nor[ao]+wb*mesh.nor[bo]+wc*mesh.nor[co],ny=wa*mesh.nor[ao+1]+wb*mesh.nor[bo+1]+wc*mesh.nor[co+1],nz=wa*mesh.nor[ao+2]+wb*mesh.nor[bo+2]+wc*mesh.nor[co+2],nl=Math.hypot(nx,ny,nz)||1;bestX=x;bestP=[x,y,z];bestN=[nx/nl,ny/nl,nz/nl]}if(bestP)return{p:bestP,n:bestN};const ef=Math.sqrt(Math.max(.0001,1-hx*hx-ez*ez)),dl=Math.hypot(ef,hx,ez)||1,ux=ef/dl,uy=hx/dl,uz=ez/dl,nx=ux/Math.max(spec.radius[0],.0001),ny=uy/Math.max(spec.radius[1],.0001),nz=uz/Math.max(spec.radius[2],.0001),nl=Math.hypot(nx,ny,nz)||1;return{p:[spec.center[0]+spec.radius[0]*ux*1.018,spec.center[1]+spec.radius[1]*uy*1.018,spec.center[2]+spec.radius[2]*uz*1.018],n:[nx/nl,ny/nl,nz/nl]}}
function mlsFace(spec,y,z,raw){const sy=spec.radius[1]*2.65,sz=spec.radius[2]*2.75,A=Array.from({length:6},()=>Array(6).fill(0)),b=Array(6).fill(0);let sw=0,count=0;for(const v of bodyVerts){if(v.p[0]<spec.center[0]-spec.radius[0]*2.2)continue;const dy=(v.p[1]-y)/sy,dz=(v.p[2]-z)/sz,r2=dy*dy+dz*dz;if(r2>1.35)continue;const w=Math.exp(-3.2*r2)*(0.35+0.65*Math.max(0,v.n[0])),q=[1,dy,dz,dy*dy,dy*dz,dz*dz];for(let i=0;i<6;i++){b[i]+=w*q[i]*v.p[0];for(let j=0;j<6;j++)A[i][j]+=w*q[i]*q[j]}sw+=w;count++}for(let i=0;i<6;i++)A[i][i]+=1e-7;const c=count>=8?solve(A,b):null;if(!c)return raw;const x=c[0],dxdy=c[1]/sy,dxdz=c[2]/sz,nl=Math.hypot(1,dxdy,dxdz)||1;return{p:[x,y,z],n:[1/nl,-dxdy/nl,-dxdz/nl]}}
function lowpass(samples,key,iters=5){let cur=samples.map(v=>({p:v[key].p.slice(),n:v[key].n.slice()}));const n=cur.length-1;for(let it=0;it<iters;it++){const nxt=cur.map(v=>({p:v.p.slice(),n:v.n.slice()}));for(let i=0;i<n;i++){const a=cur[(i-1+n)%n],b=cur[i],c=cur[(i+1)%n];for(let k=0;k<3;k++){nxt[i].p[k]=a.p[k]*.18+b.p[k]*.64+c.p[k]*.18;nxt[i].n[k]=a.n[k]*.18+b.n[k]*.64+c.n[k]*.18}const l=Math.hypot(...nxt[i].n)||1;for(let k=0;k<3;k++)nxt[i].n[k]/=l}nxt[n]={p:nxt[0].p.slice(),n:nxt[0].n.slice()};cur=nxt}return cur}
const param=[],center=[],radius=[],smoothPos=[],smoothNor=[],rawPos=[],rawNor=[],idx=[];let vcount=0;const segments=96,rings=14;function push(theta,t,spec,sm,raw){param.push(theta,t,0,0);center.push(...spec.center);radius.push(...spec.radius);smoothPos.push(...sm.p);smoothNor.push(...sm.n);rawPos.push(...raw.p);rawNor.push(...raw.n);return vcount++}
for(const spec of eyeSpecs){const samples=[];for(let i=0;i<=segments;i++){const theta=2*Math.PI*i/segments,c=Math.cos(theta),ss=Math.sin(theta),absS=Math.abs(ss),hx=1.46*c,lateral=.54*c*Math.sign(spec.center[1]||1),medial=smooth01((-lateral-.16)/.82),arc=Math.pow(absS,.72*(1-medial)+.98*medial),q=Math.sqrt(Math.max(.0001,1-(.54*c)*(.54*c))),corner=-.020+.082*lateral+.014*(1-q),ez=corner+(ss>=0?1.34:-1.03)*arc,y=spec.center[1]+spec.radius[1]*hx,z=spec.center[2]+spec.radius[2]*ez,raw=rawFace(spec,y,z,hx,ez),mls=mlsFace(spec,y,z,raw);samples.push({raw,mls})}const filtered=lowpass(samples,'mls',6),base=vcount;for(let i=0;i<=segments;i++){const theta=2*Math.PI*i/segments;for(let j=0;j<=rings;j++)push(theta,j/rings,spec,filtered[i],samples[i].raw)}for(let i=0;i<segments;i++)for(let j=0;j<rings;j++){const a=base+i*(rings+1)+j,b=a+rings+1;idx.push(a,b,a+1,a+1,b,b+1)}}return{param:new Float32Array(param),center:new Float32Array(center),radius:new Float32Array(radius),smoothPos:new Float32Array(smoothPos),smoothNor:new Float32Array(smoothNor),rawPos:new Float32Array(rawPos),rawNor:new Float32Array(rawNor),idx:new Uint16Array(idx),vertices:vcount,triangles:idx.length/3,pieces:2,segments,rings,fitMode:'quadratic_mls_lowpass_c1_frozen_boundary'}}
const periMesh=buildSmoothPeriorbital(m,lidMesh.eyeSpecs);'''
s=reponce(s,geom_pat,geom_new,'geometry',re.S)
# VAO/uniforms
vao_pat=r"const periVao=gl\.createVertexArray\(\);gl\.bindVertexArray\(periVao\);.*?const PeriU=\{.*?\};"
vao_new="const periVao=gl.createVertexArray();gl.bindVertexArray(periVao);const periParamBuf=attr(0,periMesh.param,4,gl.FLOAT),periCenterBuf=attr(1,periMesh.center,3,gl.FLOAT),periRadiusBuf=attr(2,periMesh.radius,3,gl.FLOAT),periSmoothPosBuf=attr(3,periMesh.smoothPos,3,gl.FLOAT),periSmoothNorBuf=attr(4,periMesh.smoothNor,3,gl.FLOAT),periRawPosBuf=attr(5,periMesh.rawPos,3,gl.FLOAT),periRawNorBuf=attr(6,periMesh.rawNor,3,gl.FLOAT),periIb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,periIb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,periMesh.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);const PeriU={pv:gl.getUniformLocation(periPr,'uPV'),head:gl.getUniformLocation(periPr,'uHead'),blink:gl.getUniformLocation(periPr,'uBlink'),thickness:gl.getUniformLocation(periPr,'uThicknessM'),patch:gl.getUniformLocation(periPr,'uPatchStrength'),smooth:gl.getUniformLocation(periPr,'uSmoothStrength'),arc:gl.getUniformLocation(periPr,'uArcStrength'),crease:gl.getUniformLocation(periPr,'uCreaseStrength'),debug:gl.getUniformLocation(periPr,'uDebug')};"
s=reponce(s,vao_pat,vao_new,'vao',re.S)
# draw pass
old_draw="if(blinkLayerEnabled){gl.useProgram(periPr);gl.bindVertexArray(periVao);gl.uniformMatrix4fv(PeriU.pv,false,pv);gl.uniformMatrix4fv(PeriU.head,false,mats.skin.subarray(headBoneIndex*16,headBoneIndex*16+16));gl.uniform1f(PeriU.blink,expressionState.blink);gl.uniform1f(PeriU.thickness,lidThickness);gl.uniform1f(PeriU.patch,patchStrength);gl.uniform1f(PeriU.crease,creaseStrength);gl.uniform1f(PeriU.debug,lidDebugEnabled?1:0);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawElements(gl.TRIANGLES,periMesh.idx.length,gl.UNSIGNED_SHORT,0);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null)}"
new_draw="if(blinkLayerEnabled){gl.useProgram(periPr);gl.bindVertexArray(periVao);gl.uniformMatrix4fv(PeriU.pv,false,pv);gl.uniformMatrix4fv(PeriU.head,false,mats.skin.subarray(headBoneIndex*16,headBoneIndex*16+16));gl.uniform1f(PeriU.blink,expressionState.blink);gl.uniform1f(PeriU.thickness,lidThickness);gl.uniform1f(PeriU.patch,patchStrength);gl.uniform1f(PeriU.smooth,smoothStrength);gl.uniform1f(PeriU.arc,arcStrength);gl.uniform1f(PeriU.crease,creaseStrength);gl.uniform1f(PeriU.debug,lidDebugEnabled?1:0);gl.disable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1.,-1.);gl.drawElements(gl.TRIANGLES,periMesh.idx.length,gl.UNSIGNED_SHORT,0);gl.disable(gl.POLYGON_OFFSET_FILL);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null)}"
s=rep(s,old_draw,new_draw,'draw')
# KPI runtime and metrics
s=rep(s,"$('#kPatch').textContent=patchStrength.toFixed(2)+' / '+creaseStrength.toFixed(2);","$('#kPatch').textContent=patchStrength.toFixed(2)+' / '+smoothStrength.toFixed(2)+' / '+arcStrength.toFixed(2)+' / '+creaseStrength.toFixed(2);",'kpi runtime')
s=rep(s,'expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,lidDebugEnabled,lidThickness,patchStrength,creaseStrength,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},periorbitalGeometry:{enabled:blinkLayerEnabled,debug:lidDebugEnabled,thicknessM:lidThickness,patchStrength,creaseStrength,vertices:periMesh.vertices,triangles:periMesh.triangles,pieces:periMesh.pieces,headBoneIndex}',
      'expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,lidDebugEnabled,lidThickness,patchStrength,smoothStrength,arcStrength,creaseStrength,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},periorbitalGeometry:{enabled:blinkLayerEnabled,debug:lidDebugEnabled,thicknessM:lidThickness,patchStrength,smoothStrength,arcStrength,creaseStrength,vertices:periMesh.vertices,triangles:periMesh.triangles,pieces:periMesh.pieces,segments:periMesh.segments,rings:periMesh.rings,fitMode:periMesh.fitMode,headBoneIndex}','metrics')
# controls wiring
s=rep(s,"layerSlider('#patchStrength',v=>patchStrength=v);layerSlider('#creaseStrength',v=>creaseStrength=v);",
      "layerSlider('#patchStrength',v=>patchStrength=v);layerSlider('#smoothStrength',v=>smoothStrength=v);layerSlider('#arcStrength',v=>arcStrength=v);layerSlider('#creaseStrength',v=>creaseStrength=v);",'sliders')
# version and API: first replace namespace globally
s=s.replace('__CAT_V444_','__CAT_V445_')
# render state
s=rep(s,"window.__CAT_V445_RENDER_STATE__='continuous-periorbital-aperture-carrier'","window.__CAT_V445_RENDER_STATE__='mls-smoothed-c1-periorbital-soft-tissue'",'render state')
# stats replace exact prefix section
s=rep(s,"continuousPeriorbitalPatch:true,continuousPeriorbitalPieces:periMesh.pieces,continuousPeriorbitalVertices:periMesh.vertices,continuousPeriorbitalTriangles:periMesh.triangles,legacyV442EyelidAvailable:true",
      "continuousPeriorbitalPatch:true,mlsSmoothedPeriorbital:true,c1FrozenBoundary:true,upperLidDominantClosure:true,continuousPeriorbitalPieces:periMesh.pieces,continuousPeriorbitalVertices:periMesh.vertices,continuousPeriorbitalTriangles:periMesh.triangles,continuousPeriorbitalSegments:periMesh.segments,continuousPeriorbitalRings:periMesh.rings,legacyV442EyelidAvailable:true",'stats')
# API set/return
s=rep(s,"if(cfg.patchStrength!==undefined)patchStrength=Math.max(0,Math.min(1,+cfg.patchStrength));if(cfg.creaseStrength!==undefined)",
      "if(cfg.patchStrength!==undefined)patchStrength=Math.max(0,Math.min(1,+cfg.patchStrength));if(cfg.smoothStrength!==undefined)smoothStrength=Math.max(0,Math.min(1,+cfg.smoothStrength));if(cfg.arcStrength!==undefined)arcStrength=Math.max(0,Math.min(1,+cfg.arcStrength));if(cfg.creaseStrength!==undefined)",'api setters')
s=rep(s,'manualBlink,lidThickness,lidDebugEnabled,patchStrength,creaseStrength,corneaResponse',
      'manualBlink,lidThickness,lidDebugEnabled,patchStrength,smoothStrength,arcStrength,creaseStrength,corneaResponse','api return')
s=rep(s,"window.__CAT_V445_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',legacyGeometricEyelid:'V4.42',orbitalExperiment:'V4.43',payload:'CATV440'};window.__CAT_V445_PERIORBITAL_GEOMETRY__={pieces:periMesh.pieces,vertices:periMesh.vertices,triangles:periMesh.triangles,fitMode:periMesh.fitMode,headBoneIndex,source:'continuous-annular-frozen-head-sampled-carrier'};",
      "window.__CAT_V445_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',legacyGeometricEyelid:'V4.42',continuousTopology:'V4.44',payload:'CATV440'};window.__CAT_V445_PERIORBITAL_GEOMETRY__={pieces:periMesh.pieces,vertices:periMesh.vertices,triangles:periMesh.triangles,segments:periMesh.segments,rings:periMesh.rings,fitMode:periMesh.fitMode,headBoneIndex,source:'quadratic-mls-lowpass-c1-frozen-boundary-carrier'};",'baseline api')
# static marker version text (LIB version)
s=s.replace('"version":"V4.44"','"version":"V4.45"')
# potential visible title remnants
s=s.replace('CAT KAOPU V4.44','CAT KAOPU V4.45')
s=s.replace('V4.44 双眼连续眶周载体第一阶段','V4.45 MLS 平滑眶周软组织与猫眼弧线')
CURRENT.parent.mkdir(parents=True, exist_ok=True)
BUILD.parent.mkdir(parents=True, exist_ok=True)
CURRENT.write_text(s, encoding='utf-8')
BUILD.write_text(s, encoding='utf-8')


import base64
import hashlib
import json
import shutil


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def payload(text: str) -> bytes:
    m = re.search(r"const CAT_B64='([^']+)'", text)
    if not m:
        raise RuntimeError('CAT_B64 missing')
    return base64.b64decode(m.group(1))


def json_const(text: str, name: str, next_name: str) -> dict:
    a = text.index(f'const {name}=') + len(f'const {name}=')
    b = text.index(f';\nconst {next_name}=', a)
    return json.loads(text[a:b])


def write_metadata(source: str, output: str) -> None:
    source_payload = payload(source)
    output_payload = payload(output)
    source_rig = json_const(source, 'RIG', 'LIB')
    output_rig = json_const(output, 'RIG', 'LIB')
    required = {
        'readyApi': '__CAT_V445_READY__' in output,
        'geometryApi': '__CAT_V445_PERIORBITAL_GEOMETRY__' in output,
        'mlsBuilder': 'buildSmoothPeriorbital' in output,
        'mlsFitMode': 'quadratic_mls_lowpass_c1_frozen_boundary' in output,
        'smoothUniform': 'uSmoothStrength' in output,
        'arcUniform': 'uArcStrength' in output,
        'opaqueDraw': 'gl.enable(gl.POLYGON_OFFSET_FILL)' in output,
        'legacyV444ApiRemoved': '__CAT_V444_' not in output,
    }
    checks = {
        'schema': 'cat_kaopu/v445_technical_qa@1.0',
        'version': 'V4.45',
        'sourceBaseline': str(BASELINE.relative_to(ROOT)),
        'outputWorkbench': str(CURRENT.relative_to(ROOT)),
        'sourceHtmlSha256': sha_bytes(source.encode()),
        'outputHtmlSha256': sha_bytes(output.encode()),
        'sourcePayloadSha256': sha_bytes(source_payload),
        'outputPayloadSha256': sha_bytes(output_payload),
        'payloadByteIdentical': source_payload == output_payload,
        'rigJsonIdentical': source_rig == output_rig,
        'boneCount': len(output_rig.get('bones', [])),
        'neutralBodySurfaceChanged': False,
        'skinWeightsChanged': False,
        'legacyV444TopologyPreserved': True,
        'addedGeometry': {
            'type': 'two high-resolution quadratic-MLS periorbital carriers',
            'pieces': 2,
            'segmentsPerEye': 96,
            'radialRings': 14,
            'vertices': 2910,
            'triangles': 5376,
            'headBoneDriven': True,
            'frozenBoundaryReturn': True,
            'writesBackToPayload': False,
        },
        'requiredMarkers': required,
        'runtimeDependencies': {
            'externalModel': False,
            'externalTexture': False,
            'externalAnimation': False,
        },
        'visualAcceptance': False,
        'productionReady': False,
    }
    if not checks['payloadByteIdentical'] or not checks['rigJsonIdentical']:
        raise RuntimeError('V4.45 changed frozen payload or RIG')
    if checks['boneCount'] != 34 or not all(required.values()):
        raise RuntimeError(f'V4.45 invariant failure: {checks}')
    TECH_QA.parent.mkdir(parents=True, exist_ok=True)
    TECH_QA.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    current_path = ROOT / 'CURRENT.json'
    current = json.loads(current_path.read_text(encoding='utf-8'))
    current['date'] = '2026-09-16'
    current['currentVersion'] = 'V4.45'
    current['currentEntry'] = 'workbench/CAT_KAOPU_CURRENT.html'
    current['currentLayer'] = 'high-resolution quadratic-MLS periorbital carriers with C1 frozen-boundary return and upper-lid-dominant feline closure'
    current.setdefault('geometry', {}).update({
        'mlsPeriorbitalVertices': 2910,
        'mlsPeriorbitalTriangles': 5376,
        'mlsPeriorbitalPieces': 2,
        'mlsPeriorbitalSegmentsPerEye': 96,
        'mlsPeriorbitalRadialRings': 14,
        'mlsPeriorbitalStorage': 'runtime-generated outside CATV440; quadratic MLS + periodic low-pass + exact frozen boundary return',
    })
    current['acceptance'] = {
        'surfaceUserAccepted': True,
        'legacyV444TechnicalCandidate': True,
        'visualAcceptance': False,
        'productionReady': False,
        'userReviewRequired': True,
    }
    current['technicalInvariants'] = {
        'embeddedPayloadSha256': checks['outputPayloadSha256'],
        'sourcePayloadSha256': checks['sourcePayloadSha256'],
        'payloadUnchangedFromV440': True,
        'rigJsonIdenticalToV444': True,
        'boneCount': 34,
        'neutralSurfaceChanged': False,
        'skinWeightsChanged': False,
        'legacyV444TopologyPreserved': True,
        'addedGeometry': 'two head-bone-driven quadratic-MLS periorbital carriers outside CATV440',
    }
    current['nextProductionGate'] = [
        'inspect ultra-close front, three-quarter and side views at open, half and fully closed states',
        'verify MLS 0 versus 1 changes local curvature without moving the frozen head silhouette',
        'verify full closure uses a curved upper-lid-dominant seam and no horizontal plug remains',
        'verify inner and outer canthi stay continuous with no eye-globe leakage',
        'only after this gate decide whether eye anatomy is accepted or requires a local head carrier rebuild',
    ]
    current['github'] = {
        'repository': 'haihao0307/Humanoid-Rig-Lab-Next',
        'existingBranch': 'codex/cat-kaopu-v445-mls-periorbital-20260916',
        'existingBranchHead': None,
        'recommendedNewBranch': 'codex/cat-kaopu-v445-mls-periorbital-20260916',
        'recommendedModulePath': 'cat-kaopu/',
        'sourceBranch': 'codex/cat-kaopu-v444-continuous-periorbital-20260916',
    }
    current_path.write_text(json.dumps(current, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    (ROOT / 'README.md').write_text(
        """# Cat Kaopu module — V4.45 MLS periorbital candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.45 build:

```bash
python tools/build_cat_v445_mls_periorbital.py
python tools/verify_cat_v445_module.py
```

V4.45 keeps V4.44's one-continuous-carrier-per-eye topology but replaces raw coarse-triangle copying with a local weighted quadratic moving-least-squares surface, periodic low-pass filtering and an exact final return to the frozen V4.32 boundary. It also introduces a curved upper-lid-dominant closure, bounded geometric crease and opaque polygon-offset skin pass.

The V4.32 body surface, CATV440 payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. `visualAcceptance=false` and `productionReady=false` remain in force until close-up review.
""",
        encoding='utf-8',
    )

    EXEC_DOC.parent.mkdir(parents=True, exist_ok=True)
    EXEC_DOC.write_text(
        f"""# CAT KAOPU V4.45 执行报告

## 本轮一次性处理

- 保留 V4.44 每眼一张连续环网，不增加新的独立覆盖片。
- 将外圈粗三角逐点采样替换为局部加权二次 MLS 曲面。
- 沿眼眶周向执行周期低通，去除方形和折线化边界。
- 最外 14% 环带以五次平滑权重回到冻结 V4.32 原始表面，保持头部轮廓不变。
- 网格提升为每眼 96 段、14 个径向环，共 2910 顶点、5376 三角形。
- 闭合线改为上睑主导的拱形曲线；下睑延迟上提并在完全闭眼时汇合。
- 加入受限软组织体积、上睑褶皱、MLS 强度和闭合弧度控制。
- 改用不透明 polygon-offset 皮肤层，避免透明补片再次暴露粗眼眶。

## 冻结层

- 源载荷 SHA-256：`{checks['sourcePayloadSha256']}`
- 输出载荷 SHA-256：`{checks['outputPayloadSha256']}`
- 载荷逐字节一致：`{str(checks['payloadByteIdentical']).lower()}`
- RIG JSON 一致：`{str(checks['rigJsonIdentical']).lower()}`
- 骨骼数量：`{checks['boneCount']}`

## 状态

技术候选，等待 WebGL2 超近景复核。`visualAcceptance=false`，`productionReady=false`。
""",
        encoding='utf-8',
    )
    SELF_DOC.write_text(
        """# CAT KAOPU V4.45 自检记录

## 已完成

1. 眼眶过渡不再逐点忠实复制单个粗三角面。
2. 外边界最终仍严格回到冻结头脸，不改变整猫中性轮廓。
3. 连续双眼拓扑、内外眼角与动态睑裂保留。
4. 闭眼改成上睑主导的拱形闭合，不再以水平直线作为目标。
5. CATV440、34 骨、RIG、蒙皮权重和运动链未改变。
6. 页面继续不依赖外部模型、贴图或动画。

## 必须视觉复核

- 开眼是否仍可看出独立环形补片。
- 半闭时上睑是否承担主要行程。
- 完全闭眼是否消除水平塞片感。
- 三分之四和侧面是否存在漂浮、穿模或轮廓变化。
- MLS 强度 0 与 1 是否只影响局部曲率。

未经过这些近景检查前不得标记视觉完成，也不得进入第三眼睑、胡须或轮廓短毛。
""",
        encoding='utf-8',
    )

    files = []
    for p in sorted(ROOT.rglob('*')):
        if not p.is_file() or '__pycache__' in p.parts or p.name == 'BUILD_MANIFEST.json':
            continue
        rel = p.relative_to(ROOT).as_posix()
        data = p.read_bytes()
        files.append({'path': rel, 'bytes': len(data), 'sha256': sha_bytes(data)})
    manifest = {
        'schema': 'cat_kaopu/module_build_manifest@1.4',
        'version': 'V4.45',
        'buildId': 'cat-kaopu-v445-mls-periorbital-20260916',
        'currentEntry': 'workbench/CAT_KAOPU_CURRENT.html',
        'runtimePayload': 'runtime/cat_v440.bin',
        'manifestSelfHashExcluded': True,
        'visualAcceptance': False,
        'productionReady': False,
        'files': files,
    }
    (ROOT / 'BUILD_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


write_metadata(BASELINE.read_text(encoding='utf-8'), s)
print(json.dumps({'version':'V4.45','htmlBytes':len(s.encode()),'vertices':2910,'triangles':5376,'visualAcceptance':False,'productionReady':False}, ensure_ascii=False))
