"""Project adapter: official GNM geometry + our semantic measurement contract.

Official model/code remain in the ignored, checksum-verified runtime cache.
No R008 head vertices, fixed coordinates, or old displacement fields are used.
"""
from pathlib import Path
import os,sys,json,time
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):
    os.environ.setdefault(name,'1')
ROOT=Path(__file__).resolve().parent
sys.path[:0]=[str(ROOT/'runtime-cache/python-deps'),str(ROOT/'runtime-cache/upstream')]
import numpy as np
from gnm.shape import gnm_numpy

SEMANTICS=[
 ('eyeSpacing','眼中心间距','pupilRight','pupilLeft','distance'),
 ('faceWidth','颧部宽','cheekRight','cheekLeft','distance'),
 ('jawWidth','下颌宽','jawRight','jawLeft','distance'),
 ('chinWidth','下巴宽','contour5','contour11','distance'),
 ('noseWidth','鼻翼宽','noseBase0','noseBase4','distance'),
 ('noseLength','鼻长度','bridge0','noseBase2','vertical'),
 ('mouthWidth','口宽','lipOuter0','lipOuter6','distance'),
 ('philtrum','人中长度','noseBase2','lipOuter3','vertical'),
 ('chinLength','下唇至下巴','lipOuter9','contour8','vertical'),
 ('upperLip','上唇中段厚度','lipOuter3','lipInner2','vertical'),
 ('lowerLip','下唇中段厚度','lipInner6','lipOuter9','vertical'),
 ('eyeWidthLeft','人物左眼裂宽','eyeLeft0','eyeLeft3','distance'),
 ('eyeWidthRight','人物右眼裂宽','eyeRight0','eyeRight3','distance'),
 ('eyeHeightLeft','人物左眼裂高','eyeLeft1','eyeLeft5','vertical'),
 ('eyeHeightRight','人物右眼裂高','eyeRight1','eyeRight5','vertical'),
 ('browDistanceLeft','人物左眉眼间距','browLeft2','pupilLeft','vertical'),
 ('browDistanceRight','人物右眉眼间距','browRight2','pupilRight','vertical'),
]

