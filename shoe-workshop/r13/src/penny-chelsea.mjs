import {V,mix,clamp,smooth,patch,panel,upperPatches,seam,descriptor,pathGeometry} from './kernel.mjs';

export function lowCollar(last,role='edge'){
 const point=(u,v)=>last.collarSurface(u*Math.PI*2,v*1.7,.28);
 return panel('collar-bound-edge',[patch(point,112,3,{normal:(u,v)=>last.collarNormal(u*Math.PI*2,v*1.7)})],.62,role,{name:'鞋口回折包边',kind:'binding',explode:[0,25,0]});
}
export function buildPenny(last){
 const thickness=last.params.thickness,A=.44,B=.975;
 // Keep every existing rear row and insert the exact collar start. A chord
 // from the last closed row to the first open row otherwise cuts a V below
 // the true collar, leaving a small hole beneath its independent binding.
 const collarStart=last.style.collar[0],rearStep=A/36,rearBefore=Math.floor(collarStart/rearStep),rearAfter=rearBefore+1;
 const rearRanges=[[0,rearBefore*rearStep,rearBefore],[rearBefore*rearStep,collarStart,1],[collarStart,rearAfter*rearStep,1],[rearAfter*rearStep,A,36-rearAfter]];
 const rearPatches=options=>rearRanges.flatMap(([s0,s1,nu])=>upperPatches(last,s0,s1,{...options,nu,nv:22}));
 // sqrt(distance-to-tip) in the rounded end gives a transverse tangent at
 // the nose. The former almost-linear falloff made both the cut and seam a V.
 const apron=s=>.80*Math.pow(1-smooth(.84,B,s),.25);
 // Include the exact collar end as a mesh row. Otherwise the coarse chord
 // across that closing curve carried the aperture under the saddle support.
 const collarEnd=last.style.collar[1],rearRows=1/12;
 const apronS=u=>u<=rearRows?mix(A,collarEnd,u/rearRows):mix(collarEnd,B,Math.sin((u-rearRows)/(1-rearRows)*Math.PI/2));
 // A restrained raised apron settles into the actual shared cut boundary.
 // The seam therefore has leather immediately on both sides of its baseline,
 // rather than bridging a decorative line above an unrelated flat panel.
 // This roll is wide enough for a 2.1 mm saddle offset to remain regular;
 // the earlier narrow feather had a smaller concave radius and folded it.
 const apronLift=(s,a)=>.45*smooth(0,.10,apron(s)-Math.abs(a))*smooth(0,.018,B-s);
 const apronPoint=(s,a)=>last.at(s,a,apronLift(s,a));
 const apronNormal=(s,a)=>{
  const e=1e-4;
  return apronPoint(clamp(s+e,A,B),a).sub(apronPoint(clamp(s-e,A,B),a))
   .cross(apronPoint(s,a+e).sub(apronPoint(s,a-e))).normalize();
 };
 const apronPatch=(side,inside)=>{
  const domain=(u,v)=>{const s=apronS(u),edge=Math.max(last.collarAngle(s),apron(s));return[s,side*mix(inside?last.collarAngle(s):edge,inside?edge:Math.PI/2,v)];};
  return patch((u,v)=>inside?apronPoint(...domain(u,v)):last.at(...domain(u,v)),72,22,{
   normal:(u,v)=>inside?apronNormal(...domain(u,v)):last.normal(...domain(u,v)),
   uv:(u,v)=>{const[s,a]=domain(u,v);return[s*last.L/100,a*52/100];}
  });
 };
 const out=[panel('penny-galosh',[
  // Splitting the rear region at the same angular line preserves matching
  // samples where the U opening begins; there is no hidden T-shaped cut wall.
  ...rearPatches({outer:()=>apron(A)}),
  ...rearPatches({inner:()=>apron(A)}),
  ...[-1,1].map(side=>apronPatch(side,false)),...upperPatches(last,B,1,{nu:10,nv:22})
 ],thickness,'leather',{name:'环绕帮面',explode:[0,22,0]}),
 panel('penny-apron',[-1,1].map(side=>apronPatch(side,true)),thickness,'leather',{name:'U 形前足拼片',construction:'rounded U cut shares its actual boundary with the galosh',explode:[0,60,16]})];
 const uBoundary=u=>{const s=apronS(u<=.5?u*2:(1-u)*2),side=u<.5?-1:1;return[s,side*apron(s)];};
 out.push(seam('penny-apron-seam',u=>last.at(...uBoundary(u)),{pitch:3.1,normalFn:u=>last.normal(...uBoundary(u)),supportPart:['penny-apron','penny-galosh']}));
 const s0=.488,s1=.552,saddleSurface=(s,a)=>apronPoint(s,a).addScaledVector(apronNormal(s,a),thickness+.04);
 const band=(u,v)=>saddleSurface(mix(s0,s1,u),mix(-1.15,1.15,v));
 out.push(panel('penny-saddle',[patch(band,32,72,{normal:(u,v)=>apronNormal(mix(s0,s1,u),mix(-1.15,1.15,v)),uv:(u,v)=>[u*(s1-s0)*last.L/100,v*116/100],keep:(u,v)=>!(u>.36&&u<.64&&Math.abs(v-.5)<.105)})],thickness,'leather',{name:'带贯穿切口的鞍带',kind:'closure',opening:'actual saddle slot; lower vamp visible through it',support:'inner saddle is offset 0.04 mm from the actual apron or galosh surface',explode:[0,86,0]}));
 for(const s of[s0+.004,s1-.004])out.push(seam('saddle-edge-'+s,u=>saddleSurface(s,mix(-1.12,1.12,u)),{pitch:3.0,normalFn:u=>apronNormal(s,mix(-1.12,1.12,u)),supportPart:'penny-saddle'}));
 out.push(lowCollar(last));
 out.push(seam('penny-back-seam',t=>last.at(mix(.002,last.style.collar[0],t),0),{pitch:2.8,normalFn:t=>last.normal(mix(.002,last.style.collar[0],t),0),supportPart:'penny-galosh'}));
 return out;
}

