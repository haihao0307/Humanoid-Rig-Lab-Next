from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKBENCH = ROOT / "workbench/CAT_KAOPU_CURRENT.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


text = WORKBENCH.read_text(encoding="utf-8")
if "function buildContinuousPeriorbital" in text:
    print("V4.44 continuous periorbital runtime already present")
    raise SystemExit(0)

shaders = r'''const periVS=`#version 300 es
precision highp float;layout(location=0)in vec4 aParam;layout(location=1)in vec3 aCenter;layout(location=2)in vec3 aRadius;layout(location=3)in vec3 aOuterPos;layout(location=4)in vec3 aOuterNor;uniform mat4 uPV;uniform mat4 uHead;uniform float uBlink;uniform float uThicknessM;uniform float uPatchStrength;uniform float uCreaseStrength;out vec3 vN;out float vBand;out float vUpper;out float vBlink;out float vCanthus;float smooth01(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}void main(){float theta=aParam.x,t=aParam.y,c=cos(theta),s=sin(theta),upper=step(0.,s),absS=abs(s),hx=.52*c,side=sign(aCenter.y),lateral=hx*side,medial=smooth01((-lateral-.2)/.8),arc=pow(absS,mix(.82,1.08,medial)),q=sqrt(max(.0008,1.-hx*hx)),corner=-.025+.070*lateral+.012*(1.-q),upperOpen=corner+(.34-.02*lateral)*arc,lowerOpen=corner-(.28+.01*lateral)*arc,seam=corner-(.035-.010*lateral)*arc,blink=smooth01(uBlink),lidClose=mix(pow(blink,1.22),blink,upper),openZ=mix(lowerOpen,upperOpen,upper),innerZ=mix(openZ,seam,lidClose),innerEf=sqrt(max(.0008,1.-hx*hx-innerZ*innerZ)),rMean=max(.0001,(aRadius.x+aRadius.y+aRadius.z)/3.),frontScale=1.+uThicknessM/rMean;vec3 innerDir=normalize(vec3(innerEf,hx,innerZ)),innerP=aCenter+aRadius*innerDir*frontScale,innerN=normalize(vec3(innerDir.x/max(aRadius.x,.0001),innerDir.y/max(aRadius.y,.0001),innerDir.z/max(aRadius.z,.0001)));float tt=smooth01(t),innerW=1.-tt,canthus=smoothstep(.015,.20,absS);vec3 p=mix(innerP,aOuterPos,tt),n=normalize(mix(innerN,aOuterNor,tt));float tissueLift=(.00004+.00020*uPatchStrength)*innerW*canthus;p+=n*tissueLift;float crease=uCreaseStrength*blink*innerW*pow(absS,.72);p.x+=crease*mix(.00012,.00036,upper);p.z+=crease*mix(.00005,-.00013,upper);vec3 closedN=normalize(vec3(.94,hx*.10,mix(-.09,.16,upper)));n=normalize(mix(n,closedN,crease*.34));vec4 wp=uHead*vec4(p,1.);gl_Position=uPV*wp;vN=normalize(mat3(uHead)*n);vBand=tt;vUpper=upper;vBlink=blink;vCanthus=canthus;}`;
const periFS=`#version 300 es
precision highp float;in vec3 vN;in float vBand;in float vUpper;in float vBlink;in float vCanthus;uniform float uPatchStrength;uniform float uCreaseStrength;uniform float uDebug;out vec4 outColor;void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;float inner=1.-smoothstep(.02,.30,vBand),closed=smoothstep(.70,.98,vBlink),seam=(1.-smoothstep(.015,.085,vBand))*closed*vUpper,fold=(smoothstep(.10,.19,vBand)-smoothstep(.22,.34,vBand))*closed*vUpper*uCreaseStrength;vec3 base=vec3(.69,.655,.59);base*=mix(.985,.965,vUpper);base*=1.-.52*seam-.10*fold;vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);if(uDebug>.5)col=mix(vec3(.08,.62,.98),vec3(1.,.30,.08),vUpper)*(.52+.48*max(dot(n,l1),0.));float alpha=uDebug>.5?1.:clamp(uPatchStrength*(1.-smoothstep(.80,1.,vBand))*(.72+.28*vCanthus),0.,.98);outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),alpha);}`;
'''
text = replace_once(text, "const lidVS=`#version 300 es", shaders + "const lidVS=`#version 300 es", "shader insertion")
text = replace_once(
    text,
    "const pr=program(gl,vs,fs),lpr=program(gl,lineVS,lineFS),lidPr=program(gl,lidVS,lidFS);gl.useProgram(pr);",
    "const pr=program(gl,vs,fs),lpr=program(gl,lineVS,lineFS),periPr=program(gl,periVS,periFS),lidPr=program(gl,lidVS,lidFS);gl.useProgram(pr);",
    "program creation",
)

