// Native R15 curve noise expressed as generated Gaussian functions. There is
// no stored lip image and no character geometry. Pixel queries retain the
// source stamping, Float32 stores and byte quantization for legacy comparison.
export const SOURCE_LIP_NOISE_REVISION='r15-lip-curve-functions/20261025-1';
export function createSourceLipNoiseFunctions({widthMM=50,upperMM=7,lowerMM=9,seed=37,density=1}={}){
 for(const x of[widthMM,upperMM,lowerMM,seed,density])if(!Number.isFinite(x))throw Error('唇纹函数变量无效');
 if(widthMM<=0||upperMM<=0||lowerMM<=0||density<.6||density>1.5)throw Error('唇纹函数范围无效');
 const width=1024,height=512,halfHeight=256,binSize=8,binsX=128,binsY=64,bins=Array.from({length:binsX*binsY},()=>[]),stamps=[];let state=(Math.round(seed)+1)>>>0,primary=0,branches=0,secondary=0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},mix=(a,b,t)=>a+(b-a)*t;
 for(let upper=0;upper<2;upper++){
  const physicalHeight=upper?upperMM:lowerMM,pixelsX=width/widthMM,pixelsY=halfHeight*.88/physicalHeight;
  function curve(evaluate,start,end,radius,amplitude,band){
   const steps=Math.max(12,Math.ceil((end-start)*halfHeight*1.2));
   for(let index=0;index<=steps;index++){
    const t=index/steps,v=mix(start,end,t),x=evaluate(v,t),centerX=(x/widthMM+.5)*width,centerY=(upper+.06+.88*v)*halfHeight,weight=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.58),reach=radius*2.8;
    const left=Math.max(0,Math.floor(centerX-reach*pixelsX)),right=Math.min(width-1,Math.ceil(centerX+reach*pixelsX)),bottom=Math.max(upper*halfHeight,Math.floor(centerY-reach*pixelsY)),top=Math.min((upper+1)*halfHeight-1,Math.ceil(centerY+reach*pixelsY));
    if(right<left||top<bottom)continue;
    const stamp={centerX,centerY,pixelsX,pixelsY,radius,amplitude:amplitude*weight,band,left,right,bottom,top},id=stamps.length;stamps.push(stamp);
    for(let by=Math.floor(bottom/binSize);by<=Math.floor(top/binSize);by++)for(let bx=Math.floor(left/binSize);bx<=Math.floor(right/binSize);bx++)bins[by*binsX+bx].push(id);
   }
  }
  let x=-widthMM*.485;
  while(x<widthMM*.485){
   x+=(.52+1.25*random())/density;const root=x,phase=random()*6.283,wave=(random()-.5)*.9,lean=root/(widthMM*.5)*(.35+.55*random()),start=.005+random()*.26,end=Math.min(.99,start+.34+random()*.62),radius=.072+random()*.08,depth=.036+random()*.046;
   const main=v=>root+lean*(v-.3)+wave*Math.sin(v*3.9+phase)+.045*Math.sin(v*15+phase);curve(main,start,end,radius,depth,0);primary++;
   const branchCount=random()<.22?0:1+(random()>.55?1:0);
   for(let index=0;index<branchCount;index++){const begin=mix(start,end,.18+.5*random()),finish=Math.min(.98,begin+.1+.22*random()),sign=random()<.5?-1:1,spread=sign*(.17+.58*random()),origin=main(begin);curve((v,t)=>mix(origin,main(v)+spread,t*t*(3-2*t)),begin,finish,radius*(.48+.28*random()),depth*(.28+.27*random()),0);branches++;}
  }
  for(let index=0;index<Math.round(widthMM*2.4*density);index++){const root=(random()-.5)*widthMM*.96,start=.05+.78*random(),end=Math.min(.97,start+.065+.23*random()),lean=(random()-.5)*.9,phase=random()*6.283;curve((v,t)=>root+lean*t+.04*Math.sin(phase+t*5),start,end,.026+.033*random(),.006+.015*random(),1);secondary++;}
 }
 function pixel(x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=width||y<0||y>=height)throw Error('唇纹查询坐标无效');
  const values=[0,0];
  for(const id of bins[Math.floor(y/binSize)*binsX+Math.floor(x/binSize)]){
   const s=stamps[id];if(x<s.left||x>s.right||y<s.bottom||y>s.top)continue;
   const distance=((x+.5-s.centerX)/s.pixelsX)**2+((y+.5-s.centerY)/s.pixelsY)**2,radial=distance/(s.radius*s.radius),v=s.amplitude*(-Math.exp(-radial*1.7)+.105*Math.exp(-radial*.22)),band=s.band;
   if(v<0)values[band]=Math.fround(Math.min(values[band],v));else if(values[band]>=0)values[band]=Math.fround(Math.max(values[band],v));
  }
  return values;
 }
 function quantizedPixel(x,y){return pixel(x,y).map((v,k)=>Math.max(0,Math.min(255,Math.round(128+v/(k?.1:.25)*255))));}
 function sample(u,v){
  if(!Number.isFinite(u)||!Number.isFinite(v))throw Error('唇纹函数坐标无效');u=Math.max(0,Math.min(1,u));v=Math.max(0,Math.min(1,v));const px=u*width-.5,py=v*height-.5,x=Math.floor(px),y=Math.floor(py),tx=px-x,ty=py-y,clampX=x=>Math.max(0,Math.min(width-1,x)),clampY=y=>Math.max(0,Math.min(height-1,y));
  const a=quantizedPixel(clampX(x),clampY(y)),b=quantizedPixel(clampX(x+1),clampY(y)),c=quantizedPixel(clampX(x),clampY(y+1)),d=quantizedPixel(clampX(x+1),clampY(y+1));return a.map((_,k)=>(mix(mix(a[k],b[k],tx),mix(c[k],d[k],tx),ty)-128)/255);
 }
 function geometryHeightMetres(u,v,upper,band=0){
  if(!Number.isFinite(u)||!Number.isFinite(v)||typeof upper!=='boolean'||![0,1].includes(band))throw Error('原唇纹几何输入无效');
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),px=clamp(u*.5+.5)*(width-1),py=clamp(((upper?1:0)+.06+.88*clamp(v))*.5*height-.5,0,height-1),x=Math.floor(px),y=Math.floor(py),tx=px-x,ty=py-y,get=(x,y)=>quantizedPixel(Math.min(width-1,x),Math.min(height-1,y))[band];
  // Preserve the native hw() arithmetic and coordinate convention; it is
  // deliberately different from the material sampler's level-zero mapping.
  return((get(x,y)*(1-tx)+get(x+1,y)*tx)*(1-ty)+(get(x,y+1)*(1-tx)+get(x+1,y+1)*tx)*ty-128)/255*(band===0?25e-5:1e-4);
 }
 return Object.freeze({pixel,quantizedPixel,sample,geometryHeightMetres,report:()=>({revision:SOURCE_LIP_NOISE_REVISION,sourceSHA256:'f63c538a548108f3f61657ddbec3c0c05fbb4f4456770ba7668c67b948247edd',variables:{widthMM,upperMM,lowerMM,seed:Math.round(seed),density},width,height,primary,branches,secondary,gaussianFunctions:stamps.length,storedImagePixels:0,sourceTriangles:0,semantics:'Original curve samples, elliptical Gaussian min/max composition, Float32 height stores and byte quantization. sample() preserves level-zero bilinear/clamp semantics only; mip/anisotropic filtering is not certified. geometryHeightMetres() preserves the separate original hw() convention.',runtimeBindingAccepted:false,sourceFidelityAccepted:false})});
}
