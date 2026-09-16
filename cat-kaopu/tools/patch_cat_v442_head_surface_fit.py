from __future__ import annotations

from pathlib import Path
import re

BUILDER = Path(__file__).resolve().parent / "build_cat_v442_geometric_eyelid.py"

GEOMETRY = r'''function buildGeometricEyelids(mesh){
const groups=[[],[]];for(let i=0;i<mesh.vc;i++){if(mesh.part[i]>.5)groups[mesh.pos[i*3+1]>=0?0:1].push(i)}
const specs=groups.map(ids=>{if(!ids.length)throw new Error('V4.42 眼球顶点缺失');const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity],c=[0,0,0];for(const i of ids)for(let k=0;k<3;k++){const v=mesh.pos[i*3+k];mn[k]=Math.min(mn[k],v);mx[k]=Math.max(mx[k],v);c[k]+=v}for(let k=0;k<3;k++)c[k]/=ids.length;return{center:c,radius:[(mx[0]-mn[0])*.5,(mx[1]-mn[1])*.5,(mx[2]-mn[2])*.5]}});
const bodyTris=[];for(let k=0;k<mesh.idx.length;k+=3){const a=mesh.idx[k],b=mesh.idx[k+1],c=mesh.idx[k+2];if(mesh.part[a]<.5&&mesh.part[b]<.5&&mesh.part[c]<.5)bodyTris.push(a,b,c)}
function sampleFace(spec,y,z,ex,ey){let bestX=-1e9,bestP=null,bestN=null;const minX=spec.center[0]-spec.radius[0]*1.8,maxX=spec.center[0]+spec.radius[0]*2.;for(let k=0;k<bodyTris.length;k+=3){const ia=bodyTris[k],ib=bodyTris[k+1],ic=bodyTris[k+2],ao=ia*3,bo=ib*3,co=ic*3,ay=mesh.pos[ao+1],az=mesh.pos[ao+2],by=mesh.pos[bo+1],bz=mesh.pos[bo+2],cy=mesh.pos[co+1],cz=mesh.pos[co+2],den=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(den)<1e-12)continue;const wa=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/den,wb=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/den,wc=1-wa-wb;if(wa<-.001||wb<-.001||wc<-.001)continue;const x=wa*mesh.pos[ao]+wb*mesh.pos[bo]+wc*mesh.pos[co];if(x<minX||x>maxX||x<=bestX)continue;let nx=wa*mesh.nor[ao]+wb*mesh.nor[bo]+wc*mesh.nor[co],ny=wa*mesh.nor[ao+1]+wb*mesh.nor[bo+1]+wc*mesh.nor[co+1],nz=wa*mesh.nor[ao+2]+wb*mesh.nor[bo+2]+wc*mesh.nor[co+2],nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;bestX=x;bestP=[x,y,z];bestN=[nx,ny,nz]}if(bestP)return{p:bestP,n:bestN};const ef=Math.sqrt(Math.max(.0001,1.-ex*ex-ey*ey)),dx=ef,dy=ex,dz=ey,dl=Math.hypot(dx,dy,dz)||1,ux=dx/dl,uy=dy/dl,uz=dz/dl,nx=ux/Math.max(spec.radius[0],.0001),ny=uy/Math.max(spec.radius[1],.0001),nz=uz/Math.max(spec.radius[2],.0001),nl=Math.hypot(nx,ny,nz)||1;return{p:[spec.center[0]+spec.radius[0]*ux*1.018,spec.center[1]+spec.radius[1]*uy*1.018,spec.center[2]+spec.radius[2]*uz*1.018],n:[nx/nl,ny/nl,nz/nl]}}
const param=[],center=[],radius=[],rim=[],outerPos=[],outerNor=[],idx=[];let vcount=0;const cols=40,rows=6,xmax=.995;function push(spec,ex,t,lid,mode,isRim,outer){param.push(ex,t,lid,mode);center.push(...spec.center);radius.push(...spec.radius);rim.push(isRim?1:0);outerPos.push(...outer.p);outerNor.push(...outer.n);return vcount++}
for(const spec of specs)for(const lid of[1,-1]){const outerFactor=lid>0?.96:-.90,outer=[];for(let i=0;i<=cols;i++){const ex=-xmax+2*xmax*i/cols,q=Math.sqrt(Math.max(.0001,1.-ex*ex)),ey=outerFactor*q,y=spec.center[1]+spec.radius[1]*ex,z=spec.center[2]+spec.radius[2]*ey;outer.push(sampleFace(spec,y,z,ex,ey))}const base=vcount;for(let i=0;i<=cols;i++){const ex=-xmax+2*xmax*i/cols;for(let j=0;j<=rows;j++)push(spec,ex,j/rows,lid,0,false,outer[i])}for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const a=base+i*(rows+1)+j,b=a+rows+1;idx.push(a,b,a+1,a+1,b,b+1)}const rb=vcount;for(let i=0;i<=cols;i++){const ex=-xmax+2*xmax*i/cols;push(spec,ex,0,lid,1,true,outer[i]);push(spec,ex,0,lid,2,true,outer[i])}for(let i=0;i<cols;i++){const a=rb+i*2,b=a+2;idx.push(a,b,a+1,a+1,b,b+1)}}return{param:new Float32Array(param),center:new Float32Array(center),radius:new Float32Array(radius),rim:new Float32Array(rim),outerPos:new Float32Array(outerPos),outerNor:new Float32Array(outerNor),idx:new Uint16Array(idx),vertices:vcount,triangles:idx.length/3,eyeSpecs:specs,fitMode:'head_surface_raycast'}}
    const lidMesh=buildGeometricEyelids(m),headBoneIndex=RIG.nameToIndex.head;'''

