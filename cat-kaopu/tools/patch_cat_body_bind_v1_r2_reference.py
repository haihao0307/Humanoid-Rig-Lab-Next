from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "cat-kaopu/body-bind-v1/index.html"
R1_CAPTURE = ROOT / "cat-kaopu/tools/capture_cat_body_bind_v1_r1.mjs"
R2_CAPTURE = ROOT / "cat-kaopu/tools/capture_cat_body_bind_v1_r2.mjs"

text = HTML.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        print(f"{label}: already present")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    text = text.replace(old, new, 1)
    print(f"{label}: patched")


replace_once(
    "CAT BODY BIND V1 R1 · 连续整猫身体候选",
    "CAT BODY BIND V1 R2 · 参考校准整猫身体候选",
    "page title",
)
replace_once(
    "CAT BODY BIND V1 · R1 整猫身体候选",
    "CAT BODY BIND V1 · R2 参考校准整猫身体候选",
    "header title",
)
replace_once(
    "当前只审整猫形态与基础材质，不生产动作。",
    "按参考截面与骨架锚点校准；当前只审整猫形态与基础材质，不生产动作。",
    "header boundary",
)
replace_once(
    '<button id="skeletonBtn">骨架锚点</button><button id="wireBtn">线框</button><button id="coatBtn" class="active">灰虎斑材质</button>',
    '<button id="skeletonBtn">骨架锚点</button><button id="featureBtn">眼鼻尺度标志</button><button id="wireBtn">线框</button><button id="coatBtn" class="active">灰虎斑材质</button>',
    "feature toggle",
)
replace_once('<button id="resetBtn">恢复 R0</button>', '<button id="resetBtn">恢复 R2</button>', "reset label")
replace_once('<div class="panel" id="panel">', '<div class="panel hidden" id="panel">', "panel default")
replace_once('<h2>R0 生产边界</h2>', '<h2>R2 生产边界</h2>', "panel heading")
replace_once(
    '<p>连续隐式作者态用于整猫轮廓决策。眼球、鼻镜和耳内是功能子结构；身体、耳根、四肢、足掌和尾根由同一连续场生成。当前尚未建立正式稳定拓扑、蒙皮和动作。</p>',
    '<p>连续隐式作者态由参考截面、骨架锚点和中性站立约束驱动。眼鼻尺度标志默认隐藏；身体、耳根、四肢、足掌和尾根由同一连续场生成。当前尚未建立稳定拓扑、正式蒙皮和动作。</p>',
    "panel paragraph",
)
replace_once(
    '<div class="status" id="status"><b>R1</b>：整猫身体作者态已与旧 V4.32 / Gate corrective 分离。下一门是四视图形态审批，不是动作或猫群。</div>',
    '<div class="status" id="status"><b>R2</b>：参考校准整猫作者态。先通过固定四视图，再冻结拓扑；动作、碰撞和猫群继续锁定。</div>',
    "status",
)
replace_once(
    "const bounds={minX:-.72,maxX:.56,minY:-.20,maxY:.20,minZ:-.025,maxZ:.60};const resolution=80;",
    "const bounds={minX:-.74,maxX:.54,minY:-.18,maxY:.18,minZ:-.025,maxZ:.58};const resolution=82;",
    "bounds and resolution",
)

start = text.find("function torsoSdf")
end = text.find("\nfunction setProgress", start)
if start < 0 or end < 0:
    if "reference-calibrated-section-sdf" not in text:
        raise SystemExit("R1 body-field range not found")
