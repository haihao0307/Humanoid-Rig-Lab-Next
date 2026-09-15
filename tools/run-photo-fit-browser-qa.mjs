import {spawn,spawnSync} from 'node:child_process';
import {createWriteStream,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=join(root,'artifacts');mkdirSync(artifacts,{recursive:true});
const port=4173,debugPort=9222;
const pageUrl=`http://127.0.0.1:${port}/photo-fit-runtime-qa.html`;
const serverLogPath=join(artifacts,'photo-fit-http.log');
const chromeLogPath=join(artifacts,'photo-fit-chrome.log');
const resultPath=join(artifacts,'photo-fit-browser-qa.json');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function commandPath(candidates){
 for(const name of candidates.filter(Boolean)){
  const result=spawnSync('bash',['-lc',`command -v ${JSON.stringify(name)}`],{encoding:'utf8'});
  if(result.status===0&&result.stdout.trim())return result.stdout.trim();
 }
 throw new Error('没有找到可用的 Chrome/Chromium 命令');
}
async function waitHttp(url,timeout=30000){
 const start=Date.now();let last;
 while(Date.now()-start<timeout){try{const response=await fetch(url,{cache:'no-store'});if(response.ok)return response;}catch(error){last=error;}await sleep(200);}
 throw new Error(`HTTP 服务未就绪：${url}${last?' · '+last.message:''}`);
}
async function waitJson(url,timeout=30000){const response=await waitHttp(url,timeout);return response.json();}
class CDPClient{
 constructor(url){this.url=url;this.ws=null;this.nextId=1;this.pending=new Map();this.events=[];}
 async open(){
  if(typeof WebSocket!=='function')throw new Error('当前 Node 版本没有全局 WebSocket 客户端');
  this.ws=new WebSocket(this.url);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP WebSocket 连接超时')),15000);this.ws.onopen=()=>{clearTimeout(timer);resolve();};this.ws.onerror=event=>{clearTimeout(timer);reject(new Error('CDP WebSocket 连接失败 '+String(event?.message||'')));};});
  this.ws.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message||'CDP command failed')):pending.resolve(message.result);}else this.events.push(message);};
  this.ws.onclose=()=>{for(const pending of this.pending.values())pending.reject(new Error('CDP WebSocket 已关闭'));this.pending.clear();};
 }
 send(method,params={}){const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 close(){try{this.ws?.close();}catch{}}
}
function kill(child){if(!child||child.killed)return;try{child.kill('SIGTERM');}catch{}setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},1500).unref();}
function filteredExceptions(events){
 return events.filter(event=>event.method==='Runtime.exceptionThrown').map(event=>({
  text:event.params?.exceptionDetails?.text||'exception',
  url:event.params?.exceptionDetails?.url||'',
  line:event.params?.exceptionDetails?.lineNumber??null,
  description:event.params?.exceptionDetails?.exception?.description||event.params?.exceptionDetails?.exception?.value||''
 }));
}

let server,chrome,client,target;
const serverLog=createWriteStream(serverLogPath),chromeLog=createWriteStream(chromeLogPath);
try{
 server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:['ignore','pipe','pipe']});
 server.stdout.pipe(serverLog);server.stderr.pipe(serverLog);
 await waitHttp(`http://127.0.0.1:${port}/photo-fit-test.html`,30000);

 const chromeBinary=commandPath([process.env.CHROME_BIN,'google-chrome-stable','google-chrome','chromium','chromium-browser']);
 chrome=spawn(chromeBinary,[
  '--headless=new','--no-sandbox','--disable-dev-shm-usage',`--remote-debugging-port=${debugPort}`,
  `--user-data-dir=/tmp/hrl-photo-fit-chrome-${process.pid}`,'--window-size=1440,1200',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
  '--autoplay-policy=no-user-gesture-required','about:blank'
 ],{cwd:root,stdio:['ignore','pipe','pipe']});
 chrome.stdout.pipe(chromeLog);chrome.stderr.pipe(chromeLog);
 await waitJson(`http://127.0.0.1:${debugPort}/json/version`,30000);
 const createResponse=await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(pageUrl)}`,{method:'PUT'});
 if(!createResponse.ok)throw new Error('创建 Chrome 调试页失败：'+createResponse.status);
 target=await createResponse.json();
 client=new CDPClient(target.webSocketDebuggerUrl);await client.open();
 await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Log.enable');
 await client.send('Page.navigate',{url:pageUrl});

 const started=Date.now(),timeout=12*60*1000;let payload=null,status='running';
 while(Date.now()-started<timeout){
  const evaluation=await client.send('Runtime.evaluate',{expression:`(()=>{const node=document.getElementById('qaResult');return node?{status:node.dataset.status,text:node.textContent,title:document.title}:null})()`,returnByValue:true,awaitPromise:true});
  const value=evaluation.result?.value;
  if(value?.status==='passed'||value?.status==='failed'){status=value.status;try{payload=JSON.parse(value.text);}catch{payload={status,error:'QA 结果不是有效 JSON',raw:value.text,title:value.title};}break;}
  await sleep(1000);
 }
 if(!payload)payload={schema:'humanoid_rig/photo_fit_runtime_qa_runner@0.1',status:'failed',error:'浏览器 QA 在时限内没有完成',timeoutMs:timeout};
 payload.runner={node:process.version,chromeBinary,pageUrl,durationMs:Date.now()-started};
 payload.runtimeExceptions=filteredExceptions(client.events);
 writeFileSync(resultPath,JSON.stringify(payload,null,2));
 console.log(JSON.stringify(payload,null,2));
 if(status!=='passed')process.exitCode=1;
 else if(payload.runtimeExceptions.length){console.error('检测到未捕获浏览器异常：',payload.runtimeExceptions);process.exitCode=1;}
}catch(error){
 const payload={schema:'humanoid_rig/photo_fit_runtime_qa_runner@0.1',status:'failed',error:String(error?.stack||error),serverLog:serverLogPath,chromeLog:chromeLogPath};
 writeFileSync(resultPath,JSON.stringify(payload,null,2));console.error(JSON.stringify(payload,null,2));process.exitCode=1;
}finally{
 client?.close();if(target?.id)try{await fetch(`http://127.0.0.1:${debugPort}/json/close/${target.id}`);}catch{}
 kill(chrome);kill(server);serverLog.end();chromeLog.end();
}
