import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
// Explicit frozen source files only. A separate index preserves native WIP.
const root=process.cwd(),base='New-Human-Production/R008/qa',records=JSON.parse(readFileSync(base+'/shorts-source-upload-frozen.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex'),git=(args,input,env=process.env)=>execFileSync('git',args,{cwd:root,input,env,encoding:'utf8'}).trim();
const native=git(['rev-parse','HEAD']),parent=git(['rev-parse','refs/remotes/github/work/shorts-two-versions-source-20261002']),indexPath=resolve(git(['rev-parse','--git-path','index']));
const indexBefore=existsSync(indexPath)?sha(readFileSync(indexPath)):null;
const isolatedIndex=resolve(base,'source-index-'+randomUUID()),env={...process.env,GIT_INDEX_FILE:isolatedIndex,GIT_AUTHOR_NAME:process.env.GIT_AUTHOR_NAME||'Codex',GIT_AUTHOR_EMAIL:process.env.GIT_AUTHOR_EMAIL||'codex@local.invalid',GIT_COMMITTER_NAME:process.env.GIT_COMMITTER_NAME||'Codex',GIT_COMMITTER_EMAIL:process.env.GIT_COMMITTER_EMAIL||'codex@local.invalid'};
git(['read-tree',native],undefined,env);
const entries=[];
for(const record of records){
 if(record.mode!=='100644'||record.type!=='blob'||record.path.includes('\n')||record.path.includes('\0')||!record.path.startsWith('New-Human-Production/R008/')&&!record.path.startsWith('docs/')&&!record.path.startsWith('tools/'))throw Error('Invalid explicit source record');
 const bytes=readFileSync(record.path);if(sha(bytes)!==record.sha256||bytes.length!==record.bytes)throw Error('Frozen source drift: '+record.path);
 const blob=git(['hash-object','-w','--stdin'],bytes,env);if(blob!==record.gitBlobSHA1)throw Error('Git content differs from exact frozen UTF8: '+record.path);
 entries.push('100644 '+blob+'\t'+record.path+'\n');
}
git(['update-index','--index-info'],entries.join(''),env);
const tree=git(['write-tree'],undefined,env),listing=git(['ls-tree','-r','-l',tree]).split('\n'),treeEntries=new Map(listing.map(line=>{const [head,path]=line.split('\t'),[mode,type,blob,size]=head.trim().split(/\s+/);return[path,{mode,type,blob,size:Number(size)}];}));
for(const record of records){const e=treeEntries.get(record.path);if(!e||e.mode!==record.mode||e.type!==record.type||e.blob!==record.gitBlobSHA1||e.size!==record.bytes)throw Error('Tree source mismatch: '+record.path);}
const baseline=git(['ls-tree','-r',native]).split('\n'),overlaid=new Set(records.map(r=>r.path));
for(const line of baseline){const [head,path]=line.split('\t');if(overlaid.has(path))continue;const [mode,type,blob]=head.split(' '),e=treeEntries.get(path);if(!e||e.mode!==mode||e.type!==type||e.blob!==blob)throw Error('Non-clothing committed native file changed: '+path);}
const message=readFileSync(base+'/source-commit-message.txt','utf8'),parents=['-p',parent];
try{git(['merge-base','--is-ancestor',native,parent]);}catch{parents.push('-p',native);}
const commit=git(['-c','commit.gpgsign=false','commit-tree',tree,...parents,'-F','-'],message,env);
if(git(['rev-parse','HEAD'])!==native||(existsSync(indexPath)?sha(readFileSync(indexPath)):null)!==indexBefore)throw Error('User native HEAD/index unexpectedly changed');
const receipt={createdAt:new Date().toISOString(),status:'SOURCE_CHECKPOINT_HOLD_NOT_PHYSICS_ACCEPTANCE',commit,tree,parent,nativeBaseline:native,files:records.length,sourceBytes:records.reduce((s,r)=>s+r.bytes,0),originalNativeHeadAndIndexUnchanged:true,explicitSourceTreeVerified:true,workingTreeNotStaged:true,pushPerformed:false};
writeFileSync(base+'/SOURCE_COMMIT_RECEIPT.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
