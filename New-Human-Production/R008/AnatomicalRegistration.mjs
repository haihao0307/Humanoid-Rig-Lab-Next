import {ANATOMICAL_LANDMARKS as ATLAS} from './AnatomicalLandmarks.mjs';
import {add,sub,mul,dot,length,unit,cross} from './AnatomyMath.mjs';
const SOURCE_AXES=[[1,0,0],[0,1,0],[0,0,1]];
const central=['pelvis','spineLower','spineMiddle','chest','neck','head'];
const mean=(a,b)=>mul(add(a,b),.5);
const pos=(profile,role)=>profile.joints[profile.roles[role]]?.position;
function axisFrame(a,b,front){const y=unit(sub(b,a));let x=unit(cross(y,front));if(length(x)<.5)x=unit(cross(y,[1,0,0]));return [x,y,unit(cross(x,y))];}
function affine(sourceOrigin,targetOrigin,sourceAxes,targetAxes,scales){
 const M=new Array(16).fill(0);M[15]=1;
 for(let col=0;col<3;col++)for(let row=0;row<3;row++)M[col*4+row]=sourceAxes.reduce((sum,a,k)=>sum+a[col]*scales[k]*targetAxes[k][row],0);
 for(let row=0;row<3;row++)M[12+row]=targetOrigin[row]-sourceOrigin.reduce((s,v,k)=>s+M[k*4+row]*v,0);
 return M;
}
export function transformAnatomicalPoint(point,matrix){return [0,1,2].map(r=>matrix[12+r]+point.reduce((s,v,c)=>s+matrix[c*4+r]*v,0));}
function palmNormal(roles,side,front){const p=unit(cross(sub(roles['index_1_'+side],roles['pinky_1_'+side]),sub(roles['middle_1_'+side],roles['hand_'+side])));return p;}
export function registerAnatomicalAtlas(profile,metadata){
 if(!profile.canDeform||!profile.frame)throw Error('Anatomical atlas requires unambiguous candidate landmarks');
 const missing=Object.keys(ATLAS.roles).filter(role=>!Number.isInteger(profile.roles[role]));if(missing.length)throw Error('Anatomical registration needs reviewed landmarks: '+missing.join(', '));
 const source=ATLAS.roles,target=Object.fromEntries(Object.keys(source).map(role=>[role,pos(profile,role)])),f=profile.frame,targetAxes=[f.right,f.up,f.front],heightScale=f.height/ATLAS.height;
 const shoulderScale=length(sub(target.upperarm_l,target.upperarm_r))/length(sub(source.upperarm_l,source.upperarm_r)),hipScale=length(sub(target.thigh_l,target.thigh_r))/length(sub(source.thigh_l,source.thigh_r));
 const sourceHips=mean(source.thigh_l,source.thigh_r),targetHips=mean(target.thigh_l,target.thigh_r);
 const sourcePalms=Object.fromEntries(['l','r'].map(s=>[s,palmNormal(source,s,[0,0,1])])),targetPalms=Object.fromEntries(['l','r'].map(s=>[s,palmNormal(target,s,f.front)]));
 function segment(a,b,{sourceA=source[a],sourceB=source[b],targetA=target[a],targetB=target[b],hand=false,side='l'}={}){
  if(!sourceA||!sourceB||!targetA||!targetB)throw Error('Missing anatomical registration endpoints '+a+' / '+b);
  const axialScale=length(sub(targetB,targetA))/length(sub(sourceB,sourceA)),radialScale=hand?Math.sqrt(axialScale*heightScale):heightScale;
  return {matrix:affine(sourceA,targetA,axisFrame(sourceA,sourceB,hand?sourcePalms[side]:[0,0,1]),axisFrame(targetA,targetB,hand?targetPalms[side]:f.front),[radialScale,axialScale,radialScale]),scale:[radialScale,axialScale,radialScale],ownerRole:a};
 }
 function centralMap(sourceHeight){
  let i=0;while(i<central.length-2&&sourceHeight>source[central[i+1]][1])i++;
  const a=central[i],b=central[i+1],S=source[a],E=source[b],T=target[a],U=target[b],span=E[1]-S[1],t=(sourceHeight-S[1])/span,sourceOrigin=add(S,mul(sub(E,S),t)),targetOrigin=add(T,mul(sub(U,T),t));
  const upScale=length(sub(U,T))/length(sub(E,S)),scale=[shoulderScale,upScale,Math.sqrt(heightScale*shoulderScale)];
  return {matrix:affine(sourceOrigin,targetOrigin,SOURCE_AXES,targetAxes,scale),scale,ownerRole:a};
 }
 const maps=metadata.bones.map(bone=>{
  const name=bone.name,side=bone.side==='left'?'l':bone.side==='right'?'r':null,suffix=side?'_'+side:'',centroid=bone.centroidMm||bone.sourceCentroidMm||bone.originMm;
  let map;
  if(/humerus$/.test(name))map=segment('upperarm'+suffix,'lowerarm'+suffix);
  else if(/(radius|ulna)$/.test(name))map=segment('lowerarm'+suffix,'hand'+suffix);
  else if(/femur$/.test(name))map=segment('thigh'+suffix,'calf'+suffix);
  else if(/(tibia|fibula)$/.test(name))map=segment('calf'+suffix,'foot'+suffix);
  else if(/patella$/.test(name)){map=segment('thigh'+suffix,'calf'+suffix);map.ownerRole='thigh'+suffix;}
  else if(/clavicle$/.test(name))map=segment('clavicle'+suffix,'upperarm'+suffix);
  else if(/scapula$/.test(name)){map={matrix:affine(source['upperarm'+suffix],target['upperarm'+suffix],SOURCE_AXES,targetAxes,[shoulderScale,heightScale,heightScale]),scale:[shoulderScale,heightScale,heightScale],ownerRole:'clavicle'+suffix};}
  else if(/hip bone$/.test(name)||name==='sacrum')map={matrix:affine(sourceHips,targetHips,SOURCE_AXES,targetAxes,[hipScale,heightScale,heightScale]),scale:[hipScale,heightScale,heightScale],ownerRole:'pelvis'};
  else if(/(finger|thumb)/.test(name)){
   const digit=name.includes('thumb')?'thumb':name.includes('index')?'index':name.includes('middle finger')?'middle':name.includes('ring')?'ring':'pinky',number=name.startsWith('proximal')?(digit==='thumb'?2:1):name.startsWith('middle')?2:3,role=digit+'_'+number+suffix,next=digit+'_'+(number+1)+suffix;
   if(number<3)map=segment(role,next,{hand:true,side});
   else{const previous=digit+'_2'+suffix,sourceA=source[role],sourceB=ATLAS.tips[digit+suffix],targetA=target[role],direction=unit(sub(target[role],target[previous])),ratio=length(sub(target[role],target[previous]))/length(sub(source[role],source[previous])),targetB=add(targetA,mul(direction,length(sub(sourceB,sourceA))*ratio));map=segment(role,null,{sourceA,sourceB,targetA,targetB,hand:true,side});}
  }else if(/first metacarpal/.test(name))map=segment('thumb_1'+suffix,'thumb_2'+suffix,{hand:true,side});
  else if(/metacarpal/.test(name)){const ordinal=name.match(/(second|third|fourth|fifth)/)?.[1],digit=({second:'index',third:'middle',fourth:'ring',fifth:'pinky'})[ordinal],role=digit+'_1'+suffix,sourceA=ATLAS.metacarpalBases[digit+suffix],palm=segment('hand'+suffix,'middle_1'+suffix,{hand:true,side}),targetA=transformAnatomicalPoint(sourceA,palm.matrix);map=segment('hand'+suffix,role,{sourceA,sourceB:source[role],targetA,targetB:target[role],hand:true,side});}
  else if(bone.region==='hand'||bone.region==='hands')map=segment('hand'+suffix,'middle_1'+suffix,{hand:true,side});
  else if(bone.region==='foot'||bone.region==='feet'){map=segment('foot'+suffix,'ball'+suffix);if(/phalanx/.test(name))map.ownerRole='ball'+suffix;}
  else if(bone.region==='skull_neck'&&name!=='hyoid bone'){
   const targetTop=f.top+dot(f.origin,f.up),headHeight=targetTop-dot(target.head,f.up),sourceHeight=ATLAS.top-source.head[1],vertical=headHeight/sourceHeight;
   map={matrix:affine(source.head,target.head,SOURCE_AXES,targetAxes,[heightScale,vertical,heightScale]),scale:[heightScale,vertical,heightScale],ownerRole:'head'};
  }else{map=centralMap(centroid[2]*.001);if(/rib|sternum|manubrium|xiphoid/.test(name))map.ownerRole='chest';}
  if(!Number.isInteger(profile.roles[map.ownerRole]))throw Error('Unmapped anatomical owner: '+name+' / '+map.ownerRole);
  return {id:bone.id||bone.sourceMeshId,name,side:bone.side,region:bone.region,...map,boneId:profile.roles[map.ownerRole],evidence:'licensed-atlas-morphology; surface-candidate-registration-estimate',sourceLandmarks:ATLAS.schema};
 });
 return {schema:'human/anatomical-atlas-registration@1',source:ATLAS.source,atlasHeight:ATLAS.height,subjectHeight:f.height,bones:maps,controlJoints:profile.joints.length,boneIdentityFrozen:true,unknown:['individual-bone-shape','functional-joint-centres','cartilage','true-muscle-attachment-sites','scapulothoracic-and-patellar-tracking'],evidence:ATLAS.evidence};
}