else:
    new_field = r'''function torsoSdf(x,y,z){
  const x0=-.285,x1=.220,xc=clamp(x,x0,x1),t=(xc-x0)/(x1-x0);
  const pelvis=Math.exp(-Math.pow((xc+.185)/.105,2)),thorax=Math.exp(-Math.pow((xc-.112)/.105,2)),lumbar=Math.exp(-Math.pow((xc+.045)/.070,2));
  let ry=.068+.020*pelvis+.030*thorax-.010*lumbar;
  let rz=.083+.018*pelvis+.038*thorax-.004*lumbar;
  ry*=1+(params.pelvis-1)*pelvis*.65+(params.thorax-1)*thorax*.72+(params.abdomen-1)*lumbar*.50;
  rz*=1+(params.pelvis-1)*pelvis*.55+(params.thorax-1)*thorax*.68+(params.abdomen-1)*lumbar*.45;
  const cz=.258+.032*(3*t*t-2*t*t*t)+.004*Math.exp(-Math.pow((xc-.10)/.10,2)),dx=x-xc,cap=.075;
  const q=Math.sqrt(Math.pow(dx/cap,2)+Math.pow(y/ry,2)+Math.pow((z-cz)/rz,2))-1;
  return q*Math.min(ry,rz,cap);
}
function bodySdf(x,y,z){let d=torsoSdf(x,y,z);const add=(v,k=.014)=>{d=smin(d,v,k)};
  add(ellipsoid(x,y,z,.145,0,.286,.095,.090,.105),.018);
  add(taperedCapsule(x,y,z,[.175,0,.315],[.285,0,.377],.062,.050),.017);
  add(taperedCapsule(x,y,z,[.175,0,.245],[.315,0,.350],.047,.040),.014);
  add(ellipsoid(x,y,z,.350,0,.405,.082,.070*params.head,.082),.018);
  add(ellipsoid(x,y,z,.405,0,.380,.055*params.muzzle,.046,.038),.012);
  add(ellipsoid(x,y,z,.408,0,.350,.052*params.muzzle,.043,.026),.010);
  add(ellipsoid(x,y,z,.376,0,.417,.055,.060*params.head,.048),.012);
  for(const side of [-1,1]){
    add(ellipsoid(x,y,z,.357,side*.042,.385,.055,.037*params.head,.048),.010);
    const tip=[.322,side*.052,.500+.060*(params.ears-1)],base=[.340,side*.050,.447];
    add(taperedCapsule(x,y,z,base,tip,.027,.003),.010);add(ellipsoid(x,y,z,.338,side*.048,.447,.036,.025,.031),.010);
    const sy=side*.060,lr=params.limbs;
    add(ellipsoid(x,y,z,.137,sy,.276,.054,.029*lr,.060),.012);
    add(taperedCapsule(x,y,z,[.145,sy,.273],[.112,sy,.160],.026*lr,.020*lr),.009);
    add(taperedCapsule(x,y,z,[.112,sy,.160],[.142,sy,.061],.020*lr,.0135*lr),.007);
    add(taperedCapsule(x,y,z,[.142,sy,.061],[.168,sy,.025],.014*lr,.010*lr),.005);
    add(ellipsoid(x,y,z,.187,sy,.015,.039*params.paws,.022*params.paws,.014),.006);
    const hy=side*.067;
    add(ellipsoid(x,y,z,-.175,hy,.260,.076,.043*lr,.080),.013);
    add(taperedCapsule(x,y,z,[-.175,hy,.255],[-.055,hy,.172],.035*lr,.026*lr),.010);
    add(taperedCapsule(x,y,z,[-.055,hy,.172],[-.205,hy,.074],.026*lr,.016*lr),.007);
    add(taperedCapsule(x,y,z,[-.205,hy,.074],[-.150,hy,.027],.016*lr,.011*lr),.005);
    add(ellipsoid(x,y,z,-.122,hy,.015,.043*params.paws,.023*params.paws,.014),.006);
  }
  const tail=[[-.285,0,.275],[-.375,.002,.270],[-.470,.008,.255],[-.560,.015,.245],[-.640,.023,.280],[-.705,.032,.345]];
  for(let i=0;i<tail.length-1;i++){const u=i/(tail.length-1),v=(i+1)/(tail.length-1);add(taperedCapsule(x,y,z,tail[i],tail[i+1],mix(.029,.009,u),mix(.029,.009,v)),.008)}
  return d;
}
function smoothScalarField(field,N,passes=1,strength=.16){
  const scratch=new Float32Array(field.length),N2=N*N;
  for(let pass=0;pass<passes;pass++){
    scratch.set(field);
    for(let z=1;z<N-1;z++)for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){
      const i=x+y*N+z*N2,avg=(field[i-1]+field[i+1]+field[i-N]+field[i+N]+field[i-N2]+field[i+N2])/6;
      scratch[i]=mix(field[i],avg,strength);
    }
    field.set(scratch);
  }
}'''
    text = text[:start] + new_field + text[end:]
    print("reference-calibrated body field: patched")

