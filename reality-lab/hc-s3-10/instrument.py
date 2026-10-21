from pathlib import Path
import importlib.util,hashlib,json
R=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('rf39_base',R.parent/'hc-s3-9/instrument.py');base=importlib.util.module_from_spec(sp);sp.loader.exec_module(base)
sha=lambda b:hashlib.sha256(b).hexdigest()
def assemble(host):
 response,meta=base.assemble(host,'coverage','walk')
 original=response['lower-body-contact.mjs'];assert sha(original)=='b0ac0923ff63895d14ae1f5c60f0354c521e598f8e146416a69f95f9ccd5675a'
 text=original.decode('utf-8');changes=[]
 def change(old,new):
  nonlocal text
  assert text.count(old)==1,('TRACE_ANCHOR',old,text.count(old));text=text.replace(old,new);changes.append((old,new))
 change(' projectFine(){const start='," projectFine(){globalThis.__RF310?.begin(this);const start=")
 change('maximum=Math.max(maximum,depth);const normal=[q[1]*depth',"maximum=Math.max(maximum,depth);globalThis.__RF310?.beforeVertex(this,pass,i,margin,depth,q);const normal=[q[1]*depth")
 change('for(let j=0;j<3;j++)p[k+j]+=correction[j];this.metrics.contacts++;',"for(let j=0;j<3;j++)p[k+j]+=correction[j];globalThis.__RF310?.afterVertex(this,pass,i,margin,correction,normal,escape);this.metrics.contacts++;")
 change('   for(let n=0;n<this.triangles.length;n++){',"   globalThis.__RF310?.phase(this,pass,margin,'vertices-done',maximum);for(let n=0;n<this.triangles.length;n++){")
 change('    const normal=[q[1]*depth',"    globalThis.__RF310?.beforeFace(this,pass,f,[a,b,c],margin,depth,q,n);const normal=[q[1]*depth")
 change('for(const i of movable)for(let j=0;j<3;j++)p[i*3+j]+=scale*correction[j];this.metrics.contacts++;',"for(const i of movable)for(let j=0;j<3;j++)p[i*3+j]+=scale*correction[j];globalThis.__RF310?.afterFace(this,pass,f,[a,b,c],margin,correction,normal,escape,scale);this.metrics.contacts++;")
 change('   }if(maximum<.00005)break;',"   }globalThis.__RF310?.phase(this,pass,margin,'centroids-done',maximum);if(maximum<.00005)break;")
 change('this.metrics.fineMS=performance.now()-start;',"this.metrics.fineMS=performance.now()-start;globalThis.__RF310?.end(this);")
 restored=text
 for old,new in reversed(changes):restored=restored.replace(new,old)
 assert restored.encode()==original
 response['lower-body-contact.mjs']=text.encode()
 study=response['rf39-endurance.mjs'].decode();original_study=study;patches=[]
 def edit(old,new):
  nonlocal study
  assert study.count(old)==1,('STUDY_ANCHOR',old);study=study.replace(old,new);patches.append((old,new))
 edit(" createRegional();result.checkpoints.push", " createRegional();globalThis.__RF310=new WalkContactTrace(w);result.checkpoints.push")
 edit('   observer.begin();const started=', '   globalThis.__RF310.step=i;observer.begin();const started=')
 edit('result.finalState=await stateDigest(w);return result;', 'result.finalState=await stateDigest(w);result.contactTrace=globalThis.__RF310.export();return result;')
 back=study
 for old,new in reversed(patches):back=back.replace(new,old)
 assert back==original_study
 response['rf39-endurance.mjs']=("import {WalkContactTrace} from './rf310-trace.mjs';\n"+study).encode();response['rf310-trace.mjs']=(R/'trace.mjs').read_bytes()
 return response,{'prior':meta,'sourceFiles':meta['sourceFiles'],'originalCandidateSHA256':sha(original),'instrumentedCandidateSHA256':sha(response['lower-body-contact.mjs']),'traceSHA256':sha(response['rf310-trace.mjs']),'candidateRemovalExact':True,'enduranceRemovalExact':True,'sourceArithmeticChanged':False,'productionChanged':False,'timingComparable':False}
