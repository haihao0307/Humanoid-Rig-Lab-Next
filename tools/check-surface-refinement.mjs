// File contracts only. Parse generator code without importing or evaluating it.
export function checkSurfaceRefinementSources({read,parse,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Surface refinement file contract: '+message);checks++;};
 const mesher=read('reconstruction/mesher.mjs'),trim=read('reconstruction/trim-quality.mjs');
 const tree=parse(trim,{ecmaVersion:'latest',sourceType:'module'});
 check(tree.body.some(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='improveTrimQuality'),'trim quality has a named export');
 check(!tree.body.some(n=>n.type==='ImportDeclaration'),'trim optimization has no runtime dependencies');
 const writes=[];function visit(n){if(!n||typeof n!=='object')return;
  if(n.type==='AssignmentExpression')writes.push(trim.slice(n.left.start,n.left.end));
  for(const value of Object.values(n))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }visit(tree);
 check(!writes.some(s=>/^uv(?:\[|\.)|^[ABCD]\[/.test(s)),'optimizer cannot assign source UV coordinates');
 check(/pass<3/.test(trim)&&/changed\[e\.face\]\|\|changed\[e\.other\]/.test(trim),'fixed passes and one modification per face in each pass');
 check(/e\.count!==2/.test(trim)&&/occupied\.has\(edgeKey\(c,d\)\)/.test(trim),'only two-face edges with a new diagonal are eligible');
 check(/sign\*orient\(B,A,D\)<=epsilon/.test(trim)&&/sign\*orient\(C,D,B\)<=epsilon/.test(trim)&&/sign\*orient\(D,C,A\)<=epsilon/.test(trim),'old and new triangle pairs require strict convexity');
 check(/after<=before\+1e-10/.test(trim),'flips require improved minimum triangle quality');
 check(mesher.indexOf('faces=conformTrimFaces(uv,faces)')<mesher.indexOf('improveTrimQuality(uv,faces)'),'all trim knots restored before quality optimization');
 check(mesher.includes("repairSkin=name==='body'||name==='left'||name==='collar'")&&mesher.includes("if(name==='body'||name==='left'||name==='collar'||name==='detail'&&chart.c.semanticRegion==='head_face_ears'||name==='features'&&chart.c.semanticRegion==='FJ2811')stats.trimQualityFlips"),'diagonal optimization preserves body, leg and collar and adds only detail head skin and the visible pinna');
 check(/error=Math\.max\(centroidError,\.\.\.errors\)/.test(mesher)&&!/emit\(a,bb,centre/.test(mesher),'interior error is measured without repeated centroid fan refinement');
 check(mesher.includes("headChart=name==='detail'&&regionMask===bindingSchema.regions.head_face_ears")&&mesher.includes('heightChart=(repairSkin||headChart)&&orientation!==null')&&mesher.includes('useParameterEdge=heightChart||correctionActive&&orientation!==null')&&/edge=useParameterEdge\?longestParameterEdge\(vertices\.map\(v=>v\.uv\)\)/.test(mesher),'metre-valued body and head skin charts and eligible corrected charts bisect their longest parameter edge; radial semantics stay unchanged');
 check(/if\(!usableParameterTriangle\(a\.uv,bb\.uv,c\.uv\)\)/.test(mesher)&&/parameterSliversRejected/.test(mesher),'parameter degeneracy is rejected before probing descendants');
 check(/Math\.min\(settings\.normalAngleDegrees\|\|6,2\)/.test(mesher)&&/Math\.min\(maxEdge,\.012\)/.test(mesher)&&/shadeError>shadingAngle/.test(mesher),'height-chart skin uses a consistent bounded normal and edge target');
 check(/repairSkin&&worst>1\?edgeScores\.indexOf\(worst\):longestEdge/.test(mesher),'skin edge choice follows unresolved error with a longest-edge fallback');
 check(/topology\.split\(b\.vertex\(x\),b\.vertex\(y\),b\.vertex\(m\)\)/.test(mesher),'edge refinement still records shared subdivision');
 check(mesher.includes('refineGeometryNormal=(repairSkin||headChart)&&geometricNormalError>geometricLimit&&longest>')&&/\|\|refineGeometryNormal/.test(mesher),'existing skin including radial skin and new head skin retain face-to-field refinement with a minimum edge guard');
 check(mesher.includes("headDomains=name==='detail'?data.fields.domains.filter(c=>c.semanticRegion==='head_face_ears'):[]")&&mesher.includes("name==='detail'&&c.semanticRegion==='head_face_ears'?Math.floor(chartBudget/surface.domainIds.length)")&&mesher.includes('allocateChartRefinementBudget(headDomains,headBaseBudget)'),'head area allocation redistributes only its existing uniform base quota');
 check(mesher.includes('if(headBudgets.has(data.fields.domains[di].id))domainSplitBudget=headBudgets.get(data.fields.domains[di].id)+unusedHeadBudget')&&mesher.includes('if(headBudgets.has(chart.c.id))unusedHeadBudget=domainSplitBudget-domainSplits'),'head quota is carried only between head charts without changing non-head allocations');
 check(mesher.includes("*(name==='detail'?.30:1)")&&mesher.includes('surface.domainIds.length?1:0):0),0)*.70)')&&mesher.includes("(quality==='preview'?1400:quality==='close'?4000:2400)*.70"),'source-head and ear quotas reserve final-conformity headroom while facial features retain their original quota');
 check(/unusedChartBudget=repairSkin\?domainSplitBudget-domainSplits:0/.test(mesher)&&/stats\.adaptiveSplits>refinementBudget/.test(mesher),'unused skin quota is carried forward and total work is guarded');
 check(/depth<20/.test(mesher)&&/stats\.refinementLimitCount\+\+/.test(mesher),'depth cap and unresolved-error reporting remain');
 return {checks,applicationExecuted:false,geometryGenerated:false,visualAcceptance:false};
}
