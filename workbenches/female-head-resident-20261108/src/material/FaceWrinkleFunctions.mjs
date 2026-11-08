import{photoWrinkleLayout}from'./FaceWrinklePhotoLayout.mjs';
// Authored regional appearance model, not a measured subject or a tissue solver.
// Research and representation limits: docs/skin-knowledge/20261030-regional-wrinkles.md
export const FACE_WRINKLE_REVISION='regional-photo-relief-20261030-r7';
export const FACE_WRINKLE_REGIONS=Object.freeze([
 {key:'forehead',label:'额头横纹',direction:'横向弧线；额肌作用',static:.42},
 {key:'glabella',label:'眉间纵纹',direction:'纵向与斜向；皱眉肌作用',static:.22},
 {key:'canthus',label:'外眼角放射纹',direction:'围绕外眦扇形展开',static:.42},
 {key:'infraorbital',label:'下眼睑细纹',direction:'沿下眼眶弧线',static:.48},
 {key:'perioral',label:'口周细纹',direction:'唇外皮肤近径向；避开唇红',static:.24},
 {key:'cheek',label:'面颊细纹',direction:'稀疏交叉；两组局部方向',static:.32},
 {key:'chin',label:'颏部细纹',direction:'短弧形；避免取代颏唇沟',static:.25},
 {key:'root',label:'鼻根横纹',direction:'短横向；鼻锥肌作用',static:.16}
]);
export const FACE_WRINKLE_DEFAULTS=Object.freeze({enabled:true,strength:1,rest:1,compression:.30,width:1,micro:1,seed:731,view:0,regions:Object.freeze(Object.fromEntries(FACE_WRINKLE_REGIONS.map(r=>[r.key,1])))});
export const FACE_WRINKLE_STUDY_DEFAULTS=Object.freeze({...FACE_WRINKLE_DEFAULTS,strength:2.2,rest:1.2,compression:.5,width:1.15});
export function validateFaceWrinkles(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('皱纹变量无效');
 const allowed=Object.keys(FACE_WRINKLE_DEFAULTS);if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('存在未知的皱纹变量');
 const v={...structuredClone(FACE_WRINKLE_DEFAULTS),...input,regions:{...FACE_WRINKLE_DEFAULTS.regions,...input.regions}};
 if(typeof v.enabled!=='boolean')throw Error('皱纹开关无效');
 for(const [k,a,b]of[['strength',0,3],['rest',0,2],['compression',0,1],['width',.5,2],['micro',0,2],['seed',0,4294967295],['view',0,3]])if(!Number.isFinite(v[k])||v[k]<a||v[k]>b||(['seed','view'].includes(k)&&!Number.isInteger(v[k])))throw Error('皱纹变量超出范围：'+k);
 if(input.regions!==undefined&&(!input.regions||typeof input.regions!=='object'||Array.isArray(input.regions)))throw Error('皱纹分区无效');
 for(const [k,a]of Object.entries(v.regions))if(!FACE_WRINKLE_REGIONS.some(r=>r.key===k)||!Number.isFinite(a)||a<0||a>2)throw Error('皱纹区域无效：'+k);
 return v;
}
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
// Millimetres in the existing source rest-coordinate chart. These are authored
// instance anchors. Neither their positions nor their widths are clinical data.
export function faceWrinkleCurves(input=FACE_WRINKLE_DEFAULTS){
 const v=validateFaceWrinkles(input),rand=random(v.seed);
 return photoWrinkleLayout().map(q=>{const ri=FACE_WRINKLE_REGIONS.findIndex(r=>r.key===q.region),r=FACE_WRINKLE_REGIONS[ri],activation=v.rest*r.static+v.compression*(1-r.static);return{...q,ri,w:q.w*v.width,depth:q.depth*activation*v.strength*v.regions[q.region],phase:rand()*Math.PI*2};});
}
export const FACE_WRINKLE_MAX_CURVES=96;
export function faceWrinkleUniforms(input){const v=validateFaceWrinkles(input),curves=faceWrinkleCurves(v),a=new Float32Array(96*4),b=new Float32Array(96*4),c=new Float32Array(96*4),d=new Float32Array(96*4),e=new Float32Array(96*4);if(curves.length>96)throw Error('皱纹曲线数量超限');curves.forEach((q,i)=>{a.set([q.x,q.y,q.tx,q.ty],i*4);b.set([q.L,q.w,q.depth,q.bend],i*4);c.set([q.wave,q.freq,q.phase,q.ri],i*4);d.set((q.poly||[]).slice(0,4),i*4);e.set([...(q.poly||[0,0,0,0,0,0,0]).slice(4,7),q.bank||0],i*4);});return{u_fwA:a,u_fwB:b,u_fwC:c,u_fwD:d,u_fwE:e,u_fwCount:curves.length,u_fwView:v.view,u_fwMicro:v.micro*v.strength*(.65*v.rest+.35*v.compression),u_fwMicroSeed:v.seed,u_fwRegions0:[v.regions.forehead,v.regions.glabella,v.regions.canthus,v.regions.infraorbital],u_fwRegions1:[v.regions.perioral,v.regions.cheek,v.regions.chin,v.regions.root]};}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function faceWrinkleProtection(p,{lip=0,ear=0,lidDistance=99,lidCoverage=0}={}){return smooth((p[2]-72)/24)*(1-smooth((lip-.01)/.11))*(1-smooth((ear-.01)/.07))*(1-Math.max(0,Math.min(1,lidCoverage))*(1-smooth((Math.abs(lidDistance)-.0009)/.0017)));}
// Quintic, deterministic 1D morphology variation; no image or screen-space seed.
function wrinkleNoise(x,scale,seed){const u=x/scale,i=Math.floor(u),t=u-i,f=t*t*t*(t*(t*6-15)+10),df=30*t*t*(t-1)*(t-1)/scale;function h(j){let a=((j>>>0)+Math.imul(seed,374761393))>>>0;a=Math.imul(a^(a>>>13),1274126177)>>>0;a=(a^(a>>>16))>>>0;return(a&65535)/65535;}const a=h(i),b=h(i+1);return[a+(b-a)*f,(b-a)*df];}
function curvePolynomial(q,t){const c=q.poly||[],b=[[1,0],[t,1]];for(let i=2;i<7;i++)b.push([2*t*b[i-1][0]-b[i-2][0],2*b[i-1][0]+2*t*b[i-1][1]-b[i-2][1]]);return b.reduce((r,v,i)=>[r[0]+(c[i]||0)*v[0],r[1]+(c[i]||0)*v[1]],[0,0]);}
export function wrinkleCurveCentre(q,u){const t=u/q.L,seed=Math.floor(Math.fround(q.phase)*1024+.5),n6=wrinkleNoise(u,6,seed),n17=wrinkleNoise(u,1.7,seed+17),morph=Math.min(.32,q.w*.8),fine=Math.min(.055,q.w*.18),poly=curvePolynomial(q,t);return[q.bend*t*t+q.wave*Math.sin(q.freq*t+q.phase)+poly[0]+morph*(n6[0]-.5)+fine*(n17[0]-.5),2*q.bend*t/q.L+q.wave*q.freq/q.L*Math.cos(q.freq*t+q.phase)+poly[1]/q.L+morph*n6[1]+fine*n17[1]];}
// CPU reference: a narrow furrow plus a wider skin bank, both differentiable.
export function sampleWrinkleCurve(q,p,footprint=0){
 const x=p[0]-q.x,y=p[1]-q.y,u=x*q.tx+y*q.ty,v=-x*q.ty+y*q.tx,t=u/q.L;if(Math.abs(t)>=1)return[0,0,0];
 const f=smooth((1-Math.abs(t))/.35),df=Math.abs(t)>.65?-6*((1-Math.abs(t))/.35)*(1-(1-Math.abs(t))/.35)*Math.sign(t)/(.35*q.L):0,seed=Math.floor(Math.fround(q.phase)*1024+.5),n7=wrinkleNoise(u,7,seed+31),n12=wrinkleNoise(u,12,seed+53),[center,slope]=wrinkleCurveCentre(q,u),wf=.72+.56*n7[0],w0=q.w*(.35+.65*f)*wf,w0u=q.w*(.65*df*wf+(.35+.65*f)*.56*n7[1]),base=.80+.20*Math.cos(4.1*t+q.phase),growth=.4+.8*n12[0],lobe=base*growth,dl=-.82*Math.sin(4.1*t+q.phase)/q.L*growth+base*.8*n12[1];
 function component(scale){const wo=w0*scale,wou=w0u*scale,w=Math.sqrt(wo*wo+.16*footprint*footprint),wu=wo*wou/w,z=(v-center)/w;if(Math.abs(z)>7)return[0,0,0];const e1=Math.exp(-.5*z*z),e2=Math.exp(-z*z/8),profile=e2-2*e1,dp=z*(2*e1-.25*e2),ratio=wo/w,dr=(wou*w-wo*wu)/(w*w),amp=q.depth*ratio*f*lobe,da=q.depth*((dr*f+ratio*df)*lobe+ratio*f*dl);return[amp*profile,da*profile+amp*dp*(-slope/w-z*wu/w),amp*dp/w];}
 const a=component(1),b=component(3.4),bank=q.bank||0,h=a[0]*(1-bank)+b[0]*bank,du=a[1]*(1-bank)+b[1]*bank,dv=a[2]*(1-bank)+b[2]*bank;return[h,du*q.tx-dv*q.ty,du*q.ty+dv*q.tx];
}
// Directional compression from a continuous deformation Jacobian. Kept as a
// separate tested interface until the actual facial solver supplies F at hits.
export function directionalCompression(F,normalDirection){if(!Array.isArray(F)||F.length!==9||F.some(x=>!Number.isFinite(x))||!Array.isArray(normalDirection)||normalDirection.length!==3)throw Error('变形梯度无效');const n=Math.hypot(...normalDirection);if(!(n>0)||normalDirection.some(x=>!Number.isFinite(x)))throw Error('方向无效');const d=normalDirection.map(x=>x/n),a=[0,1,2].map(i=>F[i*3]*d[0]+F[i*3+1]*d[1]+F[i*3+2]*d[2]);return Math.max(0,Math.min(1,1-Math.hypot(...a)));}
