// Conservative acceleration over the existing explicit function-support boxes.
// This index contains no original model vertices or face/vertex connectivity.
export function buildFunctionSupportBVH(bounds,{leafSize=4}={}){
 if(!(bounds instanceof Float64Array)||bounds.length%6||!Number.isInteger(leafSize)||leafSize<1||leafSize>16)throw Error('函数支持域索引输入无效');
 const count=bounds.length/6,order=Uint32Array.from({length:count},(_,i)=>i),rows=[],bits=new Uint32Array(1),floats=new Float32Array(bits.buffer);
 function outward(x,up){floats[0]=x;let f=floats[0];if(!Number.isFinite(f))throw Error('函数支持域超过浮点范围');if(up?f<x:f>x){bits[0]+=(f>0)===up?1:-1;f=floats[0];}if(f===0)return up?1.1754943508222875e-38:-1.1754943508222875e-38;bits[0]+=(f>0)===up?1:-1;return floats[0];}
 function build(start,end){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=start;i<end;i++)for(let k=0;k<3;k++){min[k]=Math.min(min[k],bounds[order[i]*6+k]);max[k]=Math.max(max[k],bounds[order[i]*6+3+k]);}const id=rows.length,row=[...min.map(x=>outward(x,false)),0,...max.map(x=>outward(x,true)),0];rows.push(row);if(end-start<=leafSize){row[3]=-start-1;row[7]=end-start;return id;}const spans=min.map((v,k)=>max[k]-v),axis=spans.indexOf(Math.max(...spans));order.subarray(start,end).sort((a,b)=>(bounds[a*6+axis]+bounds[a*6+3+axis])-(bounds[b*6+axis]+bounds[b*6+3+axis]));const mid=(start+end)>>>1;row[3]=build(start,mid);row[7]=build(mid,end);return id;}
 if(!count)throw Error('函数支持域为空');build(0,count);const data=new ArrayBuffer(16+rows.length*32+count*4),h=new Uint32Array(data,0,4);h.set([0x4e425631,rows.length,count,leafSize]);const nodes=new Float32Array(data,16,rows.length*8);rows.forEach((r,i)=>nodes.set(r,i*8));new Uint32Array(data,16+rows.length*32).set(order);return data;
}
export function createFunctionSupportBVH(buffer){
 const h=new Uint32Array(buffer,0,4),count=h[1],functions=h[2];if(h[0]!==0x4e425631||count<1||functions<1||buffer.byteLength!==16+count*32+functions*4)throw Error('函数支持域索引格式不符');
 const nodes=new Float32Array(buffer,16,count*8),order=new Uint32Array(buffer,16+count*32),EPS=Number.EPSILON;
 const pool=[];let activeDepth=0;
 function intersect(origin,direction,tMin,tMax,polynomialRoot,{maximumVisitedNodes=65536}={}){
  if(!Number.isInteger(maximumVisitedNodes)||maximumVisitedNodes<0)throw Error('函数索引预算无效');
  const level=activeDepth++,work=pool[level]||(pool[level]={stack:[],interval:[0,0]}),stack=work.stack,out=work.interval;let top=0,visited=0,best=null,uncertain=false;
  function interval(index,lo,hi){const at=index*8;for(let k=0;k<3;k++){if(direction[k]===0){if(origin[k]<nodes[at+k]||origin[k]>nodes[at+4+k])return false;}else{const a=(nodes[at+k]-origin[k])/direction[k],b=(nodes[at+4+k]-origin[k])/direction[k],pad=8*EPS*(1+Math.abs(a)+Math.abs(b));lo=Math.max(lo,Math.min(a,b)-pad);hi=Math.min(hi,Math.max(a,b)+pad);if(lo>hi)return false;}}out[0]=lo;out[1]=hi;return true;}
  function push(index,lo,hi){stack[top++]=index;stack[top++]=lo;stack[top++]=hi;}
  try{if(!interval(0,tMin,tMax))return{status:'empty',visitedNodes:0};push(0,out[0],out[1]);
   while(top){if(visited>=maximumVisitedNodes)return{status:'unresolved',reason:'function-bvh-node-budget',candidate:best,visitedNodes:visited};const hi=stack[--top],lo=stack[--top],index=stack[--top];if(best&&lo>best.t)continue;visited++;const at=index*8,left=nodes[at+3],right=nodes[at+7];
    if(left<0){const begin=-left-1;for(let i=begin;i<begin+right;i++){const value=polynomialRoot(order[i],origin,direction,lo,Math.min(hi,best?.t??hi));if(value.status==='unresolved')uncertain=true;else if(value.status==='hit'&&(!best||value.t<best.t))best=value;}continue;}
    const cap=Math.min(hi,best?.t??hi),hasLeft=interval(left,lo,cap),leftLo=out[0],leftHi=out[1],hasRight=interval(right,lo,cap),rightLo=out[0],rightHi=out[1];
    if(hasLeft&&hasRight){if(leftLo<rightLo){push(right,rightLo,rightHi);push(left,leftLo,leftHi);}else{push(left,leftLo,leftHi);push(right,rightLo,rightHi);}}else if(hasLeft)push(left,leftLo,leftHi);else if(hasRight)push(right,rightLo,rightHi);
   }
   if(uncertain)return{status:'unresolved',reason:'degenerate-function-root',candidate:best,visitedNodes:visited};return best?{...best,visitedNodes:visited}:{status:'empty',visitedNodes:visited};
  }finally{activeDepth--;}
 }
 return{intersect,report:()=>({nodes:count,functions,bytes:buffer.byteLength,leafSize:h[3],authority:'acceleration only; explicit function support boxes',sourceVertices:0,sourceTriangles:0})};
}
export function makeStacklessFunctionSupportBVH(buffer){
 const data=buffer.slice(0),h=new Uint32Array(data,0,4);if(h[0]!==0x4e425631)throw Error('函数索引版本不符');const nodes=new Float32Array(data,16,h[1]*8);
 function thread(index,escape){const at=index*8,left=nodes[at+3],right=nodes[at+7];if(left<0)return;if(left!==index+1)throw Error('函数索引不是前序结构');nodes[at+7]=escape;thread(left,right);thread(right,escape);}
 thread(0,h[1]);h[0]=0x4e425632;return data;
}
