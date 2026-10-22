from pathlib import Path
import json,hashlib,gzip,base64,subprocess,os
R=Path(__file__).resolve().parent;sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(R/'RESULT.json').read_bytes();data=json.loads(raw);certs=json.loads((R/'CERTIFICATES.json').read_text());tests=json.loads((R/'qa/TESTS.json').read_text());ct=json.loads((R/'qa/CERTIFICATE_TESTS.json').read_text())
assert data['schema']=='kaopu/contact-shape-experiment@1' and tests['passed'] and ct['passed']
assert not data['sourceWritten'] and not data['fullMotionExecuted']
compact=json.loads(raw);compact['schema']='kaopu/contact-shape-review@1';compact['certificates']=certs['certificates']
for c in compact['cases']:
 g={'points':{},'faces':{},'body':{}}
 for v in c['variants'].values():
  for s in v['scopes']:
   geom=s.pop('geometry');afterPoints={};body=set()
   for side,rows in geom.items():
    for t in rows['cloth']:
     g['faces'][t['faceOffset']]=t['nodeIds']
     for node,p in zip(t['nodeIds'],t['triangle']):
      if side=='before':g['points'][node]=p
      elif node in s['nodes']:afterPoints[node]=p
    for t in rows['body']:g['body'][t['faceOffset']]=t['triangle'];body.add(t['faceOffset'])
   s['afterPoints']=afterPoints;s['bodyOffsets']=sorted(body)
 c['geometry']=g
source=os.environ.get('SOURCE_COMMIT') or subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
files=['contact-shape.mjs','prepare.py','evaluate.mjs','linear-certificate.py','certificate.mjs','tests.mjs','app.js','index.html','build.py','browser.py','README.md']
m={'version':'REALITY-HC-S3.14','sourceCommit':source,'sourceFiles':{n:sha((R/n).read_bytes()) for n in files},'rawReportSHA256':sha(raw),'linearModelSHA256':sha((R/'LINEAR_SYSTEMS.json').read_bytes()),'certificateSHA256':sha((R/'CERTIFICATES.json').read_bytes()),'fixtureRun':data['fixtureRun'],'policy':data['policy'],'directionPolicy':data['directionPolicy'],'actualFrozenCases':len(data['cases']),'rulesChecks':tests['count'],'certificateChecks':ct['count'],'sourceWritten':False,'fullMotionExecuted':False,'fitCertified':False,'status':data['status']}
payloadRaw=json.dumps(compact,ensure_ascii=False,separators=(',',':')).encode();compressed=gzip.compress(payloadRaw,compresslevel=9,mtime=0);assert gzip.decompress(compressed)==payloadRaw
payload={'bytes':len(payloadRaw),'sha256':sha(payloadRaw),'gzip':base64.b64encode(compressed).decode()}
verifier=(R/'certificate.mjs').read_text().replace('export function ','function ')
js='const BUILD='+json.dumps(m,ensure_ascii=False)+';const PAYLOAD='+json.dumps(payload)+';\n'+verifier+'\n'+(R/'app.js').read_text();assert '</script' not in js.lower();(R/'qa/bundle.js').write_text(js);subprocess.run(['node','--check',str(R/'qa/bundle.js')],check=True)
html=(R/'index.html').read_text();assert html.count('<!-- RF314_SCRIPTS -->')==1;html=html.replace('<!-- RF314_SCRIPTS -->','<script>'+js+'</script>');(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};m['payloadSHA256']=sha(payloadRaw);(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
summary=[{'fixture':c['fixture'],'step':c['step'],'variants':{name:{'accepted':v['accepted'],'nodeCounts':[len(s['nodes']) for s in v['scopes']],'terminalCrossings':[s['after']['strictCrossingPairs'] for s in v['scopes']],'terminalEdgeBounds':[[s['shape']['minimumRatio'],s['shape']['maximumRatio']] for s in v['scopes']],'wallMS':[r['wallMS'] for r in c['runs'] if r['variant']==name]} for name,v in c['variants'].items()}} for c in data['cases']]
(R/'SUMMARY.json').write_text(json.dumps({'version':m['version'],'sourceCommit':source,'status':data['status'],'summary':summary,'certificateLowerBounds':[{'fixture':c['fixture'],'shapeIncluded':c['includesLinearizedShape'],'rows':len(c['rows']),'lowerBoundM':c['verified']['lowerBoundM']} for c in certs['certificates']],'sourceWritten':False,'fullMotionExecuted':False,'fitCertified':False},ensure_ascii=False,indent=2))
print(json.dumps({'html':m['html'],'sourceCommit':source,'status':data['status']},indent=2))
