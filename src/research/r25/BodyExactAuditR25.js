// Isolated audit-formatting optimization candidate; not selected by default.
/* Exact dyadic-ray intersection of original source-derived plane functions.
 * Original facet partitions remain explicit; no character mesh is generated.
 * Integer predicates and rational ordering use no geometric epsilon.
 * This kernel alone does not certify materials, continuous controls or mother conversion. */
(()=>{'use strict';
function createTracer(program){
 if(program?.schema!=='body-source-rational-functions-research/1'||program.characterFaces!==0)throw Error('Invalid exact source-function program');
 const planes=program.functionPlanes.map(p=>p.map(BigInt)),lines=[],links=Int32Array.from(program.nodeLinks.flat()),ids=Uint32Array.from(program.leafFunctionIds),roots=Int32Array.from(program.chartRoots);for(const[k,p]of Object.entries(program.decisionPlanes))lines[+k]=p.map(BigInt);
 const buffer=new ArrayBuffer(8),view=new DataView(buffer),abs=x=>x<0n?-x:x;
 function dyadic(x){if(typeof x!=='number'||!Number.isFinite(x))throw Error('Ray coordinates must be finite');if(!x)return[0n,0];view.setFloat64(0,x,false);const bits=view.getBigUint64(0,false),e=Number((bits>>52n)&2047n),m=(bits&4503599627370495n)|(e?4503599627370496n:0n);return[bits>>63n?-m:m,(e?e-1023:-1022)-52];}
 function fraction(x){let[n,e]=dyadic(x);return e<0?[n,1n<<BigInt(-e)]:[n<<BigInt(e),1n];}
 const rects=program.chartRects.map(r=>r.map(fraction)),bounds=program.bounds.map(r=>r.map(fraction)),ZERO=[0n,1n];
 const ratio=(n,d)=>d<0n?[-n,-d]:[n,d],cmp=(a,b)=>{const t=a[0]*b[1]-b[0]*a[1];return t<0n?-1:t>0n?1:0;};
 function number(a){if(!a[0])return 0;const sign=a[0]<0n?-1:1,n=abs(a[0]),d=a[1];let e=n.toString(2).length-d.toString(2).length;if(e>=0?n<(d<<BigInt(e)):(n<<BigInt(-e))<d)e--;if(e>1023)return sign*Infinity;const shift=e< -1022?1074:52-e,N=shift>=0?n<<BigInt(shift):n,D=shift>=0?d:d<<BigInt(-shift);let q=N/D;const r=N%D;if(r*2n>D||r*2n===D&&(q&1n))q++;if(e< -1022)return sign*Number(q)*2**-1074;if(q===9007199254740992n){q>>=1n;e++;}return e>1023?sign*Infinity:sign*Number(q)*2**(e-52);}
 function integers(origin,direction){const binary=[...origin,...direction].map(dyadic),power=Math.min(0,...binary.map(x=>x[1]));return{D:1n<<BigInt(-power),ints:binary.map(([n,e])=>n<<BigInt(e-power))};}
 function hitResult(best,fields,detailed=true){if(!detailed)return{t:number(best),fields:fields.sort((a,b)=>a-b)};let n=best[0],d=best[1],x=abs(n),y=d;while(y){const r=x%y;x=y;y=r;}n/=x;d/=x;return{t:number(best),fields:fields.sort((a,b)=>a-b),exactParameter:{numerator:n.toString(),denominator:d.toString()}};}
 function rayField(origin,direction,field,detailed=true){const{D,ints}=integers(origin,direction),p=planes[field],rate=p[0]*ints[3]+p[1]*ints[4]+p[2]*ints[5];if(rate>=0n)return null;const s=p[0]*ints[0]+p[1]*ints[1]+p[2]*ints[2]+p[3]*D,t=ratio(-s,rate);return t[0]>0n?hitResult(t,[field],detailed):null;}
 let rays=0,visits=0,tests=0;
 function ray(origin,direction,detailed=true){
  if(origin.length!==3||direction.length!==3||direction.every(x=>x===0))throw Error('Invalid exact ray');
  const{D,ints}=integers(origin,direction),O=ints.slice(0,3),R=ints.slice(3);let best=null,fields=[];rays++;
  for(let chart=0;chart<6;chart++){
   const root=roots[chart];if(root<0)continue;const axis=chart>>1,u=(axis+1)%3,v=(axis+2)%3;let lo=ZERO,hi=best,out=false;
   for(const[k,min,max]of[[u,rects[chart][0],rects[chart][1]],[v,rects[chart][2],rects[chart][3]],[axis,bounds[axis][0],bounds[axis][1]]]){
    if(!R[k]){if(O[k]*min[1]<min[0]*D||O[k]*max[1]>max[0]*D){out=true;break;}continue;}
    let a=ratio(min[0]*D-O[k]*min[1],R[k]*min[1]),b=ratio(max[0]*D-O[k]*max[1],R[k]*max[1]);if(cmp(a,b)>0)[a,b]=[b,a];if(cmp(a,lo)>0)lo=a;if(!hi||cmp(b,hi)<0)hi=b;if(cmp(hi,lo)<0){out=true;break;}
   }
   if(out)continue;const stack=[[root,lo,hi]];
   while(stack.length){const[index,a,b]=stack.pop();visits++;if(best&&cmp(a,best)>0)continue;const offset=index*5;
    if(links[offset]===1){for(let at=links[offset+3];at<links[offset+3]+links[offset+4];at++){
     tests++;const field=ids[at],p=planes[field],rate=p[0]*R[0]+p[1]*R[1]+p[2]*R[2];if(rate>=0n)continue;
     const s=p[0]*O[0]+p[1]*O[1]+p[2]*O[2]+p[3]*D,t=ratio(-s,rate);if(t[0]<=0n||cmp(t,a)<0||b&&cmp(t,b)>0||best&&cmp(t,best)>0)continue;
     if(!best||cmp(t,best)<0){best=t;fields=[field];}else if(!fields.includes(field))fields.push(field);
    }}else{
     const p=lines[index],s=p[0]*O[u]+p[1]*O[v]+p[2]*D,rate=p[0]*R[u]+p[1]*R[v];
     if(!rate){if(s>=0n)stack.push([links[offset+1],a,b]);if(s<=0n)stack.push([links[offset+2],a,b]);continue;}
     const split=ratio(-s,rate),near=rate<0n?links[offset+1]:links[offset+2],far=rate<0n?links[offset+2]:links[offset+1];
     if(cmp(split,a)<0)stack.push([far,a,b]);else if(b&&cmp(split,b)>0)stack.push([near,a,b]);else{stack.push([far,split,b]);stack.push([near,a,split]);}
    }
   }
  }
  return best?hitResult(best,fields,detailed):null;
 }
 return{ray,rayField,report:()=>({rays,visits,functionTests:tests,exactIntegerPredicates:true,characterFaces:0,sourceFacetPartitionInformationRetained:true,sourceFidelityAccepted:false,completedMotherConversion:false})};
}
globalThis.BodyExactDomainR25={createTracer};
})();
