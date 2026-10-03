import fs from 'node:fs';import {validateProfile} from '../src/animal-profile.js';import {validateBasic} from '../src/basic-data.js';import {parameters,plain,ENGINES,compatible,validateGLB,unbase64} from '../src/kaopu.js';
// Receiver-side semantics. Import preview additionally validates live control ranges and resources.
export function checkAnimalPackage(input){
 const d=input?.schema==='kaopu/content@1'?input.payload:input;
 if(input?.schema==='kaopu/content@1'&&d?.asset?.format==='atlas-reference')throw Error('Content needs independent animal data, not an installed reference');
 if(input?.schema==='kaopu/content@1')for(const k of ['knowledge','extensions'])if(input[k]!==undefined&&!plain(input[k]))throw Error(k+' must be an object');
 if(d?.schema!=='kaopu/animal@1'||!plain(d.animal)||d.score?.schema!=='kaopu/score@1')throw Error('Expected a full kaopu/animal@1 or content@1 package');
 if(typeof d.animal.name!=='string'||!d.animal.name.trim()||d.animal.name.length>60||!['land','ocean','birds','coast'].includes(d.animal.category))throw Error('Invalid name/category');
 validateBasic(d.animal.basicData);const p=validateProfile(d.animal.profile);parameters(d.score.parameters);
 if(!plain(d.instrument)||typeof d.instrument.id!=='string'||!d.instrument.id||typeof d.instrument.version!=='string'||!d.instrument.version||!compatible(d.score.instrument,d.instrument))throw Error('Instrument/score mismatch');
 if(d.score.profile&&JSON.stringify(validateProfile(d.score.profile))!==JSON.stringify(p))throw Error('Animal/score profiles conflict');if(d.score.basicData)validateBasic(d.score.basicData);
 if(d.asset?.format==='glb'){if(d.asset.encoding!=='base64')throw Error('Invalid GLB encoding');validateGLB(unbase64(d.asset.data));if(!compatible(d.instrument,{...ENGINES.GLB,assetSha256:d.instrument.assetSha256})||!/^([a-f0-9]{64})$/.test(d.instrument.assetSha256))throw Error('GLB instrument needs exact fingerprint');}
 else if(d.asset?.format==='atlas-reference'){if(typeof d.asset.animalId!=='string'||!d.asset.animalId)throw Error('Missing installed animal reference');}
 else if(typeof d.score.notation==='string'&&/^K[45]\|/.test(d.score.notation)&&d.score.notation.length<=100000){if(!compatible(d.instrument,ENGINES[d.score.notation.slice(0,2)]))throw Error('Notation/instrument mismatch');}
 else throw Error('Missing complete registered notation or supported asset');
 return {schema:d.schema,instrument:d.instrument,profile:p,needsRealImportPreview:true};
}
if(process.argv[2]){try{console.log(JSON.stringify(checkAnimalPackage(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
