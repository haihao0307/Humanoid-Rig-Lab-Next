/* Isolated R25 research candidate. Not selected by BUILD.json. No visual/source acceptance. */
/* Number interval routing is a conservative filter only. Ambiguity restarts
 * the exact integer traversal; a selected function's t is rounded from its
 * exact rational root. No residual band, surface expansion or missing budget.
 * Source-derived facet partitions remain; this is not an autonomous mother. */
(()=>{'use strict';
function createTracer(program){
 const exact=BodyExactDomainR25.createTracer(program),planes=program.functionPlanes.map(p=>p.map(Number)),lines=new Float64Array(program.nodeLinks.length*3),links=Int32Array.from(program.nodeLinks.flat()),ids=Uint32Array.from(program.leafFunctionIds),roots=Int32Array.from(program.chartRoots),rectangles=program.chartRects,bounds=program.bounds;for(const[k,p]of Object.entries(program.decisionPlanes))lines.set(p.map(Number),+k*3);
 const E=32*Number.EPSILON,MIN=2**-1022,view=new DataView(new ArrayBuffer(8));let rays=0,fallbacks=0,visits=0;
 const nodeEpoch=new Uint32Array(roots.length?links.length/5:0),nodeAxis=new Uint8Array(nodeEpoch.length),nodeLow=new Float64Array(nodeEpoch.length),nodeHigh=new Float64Array(nodeEpoch.length),fieldEpoch=new Uint32Array(planes.length),fieldLow=new Float64Array(planes.length),fieldHigh=new Float64Array(planes.length);let originValues=[NaN,NaN,NaN],epoch=0,originPredicateBuilds=0,originPredicateReuses=0,boxNumerators=null;
 function adjacent(x,up){if(!Number.isFinite(x))return x;if(!x)return up?Number.MIN_VALUE:-Number.MIN_VALUE;view.setFloat64(0,x,false);let high=view.getUint32(0,false),low=view.getUint32(4,false);if((x>0)===up){if(low===4294967295){low=0;high++;}else low++;}else if(low===0){low=4294967295;high--;}else low--;view.setUint32(0,high,false);view.setUint32(4,low,false);return view.getFloat64(0,false);}
 // Four terms need < 8*epsilon of summed magnitude, including conversion of
 // the exact integer coefficients. 32*epsilon also covers the rounded error
 // accumulation and rounded interval endpoints. Tiny arithmetic is enclosed
 // by 32 minimum subnormals; nonfinite arithmetic restarts integer traversal.
 function affine(p,x){let sum=0,magnitude=0;for(let k=0;k<x.length;k++){const product=p[k]*x[k];if(!Number.isFinite(product))return null;sum+=product;magnitude+=Math.abs(product);}if(p.length>x.length){sum+=p[x.length];magnitude+=Math.abs(p[x.length]);}const radius=magnitude*E+Number.MIN_VALUE*32;if(!Number.isFinite(radius)||!Number.isFinite(sum))return null;return[sum-radius,sum+radius];}
 function affine2(a,b,c,x,y){const ax=a*x,by=b*y,sum=ax+by+c,magnitude=Math.abs(ax)+Math.abs(by)+Math.abs(c),radius=magnitude*E+Number.MIN_VALUE*32;return Number.isFinite(sum)&&Number.isFinite(radius)?[sum-radius,sum+radius]:null;}
 function affine3(p,x,constant){const a=p[0]*x[0],b=p[1]*x[1],c=p[2]*x[2],sum=a+b+c+constant,magnitude=Math.abs(a)+Math.abs(b)+Math.abs(c)+Math.abs(constant),radius=magnitude*E+Number.MIN_VALUE*32;return Number.isFinite(sum)&&Number.isFinite(radius)?[sum-radius,sum+radius]:null;}
 function originCache(origin){if(origin.every((v,k)=>Object.is(v,originValues[k])))return;originValues=origin.slice();epoch=(epoch+1)>>>0;if(epoch===0){nodeEpoch.fill(0);fieldEpoch.fill(0);epoch=1;}boxNumerators=bounds.map((b,k)=>b.map(v=>affine([1,-origin[k]],[v])));}
 function nodeOrigin(index,axis,u,v,origin,A,B,C){if(nodeEpoch[index]===epoch&&nodeAxis[index]===axis){originPredicateReuses++;return Number.isNaN(nodeLow[index])?null:[nodeLow[index],nodeHigh[index]];}const s=affine2(A,B,C,origin[u],origin[v]);nodeEpoch[index]=epoch;nodeAxis[index]=axis;nodeLow[index]=s?s[0]:NaN;nodeHigh[index]=s?s[1]:NaN;originPredicateBuilds++;return s;}
 function fieldOrigin(index,p,origin){if(fieldEpoch[index]===epoch){originPredicateReuses++;return Number.isNaN(fieldLow[index])?null:[fieldLow[index],fieldHigh[index]];}const s=affine3(p,origin,p[3]);fieldEpoch[index]=epoch;fieldLow[index]=s?s[0]:NaN;fieldHigh[index]=s?s[1]:NaN;originPredicateBuilds++;return s;}
 function quotient(a,b){if(!a||!b||b[0]<=0&&b[1]>=0)return null;const v=[a[0]/b[0],a[0]/b[1],a[1]/b[0],a[1]/b[1]];if(v.some(x=>!Number.isFinite(x)))return null;return[adjacent(Math.min(...v),false),adjacent(Math.max(...v),true)];}
 const max=(a,b)=>[Math.max(a[0],b[0]),Math.max(a[1],b[1])],min=(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1])],neg=a=>a&&[-a[1],-a[0]];
 function filtered(origin,direction){let best=null,bestField=-1;originCache(origin);let globalLo=[0,0],globalHi=[Infinity,Infinity];for(let k=0;k<3;k++){if(direction[k]===0){if(origin[k]<bounds[k][0]||origin[k]>bounds[k][1])return null;continue;}const a=quotient(boxNumerators[k][0],[direction[k],direction[k]]),b=quotient(boxNumerators[k][1],[direction[k],direction[k]]);if(!a||!b)return undefined;globalLo=max(globalLo,direction[k]>0?a:b);globalHi=min(globalHi,direction[k]>0?b:a);if(globalLo[0]>globalHi[1])return null;}
  for(let chart=0;chart<6;chart++){
   const root=roots[chart];if(root<0)continue;const axis=chart>>1,u=(axis+1)%3,v=(axis+2)%3,rect=rectangles[chart];let lo=globalLo,hi=best?min(globalHi,best):globalHi,out=false;
   for(const[k,a,b]of[[u,rect[0],rect[1]],[v,rect[2],rect[3]]]){
    if(direction[k]===0){if(origin[k]<a||origin[k]>b){out=true;break;}continue;}
    const A=quotient(affine([1,-origin[k]],[a]),[direction[k],direction[k]]),B=quotient(affine([1,-origin[k]],[b]),[direction[k],direction[k]]);if(!A||!B)return undefined;lo=max(lo,direction[k]>0?A:B);hi=min(hi,direction[k]>0?B:A);if(lo[0]>hi[1]){out=true;break;}
   }
   if(out)continue;const stack=[[root,lo,hi]];
   while(stack.length){const[index,a,b]=stack.pop();visits++;if(a[0]>b[1]||best&&a[0]>best[1])continue;const offset=index*5;
    if(links[offset]===1){for(let at=links[offset+3];at<links[offset+3]+links[offset+4];at++){
     const field=ids[at],p=planes[field],rate=affine3(p,direction,0);if(!rate)return undefined;if(rate[0]>=0)continue;if(rate[1]>=0)return undefined;
     const t=quotient(neg(fieldOrigin(field,p,origin)),rate);if(!t)return undefined;if(t[1]<=0||t[1]<a[0]||t[0]>b[1]||best&&t[0]>best[1])continue;
     if(t[0]<=0||t[0]<=a[1]||t[1]>=b[0])return undefined;
     if(!best||t[1]<best[0]){best=t;bestField=field;}else if(field!==bestField)return undefined;
    }}else{
     const at=index*3,A=lines[at],B=lines[at+1],C=lines[at+2],rate=affine2(A,B,0,direction[u],direction[v]),s=nodeOrigin(index,axis,u,v,origin,A,B,C),split=quotient(neg(s),rate);if(!split)return undefined;
     const near=rate[1]<0?links[offset+1]:links[offset+2],far=rate[1]<0?links[offset+2]:links[offset+1];
     if(split[1]<a[0])stack.push([far,a,b]);else if(split[0]>b[1])stack.push([near,a,b]);else{stack.push([far,max(a,split),b]);stack.push([near,a,min(b,split)]);}
    }
   }
  }
  return bestField<0?null:exact.rayField(origin,direction,bestField);
 }
 function ray(origin,direction){if(origin.length!==3||direction.length!==3||direction.every(x=>x===0)||[...origin,...direction].some(x=>!Number.isFinite(x)||x!==0&&Math.abs(x)<MIN))return exact.ray(origin,direction);rays++;const result=filtered(origin,direction);if(result!==undefined)return result;fallbacks++;return exact.ray(origin,direction);}
 return{ray,report:()=>({rays,fallbacks,visits,originPredicateBuilds,originPredicateReuses,originCacheBytes:nodeEpoch.byteLength+nodeAxis.byteLength+nodeLow.byteLength+nodeHigh.byteLength+fieldEpoch.byteLength+fieldLow.byteLength+fieldHigh.byteLength,exactRootRounding:true,filter:'outward Number intervals; ambiguous => integer traversal',arithmeticErrorBound:E,geometricExpansion:0,characterFaces:0,sourceFacetPartitionInformationRetained:true})};
}
globalThis.BodyOriginPredicateCacheResearchR25={createTracer};
})();
