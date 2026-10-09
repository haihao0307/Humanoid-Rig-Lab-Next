const fs=require('fs'),path=require('path'),file=path.join(__dirname,'ResearchEyes.js');let s=fs.readFileSync(file,'utf8');
if(!s.includes('// ET03 observed closed-envelope fit R5')){
 const anchor='e.ball.geometry.dispose();e.ball.geometry=opticalMesh(e.c.radius);';if(!s.includes(anchor))throw Error('Eye geometry fit anchor absent');
 s=s.replace(anchor,`// A conservative fit from this head's observed closed outer surface.
    // This estimates depth only; it is not multiview iris-based calibration.
    const oldDepth=e.c.z,r=e.c.radius;let limit=oldDepth,samples=0;
    for(let ix=-12;ix<=12;ix++)for(let iy=-12;iy<=12;iy++){
     const x=ix/12*r*.80,y=iy/12*r*.80;if(x*x+y*y>r*r*.64)continue;
     const observed=e.c.referenceSurface(e.c.x+x,e.c.y+y);
     const envelope=ocularHeight(r,x,y);if(!envelope.valid)continue;
     limit=Math.min(limit,observed.z-envelope.z-.00045);samples++;
    }
    const fitted=Math.max(oldDepth-.004,limit);
    e.c.z=fitted;e.pivot.position.z=fitted;
    e.depthFit={source:'same closed-scan surface',method:'conservative outer-envelope constraint',assumedClosedGaze:'neutral',samples,initialDepthMM:oldDepth*1000,fittedDepthMM:fitted*1000,depthShiftMM:(fitted-oldDepth)*1000,limited:fitted!==limit,notFullPaperCalibration:true};
    e.ball.geometry.dispose();e.ball.geometry=opticalMesh(e.c.radius);`);
 s=s.replace("neuralTrainingPerformed:false,paperReproduction:false,contact:this.eyes.map(e=>e.contactReport)","neuralTrainingPerformed:false,paperReproduction:false,depthCalibration:this.eyes.map(e=>e.depthFit),contact:this.eyes.map(e=>e.contactReport)");
 s+='\n// ET03 observed closed-envelope fit R5\n';fs.writeFileSync(file,s);
}
// Activate the soft geometric shadow module before creating any material programs.
const finishFile=path.join(__dirname,'finish.cjs');let finish=fs.readFileSync(finishFile,'utf8');
if(!finish.includes('// ET03 soft geometric shadow integration R5')){
 const a="let app=fs.readFileSync(root+'/app.js','utf8');";if(!finish.includes(a))throw Error('App integration anchor absent');
 finish=finish.replace(a,a+`\napp=app.replace("import * as THREE from 'three';","import * as THREE from 'three';\\nimport {installSoftOcularShadows} from './research/SoftOcularShadows.js';\\ninstallSoftOcularShadows();");`);
 finish=finish.replace("shadowMethod:'PCFSoft 4096 with matching eyelid displacement and clip mask'","shadowMethod:'PCSS-style orthographic contact-hardening, 4096 packed depth, matched eyelid surfaces',eyeDepthFit:'observed closed outer envelope; neutral-gaze assumption; not full multiview calibration'");
 finish+='\n// ET03 soft geometric shadow integration R5\n';fs.writeFileSync(finishFile,finish);
}
console.log('ET03_CLOSED_ENVELOPE_AND_SOFT_SHADOW_READY');
