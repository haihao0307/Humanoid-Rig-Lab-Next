import {headSkinAnatomyGLSL} from '../../material/HeadSkinAnatomy.mjs';

// Structure-guided appearance deltas around this candidate's existing colour.
// Not measured concentrations, histological boundaries or a new surface.
export function skinSystemTissueFragment(source,{hasProjection=true}={}){
 const declaration='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;';
 const entry='if(u_nativeMode==1){';
 const output='gl_FragColor = linearToOutputTexel( gl_FragColor );';
 for(const anchor of [declaration,entry,output])if(source.split(anchor).length!==2)throw Error('组织区域挂接接口改变：'+anchor);
 const uniforms=`uniform float stEyePigment,stNoseBlood,stEarBlood,stPerioral,stLipPigment,stLipBlood,stView;
 vec3 stDiagnostic=vec3(0.);
 ${headSkinAnatomyGLSL()}`;
 const hook=`
 if(abs(stEyePigment)+abs(stNoseBlood)+abs(stEarBlood)+abs(stPerioral)+abs(stLipPigment)+abs(stLipBlood)>.000001||stView>.5){
  SkinAnatomy stA=skinAnatomyAt(psMM,normalize(psRestN),vLidMargin,psLipFeather,lidGate,psE,psFoot);
  float stWet=clamp(lidGate,0.,1.)*fbHead;
  float stLip=clamp(psLipFeather,0.,1.)*(1.-clamp(ni(17),0.,1.))*fbHead;
  float stOrdinary=(1.-clamp(psLipFeather,0.,1.))*(1.-clamp(lidGate,0.,1.))*fbHead;
  float stEye=stA.orbital*stOrdinary,stNose=stA.ala*stOrdinary,stEar=clamp(psE,0.,1.)*stOrdinary,stPeri=stA.perioral*stOrdinary;
  vec3 stDepth=vec3(.16,.20,.25)*(stEyePigment*stEye+stPerioral*stPeri)
    +vec3(.015,.48,.30)*.45*(stNoseBlood*stNose+stEarBlood*stEar)
    +vec3(.42,.64,.84)*.20*stLipPigment*stLip+vec3(.012,.20,.12)*.45*stLipBlood*stLip;
  if(${hasProjection?'femProjection<.5':'true'})material.diffuseColor*=exp(-stDepth);
  if(stView<1.5)stDiagnostic=vec3(stLip,stWet,stOrdinary);
  else if(stView<2.5)stDiagnostic=vec3(stNose,stEye,stEar);
  else stDiagnostic=vec3(stA.eyelid*stOrdinary,stPeri,stLip);
 }
 `;
 return source.replace(declaration,uniforms+'\n'+declaration)
  .replace(entry,hook+entry)
  .replace(output,output+'\nif(u_nativeMode==0&&stView>.5)gl_FragColor=vec4(sceneEncode(stDiagnostic),1.);');
}
