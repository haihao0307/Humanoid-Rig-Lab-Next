/** Early-return regression: seam metadata is not conditional on a new force link. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require(path.resolve(process.env.BASE_LIB)),B=require('./node-lib.cjs');
function probe(L){const b=new L.PanelAssembly({});b.positions=[0,0,0];b.idsAt=()=>({ids:[0,0,0,0],weights:[1,0,0,0]});const p={name:'same-panel',index:0,t:1,map:()=>new L.T.Vector3()};b.connect(p,[0,0],p,[0,0]);return{links:b.surfaceLinks,seams:b.collisionSeams};}
const a=probe(A),b=probe(B);assert.equal(b.links.length,0);assert.equal(b.seams.length,1);assert.deepEqual(b,a);
const report={pass:true,checks:3,case:'same-chart zero-length connection: no force link, one unchanged collision-seam record',reference:a,candidate:b};
fs.mkdirSync(path.join(__dirname,'qa/s1b'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/s1b/interfaces.json'),JSON.stringify(report,null,2)+'\n');console.log('Explicit interface early-return gates: 3 passed');
