import {V,mix,clamp,smooth,patch,panel,upperPatches,seam,descriptor,pathGeometry} from './kernel.mjs';

export function lowCollar(last,role='edge'){
 const [a,b]=last.style.collar;
 const point=(u,v)=>{const t=u*Math.PI*2,s=mix(a,b,(1+Math.cos(t))*.5),side=Math.sign(Math.sin(t)),angle=side*last.collarAngle(s);return last.at(clamp(s+Math.cos(t)*v*.006),angle+side*v*.048,.28);};
 return panel('collar-bound-edge',[patch(point,112,3)],.62,role,{name:'鞋口回折包边',kind:'binding',explode:[0,25,0]});
}
export function buildPenny(last){
 const thickness=last.params.thickness,A=.44,B=.975,apron=s=>.80*Math.pow(1-smooth(.86,B,s),.48);
 const out=[panel('penny-galosh',[
  ...upperPatches(last,0,A,{nu:36}),...upperPatches(last,A,B,{inner:apron,nu:64}),...upperPatches(last,B,1,{nu:10})
 ],thickness,'leather',{name:'环绕帮面',explode:[0,22,0]}),
 panel('penny-apron',upperPatches(last,A,B,{outer:apron,offset:.45,nu:64,nv:22}),thickness,'leather',{name:'U 形前足拼片',explode:[0,60,16]})];
 for(const side of[-1,1])out.push(seam('apron-seam-'+side,t=>{const s=mix(.495,.97,t);return last.at(s,side*apron(s),.65);},{pitch:3.1,normalFn:t=>{const s=mix(.495,.97,t);return last.normal(s,side*apron(s));}}));
 const s0=.488,s1=.552,band=(u,v)=>last.at(mix(s0,s1,u),mix(-1.15,1.15,v),2.1);
 out.push(panel('penny-saddle',[patch(band,32,72,{normal:(u,v)=>last.normal(mix(s0,s1,u),mix(-1.15,1.15,v)),uv:(u,v)=>[u*(s1-s0)*last.L/100,v*116/100],keep:(u,v)=>!(u>.36&&u<.64&&Math.abs(v-.5)<.105)})],thickness,'leather',{name:'带贯穿切口的鞍带',kind:'closure',opening:'actual saddle slot; lower vamp visible through it',explode:[0,86,0]}));
 for(const s of[s0+.004,s1-.004])out.push(seam('saddle-edge-'+s,t=>last.at(s,mix(-1.12,1.12,t),2.25),{pitch:3.0,normalFn:t=>last.normal(s,mix(-1.12,1.12,t))}));
 out.push(lowCollar(last));
 out.push(seam('penny-back-seam',t=>last.at(mix(.002,last.style.collar[0],t),0,.3),{pitch:2.8,normalFn:t=>last.normal(mix(.002,last.style.collar[0],t),0)}));
 return out;
}

