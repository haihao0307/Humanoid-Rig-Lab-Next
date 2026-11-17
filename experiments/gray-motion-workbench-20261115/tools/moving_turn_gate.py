"""Finite release checks for this character's continuous walking turns."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def check(row):
    try:
        files = row['soleGateEvidence']
        def read(key):
            p = (ROOT / files[key]).resolve()
            if ROOT not in p.parents:
                raise ValueError('evidence outside project')
            return json.loads(p.read_text(encoding='utf8'))
        digest = hashlib.sha256((ROOT / row['file']).read_bytes()).hexdigest()
        if digest != row['sha256']:
            raise ValueError('clip hash changed')
        foot, support, comparison, body = (read(k) for k in ('foot', 'support', 'sole', 'body'))
        br = next(r for r in body['reports'] if r['id'] == row['id'])
        cr = next(r for r in comparison['clips'] if r['id'] == row['id'])
        if any(x != digest for x in (foot['clipSHA256'], support['clipSHA256'], cr['sha256'], br['candidateSHA256'])):
            raise ValueError('evidence hash mismatch')
        if min(foot['fps'], support['fps'], br['fps']) < 120 or comparison['fps'] < 30:
            raise ValueError('insufficient sampling')
        if foot['insideSamples'] != 0 or foot['minClearanceMM'] < -.05:
            raise ValueError('foot penetration')
        s = support['summary']
        if s['windows'] < 1 or s['maxHorizontalErrorMM'] > 20 or s['maxSupportClearanceMM'] > 6.5:
            raise ValueError('source support mismatch')
        for side in 'LR':
            c = cr['comparisons'][side]
            if abs(c['medianPitchErrorDegrees']) >= 2 or c['p95AbsPitchErrorDegrees'] > 5 or c['targetHeelRaisedOver20MMWhenSourceBothWithin15MMSamples'] > 2:
                raise ValueError('sole pitch or heel-up regression')
        for key in ('torsoInsideSamples', 'leftLegInsideSamples', 'rightLegInsideSamples', 'torsoLegInsideSamples', 'legPairInsideSamples'):
            if br['summary'][key] != 0:
                raise ValueError('projected body intersection: ' + key)
        if br['summary'].get('sourceSupportBothFeetAbove10MM') != 0:
            raise ValueError('estimated support with both feet elevated')
        return True, 'passed finite sampled checks'
    except (KeyError, ValueError, StopIteration, OSError, TypeError) as e:
        return False, str(e)

if __name__ == '__main__':
    import sys
    manifest = json.loads((ROOT / 'data/adaptation-manifest.json').read_text(encoding='utf8'))
    row = next(x for x in manifest['clips'] if x['id'] == sys.argv[1])
    ok, reason = check(row)
    print(json.dumps({'id': row['id'], 'passed': ok, 'reason': reason}))
    sys.exit(0 if ok else 1)
