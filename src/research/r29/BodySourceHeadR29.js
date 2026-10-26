/* Source head-boundary scalar expressions only. The independent head board is
 * untouched. No head surface, head geometry or character display is produced. */
(()=>{'use strict';
function evaluate(program,state,pose){
 if(program.schema!=='body-source-head-boundary-functions-r29/1')throw Error('原头颈输入函数版本不匹配');
 const transforms=BodyPoseFunctionsR29.matrices(program.poseProgram,pose),posed=transforms.originalPoseMatrices;if(program.driver!=='mhr-no-correctives'&&!posed)throw Error('原头颈关节主链未能求值');
 const skin=program.driver==='mhr-no-correctives'?program.headRigRest.map((m,j)=>program.headMatrixDispatch[j]>=0?transforms[program.headMatrixDispatch[j]].slice():BodyMathR01.mul(m,BodyMathR01.rigidInverse(m))):posed.map((m,j)=>BodyMathR01.mul(m,BodyMathR01.rigidInverse(program.headRigRest[j]))),values=new Float64Array(program.ops.length),{ops,a,b,constants,roots}=program;
 for(let i=0;i<ops.length;i++){const x=values[a[i]],y=values[b[i]];switch(ops[i]){case 0:values[i]=constants[i];break;case 2:values[i]=x+y;break;case 4:values[i]=x*y;break;case 7:values[i]=Math.fround(x);break;case 13:values[i]=skin[a[i]][b[i]];break;default:throw Error('未知头颈标量指令');}if(!Number.isFinite(values[i]))throw Error('原头颈输入函数未解出');}
 const packet={...structuredClone(program.referencePacket),sourceState:structuredClone(state),headPositions:Array.from(roots,i=>values[i]),neckSkinMatrix:skin[program.neckJoint].slice()};return{packet,skin,transforms,headSurfaceGenerated:false};
}
globalThis.BodySourceHeadR29={evaluate};
})();
