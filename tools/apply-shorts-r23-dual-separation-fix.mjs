// Keep the two independently formed tubes spatially disjoint while their
// centre rises and gusset edges are still open. This is a row-wise rigid
// translation in the pelvis frame: it does not edit paper UVs, triangles,
// material mass, seam ownership or the Human rig. Idempotent workflow patch.
import fs from 'node:fs';
const path='clothing/ShortsDualTubeR2.js';
let text=fs.readFileSync(path,'utf8');
if(text.includes('minimumInterlegGapM=options.minimumInterlegGapM')){
  console.log('R2.3b open-rise separation is already canonical.');
  process.exit(0);
}
const replaceOnce=(from,to,label)=>{
  const first=text.indexOf(from),last=text.lastIndexOf(from);
  if(first<0||first!==last)throw Error('Ambiguous R2.3b separation anchor: '+label);
  text=text.replace(from,to);
};
replaceOnce("const SHORTS_DUAL_TUBE_R23_VERSION='shorts-r2.3-dual-tube-authoring-1';","const SHORTS_DUAL_TUBE_R23_VERSION='shorts-r2.3-dual-tube-authoring-2';",'version');
const anchor="    tubeReports[config.side]={side:config.side,panelIds:[config.frontId,config.backId],centreLocal,outerStartRow,innerStartRow,rowReports};\n  }\n";
const addition=`    tubeReports[config.side]={side:config.side,panelIds:[config.frontId,config.backId],centreLocal,outerStartRow,innerStartRow,rowReports};
  }
  // Above the crotch the centre rises are still open. A pair of full oval
  // envelopes can therefore overlap even though each source seam is correct.
  // Translate complete material rows (front and back together) just enough to
  // leave a measurable sagittal gap. The same row translation on both panels
  // preserves every already-coincident inner/outseam endpoint.
  const minimumInterlegGapM=options.minimumInterlegGapM??.012;
  if(!Number.isFinite(minimumInterlegGapM)||minimumInterlegGapM<.004||minimumInterlegGapM>.04)fail('invalid interleg authoring clearance');
  const leftFront=pieces.get('FL'),leftBack=pieces.get('BL'),rightFront=pieces.get('FR'),rightBack=pieces.get('BR');
  const columns=leftFront.grid.columns,rows=leftFront.grid.rows,stride=columns+1,index=(row,column)=>row*stride+column;
  const separationReports=[];
  for(let row=0;row<=rows;row++){
    const leftPoints=[],rightPoints=[];
    for(const id of ['FL','BL'])for(let column=0;column<=columns;column++)leftPoints.push(positionsByPiece.get(id)[index(row,column)]);
    for(const id of ['FR','BR'])for(let column=0;column<=columns;column++)rightPoints.push(positionsByPiece.get(id)[index(row,column)]);
    const leftMaximumBefore=Math.max(...leftPoints.map(point=>local(point)[0])),rightMinimumBefore=Math.min(...rightPoints.map(point=>local(point)[0]));
    const gapBeforeM=rightMinimumBefore-leftMaximumBefore,sideShiftM=Math.max(0,(minimumInterlegGapM-gapBeforeM)/2);
    if(sideShiftM>0){
      for(const id of ['FL','BL'])for(let column=0;column<=columns;column++){
        const i=index(row,column),coordinate=local(positionsByPiece.get(id)[i]);coordinate[0]-=sideShiftM;positionsByPiece.get(id)[i]=world(coordinate);
      }
      for(const id of ['FR','BR'])for(let column=0;column<=columns;column++){
        const i=index(row,column),coordinate=local(positionsByPiece.get(id)[i]);coordinate[0]+=sideShiftM;positionsByPiece.get(id)[i]=world(coordinate);
      }
    }
    separationReports.push({row,gapBeforeM,sideShiftM,gapAfterM:gapBeforeM+2*sideShiftM});
  }
`;
replaceOnce(anchor,addition,'row separation');
replaceOnce('bodyFrame:frame,transverseToDepthRatio:aspect,tubeReports,','bodyFrame:frame,transverseToDepthRatio:aspect,minimumInterlegGapM,separationReports,tubeReports,','separation report');
fs.writeFileSync(path,text);
console.log('Applied R2.3b open-rise separation without changing source paper.');
