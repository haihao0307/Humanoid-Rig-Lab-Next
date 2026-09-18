// Opt-in real WebGL garment diagnostics. No desktop input or generated imagery.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
if(!process.env.MOTION_QA_DIR)throw Error('MOTION_QA_DIR must point outside the repository');
const out=pathToFileURL(resolve(process.env.MOTION_QA_DIR)+'/');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1100,height:760}}),rows=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));let hash;
try{
 const response=await page.goto(process.env.HUMANLAB_URL||'http://127.0.0.1:4173/index.html?qa=1',{waitUntil:'domcontentloaded'});hash=createHash('sha256').update(await response.body()).digest('hex');
 await page.waitForFunction(()=>{const w=document.querySelector('#bodyFrame')?.contentWindow;if(w?.__startupError)throw Error(w.__startupError);return w?.HumanLab?.compact?.skirt;},null,{timeout:600000});
 await page.evaluate(simulated=>{
  const l=document.querySelector('#bodyFrame').contentWindow.HumanLab;l.setAuto(false);l.setCameraFollow(false);l.compact.clothing.setSimulation(simulated);
  window.clothQA=()=>{
   const s=l.compact.skirt,gl=s.gl,h=l.human;l.render();const original=s.main.p,program=gl.createProgram();
   for(const shader of gl.getAttachedShaders(original))gl.attachShader(program,shader);
   const linen=s.report.generator.startsWith('procedural-linen'),stride=linen?11:10;gl.transformFeedbackVaryings(program,[linen?'W':'worldPoint'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){
    const info=gl.getActiveUniform(program,i),value=gl.getUniform(original,gl.getUniformLocation(original,info.name)),loc=gl.getUniformLocation(program,info.name);
    const fn=new Map([[gl.FLOAT,info.size>1?'uniform1fv':'uniform1f'],[gl.INT,info.size>1?'uniform1iv':'uniform1i'],[gl.BOOL,'uniform1i'],[gl.SAMPLER_2D,'uniform1i'],[gl.INT_VEC2,'uniform2iv'],[gl.INT_VEC3,'uniform3iv'],[gl.FLOAT_VEC2,'uniform2fv'],[gl.FLOAT_VEC3,'uniform3fv'],[gl.FLOAT_VEC4,'uniform4fv']]).get(info.type);
    if(info.type===gl.FLOAT_MAT4)gl.uniformMatrix4fv(loc,false,value);else if(fn){const all=info.size>1?Array.from({length:info.size},(_,j)=>{const v=gl.getUniform(original,gl.getUniformLocation(original,info.name.replace('[0]','['+j+']')));return typeof v==='number'?v:Array.from(v);}).flat():value;gl[fn](loc,all);}else throw Error('uniform '+info.name+' '+info.type);
   }
   gl.bindVertexArray(s.vao);gl.bindBuffer(gl.ARRAY_BUFFER,s.buffers[0]);const count=gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE)/(stride*4);
   const raw=new Float32Array(count*stride);gl.getBufferSubData(gl.ARRAY_BUFFER,0,raw);
   const output=gl.createBuffer(),tf=gl.createTransformFeedback();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,count*12,gl.STREAM_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
   gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,count);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
   const positions=new Float32Array(count*3);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,positions);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);
   const indices=new Uint16Array(s.count);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,indices);const error=gl.getError();gl.deleteTransformFeedback(tf);gl.deleteBuffer(output);gl.deleteProgram(program);gl.bindVertexArray(null);if(error)throw Error('GL '+error);
   const metrics=h.bodyMetrics,capsules=[];
   for(const side of ['left','right'])for(const [name,a,b,r]of [['thigh','femur','tibia',s.thighRadii[side==='left'?0:1]],['shin','tibia','foot',metrics.legRadiusM*(.052/.069)+.006],['forearm','forearm','hand',metrics.armRadiusM*(.037/.047)+.006]])capsules.push({id:side+'_'+name,a:h.byId.get(side+'_'+a).world.p,b:h.byId.get(side+'_'+b).world.p,r});
   const stats=Object.fromEntries(capsules.map(c=>[c.id,{min:Infinity,vertexMin:Infinity,clearedVertexMin:Infinity,inside:0,point:null}]));
   const check=(p,kind,ids)=>{const uv=ids.reduce((n,j)=>n+raw[j*stride+(linen?8:7)]/ids.length,0),part=raw[ids[0]*stride+9];for(const c of capsules){const axis=c.b.map((v,k)=>v-c.a[k]),t=Math.max(0,Math.min(1,p.reduce((n,v,k)=>n+(v-c.a[k])*axis[k],0)/axis.reduce((n,v)=>n+v*v,0))),r=c.r*(c.id.endsWith('thigh')?1-.15*t:1),d=Math.hypot(...p.map((v,k)=>v-c.a[k]-axis[k]*t))-r,record=stats[c.id];if(kind==='vertex'){record.vertexMin=Math.min(record.vertexMin,d);if(uv>.07&&part<1.5)record.clearedVertexMin=Math.min(record.clearedVertexMin,d);}if(d<record.min){record.min=d;record.point=p;record.detail={kind,ids,uv,part,t};}if(d<-.001)record.inside++;}};
   for(let i=0;i<count;i++)check(Array.from(positions.subarray(i*3,i*3+3)),'vertex',[i]);
   for(let i=0;i<indices.length;i+=3){const ids=Array.from(indices.subarray(i,i+3));check([0,1,2].map(k=>ids.reduce((n,j)=>n+positions[j*3+k]/3,0)),'centre',ids);}
   return{clothing:l.compact.clothing.report(),stats,capsules,vertices:count,triangles:indices.length/3,headBalance:h.motionDriver.report().headBalance,head:h.byId.get('head').world,source:h.lastMotionSource,phase:l.agent.phase,error:l.agent.error,ready:l.agent.activity().readyForTask};
  };
 },process.env.CLOTHING_QA_SIMULATED==='1');
 for(const [command,label,steps]of [['坐下','sit',32],['起身','rise',44],['向前走1米','walk',44],['向左转90度','turn',44]]){
  await page.evaluate(command=>{const l=document.querySelector('#bodyFrame').contentWindow.HumanLab;l.command(command);l.setAuto(false);},command);
  for(let i=0;i<steps;i++){
   const row=await page.evaluate(()=>{const l=document.querySelector('#bodyFrame').contentWindow.HumanLab;l.advance(.1);return window.clothQA();});rows.push({label,i,...row});if(row.error)throw Error(row.error);
   if(i%5===0){for(const [view,angle]of [['front',-1],['side',Math.PI/2]]){
    const png=await page.evaluate(({angle})=>{const l=document.querySelector('#bodyFrame').contentWindow.HumanLab,h=l.human,a=l.agent,r=l.renderer;l.render();const save=[r.compacts,r.compact,r.tissue],floor=r.lastItems.filter(o=>o.materialKind===5&&!o.id);r.compacts=[l.compact];r.compact=l.compact;r.tissue=h.tissue;r.yaw=a.yaw+angle;r.pitch=.05;r.target=[a.pos[0],h.bodyMetrics.statureM*.46,a.pos[2]];r.distance=h.bodyMetrics.statureM*1.8;r.render([...floor,...h.bones,...h.cartilage,...h.tissue.items].filter(o=>o.visible!==false),[]);const p=r.canvas.toDataURL('image/png');[r.compacts,r.compact,r.tissue]=save;return p;},{angle});
    await writeFile(new URL(label+'-'+String(i).padStart(3,'0')+'-'+view+'.png',out),Buffer.from(png.split(',')[1],'base64'));
   }}
  }
  await page.evaluate(()=>document.querySelector('#bodyFrame').contentWindow.HumanLab.advance(5));console.log(label+' complete');
 }
}finally{await writeFile(new URL('report.json',out),JSON.stringify({hash,rows,errors,simulated:process.env.CLOTHING_QA_SIMULATED==='1',collisionMetric:'GPU garment vertices and triangle centres against authored limb proxies; not exact skin collision',visualAcceptance:false},null,2));await browser.close();}
console.log(JSON.stringify({out:out.href,rows:rows.length,errors}));

if(process.env.CLOTHING_QA_REQUIRE_CLEAR==='1'&&rows.some(r=>Object.values(r.stats).some(s=>s.min<-.002)))throw Error('Garment proxy clearance gate failed; inspect report and screenshots');
