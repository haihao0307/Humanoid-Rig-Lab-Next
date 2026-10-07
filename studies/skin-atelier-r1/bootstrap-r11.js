/* R1.1 experiment overlay. The original R1 generator is retained unchanged.
 * Every source replacement is asserted exactly once; drift fails visibly.
 * This is a temporary, readable migration, not an opaque prebuilt asset.
 * Offline distribution can materialize the same patch list at build time.
 */
window.__atelierPatches=[];
try {
 const response=await fetch(new URL('./atelier.js',import.meta.url));
 if(!response.ok)throw Error('无法读取生成器源码：'+response.status);
 let source=await response.text();
 function replace(id,from,to){const count=source.split(from).length-1;if(count!==1)throw Error('R1.1 源码版本不匹配：'+id+' ('+count+')');source=source.replace(from,to);window.__atelierPatches.push(id)}
 replace('signed-gaussian','float ga(float x,float s){return exp(-pow(x/s,2.));}','float ga(float x,float s){float q=x/s;return exp(-q*q);}');
 replace('physical-bump','float hh=skinH(vAnatomy);normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(hh),dFdy(hh)),faceDirection);','float hh=skinH(vAnatomy);vec3 dpdx=dFdx(-vViewPosition),dpdy=dFdy(-vViewPosition);vec3 R1=cross(dpdy,normal),R2=cross(normal,dpdx);float det=dot(dpdx,R1)*faceDirection;vec3 grad=sign(det)*(dFdx(hh)*R1+dFdy(hh)*R2);normal=normalize(max(abs(det),1.e-12)*normal-grad);');
 replace('lid-edge-tangent','en=Math.sin(PI*t);let z=','en=Math.sin(PI*t)**2;let z=');
 replace('shadow-apertures',"headMesh.name='continuous_head_neck_skin';",`headMesh.name='continuous_head_neck_skin';
 const depthSkin=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 depthSkin.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\\nvarying vec3 vSkinShadow;').replace('#include <begin_vertex>','#include <begin_vertex>\\nvSkinShadow=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\\nvarying vec3 vSkinShadow;').replace('void main() {','void main() { vec3 p=vSkinShadow; if(p.z>0.){ float q=min(length(vec2((p.x-3.1)/1.98,(p.y-2.1)/1.37)),length(vec2((p.x+3.1)/1.98,(p.y-2.1)/1.37))); if(q<.985)discard; float nt=min(length(vec2((p.x-.81)/.30,(p.y+1.50)/.145)),length(vec2((p.x+.81)/.30,(p.y+1.50)/.145))); if(nt<.88&&p.z>5.)discard; }');};headMesh.customDepthMaterial=depthSkin;`);
 replace('shader-failure-guard','const scene=new THREE.Scene(),camera=',"renderer.debug.onShaderError=(gl,program,vs,fs)=>{throw Error('着色器编译失败：'+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(fs))};\nconst scene=new THREE.Scene(),camera=");
 replace('dirty-state','let frame=0,rotatingLight','let dirty=true;const invalidate=()=>{dirty=true};\nlet frame=0,rotatingLight');
 replace('camera-dirty','function updateCamera(){camera.position','function updateCamera(){dirty=true;camera.position');
 replace('slider-dirty','uniform.value=Number(e.target.value);','dirty=true;uniform.value=Number(e.target.value);');
 replace('view-mode-dirty','globals.mode.value=+b.dataset.mode;','dirty=true;globals.mode.value=+b.dataset.mode;');
 replace('light-dirty','function lighting(name){key.intensity','function lighting(name){dirty=true;key.intensity');
 replace('color-dirty','function hairColor(silver){darkHairMat','function hairColor(silver){dirty=true;darkHairMat');
 replace('toggles-dirty',"$('#hairToggle').onchange=e=>hairGroup.visible=e.target.checked;$('#lashToggle').onchange=e=>lashGroup.visible=e.target.checked;$('#fuzzToggle').onchange=e=>fuzzGroup.visible=e.target.checked;$('#corneaToggle').onchange=e=>{","$('#hairToggle').onchange=e=>{dirty=true;hairGroup.visible=e.target.checked};$('#lashToggle').onchange=e=>{dirty=true;lashGroup.visible=e.target.checked};$('#fuzzToggle').onchange=e=>{dirty=true;fuzzGroup.visible=e.target.checked};$('#corneaToggle').onchange=e=>{dirty=true;");
 replace('public-invalidation','view,lighting,hairColor,stats:','view,lighting,hairColor,invalidate,stats:');
 const old=source.slice(source.indexOf('function animate(now)'),source.lastIndexOf('} catch(e){fail(e)}'));
 if(!old.startsWith('function animate(now)'))throw Error('动画循环定位失败');
 replace('on-demand-loop',old,`function animate(now){requestAnimationFrame(animate);const elapsed=Math.max(.001,(now-last)/1000),dt=Math.min(.05,elapsed);last=now;if(document.hidden)return;if(turning){yaw+=dt*.16;updateCamera()}if(rotatingLight){const a=now*.00025;key.position.set(Math.sin(a)*30,18,Math.cos(a)*30);globals.key.value.copy(key.position);dirty=true}if(!dirty)return;renderer.render(scene,camera);dirty=false;frame++;fps=mix(fps,1/elapsed,.15);$('#meter').textContent=turning||rotatingLight?'WebGL2 · '+Math.round(fps)+' FPS · R1.1':'WebGL2 · 按需渲染 / 静止不重绘 · R1.1';window.__atelier.frames=frame}requestAnimationFrame(animate);
`);
 source=source.replaceAll("'r1-candidate'","'r1.1-candidate'");
 window.__atelierCompiledSource=source;
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{await import(url)}finally{URL.revokeObjectURL(url)}
} catch(error){window.__atelierErrors=window.__atelierErrors||[];window.__atelierErrors.push(String(error));document.querySelector('#loading').classList.remove('hidden');document.querySelector('#status').textContent=String(error);document.querySelector('#status').classList.add('error');console.error(error);}
