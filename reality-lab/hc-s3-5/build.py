from pathlib import Path
import os,json,gzip,hashlib,base64,subprocess
R=Path(__file__).resolve().parent;P=R.parent/'hc-s2-1';Q=R/'qa';sha=lambda b:hashlib.sha256(b).hexdigest()
NAMES=['baseline','previous-only','metric-only','combined'];anchor=json.loads((R/'TASK_ANCHOR.json').read_text());cases=[];hashes={}
for name in NAMES:
 p=Q/name/'REPORT.json';c=json.loads(p.read_text());assert c['passed'] and c['case']==name and not c['productionChanged'] and not c['dynamicFitCertified']
 assert c['code']['commit']=='73efbef084308783fec6e5342bf59998f1bf1371'
 for n,h in c['code']['sha256'].items():assert sha((R/n).read_bytes())==h,('EXPERIMENT_CODE_CHANGED',n)
 assert c['source']==anchor['source'] and sha((Q/name/'raw.json.gz').read_bytes())==c['rawSHA256']
 cases.append(c);hashes[name]={'reportSHA256':sha(p.read_bytes()),'rawSHA256':c['rawSHA256'],'checks':len(c['checks'])}
old=json.loads(gzip.decompress((R.parent/'hc-s3-4/qa/diagnostic/baseline-raw.json.gz').read_bytes()))
new=json.loads(gzip.decompress((Q/'baseline/raw.json.gz').read_bytes()))
for k in ['initialState','entryState','gateState','rollbackState']:assert new['base'][k]==old['capture'][k],('BASELINE_NOT_IDENTICAL',k)
protocol=(P/'protocol.js').read_bytes();assert hashlib.sha1(b'blob '+str(len(protocol)).encode()+b'\0'+protocol).hexdigest()=='74e1f859fa2001456286e6a4081ef639124699d2'
data={'schema':'kaopu/metric-contact-review@1','experimentRun':os.environ['EXPERIMENT_RUN'],'cases':cases,'source':anchor['source'],'dictionary':json.loads((P/'measurement-dictionary.json').read_text()),'productionChanged':False,'fitCertified':False,'experimentScope':'four controlled source variants on the same WASM fallback; not a GPU reproduction','walkSamplingNote':'Original R10 starts walking automatically after initialization. The extra four requested steps are after that automatic playback; the final signed contact samples are not a clean four-step-from-rest benchmark.'}
(R/'review-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
node="const fs=require('node:fs'),E=require(process.argv[1]),d=JSON.parse(fs.readFileSync(process.argv[2]));E.validate(d,d.source);console.log(JSON.stringify({rows:d.cases.map(E.row),common:E.bundle(d,d.source)}));"
result=json.loads(subprocess.check_output(['node','-e',node,str((R/'review.js').resolve()),str((R/'review-data.json').resolve())],text=True));(R/'ANALYSIS_SUMMARY.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
sourceCommit=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip();nativeNames=['TASK_ANCHOR.json','probe.mjs','instrument.py','run_case.py','review.js','app.js','index.template.html','build.py','tests/protocol.cjs','tests/browser.py','README.md']
raw=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode();compressed=gzip.compress(raw,compresslevel=9,mtime=0);assert gzip.decompress(compressed)==raw
packed={'bytes':len(raw),'sha256':sha(raw),'encoding':'gzip-base64','data':base64.b64encode(compressed).decode()}
m={'version':'REALITY-HC-S3.5','sourceCommit':sourceCommit,'experimentRun':os.environ['EXPERIMENT_RUN'],'experimentCode':'73efbef084308783fec6e5342bf59998f1bf1371','source':anchor['source'],'sourceFiles':{n:sha((R/n).read_bytes()) for n in nativeNames},'caseEvidence':hashes,'baselineMatchesS34':True,'protocolSHA256':sha(protocol),'embeddedEvidence':{k:v for k,v in packed.items() if k!='data'},'initializationAcceptedCases':[r['id'] for r in result['rows'] if r['initializationAccepted']],'productionChanged':False,'fitCertified':False,'physicalDeviceTested':False,'userVisualAcceptance':False}
js='const RF35_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF35_PACKED='+json.dumps(packed)+';\n'+protocol.decode()+'\n'+(R/'review.js').read_text()+'\n'+(R/'app.js').read_text()
assert '</script' not in js.lower();g=R/'_generated';g.mkdir(exist_ok=True);(g/'bundle.js').write_text(js);subprocess.run(['node','--check',str(g/'bundle.js')],check=True)
html=(R/'index.template.html').read_text();assert html.count('<!-- RF35_SCRIPTS -->')==1;html=html.replace('<!-- RF35_SCRIPTS -->','<script>\n'+js+'\n</script>');(R/'preview.html').write_text(html)
m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
(Q/'source').mkdir(exist_ok=True);(Q/'source/ASSEMBLY.json').write_text(json.dumps({'passed':True,'baselineMatchesPriorFourBoundaries':True,'frozenCasesVerified':NAMES,'readerCodeIdentical':True,'commonProtocolUnchanged':True,'html':m['html'],'productionChanged':False,'fitCertified':False},indent=2));print(json.dumps({'sourceCommit':sourceCommit,'rows':result['rows'],'html':m['html']},ensure_ascii=False,indent=2))
