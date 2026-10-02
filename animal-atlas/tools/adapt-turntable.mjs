// Adapt snapshots at build time; original animal HTML stays untouched.
export function adaptTurntable(html,key){
 const replace=(from,to)=>{if(!html.includes(from))throw Error('Turntable hook missing: '+key+' / '+from.slice(0,90));html=html.replace(from,to);};
 const uniforms='uniform vec3 uAtlasLightDirection;uniform float uAtlasKey,uAtlasAmbient,uAtlasExposure,uAtlasRim;';
 if(key==='fish'){
  replace('globalThis.AtlasFishHabitat?.draw(gl,m,this.state);',"if(!AtlasTurntable.rawDraw(gl,m,{radius:this.state.school?3.5:.6,floorY:this.state.school?-1.7:-.18,center:[0,0]}))globalThis.AtlasFishHabitat?.draw(gl,m,this.state);");
  replace('uniform float uAtlasDensity;', 'uniform float uAtlasDensity;'+uniforms);
  replace('vec3 L=normalize(vec3(-.4,.75,.8))','vec3 L=normalize(uAtlasLightDirection)');
  replace('base*(.38+.58*diff+.22*fill)', 'base*(.38*uAtlasAmbient+.58*diff*uAtlasKey+.22*fill*uAtlasRim)');
  replace('outColor=vec4(toSRGB(clamp(lit,0.,1.)),1);', 'outColor=vec4(toSRGB(clamp(lit*uAtlasExposure,0.,1.)),1);');
  replace("gl.uniform1i(u('uAtlasEnvironment'),this.state.environment===false?0:1);", "AtlasTurntable.rawLight(gl,program,{view:m.view});gl.uniform1i(u('uAtlasEnvironment'),this.state.environment===false||AtlasTurntable.isActive()?0:1);");
 }
 if(key==='cat-v440'){
  replace('AtlasBeach.drawRaw(gl,window.__ATLAS_CAT_CAMERA_MATRICES__);',"const atlasRoot=window.__CAT_V440_METRICS__?.rootPosition||[0,0,0];if(!AtlasTurntable.rawDraw(gl,{...window.__ATLAS_CAT_CAMERA_MATRICES__,zUp:true},{radius:.42,floorY:-.005,center:[atlasRoot[0],-atlasRoot[1]]}))AtlasBeach.drawRaw(gl,window.__ATLAS_CAT_CAMERA_MATRICES__);");
  replace('uniform float uWeightMode;uniform float uCorrectiveDebug;', uniforms+'uniform float uWeightMode;uniform float uCorrectiveDebug;');
  replace('l1=normalize(vec3(.45,-.55,.82))', 'l1=normalize(uAtlasLightDirection)');
  replace('max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19','max(dot(n,l1),0.)*.70*uAtlasKey+max(dot(n,l2),0.)*.24*uAtlasRim+.19*uAtlasAmbient');
  replace('outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);','outColor=vec4(pow(max(col*uAtlasExposure,vec3(0.)),vec3(1./2.2)),1.);');
  replace('gl.useProgram(pr);gl.bindVertexArray(meshVao);gl.uniformMatrix4fv(U.pv', "gl.useProgram(pr);AtlasTurntable.rawLight(gl,pr,{zUp:true});gl.bindVertexArray(meshVao);gl.uniformMatrix4fv(U.pv");
  replace('window.__ATLAS_CAT_MESH__=', 'window.__ATLAS_CAT_GL__=gl;window.__ATLAS_CAT_ORBIT=(delta,elevation=0)=>{az+=delta;el=Math.max(-1.48,Math.min(1.48,el+elevation));};window.__ATLAS_CAT_MESH__=');
 }
 if(key==='eagle'){
  replace('return{eye:e,vp:mm(persp(this.species.camera.fov,r,.01,30),look(e,this.center))}', 'const projection=persp(this.species.camera.fov,r,.01,30),view=look(e,this.center);return{eye:e,vp:mm(projection,view),projection,view}');
  replace('let {eye,vp}=this.camera();','let atlasCamera=this.camera(),{eye,vp}=atlasCamera;');
  replace('gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.prog);', 'gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);AtlasTurntable.rawDraw(gl,atlasCamera,{radius:.57,floorY:-.04,center:[0,0]});gl.useProgram(this.prog);AtlasTurntable.rawLight(gl,this.prog);');
  replace('uniform vec3 uEye;uniform int uMode;', uniforms+'uniform vec3 uEye;uniform int uMode;');
  replace('vec3 L=normalize(vec3(.35,.70,.60))','vec3 L=normalize(uAtlasLightDirection)');
  replace('gl_FragColor=vec4(col,1.);', 'gl_FragColor=vec4(clamp(col*uAtlasExposure*(.55*uAtlasKey+.35*uAtlasAmbient+.1*uAtlasRim),0.,1.),1.);');
 }
 if(key==='chicken')replace('window.__ATLAS_CHICKEN_MESHES=', 'window.__ATLAS_CHICKEN_STAGE={T,scene,renderer,camera};window.__ATLAS_CHICKEN_MESHES=');
 return html;
}
