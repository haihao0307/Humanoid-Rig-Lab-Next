"""Run the complete QA against an already published, immutable HTML.

The preview host is outside this repository. Record its exact /favicon.ico 404
separately, if that is the cause; never ignore a different URL, a shader error,
a page exception or any application resource failure. Console locations and
failed HTTP responses remain in the committed report for inspection.
"""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=R/'qa.py';source=p.read_text()
old=" page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)"
new=''' def record_console(message):
  if message.type!='error':return
  item={'text':message.text,'location':message.location}
  report.setdefault('consoleMessages',[]).append(item)
  if message.location.get('url')=='https://htmlpreview.github.io/favicon.ico' and '404' in message.text:
   report.setdefault('hostWarnings',[]).append(item)
  else:
   report['errors'].append(item)
 page.on('console',record_console)
 page.on('response',lambda r:report.setdefault('failedResponses',[]).append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 report['hostWarningPolicy']='Only the exact preview-host favicon.ico HTTP 404 is non-application; it stays visible in consoleMessages and hostWarnings. No application error or asset is excluded.'
 report['acceptanceWrapper']='leather-workshop/r06/review/public-accept.py'
'''.rstrip()
assert source.count(old)==1,'QA console hook drift: stop'
source=source.replace(old,new)
old="  check('console and page errors are empty',not report['errors'],report['errors'])"
new="  check('application console and page errors are empty; host warnings are separately recorded',not report['errors'],report['errors'])\n  check('application own error tracker is empty',not page.evaluate('LEATHER_ATELIER.errors'))"
assert source.count(old)==1,'QA error assertion drift: stop'
source=source.replace(old,new)
exec(compile(source,str(p),'exec'),{'__name__':'__main__','__file__':str(p)})
