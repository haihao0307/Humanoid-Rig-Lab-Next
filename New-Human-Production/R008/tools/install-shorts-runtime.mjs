import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

// Dependencies are code only. The character and cloth still come from their
// original generators; no model, texture, image or formed vertex data is read.
const root=fileURLToPath(new URL('../',import.meta.url));
const expectedVersion='0.184.0';
const expectedFiles={
 'three.module.js':'61134198639a10885daf893fb29669ca26386e2a4cde76e8399f51e329f741f2',
 'three.core.js':'368dc78835287709a48939e8eb9a7a61d0732098bdf916e56840d458aae9ccf3',
 'OrbitControls.js':'faabb4e8dfd9235ee4a9fd7c9a3d75f90f1689dbd4944bd6fd32117dacec5f93'
};
if(!process.argv.includes('--verify-only')){
 const npm=process.platform==='win32'?'npm.cmd':'npm';
 const result=spawnSync(npm,['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
 if(result.status!==0)throw Error('Pinned Three.js installation failed');
 const pkg=JSON.parse(readFileSync(resolve(root,'node_modules/three/package.json'),'utf8'));
 if(pkg.version!==expectedVersion)throw Error('Unexpected Three.js version');
 mkdirSync(resolve(root,'vendor'),{recursive:true});
 for(const [from,to] of [['build/three.module.js','three.module.js'],['build/three.core.js','three.core.js'],['examples/jsm/controls/OrbitControls.js','OrbitControls.js'],['LICENSE','THREE-LICENSE.txt']])copyFileSync(resolve(root,'node_modules/three',from),resolve(root,'vendor',to));
}
for(const name of ['three.module.js','three.core.js','OrbitControls.js']){
 const file=resolve(root,'vendor',name);
 if(!existsSync(file))throw Error('Missing runtime dependency: '+name);
 const bytes=readFileSync(file),sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==expectedFiles[name])throw Error('Runtime bytes differ from the verified pinned version: '+name);
 console.log(JSON.stringify({file:name,bytes:bytes.length,sha256}));
}
