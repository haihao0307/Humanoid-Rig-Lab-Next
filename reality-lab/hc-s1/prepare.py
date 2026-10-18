"""One-time, exact edits to this new S1 implementation only. Never edits a native workbench."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def replace(name,old,new):
 p=ROOT/name;text=p.read_text()
 if new in text:
  assert old not in text,(name,'mixed migration state');return
 assert text.count(old)==1,(name,'Unexpected authored source; stop rather than overwrite')
 p.write_text(text.replace(old,new))

replace('lab.js','frame.srcdoc=new TextDecoder().decode(bytes);','frame.srcdoc=RealityIsolation.wrap(new TextDecoder().decode(bytes));')
replace('lab.js','/* Exact publicly published HTML. No injected script, source rewriting, or API patch. */','/* Digest-verified native HTML; a removable head prelude isolates Web Storage. Original geometry/material APIs and original body bytes stay unchanged. */')
replace('build.py',"'catalog.json','core.js','adapters.js','lab.html'","'catalog.json','core.js','adapters.js','isolation.js','lab.html'")
replace('build.py',"['core.js','adapters.js','lab.js']","['core.js','adapters.js','isolation.js','lab.js']")
replace('lab.html','原版内的控件只操作这个副本；基准读取按钮不回写。修改永久配方前请回到原工作台。','本页副本的 localStorage / sessionStorage 仅存在于当前 iframe 内存；测试保存不覆盖原台缓存。基准读取不回写；永久配方仍请回原工作台保存。')
replace('README.md','整个原 HTML 不改写，不注入脚本、不 patch 原 API。','原 HTML 摘要先核对；只插入可精确移除的 head 前置段，将 localStorage / sessionStorage 隔离到当前 iframe 的内存，移除前置段后与原 HTML 逐字节一致。不 patch 原生几何、材质或控制 API。该措施针对这两份已知固定源，不是任意恶意页面的安全沙箱，也没有声称隔离全部 IndexedDB/OPFS/Worker 持久化通道。')
replace('tests/browser.py',"  for identity in ['human-r07','shoe-r12']:","  page.evaluate(\"localStorage.setItem('kaopu-shoe-r12','REALITY_PARENT_PRESERVED')\")\n  for identity in ['human-r07','shoe-r12']:")
replace('tests/browser.py',"   check(identity+' only one native iframe',s['iframeCount']==1)","   check(identity+' only one native iframe',s['iframeCount']==1)\n   check(identity+' volatile Web Storage is separate',page.frame_locator('#native-frame').locator('body').evaluate('(b)=>window.__REALITY_STORAGE_ISOLATION__?.webStorage === \\\"per-frame-volatile\\\"'))".replace('\\"','"'))
replace('tests/browser.py',"   if identity=='shoe-r12':", "   if identity=='shoe-r12':\n    page.frame_locator('#native-frame').locator('#save').click()\n    check('native Save does not overwrite parent original cache',page.evaluate(\"localStorage.getItem('kaopu-shoe-r12')\")=='REALITY_PARENT_PRESERVED')")
print('Prepared only new S1 source; original native files not read or edited.')
