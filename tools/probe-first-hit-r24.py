"""Offline reference triangles diagnose visibility; never imported by runtime."""
import json, math, time
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parent.parent
original=json.loads((root/'qa/fidelity-r21/offline/original.json').read_text(encoding='utf8'))
cases=json.loads((root/'qa/fidelity-r24/varying-probe.json').read_text(encoding='utf8'))
faces=np.asarray(original['faces'],dtype=np.int64).reshape(-1,3)
report={'scope':'offline original triangle ray and projected coverage diagnostic; no product geometry modified','sourceFidelityAccepted':False,'cases':[]}
for case in cases['cases']:
 probe=case.get('varyingProbe')
 if not probe:continue
 state=json.loads((root/f"qa/fidelity-r21/offline/case-{case['id']}.json").read_text(encoding='utf8'))
 points=np.asarray(state['positionsYUp']).reshape(-1,3);normals=np.asarray(state['normalsYUp']).reshape(-1,3)
 eye=np.asarray(case['source']['cameraPosition']);target=np.array([0,(points[:,1].min()+points[:,1].max())*.5,0]);forward=target-eye;forward/=np.linalg.norm(forward);right=np.cross(forward,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,forward)
 a,b,c=(points[faces[:,i]] for i in range(3));e1=b-a;e2=c-a
 for point_index,(x,y) in enumerate(probe['points']):
  width=probe['channels'][0]['source'][point_index]['width'];height=probe['channels'][0]['source'][point_index]['height']
  direction=forward+.95*((x+.5-width*.5)/height*right+(height*.5-y-.5)/height*up);direction/=np.linalg.norm(direction)
  h=np.cross(np.broadcast_to(direction,e2.shape),e2);det=np.einsum('ij,ij->i',e1,h);valid=det>1e-14
  inv=np.zeros_like(det);inv[valid]=1/det[valid];s=eye-a;u=np.einsum('ij,ij->i',s,h)*inv;q=np.cross(s,e1);v=q@direction*inv;t=np.einsum('ij,ij->i',e2,q)*inv
  hit=np.where(valid&(u>=0)&(v>=0)&(u+v<=1)&(t>0))[0];hit=hit[np.argsort(t[hit])]
  samples=[]
  for index in hit[:8]:
   world=eye+direction*t[index];verts=points[faces[index]]-eye;depth=verts@forward;projected=np.column_stack((width*.5+(verts@right)/depth*height/.95,height*.5-(verts@up)/depth*height/.95))
   coverage={}
   for bits in [0,4,8,12,16]:
    polygon=projected if bits==0 else np.rint(projected*(2**bits))/(2**bits)
    p=np.array([x+.5,y+.5]);cross=[]
    for k in range(3):
     edge=polygon[(k+1)%3]-polygon[k];d=p-polygon[k];cross.append(float(edge[0]*d[1]-edge[1]*d[0]))
    coverage[str(bits)]={'inside':min(cross)>=0 or max(cross)<=0,'edgeAreas':cross}
   normal=normals[faces[index][0]]*(1-u[index]-v[index])+normals[faces[index][1]]*u[index]+normals[faces[index][2]]*v[index]
   samples.append({'face':int(index),'distance':float(t[index]),'viewDepth':float(np.dot(world-eye,forward)),'world':world.tolist(),'normal':normal.tolist(),'barycentric':[float(1-u[index]-v[index]),float(u[index]),float(v[index])],'projectedVertices':projected.tolist(),'coverage':coverage})
  source_depth=probe['channels'][2]['source'][point_index]['value'];candidate_depth=probe['channels'][2]['candidate'][point_index]['value']
  relative=points-eye;vertex_depth=relative@forward;screen=np.column_stack((width*.5+(relative@right)/vertex_depth*height/.95,height*.5-(relative@up)/vertex_depth*height/.95));quantized=[]
  for bits in [4,8,12,16]:
   tri=(np.rint(screen*(2**bits))/(2**bits))[faces];edges=np.roll(tri,-1,axis=1)-tri;delta=np.array([x+.5,y+.5])-tri;areas=edges[:,:,0]*delta[:,:,1]-edges[:,:,1]*delta[:,:,0];covered=valid&(np.max(areas,axis=1)<=0)&(t>0);selected=np.where(covered)[0];selected=selected[np.argsort(t[selected])];nearest=int(selected[0]) if len(selected) else None;depth=float(t[nearest]*np.dot(direction,forward)) if nearest is not None else None
   quantized.append({'subpixelBits':bits,'face':nearest,'viewDepth':depth,'originalGPUViewDepthDifference':depth-source_depth if depth is not None else None,'exactBarycentric':[float(1-u[nearest]-v[nearest]),float(u[nearest]),float(v[nearest])] if nearest is not None else None})
  report['cases'].append({'id':case['id'],'view':case['view'],'pixel':[x,y],'originalGPUViewDepth':source_depth,'candidateViewDepth':candidate_depth,'hits':samples,'quantizedOriginalCoverage':quantized,'nearestCandidateDepthDifference':samples[0]['viewDepth']-candidate_depth if samples else None,'nearestOriginalGPUDepthDifference':samples[0]['viewDepth']-source_depth if samples else None})
(root/'qa/fidelity-r24/first-hit-probe.json').write_text(json.dumps(report,indent=2),encoding='utf8')
for c in report['cases']:print(json.dumps({'id':c['id'],'view':c['view'],'pixel':c['pixel'],'candidateDifference':c['nearestCandidateDepthDifference'],'originalGPUDifference':c['nearestOriginalGPUDepthDifference'],'quantized8':c['quantizedOriginalCoverage'][1]}))
