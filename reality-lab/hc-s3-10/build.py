from pathlib import Path
import json,hashlib,gzip,base64,subprocess,os,math
R=Path(__file__).resolve().parent;Q=R/'qa/native';sha=lambda b:hashlib.sha256(b).hexdigest()
r=json.loads((Q/'REPORT.json').read_text());t=json.loads((Q/'TRACE.json').read_text());e=json.loads((Q/'ENDURANCE.json').read_text())
assert r['passed'] and r['traceSHA256']==sha((Q/'TRACE.json').read_bytes()) and r['enduranceSHA256']==sha((Q/'ENDURANCE.json').read_bytes())
assert r['assembly']['traceSHA256']==sha((R/'trace.mjs').read_bytes())
assert r['assembly']['originalCandidateSHA256']=='b0ac0923ff63895d14ae1f5c60f0354c521e598f8e146416a69f95f9ccd5675a'
assert e['completedSteps']==180 and e['failure'] is None and e['originalFitGate']==1.45
assert [s['step'] for s in t['steps']]==list(range(25,31)) and t['steps'][-1]['passes']==32
source={'nativeCommit':'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49','candidateSHA256':r['assembly']['originalCandidateSHA256'],'traceCodeCommit':r['codeCommit']}
packet={'schema':'kaopu/walk-contact-review@1','version':'RF01-S3.10','source':source,'trace':t,'verification':{'workflowRun':r['workflowRun'],'checks':r['checks'],'traceSHA256':r['traceSHA256'],'enduranceSHA256':r['enduranceSHA256'],'sourceArithmeticChanged':False,'performanceComparable':False},'live':False,'fitCertified':False,'productionChanged':False}
(R/'review-data.json').write_text(json.dumps(packet,ensure_ascii=False,separators=(',',':')))
# Summarize actual paired operations; this is evidence organization, not a new solver.
operations=[]
for i,row in enumerate(t['rows']):
 if row.get('beforeRow') is None:continue
 before=t['rows'][row['beforeRow']];a=before['snapshot'];b=row['snapshot'];d=[b['point'][j]-a['point'][j] for j in range(3)];op=row['operation'];requested=op.get('targetCorrection',op.get('correction'))
 assert requested is not None and max(abs(d[j]-requested[j]) for j in range(3))<1e-10
 operations.append({'row':i,'beforeRow':row['beforeRow'],'step':row['step'],'pass':row['pass'],'kind':op['kind'],'faceOffset':op.get('faceOffset'),'usedEscape':op['usedEscape'],'beforeMM':a['full']['distanceM']*1000,'afterMM':b['full']['distanceM']*1000,'distanceChangeMM':(b['full']['distanceM']-a['full']['distanceM'])*1000,'moveMM':math.sqrt(sum(v*v for v in d))*1000,'bodyFaceBefore':a['full']['vertexIds'],'bodyFaceAfter':b['full']['vertexIds']})
summary=[]
for s in t['steps']:
 rows=t['rows'][s['firstRow']:s['lastRow']+1];vf=[x for x in rows if x['stage']=='vertices-done'][-1];cf=[x for x in rows if x['stage']=='centroids-done'][-1];ops=[o for o in operations if o['step']==s['step']]
 summary.append({'step':s['step'],'passes':s['passes'],'entryMM':s['entry']['full']['distanceM']*1000,'lastVerticesMM':vf['snapshot']['full']['distanceM']*1000,'lastCentroidsMM':cf['snapshot']['full']['distanceM']*1000,'exitMM':s['exit']['full']['distanceM']*1000,'exitLocalCrossings':s['exit']['strictLocalCrossings'],'worstAdverseOperation':min(ops,key=lambda x:x['distanceChangeMM']) if ops else None,'faceOperationsMovingFromNonnegativeToNegative':[o for o in ops if o['kind']=='centroid' and o['beforeMM']>=0 and o['afterMM']<0]})
analysis={'source':source,'steps':summary,'operationCount':len(operations),'largestAdverseOperations':sorted(operations,key=lambda x:x['distanceChangeMM'])[:20],'noPerformanceClaim':True,'fitCertified':False}
(R/'ANALYSIS.json').write_text(json.dumps(analysis,ensure_ascii=False,indent=2))
raw=(R/'review-data.json').read_bytes();packed={'bytes':len(raw),'sha256':sha(raw),'data':base64.b64encode(gzip.compress(raw,compresslevel=9,mtime=0)).decode()};code=subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()
files=['TASK_ANCHOR.json','trace.mjs','instrument.py','run_native.py','review.js','app.js','index.template.html','build.py','tests/protocol.cjs','tests/browser.py','README.md']
m={'version':'REALITY-HC-S3.10','sourceCommit':code,'source':source,'nativeRun':r['workflowRun'],'nativeCodeCommit':r['codeCommit'],'nativeTraceSHA256':r['traceSHA256'],'sourceFiles':{f:sha((R/f).read_bytes()) for f in files},'rowCount':len(t['rows']),'queryScope':t['queryScope'],'fitCertified':False,'productionChanged':False,'live':False,'fiveSecondABBAPatchExecuted':False}
js='const RF310_BUILD='+json.dumps(m,ensure_ascii=False)+';\nconst RF310_PACKED='+json.dumps(packed)+';\n'+(R/'review.js').read_text()+'\n'+(R/'app.js').read_text();assert '</script' not in js.lower();tmp=R/'_assembled.js';tmp.write_text(js);subprocess.run(['node','--check',str(tmp)],check=True)
html=(R/'index.template.html').read_text();assert html.count('<!-- RF310_SCRIPTS -->')==1;html=html.replace('<!-- RF310_SCRIPTS -->','<script>\n'+js+'\n</script>');(R/'preview.html').write_text(html);m['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())};(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2));print(json.dumps({'build':code,'html':m['html'],'steps':[{k:s[k] for k in ['step','passes','entryMM','lastVerticesMM','lastCentroidsMM','exitMM','exitLocalCrossings']} for s in summary]},ensure_ascii=False,indent=2))
