// Uses Separable SSS. Copyright (C) 2012 Jorge Jimenez and Diego Gutierrez.
// Modified GLSL pipeline; see THIRD_PARTY.txt for the required license.
function diffusionKernel(){
 const center=[.530605,.613514,.739601,0];
 const half=[[.000973794,.0000111862,.000000943437,3],[.00333804,.0000785443,.000012945,2.52083],[.00500364,.00020094,.0000528848,2.08333],[.00700976,.00049366,.000151938,1.6875],[.0094389,.00139119,.000416598,1.33333],[.0128496,.00356329,.00132016,1.02083],[.017924,.00711691,.00347194,.75],[.0263642,.0119715,.00684598,.520833],[.0410172,.0199899,.0118481,.333333],[.0493588,.0367726,.0219485,.1875],[.0402784,.0657244,.04631,.0833333],[.0211412,.0459286,.0378196,.0208333]];
 return [new THREE.Vector4(...center),...half.map(v=>new THREE.Vector4(v[0],v[1],v[2],-v[3])),...half.map(v=>new THREE.Vector4(...v))];
}
function initEntry(){
 entryRT=new THREE.WebGLRenderTarget(2048,2048,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
 entryCamera=new THREE.OrthographicCamera(-.23,.23,.23,-.23,.01,2);
 entryMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
 entryMaterial.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{uSurface:E.uSurface,uRelief:E.uRelief,uBaseline:U.uBaseline});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform sampler2D uSurface;uniform float uRelief,uBaseline;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001*(1.-uBaseline);');
 };
 mesh.customDepthMaterial=entryMaterial;E.uKeyDepth.value=entryRT.texture;
}
function renderEntry(){
 if(!entryDirty)return;
 entryCamera.position.copy(key.position);entryCamera.lookAt(key.target.position);entryCamera.updateMatrixWorld();entryCamera.updateProjectionMatrix();
 E.uKeyVP.value.multiplyMatrices(entryCamera.projectionMatrix,entryCamera.matrixWorldInverse);
 E.uKeyDirection.value.copy(key.position).sub(key.target.position).normalize();
 E.uKeyEnergy.value.copy(key.color).multiplyScalar(key.intensity);
 const bg=scene.background,cc=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),fv=fuzz.visible,ss=renderer.shadowMap.enabled;
 scene.background=null;fuzz.visible=false;scene.overrideMaterial=entryMaterial;renderer.shadowMap.enabled=false;
 renderer.setClearColor(0xffffff,1);renderer.setRenderTarget(entryRT);renderer.clear();renderer.render(scene,entryCamera);
 scene.overrideMaterial=null;scene.background=bg;fuzz.visible=fv;renderer.setClearColor(cc,alpha);renderer.shadowMap.enabled=ss;entryDirty=false;
}
