(async()=>{
'use strict';
const $=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x));
const compressed=Uint8Array.from(atob(PAYLOAD.gzip),c=>c.charCodeAt(0)),raw=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),x=>x.toString(16).padStart(2,'0')).join('');
if(raw.length!==PAYLOAD.bytes||hash!==PAYLOAD.sha256)throw Error('PAYLOAD_MISMATCH');
const data=JSON.parse(new TextDecoder().decode(raw));
if(data.schema!=='kaopu/adaptive-contact-preflight-experiment@1'||data.fullMotionExecuted||data.productionChanged)throw Error('WRONG_EVIDENCE');
let ci=2,mode='adaptive',si=0,phase='before',yaw=-.5,pitch=.2,zoom=1,drag=null,draws=0;
const c=document.getElementById('canvas'),gl=c.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WEBGL_UNAVAILABLE');
const sh=(kind,s)=>{const x=gl.createShader(kind);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;};
const program=gl.createProgram();gl.attachShader(program,sh(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec4 c;uniform float ps;varying vec4 color;void main(){gl_Position=vec4(p,1.0);gl_PointSize=ps;color=c;}'));gl.attachShader(program,sh(gl.FRAGMENT_SHADER,'precision mediump float;varying vec4 color;void main(){gl_FragColor=color;}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const buffer=gl.createBuffer(),lp=gl.getAttribLocation(program,'p'),lc=gl.getAttribLocation(program,'c'),ps=gl.getUniformLocation(program,'ps');gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(lp);gl.enableVertexAttribArray(lc);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(lc,4,gl.FLOAT,false,28,12);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
const selected=()=>{const item=data.cases[ci],variant=item.variants[mode],scope=variant.scopes[si];return{item,variant,scope};};
const elem=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const mm=x=>(x*1000).toFixed(3)+' mm';
function table(host,head,rows){const t=document.createElement('table'),tr=document.createElement('tr');for(const s of head)tr.append(elem('th',s));t.append(tr);for(const row of rows){const tr=document.createElement('tr');for(const cell of row)tr.append(elem('td',String(cell)));t.append(tr);}$(host).replaceChildren(t);}
function batch(a,kind,size){if(!a.length)return;gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.DYNAMIC_DRAW);gl.uniform1f(ps,size||5);gl.drawArrays(kind,0,a.length/7);}
function draw(){
 const {item,scope:s}=selected(),rect=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
 if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.clearColor(.04,.075,.1,1);gl.clear(gl.COLOR_BUFFER_BIT);
 const g=item.geometry,ids=[...new Set(s.faces.flatMap(f=>g.faces[f]))],base=ids.map(id=>g.points[id]),lo=[0,1,2].map(k=>Math.min(...base.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...base.map(p=>p[k]))),center=lo.map((v,k)=>(v+hi[k])/2),r=Math.max(.003,Math.hypot(...hi.map((v,k)=>v-lo[k]))*.63),aspect=w/h;
 const pos=id=>phase==='trial'&&s.afterPoints[id]?s.afterPoints[id]:g.points[id];
 const project=p=>{const [x,y,z]=p.map((v,k)=>(v-center[k])/r),a=Math.cos(yaw)*x+Math.sin(yaw)*z,b=-Math.sin(yaw)*x+Math.cos(yaw)*z;return[a*zoom/aspect,(Math.cos(pitch)*y-Math.sin(pitch)*b)*zoom,(Math.sin(pitch)*y+Math.cos(pitch)*b)*.12];};
 const fill=[],lines=[],points=[],put=(array,p,color)=>array.push(...project(p),...color);
 const triangle=(t,color)=>{for(const p of t)put(fill,p,color);for(let k=0;k<3;k++){put(lines,t[k],[...color.slice(0,3),.65]);put(lines,t[(k+1)%3],[...color.slice(0,3),.65]);}};
 if($('surface').checked)for(const f of s.bodyOffsets)triangle(g.body[f],[.36,.6,.88,.19]);
 if($('cloth').checked)for(const f of s.faces)triangle(g.faces[f].map(pos),[.88,.69,.38,.26]);
 if($('nodes').checked)for(const id of s.nodes)put(points,pos(id),[.58,.94,.72,1]);
 batch(fill,gl.TRIANGLES);batch(lines,gl.LINES);batch(points,gl.POINTS,6*dpr);draws++;
}
function render(){
 const {item,variant:v,scope:s}=selected();
 $('case').value=ci;$('variant').value=mode;$('scope').replaceChildren();
 v.scopes.forEach((x,i)=>{const o=elem('option',x.nodes.length+'节点／'+({zero:'零位移起点',guide:'原引导起点',normal:'原法向起点'})[x.seed]);o.value=i;$('scope').append(o);});$('scope').value=si;
 $('before').classList.toggle('active',phase==='before');$('trial').classList.toggle('active',phase==='trial');
 $('view-label').textContent=phase==='before'?'原状态 · 位置未修改':'被拒绝的末次试算 · 未写回原工作台';
 $('result').textContent=v.accepted?'仅局部通过，仍需运动验证':'未找到通过原检查的位移 · HOLD';
 $('node-count').textContent=s.nodes.length;$('face-count').textContent=s.faces.length;$('iterations').textContent=s.iterations.length;
 table('measurements',['指标','原状态','末次试算'],[['顶点／面心最小采样',mm(s.before.minimumM),mm(s.after.minimumM)],['同范围严格交叉对',s.before.strictCrossingPairs,s.after.strictCrossingPairs],['负距离样本',s.before.negativeSamples,s.after.negativeSamples],['最终写回','无','无']]);
 $('preflight').replaceChildren();
 if(v.preflight){for(const p of v.preflight.entries)$('preflight').append(elem('p',p.nodes.length+'节点：'+(p.status==='NECESSARY_CONDITION_ONLY'?'固定边必要条件通过，进入真实求解':p.status==='FIXED_EDGE_OBSTRUCTION'?'固定边阻碍 '+p.witnesses.length+' 项':p.status)+(p.addedNode!==undefined?'；补入 '+p.addedNode:'')));}
 else $('preflight').append(elem('p','原方法直接搜索三个点和一圈邻点，没有先跳过固定边阻碍。'));
 $('trace').replaceChildren();for(const t of s.iterations)$('trace').append(elem('p','更新 '+t.iteration+'：线性残差 '+mm(t.linearResidualM)+'；交叉 '+t.beforeCrossing+(t.afterCrossing!==undefined?' → '+t.afterCrossing:'')+'；'+(t.acceptedScale===null?'没有通过筛选的继续方向':'仅试算推进 × '+t.acceptedScale)));
 const audit=v.linearAudits.find(a=>JSON.stringify(a.scopeNodes)===JSON.stringify(s.nodes));
 if(audit?.contradictions.length)table('certificates',['样本','固定端点','当前距离','需要的线性改善','原坐标预算最大改善','缺口'],audit.contradictions.map(r=>[r.id,r.fixedIds.join('、')||'—',mm(r.distanceM),mm(r.requiredLinearGainM),mm(r.boxSupportM),mm(r.gapM)]));
 else $('certificates').replaceChildren(elem('p','这组范围未发现单条约束与坐标预算直接冲突。多条约束仍可能相互冲突；不能据此判为整体可行。'));
 table('proposals',['更新','步长','最短／最长边比','最大位移','面交叉','检查'],s.proposals.map(p=>[p.iteration,p.scale,p.edge.minimumRatio.toFixed(3)+' / '+p.edge.maximumRatio.toFixed(3),mm(p.shift),p.crossings,!p.edge.passed?'形变限制未通过':p.shift>p.budget+1e-7?'位移超限':p.merit>=p.previousMerit?'未取得原目标下降':'仅推进试算，未通过最终接触']));
 table('timing',['次序','方法','冻结状态求解墙钟'],item.runs.map(r=>[r.ordinal+1,r.mode==='adaptive'?'预检＋补点':'原范围',r.wallMS.toFixed(1)+' ms']));
 $('sources').textContent=JSON.stringify({sourceCommit:BUILD.sourceCommit,fixture:item.fixture,fixtureSHA256:item.fixtureSHA256,fixtureRun:data.fixtureRun,policy:data.policy,status:data.status,sourceWritten:false,fullMotionExecuted:false,fitCertified:false,wallTimeMeaning:item.timing.meaning},null,2);
 draw();
}
data.cases.forEach((x,i)=>{const o=elem('option','第'+x.step+'步 · '+(x.fixture.startsWith('baseline')?'旧覆盖状态':'S3.11保护状态'));o.value=i;$('case').append(o);});
$('overall').textContent='真实求解已执行；本组没有局部位移通过。原位置保持不变，新180步运动验证未启动。';
$('case').onchange=()=>{ci=Number($('case').value);si=0;phase='before';render();};$('variant').onchange=()=>{mode=$('variant').value;si=0;phase='before';render();};$('scope').onchange=()=>{si=Number($('scope').value);phase='before';render();};$('before').onclick=()=>{phase='before';render();};$('trial').onclick=()=>{phase='trial';render();};
function resetView(){yaw=-.5;pitch=.2;zoom=1;draw();}$('reset-view').onclick=resetView;$('restore').onclick=()=>{ci=2;mode='adaptive';si=0;phase='before';render();resetView();};for(const id of ['surface','cloth','nodes'])$(id).onchange=draw;
c.onpointerdown=e=>{drag=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId);};c.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.008;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];draw();};c.onpointerup=c.onpointercancel=()=>{drag=null;};c.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.3,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});new ResizeObserver(draw).observe(c);
$('download').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify({schema:'kaopu/adaptive-contact-review@1',build:BUILD,data,selection:{ci,mode,si,phase},sourceWritten:false,fullMotionExecuted:false},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='RF01-S313-adaptive-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('build').textContent='S3.13 · '+BUILD.sourceCommit+' · 原始身体与衣物未更改 · 拒绝试算不代表真实穿着状态';
render();window.__RF313__=Object.freeze({report:()=>({sourceCommit:BUILD.sourceCommit,payloadSHA256:hash,fixture:data.cases[ci].fixture,mode,scope:si,phase,camera:{yaw,pitch,zoom},draws,selected:copy(selected().scope),variantAccepted:selected().variant.accepted,sourceWritten:false,fullMotionExecuted:false,fitCertified:false})});
})().catch(e=>{document.getElementById('overall').textContent='页面加载失败：'+e.message;console.error(e);});
