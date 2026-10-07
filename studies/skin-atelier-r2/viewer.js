/* Observed Surface R2. A fixed, regularized 3D surface recovered from tracked
 * reference views. Appearance observations retain their original illumination.
 * NOT a video player, complete head, independent skin shader, or relightable
 * production character. These limits are visible before and during use. */
(async()=>{
'use strict';
const D=window.SURFACE_DATA,$=s=>document.querySelector(s),canvas=$('#canvas'),stage=$('#stage');
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
if(!gl)throw Error('此浏览器没有可用的 WebGL 2 上下文');
function shader(type,text){const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const vs=`#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aNormal;in float aConfidence;in vec2 aUvA;in vec2 aUvB;
uniform vec3 uRowX,uRowY,uDepthRow;uniform vec2 uOffset,uPan,uViewport;uniform float uScale,uPitch;
out vec3 vNormal;out float vConfidence;out vec2 vUvA,vUvB;
void main(){vec3 p=aPosition;float x=dot(uRowX,p)+uOffset.x;float y=dot(uRowY,p)+uOffset.y;float z=dot(uDepthRow,p);float yp=(y-670.)*cos(uPitch)-(z+10.)*sin(uPitch)+670.;vec2 s=(vec2(x,yp)-vec2(590.,630.)-uPan)*uScale;gl_Position=vec4(2.*s.x/uViewport.x,-2.*s.y/uViewport.y,z/1800.,1.);vUvA=aUvA;vUvB=aUvB;vConfidence=aConfidence;vNormal=aNormal;}`;
const fs=`#version 300 es
precision highp float;
in vec3 vNormal;in float vConfidence;in vec2 vUvA,vUvB;
uniform sampler2D uTextureA,uTextureB;uniform float uBlend,uMode,uExposure,uLight;
out vec4 outColor;
void main(){vec3 c=mix(texture(uTextureA,vUvA).rgb,texture(uTextureB,vUvB).rgb,uBlend);vec3 n=normalize(vNormal);float ndl=max(0.,dot(n,normalize(vec3(sin(uLight),.7,cos(uLight)))));if(uMode>.5&&uMode<1.5)c=vec3(.40,.43,.46)*(.27+.78*ndl);if(uMode>1.5&&uMode<2.5)c=n*.5+.5;if(uMode>2.5&&uMode<3.5)c=mix(vec3(.48,.19,.14),vec3(.25,.72,.63),clamp(vConfidence,0.,1.));outColor=vec4(clamp(c*uExposure,0.,1.),1.);}`;
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const loc={};for(const key of ['RowX','RowY','DepthRow','Offset','Pan','Viewport','Scale','Pitch','TextureA','TextureB','Blend','Mode','Exposure','Light'])loc[key]=gl.getUniformLocation(program,'u'+key);
function b64(s){const p=atob(s),a=new Uint8Array(p.length);for(let i=0;i<p.length;i++)a[i]=p.charCodeAt(i);return a}
async function unpack(s,T){const stream=new Blob([b64(s)]).stream().pipeThrough(new DecompressionStream('gzip'));return new T(await new Response(stream).arrayBuffer())}
$('#loadingText').textContent='恢复固定三维曲面与相机参数…';
const [positions,normals,triangles,confidence,uvs]=await Promise.all([unpack(D.positions,Float32Array),unpack(D.normals,Float32Array),unpack(D.triangles,Uint32Array),unpack(D.confidence,Float32Array),unpack(D.uvs,Float32Array)]);
function attribute(name,data,size,usage=gl.STATIC_DRAW){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);const l=gl.getAttribLocation(program,name);if(l>=0){gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,0,0)}return b}
attribute('aPosition',positions,3);attribute('aNormal',normals,3);attribute('aConfidence',confidence,1);
const uvA=new Float32Array(D.vertices*2),uvB=new Float32Array(D.vertices*2),ba=attribute('aUvA',uvA,2,gl.DYNAMIC_DRAW),bb=attribute('aUvB',uvB,2,gl.DYNAMIC_DRAW);
const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,triangles,gl.STATIC_DRAW);
const edges=new Uint32Array(triangles.length*2);for(let i=0,j=0;i<triangles.length;i+=3){edges[j++]=triangles[i];edges[j++]=triangles[i+1];edges[j++]=triangles[i+1];edges[j++]=triangles[i+2];edges[j++]=triangles[i+2];edges[j++]=triangles[i]}
const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,edges,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.055,.063,.078,1);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
const state={angle:4.8,pitch:0,zoom:1,pan:[0,0],mode:0,exposure:1,wire:false,auto:false,light:-.7,view:'portrait',captureSource:'recovered-3D-surface',version:'r2-observed-surface'};
const textures=[];let changed=true,frame=0,ready=false,pair=[-1,-1];const maxAngle=D.maxCameraYawDeg;
for(let i=0;i<D.images.length;i++){
 $('#loadingText').textContent=`载入外观观测 ${i+1} / ${D.images.length}…`;
 const img=new Image();img.src=D.images[i];await img.decode();const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 if(innerWidth<650){const c=document.createElement('canvas');c.width=c.height=1280;c.getContext('2d').drawImage(img,0,0,1280,1280);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,c)}else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);textures.push(t)
}
const cameraAngles=D.camera.map(c=>Math.atan2(c.r[2],c.r[0])*180/Math.PI),imageAngles=D.appearanceFrames.map(f=>cameraAngles[D.camera.findIndex(c=>c.frame===f)]);
const linear=(a,b,t)=>a+(b-a)*t,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function interval(a,list){let i=0;while(i<list.length-2&&a>list[i+1])i++;return[i,clamp((a-list[i])/Math.max(1e-8,list[i+1]-list[i]),0,1)]}
function uploadPair(i){if(pair[0]===i)return;pair=[i,i+1];const n=D.vertices*2;uvA.set(uvs.subarray(i*n,(i+1)*n));uvB.set(uvs.subarray((i+1)*n,(i+2)*n));gl.bindBuffer(gl.ARRAY_BUFFER,ba);gl.bufferSubData(gl.ARRAY_BUFFER,0,uvA);gl.bindBuffer(gl.ARRAY_BUFFER,bb);gl.bufferSubData(gl.ARRAY_BUFFER,0,uvB)}
function resize(){const ratio=Math.min(devicePixelRatio||1,innerWidth<650?1.5:2);canvas.width=Math.round(stage.clientWidth*ratio);canvas.height=Math.round(stage.clientHeight*ratio);gl.viewport(0,0,canvas.width,canvas.height);changed=true}
function draw(){if(!ready)return;const [ci,ct]=interval(state.angle,cameraAngles),c0=D.camera[ci],c1=D.camera[ci+1],r=c0.r.map((v,k)=>linear(v,c1.r[k],ct)),t=c0.t.map((v,k)=>linear(v,c1.t[k],ct)),dx=r.slice(0,3),dy=r.slice(3),dz=[dx[1]*dy[2]-dx[2]*dy[1],dx[2]*dy[0]-dx[0]*dy[2],dx[0]*dy[1]-dx[1]*dy[0]];
 const [ti,tt]=interval(state.angle,imageAngles);uploadPair(ti);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[ti]);gl.uniform1i(loc.TextureA,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[ti+1]);gl.uniform1i(loc.TextureB,1);gl.uniform1f(loc.Blend,tt);
 gl.uniform3fv(loc.RowX,dx);gl.uniform3fv(loc.RowY,dy);gl.uniform3fv(loc.DepthRow,dz);gl.uniform2fv(loc.Offset,t);gl.uniform2fv(loc.Pan,state.pan);gl.uniform2f(loc.Viewport,canvas.width,canvas.height);gl.uniform1f(loc.Scale,Math.min(canvas.width/1110,canvas.height/1270)*state.zoom);gl.uniform1f(loc.Pitch,state.pitch*Math.PI/180);gl.uniform1f(loc.Mode,state.mode);gl.uniform1f(loc.Exposure,state.exposure);gl.uniform1f(loc.Light,state.light);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.drawElements(gl.TRIANGLES,triangles.length,gl.UNSIGNED_INT,0);
 if(state.wire){gl.disable(gl.DEPTH_TEST);gl.uniform1f(loc.Mode,2);gl.uniform1f(loc.Exposure,.65);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.drawElements(gl.LINES,edges.length,gl.UNSIGNED_INT,0);gl.enable(gl.DEPTH_TEST)}
 frame++;changed=false;$('#counter').textContent=`${state.angle.toFixed(1)}° / ${maxAngle.toFixed(1)}° · ${state.zoom.toFixed(2)}× · ${D.faces.toLocaleString()} 面`;
 $('#angle').value=state.angle;$('#pitch').value=state.pitch;$('#zoom').value=state.zoom;$('#angleValue').textContent=state.angle.toFixed(1)+'°';$('#pitchValue').textContent=state.pitch.toFixed(1)+'°';$('#zoomValue').textContent=state.zoom.toFixed(2)+'×';$('#status').textContent=state.mode===0?'保留原片照明 / 固定三维曲面':'几何诊断 / 不代表最终材质';window.__surface.frames=frame;
}
function update(p){Object.assign(state,p);changed=true}
function view(name){state.auto=false;$('#auto').classList.remove('active');state.view=name;const choices={portrait:{zoom:1,pan:[0,0]},skin:{zoom:2.7,pan:[-135,55]},eyes:{zoom:2.5,pan:[-70,-98]},mouth:{zoom:3.1,pan:[-88,192]},hair:{zoom:1.9,pan:[55,-290]}};update({...choices[name],pitch:0});document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name))}
function mode(m){update({mode:m});document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',+b.dataset.mode===m));$('#lightSection').hidden=m===0}
$('#angle').oninput=e=>update({angle:+e.target.value,auto:false});$('#pitch').oninput=e=>update({pitch:+e.target.value});$('#zoom').oninput=e=>update({zoom:+e.target.value});$('#light').oninput=e=>update({light:+e.target.value});$('#wire').onchange=e=>update({wire:e.target.checked});$('#angle').max=maxAngle;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(+b.dataset.mode));
$('#home').onclick=()=>{view('portrait');update({angle:4.8,wire:false,mode:0,exposure:1});$('#wire').checked=false;mode(0)};$('#auto').onclick=e=>{update({auto:!state.auto});e.currentTarget.classList.toggle('active',state.auto)};$('#controls').onclick=()=>$('#panel').classList.toggle('open');$('#close').onclick=()=>$('#panel').classList.remove('open');
let pointer=null;
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('pointercancel',()=>pointer=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;state.auto=false;if(pointer.button===2||e.shiftKey){const scale=Math.min(stage.clientWidth/1110,stage.clientHeight/1270)*state.zoom;state.pan=[state.pan[0]-dx/scale,state.pan[1]-dy/scale]}else{state.angle=clamp(state.angle-dx*.09,0,maxAngle);state.pitch=clamp(state.pitch+dy*.025,-3.5,3.5)}changed=true});
canvas.addEventListener('wheel',e=>{e.preventDefault();update({zoom:clamp(state.zoom*Math.exp(-e.deltaY*.001),.65,4)})},{passive:false});canvas.addEventListener('dblclick',()=>view('portrait'));
$('#save').onclick=()=>{const data={schema:'kaopu/observed-surface-view@2',state:{...state},limits:{relightable:false,full360:false,originalLightingPreserved:true},reference:D.source},a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download='Observed_Surface_R2_View.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
window.addEventListener('resize',resize);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#status').textContent='显卡上下文丢失，请刷新或关闭其他三维页面'});
let minZ=Infinity,maxZ=-Infinity;for(let i=2;i<positions.length;i+=3){minZ=Math.min(minZ,positions[i]);maxZ=Math.max(maxZ,positions[i])}
window.__surface={ready:false,version:'r2-observed-surface',state,draw,update,view,mode,canvas,gl,frames:0,stats:{vertices:D.vertices,triangles:D.faces,geometryDepthRange:maxZ-minZ,originalLightingPreserved:true,relightable:false,full360:false,usesVideoElement:false}};
ready=true;resize();draw();window.__surface.ready=true;$('#loading').hidden=true;
let last=performance.now(),phase=0;function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,(now-last)/1000);last=now;if(document.hidden)return;if(state.auto){phase+=dt*.24;state.angle=(.5+.5*Math.sin(phase))*maxAngle;changed=true}if(changed)draw()}requestAnimationFrame(loop);
})().catch(e=>{window.__surfaceErrors=window.__surfaceErrors||[];window.__surfaceErrors.push(String(e));document.querySelector('#loading').hidden=false;document.querySelector('#loadingText').textContent='渲染初始化失败：'+e;console.error(e)});
