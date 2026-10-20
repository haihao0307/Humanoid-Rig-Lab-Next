from pathlib import Path
import hashlib,importlib.util,json,subprocess
SHA=lambda b:hashlib.sha256(b).hexdigest()
CASES={'baseline':(False,False),'previous-only':(False,True),'metric-only':(True,False),'combined':(True,True)}
def make_responses(host,root,case):
    assert case in CASES
    graded,previous=CASES[case]
    prior=root.parent/'hc-s3-4'
    spec=importlib.util.spec_from_file_location('rf34_instrument',prior/'instrument.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    outputs,old_proof=mod.make_responses(host,prior,False)
    # Read the unmodified original metric constructor; candidate changes only the chosen assignment.
    raw=(host/'coupled-cloth.mjs').read_bytes()
    assert SHA(raw)=='1f0e93ba23658fd0b3d16abd27325b4c3d29cba267b94078f05fafc7105cdd68'
    outputs['coupled-cloth.mjs']=raw
    proof=[]
    for name in ['live-cloth-worker.mjs','live-cloth-controller.mjs','wasm-cloth.mjs','coupled-cloth.mjs']:
        original=outputs[name];text=original.decode('utf-8');patches=[]
        def add(needle,code,after=False,count=1):
            nonlocal text
            assert text.count(needle)==count,(case,name,needle,text.count(needle))
            tag='/*RF35_'+str(len(patches))+'_BEGIN*/'+code+'/*RF35_'+str(len(patches))+'_END*/'
            text=text.replace(needle,needle+tag if after else tag+needle);patches.append((tag,count))
        if name=='live-cloth-worker.mjs':
            add("import {createObserver} from './rf34-observer.mjs';","\nimport {createMetricProbe} from './rf35-probe.mjs';\n",True)
            add('world.actor.evaluate({});',"globalThis.__RF35=createMetricProbe(world,"+json.dumps(case)+");")
            add('globalThis.__RF34?.attach(world.acceleration);','globalThis.__RF35.attach(world.acceleration);',True)
            add('globalThis.__RF34?.fit(i,fittingSteps,!!origin);','globalThis.__RF35.fit(i);',True)
            add('globalThis.__RF34?.finish();','globalThis.__RF35.finish();',True)
            if previous:
                add('world.actor.positions.set(target);','world.acceleration.actorPrevious.set(world.acceleration.actorTarget);')
        elif name=='live-cloth-controller.mjs':
            add('  this.worker.onmessage=',"this.worker.addEventListener('message',({data})=>{if(data.__RF35_DIAG__)window.__RF35_CAPTURE__=data.__RF35_DIAG__;});\n")
        elif name=='coupled-cloth.mjs':
            if graded:add('e.rest=e.sourceRest;','e.rest=e.targetRest;',True)
        else:
            add('globalThis.__RF34?.stepStart(this);','globalThis.__RF35?.stepStart();',True)
            add('globalThis.__RF34?.gate(this);','globalThis.__RF35?.gate();',True)
            add('globalThis.__RF34?.failure(this,error.message);','globalThis.__RF35?.failure(error.message);',True)
            add('for(let ss=0;ss<sub;ss++){',"globalThis.__RF35.stage('substep-entry',{substep:ss,iteration:null,phase:'prediction'});",True)
            add('this.waist?.apply(f);',"globalThis.__RF35.stage('after-body-interpolation');",True)
            needle='e.predict(a.p.ptr,a.v.ptr,a.old.ptr,a.w.ptr,s.count,h,Math.exp(-s.settings.damping*h),9.81*s.settings.gravity);'
            add(needle,'globalThis.__RF35.predictBefore(a,h,Math.exp(-s.settings.damping*h),9.81*s.settings.gravity);')
            add(needle,'globalThis.__RF35.predictAfter(a);',True)
            add('for(let it=0;it<16;it++){',"globalThis.__RF35.stage('iteration-entry',{iteration:it,phase:'elastic'});",True)
            add('for(let it=0;it<12;it++){',"globalThis.__RF35.stage('iteration-entry',{iteration:it,phase:'polish'});",True)
            add('e.distance_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,alpha);',"if(a===this.solvers[0])globalThis.__RF35.stage('after-distance');",True)
            add("e.strain_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12);","if(a===this.solvers[0])globalThis.__RF35.stage('after-strain');",True,2)
            assert text.count('r.maxEdgeStretch>1.45')==1
        restored=text
        for tag,count in reversed(patches):
            assert restored.count(tag)==count;restored=restored.replace(tag,'')
        assert restored.encode()==original,('NON_REVERSIBLE',name)
        outputs[name]=text.encode()
        proof.append({'path':name,'baseObservedSHA256':SHA(original),'experimentSHA256':SHA(outputs[name]),'removalRestoresPreviousObservation':True,'candidateChange':(previous and name=='live-cloth-worker.mjs')or(graded and name=='coupled-cloth.mjs'),'observerInsertions':len(patches)})
    outputs['rf35-probe.mjs']=(root/'probe.mjs').read_bytes()
    return outputs,{'case':case,'gradedRest':graded,'advancePrevious':previous,'priorObserver':old_proof,'changes':proof,'guard':'>1.45','wasmChanged':False,'originalFilesWritten':False}
if __name__=='__main__':
    import sys
    host,root=map(Path,sys.argv[1:3]);out=root/'_generated';out.mkdir(exist_ok=True)
    for case in CASES:
        data,proof=make_responses(host,root,case)
        for n,b in data.items():
            p=out/(case+'-'+n);p.write_bytes(b);subprocess.run(['node','--check',str(p)],check=True)
        (out/(case+'-patches.json')).write_text(json.dumps(proof,indent=2))
    print('FOUR_CASE_SYNTAX_AND_REVERSIBILITY_PASS')
