'use strict';
const fs=require('fs');let s=fs.readFileSync('src/BodyImplicitAppR26.js','utf8');
function once(a,b){if(s.split(a).length!==2)throw Error('App amendment not unique '+a.slice(0,75));s=s.replace(a,()=>b);}
once('function syncAppearance(){','function syncAppearance(){document.querySelectorAll("[data-source-light-r26]").forEach(e=>{const v=renderer.report().lighting[e.dataset.sourceLightR26];if(v!==undefined)e.value=v;});');
once("e.value=a[e.dataset.appearance];","if(e.type==='checkbox')e.checked=a[e.dataset.appearance]!==false;else e.value=a[e.dataset.appearance];");
once('[data-appearance],#surface-mode-r25','[data-appearance],[data-source-light-r26],#surface-mode-r25');
once("[e.dataset.appearance]:+e.value","[e.dataset.appearance]:e.type==='checkbox'?e.checked:+e.value");
once("document.querySelector('#quality').addEventListener('change'",`document.querySelectorAll('[data-source-light-r26]').forEach(e=>e.addEventListener('input',()=>renderer.lighting({[e.dataset.sourceLightR26]:e.type==='color'?e.value:+e.value})));document.querySelector('#quality').addEventListener('change'`);
once('const own=a.person.bodyFunctionSystem;state=', 'const own=a.person.bodyFunctionSystem;renderer.resetLookR26();state=');
once("if(look[k]!==undefined)a.person.proceduralBodySurface.settings[k]=look[k];","if(look[k]!==undefined)a.person.proceduralBodySurface.settings[k]=look[k];");
fs.writeFileSync('src/BodyImplicitAppR26.js',s);
let r=fs.readFileSync('src/BodyWorkbenchSurfaceR26.js','utf8');const old='const api={field:setField,';if(!r.includes(old))throw Error('Renderer API missing');r=r.replace(old,'const api={resetLookR26(){appearance=structuredClone(baselineAppearance);lighting=structuredClone(baselineLighting);},field:setField,');fs.writeFileSync('src/BodyWorkbenchSurfaceR26.js',r);
