"""Read public ASF/AMC files and derive dimensionless motion parameters.

Only data conversion and interpolation-error measurement: no application import,
display mesh, renderer, character simulation, or GPU execution.
CMU documents the Euler axes and the 0.0254 / ASF-length unit conversion.
"""
import argparse
import hashlib
import json
import pathlib
import re
import numpy as np

def rotation(angles):
    x,y,z=np.radians(angles)
    X=np.array([[1,0,0],[0,np.cos(x),-np.sin(x)],[0,np.sin(x),np.cos(x)]])
    Y=np.array([[np.cos(y),0,np.sin(y)],[0,1,0],[-np.sin(y),0,np.cos(y)]])
    Z=np.array([[np.cos(z),-np.sin(z),0],[np.sin(z),np.cos(z),0],[0,0,1]])
    return Z@Y@X

def quaternion(R):
    # Eigenvector method avoids special cases near 180 degrees.
    q=np.array([R[0,0]-R[1,1]-R[2,2],R[1,1]-R[0,0]-R[2,2],R[2,2]-R[0,0]-R[1,1],np.trace(R)])
    K=np.diag(q)
    for i,j,v in [(0,1,R[0,1]+R[1,0]),(0,2,R[0,2]+R[2,0]),(1,2,R[1,2]+R[2,1]),(0,3,R[2,1]-R[1,2]),(1,3,R[0,2]-R[2,0]),(2,3,R[1,0]-R[0,1])]:
        K[i,j]=K[j,i]=v
    _,V=np.linalg.eigh(K)
    q=V[:,-1]
    return q if q[3]>=0 else -q

