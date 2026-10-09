"""Read-only checks. Never rebuild, rewrite or repair an accepted R04 file."""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
def verify():
    a=json.loads((ROOT/'anchors/LEATHER_R04_GRAM_ANCHOR.json').read_text())
    result={'anchor':a['id'],'status':'PASS','hashesChecked':0,'frozenFilesModified':False,'neuralTrainingPerformed':False}
    for name,expected in a['hashes'].items():
        actual=hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
        if actual!=expected: raise RuntimeError('FROZEN ANCHOR MISMATCH: '+name)
        result['hashesChecked']+=1
    q=json.loads((ROOT/a['gram']['source']).read_text())
    lookup={t['name']:t.get('report') for t in q['tests']}
    spec=a['gram'];X=[[(lookup[n][f]-o)/s for f,o,s in zip(spec['features'],spec['offset'],spec['scale'])] for n in spec['phaseLabels']]
    G=[[sum(x*y for x,y in zip(u,v)) for v in X] for u in X]
    error=max(abs(x-y) for u,v in zip(G,spec['G']) for x,y in zip(u,v))
    if error>1e-12: raise RuntimeError('GRAM RELATION MISMATCH')
    result['gramMaxDifference']=error
    result['matrixDefinition']=spec['kind']
    return result
if __name__=='__main__': print(json.dumps(verify(),ensure_ascii=False,indent=2))
