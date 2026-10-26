/* Continuous, source-derived affine chart functions. Research candidate only.
 * No vertex table, face connections, generated polygon or character mesh.
 * Trim partitions and moment coefficients are inherited from the source.
 * This does not certify source Float32 rounding, normals, or a mother system. */
(()=>{'use strict';
const M=BodyMathR01,cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const roundedKernels=new WeakMap;
function matrices(program,pose={}){
 if(program.rig.kind==='mhr-no-correctives')return mhrMatrices(program,pose);
 const r=program.rig,allowed=new Set(program.allowedJoints);for(const [name,p]of Object.entries(pose)){if(!allowed.has(name))throw Error('这个候选尚未接入该动作：'+name);const rotation=Array.isArray(p)?p:p.rotation||[0,0,0],translation=Array.isArray(p)?[0,0,0]:p.translation||[0,0,0];if(rotation.length!==3||translation.length!==3||![...rotation,...translation].every(Number.isFinite)||rotation.some(v=>Math.abs(v)>180))throw Error('动作必须是有限的三轴角度和位移');}
 const inverses=r.bind.map(M.rigidInverse),orientationChain=rotations=>{const poses=[],transforms=[];for(const j of r.order){const parent=r.parents[j],frame=parent<0?r.bind[j]:M.mul(transforms[parent],r.bind[j]),p=frame.slice();for(let row=0;row<3;row++)for(let k=0;k<3;k++)p[row*4+k]=rotations[j][row*3+k];poses[j]=p;transforms[j]=M.mul(parent<0?frame:p,inverses[j]);}return poses;};
 const ref=r.referenceOrientations.length?orientationChain(r.labels.map((_,j)=>r.referenceOrientations.slice(j*9,j*9+9))):r.bind,inv=ref.map(M.rigidInverse),root=inv[0],posed=[],deltas=[];
 if(r.parameterization!=='local-ref')throw Error('Unsupported original rig parameterization');
 for(const j of r.order){const parent=r.parents[j],p=pose[r.labels[j]],rotation=Array.isArray(p)?p:p?.rotation||[0,0,0],translation=Array.isArray(p)?undefined:p?.translation;let motion=M.rotvecDegrees(rotation,translation);const orientation=ref[j].slice();orientation[3]=orientation[7]=orientation[11]=0;motion=M.mul(M.mul(M.rigidInverse(orientation),motion),orientation);const local=M.mul(ref[j],motion);posed[j]=parent<0?M.mul(root,local):M.mul(deltas[parent],local);deltas[j]=M.mul(posed[j],inv[j]);}
 const skin=posed.map((p,j)=>M.mul(p,inverses[j]));Object.defineProperty(skin,"originalPoseMatrices",{value:posed});return skin;
}
function mhrMatrices(program,input){
 const r=program.rig,pose=Array.isArray(input)||ArrayBuffer.isView(input)?Array.from(input):Array.from({length:204},(_,i)=>input[i]??0),allowed=new Set(program.allowedPoseIndices);
 if(pose.length!==204||pose.some((v,i)=>!Number.isFinite(v)||v<r.poseLimits[i][0]||v>r.poseLimits[i][1]||(!allowed.has(i)&&v!==0)))throw Error('驱动 B 的这个参数超出原范围或已接入的身体范围；姿态修正必须由用户明确关闭');
 if(!Array.isArray(input)&&!ArrayBuffer.isView(input)&&Object.keys(input).some(k=>!/^\d+$/.test(k)||Number(k)>203))throw Error('未知驱动 B 动作输入');
 const parameters=new Float32Array(r.labels.length*7);for(let row=0;row<parameters.length;row++){let value=0;for(let k=r.transform_ptr[row];k<r.transform_ptr[row+1];k++)value+=r.transform_val[k]*pose[r.transform_idx[k]];parameters[row]=value;}
 const posed=[],skin=[],changed=[];
 for(let j=0;j<r.labels.length;j++){const parent=r.parents[j],k=j*7;changed[j]=(parent>=0&&changed[parent])||Array.from(parameters.subarray(k,k+7)).some(v=>v!==0);if(!changed[j]){posed[j]=r.bind[j].slice();skin[j]=M.I();continue;}const rotation=M.eulerQuaternion(parameters[k+3],parameters[k+4],parameters[k+5]),pre=M.quaternionMatrix(Array.from(r.prerotation.subarray(j*4,j*4+4))),translation=M.vector(M.uniformInverse(pre),[parameters[k]/100,parameters[k+1]/100,parameters[k+2]/100]),scale=parent<0||j<=1?1:r.scales[parent],motion=M.quaternionMatrix(rotation,translation.map(v=>v*scale),Math.exp(parameters[k+6]*.6931471824645996)),local=M.mul(r.local[j],motion);posed[j]=parent<0?local:M.mul(posed[parent],local);skin[j]=M.mul(posed[j],M.uniformInverse(r.bind[j]));}
 return skin;
}
function evaluate(program,pose={}){
 if(program.requiresRoundedSourceFunctions&&!program.roundedFunctions||program.requiresDisplayNormalFunctions&&!program.displayNormals)throw Error('当前原轮廓函数数据不完整；保留上一人物');
 const started=performance.now(),transforms=matrices(program,pose),delta=transforms.map((m,j)=>m.map((v,k)=>v-program.rig.baseTransforms[j][k]));let rounded=null;
 if(program.roundedFunctions){let kernel=roundedKernels.get(program.roundedFunctions);if(!kernel){kernel=BodyRoundedFunctionsR29.prepare(program.roundedFunctions);roundedKernels.set(program.roundedFunctions,kernel);}const state=structuredClone(program.state);if(program.rig.kind==='mhr-no-correctives')state.mhr.pose=Array.isArray(pose)||ArrayBuffer.isView(pose)?Array.from(pose):Array.from({length:204},(_,i)=>pose[i]||0);else{state.anny.pose={};state.anny.translations={};for(const[name,p]of Object.entries(pose)){state.anny.pose[name]=Array.from(Array.isArray(p)?p:p.rotation||[0,0,0]);if(!Array.isArray(p)&&p.translation?.some(v=>v!==0))state.anny.translations[name]=Array.from(p.translation);}}const head=program.headBoundaryFunctions?BodySourceHeadR29.evaluate(program.headBoundaryFunctions,state,pose):null,packet=head?head.packet:{...structuredClone(program.roundedSourcePacket),sourceState:state};rounded=kernel.evaluate(transforms,packet,state);rounded.sourceHeadTransforms=head?.skin||null;rounded.headBoundary=packet;}
 const count=program.functions,coefficients=rounded?rounded.coefficients:Float64Array.from(program.base),inverse=new Float64Array(count*6),inverseAxes=new Uint8Array(count),normals=new Float64Array(count*9),normalMaps=program.displayNormals?null:new Float64Array(count*9),boxes=new Float64Array(count*6),geometric=new Float64Array(count*3),degenerate=[];
 for(let f=0;f<count;f++){
  const at=f*9;
  if(!rounded)for(let row=0;row<3;row++){const zrow=[0,2,1][row],sign=row===2?-1:1;for(let k=program.offsets[f];k<program.offsets[f+1];k++){const d=delta[program.joints[k]],start=k*12;for(let c=0;c<3;c++)for(let q=0;q<4;q++)coefficients[at+row*3+c]+=sign*d[zrow*4+q]*program.moments[start+q*3+c];}}
  const du=[coefficients[at],coefficients[at+3],coefficients[at+6]],dv=[coefficients[at+1],coefficients[at+4],coefficients[at+7]],gn=cross(du,dv),size=Math.hypot(...gn);let axis=0;for(let k=1;k<3;k++)if(Math.abs(gn[k])>Math.abs(gn[axis]))axis=k;
  if(!(size>0)||!Number.isFinite(size)){degenerate.push(f);continue;}
  inverseAxes[f]=axis;const u=(axis+1)%3,v=(axis+2)%3,det=du[u]*dv[v]-du[v]*dv[u],a=dv[v]/det,b=-dv[u]/det,c=-du[v]/det,d=du[u]/det;
  inverse.set([a,b,-a*coefficients[at+u*3+2]-b*coefficients[at+v*3+2],c,d,-c*coefficients[at+u*3+2]-d*coefficients[at+v*3+2]],f*6);
  geometric.set(unit(gn).map(x=>x*program.winding[f]),f*3);
  if(!program.displayNormals){
  const bu=[program.base[at],program.base[at+3],program.base[at+6]],bv=[program.base[at+1],program.base[at+4],program.base[at+7]],bn=unit(cross(bu,bv)),nn=unit(gn),det3=dot(du,cross(dv,nn)),basis=[cross(dv,nn).map(x=>x/det3),cross(nn,du).map(x=>x/det3),cross(du,dv).map(x=>x/det3)];
  // The differential inverse transpose is a research normal transport, not the
  // original renderer's area-averaged normal operator. Kept explicit in reports.
  for(let k=0;k<3;k++)for(let j=0;j<3;j++)normalMaps[at+k*3+j]=basis[0][k]*bu[j]+basis[1][k]*bv[j]+basis[2][k]*bn[j];
  for(let row=0;row<3;row++)for(let c=0;c<3;c++)for(let k=0;k<3;k++)normals[at+row*3+c]+=normalMaps[at+row*3+k]*program.normal[at+k*3+c];
  }
  if(!rounded){
  const [loU,hiU,loV,hiV]=program.rects.slice(f*4,f*4+4);
  for(let row=0;row<3;row++){const a=coefficients[at+row*3],b=coefficients[at+row*3+1],c=coefficients[at+row*3+2],lo=c+a*(a<0?hiU:loU)+b*(b<0?hiV:loV),hi=c+a*(a<0?loU:hiU)+b*(b<0?loV:hiV);boxes[f*6+row]=lo;boxes[f*6+row+3]=hi;}  }

 }
 if(degenerate.some(f=>!rounded?.exactFields[f].degenerate))throw Error('函数域退化且未能证明源函数为空；保留上一人物：'+degenerate.slice(0,8).join(','));if(rounded)boxes.set(rounded.functionBounds);
 let normalResponseMS=0;
 if(program.displayNormals){const result=BodyDisplayNormalsR29.evaluate(program.displayNormals,rounded);normals.set(result.coefficients);normalResponseMS=result.report.buildMS;rounded.displayNormalReport=result.report;rounded.normalAtDomainExtremum=result.normalAtDomainExtremum;}else if(program.normalPolynomials){const normalStart=performance.now(),p=program.normalPolynomials,columns=Array.from({length:p.variableCount},(_,a)=>a>=p.constantStart?[0,1,2].map(k=>k===a-p.constantStart?1:0):[delta[a>>2][a%4],delta[a>>2][8+a%4],-delta[a>>2][4+a%4]]),pairCache=new Map;
  const evaluated=Array.from({length:p.expressionOffsets.length-1},(_,e)=>{const out=Array.from(p.constants.subarray(e*3,e*3+3));for(let i=p.expressionOffsets[e];i<p.expressionOffsets[e+1];i++){const key=p.pairs[i];let value=pairCache.get(key);if(!value){const a=Math.floor(key/p.variableCount),b=key%p.variableCount;value=cross(columns[a],columns[b]);pairCache.set(key,value);}for(let k=0;k<3;k++)out[k]+=p.coefficients[i]*value[k];}const length=Math.sqrt(dot(out,out));if(!(length>0)||!Number.isFinite(length))throw Error('原法线响应函数退化；保留上一人物');return out.map(v=>v/length);});
  normals.fill(0);for(let f=0;f<count;f++)for(let term=0;term<3;term++){const n=evaluated[p.refs[f*3+term]],at=(f*3+term)*3;for(let row=0;row<3;row++)for(let k=0;k<3;k++)normals[f*9+row*3+k]+=n[row]*p.blend[at+k];}
  normalResponseMS=performance.now()-normalStart;
 }
 const ids=Array.from({length:count},(_,i)=>i),nodes=[];
 function build(start,end){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],centresLo=lo.slice(),centresHi=hi.slice();for(let at=start;at<end;at++){const id=ids[at]*6;for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],boxes[id+k]);hi[k]=Math.max(hi[k],boxes[id+k+3]);const c=(boxes[id+k]+boxes[id+k+3])/2;centresLo[k]=Math.min(centresLo[k],c);centresHi[k]=Math.max(centresHi[k],c);}}const index=nodes.length,node={lo,hi,start,end,left:-1,right:-1};nodes.push(node);if(end-start>6){let axis=0;for(let k=1;k<3;k++)if(centresHi[k]-centresLo[k]>centresHi[axis]-centresLo[axis])axis=k;const sorted=ids.slice(start,end).sort((a,b)=>(boxes[a*6+axis]+boxes[a*6+axis+3])-(boxes[b*6+axis]+boxes[b*6+axis+3]));for(let i=0;i<sorted.length;i++)ids[start+i]=sorted[i];const mid=(start+end)>>1;node.left=build(start,mid);node.right=build(mid,end);}return index;}
 build(0,count);
 return{program,pose:structuredClone(pose),valueAtDomainExtremum:rounded?.valueAtDomainExtremum,normalAtDomainExtremum:rounded?.normalAtDomainExtremum,headBoundary:rounded?.headBoundary,transforms,coefficients,exactFields:rounded?.exactFields||null,inverse,inverseAxes,normals,geometric,boxes,ids,nodes,bounds:nodes[0].lo.map((v,k)=>[v,nodes[0].hi[k]]),buildMS:performance.now()-started,normalResponseMS,roundedSourcePositionArithmetic:rounded?.report||null,originalDisplayNormals:rounded?.displayNormalReport||null,normalMethod:program.displayNormals?'original ordered Float32 display-response scalar functions':program.normalPolynomials?'source-derived area-response polynomials; finite precision and native postprocessing unaccepted':'chart differential transport',characterTriangleFaces:0,characterVertexBuffers:0,sourceFacetPartitionInformationRetained:true,completedMotherConversion:false,sourceFidelityAccepted:false};
}
function createTracer(frame){
 const {program:p,coefficients:c,inverse:inv,normals:n,geometric:g,nodes,ids}=frame;const exact=frame.exactFields?BodyMovingDomainR28.createTracer(frame):null;
 function ray(origin,direction){if(exact){const h=exact.ray(origin,direction);if(!h)return null;const f=h.fields[0],j=f*9,point=origin.map((v,k)=>v+h.t*direction[k]),axis=frame.exactFields[f].axis,u=(axis+1)%3,v=(axis+2)%3,k=f*6;let oldAxis=0;for(let a=1;a<3;a++)if(Math.abs(g[f*3+a])>Math.abs(g[f*3+oldAxis]))oldAxis=a;const a=(oldAxis+1)%3,b=(oldAxis+2)%3,U=inv[k]*point[a]+inv[k+1]*point[b]+inv[k+2],V=inv[k+3]*point[a]+inv[k+4]*point[b]+inv[k+5];return{...h,field:f,U,V,point,normal:unit([0,1,2].map(row=>n[j+row*3]*U+n[j+row*3+1]*V+n[j+row*3+2]))};}let best=Infinity,hit=null;const stack=[0];while(stack.length){const node=nodes[stack.pop()];let lo=0,hi=best;for(let k=0;k<3;k++){if(direction[k]===0){if(origin[k]<node.lo[k]||origin[k]>node.hi[k])hi=-1;continue;}let a=(node.lo[k]-origin[k])/direction[k],b=(node.hi[k]-origin[k])/direction[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}if(hi<lo)continue;if(node.left>=0){stack.push(node.left,node.right);continue;}for(let at=node.start;at<node.end;at++){const f=ids[at],j=f*9,gn=Array.from(g.subarray(f*3,f*3+3)),den=dot(gn,direction);if(den>=0)continue;const t=dot(gn,[c[j+2]-origin[0],c[j+5]-origin[1],c[j+8]-origin[2]])/den;if(!(t>0&&t<best))continue;const point=origin.map((v,k)=>v+t*direction[k]);let axis=0;for(let k=1;k<3;k++)if(Math.abs(gn[k])>Math.abs(gn[axis]))axis=k;const u=(axis+1)%3,v=(axis+2)%3,k=f*6,U=inv[k]*point[u]+inv[k+1]*point[v]+inv[k+2],V=inv[k+3]*point[u]+inv[k+4]*point[v]+inv[k+5];let inside=true;for(let e=0;e<3;e++){const z=j+e*3;if(p.domains[z]*U+p.domains[z+1]*V+p.domains[z+2]<0){inside=false;break;}}if(!inside)continue;const normal=unit([0,1,2].map(row=>n[j+row*3]*U+n[j+row*3+1]*V+n[j+row*3+2]));best=t;hit={t,field:f,U,V,point,normal};}}return hit;}
 return{ray};
}
globalThis.BodyPoseFunctionsR29={matrices,evaluate,createTracer};
})();