geometry = r'''
function buildContinuousPeriorbital(mesh,eyeSpecs){
const bodyTris=[];for(let k=0;k<mesh.idx.length;k+=3){const a=mesh.idx[k],b=mesh.idx[k+1],c=mesh.idx[k+2];if(mesh.part[a]<.5&&mesh.part[b]<.5&&mesh.part[c]<.5)bodyTris.push(a,b,c)}
function smooth01(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
function sampleFace(spec,y,z,hx,ez){let bestX=-1e9,bestP=null,bestN=null;const minX=spec.center[0]-spec.radius[0]*2.,maxX=spec.center[0]+spec.radius[0]*2.2;for(let k=0;k<bodyTris.length;k+=3){const ia=bodyTris[k],ib=bodyTris[k+1],ic=bodyTris[k+2],ao=ia*3,bo=ib*3,co=ic*3,ay=mesh.pos[ao+1],az=mesh.pos[ao+2],by=mesh.pos[bo+1],bz=mesh.pos[bo+2],cy=mesh.pos[co+1],cz=mesh.pos[co+2],den=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(den)<1e-12)continue;const wa=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/den,wb=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/den,wc=1-wa-wb;if(wa<-.001||wb<-.001||wc<-.001)continue;const x=wa*mesh.pos[ao]+wb*mesh.pos[bo]+wc*mesh.pos[co];if(x<minX||x>maxX||x<=bestX)continue;let nx=wa*mesh.nor[ao]+wb*mesh.nor[bo]+wc*mesh.nor[co],ny=wa*mesh.nor[ao+1]+wb*mesh.nor[bo+1]+wc*mesh.nor[co+1],nz=wa*mesh.nor[ao+2]+wb*mesh.nor[bo+2]+wc*mesh.nor[co+2],nl=Math.hypot(nx,ny,nz)||1;bestX=x;bestP=[x,y,z];bestN=[nx/nl,ny/nl,nz/nl]}if(bestP)return{p:bestP,n:bestN};const ef=Math.sqrt(Math.max(.0001,1-hx*hx-ez*ez)),dl=Math.hypot(ef,hx,ez)||1,ux=ef/dl,uy=hx/dl,uz=ez/dl,nx=ux/Math.max(spec.radius[0],.0001),ny=uy/Math.max(spec.radius[1],.0001),nz=uz/Math.max(spec.radius[2],.0001),nl=Math.hypot(nx,ny,nz)||1;return{p:[spec.center[0]+spec.radius[0]*ux*1.018,spec.center[1]+spec.radius[1]*uy*1.018,spec.center[2]+spec.radius[2]*uz*1.018],n:[nx/nl,ny/nl,nz/nl]}}
const param=[],center=[],radius=[],outerPos=[],outerNor=[],idx=[];let vcount=0;const segments=64,rings=8;function push(theta,t,spec,outer){param.push(theta,t,0,0);center.push(...spec.center);radius.push(...spec.radius);outerPos.push(...outer.p);outerNor.push(...outer.n);return vcount++}
for(const spec of eyeSpecs){const outer=[];for(let i=0;i<=segments;i++){const theta=2*Math.PI*i/segments,c=Math.cos(theta),s=Math.sin(theta),absS=Math.abs(s),hx=.995*c,lateral=.52*c*Math.sign(spec.center[1]||1),medial=smooth01((-lateral-.2)/.8),arc=Math.pow(absS,.72*(1-medial)+.98*medial),q=Math.sqrt(Math.max(.0001,1-(.52*c)*(.52*c))),corner=-.025+.070*lateral+.012*(1-q),ez=corner+(s>=0?.94:-.70)*arc,y=spec.center[1]+spec.radius[1]*hx,z=spec.center[2]+spec.radius[2]*ez;outer.push(sampleFace(spec,y,z,hx,ez))}const base=vcount;for(let i=0;i<=segments;i++){const theta=2*Math.PI*i/segments;for(let j=0;j<=rings;j++)push(theta,j/rings,spec,outer[i])}for(let i=0;i<segments;i++)for(let j=0;j<rings;j++){const a=base+i*(rings+1)+j,b=a+rings+1;idx.push(a,b,a+1,a+1,b,b+1)}}return{param:new Float32Array(param),center:new Float32Array(center),radius:new Float32Array(radius),outerPos:new Float32Array(outerPos),outerNor:new Float32Array(outerNor),idx:new Uint16Array(idx),vertices:vcount,triangles:idx.length/3,pieces:2,fitMode:'continuous_annular_frozen_head_surface'}}
const periMesh=buildContinuousPeriorbital(m,lidMesh.eyeSpecs);
'''
text = replace_once(
    text,
    "    const lidMesh=buildGeometricEyelids(m),headBoneIndex=RIG.nameToIndex.head;",
    "    const lidMesh=buildGeometricEyelids(m),headBoneIndex=RIG.nameToIndex.head;" + geometry,
    "geometry insertion",
)

