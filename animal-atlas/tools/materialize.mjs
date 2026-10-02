import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export function materialize(root=defaultRoot){
 const index=path.join(root,'payloads/index.json');if(!fs.existsSync(index))return [];
 const manifest=JSON.parse(fs.readFileSync(index,'utf8'));if(manifest.schema!=='animal-atlas/archive-parts@1')throw Error('Unknown archive format');
 const resolve=name=>{const result=path.resolve(root,name);if(!result.startsWith(path.resolve(root)+path.sep))throw Error('Archive path escapes project');return result;};
 const results=[];
 for(const file of manifest.files){
  const target=resolve(file.path);
  if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==file.sha256)throw Error(`Local file changed; refusing to overwrite ${file.path}`);results.push({path:file.path,status:'already-present',sha256:file.sha256});continue;}
  for(const part of file.parts){const data=fs.readFileSync(resolve(part.path));if(data.length!==part.bytes||sha(data)!==part.sha256)throw Error(`Invalid archive part ${part.path}`);}
  fs.mkdirSync(path.dirname(target),{recursive:true});const temporary=target+'.restoring';
  const fd=fs.openSync(temporary,'wx');const hash=crypto.createHash('sha256');let bytes=0;
  try{for(const part of file.parts){const data=fs.readFileSync(resolve(part.path));fs.writeSync(fd,data);hash.update(data);bytes+=data.length;}}finally{fs.closeSync(fd);}
  if(bytes!==file.bytes||hash.digest('hex')!==file.sha256){fs.unlinkSync(temporary);throw Error(`Restored file identity mismatch ${file.path}`);}
  fs.renameSync(temporary,target);results.push({path:file.path,status:'restored',sha256:file.sha256});
 }
 return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(materialize(process.argv[2]?path.resolve(process.argv[2]):defaultRoot),null,2));
