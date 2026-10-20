from pathlib import Path
import json,hashlib,base64,gzip,subprocess,urllib.request,re
R=Path(__file__).resolve().parent;B=R.parent/'hc-s3-1-b';A=R.parent/'hc-s3-1';P=R.parent/'hc-s2-1';G=R/'_generated';G.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
def value(html,name):
 key='const '+name+'=';i=html.index(key)+len(key);return json.JSONDecoder().raw_decode(html[i:])[0]
anchor=json.loads((R/'TASK_ANCHOR.json').read_text());source=anchor['source'];url='https://raw.githubusercontent.com/'+source['repository']+'/'+source['commit']+'/'+source['path']
cache=G/'leather-before.html';original=cache.read_bytes() if cache.exists() else urllib.request.urlopen(url,timeout=120).read();assert sha(original)==source['sha256'];cache.write_bytes(original)
h=original.decode();assert h.count('boot().catch(fail);')==1 and "const VERSION='R17.0-B1'" in h
observer=(R/'leather-observer.js').read_text()
for forbidden in ['.updateMatrix','.report(','.render(','.flushPose(','.step(','.getError(','.prepare(','.postMessage(','.dispose(']:assert forbidden not in observer,forbidden
access='()=>({ready,version:VERSION,hero,solver:productSolver,renderer,camera,config:craftConfig,product,material,mode,revision,dirty,allDirty,light,spec:PRODUCT_SPECS[product],draws:presentationStats.sceneDraws,evaluate:evaluateBoundVertex})'
insertion='/*RF31C_OBSERVER_BEGIN*/window.KAOPU_REALITY='+observer+'('+access+','+json.dumps(source)+');/*RF31C_OBSERVER_END*/\n'
leather=h.replace('boot().catch(fail);',insertion+'boot().catch(fail);');assert leather.replace(insertion,'')==h;(G/'leather-after.html').write_text(leather)
b=(B/'preview.html').read_text();bm=json.loads((B/'BUILD_MANIFEST.json').read_text());assert sha(b.encode())==bm['html']['sha256']=='76050f648930dbdf8338615a38e850fc47ff75f3021d3502738968b2ea0eaadd'
old=value(b,'RF31B_BUILD');natives={k:base64.b64decode(v) for k,v in value(b,'RF31B_NATIVES').items()};natives['leather']=leather.encode();sources={**old['sources'],'leather':source}
assert sha((P/'protocol.js').read_bytes())==old['dependencies']['protocolSHA256']
assert sha((B/'controller.js').read_bytes())==old['sourceFiles']['controller.js']
packs={}
for k,raw in natives.items():
 compressed=gzip.compress(raw,compresslevel=9,mtime=0);assert gzip.decompress(compressed)==raw
 packs[k]={'encoding':'gzip-base64','bytes':len(raw),'sha256':sha(raw),'compressedBytes':len(compressed),'data':base64.b64encode(compressed).decode()}
source_commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
files=['TASK_ANCHOR.json','leather-observer.js','leather-bridge.js','build.py','tests/protocol.cjs','tests/browser.py','README.md']
m={'version':'REALITY-HC-S3.1-C','sourceCommit':source_commit,'sources':sources,'parentBuild':bm['html'],'sourceFiles':{f:sha((R/f).read_bytes()) for f in files},'unchangedDependencies':{'protocol':sha((P/'protocol.js').read_bytes()),'denimBridge':sha((A/'bridge.js').read_bytes()),'knitBridge':sha((B/'knit-bridge.js').read_bytes()),'previousController':sha((B/'controller.js').read_bytes())},'nativeAssembly':{'originalLeatherSHA256':sha(original),'augmentedLeatherSHA256':sha(leather.encode()),'removalExact':True},'packages':{k:{t:v for t,v in p.items() if t!='data'} for k,p in packs.items()},'liveFamilies':['denim','knit','leather'],'originalSourceModified':False,'productionExporterInstalled':False,'physicsChanged':False,'userVisualAccepted':False}
controller=(B/'controller.js').read_text().replace('RF31B_','RF31C_').replace('__REALITY_S31B__','__REALITY_S31C__').replace('REALITY-HC-S3.1-B','REALITY-HC-S3.1-C').replace('S3.1-B · ','S3.1-C · ')
def patch(s,a,z,count=1):
 assert s.count(a)==count,('PATCH_ANCHOR',a,s.count(a));return s.replace(a,z)
