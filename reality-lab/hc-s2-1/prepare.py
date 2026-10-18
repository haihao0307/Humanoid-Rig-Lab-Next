"""One-time exact edits to new S2.1 source only. Never touches S1, S2 or production workbenches."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def replace(name,old,new):
 p=ROOT/name;text=p.read_text()
 if new in text:
  assert old not in text,(name,'mixed source state');return False
 assert text.count(old)==1,(name,'unexpected source; stop rather than overwrite')
 p.write_text(text.replace(old,new));return True

changed=False
changed|=replace('app.js',"function select(id){const next=configs.find(x=>x.id===id);if(!next)throw Error('对象不在允许范围');selected=id;", "function select(id){const next=configs.find(x=>x.id===id);if(!next)throw Error('对象不在允许范围');if(frame&&(next.registeredOnly||frameGroup!==next.group))unload();selected=id;")
changed|=replace('app.js',"frame=iframe;frameGroup=group;$('native-wrap').replaceChildren(iframe);$('native-caption').textContent='固定文件摘要已核对，正在初始化';", "frame=iframe;frameGroup=group;$('native-wrap').replaceChildren(iframe);$('unload').disabled=false;$('native-caption').textContent='固定文件摘要已核对，正在初始化';")
changed|=replace('app.js',"select(selected);$('unload').disabled=false;status('共同协议、测量字典和适配器已就绪。请选择对象读取；布料与成衣保持登记状态。');", "select(selected);$('unload').disabled=true;status('共同协议、测量字典和适配器已就绪。请选择对象读取；布料与成衣保持登记状态。');")
changed|=replace('tests/browser.py',"  check('public source has no access fragment', '#key=' not in page.content() and 'PRIVATE_ACCESS' not in page.content())", "  check('public startup contains no access credential',not s['keyPresent'] and page.locator('#access-key').input_value()=='' and 'PRIVATE_ACCESS.json' not in page.content())")
build=(ROOT/'build.py').read_text()
assert "public_inputs=" in build and "assert 'PRIVATE_ACCESS.json' not in public_source" in build,('build.py','privacy scan not finalized')
print('PREPARED' if changed else 'ALREADY_PREPARED')
