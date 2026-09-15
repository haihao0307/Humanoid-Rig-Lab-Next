// Default mode only inspects source files. Optional synthetic parameter fixtures
// exercise the isolated eyelid helpers; they never generate a human or use a GPU.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const readDefault=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assertDefault=(value,message)=>{if(!value)throw Error(message);};

export function checkEyeAnatomySources({read=readDefault,assert=assertDefault}={}){
  let checks=0;const check=(value,message)=>{assert(value,'Eye anatomy: '+message);checks++;};
  const source=read('body/EyeAnatomy.js'),renderer=read('body/CompactWorkbench.js'),manifest=JSON.parse(read('source/assembly.json')),runtime=read('source/runtime.template.js');
  new vm.Script(source,{filename:'body/EyeAnatomy.js'});
  check(manifest.modules.filter(path=>path==='body/EyeAnatomy.js').length===1&&manifest.modules.indexOf('body/EyeAnatomy.js')<manifest.modules.indexOf('body/CompactWorkbench.js'),'one anatomy module assembled before its renderer');
  check((runtime.match(/__SOURCE:body\/EyeAnatomy\.js__/g)||[]).length===1,'one runtime assembly insertion');
  check(/function compactCreateEyeLids\(/.test(source)&&/function compactEyeSkinSampler\(/.test(source),'procedural geometry and neutral aperture sampling are explicit functions');
  check(!/\b(?:document|window|fetch|Worker|requestAnimationFrame|localStorage|sessionStorage)\b/.test(source),'anatomy helper has no UI, network, persistence, or simulation side effects');
  check(source.includes('canonicalPositions')&&source.includes('statureScale'),'anatomy retains canonical coordinates and applies stature separately');
  check(renderer.includes("compactCreateEyeLids(faceTissue.meshes.filter(m=>m.name==='faceSkin'),this.eyeFrames,this.rig,this.statureScale)"),'current replacement geometry, eye frames and rig drive tissue generation');
  for(const [location,width,name]of [[8,'vec2','eyeLidParam'],[9,'vec3','eyeLidTangentU'],[10,'vec3','eyeLidTangentV'],[11,'vec3','eyeOuterPosition'],[12,'vec3','eyeOuterTangentU'],[13,'vec2','eyeOuterGradient'],[14,'vec2','eyeOuterGradientU']]){
    check(new RegExp('layout\\s*\\(location\\s*=\\s*'+location+'\\)\\s*in\\s+'+width+'\\s+'+name).test(source),'declared '+name+' vertex attribute');
    check(new RegExp('attr\\('+location+',m\\.').test(renderer),'uploaded '+name+' vertex attribute');
  }
  check(renderer.includes('this.main=program(this.gl,COMPACT_VERTEX')&&renderer.includes('this.depth=program(this.gl,COMPACT_VERTEX'),'colour and shadow share the deformed vertex path');
  check(/compactLid\(source,n\).*compactFace\(source,n,faceHeat\)/.test(renderer),'spherical lid motion precedes the shared facial tissue field');
  check(/compactLidState\[0\]/.test(renderer)&&/face\.eyelids/.test(renderer),'current face state is uploaded for independent lids');
  check(source.includes('eyeOuterTangentU*da')&&source.includes('eyeOuterGradientU*da'),'posed normal evaluation includes fitted boundary and skin-gradient angular derivatives');
  check(source.includes('min(limit,param.y+dr)')&&source.includes('max(0.,param.y-dr)')&&source.includes('max(eyeLidParam.y,.003)'),'normal samples use bounded grid neighbours and a posed side limit at a closed canthus');
  check(renderer.includes("['eyeSclera','eyePupil'].includes(c.name)?2:0")&&renderer.includes('if(compactSourceEye<1.5)'),'generated and source optical layers share blink correction without applying the rest offset twice');
  check(renderer.includes("p.u.compactEyeSide,eyeSide==='left'?0:1")&&source.includes('compactLidState[sideOffset+2]'),'optical layers and contact use the same independent eye side');
  return {checks,applicationExecuted:false,humanGenerated:false,shaderCompiled:false,visualAcceptance:false};
}

const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function decodeNormal(x,y){x/=32767;y/=32767;const z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return norm([x,y,z]);}

// A planar skin ring gives an independently known aperture. It contains no
// source human samples; all fixture coordinates are generated from this formula.
function fixtureSkin(frames){
  const positions=[],indices=[],segments=96;
  for(const frame of Object.values(frames)){
    const start=positions.length/3;
    for(let i=0;i<=segments;i++)for(let r=0;r<2;r++){
      const angle=i/segments*2*Math.PI,x=(r?.023:.0135)*Math.cos(angle),y=(r?.019:.0075)*Math.sin(angle);
      positions.push(...add(frame.centre,add(mul(frame.u,x),add(mul(frame.v,y),mul(frame.n,.008)))));
    }
    for(let i=0;i<segments;i++){const a=start+i*2,b=a+2;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  return [{name:'skin',canonicalPositions:Float32Array.from(positions),indices:Uint16Array.from(indices)}];
}

export function checkEyeAnatomyParameterFixtures({read=readDefault,assert=assertDefault}={}){
  let checks=0;const check=(value,message)=>{assert(value,'Eye parameter fixture: '+message);checks++;};
  const context=vm.createContext({add,sub,mul,dot,cross,norm,clamp,COMPACT_INFLUENCES:8});
  new vm.Script(read('body/EyeAnatomy.js')+'\n;globalThis.eyeFixtureAPI={create:compactCreateEyeLids,sampler:compactEyeSkinSampler,patch:compactEyePatchPoint,contact:compactEyeContactDepth,anatomy:COMPACT_EYE_ANATOMY,shader:COMPACT_EYE_LID_GLSL};',{filename:'isolated-eye-parameter-functions'}).runInContext(context,{timeout:1000});
  const api=context.eyeFixtureAPI,frames=Object.fromEntries(['left','right'].map(side=>[side,{centre:add(Array.from(api.anatomy[side].centre),[0,0,.00925]),u:[1,0,0],v:[0,1,0],n:[0,0,1]}]));
  const contactGlobe=[0,0,-.00925,api.anatomy.left.radius];
  for(const x of [-.006,0,.006])for(const y of [-.003,0,.003]){
    const rest=api.contact(x,y,contactGlobe,0),early=api.contact(x,y,contactGlobe,.35),closed=api.contact(x,y,contactGlobe,1);
    check(Math.abs(early-rest)<1e-12,'early blink retains the neutral eye depth');
    check(Math.abs(rest-closed-api.anatomy.blinkRetractionM)<1e-12,'closed contact shares the configured optical retraction');
  }
  const fixture=fixtureSkin(frames),before=JSON.stringify(fixture),rig={jointIds:new Map([['head',7]])};
  const sample=api.sampler(fixture,frames.left);
  check(sample(0,0)===null,'skin ring leaves the central aperture empty');
  check(Math.abs(sample(.018,0)-.008)<1e-6,'skin ray returns front surface depth in the eye frame');
  check(sample(.028,.028)===null,'ray outside skin fixture has no fabricated hit');
  const deeper={...fixture[0],canonicalPositions:Float32Array.from(fixture[0].canonicalPositions,(v,i)=>v-(i%3===2?.003:0))};
  const reversed=api.sampler([deeper,fixture[0]],frames.left);
  check(Math.abs(reversed(.018,0)-.008)<1e-6,'unsorted overlapping triangles select the foremost skin hit');
  const generated=api.create(fixture,frames,rig,1),scaled=api.create(fixture,frames,rig,.9);
  for(const side of ['left','right']){const globe=[0,0,-.00925-api.anatomy.recess,api.anatomy[side].radius];for(const [i,x]of [-.0124,.0124].entries())check(generated.canthusDepths[side][i]-api.contact(x,0,globe)<.003,'fitted corners stay near the globe instead of creating a raised closed-eye peak');}
  check(JSON.stringify(fixture)===before,'generation preserves transferred source arrays');
  check(generated.meshes.length===scaled.meshes.length,'stature does not alter topology');
  check(generated.report.triangles===generated.meshes.reduce((sum,m)=>sum+m.indices.length/3,0),'triangle report matches generated index buffers');
  for(const side of ['left','right'])check(generated.meshes.some(m=>m.eyeSide===side&&m.name==='eyeLidSkin')&&generated.meshes.some(m=>m.eyeSide===side&&m.name==='eyeLidMargin'),'both skin and wet margin exist for '+side);
  for(let mi=0;mi<generated.meshes.length;mi++){
    const m=generated.meshes[mi],scaledMesh=scaled.meshes[mi],label=m.eyeSide+'/'+m.name;
    check(Number.isInteger(m.vertices)&&m.vertices>0&&m.vertices<=65535,'bounded Uint16 vertex count '+label);
    check(m.canonicalPositions.length===m.vertices*3&&m.positions.length===m.vertices*3&&m.normals.length===m.vertices*2,'complete position and octahedral normal arrays '+label);
    check([...m.canonicalPositions,...m.positions,...m.normals].every(Number.isFinite),'finite generated coordinates '+label);
    check(m.indices.length%3===0&&m.indices.every(i=>i<m.vertices),'indices stay inside the generated mesh '+label);
    check(m.binding.ids.length===m.vertices*8&&m.binding.weights.length===m.vertices*8,'complete skinning influence arrays '+label);
    for(let i=0;i<m.vertices;i++){
      const ids=m.binding.ids.subarray(i*8,i*8+8),weights=m.binding.weights.subarray(i*8,i*8+8);
      check(weights.reduce((s,v)=>s+v,0)===65535&&weights.every((w,j)=>!w||ids[j]===7),'normalized head binding '+label+'/'+i);
    }
    check(m.canonicalPositions.every((p,i)=>p===scaledMesh.canonicalPositions[i]),'stature preserves canonical source geometry '+label);
    check(m.positions.every((p,i)=>Math.abs(scaledMesh.positions[i]-.9*p)<2e-7),'stature scales every generated position once '+label);
    if(m.eyeLid){
      check(m.eyeParams?.length===m.vertices*2&&m.eyeTangentU?.length===m.vertices*3&&m.eyeTangentV?.length===m.vertices*3,'complete deformation derivatives '+label);
      check([...m.eyeParams,...m.eyeTangentU,...m.eyeTangentV].every(Number.isFinite),'finite lid derivative attributes '+label);
      for(const [name,width]of [['eyeOuterPosition',3],['eyeOuterTangentU',3],['eyeOuterGradient',2],['eyeOuterGradientU',2]])check(m[name]?.length===m.vertices*width&&m[name].every(Number.isFinite),'finite fitted boundary attribute '+name+' '+label);
    }
    let wrongWinding=0,degenerate=0,firstMismatch=null;
    for(let i=0;i<m.indices.length;i+=3){
      const ids=Array.from(m.indices.subarray(i,i+3)),p=ids.map(id=>Array.from(m.canonicalPositions.subarray(id*3,id*3+3))),n=ids.map(id=>decodeNormal(m.normals[id*2],m.normals[id*2+1]));
      const areaNormal=cross(sub(p[1],p[0]),sub(p[2],p[0]));
      if(Math.hypot(...areaNormal)<1e-12)degenerate++;
      else if(dot(areaNormal,add(add(n[0],n[1]),n[2]))<=0){wrongWinding++;firstMismatch??={triangle:i/3,indices:ids,positions:p,params:m.eyeParams?ids.map(id=>Array.from(m.eyeParams.subarray(id*2,id*2+2))):null,normals:n,cosine:dot(norm(areaNormal),norm(add(add(n[0],n[1]),n[2])))};}
    }
    check(degenerate===0,'no collapsed neutral generated triangles '+label);
    check(wrongWinding===0,'geometric winding agrees with encoded outward normals '+label+'; mismatches='+wrongWinding+'; first='+JSON.stringify(firstMismatch));
  }
  let missingHeadRejected=false;try{api.create(fixture,frames,{jointIds:new Map()},1);}catch{missingHeadRejected=true;}
  check(missingHeadRejected,'missing head binding fails explicitly');
  // Evaluate the shader's authored scalar statements. This independent route
  // catches drift between CPU construction and the GPU reconstruction formula.
  const scalarContext=vm.createContext({clamp,mix:(a,b,t)=>a+(b-a)*t,sin:Math.sin,cos:Math.cos,exp:Math.exp,pow:Math.pow,sqrt:Math.sqrt,abs:Math.abs,max:Math.max,min:Math.min});
  function scalarFunction(name,args,returnExpression){
    const at=api.shader.indexOf(name+'('),body=api.shader.slice(api.shader.indexOf('{',at)+1,api.shader.indexOf('\n}',at));
    const statements=[...body.matchAll(/\b(?:int|float)\s+([^;]+);/g)].map(m=>'let '+m[1]+';').join('\n');
    new vm.Script('globalThis.'+name+'=function('+args+'){'+statements+'\nreturn '+returnExpression+';}',{filename:name+'-scalar-fixture'}).runInContext(scalarContext);
    return scalarContext[name];
  }
  scalarFunction('compactLidContact','x,y','mix(cornea,sclera,h)+.0003*h*(1.-h)+.00028');
  const shaderPatch=scalarFunction('compactLidPatchLocal','angle,t,outer,gradient','[x,y,finalRimDepth]');
  const states=[[0,0,0],[1,0,0],[0,1,0],[0,0,.5],[0,0,1],[.7,.2,.8]];
  // A curved orbital rim can share the closed margin's depth while requiring
  // a receding middle. Flattening it creates the visible inflated lid band.
  {
    const angle=Math.PI/2,outer=[0,.0111,.0062],gradient=[0,.74],globe=[0,0,-.00925-api.anatomy.recess,api.anatomy.left.radius],corners=[.003,-.003],state=[0,0,1];
    outer[2]=api.patch(angle,0,'left',outer,gradient,globe,corners,state)[2];
    const inner=api.patch(angle,0,'left',outer,gradient,globe,corners,state),middle=api.patch(angle,.6,'left',outer,gradient,globe,corners,state);
    check(middle[2]<Math.min(inner[2],outer[2])-.0008,'closed lid can recede from an equal-depth rim instead of forming a flat inflated band');
    check(middle[2]>=api.contact(middle[0],middle[1],globe,1)-.00008,'receding closed lid remains supported in front of the optical surface');
  }
  // Steep inherited rim gradients used to overshoot the entire meridian.
  // A contact floor may lift it, but the spline itself must not create a hump
  // above both endpoints and the supporting eye surface.
  for(const angle of [.6,1.2,1.8,2.4,3.8,4.5,5.3])for(const slope of [-8,8])for(const blink of [0,.5,1]){
    const outer=[.022*Math.cos(angle),.014*Math.sin(angle),.008],gradient=[slope,slope],globe=[0,0,-.00925,api.anatomy.left.radius],corners=[.004,.004],state=[0,0,blink];
    const inner=api.patch(angle,0,'left',outer,gradient,globe,corners,state);
    for(let i=1;i<40;i++){
      const p=api.patch(angle,i/40,'left',outer,gradient,globe,corners,state),ceiling=Math.max(inner[2],outer[2]+.00004,api.contact(p[0],p[1],globe))+.0010;
      check(p[2]<=ceiling,'steep boundary derivatives cannot create a millimetre-scale lid hump');
    }
  }
  for(const angle of [.8,1.57,2.2,4.1,4.7]){
    const outer=[.022*Math.cos(angle),.014*Math.sin(angle),.008],gradient=[.3,.7],globe=[0,0,-.00925,api.anatomy.left.radius],corners=[.004,.004];
    for(const state of [[0,0,0],[0,0,1]]){const end=api.patch(angle,1,'left',outer,gradient,globe,corners,state),inner=api.patch(angle,0,'left',outer,gradient,globe,corners,state),near=api.patch(angle,.99999,'left',outer,gradient,globe,corners,state),expected=clamp(gradient[0]*(end[0]-inner[0])+gradient[1]*(end[1]-inner[1]),-.020,.020);
      check(Math.abs((end[2]-near[2])/.00001-expected)<1e-6,'outer meridian matches the fitted facial tangent');}
  }
  for(const [sideIndex,side]of ['left','right'].entries()){
    const m=generated.meshes.find(m=>m.eyeSide===side&&m.name==='eyeLidSkin'),sphere=api.anatomy[side],globe=[0,0,-.00925-api.anatomy.recess,sphere.radius],corners=Array.from(generated.canthusDepths[side]);
    Object.assign(scalarContext,{compactEyeSide:sideIndex,compactEyeLid:1,compactEyeGlobe:{x:0,y:0,z:-.00925-api.anatomy.recess,w:sphere.radius},compactCanthusDepth:{x:corners[0],y:corners[1]}});
    for(const state of states){
      const all=[0,0,0,0,0,0];all.splice(sideIndex*3,3,...state);scalarContext.compactLidState=all;
      for(let i=0;i<m.vertices;i+=3){
        const angle=m.eyeParams[i*2],t=m.eyeParams[i*2+1],o=Array.from(m.eyeOuterPosition.subarray(i*3,i*3+3)),g=Array.from(m.eyeOuterGradient.subarray(i*2,i*2+2));
        const cpu=api.patch(angle,t,side,o,g,globe,corners,state),shader=shaderPatch(angle,t,{x:o[0],y:o[1],z:o[2]},{x:g[0],y:g[1]});
        check(cpu.every(Number.isFinite)&&shader.every(Number.isFinite),'finite complete patch under supplied pose');
        check(Math.hypot(...sub(cpu,shader))<2e-10,'CPU and shader agree for each posed meridian');
        const boundary=api.patch(angle,1,side,o,g,globe,corners,state);
        check(Math.hypot(boundary[0]-o[0],boundary[1]-o[1],boundary[2]-o[2]-.00004)<2e-10,'posed outer boundary stays fixed');
      }
      for(const corner of [0,Math.PI]){
        const o=[corner===0?.018:-.018,0,.008],g=[0,0],p=api.patch(corner,0,side,o,g,globe,corners,state),neutral=api.patch(corner,0,side,o,g,globe,corners,[0,0,0]);
        check(Math.hypot(...sub(p,neutral))<1e-9,'canthus remains attached throughout animation');
        const a=api.patch(corner-1e-5,0,side,o,g,globe,corners,state),b=api.patch(corner+1e-5,0,side,o,g,globe,corners,state);
        check(Math.hypot(...sub(a,b))<2e-6,'continuous displacement across the canthus');
      }
      const points=[],normals=[];
      for(let i=0;i<m.vertices;i++){
        const angle=m.eyeParams[i*2],t=m.eyeParams[i*2+1],o=Array.from(m.eyeOuterPosition.subarray(i*3,i*3+3)),ou=Array.from(m.eyeOuterTangentU.subarray(i*3,i*3+3)),g=Array.from(m.eyeOuterGradient.subarray(i*2,i*2+2)),gu=Array.from(m.eyeOuterGradientU.subarray(i*2,i*2+2));
        const at=(a,r)=>api.patch(a,r,side,add(o,mul(ou,a-angle)),add(g,mul(gu,a-angle)),globe,corners,state);
        const raw=(a,r)=>cross(sub(at(a,Math.min(1,r+1/api.anatomy.rings)),at(a,Math.max(0,r-1/api.anatomy.rings))),sub(at(a+2*Math.PI/api.anatomy.segments,r),at(a-2*Math.PI/api.anatomy.segments,r)));
        let n=raw(angle,t);
        if(dot(n,n)<1e-22){const r=Math.max(t,.003),a=raw(angle+.008,r),b=raw(angle-.008,r);n=add(norm(a[2]<0?mul(a,-1):a),norm(b[2]<0?mul(b,-1):b));}
        if(n[2]<0)n=mul(n,-1);if(dot(n,n)<1e-22)n=[-g[0],-g[1],1];
        points.push(at(angle,t));normals.push(norm(n));
      }
      let inverted=0,collapsed=0,first=null;
      for(let i=0;i<m.indices.length;i+=3){
        const ids=Array.from(m.indices.subarray(i,i+3)),[a,b,c]=ids.map(id=>points[id]),normal=cross(sub(b,a),sub(c,a)),average=ids.reduce((n,id)=>add(n,normals[id]),[0,0,0]);
        if(Math.hypot(...normal)<1e-13)collapsed++;
        else if(dot(normal,average)<=0){inverted++;first??={triangle:i/3,params:ids.map(id=>Array.from(m.eyeParams.subarray(id*2,id*2+2))),normalCosine:dot(norm(normal),norm(average))};}
      }
      check(collapsed===0,'no collapsed pose triangles '+side+'/'+state);
      check(inverted===0,'posed triangle orientation agrees with reconstructed normals '+side+'/'+state+'; mismatches='+inverted+'; first='+JSON.stringify(first));
    }
    for(let i=0;i<=48;i++){
      const angle=i/48*Math.PI,o=[.020*Math.cos(angle),.015*Math.sin(angle),.008],g=[0,0];
      const upper=api.patch(angle,0,side,o,g,globe,corners,[0,0,1]),lower=api.patch(-angle,0,side,[o[0],-o[1],o[2]],g,globe,corners,[0,0,1]);
      check(Math.hypot(...sub(upper,lower))<1e-9,'closed upper and lower free margins coincide');
    }
  }
  return {checks,isolatedParameterFunctionsExecuted:true,syntheticSkinFixture:true,lidScalarMathEvaluated:true,humanGenerated:false,shaderCompiled:false,visualAcceptance:false};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result={source:checkEyeAnatomySources()};
  if(process.argv.includes('--parameter-fixtures'))result.parameters=checkEyeAnatomyParameterFixtures();
  console.log(JSON.stringify(result,null,2));
}