replace_once(
    "if(iz%7===0){setProgress(.05+.55*iz/(N-1),`采样 ${iz+1}/${N}`);await new Promise(r=>requestAnimationFrame(r))}}\n  setProgress(.65,'提取统一身体表面…');await new Promise(r=>requestAnimationFrame(r));body.update();",
    "if(iz%7===0){setProgress(.05+.50*iz/(N-1),`采样 ${iz+1}/${N}`);await new Promise(r=>requestAnimationFrame(r))}}\n  setProgress(.58,'平滑参考截面场…');await new Promise(r=>requestAnimationFrame(r));smoothScalarField(field,N,1,.16);\n  setProgress(.68,'提取统一身体表面…');await new Promise(r=>requestAnimationFrame(r));body.update();body.geometry.computeVertexNormals();",
    "field smoothing",
)
replace_once(
    "schema:'cat_kaopu/cat_kaopu/cat_body_bind_r1_stats@1.0',buildId:'cat-body-bind-v1-r1-20260917'",
    "schema:'cat_kaopu/cat_body_bind_r2_stats@1.0',buildId:'cat-body-bind-v1-r2-20260917'",
    "stats identity",
)
replace_once(
    "fieldRepresentation:'continuous-anatomical-sdf',stableTopology:false",
    "fieldRepresentation:'reference-calibrated-section-sdf',referenceCalibrated:true,fieldSmoothingPasses:1,featuresDefault:false,stableTopology:false",
    "stats fields",
)
replace_once(
    "const features=new THREE.Group();scene.add(features);const eyeMat=",
    "const features=new THREE.Group();features.visible=false;scene.add(features);const eyeMat=",
    "feature default",
)
replace_once(
    "for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),eyeMat);eye.position.set(.423,side*.071,.383);eye.scale.set(.018,.014,.019);features.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),pupilMat);pupil.position.set(.438,side*.075,.383);pupil.scale.set(.006,.004,.012);features.add(pupil);const earGeo=new THREE.BufferGeometry();const s=side;earGeo.setAttribute('position',new THREE.Float32BufferAttribute([.320,s*.054,.430,.348,s*.056,.425,.303,s*.069,.505],3));earGeo.computeVertexNormals();features.add(new THREE.Mesh(earGeo,innerMat))}\nconst nose=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),noseMat);nose.position.set(.480,0,.336);nose.scale.set(.016,.022,.014);features.add(nose);",
    "for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),eyeMat);eye.position.set(.414,side*.054,.397);eye.scale.set(.011,.009,.012);features.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),pupilMat);pupil.position.set(.424,side*.058,.397);pupil.scale.set(.0035,.0025,.007);features.add(pupil);const earGeo=new THREE.BufferGeometry();const s=side;earGeo.setAttribute('position',new THREE.Float32BufferAttribute([.326,s*.044,.446,.350,s*.047,.442,.322,s*.056,.498],3));earGeo.computeVertexNormals();features.add(new THREE.Mesh(earGeo,innerMat))}\nconst nose=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),noseMat);nose.position.set(.458,0,.371);nose.scale.set(.009,.014,.008);features.add(nose);",
    "feature scale",
)
replace_once(
    "const skeleton=new THREE.Group();skeleton.visible=false;scene.add(skeleton);const anchors={pelvis:[-.155,0,.247],lumbar:[-.035,0,.255],thorax:[.105,0,.280],neck:[.255,0,.345],head:[.355,0,.402],tail0:[-.260,0,.255],tail1:[-.455,.01,.185]};for(const side of [-1,1]){anchors[`shoulder${side}`]=[.165,side*.067,.274];anchors[`elbow${side}`]=[.118,side*.067,.165];anchors[`wrist${side}`]=[.145,side*.067,.067];anchors[`forepaw${side}`]=[.190,side*.067,.019];anchors[`hip${side}`]=[-.155,side*.075,.242];anchors[`stifle${side}`]=[-.038,side*.075,.155];anchors[`hock${side}`]=[-.205,side*.075,.074];anchors[`hindpaw${side}`]=[-.128,side*.075,.019]}",
    "const skeleton=new THREE.Group();skeleton.visible=false;scene.add(skeleton);const anchors={pelvis:[-.175,0,.268],lumbar:[-.045,0,.279],thorax:[.115,0,.302],neck:[.215,0,.326],head:[.355,0,.404],tail0:[-.292,0,.280],tail1:[-.470,.008,.255]};for(const side of [-1,1]){anchors[`shoulder${side}`]=[.155,side*.060,.290];anchors[`elbow${side}`]=[.116,side*.060,.170];anchors[`wrist${side}`]=[.144,side*.060,.060];anchors[`forepaw${side}`]=[.185,side*.060,.016];anchors[`hip${side}`]=[-.175,side*.068,.264];anchors[`stifle${side}`]=[-.055,side*.068,.178];anchors[`hock${side}`]=[-.205,side*.068,.076];anchors[`hindpaw${side}`]=[-.120,side*.068,.016]}",
    "skeleton anchors",
)
replace_once("controls.target.set(-.02,0,.245)", "controls.target.set(-.045,0,.270)", "view target")
replace_once(
    "document.querySelector('#skeletonBtn').onclick=e=>{skeleton.visible=!skeleton.visible;e.currentTarget.classList.toggle('active',skeleton.visible)};document.querySelector('#wireBtn')",
    "document.querySelector('#skeletonBtn').onclick=e=>{skeleton.visible=!skeleton.visible;e.currentTarget.classList.toggle('active',skeleton.visible)};document.querySelector('#featureBtn').onclick=e=>{features.visible=!features.visible;e.currentTarget.classList.toggle('active',features.visible)};document.querySelector('#wireBtn')",
    "feature handler",
)

