'use strict';
// Reconstruct only canonical 2D cut from saved actual measured scalars. No body or solver.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{paperAudit}=require('./shorts-paper-audit.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'qa/shorts-v2-independent-manufacturing-20261002');
const report=JSON.parse(fs.readFileSync(process.argv[2]||path.join(root,'qa/shorts-coupled-staged-sewing-probe-20261002.json'),'utf8'));
const fixture=report.draftReceipt;if(!fixture||!report.manufacturedPositions)throw Error('Run the current source sewing probe first; a complete matching receipt and actual coordinates are required');
const original=fs.readFileSync(path.resolve(root,'tools/source-shorts/ShortsPattern.js'),'utf8');
const cut=o=>vm.runInNewContext(original+'\ncreateShortsPattern(m,o)',{m:fixture.measurements,o});
const pattern=cut(fixture.design),old=cut({...fixture.design,gussetWidth:.014111657663304345});
const uv=[],triangles=[],mass=Array(553).fill(0),offsets={};let offset=0;
for(const p of pattern.pieces){offsets[p.id]=offset;uv.push(...p.materialCoordinates.flat());for(const t of p.triangles){triangles.push(...t.map(i=>offset+i));const[a,b,c]=t.map(i=>p.materialCoordinates[i]);const aM2=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;for(const i of t)mass[offset+i]+=aM2*.22/3;}offset+=p.materialCoordinates.length;}
const seams=pattern.seams.map(s=>({...s,pairs:s.pairs.map(p=>({a:offsets[s.a.pieceId]+p.a,b:offsets[s.b.pieceId]+p.b,t:p.t}))}));
const digest=p=>crypto.createHash('sha256').update(JSON.stringify(p.pieces.map(piece=>({id:piece.id,uv:piece.materialCoordinates,triangles:piece.triangles,boundaries:piece.boundaries})))).digest('hex');
const canonicalSHA=crypto.createHash('sha256').update(original).digest('hex');
const d={uv,triangles,mass,seams,pieces:pattern.pieces,receipt:fixture},audit=paperAudit(d,report.manufacturedPositions);
const unchangedOtherPieces=pattern.pieces.filter(p=>p.id!=='G').every(p=>JSON.stringify(p)===JSON.stringify(old.pieces.find(q=>q.id===p.id)));
const pairAuthority=p=>p.seams.map(s=>({id:s.id,a:s.a,b:s.b,pairs:s.pairs,feed:s.feed,feedRatio:s.feedRatio}));
const pairsUnchanged=JSON.stringify(pairAuthority(pattern))===JSON.stringify(pairAuthority(old));
const maximumDerivedSeamLengthDifferenceM=Math.max(...pattern.seams.map((s,i)=>Math.abs(s.restLengthB-old.seams[i].restLengthB)));
const r={createdAt:new Date().toISOString(),scope:'exact manufacturing paper reconstructed from recorded actual scalar measurements via untouched canonical 2D source; no body, placement or solver run',canonicalSHA,sourcePaperSHA256:digest(pattern),priorPaperSHA256:digest(old),unchangedOtherEightPieces:unchangedOtherPieces,all19SourcePairsAndFeedUnchanged:pairsUnchanged,maximumDerivedSeamLengthDifferenceM,audit,valid:audit.valid&&unchangedOtherPieces&&pairsUnchanged&&maximumDerivedSeamLengthDifferenceM<=1e-12&&canonicalSHA===fixture.paperSource.sha256&&digest(pattern)===report.sourcePaperSHA256&&report.manufacturingMaterialPassed===true,bodyFitAccepted:false,selfContactAccepted:false,elasticAccepted:false,motionAccepted:false,publicPromotionAllowed:false};
fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'EXACT_SOURCE_PAPER_QA.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({valid:r.valid,sourcePaperSHA256:r.sourcePaperSHA256,maximumStrain:audit.maximumPrincipalStrain,areaM2:audit.areaM2,massKg:audit.massKg,gussetWidthM:audit.gussetWidthM,seamGapM:audit.maximumSourcePairGapM,unchangedOtherPieces,pairsUnchanged}));
