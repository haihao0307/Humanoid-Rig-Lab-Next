from pathlib import Path
import json,hashlib,base64,subprocess,urllib.request,re,os
R=Path(__file__).resolve().parent;A=R.parent/'hc-s3-1';P=R.parent/'hc-s2-1';S=R.parent/'hc-s3';G=R/'_generated';G.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
anchor=json.loads((R/'TASK_ANCHOR.json').read_text());source={k:anchor['nativeSource'][k] for k in ['repository','commit','path','sha256']}
url='https://raw.githubusercontent.com/'+source['repository']+'/'+source['commit']+'/'+source['path']
cache=R/'_source_audit/index.html'
b=cache.read_bytes() if cache.exists() else urllib.request.urlopen(url,timeout=120).read()
assert sha(b)==source['sha256'],'APPROVED_P02_DIGEST_MISMATCH'
original=b.decode();assert len(b)==761310 and original.count('window.KnitPublic=')==1
assert 'KNIT-PUBLIC-P03' not in original
# Binding names are reviewed against the exact SHA256-pinned retained build.
# They are never inferred from an arbitrary or changed minified runtime.
for fragment in ['Qr="KNIT-PUBLIC-P02"','Al=16,$h=20,_f=.0058,gS=.0029,xf=86e-5','var ni=!0,Sf=!1,gg=0,_g=0,vf=!1,an=null,Vn=null','jacket:jr?.report()','glError:je.getContext().getError()']:
 assert fragment in original,('NATIVE_BINDING_MISMATCH',fragment)
access='()=>({version:Qr,ready:Sf,settings:ie,dirty:ni,building:vf,builds:gg,frames:_g,mesh:an,fur:Vn,jacket:jr,renderer:je,camera:Tn,controls:wn,uniforms:Hn,cols:Al,rows:$h,pitch:_f,spacing:gS,radius:xf})'
observer=(R/'knit-observer.js').read_text()
for forbidden in ['.getError(','.render(','.updateMatrixWorld(','.setParam(','.report(','.dispose(','transferToImageBitmap']:
 assert forbidden not in observer,('OBSERVER_MUTATING_ROUTE',forbidden)
insertion='/*RF31B_OBSERVER_BEGIN*/window.KAOPU_REALITY='+observer+'('+access+','+json.dumps(source)+');/*RF31B_OBSERVER_END*/'
native=original.replace('window.KnitPublic=',insertion+'window.KnitPublic=');assert native.replace(insertion,'')==original
(G/'knit-before.html').write_bytes(b);(G/'knit-after.html').write_text(native)
def const(html,name):
 i=html.index('const '+name+'=')+len('const '+name+'=');return json.JSONDecoder().raw_decode(html[i:])[0]
a=(A/'preview.html').read_text();am=json.loads((A/'BUILD_MANIFEST.json').read_text());assert sha(a.encode())==am['html']['sha256']
ad=const(a,'RF31_BUILD');denim=const(a,'RF31_NATIVE_B64');assert sha(base64.b64decode(denim))==ad['native']['augmentedHTMLSHA256']
protocol=(P/'protocol.js').read_text();assert sha(protocol.encode())==ad['dependencies']['protocolSHA256']
sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
files=['TASK_ANCHOR.json','knit-observer.js','knit-bridge.js','controller.js','build.py','tests/protocol.cjs','tests/browser.py','README.md']
m={'version':'REALITY-HC-S3.1-B','sourceCommit':sourceCommit,'sources':{'knit':source,'denim':ad['native']['source']},'knitBaseline':'KNIT-P02-C2-RETAINED','parentBuild':{'sourceCommit':am['sourceCommit'],'htmlSHA256':am['html']['sha256']},'sourceFiles':{n:sha((R/n).read_bytes()) for n in files},'dependencies':{'protocolSHA256':sha(protocol.encode()),'previousBridgeSHA256':sha((A/'bridge.js').read_bytes()),'dictionarySHA256':sha((P/'measurement-dictionary.json').read_bytes()),'historySHA256':sha((S/'material-snapshots.json').read_bytes())},'nativeAssembly':{'beforeSHA256':sha(b),'afterSHA256':sha(native.encode()),'observerInsertionSHA256':sha(insertion.encode()),'removalExact':True,'retainedDenimSHA256':sha(base64.b64decode(denim))},'liveNativeFamilies':['denim','knit'],'leatherLive':False,'productionSourceChanged':False,'productionExporterInstalled':False,'clothPhysicsAdded':False,'userVisualAccepted':False,'physicalCertification':False}
html=(A/'index.template.html').read_text()
def replace(old,new,count=1):
 global html
 assert html.count(old)==count,('TEMPLATE_ANCHOR',old,html.count(old));html=html.replace(old,new)
