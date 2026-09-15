"""Extract a small skeletal parameter document from the R2 source atlas.

Reads source data; does not import the application, generate a display mesh,
launch a browser or simulate a character. No input geometry is copied out.
Joint centres are explicit estimates, not clinical/functional measurements.
"""
import argparse
import base64
import gzip
import hashlib
import json
import pathlib
import re

import numpy as np

LOCK = "efaae075db5ad37499f13eeb9765eafaf4f13d592c8cb0bdbcf36c6de5e9f99f"
parser = argparse.ArgumentParser()
parser.add_argument("source", type=pathlib.Path)
parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("reconstruction/rig-reference.json"))
args = parser.parse_args()
raw = args.source.read_bytes()
assert hashlib.sha256(raw).hexdigest() == LOCK, "Atlas is not the locked R2 source"
payload = re.search(r'\["bones"\]\s*=\s*"([^\"]+)"', raw.decode()).group(1)
parts = json.loads(gzip.decompress(base64.b64decode(payload)))
by_bone = {}
for part in parts:
    part["points"] = np.frombuffer(base64.b64decode(part["p"]), dtype="<f4").astype(float).reshape(-1, 3)
    by_bone.setdefault(part["bone"], []).append(part)

def points(bone):
    return np.concatenate([p["points"] for p in by_bone[bone]])

def source_ids(bones):
    return sorted({p["id"] for b in bones for p in by_bone[b]})

def cap(bone, proximal=True, axis="y", fraction=.10):
    p = points(bone)
    if axis == "pca":
        centre = p.mean(0)
        _, _, vt = np.linalg.svd(p - centre, full_matrices=False)
        direction = vt[0]
        # Fingers run distally downward; toes run distally forward.
        desired = np.array([0, 0, 1]) if "toe" in bone or "metatarsal" in bone else np.array([0, -1, 0])
        if np.dot(direction, desired) < 0:
            direction = -direction
        v = (p - centre) @ direction
        select_low = proximal
    else:
        v = p[:, 1] if axis == "y" else np.abs(p[:, 0])
        select_low = not proximal if axis == "y" else proximal
    lo, hi = v.min(), v.max()
    chosen = p[v <= lo + fraction * (hi-lo)] if select_low else p[v >= hi - fraction * (hi-lo)]
    return chosen.mean(0)

fits = {}
def head_centre(bone):
    p = points(bone)
    lo, hi = p.min(0), p.max(0)
    # Proximal-medial epiphysis. The selection fractions are recorded authoring
    # choices; fitting residual is not anatomical joint-centre accuracy.
    height_fraction = .13 if "femur" in bone else .17
    x = np.abs(p[:, 0])
    chosen = p[(p[:, 1] > hi[1] - height_fraction*(hi[1]-lo[1])) & (x < x.min()+.48*(x.max()-x.min()))]
    c = chosen.mean(0)
    initial = np.r_[c, np.median(np.linalg.norm(chosen-c, axis=1))]
    fitted = initial.copy()
    # Deterministic iteratively reweighted Gauss-Newton radial sphere fit.
    for _ in range(40):
        lengths = np.maximum(1e-9,np.linalg.norm(chosen-fitted[:3],axis=1))
        residual = lengths-fitted[3]
        weight = (1+(residual/.0015)**2)**(-.25)
        jacobian = np.c_[(fitted[:3]-chosen)/lengths[:,None],-np.ones(len(chosen))]
        step = np.linalg.lstsq(jacobian*weight[:,None],-residual*weight,rcond=None)[0]
        fitted += step
        if np.linalg.norm(step)<1e-10:
            break
    centre, radius = fitted[:3], fitted[3]
    if not .010 < radius < .040 or np.any(centre < lo-.02) or np.any(centre > hi+.02):
        raise ValueError("Epiphysis fit outside plausible source extent: "+bone)
    residual=np.linalg.norm(chosen-centre,axis=1)-radius
    fits[bone] = {"radiusM": round(float(radius), 7), "sampleCount": len(chosen), "radialRmsM": round(float(np.sqrt(np.mean(residual**2))), 7), "anatomicalCentreErrorM": None}
    return centre

nodes = {}
def node(id, parent, position, bones, method, **extra):
    # The surface uses source X positive left. Workbench X is negative left.
    p = np.array(position) * [-1, 1, 1]
    nodes[id] = {"parent": parent, "positionM": np.round(p, 7).tolist(), "sourcePartIds": source_ids(bones), "method": method, **extra}
    return position

limbs = {}
for side in ["left", "right"]:
    femur, tibia, humerus, radius, ulna, talus = [side+"_"+x for x in ["femur", "tibia", "humerus", "radius", "ulna", "talus"]]
    hip = head_centre(femur)
    knee = (cap(femur,False)+cap(tibia,True))*.5
    ankle = cap(talus,True,fraction=.30)
    shoulder = head_centre(humerus)
    elbow = (cap(humerus,False)+cap(ulna,True)+cap(radius,True))/3
    wrist = (cap(ulna,False)+cap(radius,False))*.5
    limbs[side] = dict(hip=hip,knee=knee,ankle=ankle,shoulder=shoulder,elbow=elbow,wrist=wrist)
