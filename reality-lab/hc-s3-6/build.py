from pathlib import Path
import os,json,hashlib,subprocess
R=Path(__file__).resolve().parent;P=R.parent/'hc-s2-1';sha=lambda b:hashlib.sha256(b).hexdigest()
run='39534171339';code='73adc31d6ad37be2cb588c52c76de05463273099'
for name in ['fitting-transaction.mjs','instrument.py','run_native.py','tests/transaction.mjs']:
 old=subprocess.check_output(['git','show',code+':reality-lab/hc-s3-6/'+name]);assert old==(R/name).read_bytes(),('NATIVE_CODE_CHANGED_REQUIRES_NEW_RUN',name)
moduleHash=sha((R/'fitting-transaction.mjs').read_bytes());anchor=json.loads((R/'TASK_ANCHOR.json').read_text());s=anchor['source'];records=[]
for mode in ['baseline','progressive','cancel','fault']:
 p=R/'qa'/mode/'REPORT.json';raw=p.read_bytes();r=json.loads(raw);assert r['passed'] and r['case']==mode and r['codeCommit']==code
 assert r['assembly']['moduleSHA256']==moduleHash and r['assembly']['sourcePin']==s['commit'] and r['assembly']['reverseExact']
 source={'repository':s['repository'],'commit':s['commit'],'path':s['directory']+'/live-cloth-worker.mjs','sha256':r['assembly']['sourceFiles']['live-cloth-worker.mjs']}
 result=json.loads(json.dumps(r['result']))
 if result.get('independentRollback'):
  q=result['independentRollback'];assert q['equal'] and q['before']==q['after'];result['independentRollback']={'equal':True,'beforeSHA256':sha(json.dumps(q['before'],sort_keys=True,separators=(',',':')).encode()),'afterSHA256':sha(json.dumps(q['after'],sort_keys=True,separators=(',',':')).encode()),'scope':q['scope']}
 records.append({'schema':'kaopu/fitting-transaction-observation@1','case':mode,'source':source,'moduleSHA256':moduleHash,'nativeRun':run,'codeCommit':code,'rawReportSHA256':sha(raw),'elapsedSeconds':r['elapsedSeconds'],'sourceStatus':r.get('sourceStatus'),'nativeCheckCount':len(r['checks']),'result':result,'fitCertified':False,'productionInstalled':False})
prior=json.loads((R.parent/'hc-s3-5/DELIVERY.json').read_text());combined=next(x for x in prior['results'] if x['id']=='combined')
facts={'source':source,'moduleSHA256':moduleHash,'nativeRun':run,'previousURL':prior['fixedURL'],'previousContact':{'stage':'S3.5','sourceCommit':prior['sourceCommit'],'bodyMinimumSampleMM':combined['bodyMinimumSampleMM'],'pairMinimumSampleMM':combined['pairMinimumSampleMM'],'retestedInS36':False,'status':'retained failed historical sample, not full surface penetration proof'}}
data={'version':'REALITY-HC-S3.6','facts':facts,'records':records};(R/'EVIDENCE_SUMMARY.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
protocol=(P/'protocol.js').read_bytes();assert hashlib.sha1(b'blob '+str(len(protocol)).encode()+b'\0'+protocol).hexdigest()=='74e1f859fa2001456286e6a4081ef639124699d2'
current=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
files=['TASK_ANCHOR.json','fitting-transaction.mjs','instrument.py','run_native.py','review.js','app.js','index.template.html','build.py','tests/transaction.mjs','tests/review.cjs','tests/browser.py','README.md']
m={'version':'REALITY-HC-S3.6','sourceCommit':current,'nativeRun':run,'nativeCodeCommit':code,'moduleSHA256':moduleHash,'source':source,'files':{n:sha((R/n).read_bytes()) for n in files},'evidenceSHA256':sha((R/'EVIDENCE_SUMMARY.json').read_bytes()),'protocolSHA256':sha(protocol),'fitCertified':False,'productionInstalled':False}
js='const RF36_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF36_DATA='+json.dumps(data,ensure_ascii=False)+';\nconst RF36_DICTIONARY='+(P/'measurement-dictionary.json').read_text()+';\n'+protocol.decode()+'\n'+(R/'review.js').read_text()+'\n'+(R/'app.js').read_text()
assert '</script' not in js.lower();g=R/'_generated';g.mkdir(exist_ok=True);(g/'bundle.js').write_text(js);subprocess.run(['node','--check',str(g/'bundle.js')],check=True)
html=(R/'index.template.html').read_text();assert html.count('<!-- RF36_SCRIPTS -->')==1;html=html.replace('<!-- RF36_SCRIPTS -->','<script>\n'+js+'\n</script>');(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps(m,ensure_ascii=False,indent=2))
