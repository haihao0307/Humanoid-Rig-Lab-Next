/* Local LivingObjectDNA adapter informed by the pinned KAOPU charters.
 * JSON is an encoding choice; this is not a certified KAOPU implementation.
 * The exported recipe contains parameters and state, never generated vertices. */
const HUMAN_DNA_CONTRACT=/*__HUMAN_DNA_CONTRACT_JSON__*/;
const HUMAN_GENERATOR_REVISION='/*__GENERATOR_HASH__*/';
function installHumanDNA(lab){
 const copy=value=>JSON.parse(JSON.stringify(value));
 const describe=()=>({objectId:lab.human.characterPreset.id,objectType:'LivingObjectDNA',kind:'source-derived R2 character',generatorRevision:HUMAN_GENERATOR_REVISION,status:'Candidate'});
 const exportDocument=()=>({
  schema:'jarvis/kaopu_living_dna@1',...describe(),
  referenceFrame:copy(HUMAN_DNA_CONTRACT.referenceFrame),timeBinding:copy(HUMAN_DNA_CONTRACT.timeBinding),quantityUnits:copy(HUMAN_DNA_CONTRACT.quantityUnits),
  definition:lab.npc.export(),
  displaySurface:lab.compact?{mode:'reconstructed-r2',source:'reconstruction/assembly.mjs',fixedReferenceShape:isReferenceCharacterShape(lab.human.characterPreset.shape),
    shape:validateCharacterShape(lab.human.characterPreset.shape),geometryKey:lab.human.bodyMetrics.geometryKey,shapeRecipe:'body/CharacterShape.js',shapeAcceptance:{runtimeVerified:false,visualAcceptance:false},
    appearance:copy(COMPACT_APPEARANCE),parameterManifest:copy(COMPACT_PARAMETERS),hairRecipe:{profile:lab.hair.export(),catalog:copy(HAIR_CATALOG),generator:'reconstruction/hair.mjs',renderer:'body/CompactHairRenderer.js',generatedGeometryIncluded:false},continuityRecipe:'canonical-interface-field-positive-diffusion/v1',generatedGeometryIncluded:false,poseBindingAccepted:false}:null,
  skinAppearance:lab.skin?.report()||null,
  faceAppearance:lab.appearance?.export()||null,
  facialExpression:lab.face?.report()||null,
  faceAnatomy:lab.compact?{generator:'body/FaceAnatomy.js',parameters:copy(COMPACT_FACE_ANATOMY),diagnostics:copy(lab.compact.report.faceAnatomy),generatedGeometryIncluded:false,measuredAnatomy:false}:null,
  headSculpt:lab.compact?{generator:'body/HeadSculpt.js',parameters:copy(HEAD_SCULPT),order:'after local expression and jaw, before identity and skeletal skinning',generatedGeometryIncluded:false,measuredAnatomy:false}:null,
  eyeAnatomy:lab.compact?{generator:'body/EyeAnatomy.js',parameters:copy(COMPACT_EYE_ANATOMY),frames:copy(COMPACT_EYES),diagnostics:copy(lab.compact.report.eyeAnatomy),generatedGeometryIncluded:false,physicalTissueSimulation:false}:null,
  bodyShape:lab.shape?.report()||null,
  // Definition exports reset fatigue. Live state is explicitly separate.
  state:{simulationTimeS:lab.human.tissue.time,strengthState:copy(lab.human.strength.state),biology:lab.human.tissue.ecology.export(),animationResume:'NotImplemented'},
  recipes:copy(HUMAN_DNA_CONTRACT.structureRecipes),surfaceProgram:copy(HUMAN_DNA_CONTRACT.surfaceProgram),precisionPolicy:copy(HUMAN_DNA_CONTRACT.precisionPolicy),
  provenance:{generatorRevision:HUMAN_GENERATOR_REVISION,sourceLocks:copy(HUMAN_DNA_CONTRACT.sourceLocks),semanticFreezeCommit:HUMAN_DNA_CONTRACT.semanticFreezeCommit,parameterOrigin:'BodyParts3D fitted shape and joint estimates; tuned Motion-Lab kernel with CMU and declared task extensions',rig:copy(R2_RIG.source),motion:copy(R2_MOTION.source),motionKernel:copy(MotionLab.sourceLock),actionExtensions:copy(MOTION_ACTIONS)},
  evidence:copy(HUMAN_DNA_CONTRACT.evidenceLedger),uncertainty:copy(HUMAN_DNA_CONTRACT.uncertainty),observations:[],independentObservationRoots:[],
  currentBestView:{policy:copy(HUMAN_DNA_CONTRACT.viewPolicy),recomputeWith:'HumanLab.npc.preview(document.definition)',scope:'character recipe; not animation resumption'},
  validation:copy(HUMAN_DNA_CONTRACT.acceptance)
 });
 const api={describe,export:exportDocument,contract:()=>copy(HUMAN_DNA_CONTRACT)};
 const button=document.createElement('button');button.id='npc-dna-export';button.textContent='导出人物配方与依据';
 button.onclick=()=>{const document=exportDocument();hfDownload(document.objectId+'.human-dna.json',JSON.stringify(document,null,2),'application/json');};
 document.getElementById('npc-export').after(button);return api;
}
