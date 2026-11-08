// Existing photo-female-001 appearance functions; copied without a CPU renderer.
function finiteRestNormal(source){const s='vec3 psRestN=normalize(cross(dFdx(psMM),dFdy(psMM)));';if(source.split(s).length!==2)throw Error('Normal hook changed');return source.replace(s,'vec3 psRestCross=cross(dFdx(psMM),dFdy(psMM));vec3 psRestN=dot(psRestCross,psRestCross)>1e-14?normalize(psRestCross):normalize(nativeNormal.xyz);');}
export function femaleSurface(source){
 const declaration='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;',entry='if(u_nativeMode==1){';
 if(source.split(declaration).length!==2||source.split(entry).length!==2)throw Error('Skin colour hook changed');
 return finiteRestNormal(source).replace(declaration,'uniform float femBrow,femLipTint;\n'+declaration).replace(entry,`
 float femX=abs(psMM.x),femT=clamp((femX-16.5)/38.,0.,1.);
 float femY=327.+3.0*sin(3.14159265*femT)-2.8*femT;
 float femWidth=mix(3.1,1.5,femT);
 float femNoise=psNoise(vec3(femX*1.30,(psMM.y-femY)*2.4+femX*.34,1.7));
 float femEdge=abs(psMM.y-femY)/femWidth + .12*(femNoise-.5);
 float femEnvelope=smoothstep(16.,20.,femX)*(1.-smoothstep(49.,55.,femX))*(1.-smoothstep(.52,1.33,femEdge))*smoothstep(75.,100.,psMM.z);
 float femHair=0.,femFoot=max(max(fwidth(femX),fwidth(psMM.y)),.035),sideSeed=psMM.x<0.?13.:47.;
 vec2 femCoord=vec2(femX,psMM.y-femY),femCell=floor(femCoord/vec2(.9,1.15));
 for(int j=-2;j<=2;j++)for(int k=-2;k<=2;k++){
  vec2 id=femCell+vec2(float(j),float(k));float h=psHash(vec3(id,sideSeed+21.)),h2=psHash(vec3(id,sideSeed+77.));
  vec2 root=(id+vec2(.08+.84*h,.08+.84*h2))*vec2(.9,1.15),v=femCoord-root;
  float lengthMM=.8+1.5*psHash(vec3(id,sideSeed+35.)),angle=.20+1.05*psHash(vec3(id,sideSeed+53.));
  vec2 axis=normalize(vec2(1.,angle));float along=dot(v,axis),distance=abs(dot(v,vec2(-axis.y,axis.x)));
  float strand=(1.-smoothstep(.03,.03+femFoot,distance))*(1.-smoothstep(lengthMM*.55,lengthMM,abs(along)))*step(.30,psHash(vec3(id,sideSeed+91.)));
  femHair=max(femHair,strand);
 }
 float femPigment=clamp(femBrow*femEnvelope*(.18+.67*femHair),0.,.80);
 material.diffuseColor=mix(material.diffuseColor,vec3(.060,.037,.029),femPigment);
 material.diffuseColor*=mix(vec3(1.),vec3(1.01,.61,.78),clamp(psL*femLipTint,0.,1.));
 `+entry);
}