class GNMBridge:
    def __init__(self,progress=lambda *args:None):
        progress(12,'读取经校验的 GNM 权重')
        self.provenance=json.loads((ROOT/'source-provenance.json').read_text(encoding='utf8'))
        self.model=gnm_numpy.GNM.from_custom_file(ROOT/'runtime-cache/gnm_head.npz')
        self.m=self.model
        progress(55,'绑定 GNM 官方标志点与原生分组')
        self.groups={name:np.asarray(row) for name,row in zip(self.m.vertex_group_names,self.m.vertex_groups)}
        config=np.loadtxt(ROOT/'runtime-cache/upstream/gnm/shape/data/landmarks/head_sparse_68.txt')
        self.landmark_ids=config[:,::2].astype(np.int32)
        self.landmark_weights=config[:,1::2].astype(np.float32)
        self.bindings={};self.evidence={}
        def sparse(name,index):
            self.bindings[name]=(self.landmark_ids[index],self.landmark_weights[index]);self.evidence[name]='GNM official sparse-68 barycentric landmark'
        for i in range(17):sparse('contour'+str(i),i)
        for i in range(5):
            sparse('browRight'+str(i),21-i);sparse('browLeft'+str(i),22+i)
        for side,indices in [('Right',[39,38,37,36,41,40]),('Left',[42,43,44,45,46,47])]:
            for i,index in enumerate(indices):sparse('eye'+side+str(i),index)
        for i in range(4):sparse('bridge'+str(i),27+i)
        for i in range(5):sparse('noseBase'+str(i),31+i)
        for i in range(12):sparse('lipOuter'+str(i),48+i)
        for i in range(8):sparse('lipInner'+str(i),60+i)
        for side,sign in [('Left',1),('Right',-1)]:
            w=self.groups['pupils']*self.groups[side.lower()+'_eye'];ids=np.flatnonzero(w>0)
            self.bindings['pupil'+side]=(ids,(w[ids]/w[ids].sum()).astype(np.float32));self.evidence['pupil'+side]='GNM pupil-region weighted centroid, geometric centre'
            self.bindings['jaw'+side]=self.bindings['contour'+str(12 if sign==1 else 4)];self.evidence['jaw'+side]='sparse-68 jaw contour proxy'
            for feature,group in [('cheek','zygomatic'),('temple','temple'),('ear',None)]:
                mask=self.groups['ears' if feature=='ear' else side.lower()+'_'+group+'_region']
                ids=np.flatnonzero((mask>.5)&(self.m.template_vertex_positions[:,0]*sign>0))
                index=ids[np.argmax(self.m.template_vertex_positions[ids,0]*sign)]
                self.bindings[feature+side]=(np.array([index]),np.array([1],dtype=np.float32));self.evidence[feature+side]='GNM regional mask lateral vertex proxy; calibrated approximation'
        ids=np.concatenate([self.bindings['browRight0'][0],self.bindings['browLeft0'][0]])
        weights=np.concatenate([self.bindings['browRight0'][1],self.bindings['browLeft0'][1]])*.5
        self.bindings['glabella']=(ids,weights);self.evidence['glabella']='midpoint of inner brow landmarks; proxy'
        self.names=list(self.bindings)
        self.anchor_template=self.anchors(self.m.template_vertex_positions)
        self.anchor_basis=np.stack([np.sum(self.m.vertex_identity_basis[:,ids]*w[None,:,None],axis=1) for ids,w in self.bindings.values()],axis=1)
        self.lookup={name:i for i,name in enumerate(self.names)}
        self.semantic_baseline=self.metric_values(self.anchor_template)
        self.zero_identity=np.zeros(self.m.identity_dim,dtype=np.float32)
        self.zero_expression=np.zeros(self.m.expression_dim,dtype=np.float32)
        progress(75,'建立语义数值与统计系数的求解关系')
        self._prepare_topology()
        self.meta=self._metadata()
        progress(100,'GNM 真实三维模型已准备')

    def anchors(self,vertices):
        return np.stack([np.sum(vertices[ids]*w[:,None],axis=0) for ids,w in self.bindings.values()])

    def metric_values(self,points):
        out=[]
        for _,_,a,b,kind in SEMANTICS:
            delta=points[self.lookup[a]]-points[self.lookup[b]]
            out.append(np.linalg.norm(delta) if kind=='distance' else abs(delta[1]))
        return np.asarray(out)

    def semantic_identity(self,requests,initial):
        if not requests:return initial.copy(),{'iterations':0,'residual':0,'bounded':False}
        allowed={row[0] for row in SEMANTICS}
        if set(requests)-allowed:raise ValueError('未知语义参数')
        desired=np.array([requests.get(row[0],0) for row in SEMANTICS],dtype=float)
        if not np.isfinite(desired).all() or np.max(np.abs(desired))>15:raise ValueError('语义请求范围为 ±15%')
        target=self.semantic_baseline*(1+desired/100)
        beta=np.array(initial[:170],dtype=float)
        # Linear GNM bases and the measured distance Jacobian: this changes
        # coefficients within the teacher's model rather than pushing vertices.
        basis=self.anchor_basis[:170]
        ridge=.00012
        for iteration in range(6):
            points=self.anchor_template+np.einsum('i,ijk->jk',beta,basis)
            metrics=self.metric_values(points);J=[]
            for k,(_,_,a,b,kind) in enumerate(SEMANTICS):
                delta=points[self.lookup[a]]-points[self.lookup[b]]
                direction=delta/max(np.linalg.norm(delta),1e-9) if kind=='distance' else np.array([0,np.sign(delta[1]),0])
                derivative=(basis[:,self.lookup[a]]-basis[:,self.lookup[b]])@direction
                J.append(derivative/self.semantic_baseline[k])
            J=np.asarray(J);r=(target-metrics)/self.semantic_baseline
            # Woodbury form: solve the 17x17 system, not a dense 170x170 inverse.
            step=J.T@np.linalg.solve(J@J.T+ridge*np.eye(len(SEMANTICS)),r+J@beta)-beta
            beta=np.clip(beta+step,-3,3)
            if np.max(np.abs(step))<1e-5:break
        identity=initial.copy();identity[:170]=beta
        actual=self.metric_values(self.anchor_template+np.einsum('i,ijk->jk',beta,basis))
        return identity,{'iterations':iteration+1,'residual':float(np.sqrt(np.mean(((target-actual)/self.semantic_baseline)**2))),'bounded':bool(np.any(np.abs(beta)>=2.999)),'requested':requests,'actualPercent':dict(zip([r[0] for r in SEMANTICS],((actual/self.semantic_baseline-1)*100).tolist()))}

    def _prepare_topology(self):
        tri=np.asarray(self.m.triangles);components=self.m.mesh_component_names
        scores=np.stack([self.groups[name][tri].mean(axis=1) for name in components])
        owners=scores.argmax(axis=0)
        cornea=self.groups['eye_exteriors'][tri].mean(axis=1)>.5
        owners[cornea]=len(components)
        order=np.argsort(owners,kind='stable');self.draw_triangles=tri[order]
        self.draw_groups=[];start=0
        for index in range(len(components)+1):
            count=int((owners==index).sum())*3
            if count:self.draw_groups.append({'start':start,'count':count,'materialIndex':index})
            start+=count
        colour=np.broadcast_to(np.array([.50,.35,.27]),(self.m.num_vertices,3)).copy()
        def tint(mask,rgb):
            nonlocal colour
            w=np.clip(mask,0,1)[:,None];colour=colour*(1-w)+np.array(rgb)*w
        tint(self.groups['gums'],[.38,.09,.09]);tint(self.groups['teeth'],[.72,.70,.62]);tint(self.groups['tongue'],[.40,.12,.13]);tint(self.groups['scleras'],[.67,.68,.61]);tint(self.groups['irises'],[.10,.15,.12]);tint(self.groups['pupils'],[.004,.004,.004])
        self.colours=colour.astype(np.float32)

    def _metadata(self):
        return {'schema':'human/gnm-metadata@1','source':'google/GNM','version':str(self.m.version.value),'sourceCommit':self.provenance['commit'],'modelSHA256':self.provenance['modelSHA256'],'vertices':self.m.num_vertices,'triangleCount':len(self.m.triangles),'quads':len(self.m.quads),'identityDim':self.m.identity_dim,'expressionDim':self.m.expression_dim,'jointNames':self.m.joint_names,'identityNames':self.m.identity_names,'expressionNames':self.m.expression_names,'groupNames':self.m.vertex_group_names,'groupWeights':np.asarray(self.m.vertex_groups).tolist(),'triangles':self.draw_triangles.ravel().tolist(),'drawGroups':self.draw_groups,'componentNames':list(self.m.mesh_component_names)+['cornea'],'colours':self.colours.ravel().tolist(),'semanticDefinitions':[{'id':r[0],'label':r[1],'min':-15,'max':15,'unit':'% of GNM-neutral measurement'} for r in SEMANTICS],'landmarkNames':self.names,'baselineLandmarks':self._landmark_rows(self.anchor_template),'landmarkMissing':['hairlineCentre','hairlineLeft','hairlineRight'],'regionEvidence':'GNM native supplied masks; statistical/external regions, not measured muscle or fat','oldPhotoWorkflow':'paused','oldR008GeometryLoaded':False,'limitations':['GNM source scans/statistical prior, not a model trained by this project','No photo target fitting in this paused phase','No hairline, hair or photograph skin appearance inferred','PCA extremes and masks do not certify anatomical accuracy or no intersections']}

    def _landmark_rows(self,points):
        return [{'id':name,'point':point.tolist(),'confidence':.9 if self.evidence[name].startswith('GNM official') else .65,'evidence':self.evidence[name]} for name,point in zip(self.names,points)]+[{'id':name,'point':None,'confidence':0,'evidence':'NotObserved: GNM bald template has no observed hairline'} for name in ['hairlineCentre','hairlineLeft','hairlineRight']]

    @staticmethod
    def vector(data,key,shape,limit):
        value=np.asarray(data.get(key,np.zeros(shape)),dtype=np.float32)
        if value.shape!=shape or not np.isfinite(value).all() or np.max(np.abs(value))>limit:raise ValueError(f'{key} 维数、有限值或范围错误')
        return value

    def evaluate(self,data):
        started=time.perf_counter()
        if data.get('schema')!='human/gnm-head-session@1' or data.get('modelSHA256')!=self.provenance['modelSHA256']:raise ValueError('配方必须属于当前 GNM；旧 R008 配方不能直接迁移')
        identity=self.vector(data,'identity',(self.m.identity_dim,),3)
        expression=self.vector(data,'expression',(self.m.expression_dim,),3)
        rotations=self.vector(data,'rotations',(self.m.num_joints,3),.70)
        translation=self.vector(data,'translation',(3,),1)
        identity,semantic_report=self.semantic_identity(data.get('semantic',{}),identity)
        vertices=self.m(identity=identity,expression=expression,rotations=rotations,translation=translation)
        neutral=self.m.vertex_positions_bind_pose(identity,expression)
        joints=self.m.joint_positions_bind_pose(identity)
        landmarks=self.anchors(vertices);neutral_landmarks=self.anchors(neutral)
        if not np.isfinite(vertices).all():raise ValueError('GNM 生成了非有限顶点')
        return {'schema':'human/gnm-runtime@1','positions':vertices.ravel().tolist(),'landmarks':self._landmark_rows(landmarks),'measurementLandmarks':self._landmark_rows(neutral_landmarks),'effectiveIdentity':identity.tolist(),'semanticReport':semantic_report,'joints':joints.tolist(),'evaluationMS':(time.perf_counter()-started)*1000,'topologyChanged':False,'oldR008GeometryLoaded':False}

    def empty_recipe(self):
        return {'schema':'human/gnm-head-session@1','modelSHA256':self.provenance['modelSHA256'],'identity':self.zero_identity.tolist(),'expression':self.zero_expression.tolist(),'rotations':np.zeros((self.m.num_joints,3)).tolist(),'translation':[0,0,0],'semantic':{}}
