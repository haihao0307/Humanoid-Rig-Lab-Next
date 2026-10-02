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
// Same spatial map across skin, clothing and material seams. Limbs expand
// around their own reference centreline; feet, palms and eye sockets stay fixed.
// Art-directed age envelope; it does not represent a measured muscle percentage.
export function bodyCoefficients(p){const old=bodyAge(p),young=bodyYouth(p),m=p.muscle*(1-.30*old-.10*young)-.42*old-.12*young;return [p.fatness<0?p.fatness*.70:p.fatness,m<0?m*.75:m,old,young];}
// Scalar-only authored field is also translated to GLSL below. CPU skin queries
// and GPU drawing therefore execute the same equations, including normal maps.
function bodyShape(x,y,z,fat,m,old,young){
 const a=Math.abs(x),side=2*ramp(-.035,.035,x)-1;
 const waist=ramp(.89,1.03,y)*(1-ramp(1.23,1.44,y)),hip=ramp(.69,.84,y)*(1-ramp(1.01,1.18,y)),chest=ramp(1.12,1.29,y)*(1-ramp(1.43,1.55,y));
 // Broad lateral field shifts the shoulder envelope along with the torso.
 // Exponential depth scales cannot turn the front/back of a cross-section over.
 const core=1-ramp(.15,.235,a),lateral=fat*(.62*waist+.26*hip+.24*chest)+m*.16*chest;
 let dx=.12*Math.tanh(x/.12)*lateral*(1-ramp(.16,.50,a)),dy=0,dz=(z+.008)*(Math.exp(core*(fat*(.50*waist+.30*hip-.20*waist*hip+.28*chest)+m*.50*chest))-1)+fat*.030*waist*core;
 // Canonical centreline from this subject's shoulder/elbow/wrist bind frames.
 const arm=ramp(.14,.26,a)*ramp(.88,1.00,y)*(1-ramp(1.46,1.56,y)),elbowBlend=ramp(1.13,1.18,y),armX=side*((.339+(.938-y)*.28)*(1-elbowBlend)+(.193+(1.410-y)*.333)*elbowBlend),armZ=-.060*ramp(.928,1.156,y)+.006*ramp(1.32,1.43,y),upper=ramp(1.03,1.15,y),shoulder=ramp(1.33,1.42,y);
 const armGain=Math.exp(arm*(fat*.48+m*(.15+.25*upper+.05*shoulder)))-1;
 dx+=(x-armX)*armGain*.40;dz+=(z-armZ)*armGain;
 const leg=ramp(.14,.27,y)*(1-ramp(.84,.94,y))*ramp(.012,.085,a)*(1-ramp(.18,.35,a)),thigh=ramp(.50,.67,y),calf=ramp(.20,.34,y)*(1-ramp(.50,.62,y)),legX=side*.084;
 const legGain=Math.exp(leg*(fat*.42+m*(.34*thigh+.25*calf)))-1;
 dx+=(x-legX)*(.50*Math.tanh(legGain/.50))*.40;dz+=(z+.008)*legGain;
 // Lower face fullness follows body composition; fixed eye collars are outside
 // both supports. Neck has its own broad, modest thickness control.
 const cheek=ramp(1.565,1.601,y)*(1-ramp(1.614,1.643,y)),jaw=ramp(1.526,1.555,y)*(1-ramp(1.590,1.618,y)),neck=ramp(1.45,1.49,y)*(1-ramp(1.55,1.585,y));
 const faceOuter=ramp(.024,.060,a);
 dx+=side*fat*(.008*cheek+.005*jaw)*faceOuter+x*m*(.025*cheek+.045*jaw)+x*neck*(fat*.15+m*.10);
 dz+=(z-.020)*fat*(.09*cheek+.06*jaw)*faceOuter+young*.0015*cheek+(z-.008)*neck*(fat*.18+m*.12)+m*.0015*jaw;
 dy-=(old-.30*young)*(.004*cheek+.003*jaw);dz+=old*.0015*jaw;
 return [x+dx,y+dy,z+dz];
}
export function bodyPoint(point,p){return bodyShape(...point,...bodyCoefficients(p));}
const scalarGLSL=bodyShape.toString().replace('function bodyShape(x,y,z,fat,m,old,young)','vec3 bodyShape(float x,float y,float z,float fat,float m,float old,float young)').replace(/\b(?:const|let)\b/g,'float').replace(/Math\./g,'').replace('return [x+dx,y+dy,z+dz];','return vec3(x+dx,y+dy,z+dz);').replace(/(?<![\w.])\d+(?![\w.])/g,v=>v+'.0');
export const BODY_FIELD_GLSL=`
float ramp(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float support(float x,float y,float z,float cx,float cy,float cz,float rx,float ry,float rz){float a=(x-cx)/rx,b=(y-cy)/ry,c=(z-cz)/rz,q=a*a+b*b+c*c;return q<1.?pow(1.-q,3.):0.;}
${scalarGLSL}
vec3 bodyPointGPU(vec3 p,vec4 c){return bodyShape(p.x,p.y,p.z,c.x,c.y,c.z,c.w);}
`;
export function bodyNormalMatrix(point,p,h=.00035){
 const J=new Array(9);for(let k=0;k<3;k++){const a=[...point],b=[...point];a[k]+=h;b[k]-=h;const u=bodyPoint(a,p),v=bodyPoint(b,p);for(let j=0;j<3;j++)J[j*3+k]=(u[j]-v[j])/(2*h);}
 const [a,b,c,d,e,f,g,i,j]=J,C=[e*j-f*i,f*g-d*j,d*i-e*g,c*i-b*j,a*j-c*g,b*g-a*i,b*f-c*e,c*d-a*f,a*e-b*d],det=a*C[0]+b*C[1]+c*C[2];
 return {cofactor:C,determinant:det};
}
export function bodyMetrics(p){const scale=bodyScale(p),m=bodyCoefficients(p)[1];return {scale,height:p.height,radius:.25*scale*(1+.36*Math.max(0,p.fatness)+.18*Math.max(0,m)),armClearance:.19*Math.max(0,p.fatness)+.13*Math.max(0,m),ageAmount:bodyAge(p),effectiveMuscle:m,variationVersion:2};}
