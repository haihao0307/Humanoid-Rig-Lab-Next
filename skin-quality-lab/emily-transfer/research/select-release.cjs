const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
// Run after the historical reconstruction steps. Selection is based on the
// four-filter browser comparison, not on whichever method sounds most advanced.
let app=fs.readFileSync(root+'/app.js','utf8');
app=app.replace("import {installSoftOcularShadows} from './research/SoftOcularShadows.js';\ninstallSoftOcularShadows();\n",'');
if(app.includes('installSoftOcularShadows();'))throw Error('Rejected PCSS candidate is still active');
app=app.replace('renderer.shadowMap.type=THREE.PCFSoftShadowMap;','renderer.shadowMap.type=THREE.PCFShadowMap;');
app=app.replace('key.shadow.mapSize.set(4096,4096);key.shadow.radius=2;','key.shadow.mapSize.set(2048,2048);key.shadow.radius=10;');
app=app.replace('key.shadow.normalBias=.00012;','key.shadow.normalBias=.00022;');
fs.writeFileSync(root+'/app.js',app);
let eye=fs.readFileSync(root+'/eyes/EyeSystem.js','utf8');
eye=eye.replace("if(o.fixedTarget)this.setTarget(o.fixedTarget);if(o.mode)this.setMode(o.mode);","if(o.fixedTarget)this.setTarget(o.fixedTarget);if(o.mode==='fixed')this.config.mode='fixed';else if(o.mode)this.setMode(o.mode);");
fs.writeFileSync(root+'/eyes/EyeSystem.js',eye);
let research=fs.readFileSync(__dirname+'/ResearchEyes.js','utf8');
research=research.replace("const t=j/lid.ni*.42,idx=Math.round(t*lid.R)*(lid.A+1)+i,x=P.getX(idx),y=P.getY(idx),z=this.eyeFront(c,x,y);\n   IP.setXYZ(j*(lid.A+1)+i,x,y,z===null?P.getZ(idx)-.0003:z+.000035);",`const row=j/lid.ni*.42*lid.R,lo=Math.floor(row),hi=Math.min(lid.R,lo+1),f=row-lo;
   const ia=lo*(lid.A+1)+i,ib=hi*(lid.A+1)+i;
   const x=lerp(P.getX(ia),P.getX(ib),f),y=lerp(P.getY(ia),P.getY(ib),f),z=this.eyeFront(c,x,y),outerZ=lerp(P.getZ(ia),P.getZ(ib),f);
   IP.setXYZ(j*(lid.A+1)+i,x,y,z===null?outerZ-.0003:z+.000035);`);
// Explicitly dispose the new depth materials when the rig is unloaded.
research=research.replace("dispose(){for(const e of this.eyes)e.edgeMap?.dispose();super.dispose();}","dispose(){for(const e of this.eyes){e.edgeMap?.dispose();e.lid.mesh.customDepthMaterial?.dispose();}super.dispose();}");
fs.writeFileSync(__dirname+'/ResearchEyes.js',research);
let html=fs.readFileSync(root+'/index.html','utf8');const sha=process.env.ASSET_COMMIT,prefix='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/skin-quality-lab/';
html=html.replaceAll('../r01/',prefix+'r01/').replaceAll('../r02/',prefix+'r02/');fs.writeFileSync(root+'/index.html',html);
const manifest=JSON.parse(fs.readFileSync(root+'/BUILD_MANIFEST.json','utf8'));
Object.assign(manifest,{shadowMethod:'Three.js 17-tap PCF, 2048 map, radius 10; matched eyelid depth surface',pcssCandidateShipped:false,shadowSelectionEvidenceRun:37769859569,innerContactRowsInterpolated:true,fixedTargetRecipeRestoration:true,fullNeuralReconstruction:false});fs.writeFileSync(root+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));
require('./bundle.cjs');
