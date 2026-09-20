// Source-content contracts only. No skin functions, UI, renderer or GPU run.
export function checkSkinAppearanceSources({parse,read,assert}){
 let checks=0;const check=(ok,message)=>{assert(ok,'Skin appearance: '+message);checks++;};
 const skin=read('body/SkinAppearance.js'),character=read('body/CharacterPresets.js'),state=read('body/ReconstructionState.js'),renderer=read('body/CompactWorkbench.js'),shader=read('body/TissueShaders.js'),settings=read('body/BodySettings.js');
 const ast=parse(skin,{ecmaVersion:'latest',sourceType:'module'}),manifest=JSON.parse(read('source/assembly.json'));
 check(manifest.modules.filter(p=>p==='body/SkinAppearance.js').length===1&&read('source/runtime.template.js').includes('/*__SOURCE:body/SkinAppearance.js__*/'),'skin module has one assembly owner');
 const initial=name=>ast.body.flatMap(n=>n.declarations||[]).find(n=>n.id.name===name)?.init;
 // Extract only literal catalog data. Never eval/import the application module.
 const literal=n=>{
  if(n?.type==='Literal')return n.value;
  if(n?.type==='UnaryExpression'&&n.operator==='-')return -literal(n.argument);
  if(n?.type==='Identifier'&&n.name==='SKIN_SCHEMA')return initial('SKIN_SCHEMA').value;
  if(n?.type==='ArrayExpression')return n.elements.map(literal);
  if(n?.type==='ObjectExpression')return Object.fromEntries(n.properties.map(p=>[p.key.name||p.key.value,literal(p.value)]));
  throw Error('Skin catalog must remain literal data');
 };
 const defaults=literal(initial('SKIN_DEFAULT').arguments[0]),controls=literal(initial('SKIN_CONTROLS').arguments[0]),presets=literal(initial('SKIN_PRESETS').arguments[0]),eastAsian=literal(initial('EAST_ASIAN_SKIN_PRESETS').arguments[0]);
 check(defaults.schema==='jarvis/skin_appearance@2','explicit recipe version');
 check(controls.length===9&&new Set(controls.map(c=>c.key)).size===controls.length,'independent control names');
 const exposure=literal(initial('SKIN_EXPOSURE_PRESETS').arguments[0]);
 check(exposure.length===4&&new Set(exposure.map(p=>p.id)).size===4&&exposure.every(p=>p.sunExposure>=0&&p.sunExposure<=1&&p.weathering>=0&&p.weathering<=1),'four bounded outdoor histories');
 check(defaults.sunExposure===exposure[1].sunExposure&&defaults.weathering===exposure[1].weathering,'new recipe uses moderate daily outdoor default');
 check(/legacy\?\{sunExposure:0,weathering:0\}/.test(skin)&&/schema:SKIN_SCHEMA\};/.test(skin)&&/legacy&&\(Object.hasOwn\(input,'sunExposure'\)/.test(skin),'v1 imports preserve old shading and reject v2-only fields');
 check(/api.set\(\{sunExposure:p.sunExposure,weathering:p.weathering\}\)/.test(skin),'outdoor profile retains base colour and independent surface settings');
 for(const c of controls)check(Number.isFinite(c.min)&&Number.isFinite(c.max)&&c.min<c.max&&c.step>0&&defaults[c.key]>=c.min&&defaults[c.key]<=c.max,'bounded default: '+c.key);
 check(presets.length===8&&new Set(presets.map(p=>p.id)).size===presets.length,'eight general swatches remain available');
 check(eastAsian.length===12&&new Set([...presets,...eastAsian].map(p=>p.id)).size===20,'twelve scene swatches have distinct IDs alongside the general palette');
 check(eastAsian.every(p=>/^#[0-9a-f]{6}$/.test(p.baseColor)&&p.undertone>=-1&&p.undertone<=1&&p.redness>=0&&p.redness<=1),'scene colours and pigment controls are bounded');
 check(defaults.baseColor===eastAsian[5].baseColor&&defaults.undertone===eastAsian[5].undertone&&defaults.redness===eastAsian[5].redness,'scene default matches the medium neutral swatch');
 check(defaults.redness>0&&eastAsian.every(p=>p.redness>0)&&/const redness=palette==='east-asian'/.test(skin),'reusable skin palettes retain bounded redness variation');
 check(/function initialCharacterPreset\(\).*redness:0/.test(character),'current face mother disables redness in its own character recipe');
 check(presets.every(p=>/^#[0-9a-f]{6}$/.test(p.baseColor)&&p.undertone>=-1&&p.undertone<=1)&&/^#[0-9a-f]{6}$/.test(defaults.baseColor),'valid sRGB swatch values');
 // Independent luminance check of the authored ramp, excluding the reference.
 const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const ramp=presets.slice(1).map(p=>luminance(p.baseColor));check(ramp.every((v,i)=>i===0||v<ramp[i-1])&&ramp[0]/ramp.at(-1)>10,'light-to-dark ramp is ordered with substantial range');
 for(let column=0;column<4;column++)check(luminance(eastAsian[column].baseColor)>luminance(eastAsian[4+column].baseColor)&&luminance(eastAsian[4+column].baseColor)>luminance(eastAsian[8+column].baseColor),'scene lightness is ordered within undertone family '+column);
 check(/function sampleSkinAppearance\(seed,palette='east-asian'\)/.test(skin)&&/ramp=\[catalog\[family\],catalog\[4\+family\],catalog\[8\+family\]\]/.test(skin),'default generation interpolates only within one scene undertone family');
 check(/api\.sample\(Number\(el\('seed'\)\.value\),el\('palette'\)\.value\)/.test(skin)&&/api\.set\(\{baseColor:p\.baseColor,undertone:p\.undertone,redness:p\.redness\}\)/.test(skin),'UI generation follows selected range; swatches retain surface settings');
 check(/skin:sampleSkinAppearance\(\(i\+1\)\*4101\)/.test(read('body/NPCDefinitions.js')),'resident NPCs receive deterministic scene skin variation');
 check(/Number\.isFinite\(p\[c\.key\]\)/.test(skin)&&/Object\.hasOwn\(SKIN_DEFAULT,k\)/.test(skin)&&/input\.schema!==SKIN_SCHEMA/.test(skin),'unknown fields, versions and non-finite controls rejected');
 check(/Number\.isInteger\(seed\)/.test(skin)&&/seed<0\|\|seed>4294967295/.test(skin)&&!/Math\.random|Date\.|performance\./.test(skin),'seed includes zero and is independent of wall time/global randomness');
 check(/skinHexToLinear\(ramp\[index\]\.baseColor\)/.test(skin)&&/skinLinearToHex\(a\.map/.test(skin),'seeded ramp interpolates linear colours');
 check(/value<=\.04045\?value\/12\.92/.test(skin)&&/value<=\.0031308\?value\*12\.92/.test(skin),'piecewise sRGB input and legacy output conversion');
 check(/if\(appearance\.skin!==undefined\)return validateSkinAppearance/.test(skin)&&/baseColor:skinLinearToHex\(appearance\.skinColor\),undertone:0,redness:\.15/.test(skin),'explicit recipe wins; legacy linear colour keeps its original tint controls');
 check(character.includes("'jarvis/character_preset@3','jarvis/character_preset@4','jarvis/character_preset@5','jarvis/character_preset@6'")&&character.includes("schema:'jarvis/character_preset@6'"),'version 3, 4 and 5 imports migrate to version 6');
 check(/skinColor:skinHexToLinear\(skin\.baseColor\)/.test(character)&&!/skinColor:\[\.497/.test(character),'preset validation preserves chosen colour');
 check(/skin:sampleSkinAppearance\(seed\)/.test(character)&&/lab\.human\.tissue\.setSkinAppearance\(p\.appearance\.skin\)/.test(character),'derived characters and full character apply reach skin');
 check(/this\.setSkinAppearance\(human\.characterPreset\.appearance\.skin\)/.test(state),'initial body honours the imported skin');
 check(/lab\.human\.tissue\.setSkinAppearance\(p,material\)/.test(skin)&&/lab\.human\.characterPreset=\{\.\.\.lab\.human\.characterPreset,appearance\}/.test(skin),'live appearance edits retain other character fields');
 check(!/loadCompactSurface|new Worker|bufferData|new StrengthModel|ecology\.step|\.render\(|\.fk\(/.test(skin),'skin edit module cannot trigger geometry, motion or biology evaluation');
 check(/skinAppearance:lab\.skin\?\.report\(\)/.test(read('body/HumanDNA.js'))&&/character=validateCharacterPreset/.test(read('body/NPCDefinitions.js')),'NPC and DNA export retain the recipe');
 check(/lab\.skin=installSkinAppearance\(lab\)/.test(settings)&&/\['skin','皮肤与肤色','skin-panel'/.test(settings)&&/lab\.settings\.open\('skin'\)/.test(renderer),'settings entry and scene shortcut installed');
 check(/file\.size>16384/.test(skin)&&/p\?\.schema!==SKIN_SCHEMA/.test(skin)&&/role="status"/.test(skin),'file import is bounded and reports errors');
 for(const name of ['skinSurface','skinDetail','skinSeedOffset'])check(shader.includes(name)&&renderer.includes("'"+name+"'")&&renderer.includes('gl.uniform3fv(p.u.'+name+','),'declared, located and uploaded vec3: '+name);
 check(/uniform vec2 skinExposure;/.test(shader)&&renderer.includes("'skinExposure'")&&renderer.includes('gl.uniform2fv(p.u.skinExposure,skin.exposure)')&&skin.includes('exposure:[p.sunExposure,p.weathering]'),'two exposure values reach the existing draw program');
 check(shader.includes('sunMask=controlled*max(headExposure,max(.82*forearmExposure,bodyExposure))')&&/color\*=vec3\(1.\)-sunMask\*skinExposure.x/.test(shader)&&/outdoorRoughness=skinExposure.y\*sunMask/.test(shader),'canonical exposed regions share bounded colour and independent roughness changes');
 const bodyExposure=shader.slice(shader.indexOf('float skinBodyExposure('),shader.indexOf('void main(){',shader.indexOf('float skinBodyExposure(')));
 check(shader.includes('skinBodyExposure(R,variation,footprint,seedOffset)')&&!/skinNoise|\bP\b|\bN\b|texture\(/.test(bodyExposure),'body tan stays in source skin coordinates and reuses existing variation');
 check(['collarHeight','shoulders','fadedTorso','sleeve','shorts','aboveSock'].every(name=>bodyExposure.includes(name))&&bodyExposure.includes('return clamp('),'body tanning includes bounded shoulder, torso, clothing and footwear exposure');
 check(bodyExposure.includes('max(.012,min(.04,footprint*1.5))')&&bodyExposure.includes('edgeShift=hemShift+.008*variation'),'clothing transitions have a minimum soft width and bounded seeded variation');
 check(shader.includes('sunMask*skinExposure.x*vec3(.55,.66,.74)')&&.74<1,'outdoor contrast stays multiplicative with positive colour at maximum exposure');
 check(renderer.includes("gl.uniform1f(p.u.compactEarClearance,c.name==='skin'?1:0)")&&renderer.includes("'compactEarClearance'")&&/uniform float compactEarClearance(?:[,;])/.test(renderer),'ear underlay correction is enabled only for the cranial skin chunk');
 check(renderer.includes('compactClearEar(source,n);')&&renderer.includes('p.x-=side*.008*gate*falloff')&&renderer.includes('n.yz+side*.008*gate*slope*nx'),'ear correction moves the underlying head and transforms its normal together');
 check(1-.008*1.5/.045>.73&&renderer.includes('abs(p.x)-.020)/.045')&&renderer.includes('nx=n.x/(1.-.008*falloff*gateDerivative)'),'bounded symmetric ear recess has a positive deformation Jacobian');
 check(renderer.includes('this.depth=program(this.gl,COMPACT_VERTEX')&&renderer.indexOf('R=canonicalPosition;')>=0&&renderer.indexOf('R=canonicalPosition;')<renderer.indexOf('compactClearEar(source,n);'),'colour and shadow share the corrective; pigment retains its original material coordinates');
 const earMesher=read('reconstruction/mesher.mjs');
 check(earMesher.includes("quality==='preview'?1400:quality==='close'?4000:2400")&&earMesher.includes('baseRefinementBudget+faceRefinementBudget+earRefinementBudget')&&earMesher.includes('domainSplitBudget+=earBudgets.get(data.fields.domains[di].id)||0'),'ear sampling has an explicit finite quota and is charged to total refinement');
 check(earMesher.includes("c.semanticRegion==='head_face_ears'&&c.heightAxis===0")&&earMesher.includes("earPatch?Math.min(edgeLimit,quality==='close'?.0015:.002):edgeLimit"),'extra ear samples are confined to overlapping side-head charts');
 check(/const skin=this\.lab\.human\.tissue\.skinMaterial/.test(renderer)&&/gl\.uniform1f\(p\.u\.skinControlled,1\)/.test(renderer),'draw consumes current cached material');
 check(/isSkin=c\.name==='skin'\|\|c\.name==='FJ2811'/.test(renderer)&&/isSkin\?skin\.color/.test(renderer),'body and external ears share skin colour');
 check(/sclera=\['FJ1317','FJ1368','eyeSclera'\]/.test(renderer)&&/brow\?\[\.038,\.023,\.015\]:beard\?\[\.046,\.029,\.019\]:sclera\?\[\.52,\.50,\.44\]/.test(renderer)&&/lip\?skin\.color/.test(renderer)&&renderer.includes('compactLipPigment(R)'),'sclerae, brows and beard retain independent colour; lips follow skin');
 check(/this\.view==='clay'\|\|this\.view==='regions'\?7:isSkin\?1/.test(renderer),'clay and region inspection bypass skin shading');
 const skinSurface=read('body/SkinSurface.js');
 check(manifest.modules.filter(p=>p==='body/SkinSurface.js').length===1&&read('source/runtime.template.js').includes('/*__SOURCE:body/SkinSurface.js__*/'),'one procedural skin-surface assembly owner');
 check(shader.includes('${compactSkinSurfaceShader()}')&&shader.includes('compactSkinEvaluate(R,restNormal,footprint,seedOffset,surface,detail,skinStretch)')&&shader.includes('footprint=max(length(dFdx(R)),length(dFdy(R)))')&&shader.includes('restNormal=cross(dFdx(R),dFdy(R))'),'material evaluation and projection use canonical coordinates and pixel footprint');
 check(!/uniform sampler|texture\(/.test(skinSurface)&&!/Math\.random|Date\.|performance\./.test(skinSurface),'skin surface has no imported texture or time-dependent identity');
 check(/skinRegion\(R,/.test(shader)&&/skinRegion\(symmetricRest,/.test(shader)&&/tZone=.*controlled/.test(shader),'continuous R2 anatomical masks are restricted to the controlled body');
 check(shader.includes('rough=clamp(skinSample.roughness+')&&shader.includes('skinCavity=skinSample.cavity;')&&shader.includes('reliefHeight=skinSample.heightM*')&&shader.includes('n=normalize(n-grad);'),'independent evaluated channels reach shading without applying detail control twice');
 check(shader.includes('color*=skinSample.pigment;')&&!/color\*=.*pore|color\+=.*pit/.test(shader),'pore depressions do not paint dark pigment dots');
 check(/float fresnel=\.028\+\.972/.test(shader)&&/return distribution\*geometryV\*geometryL\*fresnel\*nl/.test(shader),'neutral dielectric reflection responds to incident light');
 check(/scatter\*surface\.z\*s/.test(shader)&&!/scatter\*\(\.35\+\.65\*s\)/.test(shader),'warm response is shadowed and controlled');
 // Verify literal shader patch anchors, avoiding silent string-replace misses.
 const renderAST=parse(renderer,{ecmaVersion:'latest',sourceType:'module'}),shaderAST=parse(shader,{ecmaVersion:'latest',sourceType:'module'});
 const template=shaderAST.body.flatMap(n=>n.declarations||[]).find(n=>n.id.name==='TISSUE_FRAGMENT_SHADER').init;
 check(template.expressions.length===1&&template.expressions[0].callee?.name==='compactSkinSurfaceShader','only the owned procedural surface library is injected');
 const fs=template.quasis.map(part=>part.value.cooked).join('');
 const fragment=renderAST.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='compactFragmentSource');let patches=0;
 const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='replace'&&n.arguments[0]?.type==='Literal'){
   const anchor=n.arguments[0].value;check(typeof anchor==='string'&&fs.split(anchor).length===2,'unique fragment patch anchor '+(++patches));
  }for(const [key,value]of Object.entries(n))if(!['start','end','loc'].includes(key))visit(value);
 };visit(fragment);check(patches===13&&renderer.includes('frag=vec4(skinOutputSRGB(c),alpha);')&&renderer.includes('in vec3 personalRestPosition;')&&renderer.includes('compactEyeContactVisibility(compactEyeContactPosition)')&&renderer.includes('normalStrength')&&renderer.includes('length(cross(dFdx(personalRestPosition),dFdy(personalRestPosition)))')&&renderer.includes('screenScatter*=1.-compactLipPigment(R)'),'thirteen complete patches including aperture light access, lip transport exclusion, relief, posed contact, personal rest area and sRGB output');
 check(renderer.includes('reliefHeight=mix(reliefHeight,compactLipMicrorelief(R)/sqrt(skinStretch),lipWeight)')&&renderer.includes('lipMoisture=compactLipMoisture(R)')&&renderer.includes('rough=mix(rough,mix(.46,.31,lipMoisture),lipWeight)')&&read('body/FaceAnatomy.js').includes('fwidth(phase)'),'lip microrelief is filtered and enters the shared surface-gradient lighting path');
 check(renderer.includes('compactRotate(qr,cavityAxis)')&&renderer.includes('compactFaceIdentity(aperturePoint,cavityAxis)')&&renderer.includes('shade(n,l)*compactCavityAccess(l)')&&renderer.includes('compactCavityAccess(diffuseFillDirection)')&&renderer.includes('compactCavityAccess(fillDirection)'),'aperture direction follows head and identity, and gates key plus diffuse and specular fill');
 check(/runtimeVerified:false,visualAcceptance:false/.test(skin)&&JSON.parse(read('body/HumanDNAContract.json')).acceptance.visualAcceptance===false,'file checks do not claim visual acceptance');
 return {checks,presets:presets.length+eastAsian.length,scenePresets:eastAsian.length,controls:controls.length,applicationExecuted:false,skinFunctionsExecuted:false,shaderCompiled:false,visualAcceptance:false};
}
