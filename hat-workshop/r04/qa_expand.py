from pathlib import Path
r=Path(__file__).resolve().parent;p=r/'qa.py';s=p.read_text()
old="if id in ['cable','trilby','sherpa']:page.locator('#canvas').screenshot(path=str(out/(id+'-head-'+str(head)+'.png')))"
new=old+"\n     if id=='cable':(out/('cable-head-'+str(head)+'-geometry.json')).write_text(json.dumps(page.evaluate('hatLab.debugGeometry()')))"
if 'cable-head-'+str(0)+'-geometry.json' not in s and 'independent wall export' not in s:
 assert old in s
 s=s.replace(old,new)
 s='# independent wall export: raw dumps stay in Actions evidence, not production assets\n'+s
 p.write_text(s)
