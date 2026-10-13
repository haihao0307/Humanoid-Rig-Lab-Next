"""Inspect the native option property directly and retain diagnostic state.
The assertion still requires absent source normals to be non-selectable.
No screenshot, runtime, threshold, error list or passed flag is modified.
"""
from pathlib import Path
p=Path(__file__).with_name('qa.py');text=p.read_text()
old="else:check('absent normal explicitly disabled '+id,p.locator('#study-layer option[value=\"relief\"]').is_disabled())"
new="else:check('absent normal explicitly disabled '+id,p.locator('#study-layer option[value=\"relief\"]').evaluate('(element)=>element.disabled'),{'snapshot':p.evaluate('hatStudy.snapshot()'),'disabledAttribute':p.locator('#study-layer option[value=\"relief\"]').get_attribute('disabled')})"
assert text.count(old)==1,'QA contract changed; reconcile first'
exec(compile(text.replace(old,new),str(p),'exec'),{'__name__':'__main__','__file__':str(p)})
