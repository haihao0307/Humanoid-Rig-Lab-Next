/* Optional shader surface families; source mode remains unchanged.
 * Filtered shader relief is NOT fibre geometry or a calibrated yarn simulation.
 */
export function installSurface(T,material){
 const u={uDye:{value:new T.Color('#a97970')},uDyeAmount:{value:0},uSurface:{value:0},uWeave:{value:1.5},uGrain:{value:.35}};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,u);shader.vertexShader='varying vec3 vHatPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHatPoint=position;');
  const functions=`
 varying vec3 vHatPoint;
 uniform vec3 uDye;
 uniform float uDyeAmount,uSurface,uWeave,uGrain;
 float hfhash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float hfnoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hfhash(i),hfhash(i+vec3(1,0,0)),f.x),mix(hfhash(i+vec3(0,1,0)),hfhash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hfhash(i+vec3(0,0,1)),hfhash(i+vec3(1,0,1)),f.x),mix(hfhash(i+vec3(0,1,1)),hfhash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float hatFabric(vec3 p){
  vec3 q=p*(1000.0/max(uWeave,.1));
  float footprint=max(length(dFdx(q)),length(dFdy(q)));
  float bandlimit=1.0-smoothstep(.18,.8,footprint);
  float h=.0;
  if(uSurface<1.5){h=(hfnoise(q*1.8)-.5)*.4+(hfnoise(q*.47)-.5)*.5;}
  else if(uSurface<2.5){h=.3*sin(6.2831853*(q.x-q.y*.48))+.2*sin(6.2831853*q.y);}
  else{float row=fract(q.y),col=q.x+.12*sin(6.2831853*q.y);float arm=abs(fract(col)-.5);float loop=exp(-85.0*pow(arm-(.07+.29*sin(3.14159265*row)),2.0));h=loop*.6-.25;}
  return h*bandlimit;
 }
 `;
  shader.fragmentShader=functions+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float hatLum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb=mix(diffuseColor.rgb,uDye*clamp(pow(max(hatLum,0.0),.72)*1.45,.03,1.2),uDyeAmount);
   if(uSurface>.5){float weave=hatFabric(vHatPoint);vec3 base=uDyeAmount>.5?uDye:vec3(.34,.29,.24);diffuseColor.rgb=base*(.86+uGrain*weave*.36);}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   if(uSurface>.5){float h=hatFabric(vHatPoint)*uGrain*.00014;vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);vec3 R1=cross(q1,normal),R2=cross(normal,q0);float det=dot(q0,R1);vec3 gradient=sign(det)*(dFdx(h)*R1+dFdy(h)*R2);normal=normalize(abs(det)*normal-gradient);}
  `);
 };
 material.customProgramCacheKey=()=> 'hat-r03-filtered-procedural-surface-1';return u;
}
export function updateSurface(u,s,COLORS){u.uSurface.value={source:0,wool:1,twill:2,knit:3}[s.textureMode];u.uWeave.value=s.weaveMM;u.uGrain.value=s.grainStrength;u.uDyeAmount.value=s.useCustomColor||s.dye!=='original'?1:0;u.uDye.value.set(s.useCustomColor?s.customColor:(COLORS[s.dye]||'#a97970'));}