HTML.write_text(text, encoding="utf-8")

capture = R1_CAPTURE.read_text(encoding="utf-8")
capture = capture.replace("body-bind-v1-r1", "body-bind-v1-r2")
capture = capture.replace("R1", "R2").replace("r1", "r2")
capture = capture.replace("cat-body-bind-v1-r1-20260917", "cat-body-bind-v1-r2-20260917")
marker = "  report.stats = await page.evaluate(() => window.__CAT_BODY_BIND_V1_GET_METRICS__());\n  const stage = page.locator('#stage');"
replacement = "  report.stats = await page.evaluate(() => window.__CAT_BODY_BIND_V1_GET_METRICS__());\n  await page.evaluate(() => { document.querySelector('#panel')?.classList.add('hidden'); const feature=document.querySelector('#featureBtn'); if(feature?.classList.contains('active')) feature.click(); });\n  const stage = page.locator('#stage');"
if marker not in capture:
    raise SystemExit("R2 capture preparation marker missing")
capture = capture.replace(marker, replacement, 1)
marker = "  report.assertions.notPrematurelySkinned = report.stats?.skinned === false;"
replacement = "  report.assertions.referenceCalibrated = report.stats?.referenceCalibrated === true\n    && report.stats?.fieldSmoothingPasses === 1\n    && report.stats?.featuresDefault === false;\n  report.assertions.notPrematurelySkinned = report.stats?.skinned === false;"
capture = capture.replace(marker, replacement, 1)
marker = "  await page.evaluate(() => document.querySelector('#skeletonBtn')?.click());\n\n  report.parameterSamples.default"
replacement = "  await page.evaluate(() => document.querySelector('#skeletonBtn')?.click());\n  await page.evaluate(() => document.querySelector('#featureBtn')?.click());\n  await page.evaluate(() => window.__CAT_BODY_BIND_V1_SET_VIEW__('quarter-front'));\n  await capture('featureScaleQuarter', 'CAT_BODY_BIND_V1_R2_FEATURE_SCALE_QUARTER_2026-09-17.png');\n  await page.evaluate(() => document.querySelector('#featureBtn')?.click());\n\n  report.parameterSamples.default"
if marker not in capture:
    raise SystemExit("R2 feature evidence marker missing")
capture = capture.replace(marker, replacement, 1)
marker = "  report.assertions.skeletonChangesPixels = report.screenshots.skeletonQuarter.sha256 !== report.screenshots['quarter-front'].sha256;"
replacement = "  report.assertions.skeletonChangesPixels = report.screenshots.skeletonQuarter.sha256 !== report.screenshots['quarter-front'].sha256;\n  report.assertions.featuresAreOptional = report.screenshots.featureScaleQuarter.sha256 !== report.screenshots['quarter-front'].sha256;"
capture = capture.replace(marker, replacement, 1)
R2_CAPTURE.write_text(capture, encoding="utf-8")
print("built Cat Body Bind V1 R2 reference-calibrated body and QA source")
