"""Recheck original binary64 body-edge/triangle intersections with exact fractions.
The proof concerns endpoint frozen geometry, not tolerance/CCD or a repaired body.
"""
from pathlib import Path
from fractions import Fraction as F
import json,hashlib,sys

def vec(p):
    if len(p)!=3: raise ValueError('VEC3_REQUIRED')
    return [F(float(x)) for x in p]
def sub(a,b): return [x-y for x,y in zip(a,b)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def segment_triangle(p,q,t):
    p,q=vec(p),vec(q);a,b,c=map(vec,t)
    d,e1,e2=sub(q,p),sub(b,a),sub(c,a);h=cross(d,e2);det=dot(e1,h)
    if det==0:return None
    s=sub(p,a);u=dot(s,h)/det;k=cross(s,e1);v=dot(d,k)/det;alpha=dot(e2,k)/det
    if not (0<u and 0<v and u+v<1 and 0<alpha<1):return None
    return {'segmentFraction':str(alpha),'barycentric':[str(1-u-v),str(u),str(v)],'determinant':str(det),'point':[str(x+alpha*y) for x,y in zip(p,d)],'strict':True}
def verify_pair(pair):
    a,b=pair['aTriangle'],pair['bTriangle'];role=pair['hit']['role'];edge=pair['hit']['edge']
    if set(pair['aIds'])&set(pair['bIds']):raise ValueError('ADJACENT_PAIR_NOT_ACCEPTED')
    first,second=(a,b) if role=='source-edge' else (b,a)
    if role not in ['source-edge','target-edge'] or edge not in range(3):raise ValueError('INVALID_WITNESS')
    result=segment_triangle(first[edge],first[(edge+1)%3],second)
    if not result:raise ValueError('EXACT_INTERSECTION_FAILED')
    return result

def run(source,destination):
    raw=Path(source).read_bytes();data=json.loads(raw);checks=[]
    def check(name,condition):
        if not condition:raise AssertionError(name)
        checks.append({'name':name,'passed':True})
    t=[[0,0,0],[1,0,0],[0,1,0]]
    check('strict synthetic crossing',segment_triangle([.2,.2,-1],[.2,.2,1],t) is not None)
    check('coplanar not certified',segment_triangle([.2,.2,0],[.3,.3,0],t) is None)
    check('endpoint not strict crossing',segment_triangle([.2,.2,0],[.2,.2,1],t) is None)
    check('edge touch not strict crossing',segment_triangle([0,.2,-1],[0,.2,1],t) is None)
    check('outside triangle rejected',segment_triangle([.8,.8,-1],[.8,.8,1],t) is None)
    check('reversed face still crosses',segment_triangle([.2,.2,-1],[.2,.2,1],list(reversed(t))) is not None)
    total=0
    for case in data['cases']:
        for pair in case['selfIntersections']:
            pair['exactProof']=verify_pair(pair);pair['exactVerified']=True;total+=1
            check(case['fixture']+':'+pair['key']+' exact strict intersection',True)
        nearest=all(r['nativeMatchesStoredRow'] and r['independent']['distanceErrorM']<1e-10 and r['originErrorM']<1e-10 for r in case['rows'])
        check(case['fixture']+' source row and nearest replay',nearest)
        case['modelGate']={'status':'BODY_SURFACE_SELF_INTERSECTION' if case['selfIntersections'] else 'NOT_CERTIFIED','solveAllowed':False,'contactCertified':False,'exactLocalBodyPairCount':len(case['selfIntersections']),'nearestVerified':nearest}
        case['positiveLocalInsideCount']=sum(p['positiveLocalInside'] for r in case['rows'] for p in r['probes'])
    data['exactVerification']={'inputSHA256':hashlib.sha256(raw).hexdigest(),'method':'Python Fraction over exact input binary64 coordinates; strict interior segment and barycentric inequalities','verifiedPairs':total,'coverage':'listed local pairs; not exhaustive whole-body audit','continuousCollision':False}
    Path(destination).write_text(json.dumps(data,ensure_ascii=False,indent=2))
    q=Path(destination).parent/'qa';q.mkdir(exist_ok=True)
    (q/'EXACT_TESTS.json').write_text(json.dumps({'passed':True,'count':len(checks),'checks':checks,'verifiedPairs':total,'fitCertified':False},indent=2))
    print('EXACT_PASSED',len(checks),'pairs',total)
if __name__=='__main__':run(*sys.argv[1:])
