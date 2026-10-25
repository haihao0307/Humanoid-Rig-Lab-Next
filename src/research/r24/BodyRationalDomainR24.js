/* Isolated exact source-function geometry kernel. Not selected by BUILD.json.
 * BigInt domain and plane coefficients preserve source facets explicitly.
 * No point table, source connectivity, character faces or display primitives.
 * This does not establish an autonomous mother or material/visual acceptance. */
(()=>{'use strict';
const ZERO={n:0n,d:1n},ONE={n:1n,d:1n},abs=x=>x<0n?-x:x;
function gcd(a,b){a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;}
function rational(n,d=1n){if(!d)throw Error('Zero rational denominator');if(!n)return ZERO;if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};}
const add=(a,b)=>rational(a.n*b.d+b.n*a.d,a.d*b.d),negative=a=>({n:-a.n,d:a.d}),divide=(a,b)=>rational(a.n*b.d,a.d*b.n),multiplyInteger=(a,n)=>rational(a.n*n,a.d),compare=(a,b)=>{const x=a.n*b.d-b.n*a.d;return x<0n?-1:x>0n?1:0;};
const view=new DataView(new ArrayBuffer(8)),fraction=value=>{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Exact ray coordinates must be finite numbers');if(!value)return ZERO;view.setFloat64(0,value,false);const bits=view.getBigUint64(0,false),exponent=Number((bits>>52n)&2047n),mantissa=(bits&4503599627370495n)|(exponent?4503599627370496n:0n),sign=bits>>63n?-1n:1n,power=(exponent?exponent-1023:-1022)-52;return power>=0?rational(sign*(mantissa<<BigInt(power))):rational(sign*mantissa,1n<<BigInt(-power));};
const dot=(coefficients,values)=>values.reduce((s,v,k)=>add(s,multiplyInteger(v,coefficients[k])),ZERO);
function toNumber(value){if(!value.n)return 0;const sign=value.n<0n?-1:1,n=abs(value.n),d=value.d;let exponent=n.toString(2).length-d.toString(2).length;if(exponent>=0?n<(d<<BigInt(exponent)):(n<<BigInt(-exponent))<d)exponent--;if(exponent>1023)return sign*Infinity;const shift=exponent< -1022?1074:52-exponent,N=shift>=0?n<<BigInt(shift):n,D=shift>=0?d:d<<BigInt(-shift);let quotient=N/D;const remainder=N%D;if(remainder*2n>D||remainder*2n===D&&(quotient&1n))quotient++;if(exponent< -1022)return sign*Number(quotient)*2**-1074;if(quotient===9007199254740992n){quotient>>=1n;exponent++;}return exponent>1023?sign*Infinity:sign*Number(quotient)*2**(exponent-52);}
function createTracer(program){
 if(program?.schema!=='body-source-rational-functions-research/1'||program.characterFaces!==0||program.selectedByDefault!==false)throw Error('Invalid isolated rational function program');
 const links=program.nodeLinks,leaf=program.leafFunctionIds,planes=program.functionPlanes.map(p=>p.map(BigInt)),lines=new Map(Object.entries(program.decisionPlanes).map(([id,p])=>[+id,p.map(BigInt)])),rects=program.chartRects.map(r=>r.map(fraction)),bounds=program.bounds.map(r=>r.map(fraction));let rays=0;
 function ray(originValues,directionValues){
  if(originValues.length!==3||directionValues.length!==3||directionValues.every(x=>x===0))throw Error('Invalid exact ray');
  const origin=originValues.map(fraction),direction=directionValues.map(fraction);let best=null,bestFields=[];rays++;
  for(let chart=0;chart<6;chart++){
   const root=program.chartRoots[chart];if(root<0)continue;const axis=chart>>1,u=(axis+1)%3,v=(axis+2)%3;let lo=ZERO,hi=best,outside=false;
   for(const[k,min,max]of[[u,rects[chart][0],rects[chart][1]],[v,rects[chart][2],rects[chart][3]],[axis,bounds[axis][0],bounds[axis][1]]]){
    if(!direction[k].n){if(compare(origin[k],min)<0||compare(origin[k],max)>0){outside=true;break;}continue;}
    let a=divide(add(min,negative(origin[k])),direction[k]),b=divide(add(max,negative(origin[k])),direction[k]);if(compare(a,b)>0)[a,b]=[b,a];if(compare(a,lo)>0)lo=a;if(!hi||compare(b,hi)<0)hi=b;if(compare(hi,lo)<0){outside=true;break;}
   }
   if(outside)continue;const stack=[[root,lo,hi]];
   while(stack.length){const[index,a,b]=stack.pop();if(best&&compare(a,best)>0)continue;const node=links[index];if(!node)throw Error('Invalid analytic decision link');
    if(node[0]===1){
     for(let at=node[3];at<node[3]+node[4];at++){const field=leaf[at],plane=planes[field],rate=dot(plane,direction);if(rate.n>=0n)continue;const t=divide(negative(add(dot(plane,origin),{n:plane[3],d:1n})),rate);if(t.n<=0n||compare(t,a)<0||b&&compare(t,b)>0||best&&compare(t,best)>0)continue;if(!best||compare(t,best)<0){best=t;bestFields=[field];}else if(!bestFields.includes(field))bestFields.push(field);}
    }else{
     const line=lines.get(index);if(!line)throw Error('Missing exact decision plane');const s=add(add(multiplyInteger(origin[u],line[0]),multiplyInteger(origin[v],line[1])),{n:line[2],d:1n}),rate=add(multiplyInteger(direction[u],line[0]),multiplyInteger(direction[v],line[1]));
     if(!rate.n){if(s.n>=0n)stack.push([node[1],a,b]);if(s.n<=0n)stack.push([node[2],a,b]);continue;}
     const split=divide(negative(s),rate),near=rate.n<0n?node[1]:node[2],far=rate.n<0n?node[2]:node[1];
     if(compare(split,a)<0)stack.push([far,a,b]);else if(b&&compare(split,b)>0)stack.push([near,a,b]);else{stack.push([far,split,b]);stack.push([near,a,split]);}
    }
   }
  }
  return best?{t:toNumber(best),exactParameter:{numerator:best.n.toString(),denominator:best.d.toString()},fields:bestFields.sort((a,b)=>a-b),sourceDerived:true,sourceFacetPartitionInformationRetained:true}:null;
 }
 return{ray,report:()=>({schema:'body-rational-domain-research/1',rays,characterFaces:0,characterConnectivity:false,sourceFacetPartitionInformationRetained:true,completedMotherConversion:false,sourceFidelityAccepted:false,visualAccepted:false,selectedByDefault:false,displayIntegrationComplete:false})};
}
globalThis.BodyRationalDomainResearchR24={createTracer};
})();
