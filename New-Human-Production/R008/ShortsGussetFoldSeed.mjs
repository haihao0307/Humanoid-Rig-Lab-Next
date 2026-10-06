// Source-paper manufacturing seed, NOT an accepted wearing/contact state.
// Membrane and bend must remain separate: Baraff & Witkin, SIGGRAPH 1998,
// https://www.cs.cmu.edu/~baraff/papers/sig98.pdf
// Contact continuation requires a feasible start and CCD, not a post-hoc mask:
// https://ipc-sim.github.io/C-IPC/
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const sub=(a,b)=>a.map((v,k)=>v-b[k]),mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const length=v=>Math.hypot(...v),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function fail(code,details){const e=new Error(code);e.code=code;e.details=details;throw e;}
function unit(v,label){const l=length(v);if(!(l>1e-12&&Number.isFinite(l)))fail('HOLD_FOLD_SINGULAR_FRAME',{label,v});return v.map(x=>x/l);}
function planeFrame(edge,guide,label){const tangent=unit(edge,label+'.tangent'),inside=unit(guide.map((v,k)=>v-dot(guide,tangent)*tangent[k]),label+'.inside'),normal=cross(tangent,inside);return {tangent,inside,normal,gram:[dot(tangent,tangent),dot(inside,inside),dot(tangent,inside)],determinant:dot(tangent,cross(inside,normal))};}
function quotient(count,seams,active){const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));for(const s of seams)if(active.has(s.id))for(const p of s.pairs)parent[find(p.b)]=find(p.a);const groups=new Map();for(let i=0;i<count;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}const seamGroups=[...groups.values()],quotientMap=new Uint32Array(count);seamGroups.forEach((g,id)=>g.forEach(i=>quotientMap[i]=id));return {seamGroups,quotientMap};}
/**
 * All coordinates are actor-local metres. tapes are the live actual-skin
 * measurement API; their frame already removes actor translation/rotation.
 * tipAnchors may reuse the same live tape query (or a labelled diagnostic
 * snapshot). They choose a hinge angle only; no XYZ defines material rest.
 * The four main-to-G source seams are closed without averaging. Other seam
 * IDs remain pending and must be sewn gradually with metric/contact checks.
 */
