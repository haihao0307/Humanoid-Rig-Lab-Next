/* Smooth preview between evaluated body function states. The character remains
 * a direct ray-intersected function surface; no mesh or connectivity is made.
 * On pause the ordinary full evaluator restores the exact requested pose. */
(()=>{'use strict';
function createClip(samples){
 if(!Array.isArray(samples)||samples.length<2||samples.length>17)throw Error('动作样本数量无效');
 const first=samples[0],count=first.program.functions,n=count*6;
 if(!first.program.orientation||first.program.orientation.length!==count||!first.animationBoxes||first.animationBoxes.length!==n)throw Error('动作表面范围不完整');
 const boxes=new Float64Array(first.animationBoxes),ids=first.ids.slice(),nodes=first.nodes.map(x=>({...x,lo:x.lo.slice(),hi:x.hi.slice()}));
 for(const frame of samples){if(frame.program.functions!==count||frame.animationBoxes?.length!==n||frame.coefficients.length!==count*9||frame.normals.length!==count*9)throw Error('动作样本与当前身体不匹配');for(let i=0;i<n;i+=6)for(let k=0;k<3;k++){boxes[i+k]=Math.min(boxes[i+k],frame.animationBoxes[i+k]);boxes[i+3+k]=Math.max(boxes[i+3+k],frame.animationBoxes[i+3+k]);}}
 for(let i=nodes.length-1;i>=0;i--){const node=nodes[i];if(node.left<0){node.lo=[Infinity,Infinity,Infinity];node.hi=[-Infinity,-Infinity,-Infinity];for(let j=node.start;j<node.end;j++){const p=ids[j]*6;for(let k=0;k<3;k++){node.lo[k]=Math.min(node.lo[k],boxes[p+k]);node.hi[k]=Math.max(node.hi[k],boxes[p+3+k]);}}}else{const a=nodes[node.left],b=nodes[node.right];for(let k=0;k<3;k++){node.lo[k]=Math.min(a.lo[k],b.lo[k]);node.hi[k]=Math.max(a.hi[k],b.hi[k]);}}}
 return{schema:'body-motion-preview-r37/1',program:{functions:count,domains:first.program.domains,orientation:first.program.orientation},frames:samples.map(x=>({coefficients:x.coefficients,normals:x.normals,bindingSupport:x.bindingSupport})),ids,nodes,bounds:nodes[0].lo.map((v,k)=>[v,nodes[0].hi[k]]),intermediateGeometry:'linear interpolation between evaluated pose functions'};
}
function makeBuffers(clip,sourceMaterial){const n=clip.program.functions;return{program:clip.program,coefficients:new Float64Array(n*9),normals:new Float64Array(n*9),geometric:new Float64Array(n*3),inverse:new Float64Array(n*6),inverseAxes:new Uint8Array(n),nodes:clip.nodes,ids:clip.ids,bounds:clip.bounds,exactFields:null,sourceMaterial,normalMethod:'interpolated source-derived display-normal functions for animation preview',characterTriangleFaces:0,characterVertexBuffers:0};}
function update(clip,amount,out){
 if(!Number.isFinite(amount))throw Error('动作时间无效');amount=Math.max(0,Math.min(1,amount));
 const u=amount*(clip.frames.length-1),index=Math.min(clip.frames.length-2,Math.floor(u)),t=u-index,s=1-t,a=clip.frames[index],b=clip.frames[index+1],c=out.coefficients,n=out.normals;
 for(let i=0;i<c.length;i++){c[i]=a.coefficients[i]*s+b.coefficients[i]*t;n[i]=a.normals[i]*s+b.normals[i]*t;}
 for(let f=0;f<clip.program.functions;f++){const j=f*9,g=f*3,k=f*6,ux=c[j],uy=c[j+3],uz=c[j+6],vx=c[j+1],vy=c[j+4],vz=c[j+7],gx=uy*vz-uz*vy,gy=uz*vx-ux*vz,gz=ux*vy-uy*vx,length=Math.hypot(gx,gy,gz);
  if(!(length>0)){out.geometric.fill(0,g,g+3);out.inverse.fill(0,k,k+6);out.inverseAxes[f]=0;continue;}
  const sign=clip.program.orientation[f];let axis=0;if(Math.abs(gy)>Math.abs(gx))axis=1;if(Math.abs(gz)>Math.abs(axis===0?gx:gy))axis=2;out.inverseAxes[f]=axis;const x=(axis+1)%3,y=(axis+2)%3,dux=x===0?ux:x===1?uy:uz,duy=y===0?ux:y===1?uy:uz,dvx=x===0?vx:x===1?vy:vz,dvy=y===0?vx:y===1?vy:vz,d=dux*dvy-duy*dvx,A=dvy/d,B=-dvx/d,C=-duy/d,D=dux/d;out.inverse[k]=A;out.inverse[k+1]=B;out.inverse[k+2]=-A*c[j+x*3+2]-B*c[j+y*3+2];out.inverse[k+3]=C;out.inverse[k+4]=D;out.inverse[k+5]=-C*c[j+x*3+2]-D*c[j+y*3+2];out.geometric[g]=sign*gx/length;out.geometric[g+1]=sign*gy/length;out.geometric[g+2]=sign*gz/length;
 }
 out.bindingSupport=BodyAttachmentFramesR37.interpolate(a.bindingSupport,b.bindingSupport,t);return out;
}
globalThis.BodyAnimationClipR37={createClip,makeBuffers,update};
})();
