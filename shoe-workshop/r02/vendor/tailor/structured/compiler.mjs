import {validate,clone,SCHEMA,fingerprint} from '../src/core.mjs';
export const LANGUAGE='kaopu-panel-language@1';
const fail=(code,message)=>{throw Error(`${code}: ${message}`);};
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p.every(v=>Math.abs(v)<1000);
const line=(x,h)=>({kind:'line',start:[x,0],end:[x,h]});
const curve=(x,bend,h)=>({kind:'quadratic',start:[x,0],control:[x+bend,h/2],end:[x,h]});
export function example(){
 const h=220,w=90;
 return {schema:LANGUAGE,id:'original-three-panel-curved-swatch',revision:1,units:'mm',description:'手工规范学习；不是图片模型输出或服装成品',panels:[
  {id:'A',left:line(0,h),right:curve(w,-25,h),allowanceMm:8,rows:16,columns:6,placement:{translationMm:[-205,130,0],rotationYDeg:-10},holdTopLeft:true},
  {id:'B',left:curve(0,-25,h),right:curve(w,25,h),allowanceMm:8,rows:16,columns:6,placement:{translationMm:[-50,130,5],rotationYDeg:0},holdTopLeft:false},
  {id:'C',left:curve(0,25,h),right:line(w,h),allowanceMm:8,rows:16,columns:6,placement:{translationMm:[105,130,0],rotationYDeg:10},holdTopLeft:false}
 ],stitches:[
  {id:'left-curve',a:{panelId:'A',edge:'right',reverse:false},b:{panelId:'B',edge:'left',reverse:true},easeMm:0,notches:['N1','N2'],stageId:'join-left'},
  {id:'right-curve',a:{panelId:'B',edge:'right',reverse:false},b:{panelId:'C',edge:'left',reverse:true},easeMm:0,notches:['N1','N2'],stageId:'join-right'}
 ],stages:[{id:'cut',requires:[],seams:[]},{id:'join-left',requires:['cut'],seams:['left-curve']},{id:'join-right',requires:['join-left'],seams:['right-curve']}],productionReady:false};
}
export function evaluate(c,t){if(c.kind==='line')return c.start.map((x,k)=>x+(c.end[k]-x)*t);const q=1-t;return c.start.map((x,k)=>q*q*x+2*q*t*c.control[k]+t*t*c.end[k]);}
export function tangent(c,t){if(c.kind==='line')return c.end.map((x,k)=>x-c.start[k]);return c.start.map((x,k)=>2*((1-t)*(c.control[k]-x)+t*(c.end[k]-c.control[k])));}
function validateCurve(c,label){if(!c||!['line','quadratic'].includes(c.kind)||!point(c.start)||!point(c.end)||c.kind==='quadratic'&&!point(c.control))fail('CURVE_SCHEMA',label);if(Math.abs(c.start[1])>1e-9||c.end[1]<80||c.end[1]>400)fail('CURVE_AXIS',label+' must start at y=0 and end at y=80…400 mm');if(c.kind==='quadratic'&&Math.abs(c.control[1]-c.end[1]/2)>1e-7)fail('CURVE_SUPPORT',label+' R1 requires the quadratic control at half height; free 2D curve layout is not yet supported');}
function mesh(p){
 validateCurve(p.left,p.id+'.left');validateCurve(p.right,p.id+'.right');
 if(Math.abs(p.left.end[1]-p.right.end[1])>1e-7)fail('PANEL_HEIGHT',p.id);
 const d0=tangent(p.right,0)[0]-tangent(p.left,0)[0],d1=tangent(p.right,1)[0]-tangent(p.left,1)[0],extreme=d1===d0?-1:-d0/(d1-d0);
 if(extreme>0&&extreme<1&&evaluate(p.right,extreme)[0]-evaluate(p.left,extreme)[0]<30)fail('PANEL_WIDTH',p.id+' analytic curve interval crosses or narrows below 30 mm');
 if(!Number.isInteger(p.rows)||p.rows<4||p.rows>32||!Number.isInteger(p.columns)||p.columns<3||p.columns>16)fail('RESOLUTION',p.id+' supported rows 4…32, columns 3…16');
 if(!Number.isFinite(p.allowanceMm)||p.allowanceMm<2||p.allowanceMm>15)fail('ALLOWANCE_RANGE',p.id);
 if(typeof p.holdTopLeft!=='boolean')fail('HOLD_DECLARATION',p.id);
 if(!p.placement)fail('PLACEMENT',p.id+' explicit rigid placement required');
 const uvMm=[],cols=p.columns+3,at=(i,j)=>j*cols+i,triangles=[],parameterSamples=[];
 for(let j=0;j<=p.rows;j++){
  const t=j/p.rows,l=evaluate(p.left,t),r=evaluate(p.right,t),lt=tangent(p.left,t),rt=tangent(p.right,t),ln=Math.hypot(...lt),rn=Math.hypot(...rt);
  if(r[0]-l[0]<30||ln<1e-5||rn<1e-5)fail('PANEL_WIDTH',p.id+' crosses or is narrower than 30 mm');
  const a=p.allowanceMm;uvMm.push([l[0]-a*lt[1]/ln,l[1]+a*lt[0]/ln]);
  for(let i=0;i<=p.columns;i++)uvMm.push([l[0]+(r[0]-l[0])*i/p.columns,l[1]]);
  uvMm.push([r[0]+a*rt[1]/rn,r[1]-a*rt[0]/rn]);parameterSamples.push(t);
 }
 for(let j=0;j<p.rows;j++)for(let i=0;i<cols-1;i++){const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);triangles.push([a,b,d],[a,d,c]);}
 const boundary=[...Array.from({length:cols},(_,i)=>at(i,0)),...Array.from({length:p.rows},(_,j)=>at(cols-1,j+1)),...Array.from({length:cols-1},(_,i)=>at(cols-i-2,p.rows)),...Array.from({length:p.rows-1},(_,j)=>at(0,p.rows-j-1))];
 const left=Array.from({length:p.rows+1},(_,j)=>at(1,p.rows-j)),right=Array.from({length:p.rows+1},(_,j)=>at(cols-2,j));
 const error=c=>{let max=0;for(let i=0;i<p.rows;i++){const a=evaluate(c,i/p.rows),b=evaluate(c,(i+1)/p.rows),m=evaluate(c,(i+.5)/p.rows);max=Math.max(max,Math.hypot(m[0]-(a[0]+b[0])/2,m[1]-(a[1]+b[1])/2));}return max;};
 return {id:p.id,source:{kind:'original_structured_curve_panel',version:'curve-compiler-r1',curves:{left:clone(p.left),right:clone(p.right)},parameterSamples},materialId:'uncalibrated-demo',uvMm,triangles,boundary,edges:{left,right},edgeNotches:{left:[{id:'N1',t:.75},{id:'N2',t:.25}],right:[{id:'N1',t:.25},{id:'N2',t:.75}]},grain:[0,1],seamAllowanceMm:p.allowanceMm,allowanceState:'meshed_flat_unfolded',allowanceMethod:'analytic-normal-offset-at-samples; straight caps; digital experiment only',placement:clone(p.placement),temporaryPins:p.holdTopLeft?[at(1,0)]:[],curveApproximation:{method:'uniform-parameter polyline',maxMidpointErrorMm:Math.max(error(p.left),error(p.right)),notManufacturingCertified:true},netCurves:{left:clone(p.left),right:clone(p.right)}};
}
export function compile(input){
 if(!input||input.schema!==LANGUAGE||input.units!=='mm'||input.productionReady!==false)fail('LANGUAGE_SCHEMA','expected original mm learning specification with productionReady=false');
 if(!Number.isInteger(input.revision)||input.revision<1)fail('REVISION','positive integer required');
 if(!Array.isArray(input.panels)||input.panels.length<2||input.panels.length>8)fail('PANEL_COUNT','2…8 original panels supported');
 if(!Array.isArray(input.stitches)||!Array.isArray(input.stages))fail('TOPOLOGY','stitches and construction stages required');
 const spec={schema:SCHEMA,id:input.id,revision:input.revision,units:'mm',purpose:'manual-structured-language-learning',sourceLanguage:{schema:LANGUAGE,compiler:'curve-compiler-r1',signature:fingerprint(input),input:clone(input)},materials:[{id:'uncalibrated-demo',densityKgM2:.2,stretchCompliance:1e-7,bendCompliance:.02,calibrated:false}],panels:input.panels.map(mesh),seams:clone(input.stitches),stages:clone(input.stages),acceptance:{productionReady:false,fitValidated:false}};
 const report=validate(spec),maxCurveApproximationErrorMm=Math.max(...spec.panels.map(p=>p.curveApproximation.maxMidpointErrorMm));
 if(maxCurveApproximationErrorMm>.5)fail('CURVE_RESOLUTION','curve chord error exceeds 0.5 mm; increase rows rather than hiding the curve');
 return {spec,report:{...report,sourceSignature:fingerprint(input),curveCount:input.panels.reduce((s,p)=>s+['left','right'].filter(k=>p[k].kind==='quadratic').length,0),maxCurveApproximationErrorMm,imageInferenceImplemented:false,garmentAssemblyAccepted:false}};
}
