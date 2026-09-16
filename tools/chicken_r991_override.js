// CHICKEN_R991_GAMEPLAY_HEAD_PATCH
// Second bounded pass: replace the long wedge profile by refitting the existing
// 72x96 carrier rings in-place. No detached head mesh is introduced.
window.__CHICKEN_R991_PATCH__=Object.freeze({
 version:'V4.6_R9.9.1_CONTINUOUS_RING_REFIT_CANDIDATE',
 source:'CHICKEN_V46_R9_1.html',
 method:'continuous in-place head/neck ring refit + compact integral bill + attached facial patches',
 preserves:['body','lower neck','plumage','wing','tail','feet','materials','controls','R9.1 rollback'],
 manualVisualAcceptance:false,wholeVisualGatePassed:false,rigAuthorized:false,motionAuthorized:false
});

const __r99HeadProfile=Object.freeze([
 [.255,.925,.335,.185],[.270,.945,.350,.178],[.285,.965,.385,.168],
 [.300,.980,.445,.150],[.315,.989,.525,.132],[.330,.994,.610,.114],
 [.345,.994,.690,.098],[.360,.990,.755,.086],[.375,.985,.805,.078],
 [.390,.978,.840,.071],[.405,.969,.866,.064],[.420,.958,.886,.057],
 [.435,.947,.903,.050]
]);
const __r99BillProfile=Object.freeze([
 [.435,.947,.903,.050],[.448,.944,.909,.043],[.461,.938,.913,.033],
 [.474,.929,.916,.021],[.486,.919,.918,.002]
]);
function __r99Interp(profile,x,column){
 if(x<=profile[0][0])return profile[0][column];
 if(x>=profile[profile.length-1][0])return profile[profile.length-1][column];
 let i=1;while(i<profile.length&&x>profile[i][0])i++;
 const a=profile[i-1],b=profile[i],t=(x-a[0])/(b[0]-a[0]),q=t*t*(3-2*t);
 return a[column]*(1-q)+b[column]*q;
}

// The inherited R8/R9 face field generated a large orbital blister and long
// spear-like bill. The R9.9 carrier refit below owns those domains, so the old
// field is bypassed rather than stacked underneath it.
applyHeadFaceR9=function(input){return input.slice();};

