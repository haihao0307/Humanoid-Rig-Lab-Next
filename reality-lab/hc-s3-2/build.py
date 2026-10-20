from pathlib import Path
import argparse,base64,gzip,hashlib,importlib.util,json,os,re,shutil,subprocess,tempfile,datetime
R=Path(__file__).resolve().parent;C=R.parent/'hc-s3-1-c';A=R.parent/'hc-s3-1';G=R/'_generated';G.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
def const(h,name):
 key='const '+name+'=';i=h.index(key)+len(key);return json.JSONDecoder().raw_decode(h[i:])[0]
def replace(s,a,b):
 if s.count(a)!=1:raise RuntimeError('PATCH_ANCHOR:'+a[:100]+':'+str(s.count(a)))
 return s.replace(a,b)
def module(path):
 spec=importlib.util.spec_from_file_location('source_installer',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def prepare(source_root):
 anchor=json.loads((R/'TASK_ANCHOR.json').read_text());entry=source_root/anchor['sourceEntry'];dest=entry.parent/'reality-s32'
 if dest.exists():
  old=json.loads((dest/'INSTALL_LOCK.json').read_text())
  if sha(entry.read_bytes()) not in [old['installedHTMLSHA256'],old['originalEntrySHA256']]:raise RuntimeError('TRIAL_SOURCE_DRIFT')
  original=(dest/'original-preview-v3.html').read_bytes()
 else:original=entry.read_bytes()
 assert sha(original)==anchor['originalEntrySHA256']
 base=(entry.parent/'index.html').read_bytes();assert sha(base)=='60c49adec887ac81ebe4b9f1b0807fbddab4c035dc030b65ad9f6e21701fc817'
 # Reproduce the actual source's published R17.2 assembly independently of S3.1's copy.
 script=re.search(r'<script>([\s\S]*)</script>',original.decode()).group(1)
 replay={'script':script,'base':base.decode(),'url':'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/a5af1e0140c935703dec7c4d4da4f5549449b657/denim-workshop/r17-scale/index.html'}
 (G/'replay.json').write_text(json.dumps(replay))
 node="const fs=require('fs'),vm=require('vm'),x=JSON.parse(fs.readFileSync(process.argv[1]));let h=null;Promise.resolve(vm.runInNewContext(x.script,{fetch:async u=>{if(u!==x.url)throw Error('UNPINNED_FETCH');return{ok:true,text:async()=>x.base}},document:{open(){},write(s){h=s},close(){},body:{}},console:{error(e){throw e}}},{timeout:5000})).then(()=>{if(!h)throw Error('NO_ASSEMBLY');fs.writeFileSync(process.argv[2],h)}).catch(e=>{console.error(e);process.exitCode=1});"
 subprocess.run(['node','-e',node,str(G/'replay.json'),str(G/'renderer-before.html')],check=True)
 rendered=(G/'renderer-before.html').read_bytes();assert sha(rendered)==anchor['originalRenderedHTMLSHA256']
 old_page=(C/'preview.html').read_bytes();assert sha(old_page)=='41f0e4c2826c946964b980b65a861c72b89546087b6f8b00ea1920eb3c8ca71b'
 previous=const(old_page.decode(),'RF31C_BUILD');lineage=previous['sources']['denim']
 adapter=(A/'native-exporter.js').read_bytes();mount=(R/'source-mount.js').read_bytes()
 implementation=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
 core={'schema':'kaopu/reality-source-installation@1','installationId':'RF01-S32-DENIM-R17','scope':'trial_branch','repository':anchor['sourceRepository'],'sourceBranch':anchor['sourceTrialBranch'],'sourceBaseCommit':anchor['sourceBaseCommit'],'entryPath':anchor['sourceEntry'],'adapterVersion':'0.3.1-a','adapterSHA256':sha(adapter),'rendererSHA256':sha(rendered),'implementationCommit':implementation,'productionBranch':anchor['sourceProductionBranch'],'authorities':{'sourceWriteAPI':False,'mergeAuthorized':False,'productionInstalled':False,'physicalCertification':False}}
 dest.mkdir(exist_ok=True)
 resources={'renderer.html':rendered,'adapter.js':adapter,'mount.js':mount,'lineage.json':json.dumps(lineage,indent=2).encode(),'original-preview-v3.html':original}
 for name,data in resources.items():(dest/name).write_bytes(data)
 shutil.copy2(R/'source-install.py',dest/'install.py')
 lock={'schema':'kaopu/reality-install-lock@1','core':core,'originalEntrySHA256':sha(original),'inputs':{k:sha(v) for k,v in resources.items() if k!='original-preview-v3.html'}}
 installer=module(R/'source-install.py');output=installer.compose(dest,lock);lock['installedHTMLSHA256']=sha(output);lock['installedBytes']=len(output)
 (dest/'INSTALL_LOCK.json').write_text(json.dumps(lock,ensure_ascii=False,indent=2))
 # The only production-shaped path changed is in the explicitly isolated native trial branch.
 # For a rerun, restore the already-verified original entry before applying the new exact candidate.
 entry.write_bytes(original);installed=installer.apply(dest,'install');assert sha(entry.read_bytes())==lock['installedHTMLSHA256']
 (G/'source-installed.html').write_bytes(output)
 (dest/'README.md').write_text('# RF01 S3.2 — 牛仔源端只读试装\n\n此目录位于独立试装分支，不代表原工作分支或main已安装。原入口preview-v3.html已内联相同R17.2渲染器并安装既有只读导出器；原shader/几何不改。\n\n在此目录执行`python install.py status`检查；`python install.py uninstall`逐字恢复原发布包装器；`python install.py install`重新试装。已有未知改动时拒绝覆盖；命令不会提交Git、推送或合并。进入原工作分支时拒绝安装/卸载。INSTALL_LOCK.json记录所有输入和输出摘要。\n\n原界面末尾“世界规范接口”可独立导出当前读数，不需要规范平台。实物厚度/Tex仍未知，生产安装及用户视觉验收仍未完成。\n')
 q=R/'qa/source';q.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory() as t:
  test=Path(t)/'native/reality-s32';shutil.copytree(dest,test);(test.parent/'preview-v3.html').write_bytes(output)
  results=[installer.apply(test,'install'),installer.apply(test,'uninstall')]
  assert (test.parent/'preview-v3.html').read_bytes()==original
  results.append(installer.apply(test,'uninstall'));results.append(installer.apply(test,'install'))
  assert (test.parent/'preview-v3.html').read_bytes()==output
  (test.parent/'preview-v3.html').write_bytes(output+b'\nunknown edit')
  try:installer.apply(test,'uninstall');raise AssertionError('TAMPER_ACCEPTED')
  except RuntimeError as e:assert str(e)=='SOURCE_DRIFT_NO_OVERWRITE'
  assert (test.parent/'preview-v3.html').read_bytes().endswith(b'unknown edit')
 (q/'INSTALL_TEST.json').write_text(json.dumps({'passed':True,'roundTripExact':True,'idempotentInstall':not results[0]['changed'],'idempotentUninstall':not results[2]['changed'],'unknownEditRefused':True,'originalRendererSHA256':sha(rendered),'results':results},indent=2))
 (R/'SOURCE_PREPARED.json').write_text(json.dumps({'core':core,'lock':lock,'sourceEntry':str(entry.resolve()),'sourceRoot':str(source_root.resolve())},ensure_ascii=False,indent=2))
 for index,s in enumerate(re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',output.decode())):
  p=G/f'native-{index}.js';p.write_text(s);subprocess.run(['node','--check',str(p)],check=True)
 print(json.dumps({'sourceInstalledInTrial':True,'lock':lock,'rollbackPassed':True},ensure_ascii=False,indent=2))

def portal(source_commit):
 prepared=json.loads((R/'SOURCE_PREPARED.json').read_text());proof=json.loads((R/'qa/source-public/BROWSER.json').read_text());lock=prepared['lock'];core=prepared['core']
 assert proof['passed'] and proof['sourceCommit']==source_commit and proof['htmlSHA256']==lock['installedHTMLSHA256']
 h=(C/'preview.html').read_text();before=h;old=const(h,'RF31C_BUILD');packs=const(h,'RF31C_PACKS');source_html=(G/'source-installed.html').read_bytes();assert sha(source_html)==lock['installedHTMLSHA256']
 reg={'schema':'kaopu/reality-connection-registry@1','version':'REALITY-HC-S3.2','sourceCheckAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'originalEntrySHA256':lock['originalEntrySHA256'],'entries':[]}
 for family in ['denim','knit','leather']:
  item={'family':family,'lineage':old['sources'][family],'historicalRegistered':True,'copyVerified':True,'copyEvidence':{'publicCommit':'50100e28a9768849f5766bf2d9406f50b944c1a7','workflowRun':'39378188298'},'productionInstalled':False,'productionVerified':False,'installation':None}
  if family=='denim':item.update(productionHeadAtCheck=core['sourceBaseCommit'],installation={'core':core,'commit':source_commit,'htmlSHA256':lock['installedHTMLSHA256'],'bytes':len(source_html),'sourcePublicVerification':{'passed':True,'commit':source_commit,'htmlSHA256':lock['installedHTMLSHA256'],'workflowRun':os.environ.get('GITHUB_RUN_ID'),'checkCount':len(proof['checks'])}})
  reg['entries'].append(item)
 (R/'connection-registry.json').write_text(json.dumps(reg,ensure_ascii=False,indent=2))
 native_pack={'encoding':'gzip-base64','bytes':len(source_html),'sha256':sha(source_html),'data':base64.b64encode(gzip.compress(source_html,mtime=0)).decode()}
 panel='''<section class="card" id="rf32-panel"><h2>S3.2 · 接入状态与源端版本</h2><p class="notice">源端试装分支已经独立验证，不等于原工作分支已合并或生产部署。材质检查结果也不等于安装状态。</p><div class="table-wrap"><table><thead><tr><th>材料</th><th>历史</th><th>隔离副本</th><th>源端试装</th><th>原工作分支</th></tr></thead><tbody id="rf32-connections"></tbody></table></div><div class="toolbar"><a id="rf32-source-link" target="_blank" rel="noopener noreferrer">独立打开牛仔源端试装 ↗</a><a id="rf32-old-link" target="_blank" rel="noopener noreferrer">打开未改原入口 ↗</a><button id="rf32-check-original">重新核对原分支入口</button><button id="rf32-negative">测试错误适配版本拦截</button><button id="rf32-export">导出接入登记</button></div><p id="rf32-session"></p><p id="rf32-report-mode" class="muted"></p><p id="rf32-source-check" class="muted"></p><p id="rf32-negative-result" class="muted"></p></section>'''
 h=replace(h,'<main><span id="mode"', '<main>'+panel+'<span id="mode"')
 h=h.replace('S3.1-C：皮革、毛衣、牛仔共用规范检查；倍率、数字壳厚与实物测量严格分开。','S3.2：真实接入状态与版本核对；牛仔源端可回滚试装，毛衣和皮革保留。')
 h=replace(h,'加载原生牛仔 R17.2','连接牛仔源端试装')
 prefix='const RF32_REGISTRY='+json.dumps(reg,ensure_ascii=False)+';\nconst RF32_INSTALLED_PACK='+json.dumps(native_pack)+';\n'+(R/'connection-contract.js').read_text()+'\n'+(R/'platform-link.js').read_text()+'\n'
 h=replace(h,"(function(){\n'use strict';\n\nasync function unpack(kind)",prefix+"(function(){\n'use strict';\n\nasync function unpack(kind)")
 h=replace(h,'async function unpack(kind){','async function unpack(kind){\n if(kind===\'denim\')return RF32Link.load();')
 h=replace(h,'function stop(){generation++;','function stop(){RF32Link.close();generation++;')
 h=replace(h,'const candidate=K.normalize(result,D,RF31C_BUILD.sources,false);','const candidate=K.normalize(result,D,RF31C_BUILD.sources,false);RF32Link.verify(kind,f,result);')
 h=replace(h,'function render(){','function render(){\n RF32Link.reportMode(current?.sourceMode||null,family);')
 h=h.replace("/^NATIVE_/.test(e.message||'')","/^(NATIVE_|SOURCE_|INSTALLED_)/.test(e.message||'')")
 implementation=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
 old_copy=json.dumps(old,ensure_ascii=False);start=h.index('const RF31C_BUILD=')+len('const RF31C_BUILD=');_,end=json.JSONDecoder().raw_decode(h[start:]);old['sourceCommit']=implementation;h=h[:start]+json.dumps(old,ensure_ascii=False)+h[start+end:]
 h=h.replace("'S3.1-C · '","'S3.2 · '")
 extra="\nwindow.__REALITY_S32__=Object.freeze({...window.__REALITY_S31C__,version:'REALITY-HC-S3.2',connections:()=>RF32Link.report()});\n"
 h=replace(h,'</script></body></html>',extra+'</script></body></html>')
 assert sha((C/'preview.html').read_bytes())==sha(before.encode())
 bundle=re.search(r'<script>([\s\S]*)</script>',h).group(1);(G/'portal-bundle.js').write_text(bundle);subprocess.run(['node','--check',str(G/'portal-bundle.js')],check=True)
 (R/'preview.html').write_text(h)
 manifest={'version':'REALITY-HC-S3.2','sourceCommit':implementation,'sourceTrialCommit':source_commit,'sourceCore':core,'sourceInstalledHTML':{'bytes':len(source_html),'sha256':sha(source_html)},'html':{'bytes':len(h.encode()),'sha256':sha(h.encode())},'registrySHA256':sha((R/'connection-registry.json').read_bytes()),'sourceFiles':{n:sha((R/n).read_bytes()) for n in ['TASK_ANCHOR.json','connection-contract.js','source-mount.js','source-install.py','platform-link.js','build.py','tests/protocol.cjs','tests/browser.py','README.md']},'previousPlatformSHA256':sha(before.encode()),'previousKnitAndLeatherPackagesUnchanged':True,'sourceTrialVerified':True,'productionInstalled':False,'physicalCertification':False,'userVisualAccepted':False}
 (R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps(manifest,ensure_ascii=False,indent=2))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('stage',choices=['prepare','portal']);p.add_argument('--source-root',type=Path);p.add_argument('--source-commit');a=p.parse_args()
 if a.stage=='prepare':prepare(a.source_root.resolve())
 else:portal(a.source_commit)
