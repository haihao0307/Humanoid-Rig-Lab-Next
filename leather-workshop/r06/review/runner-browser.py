from pathlib import Path
R=Path(__file__).resolve().parents[1]
def change(old,new):
 p=R/'qa.py';s=p.read_text()
 if new in s:return
 assert old in s and s.count(old)==1,'QA source drift: stop'
 p.write_text(s.replace(old,new))
change('import argparse, hashlib, json, time, traceback','import argparse, hashlib, json, time, traceback, os')
change('browser=p.chromium.launch(headless=True,args=','browser=p.chromium.launch(executable_path=os.environ.get("KAOPU_CHROMIUM_EXECUTABLE"),headless=True,args=')
change(' page=browser.new_page(', ' report["browserEnvironment"]={"version":browser.version,"executable":os.environ.get("KAOPU_CHROMIUM_EXECUTABLE","Playwright bundled Chromium")}\n page=browser.new_page(')
print('Browser selection is explicit and recorded; rendering, physical, geometry and public URL assertions are unchanged.')
