// Authored R008 identity fields. Persist descriptors/recipes, never sampled meshes.
export const FACE_IDENTITY_SOURCE='R008-canonical-face-20261004';
export const FACE_IDENTITY_SCHEMA='human-r008/face-identity@1';
const descriptors=[];
const zero=()=>Array(9).fill(0);
function field(id,label,group,unit,min,max,centre,radii,matrix=zero(),translation=[0,0,0],options={}){
 descriptors.push({id,label,group,unit,min,max,step:unit==='%'?1:.1,centre,radii,matrix,translation,fit:unit!=='mm Z',...options});
}
function scale(id,label,group,axis,centre,radii,min=-16,max=16,options={}){const matrix=zero();matrix[axis*3+axis]=.01;field(id,label,group,'%',min,max,centre,radii,matrix,[0,0,0],options);}
function move(id,label,group,axis,centre,radii,min=-6,max=6,options={}){const translation=[0,0,0];translation[axis]=.001;field(id,label,group,axis===2?'mm Z':'mm',min,max,centre,radii,zero(),translation,options);}
function width(id,label,group,halfWidth,centre,radii,min=-8,max=8){const matrix=zero();matrix[0]=.001/(2*halfWidth);field(id,label,group,'mm',min,max,centre,radii,matrix);}
const face=[0,1.645,.100],whole=[.14,.20,.20];
scale('headWidth','全头宽度','整体',0,face,whole,-12,12,{support:'head'});
scale('headHeight','全头高度','整体',1,[0,1.656,.100],whole,-12,12,{support:'head'});
scale('headDepth','全头前后深度','整体',2,[0,1.656,.020],whole,-12,12,{support:'head',fit:false});
scale('upperFaceLength','眼线以上长度','整体',1,[0,1.656,.100],[.15,.16,.18],-15,15,{support:'upper'});
scale('lowerFaceLength','眼线以下长度','整体',1,[0,1.656,.100],[.15,.16,.18],-15,15,{support:'lower'});
// Forehead length has its own transition above the brows. Increasing the
// upper-face field alone also raises the eyes/brows and cannot fit this ratio.
scale('foreheadHeight','眉间以上额部长度','整体',1,[0,1.670,.100],whole,-20,60,{support:'forehead'});
width('foreheadWidth','额部宽度','轮廓',.070,[0,1.698,.070],[.14,.045,.17]);
move('foreheadProjection','额部前凸','轮廓',2,[0,1.692,.109],[.085,.037,.065]);
width('templeWidth','太阳穴宽度','轮廓',.076,[0,1.662,.065],[.15,.04,.17]);
width('cheekboneWidth','颧部宽度','轮廓',.070,[0,1.634,.066],[.15,.038,.17]);
width('jawWidth','下颌宽度','轮廓',.060,[0,1.566,.040],[.14,.045,.16],-10,10);
move('jawHeight','下颌缘高度','轮廓',1,[0,1.558,.070],[.105,.027,.115],-4,4);
width('chinWidth','下巴宽度','轮廓',.027,[0,1.551,.097],[.085,.030,.120],-12,8);
move('chinHeight','下巴长度（正值向下）','轮廓',1,[0,1.547,.094],[.054,.027,.074],-5,5,{translation:[0,-.001,0]});
move('chinProjection','下巴前凸','轮廓',2,[0,1.553,.108],[.045,.026,.055],-4,4);
scale('noseWidth','鼻部宽度','鼻',0,[0,1.625,.132],[.038,.046,.054],-22,22);
scale('noseLength','鼻部长度','鼻',1,[0,1.663,.123],[.039,.071,.065],-12,12);
scale('bridgeWidth','鼻梁宽度','鼻',0,[0,1.643,.139],[.021,.029,.040],-18,18);
move('bridgeProjection','鼻梁前凸','鼻',2,[0,1.646,.136],[.018,.032,.044],-4,4);
scale('tipWidth','鼻尖宽度','鼻',0,[0,1.624,.151],[.025,.019,.035],-18,18);
move('tipHeight','鼻尖高度','鼻',1,[0,1.624,.151],[.026,.019,.038],-3,3);
move('tipProjection','鼻尖前凸','鼻',2,[0,1.624,.151],[.025,.019,.036],-4,4);
move('noseBaseHeight','鼻底高度','鼻',1,[0,1.612,.128],[.034,.016,.042],-3,3);
scale('mouthWidth','口宽','口',0,[0,1.587,.117],[.055,.030,.063],-22,22);
move('mouthHeight','嘴部高度','口',1,[0,1.587,.117],[.052,.030,.060],-4,4);
scale('upperLipThickness','上唇厚度','口',1,[0,1.587,.122],[.036,.019,.046],-18,18);
scale('lowerLipThickness','下唇厚度','口',1,[0,1.587,.121],[.036,.020,.046],-18,18,{support:'lowerLip'});
descriptors.at(-2).support='upperLip';
move('lipProjection','唇部前凸','口',2,[0,1.587,.125],[.039,.022,.042],-3,3);
move('philtrumLength','人中长度（嘴部向下）','口',1,[0,1.596,.119],[.041,.029,.045],-3,3,{translation:[0,-.001,0]});
for(const sign of [1,-1]){
 const side=sign===1?'Left':'Right',name=sign===1?'左':'右',eye=[sign*.034,1.656,.100],eyeSupport=[.055,.040,.095];
 move('eyeSpacing'+side,name+'眼位置（正值向外）','眼',0,eye,eyeSupport,-3,3,{translation:[sign*.001,0,0]});
 move('eyeHeight'+side,name+'眼位置高度','眼',1,eye,eyeSupport,-3,3);
 move('eyeDepth'+side,name+'眼区前后位置','眼',2,eye,eyeSupport,-3,3);
 scale('eyeWidth'+side,name+'眼区宽度','眼',0,eye,eyeSupport,-18,45,{support:'eyeHalf',sign});
 scale('eyeOpening'+side,name+'眼区开合高度','眼',1,eye,eyeSupport,-20,35);
 const tilt=zero();tilt[1]=-sign*Math.PI/180;tilt[3]=sign*Math.PI/180;
 field('eyeTilt'+side,name+'眼角倾斜（正值外角高）','眼','°',-7,7,eye,eyeSupport,tilt);
 const brow=[sign*.036,1.673,.108];
 move('browHeight'+side,name+'眉高度','眉',1,brow,[.039,.019,.053],-4,4);
 move('browArch'+side,name+'眉峰高度','眉',1,[sign*.045,1.674,.102],[.022,.016,.044],-3,3);
 // Lengthen outward from the inner brow, with disjoint left/right support.
 // Overlapping centred length fields can collapse the nasal midline.
 scale('browLength'+side,name+'眉区长度','眉',0,brow,[.070,.032,.085],-18,45,{translation:[sign*.00017,0,0],support:'browHalf',sign});
 move('cheekProjection'+side,name+'面颊饱满度','颊',2,[sign*.051,1.614,.097],[.042,.039,.067],-4,4);
 move('cheekHeight'+side,name+'颧颊高度','颊',1,[sign*.059,1.634,.086],[.042,.030,.074],-3,3);
 move('cornerHeight'+side,name+'口角高度','口',1,[sign*.026,1.586,.105],[.021,.023,.045],-3,3);
}
export const IDENTITY_PARAMETERS=Object.freeze(descriptors.map(d=>Object.freeze(d)));
export const DEMO_IDENTITY=Object.freeze({headHeight:4,jawWidth:-5,chinHeight:2.2,noseWidth:14,mouthWidth:16,eyeSpacingLeft:1.4,eyeSpacingRight:1.4,eyeOpeningLeft:12,eyeOpeningRight:12,browHeightLeft:1.4,browHeightRight:1.4});
export function normalizeIdentity(input={schema:FACE_IDENTITY_SCHEMA,source:FACE_IDENTITY_SOURCE,parameters:{}}){
 if(!input||input.schema!==FACE_IDENTITY_SCHEMA||input.source!==FACE_IDENTITY_SOURCE||!input.parameters||Array.isArray(input.parameters)||Object.keys(input).some(k=>!['schema','source','parameters'].includes(k)))throw Error('面部身份配方格式或人物来源不匹配');
 const parameters={};for(const [id,value]of Object.entries(input.parameters)){const d=IDENTITY_PARAMETERS.find(p=>p.id===id);if(!d||!Number.isFinite(value)||value<d.min||value>d.max)throw Error('面部参数无效或超出范围：'+id);if(value)parameters[id]=value;}
 return {schema:FACE_IDENTITY_SCHEMA,source:FACE_IDENTITY_SOURCE,parameters};
}
const step=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return {v:t*t*(3-2*t),d:t>0&&t<1?6*t*(1-t)/(b-a):0};};
export function identitySupport(p,d){
 const head=step(1.485,1.540,p[1]);
 if(d.support==='head')return {w:head.v,g:[0,head.d,0]};
 if(d.support==='forehead'){const s=step(1.670,1.699,p[1]),h=p[1]-1.670,t=Math.max(0,Math.min(.020,h-.035)),cap=h<=.035?h:.035+t-t*t/.040,derivative=h<=.035?1:1-t/.020,f=h>1e-8?cap/h:1,df=h>1e-8?(derivative*h-cap)/(h*h):0;return {w:head.v*s.v*f,g:[0,(head.d*s.v+head.v*s.d)*f+head.v*s.v*df,0]};}
 if(d.support==='upper'||d.support==='lower'){
  const side=step(1.646,1.666,p[1]),v=d.support==='upper'?side.v:1-side.v,g=d.support==='upper'?side.d:-side.d;
  return {w:head.v*v,g:[0,head.d*v+head.v*g,0]};
 }
 const v=p.map((x,k)=>(x-d.centre[k])/d.radii[k]),q=v.reduce((s,x)=>s+x*x,0),s=step(.18,1,q);let w=1-s.v,g=v.map((x,k)=>-s.d*2*x/d.radii[k]);
 if(d.support==='upperLip'||d.support==='lowerLip'){const lip=step(1.584,1.590,p[1]),l=d.support==='upperLip'?lip.v:1-lip.v,ld=d.support==='upperLip'?lip.d:-lip.d;g=g.map((x,k)=>x*l+(k===1?w*ld:0));w*=l;}
 if(d.support==='browHalf'||d.support==='eyeHalf'){const s=step(0,d.support==='browHalf'?.022:.016,p[0]*d.sign);g=g.map((x,k)=>x*s.v+(k===0?w*s.d*d.sign:0));w*=s.v;if(d.support==='browHalf'){const y=step(1.658,1.678,p[1]);g=g.map((x,k)=>x*y.v+(k===1?w*y.d:0));w*=y.v;}}
 return {w,g};
}
export function identityBasis(p,d){const {w,g}=identitySupport(p,d),v=d.translation.map((x,a)=>x+d.matrix.slice(a*3,a*3+3).reduce((s,m,b)=>s+m*(p[b]-d.centre[b]),0));return {delta:v.map(x=>x*w),jacobian:d.matrix.map((m,i)=>w*m+v[Math.floor(i/3)]*g[i%3])};}
export function identityTransform(p,parameters={},derivatives=false,descriptors=IDENTITY_PARAMETERS){
 const out=[...p],J=derivatives?[1,0,0,0,1,0,0,0,1]:null;
 for(const d of descriptors){const value=parameters[d.id]||0;if(!value)continue;const b=identityBasis(p,d);for(let a=0;a<3;a++)out[a]+=value*b.delta[a];if(J)for(let i=0;i<9;i++)J[i]+=value*b.jacobian[i];}
 return derivatives?{point:out,J}:out;
}
export function identityNormal(normal,J){const [a,b,c,d,e,f,g,h,i]=J,C=[e*i-f*h,f*g-d*i,d*h-e*g,c*h-b*i,a*i-c*g,b*g-a*h,b*f-c*e,c*d-a*f,a*e-b*d],n=[0,1,2].map(k=>C[k*3]*normal[0]+C[k*3+1]*normal[1]+C[k*3+2]*normal[2]),length=Math.hypot(...n)||1;return {normal:n.map(x=>x/length),determinant:a*C[0]+b*C[1]+c*C[2],stretch:Math.max(Math.hypot(a,d,g),Math.hypot(b,e,h),Math.hypot(c,f,i))};}
const n=x=>Number(x).toPrecision(10),vec=v=>'vec3('+v.map(n).join(',')+')',matrix=v=>'mat3('+[0,3,6,1,4,7,2,5,8].map(i=>n(v[i])).join(',')+')';
// Generate GLSL from the same descriptors as the CPU evaluator.
export const FACE_IDENTITY_GLSL=`
uniform float faceIdentityValues[${IDENTITY_PARAMETERS.length}];
vec2 fiStep(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return vec2(t*t*(3.-2.*t),t>0.&&t<1.?6.*t*(1.-t)/(b-a):0.);}
void fiBasis(vec3 p,vec3 c,vec3 r,mat3 A,vec3 t,float value,int type,inout vec3 delta,inout mat3 J){
 if(value==0.)return;vec2 head=fiStep(1.485,1.540,p.y);float w;vec3 g;
 if(type==1){w=head.x;g=vec3(0.,head.y,0.);}
 else if(type==6){vec2 s=fiStep(1.670,1.699,p.y);float h=p.y-1.670,t=clamp(h-.035,0.,.020),cap=h<=.035?h:.035+t-t*t/.040,derivative=h<=.035?1.:1.-t/.020,f=h>1e-8?cap/h:1.,df=h>1e-8?(derivative*h-cap)/(h*h):0.;w=head.x*s.x*f;g=vec3(0.,(head.y*s.x+head.x*s.y)*f+head.x*s.x*df,0.);}
 else if(type==2||type==3){vec2 s=fiStep(1.646,1.666,p.y);if(type==3)s=vec2(1.-s.x,-s.y);w=head.x*s.x;g=vec3(0.,head.y*s.x+head.x*s.y,0.);}
 else{vec3 v=(p-c)/r;vec2 s=fiStep(.18,1.,dot(v,v));w=1.-s.x;g=-s.y*2.*v/r;
  if(type==4||type==5){vec2 l=fiStep(1.584,1.590,p.y);if(type==5)l=vec2(1.-l.x,-l.y);g=g*l.x+vec3(0.,w*l.y,0.);w*=l.x;}}
 if(type>=7&&type<=10){float fiSide=type==7||type==9?1.:-1.;vec2 s=fiStep(0.,type>=9?.016:.022,p.x*fiSide);g=g*s.x+vec3(w*s.y*fiSide,0.,0.);w*=s.x;if(type<=8){vec2 y=fiStep(1.658,1.678,p.y);g=g*y.x+vec3(0.,w*y.y,0.);w*=y.x;}}
 vec3 v=A*(p-c)+t;delta+=value*w*v;J+=value*(w*A+mat3(v*g.x,v*g.y,v*g.z));
}
void fiSample(vec3 p,out vec3 point,out mat3 J){vec3 delta=vec3(0.);J=mat3(1.);
${IDENTITY_PARAMETERS.map((d,i)=>`fiBasis(p,${vec(d.centre)},${vec(d.radii)},${matrix(d.matrix)},${vec(d.translation)},faceIdentityValues[${i}],${d.support==='eyeHalf'?(d.sign===1?9:10):d.support==='browHalf'?(d.sign===1?7:8):({head:1,upper:2,lower:3,upperLip:4,lowerLip:5,forehead:6})[d.support]||0},delta,J);`).join('\n')}
 point=p+delta;}
vec3 fiNormal(vec3 n,mat3 J){return normalize(mat3(cross(J[1],J[2]),cross(J[2],J[0]),cross(J[0],J[1]))*n);}
`;
