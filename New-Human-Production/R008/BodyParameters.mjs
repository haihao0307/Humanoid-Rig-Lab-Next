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
export function bodyPoint(point,p){
 const [x,y,z]=point,a=Math.abs(x),side=2*ramp(-.035,.035,x)-1,fat=p.fatness<0?p.fatness*.65:p.fatness,m=p.muscle,age=bodyAge(p)-.30*bodyYouth(p);let dx=0,dy=0,dz=0;
 const torso=(1-ramp(.14,.22,a))*ramp(.89,1.02,y)*(1-ramp(1.40,1.50,y)),waist=support(x,y,z,0,1.105,0,.23,.28,.25),belly=support(x,y,z,0,1.105,.09,.21,.27,.22),hip=support(x,y,z,0,.88,0,.25,.25,.28);
 dx+=x*fat*(.22*waist+.10*hip)*torso;dz+=fat*(z*.14*waist+.066*belly)*torso;
 const chest=support(x,y,z,side*.073,1.36,.075,.125,.14,.18)*torso,back=support(x,y,z,side*.065,1.34,-.08,.14,.17,.15)*torso;
 dz+=m*(.030*chest-.020*back);dx+=x*m*.075*chest;
 // Shoulder/upper-arm centreline follows the accepted A pose, not X=0.
 const arm=ramp(.175,.22,a)*(1-ramp(.33,.48,a))*ramp(.94,1.07,y)*(1-ramp(1.43,1.50,y)),armX=side*(.220+(1.42-y)*.21),armZ=-.015;
 const upper=support(x,y,z,armX,1.255,armZ,.075,.25,.12),shoulder=support(x,y,z,side*.215,1.415,0,.075,.09,.095),armGain=fat*.18*arm+m*(.32*upper+.24*shoulder)*ramp(.145,.215,a);
 dx+=(x-armX)*armGain;dz+=(z-armZ)*armGain;
 const leg=ramp(.16,.24,y)*(1-ramp(.88,1.04,y))*ramp(.028,.065,a)*(1-ramp(.20,.38,a)),legX=side*.084,thigh=support(x,y,z,legX,.78,-.008,.13,.29,.18),calf=support(x,y,z,legX,.43,-.018,.09,.20,.12),legGain=fat*.16*leg+m*(.24*thigh+.20*calf)*leg;
 dx+=(x-legX)*legGain;dz+=(z+.008)*legGain;
 // Supports end below the eye collar; wrinkles affect shading, not its opening.
 const cheek=support(x,y,z,side*.052,1.611,.084,.043,.030,.055),jaw=support(x,y,z,side*.049,1.566,.075,.054,.030,.059);
 dx+=side*fat*(.005*cheek+.003*jaw);dz+=fat*.006*cheek+bodyYouth(p)*.0015*cheek;dy-=age*(.0035*cheek+.0025*jaw);dz+=age*.0015*jaw;
 // A common gain reserves deformation room for opposing fat/muscle extremes.
 return [x+dx*.80,y+dy*.80,z+dz*.80];
}
export function bodyNormalMatrix(point,p,h=.00035){
 const J=new Array(9);for(let k=0;k<3;k++){const a=[...point],b=[...point];a[k]+=h;b[k]-=h;const u=bodyPoint(a,p),v=bodyPoint(b,p);for(let j=0;j<3;j++)J[j*3+k]=(u[j]-v[j])/(2*h);}
 const [a,b,c,d,e,f,g,i,j]=J,C=[e*j-f*i,f*g-d*j,d*i-e*g,c*i-b*j,a*j-c*g,b*g-a*i,b*f-c*e,c*d-a*f,a*e-b*d],det=a*C[0]+b*C[1]+c*C[2];
 return {cofactor:C,determinant:det};
}
export function bodyMetrics(p){const scale=bodyScale(p);return {scale,height:p.height,radius:.25*scale*(1+.16*Math.max(0,p.fatness)+.08*Math.max(0,p.muscle)),armClearance:.07*Math.max(0,p.fatness)+.045*Math.max(0,p.muscle),ageAmount:bodyAge(p)};}