export function bootSurface(last){
 const [a,b]=last.style.collar,center=last.L*(.235-.5),height=last.style.shaft+last.style.heel*.35;
 const turnAt=.72,turnHandle=12;
 const lower=(u,t)=>{
  // Ease the last part of the plan travel to a vertical tangent at the collar.
  // The height Hermite correction is zero at both ends (maximum 1.78 mm),
  // so neither the collar position nor the protected toe roof is displaced.
  const w=clamp((t-turnAt)/(1-turnAt));
  const travel=t<=turnAt?t:turnAt+(1-turnAt)*(w+w*w-w*w*w);
  const cs=(1+Math.cos(u))*.5,sInner=mix(a,b,cs),s=mix(cs,sInner,travel),sin=Math.sin(u),side=sin<0?-1:1;
  const asym=q=>1+(side<0?.028:-.016)*smooth(.28,.65,q);
  // Use one continuous outer angle and interpolate monotonically to the
  // collar angle. Changing the lateral normalization while advancing s folded
  // the rear quarter back through the gore near v=.42. Angle interpolation
  // keeps both meridians continuous and samples the same designer-last roof.
  const boundaryRatio=sin/Math.sqrt(sin*sin+.03*.03);
  const outerTheta=Math.asin(clamp(boundaryRatio,-1,1));
  const theta=mix(outerTheta,side*last.collarAngle(sInner),travel);
  const x=last.center(s)+last.width(s)*asym(s)*Math.sin(theta);
  // The heel needs a lasting return; the narrow toe already has its rise in
  // the last roof. Using the heel's long return there flattened the first
  // 25 mm and exposed a lining wedge above the welt in the second render.
  const returnDepth=mix(.16,.018,smooth(.88,.985,cs));
  // A positive rise tangent at the lasting boundary keeps the outward
  // normal well-defined. A zero-tangent S-curve reversed several first-row
  // triangles where the sole's toe spring descended faster than the upper.
  const returnRise=1-Math.pow(1-clamp(t/returnDepth),2);
  const y=last.soleTop(s)+last.height(s)*Math.pow(Math.max(0,Math.cos(theta)),.72)*returnRise-turnHandle*w*w*(1-w);
  return V(x,y,last.L*(s-.5));
 };
 function point(u,v){
  if(v<=.48)return lower(u,v/.48);
  const t=(v-.48)/.52,B=lower(u,1),C=V(Math.sin(u)*31.5,last.style.shaft+last.style.heel*.35+2*Math.cos(u),center+36*Math.cos(u));
  // The same vertical tangent, with the v-interval scale included, joins the
  // lower and shaft surfaces C1. A chord-only tangent fixed plan foldovers but
  // left a real crease across the gore; smoothing only its stitches hid it.
  const incoming=V(0,turnHandle/(1-turnAt)*.52/.48,0);
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
 // The gore and leather now share every v sample, including the inserted
 // tip and lower/shaft join. Matching only the analytic curve left different
 // polygon chords on either side of the cut and exposed their inner faces.
 const rows=[[0,.33,30],[.33,.48,24],[.48,1,48]];
 const shaftPatches=(u0,u1,nu=52,start=0)=>rows.slice(start).map(([v0,v1,nv])=>shaftPatch(u0,u1,v0,v1,nu,nv));
 out.push(panel('chelsea-whole-vamp',shaftPatches(v=>-Math.PI/2+goreWidth(v),v=>Math.PI/2-goreWidth(v)),t,'leather',{name:'连续前帮与前靴筒',explode:[0,28,28]}));
 out.push(panel('chelsea-back-quarter',shaftPatches(v=>Math.PI/2+goreWidth(v),v=>Math.PI*1.5-goreWidth(v)),t,'leather',{name:'后帮与后靴筒',explode:[0,32,-30]}));
 for(const side of[-1,1]){
  const center=side*Math.PI/2;
  out.push(panel('chelsea-gore-'+side,shaftPatches(v=>center-goreWidth(v),v=>center+goreWidth(v),26,1),1.0,'elastic',{name:side<0?'内侧弹力片':'外侧弹力片',kind:'gore',noLeatherBehind:true,explode:[side*34,34,0]}));
  for(const sign of[-1,1])out.push(seam('gore-seam-'+side+'-'+sign,t=>{const v=mix(.335,.987,t),u=center+sign*(goreWidth(v)+.019);return B.point(u,v);},{pitch:3.0,normalFn:t=>{const v=mix(.335,.987,t);return B.normal(center+sign*(goreWidth(v)+.019),v);},supportPart:side*sign>0?'chelsea-back-quarter':'chelsea-whole-vamp'}));
 }
 // A narrow return band spans the actual top boundary; the ankle aperture is open.
 out.push(panel('chelsea-top-binding',[patch((u,v)=>B.point(u*Math.PI*2,1-v*.018).addScaledVector(B.normal(u*Math.PI*2,1-v*.018),.28),128,4,{normal:(u,v)=>B.normal(u*Math.PI*2,1-v*.018),uv:(u,v)=>[u*210/100,v*3/100]})],.6,'edge',{name:'靴口包边',kind:'binding',explode:[0,60,0]}));
 out.push(seam('chelsea-rear-join',t=>B.point(Math.PI,mix(.01,.985,t)),{pitch:3.2,normalFn:t=>B.normal(Math.PI,mix(.01,.985,t)),supportPart:'chelsea-back-quarter'}));
 // Both legs are derived from the actual rear-quarter surface. Their small
 // overlaps embed the webbing into the outer and inner leather, while the
 // open arch clears the rim. This is a geometric attachment, not a force solve.
 const anchorV=.94,pullThickness=1.1;
 const acrossLength=B.point(Math.PI+.001,anchorV).distanceTo(B.point(Math.PI-.001,anchorV))/.002;
 const halfAngle=7/acrossLength;
 const pull=(u,v)=>{
  const a=Math.PI+mix(halfAngle,-halfAngle,v),anchor=B.point(a,anchorV),n=B.normal(a,anchorV),rim=B.point(a,1);
  const p0=anchor.clone().addScaledVector(n,.18),p3=anchor.clone().addScaledVector(n,-t-.18),rise=(rim.y+7-anchor.y)/.75;
  const p1=p0.clone().add(V(0,rise,0)).addScaledVector(n,5.5),p2=p3.clone().add(V(0,rise,0)).addScaledVector(n,-3);
  return p0.multiplyScalar((1-u)**3).addScaledVector(p1,3*(1-u)**2*u).addScaledVector(p2,3*(1-u)*u*u).addScaledVector(p3,u**3);
 };
 out.push(panel('chelsea-pull-loop',[patch(pull,48,8,{uv:(u,v)=>[v*.14,u*.47]})],pullThickness,'webbing',{name:'缝入后帮的织物拉环',kind:'closure',attachment:'both ends overlap the actual outer/inner rear quarter',explode:[0,65,-18]}));
 return out;
}
