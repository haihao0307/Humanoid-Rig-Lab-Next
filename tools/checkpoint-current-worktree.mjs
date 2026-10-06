// Full explicit checkpoint using an isolated Git index. Never switch, stage,
// clean, reset or overwrite the user's current worktree or branch.
import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
const root=process.cwd(),out='docs/checkpoints/20261006',qa='New-Human-Production/R008/qa',branch='wip/all-current-content-20261006';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(args,input,env=process.env)=>execFileSync('git',['-c','core.fsmonitor=false',...args],{cwd:root,input,env,maxBuffer:64*1024*1024,encoding:'utf8'}).trim();
const head=git(['rev-parse','HEAD']),oldSource=git(['rev-parse','refs/remotes/github/work/shorts-two-versions-source-20261002']);
const indexPath=resolve(git(['rev-parse','--git-path','index'])),indexBefore=existsSync(indexPath)?sha(readFileSync(indexPath)):null;
const env={...process.env,GIT_INDEX_FILE:resolve(qa,'snapshot-index-'+randomUUID()),GIT_AUTHOR_NAME:'Codex',GIT_AUTHOR_EMAIL:'codex@local.invalid',GIT_COMMITTER_NAME:'Codex',GIT_COMMITTER_EMAIL:'codex@local.invalid'};
const tracked=git(['ls-files','--cached','-z']).split('\0').filter(Boolean),normal=git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
const archives=JSON.parse(readFileSync(out+'/ARCHIVE_MANIFEST.json','utf8'));
const forced=archives.archives.flatMap(a=>a.parts.map(p=>p.path));
const files=[...new Set([...normal,...forced])].filter(p=>existsSync(p)&&statSync(p).isFile()).sort();
const deleted=tracked.filter(p=>!existsSync(p));
const records=files.map(path=>{if(path.includes('\n')||path.includes('\0')||path.includes('\t')||path.startsWith('../')||resolve(path).toLowerCase().startsWith(root.toLowerCase()+ '\\')===false)throw Error('Invalid checkpoint path '+path);const bytes=readFileSync(path);return{path,bytes:bytes.length,sha256:sha(bytes),gitBlobSHA1:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')};});
if(records.some(r=>r.bytes>99*1024*1024))throw Error('File above GitHub blob limit; archive must be split');
const manifest={createdAt:new Date().toISOString(),branch,nativeHead:head,priorShortsHead:oldSource,status:'FULL_CURRENT_DEVELOPMENT_CHECKPOINT',productionReady:false,files:records,deletedTrackedPaths:deleted,archives:archives.archives.length,originalASha256:archives.originalASha256,userWorktreeAndIndexPreserved:true};
const manifestPath=out+'/SOURCE_MANIFEST.json';writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const mBytes=readFileSync(manifestPath);records.push({path:manifestPath,bytes:mBytes.length,sha256:sha(mBytes),gitBlobSHA1:createHash('sha1').update(Buffer.from('blob '+mBytes.length+'\0')).update(mBytes).digest('hex')});
git(['read-tree',head],undefined,env);const entries=[];
for(const r of records){const bytes=readFileSync(r.path);if(sha(bytes)!==r.sha256)throw Error('Concurrent file drift '+r.path);const blob=git(['hash-object','-w','--stdin'],bytes,env);if(blob!==r.gitBlobSHA1)throw Error('Git content mismatch '+r.path);entries.push('100644 '+blob+'\t'+r.path+'\n');}
for(const path of deleted)entries.push('0 '+ '0'.repeat(40)+'\t'+path+'\n');
git(['update-index','--index-info'],entries.join(''),env);const tree=git(['write-tree'],undefined,env),treeFiles=new Map(git(['ls-tree','-r',tree]).split('\n').map(l=>{const [meta,path]=l.split('\t');return[path,meta.split(' ')[2]];}));
for(const r of records)if(treeFiles.get(r.path)!==r.gitBlobSHA1)throw Error('Checkpoint tree mismatch '+r.path);
for(const path of deleted)if(treeFiles.has(path))throw Error('Deletion missing from tree '+path);
const parents=['-p',oldSource];if(head!==oldSource)parents.push('-p',head);
const message='Checkpoint all current Human worktree source and validation artifacts\n\nPreserve original A, current shorts experiments, face/loading changes, and all available QA evidence in archival ZIPs. Runtime dependencies and temporary indexes excluded. Not garment acceptance; user HEAD and real Git index untouched.\n';
const commit=git(['-c','commit.gpgsign=false','commit-tree',tree,...parents,'-F','-'],message,env);
if(git(['rev-parse','HEAD'])!==head||(existsSync(indexPath)?sha(readFileSync(indexPath)):null)!==indexBefore)throw Error('User HEAD/index changed');
git(['update-ref','refs/heads/'+branch,commit,'0'.repeat(40)]);
const receipt={createdAt:new Date().toISOString(),branch,commit,tree,parents:[oldSource,head],files:records.length,bytes:records.reduce((s,r)=>s+r.bytes,0),archives:archives.archives.length,sourceAndArchiveHashesVerified:true,userHeadAndIndexUnchanged:true,productionReady:false,pushPerformed:false};
writeFileSync(qa+'/CURRENT_SYNC_RECEIPT_20261006.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
