"""R12.1 command-ordered sample transport. No solver/material changes."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys
P=Path(__file__).resolve().parent
PARENT=P.parent/'r12'
PARENT_SOURCE='87fc757853e4eed1652b02df079e8747a8944e94'
DYNAMICS_SHA='d6aa6e85b354e2cadc92915241bcd0dec7cc973302e8f4cf315b28c2cf36df70'
def replace(s,old,new):
    assert s.count(old)==1,('Unexpected source',old[:100],s.count(old))
    return s.replace(old,new,1)
def patch(s):
    assert hashlib.sha256(s.encode()).hexdigest()==DYNAMICS_SHA
    original=s
    s=replace(s,"postMessage({type:'sample',generation,...data,report:","postMessage({type:'sample',generation,requestId:m.requestId,commandEpoch:m.commandEpoch,...data,report:")
    s=replace(s,'revision:0,pending:false,dirty:true,generation:0,','revision:0,pending:false,resample:false,sampleSerial:0,sampleInFlight:0,commandEpoch:0,dirty:true,generation:0,')
    s=replace(s,"if(m.type!=='sample')return;out.pending=false;out.report=m.report;","if(m.type!=='sample'||m.requestId!==out.sampleInFlight)return;out.pending=false;out.sampleInFlight=0;const again=out.resample;out.resample=false;if(m.commandEpoch!==out.commandEpoch){out.sample();return;}out.report=m.report;")
    s=replace(s,'out.revision++;out.dirty=true;if(!out.playing)request();','out.revision++;out.dirty=true;if(again)out.sample();if(!out.playing)request();')
    s=replace(s,"out.send=(type,extra={})=>worker.postMessage({type,...extra});out.sample=()=>{if(!out.pending){out.pending=true;out.send('sample');}};","out.send=(type,extra={})=>{if(type!=='sample')out.commandEpoch++;worker.postMessage({type,...extra});};out.sample=()=>{if(out.pending){out.resample=true;return;}out.pending=true;out.sampleInFlight=++out.sampleSerial;out.send('sample',{requestId:out.sampleInFlight,commandEpoch:out.commandEpoch});};")
    s=replace(s,'out.ready=false;out.pending=false;out.report=null;','out.ready=false;out.pending=false;out.resample=false;out.sampleInFlight=0;out.report=null;')
    assert s[s.index('class Cloth{'):s.index('function workerMain()')]==original[original.index('class Cloth{'):original.index('function workerMain()')]
    return s

def main():
    if not (PARENT/'app.js').exists():subprocess.run([sys.executable,str(PARENT/'derive.py')],check=True)
    for script in ['finalize-physics.py','finalize-render.py','finalize-render-qa.py']:subprocess.run([sys.executable,str(PARENT/script)],check=True)
    lock=json.loads((PARENT/'SOURCE_LOCK.json').read_text())
    for f,h in lock['expectedCanonicalSha256'].items():assert hashlib.sha256((PARENT/f).read_bytes()).hexdigest()==h,(f,'parent mismatch')
    subprocess.run([sys.executable,str(PARENT/'build.py')],check=True)
    if (P/'app.js').exists():raise SystemExit('Already generated; use build.py, do not overwrite canonical source.')
    files=[f for f in PARENT.iterdir() if f.suffix=='.js']+[PARENT/f for f in ['template.html','build.py','LICENSE','THIRD_PARTY_NOTICES.md']]
    for f in files:shutil.copy2(f,P/f.name)
    (P/'dynamics.js').write_text(patch((PARENT/'dynamics.js').read_text()))
    for name in ['app.js','template.html','build.py']:
        s=(P/name).read_text().replace('R12.0','R12.1')
        if name=='app.js':s=replace(s,"!['R12.1'].includes(r.generator)","!['R12.0','R12.1'].includes(r.generator)")
        if name=='template.html':
            s=s.replace('破口散丝尚未独立物理解算；无布料自碰撞。','保留纱桥/尾丝使用独立代理链；无布料自碰撞。').replace('结构物理 / R12','结构物理 / R12.1')
        if name=='build.py':
            s=s.replace("'entry':'denim-workshop/r12/index.html'","'entry':'denim-workshop/r12-1/index.html'")
            s=s.replace("'baseCommit':'086414b317f313bf9465ea957753ae7e84453f6f'",f"'baseCommit':'{PARENT_SOURCE}'")
        (P/name).write_text(s)
    subprocess.run([sys.executable,str(P/'build.py')],check=True)
    provenance={'parentSource':PARENT_SOURCE,'parentBuildManifest':json.loads((PARENT/'BUILD_MANIFEST.json').read_text()),'scope':'Sample transport ordering only; Cloth class and GLSL unchanged','oldRaceReproduction':'configure -> pending sample -> reset -> old reply: original sends no post-reset sample and accepts old steps=24','sourceHashes':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in P.iterdir() if f.suffix in ['.js','.html','.py']},'userVisualApproved':False}
    (P/'RECOVERY_SOURCE.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