applyHeadTopR91=function(input,amount,ctrl){
 const p=input.slice(),a=clamp(amount,0,1),rows=72,cols=96,zc=.09,sourceTip=.523116,headPivotX=.390,headPivotY=.910;
 let moved=0,maxDisplacement=0,nonFinite=0,nonHeadMoved=0,previous=-Infinity,monotonic=true;
 for(let r=0;r<rows;r++){
  const start=r*cols*3,x0=input[start];if(x0<.245){const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;continue;}
  let tx=x0,top,bottom,lat,blend=ss(.245,.285,x0)*a;
  if(x0<=.435){
   top=__r99Interp(__r99HeadProfile,x0,1);bottom=__r99Interp(__r99HeadProfile,x0,2);lat=__r99Interp(__r99HeadProfile,x0,3);
  }else{
   const u=clamp((x0-.435)/(sourceTip-.435)),targetTip=.435+(.486-.435)*clamp(ctrl.beak_length||1,.72,1.15),ease=u*u*(3-2*u);
   tx=.435+(targetTip-.435)*ease;top=__r99Interp(__r99BillProfile,.435+(.486-.435)*u,1);bottom=__r99Interp(__r99BillProfile,.435+(.486-.435)*u,2);lat=__r99Interp(__r99BillProfile,.435+(.486-.435)*u,3);blend=a;
  }
  const hs=clamp(ctrl.head_scale||1,.82,1.18),shapeW=ss(.270,.315,x0)*(1-ss(.435,.465,x0));
  top=headPivotY+(top-headPivotY)*(1+(hs-1)*shapeW);bottom=headPivotY+(bottom-headPivotY)*(1+(hs-1)*shapeW);lat*=1+(hs-1)*shapeW;
  const cy=.5*(top+bottom),rt=Math.max(.0005,top-cy),rb=Math.max(.0005,cy-bottom);
  for(let j=0;j<cols;j++){
   const th=-Math.PI+2*Math.PI*j/cols,c=Math.cos(th),s=Math.sin(th),q=start+j*3,ox=p[q],oy=p[q+1],oz=p[q+2];
   const ty=cy+(c>=0?rt*Math.pow(c,.88):-rb*Math.pow(-c,.88));
   let tz=zc+lat*s*(.92+.08*Math.abs(c));
   const side=s>=0?1:-1;
   const orbit=Math.exp(-Math.pow((tx-.392)/.025,2)-Math.pow((ty-.950)/.021,2));
   const cheek=Math.exp(-Math.pow((tx-.392)/.038,2)-Math.pow((ty-.910)/.035,2));
   tz+=side*(.00045*orbit+.00110*cheek)*blend;
   p[q]+=(tx-p[q])*blend;p[q+1]+=(ty-p[q+1])*blend;p[q+2]+=(tz-p[q+2])*blend;
   const d=Math.hypot(p[q]-ox,p[q+1]-oy,p[q+2]-oz);if(d>1e-8){moved++;maxDisplacement=Math.max(maxDisplacement,d);if(oy<.315)nonHeadMoved++;}
   if(!Number.isFinite(p[q])||!Number.isFinite(p[q+1])||!Number.isFinite(p[q+2]))nonFinite++;
  }
  const sx=p[start];if(sx<=previous)monotonic=false;previous=sx;
 }
 const cap=(rows*cols)*3;if(p.length>=cap+6){p[cap+3]=.486;p[cap+4]=.9185;p[cap+5]=zc;}
 const audit={amount:a,movedVertices:moved,maxDisplacement,nonFinite,nonHeadMoved,stationXMonotonic:monotonic,billRoot:.435,sourceTip,targetTip:.486,connectedCarrier:true,separateBillMesh:false,ringRefit:true};
 window.__CHICKEN_R991_HEAD_AUDIT__=audit;return p;
};

function __r99SurfacePatch(chart,side,cx,cy,rx,ry,centerBump,edgeBump,kind){
 const P=[],I=[],UV=[],na=48,nr=7,center=chart.at(cx,cy,side,centerBump);if(!center)return null;
 P.push(...center.p.toArray());UV.push(0,0);
 for(let r=1;r<=nr;r++){const rr=r/nr;for(let j=0;j<na;j++){const aa=2*Math.PI*j/na,x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,b=edgeBump+(centerBump-edgeBump)*(1-rr*rr),q=chart.at(x,y,side,b);if(!q)return null;P.push(...q.p.toArray());UV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}}
 for(let j=0;j<na;j++){const b=1+j,d=1+(j+1)%na;if(side>0)I.push(0,d,b);else I.push(0,b,d);}for(let r=1;r<nr;r++)for(let j=0;j<na;j++){const aa=1+(r-1)*na+j,b=1+(r-1)*na+(j+1)%na,d=1+r*na+j,e=1+r*na+(j+1)%na;if(side>0)I.push(aa,d,b,b,d,e);else I.push(aa,b,d,b,e,d);}
 return{positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind};
}

buildSurfaceEyesR9=function(chart,ctrl,amount){
 const out=[],cx=.392,cy=.951,rx=.0103*ctrl.head_scale*ctrl.eye_scale,ry=.0091*ctrl.head_scale*ctrl.eye_scale;
 for(const side of[-1,1]){
  const iris=__r99SurfacePatch(chart,side,cx,cy,rx,ry,.00078*amount,.00008*amount,'iris');if(iris)out.push(iris);
  const LP=[],LI=[],LUV=[],segments=44,a0=.04*Math.PI,a1=.96*Math.PI;
  for(let k=0;k<=segments;k++){const t=k/segments,aa=a0+(a1-a0)*t,taper=.16+.84*Math.pow(Math.sin(Math.PI*t),.72);for(const rr of[1.00,1.00+.13*taper]){const x=cx+Math.cos(aa)*rx*rr,y=cy+Math.sin(aa)*ry*rr,q=chart.at(x,y,side,(.00010+.00038*taper)*amount);if(!q){LP.length=0;break;}LP.push(...q.p.toArray());LUV.push(Math.cos(aa)*rr,Math.sin(aa)*rr);}if(!LP.length)break;}
  if(LP.length){for(let k=0;k<segments;k++){const aa=k*2,b=aa+1,c=aa+2,d=aa+3;if(side>0)LI.push(aa,c,b,b,c,d);else LI.push(aa,b,c,b,d,c);}out.push({positions:new Float32Array(LP),indices:new Uint32Array(LI),attrs:{uv:{array:new Float32Array(LUV),size:2}},kind:'lid'});}
 }
 window.__CHICKEN_R991_EYE_AUDIT__={patches:out.length,expected:4,geometry:'shallow_surface_dome_plus_upper_lid',center:[cx,cy],radius:[rx,ry]};return out;
};

