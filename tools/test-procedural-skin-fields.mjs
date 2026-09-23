// CPU material/scale contracts. Passing these is not visual acceptance.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../body/SkinSurface.js',import.meta.url),'utf8'),context=vm.createContext({});
new vm.Script(source+'\nglobalThis.api={parameters:COMPACT_SKIN_SURFACE,evaluate:compactSkinEvaluateCPU,meso:compactSkinMeso,regions:compactSkinRegions,kernel:compactSkinPoreKernel,pores:compactSkinPores2D,grooves:compactSkinGrooves2D,band:compactSkinBand,shader:compactSkinSurfaceShader};').runInContext(context);
const {parameters:p,evaluate,meso,regions,kernel,pores,grooves,band,shader}=context.api;
let checks=0;
const check=(condition,message)=>{assert(condition,message);checks++;};
check(p.authoredParameters&&!p.measuredPhysiology&&!p.usesImages,'material must remain labelled authored and image-free');
check(p.pore.depthM<.000025&&p.groove.depthM<.000008,'skin microrelief became rock-scale displacement');
check(p.pore.radiusM>p.pore.depthM*4&&p.pore.radiusM<p.pore.spacingM/3,'pore proportions became spikes or a paved surface');
check(p.meso.wavelengthsM.every(v=>v>=.0015&&v<=.004)&&p.meso.amplitudeM<=.000035,'meso layer exceeds authored skin scale');
check(!/\b(?:document|window|fetch|Worker|localStorage|sampler2D|samplerCube|textureLod|textureGrad)\b/.test(source),'material must have no UI, I/O or texture dependency');
const glsl=shader();
check(glsl.includes('precision highp int;'),'fragment hash is not guaranteed full 32-bit integer precision');
for(const field of ['pigment','heightM','roughness','oil','cavity','vascular','unresolvedVariance'])check(glsl.includes(field),'missing shader output '+field);
check(glsl.includes('CompactSkinSurface compactSkinEvaluate(')&&glsl.includes('vec3 compactSkinPerturbNormal('),'public integration functions missing');

// The compact elliptical kernel has an analytic integral pi*rx*ry/4.
// Broadening must not change average depth/coverage and cause distance pumping.
const rx=.000085,ry=.000060,expectedIntegral=Math.PI*rx*ry/4;
let maximumKernelIntegralRelativeError=0;
for(const footprint of [0,.00005,.00012,.00022]){
  const halfWidth=.00025,steps=192,dx=halfWidth*2/steps;let integral=0;
  for(let i=0;i<steps;i++)for(let j=0;j<steps;j++)integral+=kernel(-halfWidth+(i+.5)*dx,-halfWidth+(j+.5)*dx,rx,ry,footprint)*dx*dx;
  const relative=Math.abs(integral/expectedIntegral-1);maximumKernelIntegralRelativeError=Math.max(maximumKernelIntegralRelativeError,relative);
  check(relative<.001,'pore footprint filtering changes its integrated strength');
}
const e=rx*1e-4;
check(kernel(rx+e,0,rx,ry,0)===0,'pore has unbounded spatial support');
check(Math.abs(kernel(rx-e,0,rx,ry,0)/e)<.05,'pore support introduces a slope discontinuity');
check(kernel(0,0,rx,ry,0)>kernel(0,0,rx,ry,.00012),'pixel filtering did not reduce unresolved pore contrast');

const neutralSurface=[.52,.25,.30],neutralDetail=[.30,.35,.13],seed=[31.1,71.3,19.7],normal=[0,0,1],point=[.037,1.495,.173];
const sample=(q=point,fp=.000035,d=neutralDetail,n=normal,st=1,ss=seed)=>evaluate(q,n,fp,ss,neutralSurface,d,st);
const a=sample(),same=sample();
check(JSON.stringify(a)===JSON.stringify(same),'identical rest coordinates and seed did not reproduce material');
const noRelief=sample(point,.000035,[.30,0,.13]),allRelief=sample(point,.000035,[.30,1,.13]);
check(JSON.stringify(noRelief.pigment)===JSON.stringify(allRelief.pigment),'microrelief control painted colour noise');
check(noRelief.vascular===allRelief.vascular,'microrelief control changed tissue colour');
check(allRelief.oil<=noRelief.oil&&allRelief.oil>=noRelief.oil*.35,'pore cavities must only reduce local reflective film coverage');
check(noRelief.heightM===0&&noRelief.mesoHeightM===0&&noRelief.microHeightM===0&&noRelief.plateauHeightM===0&&noRelief.unresolvedVariance===0,'zero microdetail leaves hidden bump/roughness');
check(Math.abs(a.mesoHeightM-allRelief.mesoHeightM*.35)<1e-15,'meso output is not controlled by the existing microdetail knob');
const noColour=sample(point,.000035,[0,.35,0]);
check(noColour.pigment.every(v=>v===1)&&noColour.vascular===0,'disabled pigment/blood controls do not give a neutral multiplier');
check(noColour.heightM===a.heightM&&noColour.oil===a.oil,'pigment controls changed independent height or oil');
const movedSeed=sample(point,.000035,neutralDetail,normal,1,[61.1,11.3,7.7]);
check(JSON.stringify(a.pigment)!==JSON.stringify(movedSeed.pigment),'seed does not change authored identity');
// Position is already canonical: no camera, animation time, light or world
// location is an input. Opposite face winding must not remap the material.
const back=sample(point,.000035,neutralDetail,[0,0,-1]);
check(a.heightM===back.heightM&&JSON.stringify(a.pigment)===JSON.stringify(back.pigment),'rest-normal sign changes material identity');
const negative=sample(point,-1);
check(Number.isFinite(negative.heightM)&&negative.roughness>=.30,'negative footprint guard failed');
const zeroNormal=sample(point,.000035,neutralDetail,[0,0,0]);
check(Number.isFinite(zeroNormal.heightM),'zero rest normal caused nonfinite material');

