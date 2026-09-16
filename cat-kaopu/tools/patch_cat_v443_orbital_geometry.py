from __future__ import annotations

from pathlib import Path

WORKBENCH = Path(__file__).resolve().parent.parent / "workbench/CAT_KAOPU_CURRENT.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


text = WORKBENCH.read_text(encoding="utf-8")
if "function buildOrbitalTissue" in text:
    print("V4.43 orbital geometry already present")
    raise SystemExit(0)

geometry = r'''
function buildOrbitalTissue(mesh,eyeSpecs){
const bodyTris=[];for(let k=0;k<mesh.idx.length;k+=3){const a=mesh.idx[k],b=mesh.idx[k+1],c=mesh.idx[k+2];if(mesh.part[a]<.5&&mesh.part[b]<.5&&mesh.part[c]<.5)bodyTris.push(a,b,c)}
function smooth01(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
function curves(spec,ex){const hx=Math.max(-1,Math.min(1,ex/.995)),q=Math.sqrt(Math.max(0,1-hx*hx)),lateral=hx*Math.sign(spec.center[1]||1),medial=smooth01((-lateral-.2)/.8),arc=Math.pow(Math.max(q,.0001),.78*(1-medial)+1.12*medial),corner=-.025+.070*lateral+.012*(1-q);return{hx,arc,corner,innerUpper:corner+.62*arc,innerLower:corner-.31*arc,outerUpper:corner+1.05*arc,outerLower:corner-.72*arc}}
function sampleFace(spec,y,z,hx,ey){let bestX=-1e9,bestP=null,bestN=null;const minX=spec.center[0]-spec.radius[0]*1.9,maxX=spec.center[0]+spec.radius[0]*2.1;for(let k=0;k<bodyTris.length;k+=3){const ia=bodyTris[k],ib=bodyTris[k+1],ic=bodyTris[k+2],ao=ia*3,bo=ib*3,co=ic*3,ay=mesh.pos[ao+1],az=mesh.pos[ao+2],by=mesh.pos[bo+1],bz=mesh.pos[bo+2],cy=mesh.pos[co+1],cz=mesh.pos[co+2],den=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(den)<1e-12)continue;const wa=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/den,wb=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/den,wc=1-wa-wb;if(wa<-.001||wb<-.001||wc<-.001)continue;const x=wa*mesh.pos[ao]+wb*mesh.pos[bo]+wc*mesh.pos[co];if(x<minX||x>maxX||x<=bestX)continue;let nx=wa*mesh.nor[ao]+wb*mesh.nor[bo]+wc*mesh.nor[co],ny=wa*mesh.nor[ao+1]+wb*mesh.nor[bo+1]+wc*mesh.nor[co+1],nz=wa*mesh.nor[ao+2]+wb*mesh.nor[bo+2]+wc*mesh.nor[co+2],nl=Math.hypot(nx,ny,nz)||1;bestX=x;bestP=[x,y,z];bestN=[nx/nl,ny/nl,nz/nl]}if(bestP)return{p:bestP,n:bestN};const ef=Math.sqrt(Math.max(.0001,1-hx*hx-ey*ey)),dl=Math.hypot(ef,hx,ey)||1,ux=ef/dl,uy=hx/dl,uz=ey/dl,nx=ux/Math.max(spec.radius[0],.0001),ny=uy/Math.max(spec.radius[1],.0001),nz=uz/Math.max(spec.radius[2],.0001),nl=Math.hypot(nx,ny,nz)||1;return{p:[spec.center[0]+spec.radius[0]*ux*1.018,spec.center[1]+spec.radius[1]*uy*1.018,spec.center[2]+spec.radius[2]*uz*1.018],n:[nx/nl,ny/nl,nz/nl]}}
const param=[],innerPos=[],innerNor=[],outerPos=[],outerNor=[],idx=[];let vcount=0;const cols=48,rows=6,xmax=.995;function push(ex,t,lid,inner,outer){param.push(ex,t,lid,0);innerPos.push(...inner.p);innerNor.push(...inner.n);outerPos.push(...outer.p);outerNor.push(...outer.n);return vcount++}
for(const spec of eyeSpecs)for(const lid of[1,-1]){const inner=[],outer=[];for(let i=0;i<=cols;i++){const ex=-xmax+2*xmax*i/cols,c=curves(spec,ex),ei=lid>0?c.innerUpper:c.innerLower,eo=lid>0?c.outerUpper:c.outerLower,yi=spec.center[1]+spec.radius[1]*c.hx,zi=spec.center[2]+spec.radius[2]*ei,yo=yi,zo=spec.center[2]+spec.radius[2]*eo;inner.push(sampleFace(spec,yi,zi,c.hx,ei));outer.push(sampleFace(spec,yo,zo,c.hx,eo))}const base=vcount;for(let i=0;i<=cols;i++)for(let j=0;j<=rows;j++)push(-xmax+2*xmax*i/cols,j/rows,lid,inner[i],outer[i]);for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const a=base+i*(rows+1)+j,b=a+rows+1;idx.push(a,b,a+1,a+1,b,b+1)}}return{param:new Float32Array(param),innerPos:new Float32Array(innerPos),innerNor:new Float32Array(innerNor),outerPos:new Float32Array(outerPos),outerNor:new Float32Array(outerNor),idx:new Uint16Array(idx),vertices:vcount,triangles:idx.length/3,pieces:4,fitMode:'frozen_head_surface_orbital_transition'}}
const orbitMesh=buildOrbitalTissue(m,lidMesh.eyeSpecs);
'''
text = replace_once(
    text,
    "    const lidMesh=buildGeometricEyelids(m),headBoneIndex=RIG.nameToIndex.head;",
    "    const lidMesh=buildGeometricEyelids(m),headBoneIndex=RIG.nameToIndex.head;" + geometry,
    "geometry insertion",
)

