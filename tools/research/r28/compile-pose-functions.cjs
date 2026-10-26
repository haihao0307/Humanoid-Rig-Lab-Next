'use strict';
// OFFLINE compiler. Original samples and connectivity are reference inputs only.
// Emits affine moment functions over trimmed material charts, never point or face
// tables. Source facet partitions remain: this is not the autonomous mother.
const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),crypto=require('crypto');
const H=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const f of ['BodyMathR01','BodyShapeR01'])vm.runInThisContext(fs.readFileSync('src/'+f+'.js','utf8'));
const source=require('../../program-r17.cjs')(),shape=createBodyShapeR01(source.anny),reference=JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/original.json'));
const profiles=JSON.parse(fs.readFileSync('data/body-source-atlas-r24.json')).profiles;
const neck=JSON.parse(fs.readFileSync('data/body-neck-operator-r24.json')).operator;
const selected=(process.env.BODY_FUNCTION_PROFILES_R28||'baseline,lean,fuller,muscular,female,calibration-soft').split(',');
const provenance={referenceSHA256:source.referenceSHA256,sourceProgramSHA256:H(fs.readFileSync('data/body-function-program-r17.json')),neckOperatorSHA256:neck.sourceOperatorSHA256,sourceFacetPartitionInformationRetained:true,completedMotherConversion:false,sourceFidelityAccepted:false,acceptanceTolerance:null};
const output={schema:'body-pose-moment-functions-r28/1',...provenance,profiles:[]};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function affine(uv,values){const [[x0,y0],[x1,y1],[x2,y2]]=uv,det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(!det)throw Error('Singular original chart');const a=((values[1]-values[0])*(y2-y0)-(values[2]-values[0])*(y1-y0))/det,b=((x1-x0)*(values[2]-values[0])-(x2-x0)*(values[1]-values[0]))/det;return[a,b,values[0]-a*x0-b*y0];}
function combine(rows,terms){const out=new Map;for(const [row,w]of terms)for(const[j,a]of row||[]) {let b=out.get(j);if(!b)out.set(j,b=[0,0,0,0]);for(let k=0;k<4;k++)b[k]+=w*a[k];}return out;}
function neckMoments(body){const rows=body.concat(neck.headIds.map(()=>new Map));const deltas=new Map;for(const r of neck.contour.ring)deltas.set(r.index,combine(null,[[rows[r.a],1-r.t],[rows[r.b],r.t],[rows[r.index],-1]]));for(const r of neck.contour.links)rows[r.index]=combine(null,[[rows[r.index],1],[deltas.get(r.a),r.w*(1-r.t)],[deltas.get(r.b),r.w*r.t]]);for(const step of neck.fairing.steps){const next=rows.slice();for(const index of step.rows){const r=neck.fairing.stencils[index],w=step.step*r.weight;next[r.index]=combine(null,[[rows[r.index],1-w],...r.neighbors.map(j=>[rows[j],w/r.neighbors.length])]);}for(let i=0;i<rows.length;i++)rows[i]=next[i];}const boundary=neck.surface.boundary.map(i=>rows[i]);for(const r of neck.surface.rows)rows[r.index]=combine(null,boundary.map((row,i)=>[row,r.weights[i]]));return rows;}
function compileNormalPolynomials(id,allMoments,functions,boneCount){
 const file='qa/fidelity-r28/offline/native-'+id+'-neutral.json',native=JSON.parse(fs.readFileSync(file)),support=native.normalSupport;
 if(!support)throw Error('Native normal support missing '+id);const p=support.positionsYUp,body=source.bodyCount,variableCount=boneCount*4+3,constantStart=boneCount*4,rows=Array.from({length:body},()=>new Map),raw=new Float32Array(body*3),supportIndex=new Map(neck.ids.map((id,i)=>[id,i]));
 function edge(a,b){const out=new Map,ra=allMoments[supportIndex.get(a)]||new Map,rb=allMoments[supportIndex.get(b)]||new Map;for(const j of new Set([...ra.keys(),...rb.keys()]))for(let q=0;q<4;q++){const value=(rb.get(j)?.[q]||0)-(ra.get(j)?.[q]||0);if(value!==0)out.set(j*4+q,value);}for(let q=0;q<3;q++){const value=p[b*3+q]-p[a*3+q];if(value!==0)out.set(constantStart+q,value);}return out;}
 for(let at=0;at<support.faces.length;at+=3){const [a,b,c]=support.faces.slice(at,at+3),targets=[a,b,c].filter(i=>i<body);if(!targets.length)continue;const e1=edge(a,b),e2=edge(a,c),keys=[...new Set([...e1.keys(),...e2.keys()])].sort((a,b)=>a-b),area=cross([p[b*3]-p[a*3],p[b*3+1]-p[a*3+1],p[b*3+2]-p[a*3+2]],[p[c*3]-p[a*3],p[c*3+1]-p[a*3+1],p[c*3+2]-p[a*3+2]]);
  for(const i of targets)for(let q=0;q<3;q++)raw[i*3+q]+=area[q];
  for(let x=0;x<keys.length;x++)for(let y=x+1;y<keys.length;y++){const a=keys[x],b=keys[y];if(a>=constantStart)continue;const value=(e1.get(a)||0)*(e2.get(b)||0)-(e1.get(b)||0)*(e2.get(a)||0);if(value===0)continue;const key=a*variableCount+b;for(const i of targets)rows[i].set(key,(rows[i].get(key)||0)+value);}
 }
 const expressions=[],index=new Map,originalToExpression=[];let terms=0;
 for(let i=0;i<body;i++){const magnitude=Math.hypot(raw[i*3],raw[i*3+1],raw[i*3+2]),constant=native.normalsYUp.slice(i*3,i*3+3).map(x=>x*magnitude),entries=[...rows[i]].filter(([,v])=>v!==0).sort((a,b)=>a[0]-b[0]),pairs=entries.map(([k])=>k),coefficients=entries.map(([,v])=>v),expression={constant,pairs,coefficients},key=H(Buffer.from(JSON.stringify(expression)));if(!index.has(key)){index.set(key,expressions.length);expressions.push(expression);terms+=pairs.length;}originalToExpression.push(index.get(key));}
 const refs=[],blend=[];for(const f of functions){for(let j=0;j<3;j++){refs.push(originalToExpression[f.ids[j]]);blend.push(...affine(f.uv,[0,1,2].map(k=>j===k?1:0)));}}
 return{schema:'source-normal-area-response-polynomials-r28/1',normalProvenanceSHA256:H(fs.readFileSync(file)),sourceNormalExpressionSupportRetained:true,sourceIncidentFaceConnectivityEmitted:false,originalBodyPointIdsEmitted:false,sourceAveragedNormalsImplemented:false,sourceFloat32AccumulationOrderPreserved:false,originalPostNormalOperatorCertified:false,constantStart,variableCount,expressions,refs,blend,terms,method:'Offline exterior-product coefficients aggregate original incident area responses into polynomials of joint-matrix columns. Baseline directions are observed native normals; normalization and interpolation remain function expressions. Source intermediate rounding and any additional native normal processing remain unaccepted.'};
}
module.exports={source,shape,reference,profiles,neck,affine,neckMoments,compileNormalPolynomials,cross,provenance};
if(require.main!==module)return;
for(const id of selected){
 const profile=profiles.find(p=>p.id===id);if(!profile||profile.state.owners.rig!=='anny')throw Error('Only fixed Anny shape/head templates are compiled');
 const file=(id==='calibration-soft'?'qa/fidelity-r24/offline/':'qa/fidelity-r21/offline/')+'case-'+id+'.json',original=JSON.parse(fs.readFileSync(file));
 const state=structuredClone(profile.state);state.anny.pose={};state.anny.translations={};
 const rest=shape.forward({phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges}),a=source.anny.arrays,raw=[];
 for(const [left,right,t]of source.canonical.annyRecipes){const row=new Map;for(const [point,amount]of [[left,1-t],[right,t]]){if(amount===0)continue;for(let k=0;k<source.anny.influences;k++){const at=point*source.anny.influences+k,w=amount*a.vertex_bone_weights[at];if(w===0)continue;const joint=a.vertex_bone_indices[at];let q=row.get(joint);if(!q)row.set(joint,q=[0,0,0,0]);for(let c=0;c<3;c++)q[c]+=w*rest.restVertices[point*3+c];q[3]+=w;}}raw.push(row);}
 // The original contour/fairing/harmonic maps are linear in positions. Apply
 // them to moment FUNCTIONS offline. Intermediate Float32 writes are not
 // preserved by this algebraic expansion; the resulting error must be audited.
 const allMoments=neckMoments(raw),moments=allMoments.slice(0,source.bodyCount),functions=[],flat=[],offsets=[0],joints=[],domains=[],rects=[],base=[],normal=[],axes=[],winding=[];
 const p=original.positionsYUp,n=original.normalsYUp;
 for(let at=0;at<reference.faces.length;at+=3){const ids=reference.faces.slice(at,at+3),points=ids.map(i=>p.slice(i*3,i*3+3)),du=points[1].map((v,k)=>v-points[0][k]),dv=points[2].map((v,k)=>v-points[0][k]),gn=cross(du,dv);if(Math.hypot(...gn)===0)continue;let axis=0;for(let k=1;k<3;k++)if(Math.abs(gn[k])>Math.abs(gn[axis]))axis=k;const u=(axis+1)%3,v=(axis+2)%3,uv=points.map(q=>[q[u],q[v]]),sign=gn[axis]>0?1:-1;
  for(let k=0;k<3;k++){base.push(...affine(uv,points.map(q=>q[k])));normal.push(...affine(uv,ids.map(i=>n[i*3+k])));}
  for(let e=0;e<3;e++){const a=uv[e],b=uv[(e+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);domains.push(-sign*dy/length,sign*dx/length,sign*(dy*a[0]-dx*a[1])/length);}
  rects.push(Math.min(...uv.map(q=>q[0])),Math.max(...uv.map(q=>q[0])),Math.min(...uv.map(q=>q[1])),Math.max(...uv.map(q=>q[1])));axes.push(axis);winding.push(sign);
  const active=[...new Set(ids.flatMap(i=>[...moments[i].keys()]))].sort((a,b)=>a-b);
  for(const j of active){const coefficients=[];for(let k=0;k<4;k++)coefficients.push(...affine(uv,ids.map(i=>moments[i].get(j)?.[k]||0)));if(coefficients.every(v=>v===0))continue;joints.push(j);flat.push(...coefficients);}
  offsets.push(joints.length);functions.push({offlineFace:at/3,ids,uv});
 }
 const bind=BodyMathR01.matrices(rest.restBonePoses,source.anny.boneCount),baseTransforms=BodyMathR01.matrices(rest.boneTransforms,source.anny.boneCount);
 const rig={labels:source.anny.boneLabels,parents:Array.from(source.anny.boneParents),order:Array.from(source.anny.boneOrder),bind,referenceOrientations:Array.from(a.reference_bone_orientations),baseTransforms,parameterization:source.anny.metadata.pose_parameterization||'local-ref'};
 const blocked=new Set;for(let j=98;j<source.anny.boneCount;j++){let b=j;while(b>=0){blocked.add(b);b=rig.parents[b];}}
 const program={schema:'body-pose-moment-functions-r28/1',id,label:profile.label,state,rig,allowedJoints:rig.labels.filter((_,i)=>!blocked.has(i)),base,normal,domains,rects,axes,winding,offsets,joints,moments:flat,bounds:profile.bounds,functions:functions.length,...provenance,semantics:'S(u,v;pose)=S_reference(u,v)+sum_j (M_j(pose)-M_j(reference))*Q_j(u,v); source neck linear operators applied offline to Q. Source intermediate Float32 rounding and source averaged normals are NOT certified.'};
 if(process.env.BODY_FUNCTION_NORMALS_R28!=='0')program.normalPolynomials=compileNormalPolynomials(id,allMoments,functions,source.anny.boneCount);
 // Preserve the compiled function coefficients as Float64 bits. This is not
 // a point/face table: the payload contains affine function and matrix-response
 // polynomial coefficients and their explicit source partition provenance.
 for(const key of ['base','normal','domains','rects','moments'])program[key]=Float64Array.from(program[key]);program.offsets=Uint32Array.from(program.offsets);program.joints=Uint16Array.from(program.joints);program.axes=Uint8Array.from(program.axes);program.winding=Int8Array.from(program.winding);
 if(program.normalPolynomials){const n=program.normalPolynomials,offsets=[0],pairs=[],values=[],constants=[];for(const e of n.expressions){constants.push(...e.constant);for(let i=0;i<e.pairs.length;i++){pairs.push(e.pairs[i]);values.push(e.coefficients[i]);}offsets.push(pairs.length);}delete n.expressions;n.expressionOffsets=Uint32Array.from(offsets);n.constants=Float64Array.from(constants);n.pairs=Uint32Array.from(pairs);n.coefficients=Float64Array.from(values);n.refs=Uint16Array.from(n.refs);n.blend=Float64Array.from(n.blend);}
 const encoded=require('../../body-packet-codec-r27.cjs')(program),bytes=encoded.raw,compressed=encoded.compressed,sha=encoded.compressedSHA256,asset='delivery/assets/body-functions-r28/'+sha+'.gz';fs.writeFileSync(asset,compressed);output.profiles.push({id,label:program.label,encoding:'gzip-typed-function-packet-r28',file:asset,url:'assets/body-functions-r28/'+sha+'.gz',rawBytes:bytes.length,rawSHA256:H(bytes),compressedBytes:compressed.length,compressedSHA256:sha,functions:program.functions,jointMomentFunctions:joints.length,normalPolynomialTerms:program.normalPolynomials?.terms||0,sourceCaseSHA256:H(fs.readFileSync(file))});
 fs.writeFileSync('qa/fidelity-r28/offline/functions-'+id+'-evidence.json',JSON.stringify(functions));console.log(JSON.stringify({id,functions:program.functions,moments:joints.length,compressedBytes:compressed.length}));
}
fs.writeFileSync('data/body-pose-functions-r28.json',JSON.stringify(output,null,2)+'\n');
