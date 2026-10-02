import fs from 'node:fs';import crypto from 'node:crypto';import {esbuild} from './dependencies.mjs';
const text=fs.readFileSync('references/fish-scene/readable.js','utf8');
let prefix=text.slice(0,text.indexOf('const Vc = document.getElementById("msg")'));
// The fallback backend sets draw buffers before binding the new framebuffer.
// With an external renderer resetting to the canvas between frames this is invalid.
prefix=prefix.replace('s.drawBuffers(e, v);\n    }\n    s.bindFramebuffer(t.FRAMEBUFFER, i);','s.bindFramebuffer(t.FRAMEBUFFER, i);s.drawBuffers(e, v);\n    }\n    s.bindFramebuffer(t.FRAMEBUFFER, i);');
prefix=prefix.replace('return { pipeline: x, render:', 'return { scenePass:i, pipeline: x, render:');
prefix=prefix.replace('new dm(1, 4)','new dm(1, 7)');
prefix=prefix.replace('o.mul(2.2).add(0.46)','o.mul(.8).add(.72)');
// Keep the deployed reference's original terrain, rock distribution, kelp, caustics,
// water surface, bubbles and water-colour nodes. Only the application entry is replaced.
prefix=prefix.replace('const ct = m.time;','const atlasSimulationClock=m.uniform(0);const ct=atlasSimulationClock;');
const entry=fs.readFileSync('src/reference-water-entry.js','utf8');
const compiled=await esbuild().transform(prefix+'\n'+entry,{minify:true,legalComments:'inline',target:'es2022'});
fs.writeFileSync('src/reference-water-runtime.js',compiled.code);
const sha=crypto.createHash('sha256').update(fs.readFileSync('references/fish-scene/deployed.js')).digest('hex');
fs.writeFileSync('references/fish-scene/PROVENANCE.json',JSON.stringify({url:'https://threejs-fish.vercel.app/',bundle:'/assets/index-jJp4j2KC.js',sha256:sha,downloadedAt:new Date().toISOString(),adaptation:'Original scene factory and shading nodes retained; shared WebGL2 backend and workbench camera; project-owned kelp and rock refinements'},null,2));
console.log('Reference water scene prepared',compiled.code.length);
