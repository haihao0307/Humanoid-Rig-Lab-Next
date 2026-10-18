(function(){
'use strict';
const C=RealityCore,A=RealityAdapters,DATA=REALITY_CATALOG,$=id=>document.getElementById(id),clone=C.clone;
let entry=DATA.entries[0],doc=null,lastObservation=null,frame=null,generation=0,controller=null,ready=false,loadedId=null;
const events=[];const log=(type,detail)=>{events.push({type,detail,at:new Date().toISOString()});if(events.length>40)events.shift();};
function message(text,error=false){$('app-status').textContent=text;$('app-status').classList.toggle('error',error);$('native-state').textContent=text;$('native-state').classList.toggle('error',error);}
function declaration(e){return {schema:C.SCHEMA,assetId:e.id,domain:e.domain,source:{repository:e.repository,commit:e.commit,path:e.path,sha256:e.sha256},units:null,frame:null,dimensions:null,camera:null,color:null,evidence:{confidence:null},observation:{sourceType:'registered_entry_only',nativeRuntimeVerified:false}};}
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function renderReport(){
 const r=C.validate(doc);$('pass').textContent=r.counts?.pass??0;$('fail').textContent=r.counts?.fail??1;$('unknown').textContent=r.counts?.unknown??0;$('rows').replaceChildren();
 for(const x of r.rows){const row=element('div',undefined,'row '+x.status),h=element('div',undefined,'row-head');h.append(element('span',undefined,'dot'),element('code',x.id));row.append(h,element('p',x.message));if(x.detail!==null&&x.detail!==undefined)row.append(element('div',typeof x.detail==='string'?x.detail:JSON.stringify(x.detail),'detail'));$('rows').append(row);}
 const d=doc?.dimensions;
 if(d&&Array.isArray(d.xyz)&&d.xyz.length===3&&Object.hasOwn(C.LENGTH,d.unit)&&d.xyz.every(Number.isFinite)){$('measurement').textContent=d.xyz.map(v=>C.length(v,d.unit).toFixed(4)).join(' × ')+' m';$('measurement-note').textContent=(doc.observation?.note||d.method||'')+'　这是 X / Y / Z 方向包围范围，不自动当作身高、腰围、脚长或鞋码。';}
 else {$('measurement').textContent='尚未读取原生尺寸';$('measurement-note').textContent='登记网址、来源或一条规则，不等于已经测量这个对象。';}
 $('facts').replaceChildren();const facts=[['状态',r.status==='rejected'?'存在冲突，拒绝作为有效声明':r.status==='partial'?'部分信息已核对，仍有未确认项':'声明有效，非实体认证'],['原始几何单位',doc?.units?.geometry??'未声明'],['场景单位',doc?.units?.scene??'未声明'],['源版本',doc?.source?.commit?.slice(0,12)??'未声明'],['读取来源',doc?.dimensions?.basis??'尚无读数'],['回写原台','没有'],['实物 / 审美验收','未授予']];
 for(const [key,value]of facts)$('facts').append(element('div',key,'label'),element('div',String(value),'value'));
 return r;
}
function setDocument(next,saveBaseline=false){doc=clone(next);if(saveBaseline)lastObservation=clone(next);$('json-editor').value=JSON.stringify(doc,null,2);return renderReport();}
function unload(){generation++;controller?.abort();controller=null;ready=false;loadedId=null;frame?.remove();frame=null;$('observe').disabled=true;$('unload').disabled=true;$('load-native').disabled=entry.status==='registered-only';$('native-container').replaceChildren();$('native-panel').style.display='none';log('native-unloaded',null);}
function select(id){const e=DATA.entries.find(x=>x.id===id);if(!e)throw Error('对象不在授权目录');unload();entry=e;lastObservation=null;$('entry-title').textContent=e.name;$('entry-note').textContent=e.note;$('next').textContent=e.next;$('entry-status').textContent=e.status==='registered-only'?'仅登记 · 实时接口待接入':'可加载原台 · 只读接口';$('load-native').disabled=e.status==='registered-only';
 const link=$('original-link');link.hidden=!e.publicURL||e.accessFragmentRequired===true;if(!link.hidden)link.href=e.publicURL;
 document.querySelectorAll('[data-entry]').forEach(b=>b.classList.toggle('active',b.dataset.entry===id));setDocument(declaration(e));message('已选择 '+e.name+'。尚未读取原生尺寸。');log('entry-selected',id);}
function safe(fn){return async()=>{try{await fn();}catch(e){message(String(e.message||e),true);log('handled-error',String(e.message||e));}};}
async function loadNative(){
 if(!['human-r07','shoe-r12'].includes(entry.id))throw Error('此板块只有来源登记，实时观察器尚未实现');
 unload();const e=entry,token=generation;controller=new AbortController();$('load-native').disabled=true;$('unload').disabled=false;$('native-panel').style.display='block';message('按需读取原版 '+e.name+'。只在摘要一致后执行；不加载其他对象。');
 try{
  const response=await fetch(e.rawURL,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('原版读取失败：HTTP '+response.status);
  const bytes=await response.arrayBuffer();if(token!==generation)return;
  if(bytes.byteLength>40*1024*1024)throw Error('原版超过本次允许的 40 MiB 页面上限');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(token!==generation)return;if(hash!==e.sha256)throw Error('原版 SHA-256 不符，拒绝执行；没有回退到其他版本');
  log('source-verified',{id:e.id,sha256:hash,bytes:bytes.byteLength});
  frame=document.createElement('iframe');frame.id='native-frame';frame.title=e.name+' 固定原版独立副本';frame.referrerPolicy='no-referrer';
  /* Exact publicly published HTML. No injected script, source rewriting, or API patch. */
  frame.srcdoc=new TextDecoder().decode(bytes);$('native-container').replaceChildren(frame);const started=performance.now();
  while(token===generation&&!A.isReady(frame.contentWindow,e.id)){
   if(performance.now()-started>240000)throw Error('原生工作台未在 240 秒上限内就绪。未把空画布算通过；可关闭后重试。');
   await new Promise(r=>setTimeout(r,250));
  }
  if(token!==generation)return;ready=true;loadedId=e.id;$('observe').disabled=false;message('原版已就绪，文件摘要一致。点击“读取当前基准”；读取不会调整模型、镜头或配方。');log('native-ready',{id:e.id,waitMs:performance.now()-started});
 }catch(error){if(token!==generation||error.name==='AbortError')return;ready=false;$('load-native').disabled=false;throw error;}
}
function observe(){if(!ready||!frame||loadedId!==entry.id)throw Error('当前原生对象还未就绪');const result=A.capture(frame.contentWindow,entry),report=setDocument(result,true);message('已读取当前原生副本。'+report.counts.pass+' 项核对，'+report.counts.fail+' 项冲突，'+report.counts.unknown+' 项未确认；未回写。');log('observation',{id:entry.id,preservation:result.preservation,readMs:result.observation.readMs});return result;}
function parse(text){if(text.length>1024*1024)throw Error('输入超过 1 MiB；不要导入完整顶点或人物照片');let v=JSON.parse(text);if(v?.schema==='kaopu/reality-bundle@1')v=v.document;if(v?.schema==='kaopu/shoe-style@1')v=A.importShoeRecipe(v,DATA.entries.find(e=>e.id==='shoe-r12'));return v;}
function checkEditor(){const next=parse($('json-editor').value),r=setDocument(next);message(r.status==='rejected'?'该副本存在冲突，未应用到任何原台。':'已核验本地副本；未确认项保留，未应用到任何原台。',r.status==='rejected');return r;}
function download(name,value){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function units(){try{$('unit-result').textContent=C.length(Number($('unit-value').value),$('unit-from').value,$('unit-to').value).toLocaleString('en-US',{maximumFractionDigits:9})+' '+$('unit-to').value;}catch(e){$('unit-result').textContent=e.message;}}
function footprint(){try{const d=Number($('distance').value),f=Number($('fov').value);$('distance-value').value=d.toFixed(1)+' m';$('fov-value').value=f+'°';const r=C.pixelFootprint({distanceM:d,fovYDeg:f,heightPx:Number($('pixels').value)},Number($('feature').value));$('footprint').textContent=r.featurePixels.toFixed(3)+' px / 细节宽度';$('footprint').classList.toggle('warning',r.featurePixels<1);}catch(e){$('footprint').textContent=e.message;}}
function startCalibration(){
 const canvas=$('calibration'),gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('此设备无法建立 WebGL 校准场；JSON 核验仍可使用');
 const vs='attribute vec3 p;attribute vec3 c;varying vec3 col;uniform float yaw;uniform float pitch;uniform float distance;uniform float focal;uniform float aspect;void main(){vec3 v=p-vec3(0.0,0.5,0.0);float a=cos(yaw),b=sin(yaw);v=vec3(a*v.x+b*v.z,v.y,-b*v.x+a*v.z);a=cos(pitch);b=sin(pitch);v=vec3(v.x,a*v.y-b*v.z,b*v.y+a*v.z);v.z-=distance;gl_Position=vec4(v.x*focal/aspect,v.y*focal,-1.002002*v.z-0.2002002,-v.z);col=c;}',fs='precision mediump float;varying vec3 col;void main(){gl_FragColor=vec4(col,1.0);}';
 function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs),program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(v);gl.deleteShader(f);gl.useProgram(program);
 const data=[];function line(a,b,color){data.push(...a,...color,...b,...color);}
 for(let i=-6;i<=6;i++){let x=i*.25;line([x,0,-1.5],[x,0,1.5],[.19,.28,.31]);line([-1.5,0,x],[1.5,0,x],[.19,.28,.31]);}
 const corners=[];for(let y=0;y<=1;y++)for(let z=0;z<=1;z++)for(let x=0;x<=1;x++)corners.push([x-.5,y,z-.5]);
 for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))line(corners[i],corners[i|bit],[.67,.93,.84]);
 line([0,0,0],[1.25,0,0],[.91,.47,.48]);line([0,0,0],[0,1.35,0],[.48,.9,.72]);line([0,0,0],[0,0,1.25],[.78,.73,.39]);
 for(let i=0;i<=10;i++)line([-.52,i*.1,-.5],[-.58,i*.1,-.5],[.86,.89,.83]);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
 for(const [name,offset]of [['p',0],['c',12]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
 const uniforms=Object.fromEntries(['yaw','pitch','distance','focal','aspect'].map(x=>[x,gl.getUniformLocation(program,x)]));let yaw=-.6,pitch=.26,drag=null,draws=0;
 function draw(){const dpr=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.065,.102,.122,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.pitch,pitch);gl.uniform1f(uniforms.distance,Number($('distance').value));gl.uniform1f(uniforms.focal,1/Math.tan(Number($('fov').value)*Math.PI/360));gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);gl.drawArrays(gl.LINES,0,data.length/6);draws++;}
 canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.007;pitch=Math.max(-1.1,Math.min(1.1,pitch+(e.clientY-drag[1])*.007));drag=[e.clientX,e.clientY];draw();});for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>drag=null);
 for(const id of ['distance','fov'])$(id).addEventListener('input',()=>{draw();footprint();});new ResizeObserver(draw).observe(canvas);draw();
 return {report:()=>({webgl:true,cubeSizeM:[1,1,1],vertices:data.length/6,draws,buffer:[canvas.width,canvas.height],glError:gl.getError(),notAnAssetReplacement:true}),draw};
}
for(const e of DATA.entries){const b=element('button');b.dataset.entry=e.id;b.append(element('b',e.name),element('small',e.status==='registered-only'?'来源登记 / 实时接入待办':'固定原版 / 可只读观察'));b.onclick=safe(()=>select(e.id));$('catalog').append(b);}
$('load-native').onclick=safe(loadNative);$('observe').onclick=safe(observe);$('unload').onclick=safe(()=>{unload();message('已关闭原台；基准读数仍留在本页，原版文件未改。');});$('show-calibration').onclick=()=>{$('calibration-layout').scrollIntoView({behavior:'smooth',block:'start'});};
$('validate-json').onclick=safe(checkEditor);$('fault-unit').onclick=safe(()=>{const v=clone(doc);v.units={geometry:'mm',scene:'m',geometryToScene:1};setDocument(v);message('只在实验室副本中注入 mm→m 却乘 1 的错误，校验器应拒绝；原台没有修改。',true);});
$('restore-observation').onclick=safe(()=>{setDocument(lastObservation||declaration(entry));message('已恢复本页原始读数 / 登记；没有向原台写入。');});
$('save-draft').onclick=safe(()=>{const v=parse($('json-editor').value),r=C.validate(v);if(r.status==='rejected')throw Error('声明存在冲突，拒绝覆盖本页已存草稿');localStorage.setItem('kaopu:reality-hc-s1:draft',JSON.stringify(v));message('草稿保存在本浏览器的独立命名空间，不覆盖任何原台档案。');});
$('restore-draft').onclick=safe(()=>{const text=localStorage.getItem('kaopu:reality-hc-s1:draft');if(!text)throw Error('本页尚无草稿');setDocument(parse(text));message('已读入本页草稿；来源是缓存，不冒充新实时观测。');});
$('export').onclick=safe(()=>download('KAOPU-Reality-HC-S1-report.json',{schema:'kaopu/reality-bundle@1',build:REALITY_BUILD,document:doc,validation:C.validate(doc)}));
$('import').onchange=safe(async()=>{const file=$('import').files[0];if(!file)return;if(file.size>1024*1024)throw Error('文件超过 1 MiB；禁止在此导入完整模型或图片');const v=parse(await file.text());setDocument(v);message(C.validate(v).status==='rejected'?'导入副本存在冲突，原台未改。':'已在本页读取 JSON；未上传，未写入原生工作台。',C.validate(v).status==='rejected');});
for(const id of ['unit-value','unit-from','unit-to'])$(id).addEventListener('input',units);for(const id of ['feature','pixels'])$(id).addEventListener('input',footprint);
for(const r of DATA.references){const p=element('p');if(r.url){const a=element('a',r.name);a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';p.append(a);}else p.append(element('b',r.name));p.append(element('span',' — '+r.note));$('refs').append(p);}
$('build-id').textContent='S1 源构建 '+REALITY_BUILD.sourceCommit+' / '+C.VERSION;
let calibration=null;select(entry.id);units();footprint();try{calibration=startCalibration();message('基准核心已运行。按需加载人物或鞋台后读取真实当前数据；其他板块先登记，不伪造读数。');}catch(e){message(e.message,true);}
window.__REALITY_LAB__={version:'REALITY-HC-S1',sourceCommit:REALITY_BUILD.sourceCommit,core:C,adapters:A,select,loadNative,observe,checkEditor,unload,report:()=>({version:'REALITY-HC-S1',sourceCommit:REALITY_BUILD.sourceCommit,selected:entry.id,nativeReady:ready,loadedId,iframeCount:document.querySelectorAll('#native-container iframe').length,calibration:calibration?.report()??null,validation:C.validate(doc),document:clone(doc),events:clone(events),scope:DATA.scope,hostWriteAPI:false}),setDocument:v=>setDocument(v)};
})();
