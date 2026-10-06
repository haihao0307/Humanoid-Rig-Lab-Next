// R008-specific authored shape supports in metres, not measured internal anatomy.
// Persist only region recipes; sampled positions, weights and gradients are runtime caches.
const pairs=[
 ['foreheadInner','额头内侧','额眉',[.023,1.700,.108],[.040,.029,.052]],
 ['foreheadOuter','额头外侧','额眉',[.056,1.695,.089],[.039,.033,.055]],
 ['temple','太阳穴','额眉',[.072,1.667,.064],[.033,.043,.065]],
 ['browInner','眉头','额眉',[.020,1.673,.114],[.022,.018,.038]],
 ['browOuter','眉尾','额眉',[.052,1.671,.101],[.025,.020,.041]],
 ['orbitUpper','上眼眶','眼周',[.035,1.671,.107],[.031,.018,.040]],
 ['orbitLower','眶下过渡','眼周',[.037,1.639,.104],[.032,.020,.041]],
 ['lidUpper','上眼睑','眼周',[.034,1.660,.105],[.028,.009,.029],true],
 ['lidLower','下眼睑','眼周',[.034,1.651,.104],[.029,.009,.029],true],
 ['canthusInner','内眼角','眼周',[.019,1.655,.110],[.010,.010,.027],true],
 ['canthusOuter','外眼角','眼周',[.050,1.655,.097],[.012,.011,.028],true],
 ['cheekbone','颧骨隆起','颧颊',[.054,1.636,.091],[.035,.028,.054]],
 ['cheekInner','内侧面颊','颧颊',[.034,1.613,.108],[.030,.030,.047]],
 ['cheekOuter','外侧面颊','颧颊',[.066,1.613,.066],[.040,.040,.067]],
 ['nasolabial','鼻唇沟','颧颊',[.029,1.607,.113],[.019,.026,.038]],
 ['noseSide','鼻侧壁','鼻部',[.015,1.635,.130],[.018,.026,.037]],
 ['noseWing','鼻翼','鼻部',[.018,1.617,.126],[.017,.015,.035]],
 ['upperLipSide','上唇侧部','口周',[.014,1.593,.119],[.019,.010,.030]],
 ['lowerLipSide','下唇侧部','口周',[.014,1.581,.116],[.020,.011,.031]],
 ['mouthCorner','口角','口周',[.026,1.586,.103],[.018,.017,.036]],
 ['jawAngle','下颌角','下颌',[.066,1.563,.049],[.042,.033,.078]],
 ['jawLine','下颌缘','下颌',[.043,1.553,.081],[.034,.025,.057]],
 ['chinSide','下巴侧部','下颌',[.025,1.555,.101],[.025,.022,.038]],
];
const central=[
 ['foreheadCentre','额头中央','额眉',[0,1.703,.111],[.025,.029,.049]],
 ['glabella','眉间','额眉',[0,1.674,.122],[.017,.020,.034]],
 ['noseRoot','鼻根','鼻部',[0,1.659,.131],[.014,.020,.035]],
 ['noseBridge','鼻梁','鼻部',[0,1.641,.141],[.014,.025,.037]],
 ['noseTip','鼻尖','鼻部',[0,1.624,.153],[.017,.017,.032]],
 ['columella','鼻小柱','鼻部',[0,1.612,.139],[.011,.013,.030]],
 ['philtrum','人中','口周',[0,1.602,.120],[.013,.012,.029]],
 ['upperLipCentre','上唇中央 / 唇峰','口周',[0,1.594,.124],[.012,.009,.027]],
 ['lowerLipCentre','下唇中央','口周',[0,1.581,.121],[.014,.010,.029]],
 ['chinFold','颏唇沟','下颌',[0,1.568,.115],[.020,.010,.033]],
 ['chinCentre','下巴中央','下颌',[0,1.551,.109],[.026,.023,.042]],
];
export const SHAPE_REGIONS=pairs.flatMap(([key,label,group,centre,radii,locked=false])=>[1,-1].map(sign=>({id:key+(sign===1?'Left':'Right'),label:(sign===1?'左':'右')+' · '+label,group,centre:[sign*centre[0],centre[1],centre[2]],radii,sign,locked}))).concat(central.map(([id,label,group,centre,radii])=>({id,label:'中央 · '+label,group,centre,radii,sign:1,locked:false})));
const SCHEMA='human-r008/face-shape@1',SOURCE='R008-canonical-face-20261004';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export function partitionWeights(point,gate=1){
 const raw=SHAPE_REGIONS.map(r=>{const q=point.reduce((s,x,j)=>s+((x-r.centre[j])/r.radii[j])**2,0);return q<1?(1-q)**3:0;}),sum=raw.reduce((s,w)=>s+w,0);
 return raw.map(w=>gate*w/(sum+.003));
}
function protectEyes([x,y,z]){const q=((Math.abs(x)-.034)/.027)**2+((y-1.656)/.016)**2;return z<.065?1:smooth((q-1)/1.25);}
export function normalizeFaceShape(input={schema:SCHEMA,source:SOURCE,regions:{}}){
 if(!input||input.schema!==SCHEMA||input.source!==SOURCE||Object.keys(input).some(k=>!['schema','source','regions'].includes(k))||!input.regions||Array.isArray(input.regions))throw Error('配方格式或人物来源不匹配');
 const regions={};for(const [id,v]of Object.entries(input.regions)){const r=SHAPE_REGIONS.find(r=>r.id===id);if(!r||r.locked||!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x)||Math.abs(x)>3))throw Error('区域无效、受保护或位移超过 ±3 mm：'+id);if(v.some(x=>x!==0))regions[id]=[...v];}
 return {schema:SCHEMA,source:SOURCE,regions};
}
export function createFacePartition({basePositions,baseNormals,mask}){
 const rows=[],stats=SHAPE_REGIONS.map(r=>({id:r.id,label:r.label,group:r.group,locked:r.locked,samples:0,dominant:0,peak:0,sum:0,centreMM:r.centre.map(x=>x*1000),radiiMM:r.radii.map(x=>x*1000)}));let uncovered=0;
 for(let k=0;k<basePositions.length/3;k++){const p=Array.from(basePositions.subarray(k*3,k*3+3)),w=partitionWeights(p,mask(p));let winner=-1,max=0;const row=[];
  for(let j=0;j<w.length;j++){if(w[j]>max){max=w[j];winner=j;}if(w[j]>.01)stats[j].samples++;stats[j].peak=Math.max(stats[j].peak,w[j]);stats[j].sum+=w[j];if(w[j]>0)row.push([j,w[j]]);}
  if(winner>=0)stats[winner].dominant++;else uncovered++;rows.push(row);
 }
 stats.forEach(s=>s.mean=s.sum/rows.length);
 const positions=new Float32Array(basePositions),normals=new Float32Array(baseNormals);let recipe=normalizeFaceShape(),lastReport={safeScale:1,maxDisplacementMM:0,minJacobian:1};let editRows=null;
 function generateEditRows(){if(editRows)return;editRows=rows.map((row,k)=>{const p=Array.from(basePositions.subarray(k*3,k*3+3));return row.filter(([j])=>!SHAPE_REGIONS[j].locked).map(([j,w])=>{const gradients=[0,1,2].map(axis=>{const a=[...p],b=[...p];a[axis]+=.00002;b[axis]-=.00002;return (partitionWeights(a,mask(a))[j]*protectEyes(a)-partitionWeights(b,mask(b))[j]*protectEyes(b))/.00004;});return {j,w:w*protectEyes(p),gradients};});});}
 function apply(input){const next=normalizeFaceShape(input);const vectors=SHAPE_REGIONS.map(r=>(next.regions[r.id]||[0,0,0]).map((v,j)=>v*.001*(j===0?r.sign:1)));
  if(Object.keys(next.regions).length)generateEditRows();let bound=0;
  if(editRows)for(const row of editRows){let sum=0;for(const {j,gradients}of row)sum+=Math.hypot(...vectors[j])*Math.hypot(...gradients);bound=Math.max(bound,sum);}
  const safeScale=bound>.30?.30/bound:1;let maxDisplacementMM=0,minJacobian=1;
  for(let k=0;k<rows.length;k++){const d=[0,0,0],J=[1,0,0,0,1,0,0,0,1];if(editRows)for(const {j,w,gradients}of editRows[k])for(let a=0;a<3;a++){const v=vectors[j][a]*safeScale;d[a]+=v*w;for(let b=0;b<3;b++)J[a*3+b]+=v*gradients[b];}
   for(let a=0;a<3;a++)positions[k*3+a]=basePositions[k*3+a]+d[a];maxDisplacementMM=Math.max(maxDisplacementMM,Math.hypot(...d)*1000);
   if(d.every(x=>x===0)&&J.every((x,i)=>x===(i%4===0?1:0))){normals.set(baseNormals.subarray(k*3,k*3+3),k*3);continue;}
   const [a,b,c,e,f,g,h,i,j]=J,C=[f*j-g*i,g*h-e*j,e*i-f*h,c*i-b*j,a*j-c*h,b*h-a*i,b*g-c*f,c*e-a*g,a*f-b*e],det=a*C[0]+b*C[1]+c*C[2],n=[0,1,2].map(q=>C[q*3]*baseNormals[k*3]+C[q*3+1]*baseNormals[k*3+1]+C[q*3+2]*baseNormals[k*3+2]),len=Math.hypot(...n);minJacobian=Math.min(minJacobian,det);normals.set(n.map(x=>x/Math.max(len,1e-12)),k*3);
  }
  recipe=next;lastReport={safeScale,maxDisplacementMM,minJacobian,gradientBound:bound,evidence:'sampled-surface safeguard; not global injectivity proof'};return lastReport;
 }
 return {regions:SHAPE_REGIONS,rows,stats,positions,normals,apply,weights:p=>partitionWeights(p,mask(p)),export:()=>normalizeFaceShape(recipe),get report(){return {regions:stats.length,samples:rows.length,uncovered,channels:stats,...lastReport};}};
}
