/* Isolated closed-interval boundary traversal trial. No coefficient or domain expansion. Default build does not import this candidate. */
/* Float64 direct function intersection for precision review. No mesh output.
 * The fast WebGL preview is replaced after interaction stops. Source facet
 * partition information remains; this is not an autonomous mother system.
 */
(()=>{'use strict';
function createTracer(atlas){
 const lines=atlas.nodeLines,links=atlas.nodeLinks,fields=atlas.functionCoefficients,ids=atlas.leafFunctionIds,palms=atlas.sourcePalmCoefficients,roots=atlas.chartRoots,rects=atlas.chartRects,bounds=atlas.bounds,stackNode=new Int32Array(32),stackLo=new Float64Array(32),stackHi=new Float64Array(32);
 function ray(ox,oy,oz,dx,dy,dz){let best=Infinity,bestField=-1,bestAxis=0,bestU=0,bestV=0;
  for(let chart=0;chart<6;chart++){
   const root=roots[chart];if(root<0)continue;const axis=chart>>1,ou=axis===0?oy:axis===1?oz:ox,ov=axis===0?oz:axis===1?ox:oy,oa=axis===0?ox:axis===1?oy:oz,du=axis===0?dy:axis===1?dz:dx,dv=axis===0?dz:axis===1?dx:dy,da=axis===0?dx:axis===1?dy:dz,rect=rects[chart];let lo=0,hi=best;
   for(let k=0;k<3;k++){const o=k===0?ou:k===1?ov:oa,d=k===0?du:k===1?dv:da,min=k===0?rect[0]:k===1?rect[2]:bounds[axis][0],max=k===0?rect[1]:k===1?rect[3]:bounds[axis][1];if(d===0){if(o<min||o>max){hi=-1;break;}continue;}let a=(min-o)/d,b=(max-o)/d;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);}
   if(hi<lo)continue;let count=1;stackNode[0]=root;stackLo[0]=lo;stackHi[0]=hi;
   while(count){count--;const node=stackNode[count],a=stackLo[count],b=stackHi[count];if(a>best)continue;const q=node*5;
    if(links[q]===1){const end=links[q+3]+links[q+4];for(let k=links[q+3];k<end;k++){const f=ids[k],j=f*12,A=fields[j],B=fields[j+1],C=fields[j+2],den=da-A*du-B*dv;if(den*(chart%2===0?1:-1)>=0||den===0)continue;const t=(A*ou+B*ov+C-oa)/den;const arithmetic=16*Number.EPSILON*Math.max(1,Math.abs(t),Math.abs(a),Math.abs(b));if(t>=Math.max(0,a)-arithmetic&&t<=b+arithmetic&&t<best){best=t;bestField=f;bestAxis=axis;bestU=ou+du*t;bestV=ov+dv*t;}}}
    else{const j=node*3,s=lines[j]*ou+lines[j+1]*ov+lines[j+2],rate=lines[j]*du+lines[j+1]*dv;let child;
     if(rate===0){if(s===0){if(count+2>stackNode.length)throw Error("Closed boundary stack exceeded");stackNode[count]=links[q+1];stackLo[count]=a;stackHi[count]=b;count++;stackNode[count]=links[q+2];stackLo[count]=a;stackHi[count]=b;count++;continue;}child=s>=0?links[q+1]:links[q+2];stackNode[count]=child;stackLo[count]=a;stackHi[count]=b;count++;continue;}
     const split=-s/rate;if(split<a||split>b){child=(split<a?rate>0:rate<0)?links[q+1]:links[q+2];stackNode[count]=child;stackLo[count]=a;stackHi[count]=b;count++;}
     else{if(count>29)throw Error('Precision function traversal stack exceeded');const near=rate<0?links[q+1]:links[q+2],far=near===links[q+1]?links[q+2]:links[q+1];stackNode[count]=far;stackLo[count]=split;stackHi[count]=b;count++;stackNode[count]=near;stackLo[count]=a;stackHi[count]=split;count++;}
    }
   }
  }
  if(bestField<0)return null;const j=bestField*12,px=fields[j+3]*bestU+fields[j+4]*bestV+fields[j+5],py=fields[j+6]*bestU+fields[j+7]*bestV+fields[j+8],pz=fields[j+9]*bestU+fields[j+10]*bestV+fields[j+11],n=Math.hypot(px,py,pz)||1,k=bestField*3;
  const c=atlas.sourceSkinCoefficients,z=bestField*12,rest=[0,1,2].map(k=>c[z+k*3]*bestU+c[z+k*3+1]*bestV+c[z+k*3+2]),dry=Math.max(0,Math.min(1,c[z+9]*bestU+c[z+10]*bestV+c[z+11]));return{t:best,field:bestField,axis:bestAxis,rest,dry,nx:px/n,ny:py/n,nz:pz/n,palm:Math.max(0,Math.min(1,palms[k]*bestU+palms[k+1]*bestV+palms[k+2]))};
 }
 return{ray};
}
globalThis.BodyAtlasCpuR21={createTracer};globalThis.BodyAtlasCpuR24=globalThis.BodyAtlasCpuR21;
})();
