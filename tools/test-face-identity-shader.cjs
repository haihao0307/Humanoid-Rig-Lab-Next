const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const api=vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../body/FaceIdentity.js'),'utf8')+'\n({shader:FACE_IDENTITY_GLSL,warp:faceIdentityWarp})');
const positions=[];for(let i=0;i<48;i++)positions.push([-.075+i%8*.02,1.40+Math.floor(i/8)*.03,.15+(i%3)*.012]);
positions.push([.0304,1.518,.166],[-.0304,1.518,.166],[0,1.65,.16],[.1,1.3,.1]);
// Sample the new broad jaw field and its compact-support boundary, in addition
// to the existing cranium/eye grid. Shader agreement alone is not visual QA.
for(const side of [-1,1])for(const x of [.025,.042,.052,.059,.088])for(const y of [1.395,1.407,1.432,1.446,1.470,1.485])for(const z of [.10,.139,.17])positions.push([side*x,y,z]);
positions.push([0,1.446,.139],[0,1.432,.15]);
const points=positions.map(p=>Array.from(new Float32Array(p))),normal=[.24,.12,Math.sqrt(1-.24**2-.12**2)];
(async()=>{const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage();const results=await page.evaluate(({shader,points,normal})=>{
 const gl=document.createElement('canvas').getContext('webgl2'),p=gl.createProgram();
 for(const [type,src] of [[gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;layout(location=0)in vec3 position;out vec3 warpedP;out vec3 warpedN;'+shader+'\nvoid main(){vec3 q=position,n=vec3('+normal.join(',')+');compactFaceIdentity(q,n);warpedP=q;warpedN=n;gl_Position=vec4(0.,0.,0.,1.);}'],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(1.);}']]){
  const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);
 }
 gl.transformFeedbackVaryings(p,['warpedP','warpedN'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
 gl.bindVertexArray(gl.createVertexArray());gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,buffer);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,points.length*6*4,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffer);gl.enable(gl.RASTERIZER_DISCARD);const results=[];
 const proportionsLocation=gl.getUniformLocation(p,'faceProportions'),jawLocation=gl.getUniformLocation(p,'faceJawWidth');
 if(proportionsLocation===null||jawLocation===null)throw Error('Missing active face proportions/jaw width uniforms');
 const cases=Array.from({length:32},(_,bits)=>[0,1,2,3,4].map(i=>bits&(1<<i)?1:-1));
 cases.push([0,0,0,0,0],[0,0,0,0,1],[0,0,0,0,-1],[.16,-.40,.10,-.72,.82]);
 for(const weights of cases){gl.uniform4fv(proportionsLocation,weights.slice(0,4));gl.uniform1f(jawLocation,weights[4]);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,points.length);gl.endTransformFeedback();const values=new Float32Array(points.length*6);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);results.push({weights,values:Array.from(values)});}
 if(gl.getError())throw Error('WebGL error');return results;
},{shader:api.shader,points,normal});
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 let positionError=0,normalError=0;
 for(const row of results)for(let i=0;i<points.length;i++){
  const expected=api.warp(points[i],row.weights),j=expected.jacobian,cols=[0,1,2].map(k=>j.map(r=>r[k])),cof=[cross(cols[1],cols[2]),cross(cols[2],cols[0]),cross(cols[0],cols[1])];
  let n=[0,1,2].map(k=>normal.reduce((s,v,axis)=>s+v*cof[axis][k],0));const length=Math.hypot(...n);n=n.map(v=>v/length);
  for(let k=0;k<3;k++){positionError=Math.max(positionError,Math.abs(row.values[i*6+k]-expected.point[k]));normalError=Math.max(normalError,Math.abs(row.values[i*6+3+k]-n[k]));}
 }
 assert(positionError<2e-6,'GPU identity positions disagree with CPU');assert(normalError<2e-5,'GPU inverse-transpose normals disagree with CPU');
 const zero=results.find(row=>row.weights.every(value=>value===0)),wide=results.find(row=>row.weights.slice(0,4).every(value=>value===0)&&row.weights[4]===1);
 let protectedSamples=0,neutralSamples=0,movedJawSamples=0;
 for(let i=0;i<points.length;i++){
  for(let k=0;k<3;k++)assert.equal(zero.values[i*6+k],points[i][k],'GPU zero identity must preserve neutral positions exactly');neutralSamples++;
  if(points[i][1]<=1.395){for(const row of results)for(let k=0;k<3;k++)assert.equal(row.values[i*6+k],points[i][k],'GPU identity must leave the lower body untouched');protectedSamples++;}
  if(Math.abs(wide.values[i*6]-points[i][0])>.001)movedJawSamples++;
 }
 assert(movedJawSamples>=20,'GPU jaw uniform must produce broad lateral contour movement');
 console.log(JSON.stringify({gpuSamples:points.length*results.length,parameterCases:results.length,parameterCorners:32,positionErrorM:positionError,normalError,protectedSamples,neutralSamples,movedJawSamples,activeJawUniform:true,gpuExecuted:true,visualAcceptance:false}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