lid_vao = "const lidVao=gl.createVertexArray();gl.bindVertexArray(lidVao);const lidParamBuf=attr(0,lidMesh.param,4,gl.FLOAT),lidCenterBuf=attr(1,lidMesh.center,3,gl.FLOAT),lidRadiusBuf=attr(2,lidMesh.radius,3,gl.FLOAT),lidRimBuf=attr(3,lidMesh.rim,1,gl.FLOAT),lidOuterPosBuf=attr(4,lidMesh.outerPos,3,gl.FLOAT),lidOuterNorBuf=attr(5,lidMesh.outerNor,3,gl.FLOAT),lidIb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,lidIb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,lidMesh.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);const LidU={pv:gl.getUniformLocation(lidPr,'uPV'),head:gl.getUniformLocation(lidPr,'uHead'),blink:gl.getUniformLocation(lidPr,'uBlink'),thickness:gl.getUniformLocation(lidPr,'uThicknessM'),debug:gl.getUniformLocation(lidPr,'uDebug')};"
orbit_vao = lid_vao + "const orbitVao=gl.createVertexArray();gl.bindVertexArray(orbitVao);const orbitParamBuf=attr(0,orbitMesh.param,4,gl.FLOAT),orbitInnerPosBuf=attr(1,orbitMesh.innerPos,3,gl.FLOAT),orbitInnerNorBuf=attr(2,orbitMesh.innerNor,3,gl.FLOAT),orbitOuterPosBuf=attr(3,orbitMesh.outerPos,3,gl.FLOAT),orbitOuterNorBuf=attr(4,orbitMesh.outerNor,3,gl.FLOAT),orbitIb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,orbitIb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,orbitMesh.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);const OrbitU={pv:gl.getUniformLocation(orbitPr,'uPV'),head:gl.getUniformLocation(orbitPr,'uHead'),blink:gl.getUniformLocation(orbitPr,'uBlink'),strength:gl.getUniformLocation(orbitPr,'uStrength'),compression:gl.getUniformLocation(orbitPr,'uCompression'),debug:gl.getUniformLocation(orbitPr,'uDebug')};"
text = replace_once(text, lid_vao, orbit_vao, "orbital VAO")

render_marker = "gl.drawElements(gl.TRIANGLES,m.ic,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);if(blinkLayerEnabled){"
render_code = (
    "gl.drawElements(gl.TRIANGLES,m.ic,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);"
    "if(orbitLayerEnabled){gl.useProgram(orbitPr);gl.bindVertexArray(orbitVao);"
    "gl.uniformMatrix4fv(OrbitU.pv,false,pv);"
    "gl.uniformMatrix4fv(OrbitU.head,false,mats.skin.subarray(headBoneIndex*16,headBoneIndex*16+16));"
    "gl.uniform1f(OrbitU.blink,expressionState.blink);"
    "gl.uniform1f(OrbitU.strength,orbitStrength);"
    "gl.uniform1f(OrbitU.compression,orbitCompression);"
    "gl.uniform1f(OrbitU.debug,orbitDebugEnabled?1:0);"
    "gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);"
    "gl.drawElements(gl.TRIANGLES,orbitMesh.idx.length,gl.UNSIGNED_SHORT,0);"
    "gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.bindVertexArray(null)}"
    "if(blinkLayerEnabled){"
)
text = replace_once(text, render_marker, render_code, "orbital draw")

WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.43 orbital transition geometry, buffers and draw pass")