hip = (limbs["left"]["hip"]+limbs["right"]["hip"])*.5
node("hips",None,hip,["left_femur","right_femur"],"midpoint of fitted femoral head centres")
parent = "hips"
for region, count in [("L",5),("T",12),("C",7)]:
    for i in range(count,0,-1):
        id = region+str(i)
        p = points(id)
        # Anterior body portion avoids posterior spinous-process leverage.
        centre = p[p[:,2]>=np.quantile(p[:,2],.60)].mean(0)
        node(id,parent,centre,[id],"centroid of anterior 40 percent of source bone samples",region=region)
        parent = id
atlas = points("C1")
head = atlas[atlas[:,1]>=np.quantile(atlas[:,1],.75)].mean(0)
node("head","C1",head,["C1"],"centroid of superior atlas quartile; atlanto-occipital proxy")
jaw = points("mandible")
node("mandible","head",jaw[jaw[:,1]>=np.quantile(jaw[:,1],.93)].mean(0),["mandible"],"mean superior mandibular condyle region; bilateral hinge proxy")
node("sternum","T3",points("sternum").mean(0),["sternum"],"sternal source centroid")

for side, d in limbs.items():
    pre = side+"_"
    node(pre+"SC","T1",cap(pre+"clavicle",True,"x"),[pre+"clavicle"],"medial clavicle end cap centroid")
    node(pre+"AC",pre+"SC",cap(pre+"clavicle",False,"x"),[pre+"clavicle"],"lateral clavicle end cap centroid")
    node(pre+"upperArm",pre+"AC",d["shoulder"],[pre+"humerus"],"proximal medial humeral sphere fit",target=pre+"forearm")
    node(pre+"forearm",pre+"upperArm",d["elbow"],[pre+"humerus",pre+"ulna",pre+"radius"],"mean distal humerus and proximal forearm caps",target=pre+"hand")
    node(pre+"radiusRotation",pre+"forearm",d["elbow"],[pre+"radius",pre+"ulna"],"same elbow pivot; separate pronation/supination")
    node(pre+"hand",pre+"radiusRotation",d["wrist"],[pre+"radius",pre+"ulna"],"mean distal radius and ulna caps",target=pre+"finger_3_1")
    node(pre+"femur","hips",d["hip"],[pre+"femur"],"proximal medial femoral sphere fit",target=pre+"tibia")
    node(pre+"tibia",pre+"femur",d["knee"],[pre+"femur",pre+"tibia"],"midpoint of adjacent femoral and tibial end caps",target=pre+"foot")
    node(pre+"foot",pre+"tibia",d["ankle"],[pre+"talus"],"centroid of upper 30 percent talar extent")
    node(pre+"subtalar",pre+"foot",points(pre+"talus").mean(0),[pre+"talus"],"talar source centroid; hindfoot controller")
    mid = [pre+"navicular",pre+"cuboid"]
    node(pre+"midfoot",pre+"subtalar",np.mean([points(b).mean(0) for b in mid],axis=0),mid,"midpoint of navicular and cuboid centroids")
    patella=pre+"patella"
    node(patella,pre+"tibia",points(patella).mean(0),[patella],"source patellar centroid; fixed local offset, no invented tracking curve")
    for kind in ["finger","toe"]:
        for f in range(1,6):
            mc = pre+("metacarpal_" if kind=="finger" else "metatarsal_")+str(f)
            ids = [pre+kind+"_"+str(f)+"_"+str(k) for k in range(1,3 if f==1 else 4)]
            node(mc,pre+("hand" if kind=="finger" else "midfoot"),cap(mc,True,"pca"),[mc],"proximal PCA end cap centroid",target=ids[0])
            previous = mc
            for k,id in enumerate(ids):
                joint = (cap(previous,False,"pca")+cap(id,True,"pca"))*.5
                extra = {"target":ids[k+1]} if k+1<len(ids) else {"tipM":np.round(cap(id,False,"pca")*[-1,1,1],7).tolist()}
                node(id,previous,joint,[previous,id],"midpoint of adjacent PCA end caps",**extra)
                previous=id

doc = {"schema":"r2/source_derived_rig@1", "source":{"atlas":"BodyParts3D","url":"https://lifesciencedb.jp/bp3d/","license":"CC BY 4.0","sourceFileSHA256":LOCK,"coordinates":"metres; source X reflected once to left-negative, Y up, Z anterior","sourceSurfaceManifestSHA256":"80333a490df6a3685a686330114af7b8fcd1aac704e67d41891313e4ea660264"},
       "status":"derived-static-anatomical-estimate", "functionalCalibration":False,"subjectSpecificMotionAvailable":False,
       "sourceFloorM":-.0781112,"sourceHeightM":1.7194712,"nodes":nodes,"sphereFits":fits,
       "limitations":["Static segmented atlas; no functional joint-centre trial.","End cap and sphere fits are reproducible estimates, not measured kinematic axes.","No scanned or generated surface vertices are stored in this document.","Patellar translation, muscle bulging and contact compression require independent posed-surface or physical calibration."],
       "derivation":{"script":"tools/derive-r2-rig.py","endCapFraction":.10,"epiphysisMedialFraction":.48,"femurProximalFraction":.13,"humerusProximalFraction":.17,"sphereLoss":"soft_l1","sphereScaleM":.0015}}
args.output.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"nodes":len(nodes),"output":str(args.output),"sourceSHA256":LOCK,"applicationExecuted":False,"jointCalibrationAccepted":False,"sphereFits":fits}))
