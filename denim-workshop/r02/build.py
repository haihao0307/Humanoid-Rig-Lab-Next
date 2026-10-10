from pathlib import Path
p=Path(__file__).parent
s=(p/'template.html').read_text().replace('/*CORE*/',(p/'core.js').read_text()).replace('/*APP*/',(p/'app.js').read_text())
(p/'index.html').write_text(s)
print('Built',len(s.encode()))
