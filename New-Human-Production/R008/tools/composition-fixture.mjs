import {analyzeHumanoid} from '../AnatomyAnalysis.mjs';
import {createCompositionProfile,createCompositionFields} from '../BodyComposition.mjs';
import {HUMAN_SPECIES_ID} from '../HumanBodySpecies.mjs';
import {sub,add,mul,length,unit,cross} from '../AnatomyMath.mjs';
export function compositionFixture({transform=p=>p,scale=1,armLength=1,sourceId='test-human'}={}){
 const joints=[['pelvis',null,[0,1,0]],['spine_01','pelvis',[0,1.15,0]],['spine_02','spine_01',[0,1.3,0]],['spine_03','spine_02',[0,1.45,0]],['neck_01','spine_03',[0,1.55,0]],['head','neck_01',[0,1.7,0]],...['l','r'].flatMap(s=>{const x=s==='l'?1:-1;return [['clavicle_'+s,'spine_03',[.1*x,1.48,0]],['upperarm_'+s,'clavicle_'+s,[.2*x,1.45,0]],['lowerarm_'+s,'upperarm_'+s,[.2*x+.1*x*armLength,1.45-.3*armLength,0]],['hand_'+s,'lowerarm_'+s,[.2*x+.2*x*armLength,1.45-.55*armLength,0]],['thigh_'+s,'pelvis',[.1*x,.95,0]],['calf_'+s,'thigh_'+s,[.12*x,.5,0]],['foot_'+s,'calf_'+s,[.12*x,.08,0]],['ball_'+s,'foot_'+s,[.12*x,.02,.1]]];})].map(([name,parent,position])=>({name,parent,position:transform(position.map(v=>v*scale))}));
 const calibration={schema:'human/composition-calibration@1',species:HUMAN_SPECIES_ID,sourceId,status:'candidate',referenceAge:32,protectedFeatures:[],protectedMaterials:[],regions:{}};
 const initial=analyzeHumanoid({joints,sourceId}),draft=createCompositionProfile(initial,calibration),points=[],indices=[],weights=[],areaIds=[];
 for(let id=0;id<draft.areas.length;id++){
  const a=draft.areas[id],axis=unit(sub(a.end,a.start));let u=cross(axis,initial.frame.front);if(length(u)<.1)u=cross(axis,initial.frame.right);u=unit(u);const v=unit(cross(axis,u)),radius=initial.frame.height*(a.spec.id==='head'?.04:a.spec.id==='hand'||a.spec.id==='foot'?.018:['thorax','abdomen'].includes(a.spec.id)?.075:.028);
  const bone=initial.roles[a.sourceRole];for(let k=0;k<12;k++)for(let t=0;t<16;t++){const theta=t/16*Math.PI*2,p=add(add(a.start,mul(sub(a.end,a.start),(k+.5)/12)),add(mul(u,radius*Math.cos(theta)),mul(v,radius*Math.sin(theta))));points.push(...p);indices.push(0,0,0,0,0,0,0,bone);weights.push(0,0,0,0,0,0,0,1);areaIds.push(id);}
 }
 const positions=new Float32Array(points),skinIndex=new Uint16Array(indices),skinWeight=new Float32Array(weights),anatomy=analyzeHumanoid({joints,sourceId,positions,skinIndex,skinWeight}),profile=createCompositionProfile(anatomy,calibration),fields=createCompositionFields({positions,skinIndex,skinWeight,anatomy,profile});
 return {joints,positions,skinIndex,skinWeight,anatomy,profile,fields,areaIds,calibration};
}