lid_vao = "const lidVao=gl.createVertexArray();gl.bindVertexArray(lidVao);const lidParamBuf=attr(0,lidMesh.param,4,gl.FLOAT),lidCenterBuf=attr(1,lidMesh.center,3,gl.FLOAT),lidRadiusBuf=attr(2,lidMesh.radius,3,gl.FLOAT),lidRimBuf=attr(3,lidMesh.rim,1,gl.FLOAT),lidOuterPosBuf=attr(4,lidMesh.outerPos,3,gl.FLOAT),lidOuterNorBuf=attr(5,lidMesh.outerNor,3,gl.FLOAT),lidIb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,lidIb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,lidMesh.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);const LidU={pv:gl.getUniformLocation(lidPr,'uPV'),head:gl.getUniformLocation(lidPr,'uHead'),blink:gl.getUniformLocation(lidPr,'uBlink'),thickness:gl.getUniformLocation(lidPr,'uThicknessM'),debug:gl.getUniformLocation(lidPr,'uDebug')};"
peri_vao = lid_vao + "const periVao=gl.createVertexArray();gl.bindVertexArray(periVao);const periParamBuf=attr(0,periMesh.param,4,gl.FLOAT),periCenterBuf=attr(1,periMesh.center,3,gl.FLOAT),periRadiusBuf=attr(2,periMesh.radius,3,gl.FLOAT),periOuterPosBuf=attr(3,periMesh.outerPos,3,gl.FLOAT),periOuterNorBuf=attr(4,periMesh.outerNor,3,gl.FLOAT),periIb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,periIb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,periMesh.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);const PeriU={pv:gl.getUniformLocation(periPr,'uPV'),head:gl.getUniformLocation(periPr,'uHead'),blink:gl.getUniformLocation(periPr,'uBlink'),thickness:gl.getUniformLocation(periPr,'uThicknessM'),patch:gl.getUniformLocation(periPr,'uPatchStrength'),crease:gl.getUniformLocation(periPr,'uCreaseStrength'),debug:gl.getUniformLocation(periPr,'uDebug')};"
text = replace_once(text, lid_vao, peri_vao, "periorbital VAO")

pattern = re.compile(
    r"if\(blinkLayerEnabled\)\{gl\.useProgram\(lidPr\);gl\.bindVertexArray\(lidVao\);.*?gl\.bindVertexArray\(null\)\}",
    re.S,
)
replacement = (
    "if(blinkLayerEnabled){gl.useProgram(periPr);gl.bindVertexArray(periVao);"
    "gl.uniformMatrix4fv(PeriU.pv,false,pv);"
    "gl.uniformMatrix4fv(PeriU.head,false,mats.skin.subarray(headBoneIndex*16,headBoneIndex*16+16));"
    "gl.uniform1f(PeriU.blink,expressionState.blink);gl.uniform1f(PeriU.thickness,lidThickness);"
    "gl.uniform1f(PeriU.patch,patchStrength);gl.uniform1f(PeriU.crease,creaseStrength);"
    "gl.uniform1f(PeriU.debug,lidDebugEnabled?1:0);gl.disable(gl.CULL_FACE);"
    "gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);"
    "gl.drawElements(gl.TRIANGLES,periMesh.idx.length,gl.UNSIGNED_SHORT,0);"
    "gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null)}"
)
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"periorbital draw replacement: expected one marker, found {count}")

WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.44 continuous annular periorbital geometry, shaders and draw pass")
