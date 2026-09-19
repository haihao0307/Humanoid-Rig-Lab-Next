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
  check(source.includes("revision:'r25b-canthus-owned-aperture-family'")&&source.includes("baselineRevision:'r24-span-aware-lid-return'")&&source.includes('function compactEyeAperturePoint')&&source.includes('function compactEyeClosedApertureY')&&source.includes('vec2 compactLidAperture'),'neutral, half-closed and closed margins share an explicit canthus-owned CPU/GLSL family');
  check(source.includes('function compactEyeOuterOverlap')&&source.includes('outerBand:{canthus:.00180,upper:.00850,lower:.00460'),'outer lid tissue reaches the orbital support while staying narrow at the canthi');
  check(source.includes('function compactEyeClosedDepth')&&source.includes('float compactLidClosedDepth')&&source.includes('upperFoldDistanceM:.00315'),'closed tissue has a separate endpoint-supported curve and the open fold retains its physical distance');
  check(source.includes('upperTurnSpanM:.00300,lowerTurnSpanM:.00180')&&source.includes('function compactEyeTissueDepth')&&source.includes('returnSource=restKnotZ+foldDepth+.00004+returnAllowance')&&!source.includes('plateZ=inner+delta')&&source.includes('dot(eyeCentre,u)'),'upper and lower tissue return has bounded volume above the actual source support, and lashes use the eye frame');
  check(source.includes('function compactEyeMarginPoint')&&source.includes('function compactEyeRimSurface')&&source.includes('wetFraction:.22'),'wet posterior margin and skin-coloured anterior cross-section are distinct physical surfaces');
  check(source.includes("name:'eyeLash'")&&source.includes('lashIndices.push')&&source.includes('if(compactEyeLid>2.5)')&&renderer.includes("c.name==='eyeLash'?3"),'real fibre geometry uses an independent eyelid-following shader path');
  check(source.includes('function compactEyeOcclusionShader')&&source.includes('shader.slice(bodyStart,bodyEnd)')&&source.includes('compactEyeMarginDistance'),'eye contact visibility uses the actual deformer free-margin definition rather than a second static ellipse');
  check(source.includes('function compactEyeSectionDepth')&&source.includes('float compactLidSectionDepth')&&source.includes('contactWeight=1-gap')&&!source.includes('float rimT='),'CPU and shader share separate C2 lid sections without the former secondary rim blend');
  check(source.includes('function compactEyeTearPoint')&&source.includes('vec3 compactTearLocalPoint')&&source.includes('if(compactEyeLid>3.5)')&&renderer.includes("c.name==='eyeTearDuct'?4"),'medial conjunctival bed follows both posed lid margins through its own renderer class');
  check(source.includes('sectionFraction=uintBitsToFloat(axillaCorrective.x)')&&source.includes('eyeSection:Float32Array.from')&&renderer.includes('m.eyeSection')&&renderer.includes("p.u.compactMuscleEnabled,c.name==='skin'?1:0"),'slot 15 source-section bits are confined to eyelid reconstruction while body corrective data retains its skin-only muscle gate');
  check(source.includes("name:'eyeIris'")&&source.includes('iris:{outerRadius:.00585,pupilRadius:.00210')&&source.includes('irisIndices.push'),'iris is generated as a bounded annulus in the shared eye frame');
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
  check(source.includes('min(limit,param.y+dr)')&&source.includes('max(low,param.y-dr)')&&source.includes('max(eyeLidParam.y,.003)'),'normal samples use bounded skin/cross-section neighbours and a posed side limit at a closed canthus');
  check(renderer.includes("['eyeSclera','eyeIris','eyePupil','eyeCornea'].includes(c.name)?2:0")&&renderer.includes("['FJ1289','FJ1340','FJ1297','FJ1348','FJ1317','FJ1368','FJ2812','FJ2814']")&&renderer.includes('if(compactSourceEye<1.5)'),'generated optical layers share blink correction and replace the source iris without applying the rest offset twice');
  check(source.includes("name:'eyeCornea'")&&source.includes('report.analyticCornea=true')&&renderer.includes("['FJ1289','FJ1340','eyeCornea'].includes(a.name)"),'one analytic transparent eye shell shares optical motion and sorts after opaque tissue');
  check(source.includes('function compactEyeCorneaDepth')&&source.includes('z=compactEyeCorneaDepth(x,y)')&&source.includes('cornea=compactEyeCorneaDepth(x,y)-retraction')&&source.includes('cornealRoot=sqrt')&&source.includes('x/denominator'),'visible corneal shell and CPU/GLSL contact share the conic surface with derivative normals');
  check(renderer.includes("p.u.compactEyeSide,eyeSide==='left'?0:1")&&source.includes('compactLidState[sideOffset+2]'),'optical layers and contact use the same independent eye side');
  check(renderer.includes('compactCanthusSlope')&&source.includes('cornerDepth.slopes'),'measured canthal attachment directions reach the closed-lid reconstruction shader');
  return {checks,applicationExecuted:false,humanGenerated:false,shaderCompiled:false,visualAcceptance:false};
}

const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/(Math.hypot(...a)||1)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function decodeNormal(x,y){x/=32767;y/=32767;const z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return norm([x,y,z]);}