const nose=[0,1.494,.198],cheek=[.045,1.492,.167],lid=[.030,1.520,.17];
check(regions(nose).tZone>.95&&regions(cheek).cheek>.9&&regions(lid).eye>.95,'facial region centres do not follow current source metres');
check(sample(nose).oil>sample(cheek).oil*1.5,'nose no longer has stronger regional sebum than cheek');
check(sample(nose).roughness<sample(cheek).roughness,'oily nose is not smoother than cheek');
check(regions([0,1.50,-.10]).face===0,'facial masks leak onto posterior head');

// Test a patch with thousands of unrelated pore locations rather than one
// favourable point. A half-millimetre cell shift must not tile the field.
const fineHeights=[],mediumHeights=[],farHeights=[],colours=[],shifted=[],moved=[];
let minimumHeightM=0,maximumHeightM=-Infinity,maximumCavityLoss=0;
for(let j=0;j<48;j++)for(let i=0;i<48;i++){
  const q=[.030+i*.000109,1.486+j*.000107,.174],fine=sample(q,.000015),medium=sample(q,.00020),far=sample(q,.0010);
  for(const value of [fine,medium,far]){
    check([value.heightM,value.roughness,value.oil,value.cavity,value.vascular,value.unresolvedVariance,...value.pigment].every(Number.isFinite),'nonfinite surface field');
    check(value.roughness>=.30&&value.roughness<=.85&&value.oil>=0&&value.oil<=1,'material controls outside supported range');
    check(value.cavity>=.82&&value.cavity<=1,'specular cavity suppression exceeds its bounded coverage');
    check(value.pigment.every(v=>v>.80&&v<1.20),'skin chroma field overwhelms base pigmentation');
  }
  fineHeights.push(fine.microHeightM);mediumHeights.push(medium.microHeightM);farHeights.push(far.microHeightM);colours.push(fine.pigment[0]);
  shifted.push(sample([q[0]+p.pore.spacingM,q[1],q[2]],.000015).microHeightM);
  moved.push(sample([q[0]+1e-8,q[1]-1e-8,q[2]],.000015).microHeightM);
  minimumHeightM=Math.min(minimumHeightM,fine.microHeightM);maximumHeightM=Math.max(maximumHeightM,fine.microHeightM);maximumCavityLoss=Math.max(maximumCavityLoss,1-fine.cavity);
  check(Math.abs(fine.heightM-fine.microHeightM-fine.mesoHeightM-fine.plateauHeightM)<1e-15,'surface bands replaced or amplified pore height');
  check(Math.abs(fine.plateauHeightM)<=p.plateau.amplitudeM*.35&&far.plateauHeightM===0,'continuous microrelief exceeds amplitude or fails to retire');
}
const average=values=>values.reduce((sum,x)=>sum+x,0)/values.length;
const rms=values=>Math.sqrt(average(values.map(x=>x*x)));
const deviation=values=>{const mean=average(values);return rms(values.map(x=>x-mean));};
const correlation=(x,y)=>{const mx=average(x),my=average(y);return average(x.map((a,i)=>(a-mx)*(y[i]-my)))/(deviation(x)*deviation(y));};
const fineDeviationM=deviation(fineHeights),mediumDeviationM=deviation(mediumHeights),farDeviationM=deviation(farHeights),cellShiftCorrelation=correlation(fineHeights,shifted),pigmentHeightCorrelation=correlation(fineHeights,colours);
check(fineDeviationM>1e-7,'resolved material has no varied microgeometry');
check(mediumDeviationM<fineDeviationM*.80&&farDeviationM===0,'unresolved microgeometry does not smoothly retire: '+JSON.stringify({fineDeviationM,mediumDeviationM,farDeviationM}));
check(minimumHeightM>-.000030&&maximumHeightM<=0,'microgeometry exceeds authored micrometre scale');
check(Math.abs(cellShiftCorrelation)<.35,'pores visibly repeat at the source cell spacing');
check(Math.abs(pigmentHeightCorrelation)<.20,'pore relief is correlated with painted pigment dots');
check(rms(fineHeights.map((v,i)=>v-moved[i]))<1e-8,'tiny rest-coordinate motion causes discontinuous material jumps');
check(sample(point,.0010).unresolvedVariance>sample(point,.00001).unresolvedVariance,'lost detail is not transferred to roughness variance');
const compressed=sample(point,.000015,neutralDetail,normal,.55),stretched=sample(point,.000015,neutralDetail,normal,1.8);
check(Math.abs(compressed.heightM)>=Math.abs(stretched.heightM),'surface stretch amplifies microrelief');
for(const fn of [pores,grooves])check(fn([0,0],.01)===0,'fully subpixel structures still evaluate high-contrast detail');
let previous=1;for(let i=0;i<=100;i++){const v=band(i*.00001,.0005);check(v<=previous&&v>=0&&v<=1,'nonmonotonic pixel bandwidth');previous=v;}