replace('<button id="load" class="primary">加载原生牛仔 R17.2</button>','<button id="load-knit" class="primary">加载保留版毛衣 P02 C2</button><button id="load" style="margin-top:8px">加载原生牛仔 R17.2</button>')
replace('<button id="read" disabled class="primary">读取当前原生清单</button>','<button id="read" disabled class="primary">读取当前原生清单</button><button id="read-deep" disabled>深度只读校验</button>')
replace('S3.1-A：让规范读取当前代码实际使用的数值，而不只重复历史声明。','S3.1-B：保留版毛衣与牛仔共用实时接口；生成几何、原生控件和实物证据分别检查。')
replace('针织、皮革等仍是历史快照，不冒充实时接入。','旧R15针织是独立历史对象，不等于当前P02。皮革等仍未实时接入。')
replace('原生牛仔尚未启动。点击上方按钮即可查看原来的三维裤装，不会重新下载或生成替身。','原生工作台尚未启动。选择毛衣或牛仔，保留原来的三维样片与控件；不会用新模型代替。')
replace('先改原生“织纹尺度”或“针脚节距”，再比较。本页没有替你修改原生参数。','可改毛衣的密度、长度、花型或牛仔的织纹、针距，再比较。重型完整性检查只手动运行，不在拖动时扫描全网格。')
replace('已实施方向：牛仔实时只读导出、S3历史到S2.1共同协议的显式桥接、差异和导入可信度检查。针织、皮革实时导出和成衣关联尚未完成。','本轮增加保留版P02 C2针织只读导出，保留牛仔与七类S3历史桥接。针织无布料物理；皮革实时导出、原生产源安装与成衣关联仍未完成。')
replace('本页使用相同原生生成程序，没有新模型或静态图替代。旧工作台不被覆盖；帧内保护检查仅覆盖声明的字段，不承诺所有驱动状态或实物制造正确。','本页保留P02与牛仔原程序。常规读取只核对元数据、采样点和材质状态；深度校验增加完整CPU几何数组指纹，不承诺全部GPU驱动状态或实物制造正确。')
replace('本页自包含原生牛仔与规范核心','本页自包含保留版毛衣、牛仔与规范核心')
js='const RF31B_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF31_DICTIONARY='+(P/'measurement-dictionary.json').read_text()+';\nconst RF31_HISTORY='+(S/'material-snapshots.json').read_text()+';\nconst RF31B_NATIVES='+json.dumps({'knit':base64.b64encode(native.encode()).decode(),'denim':denim})+';\n'+protocol+'\n'+(A/'bridge.js').read_text()+'\n'+(R/'knit-bridge.js').read_text()+'\n'+(R/'controller.js').read_text()
assert '</script' not in js.lower();(G/'bundle.js').write_text(js);subprocess.run(['node','--check',str(G/'bundle.js')],check=True)
for i,s in enumerate(re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',native)):
 p=G/f'knit-script-{i}.js';p.write_text(s);subprocess.run(['node','--check',str(p)],check=True)
replace('<!-- RF31_SCRIPTS -->','<script>\n'+js+'\n</script>')
(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
q=R/'qa/source';q.mkdir(parents=True,exist_ok=True);(q/'ASSEMBLY.json').write_text(json.dumps({'passed':True,'knitSource':source,'sourceHTMLBytes':len(b),'removalExact':True,'retainedDenimUnchanged':True,'oldCommonProtocolUnchanged':True,'productionFilesChanged':False,'newShadersOrGeometry':False},indent=2))
print(json.dumps({'sourceCommit':sourceCommit,'html':m['html'],'nativeAssembly':m['nativeAssembly']},indent=2))
