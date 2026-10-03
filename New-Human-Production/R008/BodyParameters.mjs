// Adult art controls calibrated to this collected 1.8 m character. Not a
// population/medical model. Recipes contain no meshes or sampled vertex arrays.
export const BODY_DEFAULT=Object.freeze({schema:'human-r008/body@1',height:1.8,fatness:0,muscle:0,age:32});
export const BODY_CONTROLS=Object.freeze([
 {key:'height',label:'身高（米）',min:1.60,max:2.05,step:.01},
 {key:'fatness',label:'胖瘦 · 0 为原体型',min:-1,max:1,step:.01},
 {key:'muscle',label:'肌肉量 · 0 为原体型',min:-1,max:1,step:.01},
 {key:'age',label:'年龄外观（成人）',min:18,max:75,step:1}
]);
export const BODY_PRESETS=Object.freeze({reference:{label:'原人物',recipe:{}},young:{label:'年轻成人',recipe:{age:20}},lean:{label:'清瘦',recipe:{height:1.8,fatness:-.65,muscle:-.35,age:25}},athletic:{label:'健壮',recipe:{height:1.88,fatness:-.25,muscle:.85,age:32}},fuller:{label:'丰满',recipe:{height:1.75,fatness:.80,muscle:-.15,age:45}},older:{label:'年长',recipe:{height:1.8,fatness:.15,muscle:-.30,age:68}}});
export function normalizeBody(input={}){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(BODY_DEFAULT,k)))throw Error('体型配方无效');const p={...BODY_DEFAULT,...input};if(p.schema!==BODY_DEFAULT.schema)throw Error('体型配方版本无效');for(const c of BODY_CONTROLS)if(!Number.isFinite(p[c.key])||p[c.key]<c.min||p[c.key]>c.max)throw Error(c.label+'超出范围');return p;}
export const bodyScale=p=>p.height/1.8;
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},ramp=(a,b,x)=>smooth((x-a)/(b-a));
const support=(x,y,z,cx,cy,cz,rx,ry,rz)=>{const q=((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2;return q<1?(1-q)**3:0;};
export function bodyAge(p){return smooth((p.age-32)/43);}
export function bodyYouth(p){return smooth((32-p.age)/14);}
// Composition changes soft tissue, never joint frames or bone lengths.
// Art-directed age envelope; it does not represent a measured muscle percentage.
export function bodyCoefficients(p){const old=bodyAge(p),young=bodyYouth(p),m=p.muscle*(1-.30*old-.10*young)-.42*old-.12*young;return [p.fatness<0?p.fatness*.70:p.fatness,m<0?m*.75:m,old,young];}
// Scalar-only authored field is also translated to GLSL below. CPU skin queries
// and GPU drawing therefore execute the same equations, including normal maps.
function bodyShape(x,y,z,fat,m,old,young,torso,arm,leg,end,ax,ay,az){
 const a=Math.abs(x),side=2*ramp(-.035,.035,x)-1;
 const waist=ramp(.89,1.03,y)*(1-ramp(1.23,1.44,y)),hip=ramp(.69,.84,y)*(1-ramp(1.01,1.18,y)),chest=ramp(1.12,1.29,y)*(1-ramp(1.43,1.55,y));
 // Chest/pelvis support cannot collapse with fat loss. Only the distance
 // outside authored support widths changes; these are art envelopes, not CT.
 const rib=ramp(1.17,1.29,y)*(1-ramp(1.43,1.52,y)),pelvis=ramp(.74,.88,y)*(1-ramp(1.02,1.12,y));
 const bx=.035+.075*rib+.070*pelvis,bz=.025+.044*rib+.032*pelvis;
 const tx=softTissue(x,bx,.025),tz=softTissue(z+.008,bz,.018);
 const pec=ramp(1.25,1.31,y)*(1-ramp(1.38,1.45,y));
 const driveX=fat*(.85*waist+.45*hip-.32*waist*hip+.36*chest-.20*waist*chest)+m*.55*pec;
 const driveZ=fat*(.85*waist+.55*hip-.42*waist*hip+.55*chest-.35*waist*chest)+m*.90*pec;
 const limitX=driveX<0?.65:.85,limitZ=driveZ<0?.65:1.30;
 const torsoX=limitX*Math.tanh(driveX/limitX),torsoZ=limitZ*Math.tanh(driveZ/limitZ);
 let dx=torso*tx*torsoX,dy=0,dz=torso*tz*torsoZ;
 // Eight inherited skin weights select tissue ownership. Each limb is radial
 // about its own bind-bone segment, including actual finger/toe anchors.
 const rx=x-ax,ry=y-ay,rz=z-az,radius=Math.sqrt(rx*rx+ry*ry+rz*rz+.0000000001);
 const shoulder=ramp(1.30,1.37,y)*(1-ramp(1.45,1.53,y));
 const biceps=ramp(1.14,1.21,y)*(1-ramp(1.32,1.40,y));
 const forearm=ramp(.97,1.02,y)*(1-ramp(1.10,1.16,y));
 const quad=ramp(.55,.64,y)*(1-ramp(.82,.94,y));
 const calf=ramp(.18,.27,y)*(1-ramp(.44,.52,y));
 const palm=ramp(.79,.82,y)*(1-ramp(.91,.95,y)),foot=1-ramp(.16,.23,y);
 const limb=arm+leg+end;
 const core=(arm*(.014+.007*biceps+.012*shoulder)+leg*(.019+.009*quad)+end*(.0045+.008*palm+.012*foot))/Math.max(.0001,limb);
 const belly=arm*(.10+.65*biceps+.75*shoulder+.40*forearm)+leg*(.10+.70*quad+.65*calf)+end*(.06+.10*palm+.04*foot);
 const fatty=arm*.70+leg*.70+end*(.30-.12*foot);
 const drive=(fat*fatty+m*belly)/Math.max(.0001,limb),limit=drive<0?.65:.88,gain=limit*Math.tanh(drive/limit);
 const tissue=Math.max(0,radius-core),amount=tissue*tissue/(tissue+.006)/radius*gain*limb;
 // Limb longitudinal samples retain their rest height. This prevents the
 // shoulder envelope from pulling into the clavicle at low composition.
 // Foot padding may change vertically, while sole contact remains fixed.
 dx+=rx*amount;dy+=ry*amount*end*foot*ramp(.004,.025,y);dz+=rz*amount;
 const tissueGate=1-ramp(1.54,1.62,y);dx*=tissueGate;dy*=tissueGate;dz*=tissueGate;
 // Lower face fullness follows body composition; fixed eye collars are outside
 // both supports. Neck has its own broad, modest thickness control.
 const head=1-ramp(.07,.13,a),cheek=ramp(1.565,1.601,y)*(1-ramp(1.614,1.643,y))*head,jaw=ramp(1.526,1.555,y)*(1-ramp(1.590,1.618,y))*head,neck=ramp(1.45,1.49,y)*(1-ramp(1.55,1.585,y))*(1-ramp(.07,.12,a));
 const faceOuter=ramp(.024,.060,a);
 dx+=side*fat*(.008*cheek+.005*jaw)*faceOuter+softTissue(x,.028,.008)*m*(.07*cheek+.13*jaw)+softTissue(x,.027,.010)*neck*(fat*.36+m*.25);
 dz+=(z-.020)*fat*(.09*cheek+.06*jaw)*faceOuter+young*.0015*cheek+(z-.008)*neck*(fat*.18+m*.12)+m*.0015*jaw;
 dy-=(old-.30*young)*(.004*cheek+.003*jaw);dz+=old*.0015*jaw;
 return [x+dx,y+dy,z+dz];
}
function softTissue(d,core,transition){const e=Math.max(0,Math.abs(d)-core);return Math.sign(d)*e*e/(e+transition);}
// Standalone queries use an explicit fallback. Production uses measured bind
// segments and all eight weights through BodyTissue.mjs; no guessed leg axis.
export function bodyContext([x,y,z]){const a=Math.abs(x),side=Math.sign(x),arm=ramp(.16,.25,a)*ramp(.92,1.,y)*(1-ramp(1.47,1.55,y)),hand=ramp(.25,.29,a)*ramp(.68,.74,y)*(1-ramp(.90,.96,y)),foot=1-ramp(.13,.20,y),end=hand+foot,leg=(1-ramp(.9,1.,y))*ramp(.13,.20,y)*(1-hand);const elbow=ramp(1.13,1.18,y),ax=arm?side*((.339+(.938-y)*.28)*(1-elbow)+(.193+(1.410-y)*.333)*elbow):side*(.172-.035*ramp(.09,.52,y)-.021*ramp(.52,.94,y)),az=arm?-.060*ramp(.928,1.156,y):-.046+.035*ramp(.09,.52,y);return {region:[(1-arm)*(1-leg)*(1-end)*(1-ramp(1.46,1.55,y)),arm,leg,end],anchor:[ax,y,az]};}
export function bodyPoint(point,p,context=bodyContext(point)){return bodyShape(...point,...bodyCoefficients(p),...context.region,...context.anchor);}
const scalarGLSL=bodyShape.toString().replace('function bodyShape(x,y,z,fat,m,old,young,torso,arm,leg,end,ax,ay,az)','vec3 bodyShape(float x,float y,float z,float fat,float m,float old,float young,float torso,float arm,float leg,float end,float ax,float ay,float az)').replace(/\b(?:const|let)\b/g,'float').replace(/Math\./g,'').replace('return [x+dx,y+dy,z+dz];','return vec3(x+dx,y+dy,z+dz);').replace(/(?<![\w.])\d+(?![\w.])/g,v=>v+'.0');
export const BODY_FIELD_GLSL=`
float ramp(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float support(float x,float y,float z,float cx,float cy,float cz,float rx,float ry,float rz){float a=(x-cx)/rx,b=(y-cy)/ry,c=(z-cz)/rz,q=a*a+b*b+c*c;return q<1.?pow(1.-q,3.):0.;}
float softTissue(float d,float core,float transition){float e=max(0.,abs(d)-core);return sign(d)*e*e/(e+transition);}
${scalarGLSL}
vec3 bodyPointGPU(vec3 p,vec4 c,vec4 r,vec3 a){return bodyShape(p.x,p.y,p.z,c.x,c.y,c.z,c.w,r.x,r.y,r.z,r.w,a.x,a.y,a.z);}
`;
export function bodyNormalMatrix(point,p,h=.00035,context){
 const J=new Array(9);for(let k=0;k<3;k++){const a=[...point],b=[...point];a[k]+=h;b[k]-=h;const u=bodyPoint(a,p,context),v=bodyPoint(b,p,context);for(let j=0;j<3;j++)J[j*3+k]=(u[j]-v[j])/(2*h);}
 const [a,b,c,d,e,f,g,i,j]=J,C=[e*j-f*i,f*g-d*j,d*i-e*g,c*i-b*j,a*j-c*g,b*g-a*i,b*f-c*e,c*d-a*f,a*e-b*d],det=a*C[0]+b*C[1]+c*C[2];
 return {cofactor:C,determinant:det};
}
export function bodyMetrics(p){const scale=bodyScale(p),m=bodyCoefficients(p)[1];return {scale,height:p.height,radius:.25*scale*(1+.36*Math.max(0,p.fatness)+.18*Math.max(0,m)),armClearance:.19*Math.max(0,p.fatness)+.13*Math.max(0,m),ageAmount:bodyAge(p),effectiveMuscle:m,variationVersion:3,skeletalScaleFromComposition:1};}