// The new layer occupies millimetre scales and remains separate from pigment
// and the much smaller pits. Sample a wider patch to avoid a chance match of
// two unrelated low-frequency fields over a single cell.
const mesoHeights=[],mesoMedium=[],mesoFar=[],mesoPigment=[];
let maximumMesoAmplitudeM=0,maximumFullControlMesoM=0;
for(let j=0;j<48;j++)for(let i=0;i<48;i++){
  const q=[.022+i*.00063,1.474+j*.00067,.176],value=sample(q,.00002),medium=sample(q,.0020),far=sample(q,.005);
  mesoHeights.push(value.mesoHeightM);mesoMedium.push(medium.mesoHeightM);mesoFar.push(far.mesoHeightM);mesoPigment.push(value.pigment[0]);
  maximumMesoAmplitudeM=Math.max(maximumMesoAmplitudeM,Math.abs(value.mesoHeightM));
  maximumFullControlMesoM=Math.max(maximumFullControlMesoM,Math.abs(sample(q,.00002,[.30,1,.13]).mesoHeightM));
  check(Math.abs(value.mesoHeightM)<=p.meso.amplitudeM*.35,'default meso layer exceeded its bounded peak amplitude');
  check(far.heightM===0&&far.mesoHeightM===0,'meso detail aliases beyond its pixel bandwidth');
}
const mesoDeviationM=deviation(mesoHeights),mesoMediumDeviationM=deviation(mesoMedium),mesoPigmentCorrelation=correlation(mesoHeights,mesoPigment);
check(maximumFullControlMesoM>.000010&&maximumFullControlMesoM<=.000035,'meso layer failed its authored 10-35 micrometre output range');
check(mesoDeviationM>fineDeviationM*4,'new middle scale is still absent compared with pore-only material');
check(mesoMediumDeviationM<mesoDeviationM*.65&&mesoFar.every(v=>v===0),'meso footprint filtering fails to suppress unresolved variation');
check(Math.abs(mesoPigmentCorrelation)<.20,'meso relief is reusing a pigment field');

// C2 continuity across source lattice boundaries, tested with independent
// one-sided finite differences of the complete meso function. Other octaves
// may cross these locations too; no discontinuous cell selection is allowed.
let maximumSlopeJump=0,maximumCurvatureJumpPerM=0;
const fromDomain=q=>[(2*q[0]-2*q[1]+q[2])/3,(q[0]+2*q[1]+2*q[2])/3,(-2*q[0]-q[1]+2*q[2])/3];
for(const [bandIndex,wavelength] of p.meso.wavelengthsM.entries())for(let axis=0;axis<3;axis++)for(const salt of [17,413,3701]){
  const q=[.0131,1.0237,.7873];q[axis]=(137-[11.7,29.3,43.1][(axis+bandIndex)%3])*wavelength;
  const h=1e-7,at=step=>{const v=q.slice();v[axis]+=step*h;return meso(fromDomain(v),.00002,salt);};
  const a=at(-2),b=at(-1),c=at(0),d=at(1),e=at(2);
  const slopeJump=Math.abs((d-c)/h-(c-b)/h),curvatureJump=Math.abs((e-2*d+c)/(h*h)-(c-2*b+a)/(h*h));
  maximumSlopeJump=Math.max(maximumSlopeJump,slopeJump);maximumCurvatureJumpPerM=Math.max(maximumCurvatureJumpPerM,curvatureJump);
  check(slopeJump<.0001&&curvatureJump<.1,'meso lattice introduced a tangent or curvature discontinuity');
}

console.log(JSON.stringify({schema:'human/skin_surface_test@1',revision:p.revision,checks,patchSamples:fineHeights.length,maximumKernelIntegralRelativeError,
  minimumHeightM,maximumHeightM,fineDeviationM,mediumDeviationM,farDeviationM,maximumCavityLoss,cellShiftCorrelation,pigmentHeightCorrelation,
  maximumMesoAmplitudeM,maximumFullControlMesoM,mesoDeviationM,mesoMediumDeviationM,mesoPigmentCorrelation,maximumSlopeJump,maximumCurvatureJumpPerM,
  shaderBytes:glsl.length,gpuExecuted:false,visualAcceptance:false}));
