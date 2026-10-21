from pathlib import Path
import importlib.util,hashlib,json
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rf39_joint_base',R.parent/'hc-s3-9/instrument.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
sha=lambda b:hashlib.sha256(b).hexdigest()
def assemble(host,mode,motion):
 assert mode in ['baseline','guarded'] and motion in ['static','walk']
 responses,prior=base.assemble(host,'coverage',motion)
 native=responses['lower-body-contact.mjs'];assert sha(native)=='b0ac0923ff63895d14ae1f5c60f0354c521e598f8e146416a69f95f9ccd5675a'
 original=native.decode('utf-8')
 needle='    for(const i of movable)for(let j=0;j<3;j++)p[i*3+j]+=scale*correction[j];this.metrics.contacts++;this.metrics.maxCorrectionMM=Math.max(this.metrics.maxCorrectionMM,Math.hypot(...correction)*1000);'
 assert original.count(needle)==1
 replacement='''    const __rf311move=escape&&this.__rf311Gate?this.__rf311Gate.choose({faceOffset:f,ids:[a,b,c],movable,scale,guide:escape,normal,margin,pass}):correction;
    if(__rf311move===null)continue;
    for(const i of movable)for(let j=0;j<3;j++)p[i*3+j]+=scale*__rf311move[j];this.metrics.contacts++;this.metrics.maxCorrectionMM=Math.max(this.metrics.maxCorrectionMM,Math.hypot(...__rf311move)*1000);'''
 changed=original.replace(needle,replacement);assert changed.replace(replacement,needle).encode()==native
 responses['lower-body-contact.mjs']=changed.encode()
 old=responses['rf39-endurance.mjs'].decode();text=old
 edits=[('createRegional();result.checkpoints.push',"createRegional();const __rf311Gate=new JointMoveGuard(w.acceleration.lowerBodyContact,"+json.dumps(mode)+");w.acceleration.lowerBodyContact.__rf311Gate=__rf311Gate;result.checkpoints.push"),('observer.begin();const started','observer.begin();__rf311Gate.begin(i);const started'),('result.frames.push(row);','row.jointGuard=__rf311Gate.end();result.frames.push(row);'),('result.finalState=await stateDigest(w);return result;','result.jointGuard=__rf311Gate.report();result.finalState=await stateDigest(w);return result;')]
 for a,b in edits:assert text.count(a)==1,a;text=text.replace(a,b)
 restored=text
 for a,b in reversed(edits):restored=restored.replace(b,a)
 assert restored==old
 responses['rf39-endurance.mjs']=("import {JointMoveGuard} from './rf311-joint-guard.mjs';\n"+text).encode()
 responses['rf311-joint-guard.mjs']=(R/'joint-guard.mjs').read_bytes()
 return responses,{'mode':mode,'motion':motion,'prior':prior,'baseCandidateSHA256':sha(native),'guardedSourceSHA256':sha(responses['lower-body-contact.mjs']),'guardModuleSHA256':sha(responses['rf311-joint-guard.mjs']),'replacementCount':1,'reversible':True,'sourceProductionChanged':False,'limitsChanged':False,'marginScheduleChanged':False,'scope':'terminal centroid proposals using native crotch escape only; no coarse feedback; ordinary vertex and normal centroid operations remain unchanged'}