export function bootSurface(last){
 const [a,b]=last.style.collar,center=last.L*(.235-.5),height=last.style.shaft+last.style.heel*.35;
 const lower=(u,t)=>{
  const cs=(1+Math.cos(u))*.5,sInner=mix(a,b,cs),s=mix(cs,sInner,t),sin=Math.sin(u),side=sin<0?-1:1;
  const asym=q=>1+(side<0?.028:-.016)*smooth(.28,.65,q);
  // Interpolate continuous normalized plan coordinates from the lasting
  // boundary to the collar, then sample the same last roof. Signed half-angles
  // made the front meridian jump by 43 mm in the rejected first candidate.
  const spread=.03+.65*t,boundaryRatio=sin/Math.sqrt(sin*sin+spread*spread);
  const ratio=mix(boundaryRatio,Math.sin(side*last.collarAngle(sInner)),t),theta=Math.asin(clamp(ratio,-1,1));
  const x=last.center(s)+last.width(s)*asym(s)*ratio;
  // The heel needs a lasting return; the narrow toe already has its rise in
  // the last roof. Using the heel's long return there flattened the first
  // 25 mm and exposed a lining wedge above the welt in the second render.
  const returnDepth=mix(.16,.018,smooth(.88,.985,cs));
  const y=last.soleTop(s)+last.height(s)*Math.pow(Math.max(0,Math.cos(theta)),.72)*smooth(0,returnDepth,t);
  return V(x,y,last.L*(s-.5));
 };
 function point(u,v){
  if(v<=.48)return lower(u,v/.48);
  const t=(v-.48)/.52,B=lower(u,1),C=V(Math.sin(u)*31.5,last.style.shaft+last.style.heel*.35+2*Math.cos(u),center+36*Math.cos(u));
  const incoming=B.clone().sub(lower(u,.97)).multiplyScalar(1/.03);incoming.x=clamp(incoming.x,-26,26);incoming.z=clamp(incoming.z,-34,34);incoming.y=clamp(incoming.y,42,75);
  const end=V(0,height-B.y,0),t2=t*t,t3=t2*t;
  return B.multiplyScalar(2*t3-3*t2+1).addScaledVector(incoming,t3-2*t2+t).addScaledVector(C,-2*t3+3*t2).addScaledVector(end,t3-t2);
 }
 const normal=(u,v)=>point(u+1e-4,v).sub(point(u-1e-4,v)).cross(point(u,clamp(v+1e-4)).sub(point(u,clamp(v-1e-4)))).normalize();
 // u tangent cross vertical is outward with this x=sin(u), z=cos(u) convention.
 return {point,normal};
}
export function buildChelsea(last){
 const B=bootSurface(last),t=last.params.thickness,goreWidth=v=>v<=.33?0:.60*Math.pow(smooth(.33,.91,v),.61),out=[];
 const shaftPatch=(u0,u1,v0=0,v1=1,nu=52,nv=76)=>patch((u,v)=>{const q=mix(v0,v1,v);return B.point(mix(u0(q),u1(q),u),q);},nu,nv,{normal:(u,v)=>{const q=mix(v0,v1,v);return B.normal(mix(u0(q),u1(q),u),q);},uv:(u,v)=>[mix(u0(mix(v0,v1,v)),u1(mix(v0,v1,v)),u)*48/100,mix(v0,v1,v)*180/100]});
 out.push(panel('chelsea-whole-vamp',[shaftPatch(v=>-Math.PI/2+goreWidth(v),v=>Math.PI/2-goreWidth(v))],t,'leather',{name:'连续前帮与前靴筒',explode:[0,28,28]}));
 out.push(panel('chelsea-back-quarter',[shaftPatch(v=>Math.PI/2+goreWidth(v),v=>Math.PI*1.5-goreWidth(v))],t,'leather',{name:'后帮与后靴筒',explode:[0,32,-30]}));
 for(const side of[-1,1]){
  const center=side*Math.PI/2;
  out.push(panel('chelsea-gore-'+side,[shaftPatch(v=>center-goreWidth(v),v=>center+goreWidth(v),.33,1,26,54)],1.0,'elastic',{name:side<0?'内侧弹力片':'外侧弹力片',kind:'gore',noLeatherBehind:true,explode:[side*34,34,0]}));
  for(const sign of[-1,1])out.push(seam('gore-seam-'+side+'-'+sign,t=>{const v=mix(.335,.987,t),u=center+sign*(goreWidth(v)+.019);return B.point(u,v).addScaledVector(B.normal(u,v),.28);},{pitch:3.0,normalFn:t=>{const v=mix(.335,.987,t);return B.normal(center+sign*(goreWidth(v)+.019),v);}}));
 }
 // A narrow return band spans the actual top boundary; the ankle aperture is open.
 out.push(panel('chelsea-top-binding',[patch((u,v)=>B.point(u*Math.PI*2,1-v*.018).addScaledVector(B.normal(u*Math.PI*2,1-v*.018),.28),128,4,{normal:(u,v)=>B.normal(u*Math.PI*2,1-v*.018),uv:(u,v)=>[u*210/100,v*3/100]})],.6,'edge',{name:'靴口包边',kind:'binding',explode:[0,60,0]}));
 out.push(seam('chelsea-rear-join',t=>{const v=mix(.01,.985,t);return B.point(Math.PI,v).addScaledVector(B.normal(Math.PI,v),.3);},{pitch:3.2,normalFn:t=>B.normal(Math.PI,mix(.01,.985,t))}));
 const back=B.point(Math.PI,1),pull=(u,v)=>{const a=mix(-.12,Math.PI+.12,u);return V(back.x+mix(-7,7,v),back.y-10+17*Math.sin(a),back.z-3-6*Math.cos(a));};
 out.push(panel('chelsea-pull-loop',[patch(pull,38,6,{uv:(u,v)=>[v*.14,u*.47]})],1.1,'edge',{name:'缝入后帮的拉环',kind:'closure',explode:[0,65,-18]}));
 return out;
}
