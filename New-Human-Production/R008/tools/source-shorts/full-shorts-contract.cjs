/* Independent read-only full-short audit. No positions, paper, solver or render
 * source are produced here. Counts come from the actual declared seam graph. */
const fs=require('fs');
const PANELS=['FL','FR','BL','BR','G','WFL','WFR','WBR','WBL'];
const SEAMS=['center-front','center-back','gusset-FL','gusset-FR','gusset-BL','gusset-BR','inseam-left','inseam-right','outseam-left','outseam-right','side-opening-left','waist-FL','waist-FR','waist-BR','waist-BL','waistband-FL-FR','waistband-FR-BR','waistband-BR-BL','waistband-BL-FL'];
function auditTopology(pattern,closedIds=SEAMS){
 const offset=new Map();let count=0;for(const piece of pattern.pieces){offset.set(piece.id,count);count+=piece.materialCoordinates.length;}
 const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 for(const seam of pattern.seams)if(closedIds.includes(seam.id))for(const pair of seam.pairs)parent[find(offset.get(seam.b.pieceId)+pair.b)]=find(offset.get(seam.a.pieceId)+pair.a);
 const edges=new Map(),vertices=new Set(),triangles=[];let collapsed=0;
 for(const piece of pattern.pieces)for(const triangle of piece.triangles){const ids=triangle.map(i=>find(offset.get(piece.id)+i));if(new Set(ids).size!==3)collapsed++;triangles.push(ids);ids.forEach(i=>vertices.add(i));for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');if(!edges.has(key))edges.set(key,{a,b,incidence:0});edges.get(key).incidence++;}}
 const boundary=new Map();let nonManifoldEdges=0;for(const edge of edges.values()){if(edge.incidence>2)nonManifoldEdges++;if(edge.incidence===1){if(!boundary.has(edge.a))boundary.set(edge.a,[]);if(!boundary.has(edge.b))boundary.set(edge.b,[]);boundary.get(edge.a).push(edge.b);boundary.get(edge.b).push(edge.a);}}
 const visited=new Set(),loops=[];for(const vertex of boundary.keys())if(!visited.has(vertex)){const queue=[vertex],members=[];visited.add(vertex);while(queue.length){const current=queue.pop();members.push(current);for(const next of boundary.get(current))if(!visited.has(next)){visited.add(next);queue.push(next);}}loops.push(members);}
 const allAdjacency=new Map();for(const edge of edges.values()){if(!allAdjacency.has(edge.a))allAdjacency.set(edge.a,[]);if(!allAdjacency.has(edge.b))allAdjacency.set(edge.b,[]);allAdjacency.get(edge.a).push(edge.b);allAdjacency.get(edge.b).push(edge.a);}
 const seen=new Set();let connectedComponents=0;for(const vertex of vertices)if(!seen.has(vertex)){connectedComponents++;const stack=[vertex];seen.add(vertex);while(stack.length)for(const next of allAdjacency.get(stack.pop())||[])if(!seen.has(next)){seen.add(next);stack.push(next);}}
 const eulerCharacteristic=vertices.size-edges.size+triangles.length,boundaryDegreeTwo=[...boundary.values()].every(x=>x.length===2);
 let unexpectedOpenSeamEdges=0;for(const piece of pattern.pieces)for(const [name,list] of Object.entries(piece.boundaries)){if(piece.kind==='leg-panel'&&name==='hem'||piece.kind==='waistband'&&name==='upper')continue;for(let i=1;i<list.length;i++){const key=[find(offset.get(piece.id)+list[i-1]),find(offset.get(piece.id)+list[i])].sort((a,b)=>a-b).join(':');if(edges.get(key)?.incidence===1)unexpectedOpenSeamEdges++;}}
 return {closedIds:[...closedIds],sourceVertices:count,quotientVertices:vertices.size,faces:triangles.length,edges:edges.size,eulerCharacteristic,boundaryLoops:loops.length,boundaryLoopVertexCounts:loops.map(x=>x.length),boundaryDegreeTwo,connectedComponents,nonManifoldEdges,collapsedFaces:collapsed,unexpectedOpenSeamEdges,valid:connectedComponents===1&&eulerCharacteristic===-1&&loops.length===3&&boundaryDegreeTwo&&nonManifoldEdges===0&&collapsed===0&&unexpectedOpenSeamEdges===0};
}
function auditSource(pattern){
 const problems=[],ids=pattern.pieces.map(p=>p.id),seams=pattern.seams.map(s=>s.id);
 if(pattern.unit!=='m')problems.push('pattern unit must be m');if(ids.length!==9||new Set(ids).size!==9||PANELS.some(id=>!ids.includes(id)))problems.push('exact original nine material roles required');
 if(seams.length!==19||new Set(seams).size!==19||SEAMS.some(id=>!seams.includes(id)))problems.push('all 19 original seam identities required');
 const byId=new Map(pattern.pieces.map(p=>[p.id,p]));let maximumFeedError=0;
 for(const seam of pattern.seams){const a=byId.get(seam.a.pieceId),b=byId.get(seam.b.pieceId);if(!a||!b){problems.push(seam.id+': missing panel');continue;}for(let i=1;i<seam.pairs.length;i++){const previous=seam.pairs[i-1],pair=seam.pairs[i],length=(piece,x,y)=>Math.hypot(...piece.materialCoordinates[x].map((v,k)=>v-piece.materialCoordinates[y][k])),la=length(a,previous.a,pair.a),lb=length(b,previous.b,pair.b);const error=Math.abs(la/lb-1);maximumFeedError=Math.max(maximumFeedError,error);if(!(la>0&&lb>0)||error>1e-8)problems.push(seam.id+': unmatched source segment feed');if(pair.t<=previous.t)problems.push(seam.id+': unordered stitch notches');}}
 const topology=auditTopology(pattern);if(!topology.valid)problems.push('full source quotient is not one waist and two cuff loops');
 return {valid:!problems.length,problems,seamCount:seams.length,panelCount:ids.length,maximumFeedError,topology};
}
function auditPhysicalSeams(pattern,particles,seamState,dofGroups,tolerance=.0001){
 const problems=[],offset=new Map();let count=0;for(const piece of pattern.pieces){offset.set(piece.id,count);count+=piece.materialCoordinates.length;}
 const parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 if(!Array.isArray(dofGroups)){return {valid:false,problems:['actual completed stitch DOF groups required']};}for(const group of dofGroups)for(const i of group.members)parent[find(i)]=find(group.members[0]);
 const state=new Map((seamState||[]).map(s=>[s.id,s]));let maximumGapM=0;
 for(const seam of pattern.seams){const actual=state.get(seam.id);if(!actual||actual.progress!==1||actual.pairs?.length!==seam.pairs.length){problems.push(seam.id+': not actually completed');continue;}for(let i=0;i<seam.pairs.length;i++){const pair=seam.pairs[i],a=offset.get(seam.a.pieceId)+pair.a,b=offset.get(seam.b.pieceId)+pair.b;if(!actual.pairs[i].started||actual.pairs[i].a!==a||actual.pairs[i].b!==b||find(a)!==find(b))problems.push(seam.id+': missing actual original stitch equality');const gap=Math.hypot(...particles[a].pos.map((v,k)=>v-particles[b].pos[k]));maximumGapM=Math.max(maximumGapM,gap);if(gap>tolerance)problems.push(seam.id+': physical gap exceeds original 0.1 mm tolerance');}}
 const expected=Array.from({length:count},(_,i)=>i),expectedFind=i=>expected[i]===i?i:(expected[i]=expectedFind(expected[i]));for(const seam of pattern.seams)for(const pair of seam.pairs)expected[expectedFind(offset.get(seam.b.pieceId)+pair.b)]=expectedFind(offset.get(seam.a.pieceId)+pair.a);
 let exactExpectedDofs=true,unexpectedPair=null;for(let a=0;a<count&&exactExpectedDofs;a++)for(let b=a+1;b<count;b++)if((find(a)===find(b))!==(expectedFind(a)===expectedFind(b))){exactExpectedDofs=false;unexpectedPair=[a,b];break;}
 if(!exactExpectedDofs)problems.push('actual DOF quotient differs from exactly the 19 declared source stitches');
 return {valid:!problems.length,problems,maximumGapM,toleranceM:tolerance,exactExpectedDofs,unexpectedPair};
}
module.exports={PANELS,SEAMS,auditTopology,auditSource,auditPhysicalSeams};
if(require.main===module){const input=JSON.parse(fs.readFileSync(process.argv[2]));const pattern=input.pattern||input;console.log(JSON.stringify(auditSource(pattern),null,2));}
