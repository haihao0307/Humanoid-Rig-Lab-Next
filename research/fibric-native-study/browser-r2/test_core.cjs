const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),path=require('path');
const src=path.join(__dirname,'source');const sb={console,LabLib:{THREE:{}},document:{getElementById(){return {}}},addEventListener(){},setTimeout,Float64Array,Float32Array,Uint8Array,Uint32Array,Math,Number,Promise};sb.window=sb;
vm.createContext(sb);vm.runInContext(fs.readFileSync(src+'/kernel.js','utf8'),sb);
let app=fs.readFileSync(src+'/app.js','utf8');let mark="try{\n const vp=$('viewport');";let at=app.indexOf(mark);if(at<0)throw Error('main anchor missing');app=app.slice(0,at)+"window.__PURE={C,makeContactCurves,r2section};})();";vm.runInContext(app,sb);
function digest(d){let h=crypto.createHash('sha256');for(const c of d.curves)for(const k of ['z','ax','by','shift'])h.update(Buffer.from(c[k].buffer));return h.digest('hex');}
let cases=[];for(const [disorder,density,flatten] of [[.68,.93,.48],[0,.93,.48],[1,.98,.95],[1,.80,.25]]){
 Object.assign(sb.__PURE.C,{disorder,density,flatten});const d=sb.__PURE.makeContactCurves();
 if(d.curves.length!==72||d.contact.maxResidualMm>.001)throw Error('geometry constraint');
 for(const c of d.curves){for(const k of ['z','ax','by','shift']){for(const v of c[k])if(!Number.isFinite(v))throw Error('nonfinite');}
  if(Math.abs(c.z[0]-c.z.at(-1))>1e-9)throw Error('position seam');
  for(let i=0;i<c.ax.length;i++)if(c.ax[i]<=0||c.by[i]<=0)throw Error('nonpositive section');
 }
 cases.push({disorder,density,flatten,residualMm:d.contact.maxResidualMm,openFraction:d.openFraction,hash:digest(d)});
}
Object.assign(sb.__PURE.C,{disorder:.68,density:.93,flatten:.48});let a=digest(sb.__PURE.makeContactCurves()),b=digest(sb.__PURE.makeContactCurves());if(a!==b||a!==cases[0].hash)throw Error('not deterministic');
const receipt={schema:'yarn_r2_geometry_tests@1',cases,deterministic:true,finite:true,positionSeams:true,positiveSections:true,continuousCollisionGuarantee:false};fs.writeFileSync(__dirname+'/core-test.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
