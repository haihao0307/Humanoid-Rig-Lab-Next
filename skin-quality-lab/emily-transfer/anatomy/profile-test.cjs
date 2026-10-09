const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'et05-profile-'));
try{
 for(const [f,n]of[['anatomy/UpperLidEyes.js','new'],['research/ResearchEyes.js','old']])esbuild.buildSync({entryPoints:[root+'/'+f],bundle:true,platform:'node',format:'cjs',outfile:temp+'/'+n+'.cjs',alias:{three:path.resolve(root,'../r01/vendor/three.module.js')}});
 const New=require(temp+'/new.cjs').UpperLidEyes,Old=require(temp+'/old.cjs').ResearchEyes,result={scope:'Model-space neutral profile, not clinical or projected-image measurements',observedSubjectGroundTruth:false};
 for(const [Cls,name,half,r]of[[Old,'ET04',.0122,.0125],[New,'ET05',.0122*.97,.012]]){
  const o=Object.create(Cls.prototype);o.config={opening:1,squint:0};const c={half,radius:r,x:0,y:.069,z:.06,sign:1};
  const p=(u,upper,b=0)=>o.margin(c,upper?Math.acos(u):2*Math.PI-Math.acos(u),b);
  const angles=[-1,1].map(u=>{const tip=p(u,true),a=p(u-u*.0001,true).sub(tip),b=p(u-u*.0001,false).sub(tip);a.z=b.z=0;return a.angleTo(b)*180/Math.PI;});
  let area=0;for(let i=0;i<400;i++){const u=-1+(i+.5)/200;area+=(p(u,true).y-p(u,false).y)*2*half/400;}
  result[name]={medialLateralFrontAnglesDegrees:angles,centralApertureMM:(p(0,true).y-p(0,false).y)*1000,widthMM:half*2000,frontApertureAreaMM2:area*1e6};
  if(name==='ET05')for(let i=0;i<=100;i++){const u=-1+i/50;assert(p(u,true,1).distanceTo(p(u,false,1))<1e-9,'Posterior closure gap');assert(p(u,true).y>=p(u,false).y-1e-9,'Crossed aperture');}
 }
 assert(result.ET05.centralApertureMM<result.ET04.centralApertureMM);assert(result.ET05.medialLateralFrontAnglesDegrees.every(x=>x>20&&x<80));
 result.passed=true;fs.writeFileSync(__dirname+'/profile-report.json',JSON.stringify(result,null,2));console.log('ET05_PROFILE_PASS',JSON.stringify(result));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
