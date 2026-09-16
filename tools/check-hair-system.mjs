// File-content contracts only. Do not import a hair generator, run a Worker,
// build geometry, start the application or compile shaders on a GPU here.
export function checkHairSystemSources({read,parse,runtime,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Hair system: '+message);checks++;};
 const catalog=JSON.parse(read('reconstruction/hair-presets.json')),appearance=JSON.parse(read('reconstruction/appearance.json'));
 const profile=read('reconstruction/hair-profile.mjs'),groom=read('reconstruction/hair-rules-r2.mjs'),hair=read('reconstruction/hair.mjs'),zones=read('reconstruction/hair-zones.mjs');
 const ui=read('body/CompactHairControls.js'),renderer=read('body/CompactHairRenderer.js'),character=read('body/CharacterPresets.js');
 const worker=read('reconstruction/worker.mjs'),bridge=read('body/CompactWorkbench.js'),assembly=read('reconstruction/assembly.mjs');
 for(const source of [profile,groom,hair,zones,ui,renderer,character])parse(source,{ecmaVersion:'latest',sourceType:'module'});
 check(catalog.schema==='human-hair-catalog/v1'&&catalog.applicationExecuted===false&&catalog.visualAcceptance===false,'catalog version and evidence boundary');
 check(catalog.maximumCandidates===96000,'global finite root-candidate budget');
 check(catalog.presets.length===14&&new Set(catalog.presets.map(p=>p.id)).size===14&&new Set(catalog.presets.map(p=>p.seed)).size===14,'fourteen unique named, seeded presets');
 for(const p of catalog.presets){
  check(/^[-a-z]+$/.test(p.id)&&typeof p.label==='string'&&p.label.length>0&&/^#[a-f\d]{6}$/.test(p.color),'usable preset identity and colour');
  check(Number.isInteger(p.seed)&&p.seed>=0&&p.seed<=4294967295,'uint32 preset seed including zero');
  check(['topLength','sideLength','lift','sweep','part','wave','waveCycles','hairline'].every(k=>Number.isFinite(p[k])),'finite authored groom parameters');
  check(p.topLength>0&&p.topLength*1.35*1.06<.065&&p.sideLength>0&&p.sideLength<=p.topLength&&p.lift>0&&p.lift<.01&&p.wave>=0&&p.wave<=.002&&p.waveCycles>0&&p.waveCycles<=2,'bounded scalp guide parameters; free sections use a separate authored design');
 }
 check(catalog.presets.filter(p=>p.design).length===8&&catalog.presets.filter(p=>p.design).every(p=>p.hairline===0&&p.autoSelect===false),'new designs retain the accepted scalp boundary and existing implicit character choices');
 const styles=read('reconstruction/hair-styles.mjs');parse(styles,{ecmaVersion:'latest',sourceType:'module'});
 check(/arcCurve/.test(styles)&&/budget.segmentsPerStrand/.test(hair)&&/styleNormals/.test(styles)&&/styleNormals/.test(renderer)&&(worker.match(/styleNormals.buffer/g)||[]).length===2,'curved designs resample length and budget and transfer their normal buffer in both worker jobs');
 const budgets={};
 for(const [id,b]of Object.entries(catalog.qualities)){
  check(Number.isInteger(b.maximumStrands)&&b.maximumStrands>0&&b.maximumStrands<=12000&&Number.isInteger(b.segmentsPerStrand)&&b.segmentsPerStrand>=4&&b.segmentsPerStrand<=8,'finite geometry budget: '+id);
  budgets[id]={maximumRibbons:b.maximumStrands,segmentsPerRibbon:b.segmentsPerStrand,maximumGeometryBytes:b.maximumStrands*b.segmentsPerStrand*36,maximumTriangles:b.maximumStrands*b.segmentsPerStrand*2};
 }
 check(budgets.economy.maximumGeometryBytes<budgets.balanced.maximumGeometryBytes&&budgets.balanced.maximumGeometryBytes<budgets.closeup.maximumGeometryBytes&&budgets.closeup.maximumGeometryBytes<=3456000,'ordered sub-3.46 MB combined undergrowth and fibre budgets');
 check(appearance.hair.maximumStrands===catalog.qualities[catalog.defaultQuality].maximumStrands&&appearance.hair.segmentsPerStrand===catalog.qualities[catalog.defaultQuality].segmentsPerStrand,'appearance defaults match the shared catalog');
 check(runtime.includes(profile.replace(/^export /gm,'')),'UI and Worker share the exact profile validator and seed hashing source');
 check(/input\.seed\?\?hairSeed/.test(profile)&&!/Math\.random|Date\.now/.test(profile+groom),'stable independent seeds with no ambient randomness');
 check(/Object\.keys\(input\)\.some/.test(profile)&&/Number\.isInteger\(seed\)/.test(profile)&&/seed>4294967295/.test(profile)&&/Object\.hasOwn\(catalog\.qualities,quality\)/.test(profile),'profile rejects unknown fields, malformed seeds and qualities');
 check(/density<\.45\|\|density>1\.3/.test(profile)&&/lengthScale<\.65\|\|lengthScale>1\.35/.test(profile),'user sliders and imports share bounded coverage and length');
 check(/choices=catalog\.presets\.filter/.test(profile)&&/characterSeed.*style/.test(profile),'unconfigured characters select a repeatable style');
 check(/'skinLayers','hair'/.test(character)&&/hair:validateHairProfile\(appearance\.hair,seed,HAIR_CATALOG\)/.test(character)&&/hair:\{\.\.\.base\.appearance\?\.hair,seed:undefined\}/.test(character),'character validation, export and seeded derivation retain hair');
 const apply=character.slice(character.indexOf('async apply(input)'),character.indexOf('setTask(command'));
 check(apply.indexOf('await lab.hair.prepare')<apply.indexOf('commitHair()')&&apply.indexOf('commitHair()')<apply.indexOf('lab.human.characterPreset=p'),'hair success precedes identity mutation');
 check((apply.match(/requireCharacterIdle/g)||[]).length===2&&/previousDefinition/.test(apply)&&/finally\{try\{preparedBody\?\.dispose\(\);\}/.test(apply)&&/finally\{editAgent\.characterEditInProgress=false;api\.busy=false;\}/.test(apply),'async edits recheck character ownership, dispose staged bodies and release both edit flags even if cleanup fails');
 check(/shapeKey\(current\.report\.profile\)===shapeKey\(profile\)/.test(ui)&&/current\.setColor\(profile\.color\)/.test(ui),'colour-only edits reuse the current GPU geometry');
 check(/if\(lab\.hairTask\)await lab\.hairTask\.catch/.test(ui)&&/if\(lab\.compactQualityPending\)throw/.test(ui)&&/lab\.hairTask=task/.test(ui),'hair edits share the startup and quality queue');
 check(/job,hairProfile:hairProfile\?\?\{\}/.test(bridge)&&/hairProfile:data\.hairProfile/.test(worker)&&/hairInputs,progress,hairProfile/.test(assembly),'profile travels from UI through Worker to scalp generation');
 check(/hairProfile\?\.preset==='bald'/.test(assembly)&&assembly.indexOf("hairProfile?.preset==='bald'")<assembly.indexOf("await load('detail.chf.gz')"),'bald preset skips head coefficient decoding');
 check(/heap\.length<maximumStrands/.test(groom)&&/rank>=heap\[0\]\.rank/.test(groom)&&/heap\.sort/.test(groom)&&!/break outer/.test(groom),'bounded priority reservoir covers all eligible charts without prefix starvation');
 check(/Math\.min\(limit,Math\.floor\(cumulative\/area\*limit\)\)/.test(groom)&&/maximumStrands>12000/.test(groom)&&/limit>96000/.test(groom),'allocation and root sampling are capped before work');
 check(/onStrand\(strand\(bundle,0,item\.root\),emitted\+\+\)/.test(groom)&&/heap\.length=0;grid\.clear\(\)/.test(groom)&&!/strands\.push/.test(groom),'curves stream to one typed buffer without retaining strand closures');
 check(/new Float32Array\(maximumStrands\*count\*9\)/.test(hair)&&/storage\.subarray\(0,offset\)/.test(hair)&&!/storage\.slice/.test(hair),'one preallocated, bounded segment buffer and zero-copy view');
 check(/maximumGeometryBytes-\(coverage\?\.geometryBytes\|\|0\)/.test(hair)&&/maximumTriangles-\(coverage\?\.levels\[0\]\.triangles\|\|0\)/.test(hair),'undergrowth bytes and triangles are deducted before allocating fibre ribbons');
 check(/coverage\.positions\.buffer/.test(worker)&&/coverage\.indices\.buffer/.test(worker)&&/hairTransfers/.test(worker),'both hair-only and body-with-hair jobs transfer the undergrowth arrays');
 check((worker.match(/coverage\.regionData\.buffer/g)||[]).length===2&&/c\.regionData\.byteLength/.test(renderer)&&/regionData\.byteLength/.test(hair),'regional coverage attributes are transferred and included in the same byte budget');
 check(/sampleScalpRegion/.test(groom)&&/scalpBoundary/.test(hair)&&!/1\.96-\.83\*front/.test(groom+hair+renderer),'roots and undergrowth use anatomical landmarks, without the old circular cap mask');
 check(/charts\.size>6/.test(hair)&&/progress:report/.test(hair)&&/phase:'roots'/.test(hair),'bounded chart cache and progress heartbeat');
 check(/physicalStrandCount:null/.test(hair)&&/storedDisplayVertices:false/.test(hair)&&/generatedFromCurrentHead:true/.test(hair),'visual bundles do not claim measured follicle density');
 check(/data\.segments\.byteLength>this\.report\.maximumGeometryBytes/.test(renderer)&&/data\.segments\.length!==this\.report\.strands\*this\.report\.segmentsPerStrand\*9/.test(renderer),'upload checks extent and byte budget');
 check(/this\.geometryBytes-44>this\.report\.maximumGeometryBytes/.test(renderer)&&/gl\.deleteVertexArray\(this\.coverageVAO\)/.test(renderer),'combined GPU allocation is budgeted and the base VAO is released');
 check(/gl\.depthMask\(true\)/.test(renderer)&&/gl\.disable\(gl\.BLEND\)/.test(renderer)&&/SAMPLE_ALPHA_TO_COVERAGE/.test(renderer)&&/gl\.SAMPLES/.test(renderer),'depth-writing coverage material has an MSAA availability fallback');
 check(/a\.w<=\.015\|\|b\.w<=\.015/.test(renderer)&&/fwidth\(band\)/.test(renderer),'ribbons guard perspective division and filter procedural fibre frequency');
 const tree=parse(renderer,{ecmaVersion:'latest',sourceType:'module'}),cls=tree.body.find(n=>n.type==='ClassDeclaration');
 for(const name of ['draw','selectLOD','update']){const n=cls.body.body.find(n=>n.key.name===name),s=renderer.slice(n.start,n.end);check(!/bufferData|bufferSubData|new Float32Array|createBuffer|\.sort\(/.test(s),'no geometry allocation or upload in per-frame '+name);}
 check(/thresholds\[this\.lod\]\*\.88/.test(renderer)&&/thresholds\[this\.lod-1\]\*1\.12/.test(renderer)&&/strands\/2\*\*this\.lod/.test(renderer),'pixel-size LOD has bounded nested counts and hysteresis');
 check(/this\.time=.*%3600/.test(renderer)&&/Math\.min\(dt,\.1\)/.test(renderer),'wind time is bounded and does not accumulate unbounded frame deltas');
 check((renderer.match(/drawElementsInstanced\(/g)||[]).length===1&&(renderer.match(/gl\.drawElements\(/g)||[]).length===1,'one fibre submission and one indexed undergrowth submission');
 check(/Math\.min\(this\.lod,this\.coverageMaxLOD\)/.test(renderer)&&/hairBaseInflation/.test(renderer)&&/Math\.max\(thetaStep,phiStep\)<=\.3/.test(hair),'base LOD retains bounded angular spacing and a radial chord margin');
 for(const id of ['preset','seed','color','density','lengthScale','quality','apply','defaults'])check(ui.includes('id="hair-'+id+'"'),'editable profile control '+id);
 return {checks,presets:catalog.presets.map(p=>({id:p.id,seed:p.seed})),budgets,maximumCandidates:catalog.maximumCandidates,applicationExecuted:false,geometryGenerated:false,shadersGPUCompiled:false,performanceMeasured:false,visualAcceptance:false};
}
