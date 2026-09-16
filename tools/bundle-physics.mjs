// Source-only linker: checks pinned bytes and rewrites one terminal ESM export.
// It does not import, evaluate or run the physics engine or application.
import {createHash} from 'node:crypto';
export function bundlePhysics(read){
 const lock=JSON.parse(read('world/physics/source-lock.json'));
 if(lock.engine!=='cannon-es'||lock.version!=='0.20.0')throw Error('Unexpected physics source lock');
 for(const entry of lock.files){
  if(createHash('sha256').update(read(entry.path)).digest('hex')!==entry.sha256)throw Error('Physics source hash mismatch: '+entry.path);
 }
 const source=read('world/physics/vendor/cannon-es.js');
 const terminal=/\nexport \{ ([\w, ]+) \};\s*$/;
 if(!terminal.test(source)||/^\s*import\s/m.test(source))throw Error('Unexpected physics module structure');
 const core=source.replace(terminal,(_,names)=>'\nreturn Object.freeze({'+names+'});\n');
 if(/^\s*export\s/m.test(core))throw Error('Unresolved physics module export');
 return read('world/physics/vendor/LICENSE')+'\nconst WorkbenchPhysicsEngine=(()=>{\n'+core+'})();';
}