export function createShortsGussetFoldSeed(draft,tapes,{tipAnchors=null,padM=.004}={}){
 const pieces=draft?.pieces,ranges=draft?.ranges,seams=draft?.seams;
 if(pieces?.length!==9||draft.positions?.length!==553*3||draft.sourceUV?.length!==553*2||draft.triangles?.length!==848*3||seams?.length!==19||tapes?.unit!=='m'||!Number.isFinite(padM)||padM<0)fail('HOLD_FOLD_SOURCE_CONTRACT',{});
 const byId=new Map(pieces.map(p=>[p.id,p])),byRange=new Map(ranges.map(r=>[r.pieceId,r])),g=byId.get('G'),half=g?.sourceContour?.width/2;
 if(!(half>0)||g.materialCoordinates.length!==9||g.triangles.length!==8)fail('HOLD_FOLD_G_SOURCE_DOMAIN',{});
 const sourceToken=draft.receipt?.measurementsAuthority?.bodyToken;
 if(sourceToken&&sourceToken!==tapes.bodyToken)fail('HOLD_FOLD_BODY_TOKEN',{sourceToken,actualToken:tapes.bodyToken});
 const tipY=draft.receipt?.initialG?.center?.[1];
 if(!tipAnchors){
  const query=(side,theta)=>{const section=tapes.guideSectionAtY(tipY,{side}),p=section.pointAtAngle(theta),radial=unit([p[0]-section.centerX,0,p[2]-section.centerZ],side+'.tip-ray');return p.map((v,k)=>v+padM*radial[k]);};
  tipAnchors={left:query('left',Math.PI/2),right:query('right',3*Math.PI/2),bodyToken:tapes.bodyToken,authority:'current tape same-side inner source ray at declared initial tipY plus radial authoring pad'};
 }
 if(tipAnchors.bodyToken!==tapes.bodyToken||!tipAnchors.authority||!['left','right'].every(k=>Array.isArray(tipAnchors[k])&&tipAnchors[k].length===3&&tipAnchors[k].every(Number.isFinite)))fail('HOLD_FOLD_TIP_AUTHORITY',{tipAnchors});
 const span=length(sub(tipAnchors.right,tipAnchors.left)),width=2*half;
 if(!(span>1e-8&&span<=width+1e-10))fail('HOLD_FOLD_TIP_SPAN',{spanM:span,sourceWidthM:width,reason:'hinging does not create material stretch; body guides may need adjustment, not a new rest'});
 const u=unit(sub(tipAnchors.right,tipAnchors.left),'actual-tip-axis');
 if(u[0]<=0)fail('HOLD_FOLD_SIDE_FRAME',{u,reason:'actual actor-local negative-X/positive-X tip order required'});
 const anteriorToPosterior=[0,0,-1],v=unit(anteriorToPosterior.map((x,k)=>x-dot(anteriorToPosterior,u)*u[k]),'source-front-back-frame'),n=cross(u,v);
 if(n[1]<=0)fail('HOLD_FOLD_UP_FRAME',{u,v,n});
 const beta=Math.acos(Math.min(1,span/width)),tipMid=mix(tipAnchors.left,tipAnchors.right,.5),origin=tipMid.map((x,k)=>x-half*Math.sin(beta)*n[k]),positions=new Float64Array(draft.positions.length),placements=[];
 const write=(id,p)=>positions.set(p,id*3),get=id=>Array.from(positions.subarray(id*3,id*3+3)),off=id=>byRange.get(id).offset;
 for(const triangle of g.triangles){const us=triangle.map(i=>g.materialCoordinates[i][0]);if(Math.min(...us)<-1e-12&&Math.max(...us)>1e-12)fail('HOLD_FOLD_TRIANGLE_CROSSES_CREASE',{triangle,us,reason:'source crease must already be a mesh edge; do not add disguised 3D rest'});}
 // Each triangle lies in a single source-u half plane. On either half this
 // map is a proper rigid embedding, hence F^T F=I exactly, including shear.
 for(let i=0;i<g.materialCoordinates.length;i++){const [a,b]=g.materialCoordinates[i];write(off('G')+i,origin.map((x,k)=>x+a*Math.cos(beta)*u[k]+Math.abs(a)*Math.sin(beta)*n[k]+b*v[k]));}
 placements.push({pieceId:'G',type:'two_source_half_plane_rigid_hinge',sourceCrease:'u=0, front-centre-back existing edges',betaRadians:beta,origin,u,v,n,sourceWidthM:width,actualTipSpanM:span,tipAuthority:tipAnchors.authority});
 const mainFrames=new Map();
 function rigidPiece(piece,sourceA,sourceB,targetA,targetB,worldInside,materialInside,label){
  const t2=unit(sub(sourceB,sourceA),label+'.source-edge'),candidate=[-t2[1],t2[0]],sign=dot(sub(materialInside,sourceA),candidate)>=0?1:-1,n2=candidate.map(x=>x*sign),f=planeFrame(sub(targetB,targetA),worldInside,label);
  const sourceLength=length(sub(sourceB,sourceA)),targetLength=length(sub(targetB,targetA));if(Math.abs(sourceLength-targetLength)>1e-9)fail('HOLD_FOLD_MATCHED_EDGE_LENGTH',{label,sourceLength,targetLength});
  piece.materialCoordinates.forEach((p,i)=>{const d=sub(p,sourceA),a=dot(d,t2),b=dot(d,n2);write(off(piece.id)+i,targetA.map((x,k)=>x+a*f.tangent[k]+b*f.inside[k]));});
  const frame={pieceId:piece.id,type:'whole_source_piece_proper_hinge_frame',sourceA,sourceB,t2,n2,targetA,targetB,...f};placements.push(frame);return frame;
 }
 const waist=tapes.waist?.lower;if(!waist||typeof waist.pointAtAngle!=='function')fail('HOLD_FOLD_ACTUAL_WAIST_GUIDE',{});
 for(const id of ['FL','FR','BL','BR']){
  const p=byId.get(id),s=seams.find(s=>s.id==='gusset-'+id),pairs=s?.pairs;if(!pairs||pairs.length!==3||s.a.pieceId!==id||s.b.pieceId!=='G')fail('HOLD_FOLD_G_SEAM',{id});
  const sourceA=p.materialCoordinates[pairs[0].a-off(id)],sourceB=p.materialCoordinates[pairs.at(-1).a-off(id)],targetA=get(pairs[0].b),targetB=get(pairs.at(-1).b),waistUV=p.boundaries.waist.map(i=>p.materialCoordinates[i]),meanUV=waistUV.reduce((a,p)=>a.map((x,k)=>x+p[k]/waistUV.length),[0,0]);
  const theta=p.side==='left'?(p.bodySide==='front'?-Math.PI/4:5*Math.PI/4):(p.bodySide==='front'?Math.PI/4:3*Math.PI/4),waistGuide=waist.pointAtAngle(theta),frame=rigidPiece(p,sourceA,sourceB,targetA,targetB,sub(waistGuide,mix(targetA,targetB,.5)),meanUV,id);mainFrames.set(id,frame);
  for(const pair of pairs)if(length(sub(get(pair.a),get(pair.b)))>1e-9)fail('HOLD_FOLD_G_INTERMEDIATE_PAIR',{id,pair});
 }
 // Contoured W lower paper is an arc, while a rigid main waist is straight.
 // Equal segment budgets do NOT make their whole-piece chord lengths equal.
 // Keep W independent and rigid in a parent-related holding frame; do not
 // scale its paper to force this still-pending waist seam to close.
 for(const p of pieces.filter(p=>p.kind==='waistband')){
  const s=seams.find(s=>s.id==='waist-'+p.parentPanel),pairs=s?.pairs;if(!pairs||s.b.pieceId!==p.id)fail('HOLD_FOLD_WAIST_SEAM',{piece:p.id});
  const first=pairs[0],last=pairs.at(-1),a=p.materialCoordinates[first.b-off(p.id)],b=p.materialCoordinates[last.b-off(p.id)],meanUV=p.materialCoordinates.reduce((m,q)=>m.map((v,k)=>v+q[k]/p.materialCoordinates.length),[0,0]),parent=mainFrames.get(p.parentPanel),parentStart=get(first.a),parentEnd=get(last.a),t=unit(sub(parentEnd,parentStart),p.id+'.parent-waist'),targetA=parentStart.map((v,k)=>v+.025*parent.normal[k]),targetB=targetA.map((v,k)=>v+length(sub(b,a))*t[k]);
  let guide=[0,1,0];if(length(guide.map((v,k)=>v-dot(guide,t)*t[k]))<1e-8)guide=parent.normal;
  rigidPiece(p,a,b,targetA,targetB,guide,meanUV,p.id);
 }
 const activeSeamIDs=['gusset-FL','gusset-FR','gusset-BL','gusset-BR'],active=new Set(activeSeamIDs),partial=quotient(553,seams,active),full=quotient(553,seams,new Set(seams.map(s=>s.id)));
 let maximumGSeamGapM=0;for(const s of seams)if(active.has(s.id))for(const p of s.pairs)maximumGSeamGapM=Math.max(maximumGSeamGapM,length(sub(get(p.a),get(p.b))));
 const remainderSeams=seams.filter(s=>!active.has(s.id)).map(s=>({id:s.id,maximumInitialGapM:Math.max(...s.pairs.map(p=>length(sub(get(p.a),get(p.b))))),active:false}));
 const seedReceipt={schema:'r008-source-gusset-rigid-fold-seed/v1',scope:'whole-source paper hinge INITIAL seed; four G source seams only, pending all other sewing, source metric relaxation and actual body/self contact',coordinateFrame:'actor-local metres, unit actor frame; caller uses tapes.frame for WORLD',bodyToken:tapes.bodyToken,source2DUsedForAllRest:true,sourceUVRestAreaMassChanged:false,sourceTriangleSubdivision:0,placements,activeSeamIDs,activeSourceDofs:partial.seamGroups.length,targetFullSourceDofs:full.seamGroups.length,maximumGSeamGapM,remainderSeams,allMaterialDofsFree:true,locksRetained:0,restFoldChanged:false,bendRestAuthority:'existing source bending law stays unchanged; beta is temporary placement, never a new dihedral rest',contactValidated:false,fullSourceSeamsValidated:false,visualAcceptance:false,motionValidated:false,productionReady:false};
 return {...draft,positions,activeSeamIDs,...partial,targetSourceSeamGroups:full.seamGroups,targetSourceQuotientMap:full.quotientMap,seedReceipt};
}