LID_VS = r'''const lidVS=`#version 300 es
precision highp float;layout(location=0)in vec4 aParam;layout(location=1)in vec3 aCenter;layout(location=2)in vec3 aRadius;layout(location=3)in float aRim;layout(location=4)in vec3 aOuterPos;layout(location=5)in vec3 aOuterNor;uniform mat4 uPV;uniform mat4 uHead;uniform float uBlink;uniform float uThicknessM;out vec3 vN;out float vRim;out float vLid;out float vClosure;out float vBand;void main(){float ex=aParam.x,t=aParam.y,lid=aParam.z;float q=sqrt(max(.0001,1.-ex*ex));float close=smoothstep(0.,1.,clamp(uBlink,0.,1.));float side=sign(aCenter.y),medial=ex*side;float openInner=lid>0.?((.39-.025*medial)*q):((-.16-.015*medial)*q);float seamCenter=(-.135+.060*medial+.025*(1.-q))*q;float seam=seamCenter+(lid>0.?-.012:.012)*q;float lidClose=lid>0.?smoothstep(0.,1.,close):pow(close,1.18);float inner=mix(openInner,seam,lidClose);float innerEf=sqrt(max(.0001,1.-ex*ex-inner*inner));float rMean=max(.0001,(aRadius.x+aRadius.y+aRadius.z)/3.);float frontScale=1.+uThicknessM/rMean;vec3 innerDir=normalize(vec3(innerEf,ex,inner));vec3 innerP=aCenter+aRadius*innerDir*frontScale;vec3 innerN=normalize(vec3(innerDir.x/max(aRadius.x,.0001),innerDir.y/max(aRadius.y,.0001),innerDir.z/max(aRadius.z,.0001)));float tt=smoothstep(0.,1.,t);vec3 closeNormal=normalize(vec3(1.,ex*.10,inner*.08));innerN=normalize(mix(innerN,closeNormal,close*(1.-tt)*.58));vec3 p,n;if(aParam.w<.5){vec3 outerN=normalize(aOuterNor);vec3 outerP=aOuterPos+outerN*uThicknessM*.16;p=mix(innerP,outerP,tt);p.x+=close*(lid>0.?uThicknessM*.46:-uThicknessM*.16)*(1.-tt);n=normalize(mix(innerN,outerN,tt));}else{float shell=aParam.w<1.5?frontScale:1.-uThicknessM/rMean*.35;p=aCenter+aRadius*innerDir*shell;p.x+=close*(lid>0.?uThicknessM*.46:-uThicknessM*.16);vec3 rimNormal=normalize(vec3(.42,0.,-lid*.91));n=normalize(mix(innerN,rimNormal,step(.5,aRim)));}vec4 wp=uHead*vec4(p,1.);gl_Position=uPV*wp;vN=normalize(mat3(uHead)*n);vRim=aRim;vLid=lid;vClosure=close;vBand=t;}`;
    const lidFS=`'''

text = BUILDER.read_text(encoding="utf-8")
text, n = re.subn(
    r"function buildGeometricEyelids\(mesh\)\{[\s\S]*?\}\n\s*const lidMesh=buildGeometricEyelids\(m\),headBoneIndex=RIG\.nameToIndex\.head;",
    lambda _: GEOMETRY,
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"geometry builder marker count: {n}")

text, n = re.subn(
    r"const lidVS=`#version 300 es[\s\S]*?`;\n\s*const lidFS=`",
    lambda _: LID_VS,
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"lid vertex shader marker count: {n}")

old = "lidRimBuf=attr(3,lidMesh.rim,1,gl.FLOAT),lidIb=gl.createBuffer()"
new = "lidRimBuf=attr(3,lidMesh.rim,1,gl.FLOAT),lidOuterPosBuf=attr(4,lidMesh.outerPos,3,gl.FLOAT),lidOuterNorBuf=attr(5,lidMesh.outerNor,3,gl.FLOAT),lidIb=gl.createBuffer()"
if text.count(old) != 1:
    raise SystemExit(f"lid VAO marker count: {text.count(old)}")
text = text.replace(old, new, 1)

old_api = "pieces:4,vertices:lidMesh.vertices,triangles:lidMesh.triangles,headBoneIndex"
new_api = "pieces:4,vertices:lidMesh.vertices,triangles:lidMesh.triangles,fitMode:lidMesh.fitMode,headBoneIndex"
if text.count(old_api) == 1:
    text = text.replace(old_api, new_api, 1)

BUILDER.write_text(text, encoding="utf-8")
print("patched V4.42 eyelids: outer boundary fitted to the actual head surface by projected raycast")
