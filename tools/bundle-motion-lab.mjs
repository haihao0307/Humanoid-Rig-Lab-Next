// A small file-only linker for the pinned, dependency-free lab modules.
// It never imports or evaluates motion code. Each module keeps its own scope.
import {createHash} from 'node:crypto';
export function bundleMotionLab(read){
 const lock=JSON.parse(read('motion/source-lock.json'));
 const ordered=['math','world','rig','clock','walk-data','full-body','controller','camp-routines'];
 const names=new Set(),chunks=[];
 for(const name of ordered){
  const path='motion/vendor/'+name+'.mjs',source=read(path);
  const expected=lock.files.find(f=>f.path===path)?.sha256;
  if(createHash('sha256').update(source).digest('hex')!==expected)throw Error('Motion lab source hash mismatch: '+path);
  const exports=[...source.matchAll(/\bexport\s+(?:const|class|function)\s+(\w+)/g)].map(m=>m[1]);
  let text=source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)\.mjs['"];?/g,(_,members,dependency)=>{
   if(!names.has(dependency))throw Error('Unresolved motion module: '+dependency);
   if(!/^[\w\s,]+$/.test(members))throw Error('Unsupported import declaration');
   return 'const {'+members+'}=modules['+JSON.stringify(dependency)+'];';
  }).replace(/\bexport\s+(?=const|class|function)/g,'');
  if(/\b(?:import|export)\s+(?:\{|\*|default|['"])/.test(text))throw Error('Unsupported motion module syntax');
  // Expose pure pose helpers only to the in-package skin adapter. The pinned
  // source remains byte-identical to the user's independently tuned lab.
  if(name==='full-body')exports.push('blend','relaxedHandRotation');
  chunks.push('modules['+JSON.stringify(name)+']=(()=>{\n'+text+'\nreturn {'+exports.join(',')+'};\n})();');names.add(name);
 }
 return 'const MotionLab=(()=>{const modules={};\n'+chunks.join('\n')+'\nreturn Object.freeze({...modules.math,...modules.rig,...modules.clock,...modules["full-body"],...modules.controller,...modules["camp-routines"],FlatWorld:modules.world.FlatWorld,revision:"R2.2",sourceLock:'+JSON.stringify(lock)+'});})();';
}