def read_trial(root, subject, trial):
    asf=root/(subject+'.asf'); amc=root/(subject+'_'+trial+'.amc')
    text=asf.read_text(); bones={}
    scale=.0254/float(re.search(r':units[\s\S]*?length\s+([\d.]+)',text).group(1))
    block=text.split(':bonedata')[1].split(':hierarchy')[0]
    for b in re.findall(r'\bbegin\b([\s\S]*?)\bend\b',block):
        fields={line.split()[0]:line.split()[1:] for line in b.splitlines() if line.strip()}
        name=fields['name'][0]
        assert fields['axis'][3]=='XYZ'
        bones[name]={'direction':np.array(list(map(float,fields['direction']))),'length':float(fields['length'][0])*scale,'C':rotation(list(map(float,fields['axis'][:3]))),'dof':fields.get('dof',[])}
    parent={}
    for line in text.split(':hierarchy')[1].splitlines():
        row=line.split()
        if len(row)>1:
            for child in row[1:]:parent[child]=row[0]
    frames=[]
    for line in amc.read_text().splitlines():
        row=line.split()
        if not row or row[0].startswith(('#',':')):continue
        if row[0].isdigit():frames.append({})
        else:frames[-1][row[0]]=list(map(float,row[1:]))
    pose=[]
    for f in frames:
        R={'root':rotation(f['root'][3:])}; ends={'root':np.array(f['root'][:3])*scale}; starts={}
        for name,b in bones.items():
            a=[0.,0.,0.]
            for channel,value in zip(b['dof'],f.get(name,[])):
                a['xyz'.index(channel[1])]=value
            R[name]=R[parent[name]]@b['C']@rotation(a)@b['C'].T
            starts[name]=ends[parent[name]]
            ends[name]=starts[name]+R[name]@b['direction']*b['length']
        pose.append({'starts':starts,'ends':ends,'R':R,'hip':(starts['lfemur']+starts['rfemur'])*.5})
    return {'subject':subject,'trial':trial,'bones':bones,'pose':pose,'frames':frames,'scale':scale,'locks':[{"url":'https://mocap.cs.cmu.edu/subjects/'+subject+'/'+p.name,"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"bytes":p.stat().st_size} for p in [asf,amc]]}

def inspect(trial):
    rows=trial['pose'];floor=min(p['ends'][s+'toes'][1] for p in rows for s in ['l','r'])
    for i in np.linspace(0,len(rows)-1,35,dtype=int):
        p=rows[i];print(i+1,'hip',np.round(p['hip'],3).tolist(),'headY',round(float(p['ends']['head'][1]),3),'wristY',[round(float(p['starts'][s+'hand'][1]),3) for s in ['l','r']],'ankleY',[round(float(p['starts'][s+'foot'][1]),3) for s in ['l','r']])
    print('floor',floor,'frames',len(rows),'scale',trial['scale'])

def unit(v):
    return v/max(1e-12,np.linalg.norm(v))

def motion_record(p,trial,heading,origin,floor,leg_length,standing_height):
    S=np.diag([-1,1,1]); H=rotation([0,-np.degrees(heading),0]); A=S@H
    localq=lambda a,b:quaternion(S@p['R'][a].T@p['R'][b]@S).tolist()
    out={'rootOffset':(A@(p['hip']-origin)/leg_length).tolist(),
         'rootHeightRatio':float((p['hip'][1]-floor)/standing_height),
         'rootQ':quaternion(A@p['R']['root']@S).tolist(),
         'lumbarQ':localq('root','lowerback'),'thoraxQ':localq('lowerback','thorax'),
         'cervicalQ':localq('thorax','upperneck'),'headQ':localq('upperneck','head')}
    for short,side in [('l','left'),('r','right')]:
        start,end=p['starts'],p['ends']
        for name,a,b in [('UpperArm','humerus','radius'),('Forearm','radius','hand'),('Thigh','femur','tibia'),('Shank','tibia','foot')]:
            out[side+name]=unit(A@(start[short+b]-start[short+a])).tolist()
            # Keep axial rotation as well as the segment direction. A nearly
            # straight limb cannot recover its twist from a three-point plane.
            Y=-unit(trial['bones'][short+a]['direction'])
            Z=unit(np.array([0.,0.,1.])-Y*Y[2]);X=unit(np.cross(Y,Z));Z=unit(np.cross(X,Y))
            out[side+name+'Q']=quaternion(A@p['R'][short+a]@np.column_stack([X,Y,Z])@S).tolist()
        # A fixed basis on the ASF hand direction avoids defining palm roll
        # from the arbitrary terminal thumb length or a nearly collinear ray.
        Y=-unit(trial['bones'][short+'hand']['direction'])
        Z=unit(np.array([0,0,1])-Y*Y[2]);X=unit(np.cross(Y,Z));Z=unit(np.cross(X,Y))
        basis=np.column_stack([X,Y,Z])
        out[side+'HandQ']=quaternion(A@p['R'][short+'hand']@basis@S).tolist()
        Z=unit(A@(end[short+'toes']-start[short+'foot']))
        X=-A@p['R'][short+'foot']@np.array([1,0,0]);X=unit(X-Z*np.dot(X,Z));Y=unit(np.cross(Z,X));X=unit(np.cross(Y,Z))
        out[side+'FootQ']=quaternion(np.column_stack([X,Y,Z])).tolist()
        out[side+'ClavicleQ']=localq('thorax',short+'clavicle')
        out[side+'AnkleHeightRatio']=float((start[short+'foot'][1]-floor)/leg_length)
    return out

def make_clip(trial, start, end, name, description, cycle=False):
    rows=trial['pose'];bones=trial['bones']; first=rows[start-1]
    delta=rows[end-1]['hip']-first['hip']
    forward=delta if cycle else rows[0]['R']['root']@np.array([0,0,1])
    heading=np.arctan2(forward[0],forward[2])
    leg_length=np.mean([bones[s+'femur']['length']+bones[s+'tibia']['length'] for s in ['l','r']])
    floor=float(np.median([rows[i]['ends'][s+'toes'][1] for i in range(min(40,len(rows))) for s in ['l','r']]))
    standing_height=float(np.median([p['hip'][1]-floor for p in rows[:40]]))
    records=[motion_record(p,trial,heading,first['hip'],floor,leg_length,standing_height) for p in rows[start-1:end]]
    A=np.diag([-1,1,1])@rotation([0,-np.degrees(heading),0])
    sweep=np.array([A@(v-first['hip'])/leg_length for p in rows[start-1:end] for k,v in p['starts'].items() if k not in ['lthumb','rthumb','ltoes','rtoes']])
    bounds=[[float(sweep[:,axis].min()),float(sweep[:,axis].max())] for axis in [0,2]]
    indices=np.unique(np.rint(np.linspace(0,len(records)-1,min(97,len(records)))).astype(int))
    # Retain source frames adaptively; bounded storage blocks are motion
    # parameters, not mesh buffers. Never smooth away the published angles.
    for _ in range(12):
        additions=[]
        for j0,j1 in zip(indices[:-1],indices[1:]):
            worst=1.;at=None
            for i in range(j0+1,j1):
                u=(i-j0)/(j1-j0)
                for key,value in records[i].items():
                    a=np.array(records[j0][key]);b=np.array(records[j1][key]);v=np.array(value)
                    if key.endswith('Q') and np.dot(a,b)<0:b=-b
                    approx=a+(b-a)*u
                    if key.endswith('Q'):score=np.degrees(2*np.arccos(np.clip(abs(np.dot(unit(approx),v)),-1,1)))/.35
                    elif key=='rootOffset':score=np.linalg.norm(approx-v)/.001
                    elif np.ndim(v)==0:score=abs(float(approx-v))/.001
                    else:score=np.degrees(np.arccos(np.clip(np.dot(unit(approx),v),-1,1)))/.35
                    if score>worst:worst=score;at=i
            if at is not None:additions.append(at)
        if not additions:break
        indices=np.unique(np.r_[indices,additions])
    samples=[]
    for i in indices:
        r=records[i]
        samples.append({'t':round(i/(len(records)-1),9),**{k:([round(float(x),7) for x in v] if isinstance(v,list) else round(v,7)) for k,v in r.items()}})
    errors={'maxQuaternionDegrees':0.,'maxDirectionDegrees':0.,'maxRootOffsetLegLengths':0.,'maxHeightRatio':0.}
    for i,r in enumerate(records):
        k=max(0,min(len(indices)-2,int(np.searchsorted(indices,i,side='right'))-1));j0,j1=indices[k:k+2];u=(i-j0)/(j1-j0)
        for key,v in r.items():
            a=np.array(records[j0][key]);b=np.array(records[j1][key]);actual=np.array(v)
            if key.endswith('Q') and np.dot(a,b)<0:b=-b
            approx=a+(b-a)*u
            if key.endswith('Q'):
                error=np.degrees(2*np.arccos(np.clip(abs(np.dot(unit(approx),actual)),-1,1)));field='maxQuaternionDegrees'
            elif key in ['rootOffset']:
                error=np.linalg.norm(approx-actual);field='maxRootOffsetLegLengths'
            elif np.ndim(actual)==0:
                error=abs(float(approx-actual));field='maxHeightRatio'
            else:
                error=np.degrees(np.arccos(np.clip(np.dot(unit(approx),actual),-1,1)));field='maxDirectionDegrees'
            errors[field]=max(errors[field],float(error))
    return {'id':name,'description':description,'sourceTrial':trial['subject']+'_'+trial['trial'],
      'sourceFrameStart':start,'sourceFrameEnd':end,'sourceSampleRateHz':120,'durationS':(end-start)/120,
      'sourceLegLengthM':float(leg_length),'sourceStandingHipHeightM':standing_height,'sourceFloorEstimateM':floor,
      'loop':cycle,'segmentation':'authored interval selected by source kinematics; not an original CMU subclip label',
      'sampleBlocks':[samples[i:i+96] for i in range(0,len(samples),96)],'sampleCount':len(samples),
      'sourceSkeletonSweepXZLegLengths':bounds,
      'parameterInterpolationError':{k:round(v,7) for k,v in errors.items()},'posedSurfaceError':None}

def choose_walk_interval(trial):
    rows=trial['pose'];directions=[]
    for p in rows:
        directions.append([unit(p['starts'][side+b]-p['starts'][side+a]) for side in ['l','r'] for a,b in [('humerus','radius'),('radius','hand'),('femur','tibia'),('tibia','foot')]])
    directions=np.array(directions);best=None
    for i in range(10,len(rows)-90):
        for j in range(i+90,min(i+170,len(rows))):
            degrees=np.degrees(np.arccos(np.clip(np.sum(directions[i]*directions[j],axis=1),-1,1)))
            dy=abs(rows[i]['hip'][1]-rows[j]['hip'][1])
            candidate=(float(np.sqrt(np.mean(degrees**2))+dy*300),i+1,j+1,float(max(degrees)),float(dy))
            if best is None or candidate<best:best=candidate
    return best

def derive(directory, output):
    walking=read_trial(directory,'08','01');floor=read_trial(directory,'113','08');wave=read_trial(directory,'113','27')
    clips={};loop=choose_walk_interval(walking)
    for trial,a,b,id,label,cycle in [
      (walking,loop[1],loop[2],'walk','walking, one selected gait cycle',True),
      (floor,70,350,'standToSit','standing to floor sitting',False),
      (floor,350,760,'sitToLie','floor sitting to supine rest',False),
      (floor,1080,1400,'lieToSit','supine rest to floor sitting',False),
      (floor,1400,1710,'sitToStand','floor sitting to standing',False),
      (wave,1,len(wave['pose']),'wave','recorded greeting wave',False)]:
        clips[id]=make_clip(trial,a,b,id,label,cycle)
    clips['walk']['cycleSelection']={'method':'minimum RMS limb-direction recurrence plus 300 degrees per metre of hip-height difference','candidatePeriodFrames':[90,169],'score':loop[0],'maximumEndpointLimbDirectionDegrees':loop[3],'endpointHipHeightDifferenceM':loop[4],'sourceEndpointsIdentical':False}
    doc={'schema':'r2/public_motion_reference@1','revision':'cmu-r8-full-segment-rotation',
      'source':{'organization':'Carnegie Mellon University Graphics Lab','url':'https://mocap.cs.cmu.edu/',
      'formatDocumentation':'https://mocap.cs.cmu.edu/info.php','axisDocumentation':'https://graphics.cs.cmu.edu/nsp/course/cs229/info/Acclaim_Skeleton_Format.html',
      'terms':'https://mocap.cs.cmu.edu/faqs.php','attribution':'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.',
      'subjects':{'08':'walking subject; identity not inferred','113':'post pregnant woman, as labelled by the CMU database'},
      'locks':[lock for trial in [walking,floor,wave] for lock in trial['locks']]},
      'clips':clips,'reconstruction':{'script':'tools/derive-motion-reference.py','ASFLengthToMetres':'0.0254 / lengthUnit','EulerOrder':'extrinsic XYZ: Rz Ry Rx','jointRotation':'parent R * C * motion R * inverse C','handedness':'reflect X once; rotations S R S',
      'rootHeight':'dimensionless hip height relative to source standing reference','limbs':'direction and complete orientation tracks retargeted to R2 fixed segment lengths; twist is retained','spine':'measured lumbar, thoracic and cervical rotations distributed over R2 source segments','contacts':'retargeting constraint; not measured forces'},
      'limitations':['Different people from the static R2 atlas; retargeting is not subject-specific motion capture.','No measured muscle, fat, skin displacement, compression or patellar tracking.','Terminal thumb and toe axes are skeletal proxies, not independently captured detailed tissue.','Starts, stops, path turns, contact fitting and segmentwise spine allocation are engineering adaptations.','No capture-backed source is installed for salute, loaded carrying or pushing.'],
      'motionParameterFile':True,'containsSurfaceVertices':False,'visualAcceptance':False}
    output.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'output':str(output),'clips':{k:{'frames':[v['sourceFrameStart'],v['sourceFrameEnd']],'durationS':v['durationS'],'samples':v['sampleCount'],'error':v['parameterInterpolationError']} for k,v in clips.items()},'applicationExecuted':False}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=pathlib.Path);parser.add_argument('--inspect');parser.add_argument('--output',type=pathlib.Path,default=pathlib.Path('reconstruction/motion-reference.json'));args=parser.parse_args()
    if args.inspect:
        subject,trial=args.inspect.split('_');inspect(read_trial(args.directory,subject,trial))
    else:
        derive(args.directory,args.output)
