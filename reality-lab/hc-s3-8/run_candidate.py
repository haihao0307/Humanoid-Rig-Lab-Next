from pathlib import Path
import importlib.util,sys,types,os,json,hashlib
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rf37candidate',ROOT.parent/'hc-s3-7/instrument.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
sha=lambda b:hashlib.sha256(b).hexdigest()
def assemble(host,case):
 assert case in ['static','walk']
 response,meta=base.assemble(host,case)
 original=(host/'lower-body-contact.mjs').read_bytes();assert sha(original)=='f60b9420e22a102a510db3b9634c6e29cebe5f1887bb3b9276b18ac8c12c6df6'
 needle='  this.vertices=Int32Array.from(vertices);'
 addition='  /*RF38 coverage candidate: retain original order, then include omitted physical nodes/faces.*/\n  const __rf38faces=new Set(triangles);for(let i=0;i<solver.count;i++)vertices.add(i);for(let f=0;f<F.length;f+=3)if(!__rf38faces.has(f))triangles.push(f);\n'
 text=original.decode();assert text.count(needle)==1;changed=text.replace(needle,addition+needle);assert changed.replace(addition,'').encode()==original
 response['lower-body-contact.mjs']=changed.encode()
 meta={**meta,'candidate':'complete-fine-contact-coverage','changedAlgorithmScope':'physical fine-node and triangle-centroid query coverage only','originalProjectionEquationsRetained':True,'originalMarginsRetained':True,'originalIterationCapsRetained':True,'originalOrderRetainedThenExtended':True,'originalSourceSHA256':sha(original),'candidateSHA256':sha(changed.encode()),'productionChanged':False}
 return response,meta
replacement=types.ModuleType('instrument');replacement.assemble=assemble;sys.modules['instrument']=replacement
harness=(ROOT.parent/'hc-s3-7/run_native.py').read_text();assert harness.count("Q=R/'qa'/CASE;")==1
harness=harness.replace("Q=R/'qa'/CASE;","Q=R/'qa'/('coverage-'+CASE);")
exec(compile(harness,str(ROOT.parent/'hc-s3-7/run_native.py'),'exec'),globals())
current=json.loads((Q/'CONTACT.json').read_text());old=json.loads((ROOT.parent/'hc-s3-7/qa'/CASE/'CONTACT.json').read_text())
by={(x['stage'],x['step']):x for x in old['records']}
comp=[]
for x in current['records']:
 a=by[(x['stage'],x['step'])]
 comp.append({'stage':x['stage'],'step':x['step'],'sameState':x['stateSHA256']==a['stateSHA256'],'bodyMinimumBeforeM':[b['minimumM'] for b in a['body']],'bodyMinimumAfterM':[b['minimumM'] for b in x['body']],'bodyViolationBefore':[b['beyondMargin'] for b in a['body']],'bodyViolationAfter':[b['beyondMargin'] for b in x['body']],'pairBeforeM':a['pair']['minimumM'],'pairAfterM':x['pair']['minimumM'],'pairViolationBefore':a['pair']['beyondMargin'],'pairViolationAfter':x['pair']['beyondMargin']})
assert comp[0]['sameState'],'INITIAL_FIT_CHANGED'
checks={'passed':True,'case':CASE,'codeCommit':report['codeCommit'],'candidate':'complete-fine-contact-coverage','completedSteps':current['completedSteps'],'motionFailure':current['motionFailure'],'samePostFitState':comp[0]['sameState'],'samePostRegionalState':comp[1]['sameState'],'comparison':comp,'fitCertified':False,'productionChanged':False,'scope':'all original physics fine nodes and triangle centroids, not continuous or rendered-yarn collision; other contacts still independently evaluated'}
(Q/'CANDIDATE_COMPARISON.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
print('CANDIDATE_RECORDED',json.dumps(checks,ensure_ascii=False),flush=True)
