from pathlib import Path
import importlib.util,hashlib,json
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rf312_parent',R.parent/'hc-s3-11/instrument.py');parent=importlib.util.module_from_spec(spec);spec.loader.exec_module(parent)
sha=lambda b:hashlib.sha256(b).hexdigest()
def assemble(host,mode,motion):
 assert mode in ['reference','local'] and motion in ['static','walk']
 responses,prior=parent.assemble(host,'guarded',motion)
 original=responses['lower-body-contact.mjs'].decode()
 needle='    if(__rf311move===null)continue;'
 addition='''    if(__rf311move?.nodeMoves){
     const __moves=__rf311move.nodeMoves;
     if(__moves.some(m=>!Number.isInteger(m.id)||m.id<0||m.id>=s.count||w[m.id]<=0||m.delta.length!==3||!m.delta.every(Number.isFinite)))throw Error('INVALID_LOCAL_COMMIT');
     for(const m of __moves)for(let j=0;j<3;j++)p[m.id*3+j]+=m.delta[j];
     this.metrics.contacts++;this.metrics.maxCorrectionMM=Math.max(this.metrics.maxCorrectionMM,__rf311move.maximumMoveM*1000);continue;
    }
'''
 assert original.count(needle)==1
 changed=original.replace(needle,needle+'\n'+addition)
 assert changed.replace(needle+'\n'+addition,needle)==original
 responses['lower-body-contact.mjs']=changed.encode()
 old=responses['rf39-endurance.mjs'].decode();needle2='new JointMoveGuard(w.acceleration.lowerBodyContact,"guarded")'
 assert old.count(needle2)==1
 text=old.replace(needle2,'new LocalContactSolver(w.acceleration.lowerBodyContact,'+json.dumps(mode)+')')
 responses['rf39-endurance.mjs']=("import {LocalContactSolver} from './rf312-local-solve.mjs';\n"+text).encode()
 responses['rf312-local-solve.mjs']=(R/'local-solve.mjs').read_bytes()
 return responses,{'mode':mode,'motion':motion,'prior':prior,'localModuleSHA256':sha(responses['rf312-local-solve.mjs']),'sourceSHA256':sha(responses['lower-body-contact.mjs']),'reversible':True,'limitsChanged':False,'marginScheduleChanged':False,'sourceProductionChanged':False,'scope':'only blocked terminal centroid guide calls, discrete joint local scratch solve; no coarse feedback or global contact claim'}
