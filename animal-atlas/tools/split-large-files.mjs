import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const targets=['dist/animal-atlas-v1.2.0-offline.zip','assets/palau.html','assets/fish.html','assets/crab.html','assets/eagle.html'];
const files=[];
for(const [index,target] of targets.entries()){
 const bytes=fs.readFileSync(path.join(root,target)),parts=[];
 for(let offset=0,part=0;offset<bytes.length;offset+=4*1024*1024,part++){
  const data=bytes.subarray(offset,Math.min(bytes.length,offset+4*1024*1024));
  const name=`payloads/${index}-${path.basename(target)}.part${String(part).padStart(3,'0')}`;
  fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),data);
  parts.push({path:name,bytes:data.length,sha256:sha(data)});
 }
 files.push({path:target,bytes:bytes.length,sha256:sha(bytes),parts});
}
fs.writeFileSync(path.join(root,'payloads/index.json'),JSON.stringify({schema:'animal-atlas/archive-parts@1',partSize:4*1024*1024,files},null,2));
console.log(JSON.stringify({files:files.length,parts:files.reduce((n,f)=>n+f.parts.length,0),bytes:files.reduce((n,f)=>n+f.bytes,0)}));
