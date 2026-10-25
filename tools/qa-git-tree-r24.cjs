'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve(__dirname,'..'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),base=path.join(root,'qa/fidelity-r24/offline'),stem='git-tree-'+commit.slice(0,12)+'-'+Date.now(),folder=path.resolve(base,stem),tar=folder+'.tar';
if(!folder.startsWith(path.resolve(base)+path.sep))throw Error('Archive target outside task directory');
const q={startedUTC:new Date().toISOString(),commit,scope:'Rebuild from Git archive only; task-owned scratch files retained without cleanup',sourceFidelityAccepted:false,checks:[]};
const check=(name,passed,details)=>{q.checks.push({name,passed,details});if(!passed)throw Error(name);};
try{
 fs.mkdirSync(base,{recursive:true});fs.mkdirSync(folder);cp.execFileSync('git',['archive','--format=tar','-o',tar,commit],{cwd:root,stdio:'pipe'});
 // Windows system tar can decode UTF-8 Git paths with the local code page.
 // Extract regular files explicitly, preserving Chinese names and path bounds.
 cp.execFileSync('python',['-c',[
  'import pathlib,tarfile,sys,shutil',
  'root=pathlib.Path(sys.argv[2]).resolve()',
  'with tarfile.open(sys.argv[1],"r:",encoding="utf-8",errors="strict") as archive:',
  ' for member in archive:',
  '  target=(root/member.name).resolve()',
  '  if root != target and root not in target.parents: raise RuntimeError("Archive path outside target")',
  '  if member.isdir(): target.mkdir(parents=True,exist_ok=True)',
  '  elif member.isfile():',
  '   target.parent.mkdir(parents=True,exist_ok=True)',
  '   with archive.extractfile(member) as src, target.open("wb") as dst: shutil.copyfileobj(src,dst)',
  '  else: raise RuntimeError("Unsupported archive member")'
 ].join('\n'),tar,folder],{cwd:root,stdio:'pipe'});
 check('no ignored reference models or offline caches in archive',!fs.existsSync(path.join(folder,'qa/legacy-comparison'))&&!fs.existsSync(path.join(folder,'qa/fidelity-r21/offline'))&&!fs.existsSync(path.join(folder,'qa/fidelity-r22/offline'))&&!fs.existsSync(path.join(folder,'qa/fidelity-r24/offline')));
 q.buildOutput=cp.execFileSync(process.execPath,['tools/build.cjs'],{cwd:folder,encoding:'utf8',timeout:180000});
 const source=JSON.parse(fs.readFileSync(path.join(folder,'BUILD-SOURCE-R24.json'))),workbench=JSON.parse(fs.readFileSync(path.join(folder,'BUILD-R24.json'))),selected=JSON.parse(fs.readFileSync(path.join(folder,'BUILD.json')));
 for(const [name,b] of [['source',source],['workbench',workbench]]){const expected=JSON.parse(fs.readFileSync(path.join(root,name==='source'?'BUILD-SOURCE-R24.json':'BUILD-R24.json'))),actual=H(fs.readFileSync(path.join(folder,b.file)));check(name+' HTML reproduces committed bytes',actual===b.sha256&&actual===expected.sha256&&b.bytes===expected.bytes,{sha256:actual,bytes:b.bytes});}
 check('R24 selection and companion reproduce',selected.selectedVersion==='R24'&&selected.sha256===source.sha256&&selected.companionBuild==='BUILD-R24.json'&&selected.companionWorkbench==='BUILD-R24.json');
 const assets=[...source.activeSkin.assets,...source.coefficientAssets,{file:workbench.bytePacket.file,bytes:workbench.bytePacket.compressedBytes,sha256:workbench.bytePacket.compressedSHA256}];
 for(const a of assets){const bytes=fs.readFileSync(path.join(folder,a.file));check('committed runtime asset '+a.file,bytes.length===a.bytes&&H(bytes)===a.sha256);}
 if(fs.existsSync(path.join(folder,'tools/research/r24/build-soft-research.cjs'))){
  q.researchBuildOutput=cp.execFileSync(process.execPath,['tools/research/r24/build-soft-research.cjs'],{cwd:folder,encoding:'utf8',timeout:180000});
  const research=JSON.parse(fs.readFileSync(path.join(folder,'qa/fidelity-r24/soft-research-build.json'))),expected=JSON.parse(fs.readFileSync(path.join(root,'qa/fidelity-r24/soft-research-build.json'))),selectedAfter=JSON.parse(fs.readFileSync(path.join(folder,'BUILD.json')));
  check('isolated research also rebuilds from committed data only',research.sha256===expected.sha256&&H(fs.readFileSync(path.join(folder,research.file)))===expected.sha256&&research.defaultBuildSelected===false&&research.sourceFidelityAccepted===false);
  check('research build leaves production selection and artifacts unchanged',selectedAfter.sha256===source.sha256&&H(fs.readFileSync(path.join(folder,source.file)))===source.sha256&&H(fs.readFileSync(path.join(folder,workbench.file)))===workbench.sha256);
  q.researchSHA256=research.sha256;
 }
 q.assetCount=assets.length;q.assetCompressedBytes=assets.reduce((n,a)=>n+a.bytes,0);q.ignoredReferenceInputsRead=false;q.externalRuntimeDownloads=0;q.sourceSHA256=source.sha256;q.workbenchSHA256=workbench.sha256;q.passed=true;
}catch(e){q.failure=e.stack;q.passed=false;process.exitCode=1;console.error(e);}finally{q.finishedUTC=new Date().toISOString();fs.writeFileSync(path.join(root,'qa/fidelity-r24/git-tree-rebuild.json'),JSON.stringify(q,null,2)+'\n');console.log(JSON.stringify({passed:q.passed,commit,checks:q.checks.length,assets:q.assetCount,failure:q.failure}));}
