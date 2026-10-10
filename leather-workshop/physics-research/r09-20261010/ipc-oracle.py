"""Independent IPC Toolkit 1.6.0 oracle; NOT a replacement production solver.
Units: metres. The geometric start states below are separated. CCD only bounds
admissible movement; it does not provide leather elasticity, friction, inertia
or a complete nonlinear integration step. No runtime dependency is added to R08.
Primary API: ipc-sim/ipc-toolkit@v1.6.0 README and ipctk.xyz/python-api/ccd.html.
"""
from pathlib import Path
from importlib.metadata import version
import json
import numpy as np
import ipctk

R = Path(__file__).resolve().parent
out = R / 'results'
out.mkdir(exist_ok=True)
report = {'package': 'ipctk', 'version': version('ipctk'), 'checks': [],
          'role': 'Native reference oracle only', 'releaseReady': False,
          'notImplemented': ['full product contact integration', 'frictional sticking/sliding solver', 'real-leather calibration']}

def check(name, passed, detail):
    report['checks'].append({'name': name, 'pass': bool(passed), 'detail': detail})
    (out / 'ipc-oracle.json').write_text(json.dumps(report, indent=2))
    if not passed:
        raise AssertionError(name)

try:
    check('pinned reference package', report['version'] == '1.6.0', report['version'])
    # Same initially separated configuration as the R08 0.5 m/s regression.
    x = np.array([[-60,100,-40],[60,100,-40],[0,100,60],
                  [-7,104,-7],[7,104,-7],[0,104,7]], dtype=float) * .001
    y = x.copy()
    y[3:, 1] -= .5 * (8/240)
    faces = np.array([[0,2,1],[3,4,5]], dtype=np.int32)
    edges = np.array([[0,2],[2,1],[1,0],[3,4],[4,5],[5,3]], dtype=np.int32)
    mesh = ipctk.CollisionMesh(x, edges, faces)
    thickness = .0014  # sum of half-thicknesses of the two 1.4mm specimens
    analytic_thickness_toi = (.004-thickness)/(.5*(8/240))
    alpha = float(ipctk.compute_collision_free_stepsize(mesh, x, y, min_distance=thickness))
    safe = x + alpha * (y-x)
    check('triangle-interior crossing is rejected before the finite thickness gap closes',
          0 < alpha <= analytic_thickness_toi + 1e-8 and np.min(safe[3:,1]-.1) >= thickness-1e-9,
          {'unfilteredFinalYMM': (y[3:,1]*1000).tolist(), 'safeStepFraction': alpha,
           'analyticThicknessTOI': analytic_thickness_toi, 'safeGapMM': float(np.min(safe[3:,1]-.1)*1000)})
    # An edge-interior crossing also has no near endpoint pairs.
    a0=np.array([-.03,.1,0]);a1=np.array([.03,.1,0])
    b0=np.array([0,.104,-.03]);b1=np.array([0,.104,.03]);travel=np.array([0,-.5*(8/240),0])
    for name,ccd in [('TightInclusionCCD',ipctk.TightInclusionCCD()),('AdditiveCCD',ipctk.AdditiveCCD())]:
        hit,toi=ccd.edge_edge_ccd(a0,a1,b0,b1,a0,a1,b0+travel,b1+travel,thickness)
        check(name+' detects swept edge-edge interior contact', bool(hit) and 0<float(toi)<=analytic_thickness_toi+1e-7,
              {'collision': bool(hit), 'safeTOI': float(toi), 'analyticThicknessTOI': analytic_thickness_toi})
        hit,toi=ccd.point_triangle_ccd(x[3],x[0],x[2],x[1],y[3],y[0],y[2],y[1],thickness)
        check(name+' detects swept point-triangle contact', bool(hit) and 0<float(toi)<=analytic_thickness_toi+1e-7,
              {'collision': bool(hit), 'safeTOI': float(toi)})
    away=x.copy();away[3:,1]+=.02
    free=float(ipctk.compute_collision_free_stepsize(mesh,x,away,min_distance=thickness))
    check('separating motion is not globally frozen', abs(free-1)<1e-12, {'step':free})
    # Surface barrier derivatives, not just a yes/no collision checkbox.
    near=x.copy();near[3:,1]=.102
    collisions=ipctk.NormalCollisions();collisions.build(mesh,near,.003,thickness)
    potential=ipctk.BarrierPotential(.003,stiffness=1000)
    energy=float(potential(collisions,mesh,near));grad=np.asarray(potential.gradient(collisions,mesh,near))
    check('finite nonzero contact barrier and derivatives at an admissible near-contact state',
          np.isfinite(energy) and energy>0 and np.all(np.isfinite(grad)) and np.linalg.norm(grad)>0,
          {'energy':energy,'gradientNorm':float(np.linalg.norm(grad)), 'note':'No physical material units inferred from arbitrary barrier stiffness.'})
    report['pass']=True
except Exception as error:
    report['pass']=False;report['failure']=str(error)
finally:
    (out/'ipc-oracle.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
if not report['pass']:
    raise SystemExit(1)
