from pathlib import Path
p=Path(__file__).parent
s=(p/'template.html').read_text().replace('/*CORE*/',(p/'core.js').read_text()).replace('/*APP*/',(p/'app.js').read_text())
s=s.replace('</style>', (p/'mobile-first-look.css').read_text()+'</style>', 1)
(p/'index.html').write_text(s)
print('Built',len(s.encode()))
