// Independent CPU finite-difference oracle and isolated WebGL2 feedback.
// No application, mouse, generated mesh file, or visual-quality claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const sources=['body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/FaceAnatomy.js','body/FaceIdentity.js','body/FaceControls.js'];
const strings=sources.map(p=>read(p).replace('/*__FACE_RECIPE_JSON__*/',read('body/FaceControlRecipe.json')));
const api=vm.runInNewContext(strings.join('\n')+'\n({shader:COMPACT_FACE_GLSL+compactLipMotionShader()+compactJawMotionShader(),p:COMPACT_FACE_ANATOMY,recipe:FACE_RECIPE,affines:FACE_MUSCLE_AFFINES,outline:compactLipOutline,eligible:faceChunkEligible})');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,b)=>a.map(v=>v*b),unit=a=>mul(a,1/(Math.hypot(...a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const normal=unit([.24,.12,.96]),lp=api.p.lips,j=api.p.jaw;
// Frozen pre-fix GPU position path. Comparing on the same driver distinguishes
// a geometry regression from native GLSL trigonometric vs JS double precision.
const legacyShader=`
vec3 legacyJawPosition(vec3 p,vec3 rest){
 float amount=clamp(compactJawOpen,0.,1.);if(amount<.00001)return p;
 float seam=compactLipShape(rest).y,rigidLower=0.;
 if((compactFeature>11.5&&compactFeature<12.5)||(compactFeature>13.5&&compactFeature<15.5))rigidLower=1.;
 float lowerLip=compactFeature>2.5&&compactFeature<3.5?1.-smoothstep(-.0000005,.0000005,rest.y-seam):0.;
 float cavity=compactFeature>9.5&&compactFeature<10.5?1.-smoothstep(seam-.00050,seam+.00050,rest.y):0.;float lowerFace=0.;
 if(faceEligible>.5&&(compactFeature<.5||(compactFeature>2.5&&compactFeature<3.5)||(compactFeature>16.5&&compactFeature<17.5))){
  float vertical=1.-smoothstep(${j.skinFullY.toFixed(6)},${j.skinFadeY.toFixed(6)},rest.y);
  float frontal=smoothstep(.118,.165,rest.z),lateral=1.-smoothstep(.040,.074,abs(rest.x));lowerFace=vertical*frontal*(.45+.55*lateral);
 }
 if(compactFeature>2.5&&compactFeature<3.5){vec4 shape=compactLipShape(rest);float extent=rest.y>seam?shape.z:shape.w;
  float radial=abs(rest.y-seam)/max(extent,.00001),arc=sqrt(max(0.,1.-shape.x*shape.x));lowerLip=.5+(lowerLip-.5)*arc;
  lowerLip=mix(lowerLip,lowerFace,smoothstep(1.,${lp.apron.toFixed(6)},radial));lowerFace=0.;
 }
 float weight=clamp(max(max(rigidLower,lowerLip),max(cavity,lowerFace)),0.,1.);if(weight<.00001)return p;
 float angle=amount*weight*${j.maxRotationRad.toFixed(6)},c=cos(angle),s=sin(angle);vec3 pivot=vec3(0.,${j.pivotY.toFixed(6)},${j.pivotZ.toFixed(6)}),q=p-pivot;
 return pivot+vec3(q.x,c*q.y-s*q.z,s*q.y+c*q.z)+vec3(0.,-${j.downM.toFixed(6)}*amount*weight,${j.forwardM.toFixed(6)}*amount*weight);
}`;
function weight(rest,feature,eligible){
 const q=api.outline(rest[0]),u=(rest[0]-lp.centreX)/lp.halfWidth,seam=q.seam;
 const beardApron=feature===17&&((rest[0]-lp.centreX)/.033)**2+((rest[1]-lp.seamY)/.0145)**2<1;
 let rigid=(feature===12||feature===14)?1:0,lip=feature===3?1-smooth(-.0000005,.0000005,rest[1]-seam):0,cavity=feature===10?1-smooth(seam-.0005,seam+.0005,rest[1]):0,face=0;
 if(eligible&&(feature===0||feature===3||feature===17))face=(1-smooth(j.skinFullY,j.skinFadeY,rest[1]))*smooth(.118,.165,rest[2])*(.45+.55*(1-smooth(.040,.074,Math.abs(rest[0]))));
 if(feature===3||feature===10||feature===15||beardApron){
  const extent=rest[1]>seam?q.top-seam:seam-q.bottom,v=Math.max(0,1-u*u),arc=Math.sqrt(v)*smooth(0,.36,v);
  lip=.5+((1-smooth(-.0000005,.0000005,rest[1]-seam))-.5)*arc;
  const inside=Math.hypot(Math.max(0,Math.abs(rest[0]-lp.centreX)-lp.halfWidth),Math.max(0,Math.abs(rest[1]-seam)-extent));
  const r2=((rest[0]-lp.centreX)/.033)**2+((rest[1]-lp.seamY)/.0145)**2,outside=Math.max(0,1-r2)*.025,b=smooth(0,1,inside/(inside+outside||1));
  face=eligible?(1-smooth(j.skinFullY,j.skinFadeY,rest[1]))*smooth(.118,.165,rest[2])*(.45+.55*(1-smooth(.040,.074,Math.abs(rest[0])))):0;
  lip=lip*(1-b)+face*b;face=0;cavity=0;
 }
 return clamp(Math.max(rigid,lip,cavity,face),0,1);
}
function before(rest,c){
 let p=rest.slice();
 if(c.eligible&&c.lip>=.00001&&Math.abs(p[0]-lp.centreX)<lp.halfWidth&&Math.abs(p[1]-lp.seamY)<.020&&Math.abs(p[2]-.188)<.040){
  const q=api.outline(p[0]),u=(p[0]-lp.centreX)/lp.halfWidth,v=(p[1]-q.seam)/.019,w=(p[2]-.188)/.04;
  if(Math.max(Math.abs(u),Math.abs(v),Math.abs(w))<1)p[1]+=c.lip*(v>=0?.0015:-.0035)*(1-u*u)**2*(1-v*v)**3*(1-w*w)**2;
 }
 if(!c.eligible||p[1]<1.39||p[1]>1.585||p[2]<.1||Math.abs(p[0])>.092||!c.enabled)return p;
 let delta=[0,0,0];
 api.recipe.nodes.forEach((node,i)=>{const radius=Math.hypot(...p.map((v,k)=>(v-node.centre[k])/node.radius[k]));if(radius<1)delta=add(delta,mul(c.offsets[i],(1-radius)**4*(4*radius+1)));});
 api.recipe.muscleFields.forEach((field,i)=>{const activation=c.muscles[i];if(activation<.00001)return;const relative=sub(p,field.centre),q=relative.map((v,k)=>v/field.radius[k]),r2=dot(q,q);if(r2>=1)return;const affine=api.affines[i],d=affine.matrix.map((row,k)=>dot(row,relative)+affine.bias[k]);delta=add(delta,mul(d,activation*(1-r2)**3));});
 return add(p,delta);
}
function transform(rest,c){
 const p=before(rest,c),w=weight(rest,c.feature,c.eligible);if(c.jaw<.00001||w<.00001)return p;
 const angle=c.jaw*w*j.maxRotationRad,co=Math.cos(angle),si=Math.sin(angle),q=sub(p,[0,j.pivotY,j.pivotZ]);
 return [q[0],j.pivotY+co*q[1]-si*q[2]-j.downM*c.jaw*w,j.pivotZ+si*q[1]+co*q[2]+j.forwardM*c.jaw*w];
}
function jacobian(fn,rest,h=2e-7){return [0,1,2].map(k=>{const a=rest.slice(),b=rest.slice();a[k]+=h;b[k]-=h;return mul(sub(fn(a),fn(b)),1/(2*h));});}
function mappedNormal(cols){const determinant=dot(cols[0],cross(cols[1],cols[2])),cof=[cross(cols[1],cols[2]),cross(cols[2],cols[0]),cross(cols[0],cols[1])];return {normal:mul(unit([0,1,2].map(k=>normal.reduce((s,v,axis)=>s+v*cof[axis][k],0))),Math.sign(determinant)),determinant};}
const skinPoints=[];
for(const x of [-.064,-.048,-.023,0,.019,.046,.067])for(const y of [1.437,1.447,1.459,1.470,1.479])for(const z of [.132,.151,.182])skinPoints.push([x,y,z]);
const lipPoints=[];
for(const u of [-.94,-.65,-.25,0,.30,.70,.94]){const x=lp.centreX+u*lp.halfWidth,q=api.outline(x);for(const side of [-1,1])for(const radial of [0,.3,.9,1.25,1.85,2.35])lipPoints.push([x,q.seam+side*((side>0?q.top-q.seam:q.seam-q.bottom)*radial+.00006),.19]);}
const cavityPoints=[];for(const x of [-.018,0,.018])for(const dy of [-.0007,-.0003,.0003,.0007])cavityPoints.push([x,api.outline(x).seam+dy,.176]);
for(const x of [-.018,0,.018])for(const y of [1.439,1.447,1.454])for(const z of [.145,.160,.178])cavityPoints.push([x,y,z]);
const settings=[];
for(const jaw of [0,.35,.75,1])for(const mode of ['neutral','combined'])for(const feature of [0,3,10,11,12,13,14,15,17]){
 const eligible=![11,12,13,14].includes(feature),offsets=api.recipe.nodes.map((node,i)=>[.0012*Math.sin(i*1.7),.0009*Math.cos(i*.9),.0014*Math.sin(i*.63)]),muscles=api.recipe.muscleFields.map((f,i)=>i%5===0?.3:0);
 const points=(feature===3?lipPoints:(feature===10||feature===15)?cavityPoints:skinPoints).map(p=>Array.from(Float32Array.from(p)));
 settings.push({jaw,lip:mode==='combined'?.3:0,enabled:mode==='combined'?1:0,feature,eligible:eligible?1:0,offsets:mode==='combined'?offsets:offsets.map(()=>[0,0,0]),muscles:mode==='combined'?muscles:muscles.map(()=>0),points});
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage();const result=await page.evaluate(({shader,settings,normal})=>{
  const gl=document.createElement('canvas').getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');const program=gl.createProgram();
  const vertex='#version 300 es\nprecision highp float;layout(location=0)in vec3 rest;uniform float compactFeature;out vec3 outP;out vec3 outN;out vec4 outJet;out vec3 pre0;out vec3 pre1;out vec3 pre2;out vec3 outBefore;out vec3 outLegacy;'+shader+'\nvoid main(){vec3 p=rest,n=vec3('+normal.join(',')+');compactLipMotion(p,n);float heat;compactFace(p,n,heat);outBefore=p;outLegacy=legacyJawPosition(p,rest);compactJawMotion(p,n,rest);outP=p;outN=n;outJet=compactJawWeightJet(rest);mat3 pre=compactJawIncomingJacobian(rest);pre0=pre[0];pre1=pre[1];pre2=pre[2];gl_Position=vec4(0.,0.,0.,1.);}';
  for(const [type,source]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.);}']]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);}
  gl.transformFeedbackVaryings(program,['outP','outN','outJet','pre0','pre1','pre2','outBefore','outLegacy'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());const input=gl.createBuffer(),output=gl.createBuffer(),rows=[];
  gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.enable(gl.RASTERIZER_DISCARD);
  const scalar=(name,value)=>{const location=gl.getUniformLocation(program,name);if(location!==null)gl.uniform1f(location,value);};
  for(const c of settings){
   scalar('compactFeature',c.feature);scalar('faceEligible',c.eligible);scalar('faceEnabled',c.enabled);scalar('faceHeatmap',0);scalar('compactLipOpen',c.lip);scalar('compactJawOpen',c.jaw);
   gl.uniform3fv(gl.getUniformLocation(program,'faceOffsets[0]'),c.offsets.flat());gl.uniform1fv(gl.getUniformLocation(program,'faceMuscles[0]'),c.muscles);
   gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from(c.points.flat()),gl.STATIC_DRAW);
   gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,c.points.length*25*4,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
   gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,c.points.length);gl.endTransformFeedback();const values=new Float32Array(c.points.length*25);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);rows.push(Array.from(values));
  }
  if(gl.getError())throw Error('WebGL error');return rows;
 },{shader:api.shader+legacyShader,settings,normal});
 let samples=0,maxLegacyPositionError=0,maxUnchangedDomainPositionError=0,maxBeforePositionError=0,maxPositionError=0,maxNormalError=0,maxJetError=0,maxPreJacobianError=0,minDeterminant=Infinity,rigidSamples=0,gradientNormalSamples=0,worst=null,worstPosition=null,minimumDeterminantCase=null;
 for(let ci=0;ci<settings.length;ci++){const c=settings[ci],gpu=result[ci];for(let i=0;i<c.points.length;i++){
  const p=c.points[i],base=i*25,preExpected=before(p,c),expected=transform(p,c),J=jacobian(q=>transform(q,c),p),N=mappedNormal(J),pre=jacobian(q=>before(q,c),p),g=jacobian(q=>[weight(q,c.feature,c.eligible),0,0],p).map(v=>v[0]);
  assert(gpu.slice(base,base+25).every(Number.isFinite),'GPU produced non-finite values');
  if(N.determinant<minDeterminant){minDeterminant=N.determinant;minimumDeterminantCase={feature:c.feature,jaw:c.jaw,lip:c.lip,rest:p};}
  for(let k=0;k<3;k++){
   maxLegacyPositionError=Math.max(maxLegacyPositionError,Math.abs(gpu[base+k]-gpu[base+22+k]));
   const beardApron=c.feature===17&&((p[0]-lp.centreX)/.033)**2+((p[1]-lp.seamY)/.0145)**2<1;
   if(c.feature!==3&&c.feature!==10&&c.feature!==15&&!beardApron)maxUnchangedDomainPositionError=Math.max(maxUnchangedDomainPositionError,Math.abs(gpu[base+k]-gpu[base+22+k]));
   maxBeforePositionError=Math.max(maxBeforePositionError,Math.abs(gpu[base+19+k]-preExpected[k]));
   const positionError=Math.abs(gpu[base+k]-expected[k]);if(positionError>maxPositionError){maxPositionError=positionError;worstPosition={feature:c.feature,jaw:c.jaw,lip:c.lip,rest:p,expected,actual:gpu.slice(base,base+3)};}const error=Math.abs(gpu[base+3+k]-N.normal[k]);if(error>maxNormalError){maxNormalError=error;worst={feature:c.feature,jaw:c.jaw,lip:c.lip,rest:p,expected:N.normal,actual:gpu.slice(base+3,base+6)};}
   maxJetError=Math.max(maxJetError,Math.abs(gpu[base+6+k]-g[k]));
   for(let row=0;row<3;row++)maxPreJacobianError=Math.max(maxPreJacobianError,Math.abs(gpu[base+10+k*3+row]-pre[k][row]));
  }
  assert(Math.abs(gpu[base+9]-weight(p,c.feature,c.eligible))<3e-4,'GPU positional jaw weight disagrees with independent CPU reference');
  if(c.feature>=11&&c.feature<=14){rigidSamples++;assert(Math.hypot(...gpu.slice(base+6,base+9))<1e-8,'rigid dental structures must have zero weight gradient');}
  if(c.jaw>0&&Math.hypot(...g)>1e-3)gradientNormalSamples++;samples++;
 }}
 let sharedOralSamples=0;
 for(let ci=0;ci<settings.length;ci++)if(settings[ci].feature===15){const c=settings[ci],wi=settings.findIndex(q=>q.feature===10&&q.jaw===c.jaw&&q.lip===c.lip&&q.enabled===c.enabled);
  assert(wi>=0);for(let i=0;i<c.points.length;i++){for(let k=0;k<19;k++)assert.equal(result[ci][i*25+k],result[wi][i*25+k],'GPU tongue/wall must share position, normal and the complete incoming derivative chain');sharedOralSamples++;}}
 const report={samples,sharedOralSamples,rigidSamples,gradientNormalSamples,maxPositionErrorM:maxPositionError,maxBeforePositionError,maxLegacyPositionError,maxUnchangedDomainPositionError,maxNormalError,maxWeightGradientError:maxJetError,maxPreJacobianError,minDeterminant,minimumDeterminantCase,worst,worstPosition,sourceSHA256:crypto.createHash('sha256').update(read('body/FaceAnatomy.js')).digest('hex'),gpuExecuted:true,visualAcceptance:false};
 console.log(JSON.stringify(report,null,2));
 assert.equal(maxUnchangedDomainPositionError,0,'skin, beard outside the oral apron and rigid oral GPU positions must remain bit-identical');
 assert(maxLegacyPositionError>.001,'test must exercise the repaired oral position field');
 assert(maxPositionError<2e-5,'GPU positions exceed the bounded double-precision reference error');
 assert(maxNormalError<.002,'full jaw normal disagrees with the composite position Jacobian');
 assert(maxPreJacobianError<.001,'incoming lip/face Jacobian is incorrect');
 assert(maxJetError<1,'jaw weight gradient disagrees with same-side finite differences');
 assert(gradientNormalSamples>500&&rigidSamples>1000,'coverage insufficient');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
