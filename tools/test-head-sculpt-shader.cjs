const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const source=fs.readFileSync(path.resolve(__dirname,'../body/HeadSculpt.js'),'utf8');
const api=vm.runInNewContext(source+'\n({shader:HEAD_SCULPT_GLSL,warp:compactHeadSculptPoint,config:HEAD_SCULPT})');
const positions=[];
for(let ix=-15;ix<=15;ix++)for(let iy=0;iy<=23;iy++)for(let iz=0;iz<=31;iz++)positions.push([ix*.006,1.390+iy*.006,.040+iz*.006]);
// Densely cover the first detected folding neighborhood and its mirror.
for(const side of [-1,1])for(let x=.039;x<=.0551;x+=.002)for(let y=1.500;y<=1.5121;y+=.002)for(let z=.132;z<=.1581;z+=.002)positions.push([side*x,y,z]);
for(const x of [-.008,0,.008])for(const y of [1.435,1.462,1.478,1.495,1.518])for(const z of [.15,.18,.21])positions.push([x,y,z]);
positions.push([.029181616,1.518095373,.152055491],[-.030466569,1.518094244,.151979130],[0,.7,.1]);
const points=positions.map(p=>Array.from(new Float32Array(p)));
const unit=n=>n.map(v=>v/Math.hypot(...n));
const normals=[[1,0,0],[0,1,0],[0,0,1],unit([.31,-.27,.83]),unit([-.61,.63,.22])];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const determinant=j=>j[0][0]*(j[1][1]*j[2][2]-j[1][2]*j[2][1])-j[0][1]*(j[1][0]*j[2][2]-j[1][2]*j[2][0])+j[0][2]*(j[1][0]*j[2][1]-j[1][1]*j[2][0]);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  const results=await page.evaluate(({shader,points,normals})=>{
   const gl=document.createElement('canvas').getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
   const program=gl.createProgram();
   const vertex='#version 300 es\nprecision highp float;layout(location=0)in vec3 position;uniform vec3 inputNormal;out vec3 warpedP;out vec3 warpedN;'+shader+'\nvoid main(){vec3 p=position,n=inputNormal;compactHeadSculpt(p,n);warpedP=p;warpedN=n;gl_Position=vec4(0.,0.,0.,1.);}';
   for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(1.);}']]){
    const stage=gl.createShader(type);gl.shaderSource(stage,source);gl.compileShader(stage);if(!gl.getShaderParameter(stage,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(stage));gl.attachShader(program,stage);
   }
   gl.transformFeedbackVaryings(program,['warpedP','warpedN'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   gl.bindVertexArray(gl.createVertexArray());gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
   const output=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,points.length*6*4,gl.DYNAMIC_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);gl.enable(gl.RASTERIZER_DISCARD);
   const location=gl.getUniformLocation(program,'inputNormal');if(location===null)throw Error('Normal input optimized away');
   const rows=[];for(const normal of normals){gl.uniform3fv(location,normal);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,points.length);gl.endTransformFeedback();const values=new Float32Array(points.length*6);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);rows.push({normal:Array.from(new Float32Array(normal)),values:Array.from(values)});}
   const error=gl.getError();if(error)throw Error('WebGL error '+error);
   return {rows,renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)};
  },{shader:api.shader,points,normals});
  let maximumPositionErrorM=0,maximumNormalError=0,maximumCofactorNormalError=0,maximumNormalErrorAt=null,minimumJacobian=Infinity,foldedPoints=0,protectedPoints=0,nonFinite=0,maximumProtectedPositionErrorM=0;
  const expected=points.map(p=>api.warp(p));
  for(let i=0;i<points.length;i++){
   const d=determinant(expected[i].jacobian);minimumJacobian=Math.min(minimumJacobian,d);if(d<=0)foldedPoints++;
   if(expected[i].point.every((v,k)=>v===points[i][k]))protectedPoints++;
  }
  for(const row of results.rows)for(let i=0;i<points.length;i++){
   const j=expected[i].jacobian,d=determinant(j),cols=[0,1,2].map(k=>j.map(r=>r[k])),cof=[cross(cols[1],cols[2]),cross(cols[2],cols[0]),cross(cols[0],cols[1])];
   const raw=[0,1,2].map(k=>row.normal.reduce((s,v,a)=>s+v*cof[a][k],0)),cofactorNormal=unit(raw),inverseNormal=unit(raw.map(v=>v/d));
   for(let k=0;k<3;k++){
    const p=row.values[i*6+k],n=row.values[i*6+3+k];if(!Number.isFinite(p)||!Number.isFinite(n))nonFinite++;
    maximumPositionErrorM=Math.max(maximumPositionErrorM,Math.abs(p-expected[i].point[k]));maximumCofactorNormalError=Math.max(maximumCofactorNormalError,Math.abs(n-cofactorNormal[k]));
    if(expected[i].point.every((v,a)=>v===points[i][a]))maximumProtectedPositionErrorM=Math.max(maximumProtectedPositionErrorM,Math.abs(p-points[i][k]));
    const normalError=Math.abs(n-inverseNormal[k]);if(normalError>maximumNormalError){maximumNormalError=normalError;maximumNormalErrorAt=points[i];}
   }
  }
  const failures=[];
  if(nonFinite)failures.push(`Non-finite GPU outputs: ${nonFinite}`);
  if(foldedPoints)failures.push(`Actual map folds at ${foldedPoints} GPU input points (minimum determinant ${minimumJacobian})`);
  if(maximumPositionErrorM>=2e-6)failures.push(`CPU/GPU position error ${maximumPositionErrorM} m`);
  if(maximumProtectedPositionErrorM>=1e-10)failures.push(`GPU moves a protected point by ${maximumProtectedPositionErrorM} m`);
  if(maximumNormalError>=2e-4)failures.push(`GPU normal differs from true inverse transpose by ${maximumNormalError}`);
  const report={sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),revision:api.config.revision,defaultStrengths:api.config.strokes.map(s=>({id:s.id,strength:s.strength})),points:points.length,normalCases:normals.length,gpuSamples:points.length*normals.length,minimumJacobian,foldedPoints,protectedPoints,nonFinite,maximumPositionErrorM,maximumProtectedPositionErrorM,maximumNormalError,maximumNormalErrorAt,maximumCofactorNormalError,renderer:results.renderer,version:results.version,failures,passed:failures.length===0,gpuExecuted:true,visualAcceptance:false};
  const index=process.argv.indexOf('--output');if(index>=0){const output=path.resolve(process.argv[index+1]);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify(report));assert.equal(failures.length,0,failures.join('\n'));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
