/** Source-dependent research kernel. GPL-3.0. Not a Grasshopper/Rhino executor.
 * Coordinate/length values stay in original mm. Renderer transformations never write back.
 * Flat panels deliberately become STALE when the last changes: there is no proven mapping.
 */
export const VERSION='R02-S1';
export const KEYS=['toe','ball','waist','instep','ankle','sole'];
export const DEFAULT=()=>({schema:'kaopu-footwear-study/2',revision:1,sourceCommit:'69e98e7f2e576cea09ef0bcb117b52d4f1cdabb6',units:'mm',lastDeltaPercent:Object.fromEntries(KEYS.map(k=>[k,0])),panelThicknessScale:1,mode:'source',piece:22,selectedCurve:29,camera:'hero',overlay:false,wireframe:false,seam:{count:13,pitch:3.8,diameter:.4,layerThickness:1.4},acceptance:{manufacturing:false,visual:false,physics:false}});
export function validateState(value){
 if(!value||value.schema!=='kaopu-footwear-study/2'||value.units!=='mm'||value.sourceCommit!==DEFAULT().sourceCommit)throw Error('配方的版本、单位或原工程身份不匹配');
 if(!Number.isInteger(value.revision)||value.revision<1)throw Error('revision 必须是正整数');
 if(!value.lastDeltaPercent||KEYS.some(k=>typeof value.lastDeltaPercent[k]!=='number'||!Number.isFinite(value.lastDeltaPercent[k])||Math.abs(value.lastDeltaPercent[k])>8))throw Error('本研究内核只接受各截线 −8%…+8%；不是工业放码范围');
 if(!Number.isFinite(value.panelThicknessScale)||value.panelThicknessScale<.5||value.panelThicknessScale>2)throw Error('裁片厚度倍率超界');
 if(!['source','last','panels','seam','method'].includes(value.mode)||![22,23,28,24,25,27,19,20,21].includes(value.piece)||![29,30,31].includes(value.selectedCurve))throw Error('未知工位或原始对象');
 if(!['hero','side','front','top','bottom'].includes(value.camera)||typeof value.overlay!=='boolean'||typeof value.wireframe!=='boolean')throw Error('未知镜头/显示状态');
 if(!value.seam||!Number.isInteger(value.seam.count)||value.seam.count<5||value.seam.count>25||!Number.isFinite(value.seam.pitch)||value.seam.pitch<2.5||value.seam.pitch>5.5||!Number.isFinite(value.seam.diameter)||value.seam.diameter<.24||value.seam.diameter>.60||!Number.isFinite(value.seam.layerThickness)||value.seam.layerThickness<.8||value.seam.layerThickness>2.5)throw Error('针路参数超出继承内核范围');
 if(!value.acceptance||value.acceptance.manufacturing!==false||value.acceptance.visual!==false||value.acceptance.physics!==false)throw Error('研究配方不能自行声明成品验收');
 return structuredClone(value);
}
export function polyLength(p){let n=0;for(let i=1;i<p.length;i++)n+=Math.hypot(...p[i].map((v,k)=>v-p[i-1][k]));return n;}
export function bounds(p){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[i+k]);max[k]=Math.max(max[k],p[i+k]);}return{min,max,size:min.map((v,k)=>max[k]-v)};}
export function resample(points,n=32){const ds=[0];for(let i=1;i<points.length;i++)ds.push(ds.at(-1)+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));if(ds.at(-1)<1e-6)throw Error('闭合截线退化为零长度');const out=[];let j=1;for(let i=0;i<n;i++){const target=ds.at(-1)*i/n;while(j<ds.length-1&&ds[j]<target)j++;const f=(target-ds[j-1])/Math.max(1e-15,ds[j]-ds[j-1]);out.push(points[j].map((v,k)=>points[j-1][k]+f*(v-points[j-1][k])));}return out;}
export class LastKernel{
 constructor(data){
  if(data.schema!=='kaopu-shoe-teacher-cad/2'||data.units!=='mm')throw Error('原工程数据协议错误');
  this.data=data;this.original=Float64Array.from(data.baseLast.positions);this.positions=this.original.slice();this.controls=[];
  for(const [j,s]of data.sections.entries()){const pts=resample(s.points,32),centroid=[0,1,2].map(k=>pts.reduce((a,p)=>a+p[k],0)/pts.length);for(const p of pts)this.controls.push({p,delta:p.map((v,k)=>(v-centroid[k])*.01),section:j});}
  // Precompute linear shape-response fields, not new base geometry.
  this.basis=this.bind(Array.from({length:this.original.length/3},(_,i)=>Array.from(this.original.slice(3*i,3*i+3))));
  this.sectionBasis=data.sections.map(s=>this.bind(s.points));this.changed=false;
 }
 bind(points){const fields=KEYS.map(()=>new Float64Array(points.length*3));for(let i=0;i<points.length;i++){const p=points[i],w=[],sums=Array(6).fill(0);let total=0,at=-1;for(let j=0;j<this.controls.length;j++){const c=this.controls[j],d=Math.hypot(...p.map((v,k)=>v-c.p[k]));if(d<1e-8){at=j;break;}const q=1/(d*d*d);w.push(q);total+=q;}if(at>=0){const c=this.controls[at];fields[c.section].set(c.delta,i*3);continue;}for(let j=0;j<this.controls.length;j++){const c=this.controls[j],q=w[j]/total;for(let k=0;k<3;k++)fields[c.section][i*3+k]+=q*c.delta[k];}}
  return fields;
 }
 evaluate(deltas){if(KEYS.some(k=>!Number.isFinite(deltas[k])||Math.abs(deltas[k])>8))throw Error('Invalid deformation domain');this.changed=KEYS.some(k=>deltas[k]!==0);this.positions.set(this.original);if(this.changed)for(let j=0;j<6;j++){const v=deltas[KEYS[j]],a=this.basis[j];if(v)for(let i=0;i<a.length;i++)this.positions[i]+=a[i]*v;}if(!this.positions.every(Number.isFinite))throw Error('非有限楦体输出');this.currentSections=this.data.sections.map((s,n)=>{const ps=s.points.map(p=>p.slice());if(this.changed)for(let j=0;j<6;j++){const v=deltas[KEYS[j]],a=this.sectionBasis[n][j];if(v)for(let i=0;i<ps.length;i++)for(let k=0;k<3;k++)ps[i][k]+=a[3*i+k]*v;}return {...s,points:ps,currentLengthMm:polyLength(ps),requestedGuideLengthMm:s.lengthMm*(1+deltas[s.key]/100)};});return this.positions;}
 report(){const b=bounds(this.positions);let max=0,sum=0;for(let i=0;i<this.positions.length;i+=3){const d=Math.hypot(this.positions[i]-this.original[i],this.positions[i+1]-this.original[i+1],this.positions[i+2]-this.original[i+2]);max=Math.max(max,d);sum+=d*d;}return{representation:'native source mesh + independently implemented normalized inverse-cube guide field',exactGrasshopperReplication:false,originalUnchanged:!this.changed,vertexCount:this.positions.length/3,triangleCount:this.data.baseLast.indices.length/3,lengthMm:b.size[0],widthMm:b.size[1],heightMm:b.size[2],maxDisplacementMm:max,rmsDisplacementMm:Math.sqrt(sum/(this.positions.length/3)),flatPatternState:this.changed?'STALE_REQUIRES_REFLATTENING':'SOURCE_REFERENCE_ONLY_NO_VERIFIED_SEAM_GRAPH',completeShoe:false,sections:this.currentSections?.map(s=>({key:s.key,sourceObject:s.objectIndex,sourceLengthMm:s.lengthMm,guideLengthMm:s.currentLengthMm,requestedGuideLengthMm:s.requestedGuideLengthMm,guideResidualMm:s.currentLengthMm-s.requestedGuideLengthMm}))};}
}
// Data describes source loops and missing bindings. No guessed source-to-pattern mapping is allowed.
export function shoeConstructionGate(state){return {passed:false,stage:'BEFORE_ASSEMBLY',changedLast:KEYS.some(k=>state.lastDeltaPercent[k]!==0),blocking:['原裁片—楦上区域的对应关系尚未校准','实际缝边、方向、吃势和工序尚未绑定','TPE 原例不能直接当作皮革制造参数'],productionReady:false};}