buildEarLobesR9=function(){return[];};

buildNostrilsR9=function(chart,ctrl,amount){const out=[],cx=.456,cy=.936,rx=.0027*ctrl.head_scale,ry=.00125*ctrl.head_scale;for(const side of[-1,1]){const patch=__r99SurfacePatch(chart,side,cx,cy,rx,ry,.00012*amount,.00003*amount,'nostril');if(patch)out.push(patch);}window.__CHICKEN_R991_NOSTRIL_AUDIT__={patches:out.length,center:[cx,cy],radius:[rx,ry]};return out;};

buildSoftTissueR9=function(ctrl,chart,amount){
 const out=[];for(const side of[-1,1]){const root=chart.at(.414,.899,side,.0014*amount);if(!root)continue;const P=[],I=[],UV=[],ns=30,na=24;
  for(let i=0;i<ns;i++){const s=i/(ns-1),shape=.13+.87*Math.pow(Math.sin(Math.PI*s),.78),x=.414-.008*s-.0015*Math.sin(Math.PI*s),y=.899-.052*s+.0025*Math.sin(Math.PI*s),rx=.0068*shape*ctrl.soft_tissue_scale,rz=.0046*shape*ctrl.soft_tissue_scale,cz=root.p.z+side*(.0018+.0028*shape);
   for(let j=0;j<na;j++){const aa=2*Math.PI*j/na;P.push(x+rx*Math.cos(aa),y,cz+side*rz*Math.sin(aa));UV.push(s,j/na);}}
  for(let i=0;i<ns-1;i++)for(let j=0;j<na;j++){const aa=i*na+j,b=i*na+(j+1)%na,c=(i+1)*na+(j+1)%na,d=(i+1)*na+j;if(side>0)I.push(aa,d,b,b,d,c);else I.push(aa,b,d,b,c,d);}out.push({positions:new Float32Array(P),indices:new Uint32Array(I),attrs:{uv:{array:new Float32Array(UV),size:2}},kind:'lid'});
 }
 window.__CHICKEN_R991_WATTLE_AUDIT__={patches:out.length,attached:true,root:[.414,.899],length:.052};return out;
};

const __r99FilterPartTriangles=filterPartTriangles;
filterPartTriangles=function(exclude){const local=new Set(exclude);local.add(3);local.add(4);window.__CHICKEN_R991_PART_AUDIT__={legacyEyesExcluded:local.has(1)&&local.has(2),legacyEarLobesExcluded:true,legacyNostrilsExcluded:local.has(5)&&local.has(6),excluded:[...local].sort((a,b)=>a-b)};return __r99FilterPartTriangles(local);};

const __r99BaseUpdateState=updateState;
updateState=function(){__r99BaseUpdateState();if($('status'))$('status').textContent=`R9.9.1 · 连续环带头颈 + 原位短喙 + 贴附眼部 · ${stats?.eyePatches||0} 个眼部片`;if($('notes'))$('notes').innerHTML='R9.9.1从冻结 R9.1 连续网格直接重排头颈环带：缩短长楔形喙、抬起下颌线、收窄颈头过渡，并替换悬浮面部零件。<br>本候选仍只用于 3–5 米形态门；视觉通过前，Rig、Motion 与群体测试保持关闭。';};
