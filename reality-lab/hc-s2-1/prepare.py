"""One-time exact edits to new S2.1 source only. Never touches S1, S2 or production workbenches."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def replace(name,old,new):
 p=ROOT/name;text=p.read_text()
 if new in text:
  assert old not in text,(name,'mixed source state');return False
 assert text.count(old)==1,(name,'unexpected source; stop rather than overwrite')
 p.write_text(text.replace(old,new));return True

def insert_before(name,marker,insert,sentinel):
 p=ROOT/name;text=p.read_text()
 if sentinel in text:return False
 assert text.count(marker)==1,(name,'unexpected insertion point')
 p.write_text(text.replace(marker,insert+marker));return True

changed=False
changed|=replace('app.js',"function select(id){const next=configs.find(x=>x.id===id);if(!next)throw Error('对象不在允许范围');selected=id;", "function select(id){const next=configs.find(x=>x.id===id);if(!next)throw Error('对象不在允许范围');if(frame&&(next.registeredOnly||frameGroup!==next.group))unload();selected=id;")
changed|=replace('app.js',"frame=iframe;frameGroup=group;$('native-wrap').replaceChildren(iframe);$('native-caption').textContent='固定文件摘要已核对，正在初始化';", "frame=iframe;frameGroup=group;$('native-wrap').replaceChildren(iframe);$('unload').disabled=false;$('native-caption').textContent='固定文件摘要已核对，正在初始化';")
changed|=replace('app.js',"select(selected);$('unload').disabled=false;status('共同协议、测量字典和适配器已就绪。请选择对象读取；布料与成衣保持登记状态。');", "select(selected);$('unload').disabled=true;status('共同协议、测量字典和适配器已就绪。请选择对象读取；布料与成衣保持登记状态。');")
changed|=replace('tests/browser.py',"  check('public source has no access fragment', '#key=' not in page.content() and 'PRIVATE_ACCESS' not in page.content())", "  check('public startup contains no access credential',not s['keyPresent'] and page.locator('#access-key').input_value()=='' and 'PRIVATE_ACCESS.json' not in page.content())")
changed|=insert_before('adapters.js','function adapterShell(identity,reader)',"async function observeS1WhenStable(api,timeout=30000){\n const start=performance.now();let last=null;\n while(performance.now()-start<=timeout){\n  try{api.observe();return api.report();}\n  catch(error){last=error;const message=String(error?.message||error);if(!message.includes('矩阵尚未更新')&&!message.includes('尚未就绪'))throw error;await new Promise(resolve=>setTimeout(resolve,120));}\n }\n throw last||Error('原生对象在限定时间内没有形成稳定可读矩阵');\n}\n",'async function observeS1WhenStable')
changed|=replace('adapters.js',"const api=await waitFor(()=>runtime.__REALITY_LAB__);api.select(objectId);await api.loadNative();api.observe();const report=api.report();return baseFromS1(report,objectId,dictionary);", "const api=await waitFor(()=>runtime.__REALITY_LAB__);api.select(objectId);await api.loadNative();const report=await observeS1WhenStable(api);return baseFromS1(report,objectId,dictionary);")
changed|=replace('adapters.js',"const api=Object.freeze({toMeters,baseFromS1,baseFromS2,createS1Adapter,createS2Adapter,waitFor});", "const api=Object.freeze({toMeters,baseFromS1,baseFromS2,createS1Adapter,createS2Adapter,waitFor,observeS1WhenStable});")
changed|=replace('tests/browser.py',"  page.locator('[data-object=\"shoe-r12\"]').click();started=time.monotonic();page.locator('#load').click();page.wait_for_function('window.__REALITY_FOUNDATION__.report().results[\"shoe-r12\"]',timeout=300000);R['shoeLoadMs']=(time.monotonic()-started)*1000", "  page.locator('[data-object=\"shoe-r12\"]').click();started=time.monotonic();page.locator('#load').click();page.wait_for_function('window.__REALITY_FOUNDATION__.report().results[\"shoe-r12\"]||document.querySelector(\"#status\").classList.contains(\"error\")',timeout=300000);R['shoeLoadMs']=(time.monotonic()-started)*1000\n  check('shoe public read completed without transient matrix error','shoe-r12' in state()['results'],page.locator('#status').inner_text())")
build=(ROOT/'build.py').read_text()
assert "runtime_inputs=" in build and "assert 'PRIVATE_ACCESS.json' not in runtime_source" in build and 'credential_literals' in build,('build.py','runtime-only privacy guard not finalized')
print('PREPARED' if changed else 'ALREADY_PREPARED')
