/* Source-partition analytic candidate, NOT completed mother conversion.
 * This program retains source-facet partition information as decision functions
 * and affine fields. No source vertex table, face connectivity or mesh output.
 * Projected overlaps remain separate branches, including internal/return layers.
 */
(()=>{'use strict';
function create(program){
 const {nodes,functions,leafFunctions,chartRoots,chartRects,bounds}=program;
 function query(chart,u,v){let id=chartRoots[chart];if(id<0)return[];const b=chartRects[chart];if(u<b[0]||u>b[1]||v<b[2]||v>b[3])return[];
  const stack=[id],result=new Set();while(stack.length){const n=nodes[stack.pop()];if(n[3]===1){for(let k=n[6];k<n[6]+n[7];k++)result.add(leafFunctions[k]);continue;}const a=n[0]*u,b=n[1]*v,d=a+b+n[2],bound=Number.EPSILON*8*(Math.abs(a)+Math.abs(b)+Math.abs(n[2]));if(Math.abs(d)<=bound)stack.push(n[4],n[5]);else stack.push(d>=0?n[4]:n[5]);}return[...result].map(j=>({function:j,coefficients:functions[j]}));
 }
 function normal(f,u,v){const c=functions[f],a=[c[3]*u+c[4]*v+c[5],c[6]*u+c[7]*v+c[8],c[9]*u+c[10]*v+c[11]],length=Math.hypot(...a)||1;return a.map(x=>x/length);}
 function ray(origin,direction){let best=Infinity,result=null;
  for(let chart=0;chart<6;chart++){
   const root=chartRoots[chart];if(root<0)continue;const axis=chart>>1,u=(axis+1)%3,v=(axis+2)%3,rect=chartRects[chart];let lo=0,hi=best;
   for(const[k,min,max]of[[u,rect[0],rect[1]],[v,rect[2],rect[3]],[axis,bounds[axis][0],bounds[axis][1]]]){
    if(Math.abs(direction[k])<1e-15){if(origin[k]<min||origin[k]>max){hi=-1;break;}continue;}
    let a=(min-origin[k])/direction[k],b=(max-origin[k])/direction[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);
   }
   if(hi<lo)continue;const stack=[[root,lo,hi]];
   while(stack.length){const[id,a,b]=stack.pop();if(a>best)continue;const n=nodes[id];if(n[3]===1){
     for(let k=n[6];k<n[6]+n[7];k++){const f=leafFunctions[k],c=functions[f],den=direction[axis]-c[0]*direction[u]-c[1]*direction[v];if(Math.abs(den)<1e-15||den*(chart%2===0?1:-1)>=0)continue;
      const t=(c[0]*origin[u]+c[1]*origin[v]+c[2]-origin[axis])/den;
      if(t>=Math.max(0,a)-1e-12&&t<=b+1e-12&&t<best){const p=origin.map((x,j)=>x+direction[j]*t);best=t;result={t,p,normal:normal(f,p[u],p[v]),chart,function:f};}
     }
    }else{const d0=n[0]*origin[u]+n[1]*origin[v]+n[2],rate=n[0]*direction[u]+n[1]*direction[v];if(Math.abs(rate)<1e-20){stack.push([d0>=0?n[4]:n[5],a,b]);continue;}
     const t=-d0/rate;if(t<=a||t>=b){const mid=(a+b)/2;stack.push([d0+rate*mid>=0?n[4]:n[5],a,b]);}else{const near=d0+rate*((a+t)/2)>=0?n[4]:n[5],far=near===n[4]?n[5]:n[4];stack.push([far,t,b],[near,a,t]);}
    }
   }
  }
  return result;
 }
 return{query,ray,normal,program,sourceFidelityAccepted:false,completedMotherConversion:false};
}
globalThis.BodySourceAtlasR21={create};
})();