controller=patch(controller,'const K=RealityKnitBridge','const K=RealityLeatherBridge')
controller=patch(controller,"names={knit:'毛衣 P02 C2',denim:'牛仔 R17.2'}","names={knit:'毛衣 P02 C2',denim:'牛仔 R17.2',leather:'皮革 R17'}")
controller=patch(controller,"!['knit','denim'].includes(kind)","!['knit','denim','leather'].includes(kind)")
controller=patch(controller,"kind==='knit'?","kind!=='denim'?")
controller=patch(controller,"!ready||family!=='knit'","!ready||family==='denim'")
controller=patch(controller,"f.srcdoc=new TextDecoder().decode(Uint8Array.from(atob(RF31C_NATIVES[kind]),c=>c.charCodeAt(0)));","const decoded=await unpack(kind);if(g!==generation)return;f.srcdoc=decoded;")
controller=patch(controller,"if(f.contentWindow.KAOPU_REALITY){ready=true;break;}","if(f.contentWindow.KAOPU_REALITY&&(kind!=='leather'||f.contentWindow.LEATHER_ATELIER?.ready)){ready=true;break;}")
controller=patch(controller,"$('load').onclick=handle(()=>loadNative('denim'));","$('load-leather').onclick=handle(()=>loadNative('leather'));$('load').onclick=handle(()=>loadNative('denim'));")
controller=patch(controller,"message(e.message||String(e),true);","if(/^NATIVE_/.test(e.message||'')){retain();render();}message(e.message||String(e),true);")
controller=patch(controller,"$('changes').replaceChildren();", "$('panel-card').hidden=!packet?.parts;$('part-rows').replaceChildren();for(const p of packet?.parts||[]){const row=document.createElement('tr');for(const t of [p.id,(p.designThicknessM*1000).toFixed(5),(p.sampledMinM*1000).toFixed(5),(p.sampledMaxM*1000).toFixed(5),String(p.sampleVertexIds.length)])row.append(node('td',t));$('part-rows').append(row);}$('changes').replaceChildren();")
controller=controller.replace('保留版毛衣P02 C2与牛仔可在同一入口按需读取；R15、皮革等旧证据仍单列。','皮革R17、保留版毛衣P02 C2和牛仔可按需读取；旧证据仍单列。').replace("knitBaseline:'P02-C2',clothPhysicsAdded:false","knitBaseline:'P02-C2',leatherBaseline:'R17.0-B1',clothPhysicsAdded:false")
unpack="""
async function unpack(kind){
 const p=RF31C_PACKS[kind];if(!p)throw Error('NATIVE_PACKAGE_UNKNOWN');
 if(typeof DecompressionStream!=='function'||!globalThis.crypto?.subtle)throw Error('NATIVE_BROWSER_CAPABILITY_MISSING:需要支持gzip解压与摘要校验的浏览器');
 const raw=Uint8Array.from(atob(p.data),c=>c.charCodeAt(0));
 const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
 const reader=stream.getReader(),chunks=[];let total=0;
 for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>p.bytes){await reader.cancel();throw Error('NATIVE_PACKAGE_SIZE_MISMATCH');}chunks.push(value);}
 if(total!==p.bytes)throw Error('NATIVE_PACKAGE_SIZE_MISMATCH');const bytes=new Uint8Array(total);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==p.sha256)throw Error('NATIVE_PACKAGE_HASH_MISMATCH');return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
"""
controller=patch(controller,"const K=RealityLeatherBridge",unpack+"const K=RealityLeatherBridge")
html=b[:b.index('<script>')]
html=patch(html,'<button id="load-knit" class="primary">','<button id="load-leather" class="primary">加载原生皮革 R17</button><button id="load-knit" style="margin-top:8px">')
html=html.replace('S3.1-B：保留版毛衣与牛仔共用实时接口；生成几何、原生控件和实物证据分别检查。','S3.1-C：皮革、毛衣、牛仔共用规范检查；倍率、数字壳厚与实物测量严格分开。')
html=html.replace('皮革等仍未实时接入。','皮革实时读数使用独立成品身份；这里仍是旧快照。')
html=html.replace('皮革实时导出、原生产源安装与成衣关联仍未完成。','本轮已增加皮革成品模式；试样物理页适配、原生产源安装与成衣关联仍未完成。')
html=html.replace('选择毛衣或牛仔','选择皮革、毛衣或牛仔').replace('本页自包含保留版毛衣、牛仔与规范核心','本页按需解压原皮革、保留版毛衣、牛仔；无须另下载模型')
html=patch(html,'<section class="card"><h3>相邻两次清单的变化</h3>','<section id="panel-card" class="card" hidden><h3>皮革逐片厚度 · 单位 mm</h3><p class="muted">配方厚度不是实物测厚；表面距离是已呈现姿势的有限采样。</p><div class="table-wrap"><table><thead><tr><th>原生裁片</th><th>数字配方厚度</th><th>采样最小距离</th><th>采样最大距离</th><th>配对数</th></tr></thead><tbody id="part-rows"></tbody></table></div></section><section class="card"><h3>相邻两次清单的变化</h3>')
js='const RF31C_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF31_DICTIONARY='+json.dumps(value(b,'RF31_DICTIONARY'),ensure_ascii=False)+';\nconst RF31_HISTORY='+json.dumps(value(b,'RF31_HISTORY'),ensure_ascii=False)+';\nconst RF31C_PACKS='+json.dumps(packs)+';\n'+(P/'protocol.js').read_text()+'\n'+(A/'bridge.js').read_text()+'\n'+(B/'knit-bridge.js').read_text()+'\n'+(R/'leather-bridge.js').read_text()+'\n'+controller
assert '</script' not in js.lower();(G/'controller.js').write_text(controller);(G/'bundle.js').write_text(js);subprocess.run(['node','--check',str(G/'bundle.js')],check=True)
script=re.search(r'<script>([\s\S]*)</script>',leather).group(1);(G/'leather-script.js').write_text(script);subprocess.run(['node','--check',str(G/'leather-script.js')],check=True)
html+='<script>\n'+js+'\n</script></body></html>';(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
q=R/'qa/source';q.mkdir(parents=True,exist_ok=True);(q/'ASSEMBLY.json').write_text(json.dumps({'passed':True,'originalLeatherSHA256':sha(original),'observerRemovalExact':True,'parentHTMLSHA256':sha(b.encode()),'oldNativeBytesUnchanged':True,'losslessPackages':True,'sourceRendererOrSolverModified':False,'compressedPackageBytes':sum(p['compressedBytes'] for p in packs.values()),'uncompressedNativeBytes':sum(p['bytes'] for p in packs.values())},indent=2))
print(json.dumps({'sourceCommit':source_commit,'html':m['html'],'packages':m['packages']},indent=2))