// A planar skin ring gives an independently known aperture. It contains no
// source human samples; all fixture coordinates are generated from this formula.
function fixtureSkin(frames,gradient=[0,0]){
  const positions=[],indices=[],segments=96;
  for(const frame of Object.values(frames)){
    const start=positions.length/3;
    for(let i=0;i<=segments;i++)for(let r=0;r<2;r++){
      const angle=i/segments*2*Math.PI,x=(r?.023:.0135)*Math.cos(angle),y=(r?.019:.0075)*Math.sin(angle);
      positions.push(...add(frame.centre,add(mul(frame.u,x),add(mul(frame.v,y),mul(frame.n,.008+gradient[0]*x+gradient[1]*y)))));
    }
    for(let i=0;i<segments;i++){const a=start+i*2,b=a+2;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  return [{name:'skin',canonicalPositions:Float32Array.from(positions),indices:Uint16Array.from(indices)}];
}

export function checkEyeAnatomyParameterFixtures({read=readDefault,assert=assertDefault}={}){
  let checks=0;const check=(value,message)=>{assert(value,'Eye parameter fixture: '+message);checks++;};
  const context=vm.createContext({add,sub,mul,dot,cross,norm,clamp,COMPACT_INFLUENCES:8});
  new vm.Script(read('body/EyeAnatomy.js')+'\n;globalThis.eyeFixtureAPI={create:compactCreateEyeLids,sampler:compactEyeSkinSampler,patch:compactEyePatchPoint,margin:compactEyeMarginPoint,contact:compactEyeContactDepth,fissure:compactEyeNeutralFissure,overlap:compactEyeOuterOverlap,section:compactEyeSectionDepth,closed:compactEyeClosedDepth,tear:compactEyeTearPoint,anatomy:COMPACT_EYE_ANATOMY,shader:COMPACT_EYE_LID_GLSL,occlusionShader:compactEyeOcclusionShader()};',{filename:'isolated-eye-parameter-functions'}).runInContext(context,{timeout:1000});
  const api=context.eyeFixtureAPI,frames=Object.fromEntries(['left','right'].map(side=>[side,{centre:add(Array.from(api.anatomy[side].centre),[0,0,.00925]),u:[1,0,0],v:[0,1,0],n:[0,0,1]}]));
  const leftTemporal=api.fissure(0,'left'),leftMedial=api.fissure(Math.PI,'left'),rightTemporal=api.fissure(Math.PI,'right'),rightMedial=api.fissure(0,'right');
  const top=api.fissure(Math.PI/2,'left'),bottom=api.fissure(Math.PI*1.5,'left'),width=(leftTemporal[0]-leftMedial[0])*1000,height=(top[1]-bottom[1])*1000;
  check(width>25&&width<27,'neutral fissure width remains in the authored human-scale range');
  check(height>7.0&&height<9.4,'neutral fissure height remains in the authored 7.0 to 9.4 mm design range');
  check(leftTemporal[1]-leftMedial[1]>.0013&&rightTemporal[1]-rightMedial[1]>.0013,'temporal canthi sit above medial canthi on both sides');
  check(Math.abs(leftTemporal[1]-rightTemporal[1])<1e-12&&Math.abs(leftMedial[1]-rightMedial[1])<1e-12,'left and right neutral fissures remain mirrored');
  for(const side of ['left','right']){
    const arc=Array.from({length:361},(_,i)=>api.fissure(i/360*2*Math.PI,side)),highest=arc.reduce((a,b)=>a[1]>b[1]?a:b),lowest=arc.reduce((a,b)=>a[1]<b[1]?a:b),sign=side==='left'?1:-1;
    check(highest[0]*sign<0&&lowest[0]*sign>0,'upper arc peaks medially and lower arc temporally on '+side);
    check(api.anatomy.iris.outerRadius-top[1]>.001&&api.anatomy.iris.outerRadius-top[1]<.0026,'neutral upper lid covers one to 2.6 millimetres of the superior iris');
  }
  check(Math.abs(api.overlap(0)-api.anatomy.outerBand.canthus)<1e-12&&Math.abs(api.overlap(Math.PI)-api.anatomy.outerBand.canthus)<1e-12,'outer tissue overlap is narrow at both canthi');
  check(Math.abs(api.overlap(Math.PI/2)-api.anatomy.outerBand.upper)<1e-12&&Math.abs(api.overlap(Math.PI*1.5)-api.anatomy.outerBand.lower)<1e-12,'upper and lower outer tissue overlap retain separate bounded spans');
  check(api.anatomy.outerBand.marginRadial<.025&&api.anatomy.outerBand.marginOffset<.00006,'wet margin remains a narrow surface detail');
  for(const knot of [.48,.63,.83])for(const slope of [-.010,0,.010]){
    const args=[.006,.008,.003,slope,knot,.0065,.0005],at=t=>api.section(t,...args),eps=.00001;
    check(Math.abs(at(0)-args[0])<1e-12&&Math.abs(at(1)-args[1])<1e-12&&Math.abs(at(knot)-args[5])<1e-12,'two lid sections retain all three authored anchors');
    check(Math.abs((at(eps)-at(0))/eps-args[2])<1e-7&&Math.abs((at(1)-at(1-eps))/eps-slope)<1e-7,'sections retain independently specified free and orbital tangents');
    const leftSlope=(at(knot)-at(knot-eps))/eps,rightSlope=(at(knot+eps)-at(knot))/eps;
    check(Math.abs(leftSlope-args[6])<1e-7&&Math.abs(rightSlope-args[6])<1e-7,'pretarsal and preseptal sections share the same first derivative');
    const leftCurvature=(at(knot)-2*at(knot-eps)+at(knot-2*eps))/(eps*eps),rightCurvature=(at(knot+2*eps)-2*at(knot+eps)+at(knot))/(eps*eps);
    check(Math.abs(leftCurvature)<.0004&&Math.abs(rightCurvature)<.0004,'both sections converge to their common zero meridional curvature at the fold');
  }
  // A closed upper lid joining a more anterior orbital attachment must not
  // invent a second maximum and hollow between the globe and that attachment.
  // Exercise both depth directions, including a steep but compatible source
  // tangent; this property is independent of the chosen interpolation basis.
  for(const sign of [-1,1])for(const span of [.0005,.0015,.004])for(const m0 of [0,.002,.008])for(const m1 of [0,.004,.016]){
    const z0=.006,z1=z0+sign*span,at=t=>api.closed(t,z0,z1,sign*m0,sign*m1),eps=.00001;
    check(Math.abs(at(0)-z0)<1e-12&&Math.abs(at(1)-z1)<1e-12,'relaxed closed curve preserves its physical endpoints');
    check(Math.abs((at(eps)-at(0))/eps-sign*m0)<1e-6&&Math.abs((at(1)-at(1-eps))/eps-sign*m1)<1e-6,'relaxed closed curve preserves the free and orbital source tangents');
    let previous=at(0);for(let i=1;i<=80;i++){const current=at(i/80);check((current-previous)*sign>=-1e-12,'compatible closed attachments create no secondary lid mound or hollow');previous=current;}
  }
  for(const side of ['left','right'])for(const blink of [0,.5,1])for(let i=0;i<96;i++){
    const angle=i/96*2*Math.PI,o=[.019*Math.cos(angle),.014*Math.sin(angle),.008],g=[.1,.2],globe=[0,0,-.00925-api.anatomy.recess,api.anatomy[side].radius],corners=[.003,.003],state=[0,0,blink];
    const skin=api.patch(angle,-api.anatomy.outerBand.marginRadial,side,o,g,globe,corners,state),front=api.patch(angle,0,side,o,g,globe,corners,state),outer=api.margin(angle,api.anatomy.outerBand.marginRadial,side,o,g,globe,corners,state),inner=api.margin(angle,0,side,o,g,globe,corners,state);
    check([...outer,...inner].every(Number.isFinite),'finite meniscus at every sampled angle and blink state');
    check(Math.hypot(...sub(outer,skin))<1e-10,'wet posterior band meets the anterior skin cross-section under blinking');
    const width=Math.hypot(outer[0]-inner[0],outer[1]-inner[1]),depth=outer[2]-inner[2];
    check(width>=0&&width<.00010&&depth>=-1e-10&&depth<.00022,'wet band remains a narrow posterior part of the full lid cross-section');
    if(blink===0){const taper=Math.sin(angle)**2,totalDepth=front[2]-inner[2];check(totalDepth>=(Math.sin(angle)>=0?.00070:.00040)*taper-1e-7&&totalDepth<.00098,'open tissue has a visible upper/lower depth plane that converges at the canthi '+JSON.stringify({side,angle,totalDepth,taper}));}
    if(blink===1)check(width<1e-10&&depth<.000012,'wet edge is concealed at full lid contact');
  }
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
  // Independent ray/triangle sampling compares the generated optical meshes.
  // Do not reuse the authored contact/depth formulas: an inverted iris curve
  // or changed corneal construction must be visible to this layer check.
  const optical={irisSamples:0,normalSamples:0,conicSurfaceSamples:0,minimumCorneaGapM:Infinity,minimumPupilRecessM:Infinity,minimumIrisDishDepthM:Infinity};
  const localPositions=(mesh,frame)=>Array.from({length:mesh.vertices},(_,i)=>{
    const q=sub(Array.from(mesh.canonicalPositions.subarray(i*3,i*3+3)),frame.centre);
    return [dot(q,frame.u),dot(q,frame.v),dot(q,frame.n)];
  });
  const triangleDepth=(positions,indices)=>{
    const triangles=[];
    for(let i=0;i<indices.length;i+=3){const a=positions[indices[i]],b=positions[indices[i+1]],c=positions[indices[i+2]],den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
      if(Math.abs(den)>1e-18)triangles.push({a,b,c,den,loX:Math.min(a[0],b[0],c[0]),hiX:Math.max(a[0],b[0],c[0]),loY:Math.min(a[1],b[1],c[1]),hiY:Math.max(a[1],b[1],c[1])});
    }
    return (x,y)=>{let nearest=null;for(const {a,b,c,den,loX,hiX,loY,hiY}of triangles){
      if(x<loX-1e-9||x>hiX+1e-9||y<loY-1e-9||y>hiY+1e-9)continue;
      const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001)nearest=Math.max(nearest??-Infinity,u*a[2]+v*b[2]+(1-u-v)*c[2]);
    }return nearest;};
  };
  for(const side of ['left','right']){
    const frame=frames[side],mesh=name=>generated.meshes.find(m=>m.eyeSide===side&&m.name===name),iris=mesh('eyeIris'),cornea=mesh('eyeCornea'),pupil=mesh('eyePupil');
    const irisPoints=localPositions(iris,frame),corneaPoints=localPositions(cornea,frame),pupilPoints=localPositions(pupil,frame),corneaAt=triangleDepth(corneaPoints,cornea.indices);
    // An independent implicit conic equation validates the generated shell.
    // Its gradient gives a second route to the normal, without calling the
    // sag helper that produced the geometry or borrowing sphere normals.
    const conic=api.anatomy.cornea,apex=conic.apexOffsetM-api.anatomy.recess;
    for(let i=0;i<corneaPoints.length;i++){
      const [x,y,z]=corneaPoints[i],sag=apex-z,residual=x*x+y*y-2*conic.curvatureRadiusM*sag+(1+conic.asphericity)*sag*sag;
      const normalDistance=Math.abs(residual)/(2*Math.hypot(x,y,conic.curvatureRadiusM-(1+conic.asphericity)*sag));
      check(normalDistance<1e-7,'generated transparent shell satisfies its implicit conic equation within 100 nm world-Float32 quantization '+JSON.stringify({side,i,normalDistance}));
      const gradient=norm([x,y,conic.curvatureRadiusM-(1+conic.asphericity)*sag]),expected=add(mul(frame.u,gradient[0]),add(mul(frame.v,gradient[1]),mul(frame.n,gradient[2]))),actual=decodeNormal(cornea.normals[i*2],cornea.normals[i*2+1]);
      check(dot(actual,expected)>.99999,'generated corneal normals agree with the independent implicit-surface gradient');
      optical.conicSurfaceSamples++;
    }
    const sphere=api.anatomy[side],globe=[0,0,-.00925-api.anatomy.recess,sphere.radius];
    for(const blink of [0,.5,1])for(const x of [-.010,-.0086,.0086,.010]){
      const q=clamp((blink-.35)/.65,0,1),retraction=api.anatomy.blinkRetractionM*q*q*(3-2*q),sclera=globe[2]-retraction+Math.sqrt(globe[3]*globe[3]-x*x);
      check(Math.abs(api.contact(x,0,globe,blink)-sclera-.00028)<1e-12,'outside the corneal shell contact uses sclera once, without the former 75 micrometre self-blend offset');
    }
    for(const p of irisPoints){const z=corneaAt(p[0],p[1]);check(z!==null&&Number.isFinite(z)&&z-p[2]>.00075,'every sampled iris vertex remains behind the actual corneal triangles with a positive optical gap');optical.minimumCorneaGapM=Math.min(optical.minimumCorneaGapM,z-p[2]);optical.irisSamples++;}
    const pupilRecess=Math.min(...irisPoints.map(p=>p[2]))-Math.max(...pupilPoints.map(p=>p[2]));
    check(pupilRecess>.00025,'the complete pupil disc remains behind the innermost iris tissue');optical.minimumPupilRecessM=Math.min(optical.minimumPupilRecessM,pupilRecess);
    const inner=irisPoints.filter(p=>Math.hypot(p[0],p[1])<api.anatomy.iris.pupilRadius+.00001),outer=irisPoints.filter(p=>Math.hypot(p[0],p[1])>api.anatomy.iris.outerRadius-.00001);
    const dishDepth=Math.min(...outer.map(p=>p[2]))-Math.max(...inner.map(p=>p[2]));check(dishDepth>.0003,'iris limbus is anterior to its pupil edge, forming an inward dish rather than a convex second globe');optical.minimumIrisDishDepthM=Math.min(optical.minimumIrisDishDepthM,dishDepth);
    for(const m of [iris,cornea,pupil])for(let i=0;i<m.vertices;i++){
      const n=decodeNormal(m.normals[i*2],m.normals[i*2+1]);check(n.every(Number.isFinite)&&Math.abs(Math.hypot(...n)-1)<1e-10&&dot(n,frame.n)>.1,'optical front-layer normal is finite, normalized and faces forward: '+side+'/'+m.name);optical.normalSamples++;
    }
  }
  // A tilted source ring has an independently known interior depth. The
  // support knot must sample it, not interpolate the free and orbital edges.
  const supportGradient=[.12,.23],tilted=api.create(fixtureSkin(frames,supportGradient),frames,rig,1);
  for(const side of ['left','right']){
    const lid=tilted.meshes.find(m=>m.name==='eyeLidSkin'&&m.eyeSide===side),stride=api.anatomy.rings+1;
    check(tilted.report.sides[side].sourceSupportedSections===api.anatomy.segments,'every known source-ring direction provides a real section support');
    const bits=new Uint32Array(lid.eyeSection.buffer),decoded=new Float32Array(bits.buffer);
    check(lid.eyeSection.every((x,i)=>Object.is(x,decoded[i])),'integer attribute transport preserves all source-section float bits');
    for(let i=0;i<lid.vertices;i+=stride){
      const angle=lid.eyeParams[i*2],edge=api.fissure(angle,side),outer=Array.from(lid.eyeOuterPosition.subarray(i*3,i*3+3)),section=Array.from(lid.eyeSection.subarray(i*4,i*4+4)),x=edge[0]+(outer[0]-edge[0])*section[0],y=edge[1]+(outer[1]-edge[1])*section[0];
      check(section[0]>=.179999&&section[0]<=.89,'sampled section belongs to the bounded moving-to-fixed support region');
      check(Math.abs(section[1]-(.008+supportGradient[0]*x+supportGradient[1]*y))<4e-7,'section depth matches the tilted source plane rather than a chord between the lid endpoints');
      check(Math.hypot(section[2]-supportGradient[0],section[3]-supportGradient[1])<.0001,'section carries the actual source support gradient');
    }
  }
  for(const side of ['left','right'])for(const state of [[0,0,0],[1,0,0],[0,1,0],[0,0,.5],[0,0,1]])for(let i=0;i<=24;i++){
    const x=(side==='left'?-1:1)*(api.anatomy.fissure.halfWidth-.00004-.00125*i/24),angle=Math.acos(x/api.anatomy.fissure.halfWidth),globe=[0,0,-.00925-api.anatomy.recess,api.anatomy[side].radius],corners=generated.canthusDepths[side];
    const upper=api.patch(angle,0,side,[0,0,0],[0,0],globe,corners,state),lower=api.patch(-angle,0,side,[0,0,0],[0,0],globe,corners,state);
    for(let j=0;j<=10;j++){
      const v=j/10,p=api.tear(angle,v,side,globe,corners,state),edge=lower.map((a,k)=>a+(upper[k]-a)*v),inset=edge[2]-p[2];
      check(p.every(Number.isFinite)&&Math.hypot(p[0]-edge[0],p[1]-edge[1])<1e-12,'conjunctival bed stays within the actual posed margin span');
      check(inset>=.000119999&&inset<=.000280001,'bed remains buried 120–280 micrometres under its supporting margins');
      if(state[2]===1)check(Math.abs(p[1]-upper[1])<1e-9&&p[2]<upper[2]-.0001,'full closure covers the medial bed without a floating pink particle');
    }
  }
  for(const side of ['left','right'])for(const depth of generated.canthusDepths[side])check(Math.abs(depth-.008)<1e-6,'canthi attach to the known planar skin fixture rather than retreating to the globe equator');
  check(JSON.stringify(fixture)===before,'generation preserves transferred source arrays');
  check(generated.meshes.length===scaled.meshes.length,'stature does not alter topology');
  check(generated.report.triangles===generated.meshes.reduce((sum,m)=>sum+m.indices.length/3,0),'triangle report matches generated index buffers');
  for(const side of ['left','right'])check(generated.meshes.some(m=>m.eyeSide===side&&m.name==='eyeLidSkin')&&generated.meshes.some(m=>m.eyeSide===side&&m.name==='eyeLidMargin'),'both skin and wet margin exist for '+side);
  check(generated.report.lashStrands===2*(api.anatomy.lashes.upperCount+api.anatomy.lashes.lowerCount),'reported individual lash count matches both lids of both eyes');
  for(const side of ['left','right']){
    const lash=generated.meshes.find(m=>m.name==='eyeLash'&&m.eyeSide===side),p=api.anatomy.lashes,ring=p.sides+1,stride=ring*(p.segments+1),sphere=api.anatomy[side],globe=[0,0,-.00925-api.anatomy.recess,sphere.radius],corners=generated.canthusDepths[side];
    check(lash.eyeLid&&lash.vertices===stride*(p.upperCount+p.lowerCount),'every tapered fibre has its own attached 3D tube on '+side);
    const centre=start=>{let out=[0,0,0];for(let k=0;k<p.sides;k++)out=add(out,Array.from(lash.canonicalPositions.subarray((start+k)*3,(start+k)*3+3)));return mul(out,1/p.sides);};
    for(let first=0;first<lash.vertices;first+=stride){
      const angle=lash.eyeParams[first*2],t=lash.eyeParams[first*2+1],outer=Array.from(lash.eyeOuterPosition.subarray(first*3,first*3+3)),gradient=Array.from(lash.eyeOuterGradient.subarray(first*2,first*2+2)),section=Array.from(lash.eyeSection.subarray(first*4,first*4+4)),root=centre(first),tip=centre(first+p.segments*ring),expected=add(frames[side].centre,api.patch(angle,t,side,outer,gradient,globe,corners,[0,0,0],0,section));
      check(Math.hypot(...sub(root,expected))<3e-7,'fibre root lies on the actual eyelid parameter surface');
      check(Math.hypot(...sub(tip,root))>p.lowerLength*.35&&Math.hypot(...sub(tip,root))<.007,'lash retains positive length relative to the authored short lower lashes');
      if(Math.sin(angle)>.7){
        const direction=sub(tip,root);
        check(direction[2]>2*Math.abs(direction[1]),'central upper lashes extend primarily forward rather than forming a vertical needle fence');
        const section=Array.from(lash.eyeSection.subarray(first*4,first*4+4)),at=(a,r)=>api.patch(a,r,side,outer,gradient,globe,corners,[0,0,1],0,section),eps=.001;
        const tangent=norm(sub(at(angle+eps,t),at(angle-eps,t))),radial=sub(at(angle,t+eps),at(angle,t-eps));
        let normal=norm(cross(radial,tangent));if(normal[2]<0)normal=mul(normal,-1);const outward=norm(cross(tangent,normal));
        let offset=[0,0,0];for(let k=0;k<p.sides;k++)offset=add(offset,Array.from(lash.eyeTangentU.subarray((first+p.segments*ring+k)*3,(first+p.segments*ring+k)*3+3)));offset=mul(offset,1/p.sides);
        const turn=p.upperBlinkTurnRad,cy=Math.cos(turn)*offset[1]+Math.sin(turn)*offset[2],cz=-Math.sin(turn)*offset[1]+Math.cos(turn)*offset[2];
        const closed=add(mul(tangent,offset[0]),add(mul(outward,cy),mul(normal,cz)));
        check(closed[2]>.0001,'closed upper lashes retain anterior projection instead of rotating backwards through the eyelid '+JSON.stringify({side,angle,t,closed,normal,offset}));
      }
      const radius0=Math.hypot(...sub(Array.from(lash.canonicalPositions.subarray(first*3,first*3+3)),root)),last=(first+p.segments*ring)*3,radius1=Math.hypot(...sub(Array.from(lash.canonicalPositions.subarray(last,last+3)),tip));
      check(radius0<.00004&&radius0>.00001&&radius1<radius0*.25,'individual fibre tapers from a fine root to a narrower tip');
    }
  }
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
      check(m.eyeSection?.length===m.vertices*4&&m.eyeSection.every(Number.isFinite),'complete finite source-section slot for lid, margin, lash and medial bed '+label);
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
  const scalarContext=vm.createContext({clamp,mix:(a,b,t)=>a+(b-a)*t,sin:Math.sin,cos:Math.cos,exp:Math.exp,pow:Math.pow,sqrt:Math.sqrt,abs:Math.abs,max:Math.max,min:Math.min,uintBitsToFloat:x=>x,axillaCorrective:{x:0,y:0,z:0,w:0},eyeLidParam:{x:0,y:0},eyeOuterTangentU:{x:0,y:0,z:0}});
  scalarContext.compactLidSmooth01=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
  scalarContext.compactLidRestApertureY=(angle,sideSign,narrow,wide)=>{
    const p=api.anatomy.fissure,c=Math.cos(angle),s=Math.sin(angle),vertical=Math.abs(s),lateral=c*sideSign,canthus=s*s;
    const height=s>=0?p.upperHeight*(1+p.upperTemporalBias*lateral):p.lowerHeight*(1-p.lowerTemporalBias*lateral);
    const neutral=(s>=0?1:-1)*height*vertical*(1-p.verticalRoundness+p.verticalRoundness*vertical)+p.lateralCanthusLift*lateral*(1-canthus);
    return neutral+((s>=0?-.0022:.0014)*narrow+(s>=0?.0019:-.0004)*wide)*canthus;
  };
  scalarContext.compactLidClosedApertureY=(angle,sideSign,canthusSlopes)=>{
    const p=api.anatomy.fissure,c=Math.cos(angle),u=(c+1)*.5,u2=u*u,u3=u2*u,left=-p.lateralCanthusLift*sideSign,right=p.lateralCanthusLift*sideSign;
    const m0=canthusSlopes.x*2*p.halfWidth,m1=canthusSlopes.y*2*p.halfWidth;
    const base=(2*u3-3*u2+1)*left+(u3-2*u2+u)*m0+(-2*u3+3*u2)*right+(u3-u2)*m1;
    const centreFromTangents=(m0-m1)*.125,envelope=Math.pow(Math.max(0,1-c*c),api.anatomy.closure.envelopePower);
    return base+(api.anatomy.closure.centreY-centreFromTangents)*envelope;
  };
  function scalarFunction(name,args,returnExpression,source=api.shader){
    const at=source.indexOf(name+'('),body=source.slice(source.indexOf('{',at)+1,source.indexOf('\n}',at));
    const statements=[...body.matchAll(/\b(?:int|float)\s+([^;]+);/g)].map(m=>'let '+m[1]+';').join('\n');
    new vm.Script('globalThis.'+name+'=function('+args+'){'+statements+'\nreturn '+returnExpression+';}',{filename:name+'-scalar-fixture'}).runInContext(scalarContext);
    return scalarContext[name];
  }
  scalarFunction('compactLidContact','x,y','sclera+.00028+participation*((cornea-sclera)*(1.-h)+.0003*h*(1.-h))');
  scalarFunction('compactLidSectionDepth','t,z0,z1,m0,m1,knot,knotZ,knotSlope','a*(1.-10.*u3+15.*u4-6.*u5)+da*(u-6.*u3+8.*u4-3.*u5)+b*(10.*u3-15.*u4+6.*u5)+db*(-4.*u3+7.*u4-3.*u5)');
  scalarFunction('compactLidClosedDepth','t,z0,z1,m0,m1','z0+m0*(2.-pow(1.-q,power+1.)*(2.+power*q))/order+m1*pow(q,power+1.)*(order-power*q)/order+remainder*q*q*q*(10.-15.*q+6.*q*q)');
  scalarFunction('compactLidTissueDepth','t,z0,z1,m0,m1,a,za,ma,b,zb,mb','p*(1.-10.*u3+15.*u4-6.*u5)+dp*(u-6.*u3+8.*u4-3.*u5)+q*(10.*u3-15.*u4+6.*u5)+dq*(-4.*u3+7.*u4-3.*u5)');
  const shaderRim=scalarFunction('compactLidRimSurface','angle,u,base','[mix(backX,base.x,q),mix(backY,base.y,q),mix(backZ,base.z,q)]');
  const shaderPatch=scalarFunction('compactLidPatchLocal','angle,t,outer,gradient','[x,y,finalRimDepth]');
  const occlusionMargin=scalarFunction('compactEyeOcclusionMargin','angle,outer={x:0,y:0,z:0}','compactLidRimSurface(angle,0.,{x,y,z:marginZ})',api.occlusionShader);
  const states=[[0,0,0],[1,0,0],[0,1,0],[0,0,.5],[0,0,1],[.7,.2,.8]];
  // A nasal attachment may be shorter than the nominal tissue return. It
  // must not squeeze a multi-millimetre depth step into the first 10% of
  // the band. G failed this fixture with a slope above twenty.
  for(const side of ['left','right'])for(const blink of [0,.5,1]){
    const sign=side==='left'?-1:1,angle=side==='left'?7*Math.PI/6:11*Math.PI/6,outer=[sign*.013,-.003,.012],gradient=[sign*1.3,-.45],section=[.7,.0114,sign*1.25,-.45],corners=side==='left'?[.011,.0006]:[.0006,.011];
    corners.slopes=side==='left'?[-.38,-.22]:[.22,.38];
    const globe=[0,0,-.00925-api.anatomy.recess,api.anatomy[side].radius],state=[0,0,blink];
    let previous=null;
    for(let j=1;j<80;j++){
      const t=j/80,p=api.patch(angle,t,side,outer,gradient,globe,corners,state,0,section),a=api.patch(angle,t-.00005,side,outer,gradient,globe,corners,state,0,section),b=api.patch(angle,t+.00005,side,outer,gradient,globe,corners,state,0,section),slope=(b[2]-a[2])/Math.hypot(b[0]-a[0],b[1]-a[1]),normalAngle=Math.atan(slope);
      check(p.every(Number.isFinite)&&Math.abs(slope)<5,'short nasal bands retain a bounded final slope instead of an artificial compressed tarsal wall');
      if(previous!==null)check(Math.abs(normalAngle-previous)<.16,'short-band attachment has continuous final normal turns after optical support');
      previous=normalAngle;
    }
  }
  // This authored support fixture has an orbital roof ahead of the sampled
  // return. Closure must keep that independently supplied return; endpoint
  // interpolation alone inflated it into the former rounded cover.
  for(const blink of [0,.25,.5,.75,1]){
    const angle=Math.PI/2,outer=[0,.014,.0103],gradient=[0,.85],globe=[0,0,-.00925-api.anatomy.recess,api.anatomy.left.radius],corners=[.006,.006],state=[0,0,blink];
    const sectionY=.0072,sectionZ=.0055,sectionGradient=.50,section=[(sectionY-api.anatomy.fissure.upperHeight)/(outer[1]-api.anatomy.fissure.upperHeight),sectionZ,0,sectionGradient];
    const inner=api.patch(angle,0,'left',outer,gradient,globe,corners,state,0,section),span=outer[1]-inner[1];
    const closing=blink*blink*(3-2*blink),sourceReturn=sectionZ+.00004+api.anatomy.tissue.upperReturnAllowanceM*(.4+.6*closing);
    for(const [y,sourceDepth]of [[sectionY,sourceReturn]]){
      const point=api.patch(angle,(y-inner[1])/span,'left',outer,gradient,globe,corners,state,0,section),contact=api.contact(point[0],point[1],globe,blink)+api.anatomy.tissue.plateExcessM;
      const blend=api.anatomy.tissue.supportBlendM,h=clamp(.5+.5*(sourceDepth-contact)/blend,0,1),expected=contact+(sourceDepth-contact)*h+blend*h*(1-h);
      if(sectionY-inner[1]>=api.anatomy.tissue.upperMinimumPlateM+api.anatomy.tissue.upperTurnSpanM)check(Math.abs(point[2]-expected)<1e-8,'a return with enough physical space retains the declared source-supported soft-tissue allowance');
      check(point[2]>=api.contact(point[0],point[1],globe,blink)-1e-9,'the sculpted upper return stays in front of the optical contact envelope');
    }
    if(blink===1){
      let previousAngle=null;
      for(let j=0;j<=40;j++){
        const y=.002+.0048*j/40,t=(y-inner[1])/span,p=api.patch(angle,t,'left',outer,gradient,globe,corners,state,0,section),a=api.patch(angle,t-.00001,'left',outer,gradient,globe,corners,state,0,section),b=api.patch(angle,t+.00001,'left',outer,gradient,globe,corners,state,0,section),slope=(b[2]-a[2])/(b[1]-a[1]),normalAngle=Math.atan(slope);
        check(p[2]-api.contact(p[0],p[1],globe,blink)>.00020,'closed pretarsal tissue retains continuous depth above the optical shell instead of exposing a contact-clamped disc');
        check(slope>-.45&&Number.isFinite(slope),'the final supported return avoids the former steep backward-facing gutter');
        if(previousAngle!==null)check(Math.abs(normalAngle-previousAngle)<.08,'the final combined tissue/contact curve turns continuously through the visible return');
        previousAngle=normalAngle;
      }
    }
  }
  // Equal-depth attachments must not acquire a millimetre-scale artificial
  // hollow merely because the inherited outer skin has a steep derivative.
  {
    const angle=Math.PI/2,outer=[0,.0111,.0062],gradient=[0,.74],globe=[0,0,-.00925-api.anatomy.recess,api.anatomy.left.radius],corners=[.003,-.003],state=[0,0,1];
    outer[2]=api.patch(angle,0,'left',outer,gradient,globe,corners,state)[2];
    const inner=api.patch(angle,0,'left',outer,gradient,globe,corners,state),middle=api.patch(angle,.6,'left',outer,gradient,globe,corners,state);
    check(middle[2]>Math.min(inner[2],outer[2])-.0006,'closed lid cannot form an artificial hollow between equal-depth attachments');
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
    const m=generated.meshes.find(m=>m.eyeSide===side&&m.name==='eyeLidSkin'),sphere=api.anatomy[side],globe=[0,0,-.00925-api.anatomy.recess,sphere.radius],corners=Array.from(generated.canthusDepths[side]);corners.slopes=Array.from(generated.canthusDepths[side].slopes);
    Object.assign(scalarContext,{compactEyeSide:sideIndex,compactEyeLid:1,compactEyeGlobe:{x:0,y:0,z:-.00925-api.anatomy.recess,w:sphere.radius},compactCanthusDepth:{x:corners[0],y:corners[1]},compactCanthusSlope:{x:corners.slopes[0],y:corners.slopes[1]}});
    for(const [cornerIndex,angle,near]of [[0,Math.PI,Math.PI-.001],[1,0,.001]]){
      const o=[angle===0?.018:-.018,0,.008],g=[0,0],a=api.patch(angle,0,side,o,g,globe,corners,[0,0,1]),b=api.patch(near,0,side,o,g,globe,corners,[0,0,1]);
      check(Math.abs((b[1]-a[1])/(b[0]-a[0])-corners.slopes[cornerIndex])<.0001,'closed free margin meets the actual canthal attachment tangent on '+side);
    }
    for(const state of states){
      const all=[0,0,0,0,0,0];all.splice(sideIndex*3,3,...state);scalarContext.compactLidState=all;
      for(let i=0;i<48;i++){
        const angle=i/48*2*Math.PI,o=[.020*Math.cos(angle),.015*Math.sin(angle),.008],g=[.3,.2],front=api.patch(angle,0,side,o,g,globe,corners,state),base={x:front[0],y:front[1],z:front[2]};
        for(const q of [0,.25,.5,.75,1]){
          const p=api.anatomy,wetCPU=api.margin(angle,q*p.outerBand.marginRadial,side,o,g,globe,corners,state),wetGPU=shaderRim(angle,q*p.rim.wetFraction,base);
          const radial=-p.outerBand.marginRadial*(1-q),skinCPU=api.patch(angle,radial,side,o,g,globe,corners,state),skinGPU=shaderRim(angle,p.rim.wetFraction+(1-p.rim.wetFraction)*q,base);
          check(Math.hypot(...sub(wetCPU,wetGPU))<2e-10&&Math.hypot(...sub(skinCPU,skinGPU))<2e-10,'CPU and actual shader agree for both material portions of the physical lid cross-section');
          check(wetCPU[2]>=api.contact(wetCPU[0],wetCPU[1],globe,state[2])-.00028+.000035,'posterior wet surface stays in front of the optical envelope');
        }
        if(state.every(value=>value===0)){const posterior=api.margin(angle,0,side,o,g,globe,corners,state),fissure=api.fissure(angle,side);check(Math.hypot(posterior[0]-fissure[0],posterior[1]-fissure[1])<1e-10,'adding anterior tissue thickness does not move the visible posterior opening over the iris');}
      }
      for(let i=0;i<32;i++){
        const angle=i/32*2*Math.PI,actual=api.margin(angle,0,side,[.020*Math.cos(angle),.015*Math.sin(angle),.008],[.3,.2],globe,corners,state),contactCurve=occlusionMargin(angle);
        check(Math.hypot(...sub(actual,contactCurve))<2e-10,'fragment occlusion boundary matches the actual 3D free margin in every supplied lid pose');
      }
      for(let i=0;i<m.vertices;i+=3){
        const angle=m.eyeParams[i*2],t=m.eyeParams[i*2+1],o=Array.from(m.eyeOuterPosition.subarray(i*3,i*3+3)),g=Array.from(m.eyeOuterGradient.subarray(i*2,i*2+2)),section=Array.from(m.eyeSection.subarray(i*4,i*4+4));
        scalarContext.axillaCorrective={x:section[0],y:section[1],z:section[2],w:section[3]};scalarContext.eyeLidParam={x:angle,y:t};
        const cpu=api.patch(angle,t,side,o,g,globe,corners,state,0,section),shader=shaderPatch(angle,t,{x:o[0],y:o[1],z:o[2]},{x:g[0],y:g[1]});
        check(cpu.every(Number.isFinite)&&shader.every(Number.isFinite),'finite complete patch under supplied pose');
        const cpuShaderError=Math.hypot(...sub(cpu,shader));
        check(cpuShaderError<2e-10,'CPU and shader agree for each posed meridian; '+JSON.stringify({side,state,angle,t,cpu,shader,error:cpuShaderError,outer:o,gradient:g,section,corners}));
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
        const section=Array.from(m.eyeSection.subarray(i*4,i*4+4));
        const at=(a,r)=>api.patch(a,r,side,add(o,mul(ou,a-angle)),add(g,mul(gu,a-angle)),globe,corners,state,0,section);
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
        else if(dot(normal,average)<=0){inverted++;first??={triangle:i/3,params:ids.map(id=>Array.from(m.eyeParams.subarray(id*2,id*2+2))),positions:ids.map(id=>points[id]),normals:ids.map(id=>normals[id]),normalCosine:dot(norm(normal),norm(average))};}
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
  return {checks,optical,isolatedParameterFunctionsExecuted:true,syntheticSkinFixture:true,lidScalarMathEvaluated:true,humanGenerated:false,shaderCompiled:false,visualAcceptance:false};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result={source:checkEyeAnatomySources()};
  if(process.argv.includes('--parameter-fixtures'))result.parameters=checkEyeAnatomyParameterFixtures();
  console.log(JSON.stringify(result,null,2));
}
