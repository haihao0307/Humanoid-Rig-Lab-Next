"""Publish only the exact independently verified B1 build. No fallback release."""
from pathlib import Path
import json,hashlib,shutil,subprocess,os,sys,urllib.request,time
R=Path('leather-workshop/r17');run=os.environ['GITHUB_RUN_ID'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
required={'cpu':'qa/b1/SUMMARY.json','browser':'qa/render-batch/browser/report.json','extended':'qa/b1/extended/report.json','performance':'qa/b1/performance/report.json','soak':'qa/b1/soak/report.json'}
if sys.argv[1]=='stage':
 root=Path('/tmp/b1-artifacts');data=None
 for lane,report in required.items():
  a=root/('leather-r17-'+lane+'-'+run);b=(a/'out/candidate-r17.html').read_bytes()
  if data is None:data=b
  assert b==data,lane+' independently compiled HTML differs'
  assert json.loads((a/report).read_text())['pass'],lane
  shutil.copytree(a/'qa',R/'qa',dirs_exist_ok=True)
 assert os.environ['LEATHER_SOURCE_COMMIT'].encode() in data
 paths=subprocess.check_output(['git','diff','--name-only','7c15a2d58587da27b4d1ba7d6b4233a28d001aed','HEAD'],text=True).splitlines()
 workflows={'.github/workflows/'+n for n in ['leather-r17-b1.yml','leather-b1-refinement.yml','leather-b1-recovery-input.yml','leather-b1-exact-shading-probe.yml','leather-b1-level0-probe.yml']}
 assert all(p.startswith(('leather-workshop/r17/','leather-workshop/b1/','leather-workshop/b1-refinement/')) or p in workflows for p in paths),paths
 assert sha(R/'qa-b1-performance.py')=='74bd5d98627883f3fad38852d086e67c79f6ae39901e6ad8579ae94019725fcd','Original performance gate changed'
 (R/'public-lite.html').write_bytes(data);shutil.copy2(root/('leather-r17-cpu-'+run)/'BUILD_RESULT.json',R/'BUILD_RESULT.json')
 assert sha(R/'public-lite.html')==json.loads((R/'BUILD_RESULT.json').read_text())['htmlSHA256']
elif sys.argv[1]=='public-bytes':
 expected=(R/'public-lite.html').read_bytes();url='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+os.environ['BUILD_SHA']+'/leather-workshop/r17/public-lite.html'
 for attempt in range(8):
  try:
   with urllib.request.urlopen(url,timeout=30) as f:data=f.read()
   assert data==expected;break
  except Exception:
   if attempt==7:raise
   time.sleep(6)
elif sys.argv[1]=='receipt':
 paths=list(required.values())+['qa/b1/unit.json','qa/b1/shading-unit.json','qa/render-batch/public/report.json','qa/s1b/equivalence.json','qa/s2b/pose-stream.json','qa/numeric.json'];reports={}
 for name in paths:
  p=R/name;assert json.loads(p.read_text())['pass'],name;reports[name]=sha(p)
 summary=json.loads((R/required['cpu']).read_text());perf=json.loads((R/required['performance']).read_text());soak=json.loads((R/required['soak']).read_text());build=json.loads((R/'BUILD_RESULT.json').read_text())
 receipt={'version':'R17.0-B1','batch':'B1','sourceCommit':os.environ['LEATHER_SOURCE_COMMIT'],'buildCommit':os.environ['BUILD_SHA'],'workflowRun':run,'previewURL':os.environ['PREVIEW'],'htmlSHA256':build['htmlSHA256'],'htmlBytes':build['htmlBytes'],'nativeIdenticalToR16':True,'sourceChecks':summary['sourceChecks'],'b1UnitChecks':summary['b1UnitChecks'],'shadingChecks':summary['shadingChecks'],'numericCases':18,'geometryCases':25,'full52StepTrajectories':6,'poseProtocolChecks':45,'performance':perf['comparisons'],'performanceGateScriptSHA256':sha(R/'qa-b1-performance.py'),'continuousHeldSeconds':soak['continuousHeldSeconds'],'productSelectionCommands':soak['productSelectionCommands'],'configureRebuildCommands':soak['configureRebuildCommands'],'offlineBrowserChecks':len(json.loads((R/required['browser']).read_text())['checks']),'extendedBrowserChecks':len(json.loads((R/required['extended']).read_text())['checks']),'publicBrowserChecks':len(json.loads((R/'qa/render-batch/public/report.json').read_text())['checks']),'reports':reports,'offlineBrowserVerified':True,'publicBrowserVerified':True,'readyForUserReview':True,'engineeringBatchImplemented':True,'fullS2Certified':False,'allDevicePerformanceCertified':False,'userVisualAcceptance':'PENDING','productionReady':False,'commercialLegalClearance':False,'priorFailuresRetained':['38372084727 performance gate failed; candidate not published','Initial timing and recovery diagnostic failures retain their actual logs and scope'],'limits':['Software Chrome GPU queries are not hardware GPU or monitor latency','Same PMREM atlas, samples and BRDF; unknown samplers use the original gradient path','Cache adds24 bytes per render vertex plus node texture; input VBOs reused','Only first submission per distinct observed input generates a timing sample','Convergence labels describe existing residual; not a new static equilibrium solver or material calibration','Timed ten-minute single-browser session does not certify all devices','Graphics context loss offers explicit page reload and clears current test state; no lossless checkpoint','Original source/texture/attribution and R01-R16 remain unchanged']}
 (R/'DELIVERY.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
else:raise SystemExit('Unknown publication stage')
