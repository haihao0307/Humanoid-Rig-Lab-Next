'use strict';const fs=require('fs');let s=fs.readFileSync('src/BodyRayR21.js','utf8');
function replace(a,b){if(!s.includes(a))throw Error('Probe marker missing: '+a.slice(0,100));s=s.replace(a,b);}
replace('uniform float uCap,','uniform float uProbeDepth;uniform float uCap,');
replace('vec3 p=uEye+rd*t,n=normalAt(p)',`if(uProbeDepth>0.){uint packed=uint(clamp(t/6.,0.,1.)*16777215.);outputColour=vec4(float((packed>>16u)&255u),float((packed>>8u)&255u),float(packed&255u),255.)/255.;return;}vec3 p=uEye+rd*t,n=normalAt(p)`);
replace('vec3 bg=mix(', 'vec3 bg=mix('); // Validate the unchanged normal background path below.
replace('vec2 interval=boundsHit(uEye,rd);','if(uProbeDepth>0.)bg=vec3(0.);vec2 interval=boundsHit(uEye,rd);');
// Uniform locations are collected from declarations by the existing factory.
replace('function draw(){','let probeDepth=false;function draw(){');
replace('gl.useProgram(program);gl.viewport','gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,"uProbeDepth"),probeDepth?1:0);gl.viewport');
replace('return{field,draw,view,scalarFieldAt',`function probeFrame(){probeDepth=true;try{gl.disable(gl.DITHER);draw();const width=canvas.width,height=canvas.height,pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{width,height,pixels,camera:structuredClone(camera),depthRange:6};}finally{probeDepth=false;gl.enable(gl.DITHER);draw();}}\nreturn{field,draw,view,probeFrame,scalarFieldAt`);
replace('continuousRestSpaceSurfaceDetails:true','continuousRestSpaceSurfaceDetails:false,sourceFidelityAccepted:false');
fs.writeFileSync('src/BodyRayR21.js',s);
