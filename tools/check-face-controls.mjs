// File-content validation only: inspect recipe data and wiring. Never import
// application code, generate a human, sample a surface or compile a shader.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkFaceMuscleParameters} from './check-face-muscles.mjs';
export function checkFaceControlSources({read,assert}){
  let checks=0;const check=(value,message)=>{assert(value,'Face controls: '+message);checks++;};
  const recipe=JSON.parse(read('body/FaceControlRecipe.json')),source=read('body/FaceControls.js'),renderer=read('body/CompactWorkbench.js'),runtime=read('source/runtime.template.js'),character=read('body/CharacterPresets.js'),manifest=JSON.parse(read('source/assembly.json'));
  check(recipe.schema==='jarvis/face_control_recipe@1'&&recipe.status==='Candidate'&&!recipe.runtimeVerified&&!recipe.visualAcceptance,'explicit authored recipe and unverified acceptance');
  check(source.includes("const FACE_SCHEMA='jarvis/face_profile@2'")&&source.includes("const FACE_IDENTITY_SCHEMA='jarvis/face_identity@1'")&&source.includes("const FACE_EXPRESSION_SCHEMA='jarvis/face_expression@1'"),'versioned identity and expression profiles');
check(source.includes("const FACE_LEGACY_SCHEMA='jarvis/face_pose@1'")&&source.includes("legacyOffsetsInterpretation:'neutral identity'"),'legacy face-pose migration keeps an explicit assumption');
check(source.includes('weights=pose.expression.weights,offsetsMm=pose.identity.neutralOffsetsMm'),'resolver composes fixed identity before transient expression');
check(source.includes('identity:demo.saved.identity,expression:{weights:')&&source.includes('identity:saved.identity,expression:{weights:'),'demo and eased presets retain the current identity');
check(source.includes('verifySeparation(){')&&source.includes('face-identities')&&source.includes('reset-identity'),'visible separation controls and invariant check');
  const ids=recipe.nodes.map(n=>n.id),channels=recipe.channels.map(c=>c.id),presets=recipe.presets.map(p=>p.id);
  check(ids.length===17&&new Set(ids).size===17,'17 distinct local regions');
  check(channels.length===22&&new Set(channels).size===22&&channels.includes('eyeBlinkLeft')&&channels.includes('eyeBlinkRight'),'22 distinct expression channels including independent blinks');
  check(presets.length===7&&new Set(presets).size===7,'neutral plus six expression examples');
  check(recipe.maximumOffsetMm===6,'bounded authored displacement');
  for(const node of recipe.nodes){
    check(node.centre.length===3&&node.radius.length===3&&[...node.centre,...node.radius].every(Number.isFinite)&&node.radius.every(r=>r>0&&r<.05),'finite local kernel '+node.id);
    check(node.centre[1]-node.radius[1]>=1.39&&node.centre[1]+node.radius[1]<=1.58&&node.centre[2]-node.radius[2]>=.1&&Math.abs(node.centre[0])+node.radius[0]<=.09,'support stays inside shader and sampling head gate '+node.id);
    if(node.mirror){const other=recipe.nodes.find(n=>n.id===node.mirror);check(other?.mirror===node.id&&Math.abs(node.centre[0]+other.centre[0])<.0011&&node.centre.slice(1).every((v,i)=>v===other.centre[i+1])&&node.radius.every((v,i)=>v===other.radius[i]),'reciprocal anatomical mirror '+node.id);}
  }
  for(const channel of recipe.channels)for(const [id,delta]of Object.entries(channel.offsets))check(ids.includes(id)&&delta.length===3&&delta.every(Number.isFinite)&&Math.hypot(...delta)<=recipe.maximumOffsetMm,'valid displacement '+channel.id+'/'+id);
  for(const preset of recipe.presets){
    for(const [id,value]of Object.entries(preset.weights))check(channels.includes(id)&&Number.isFinite(value)&&value>=0&&value<=1,'preset channel '+preset.id+'/'+id);
    // Independently sum parameter vectors to catch saturation in supplied demos.
    const sums=Object.fromEntries(ids.map(id=>[id,[0,0,0]]));
    for(const channel of recipe.channels)for(const [id,delta]of Object.entries(channel.offsets))delta.forEach((v,i)=>sums[id][i]+=v*(preset.weights[channel.id]||0));
    check(Object.values(sums).every(delta=>Math.hypot(...delta)<=recipe.maximumOffsetMm),'example fits displacement budget '+preset.id);
  }
  check(Object.keys(recipe.presets.find(p=>p.id==='neutral').weights).length===0,'neutral example contains no displacement');
  check(manifest.modules.filter(p=>p==='body/FaceControls.js').length===1&&manifest.jsonTokens.FACE_RECIPE==='FaceControlRecipe'&&runtime.includes('/*__SOURCE:body/FaceControls.js__*/'),'single assembly owner');
  check(manifest.modules.indexOf('body/FaceControls.js')<manifest.modules.indexOf('body/CharacterPresets.js'),'face validator precedes initial character parsing');
  check(source.includes("return name==='faceLip'||name==='mouthInterior'||name==='faceSkin'||name==='faceBrow'||name==='noseInterior'||name==='skin'||name==='FJ2812'||name==='FJ2814'||name==='eyeLidSkin'||name==='eyeLidMargin'||name==='eyeTearDuct'"),'skin and procedural eyelid structures deform while eyeballs and ears remain rigid');
  check(source.includes('(1-r)**4*(4*r+1)')&&source.includes('w=t*t*t*t*(4.*radius+1.)')&&source.includes('gradient=-20.*t*t*t*q/faceRadii[i]'),'matching C2 kernel and analytic derivative');
  check(source.includes('normalSource.x*cross(jy,jz)')&&source.includes('normalSource.y*cross(jz,jx)')&&source.includes('normalSource.z*cross(jx,jy)'),'inverse transpose normal transform');
  check(source.includes('faceMuscleStrain')&&source.includes('faceMuscleBias')&&source.includes('faceMuscles[i]*faceEnabled')&&source.includes('w*strain[0]+d*gradient.x')&&source.includes('w*strain[1]+d*gradient.y')&&source.includes('w*strain[2]+d*gradient.z'),'regional affine strain and complete analytic derivative join the shared position and normal path');
  check(source.includes('radiusSquared=dot(q,q)')&&source.includes('float t=1.-radiusSquared,w=t*t*t')&&source.includes('gradient=-6.*t*t*q/faceMuscleRadii[i]'),'muscle envelope has compact C2 support with matching derivative');
  check(recipe.channels.filter(c=>c.id.startsWith('eyeNarrow')||c.id.startsWith('eyeWide')||c.id.startsWith('eyeBlink')).every(c=>Object.keys(c.offsets).length===0),'spherical eyelid aperture controls do not duplicate point translations');
  check(source.includes("['eyeNarrow','eyeWide','eyeBlink']")&&source.includes('muscles:resolved.muscles,eyelids:resolved.eyelids')&&source.includes('[resolved.values,resolved.muscles,resolved.eyelids].some'),'uniform contract and enabled state include muscle-only and blink-only expressions');
  check(source.includes('FACE_RECIPE.legacyRevisions.includes(input.revision)'),'old authored face imports migrate into the new recipe revision');
  check(renderer.includes("'faceMuscles[0]'")&&renderer.includes("gl.uniform1fv(p.u['faceMuscles[0]'],face.muscles)")&&renderer.includes("gl.uniform1fv(p.u['compactLidState[0]'],face.eyelids.map(v=>v*face.enabled))"),'both programs bind dimensionless muscles and enabled spherical lid channels');
  check(source.includes('transition={saved,target,elapsed:0,duration:.45')&&source.includes('weight=t*t*(3-2*t)')&&source.includes('commit(interpolateFacePose(transition.saved,transition.target,weight))'),'preset-button transitions smoothly commit the actually displayed parameters');
  check(source.includes('const saved=api.export(),target=validateFacePose')&&source.includes('api.stop();sampling=null;commit(saved);transition=')&&source.includes('const target=transition.target;transition=null;commit(target)'),'interruption captures the displayed pose and completion uses an exact target');
  check(source.includes("transitionPreset(preset.id,Number(el('intensity').value))")&&source.includes("transitionPreset('neutral')")&&source.includes('const result=api.apply({weights:')&&source.includes('resetTransient(){demo=null;sampling=null;transition=null;'),'only preset buttons ease; programmatic preset and character replacement retain immediate behavior');
  check(source.includes('const saved=(demo||transition).saved;demo=null;transition=null;')&&source.includes('const plan=api.samplePlan(stepMm);api.stop();')&&source.includes('play(){api.stop();api.endSample();'),'stop restores a saved pose while sampling and demo cancel transient transitions');
  const main=renderer.slice(renderer.indexOf('void main(){'),renderer.indexOf('function compactFragmentSource'));
  const stages=['R=canonicalPosition','personalRestPosition=vec3(-personal.x','compactFace(source,n,faceHeat)','vec3 delta=source-canonicalPosition','vec3 p=personalRestPosition+vec3(-delta.x','P=compactRotate'].map(part=>main.indexOf(part));
  check(stages.every((position,index)=>position>=0&&(index===0||position>stages[index-1])),'canonical face field adds protected-head offsets to the personal rest surface before skeleton skinning');
  check(renderer.includes('this.main=program(this.gl,COMPACT_VERTEX')&&renderer.includes('this.depth=program(this.gl,COMPACT_VERTEX'),'same deformation in colour and shadow');
  check(renderer.includes("gl.uniform3fv(p.u['faceOffsets[0]'],face.offsets.map(v=>v/this.statureScale))")&&renderer.includes('gl.uniform1f(p.u.faceEligible,faceChunkEligible(c.name)?1:0)'),'physical face offsets convert to canonical space and retain chunk eligibility');
  check(renderer.includes('displayMeshes=data.meshes.filter(m=>!replacedSclera.includes(m)).concat(faceTissue.meshes,eyeTissue.meshes)')&&renderer.includes('stage.faceSampling=sampleFaceSurface(displayMeshes,data.report.quality,this.statureScale)')&&renderer.includes('this.faceSampling=stage.faceSampling'),'sampling includes generated eyelids at the current stature and successful geometry replacement');
  check(source.includes('point=mesh.canonicalPositions?Array.from(mesh.canonicalPositions.subarray(i*3,i*3+3))')&&source.includes('faceKernel(point,node)')&&source.includes('display vertices including duplicated chunk boundaries'),'transferred canonical coordinates drive sampling coverage with explicit count scope');
  check(source.includes('personalPoint=[0,1,2].map(axis=>mesh.positions[i*3+axis]*mesh.extent[axis]+mesh.origin[axis])')&&source.includes('personalPoint.map((v,axis)=>v-node.centre[axis]*statureScale)')&&source.includes("reportedDistanceSpace:'personal-body-millimetres'"),'face distances use decoded personal coordinates including Float32 rounding');
  check(source.includes('scale=Math.min(1,FACE_RECIPE.maximumOffsetMm/Math.max(length,1e-12))')&&source.includes('scale*.001'),'bounded vector magnitudes and millimetre conversion');
  check(source.includes('[-offset[0],offset[1],offset[2]]'),'mirror reverses lateral displacement only');
  check(source.includes('Number.isFinite(value)')&&source.includes("Object.keys(input).some")&&source.includes('file.size>65536'),'finite values, unknown-field rejection and import size guard');
  check(source.includes('[0,1,2].flatMap(axis=>[-1,1].map')&&source.includes('saved:api.export()')&&source.includes('commit(saved)'),'102 independent signed samples and restore');
  check(runtime.includes('window.HumanLab.face?.tick(dt)')&&source.includes('Math.min(Math.max(dt,0),.1)')&&source.includes('if(!demo||document.hidden)return'),'bounded demo clock independent of body autoplay');
  const characterAssembly=read('body/CharacterAssembly.js');
  check(character.includes('face:validateFacePose(appearance.face)')&&character.includes('lab.human.characterPreset=p')&&character.includes('refreshCharacterControls(lab)')&&characterAssembly.includes('()=>lab.face?.resetTransient()')&&characterAssembly.includes('()=>lab.face?.refresh()'),'character persistence uses the shared transient reset and face refresh');
  check(read('body/BodySettings.js').includes("['face','面部微控与表情','face-panel',null]")&&renderer.includes("lab.settings.open('face')"),'settings and workbench entries');
  check(read('body/HumanDNA.js').includes('facialExpression:lab.face?.report()')&&JSON.parse(read('body/HumanDNAContract.json')).structureRecipes.some(r=>r.id==='facial-expression'),'DNA recipe and state provenance');
  const muscles=checkFaceMuscleParameters(recipe,assert);
  return {checks,nodes:ids.length,axes:ids.length*3,channels:channels.length,expressionExamples:presets.length-1,samplingSteps:ids.length*6,muscles,applicationExecuted:false,surfaceSampled:false,shaderCompiled:false,visualAcceptance:false};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  console.log(JSON.stringify(checkFaceControlSources({read,assert:(value,message)=>{if(!value)throw Error(message);}}),null,2));
}
