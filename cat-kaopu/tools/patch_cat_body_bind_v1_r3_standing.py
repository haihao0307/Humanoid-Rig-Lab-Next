from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "cat-kaopu/body-bind-v1/index.html"
R2_CAPTURE = ROOT / "cat-kaopu/tools/capture_cat_body_bind_v1_r2.mjs"
R3_CAPTURE = ROOT / "cat-kaopu/tools/capture_cat_body_bind_v1_r3.mjs"

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


replace_once("CAT BODY BIND V1 R2 · 参考校准整猫身体候选", "CAT BODY BIND V1 R3 · 中性站立整猫身体候选", "page title")
replace_once("CAT BODY BIND V1 · R2 参考校准整猫身体候选", "CAT BODY BIND V1 · R3 中性站立整猫身体候选", "header title")
replace_once(
    "按参考截面与骨架锚点校准；当前只审整猫形态与基础材质，不生产动作。",
    "按参考截面与中性站立锚点校准；当前只审形态和表面可读性，不生产动作。",
    "header boundary",
)
replace_once('<button id="resetBtn">恢复 R2</button>', '<button id="resetBtn">恢复 R3</button>', "reset label")
replace_once('<h2>R2 生产边界</h2>', '<h2>R3 生产边界</h2>', "panel heading")
replace_once(
    '<div class="status" id="status"><b>R2</b>：参考校准整猫作者态。先通过固定四视图，再冻结拓扑；动作、碰撞和猫群继续锁定。</div>',
    '<div class="status" id="status"><b>R3</b>：中性站立与低对比表面证据。先通过固定四视图，再冻结拓扑；蒙皮、动作和猫群继续锁定。</div>',
    "status",
)
replace_once(
    "const coatMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0,side:THREE.DoubleSide});",
    "const coatMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0,side:THREE.DoubleSide});",
    "coat roughness",
)

start = text.find("function torsoSdf")
end = text.find("\nfunction smoothScalarField", start)
if start < 0 or end < 0:
    if "neutral-standing-section-sdf" not in text:
        raise SystemExit("R2 field range not found")
else:
    new_field = r'''function torsoSdf(x,y,z){
  const x0=-.285,x1=.215,xc=clamp(x,x0,x1),t=(xc-x0)/(x1-x0);
  const pelvis=Math.exp(-Math.pow((xc+.185)/.105,2)),thorax=Math.exp(-Math.pow((xc-.105)/.105,2)),lumbar=Math.exp(-Math.pow((xc+.045)/.070,2));
  let ry=.066+.021*pelvis+.028*thorax-.009*lumbar;
  let rz=.081+.019*pelvis+.036*thorax-.003*lumbar;
  ry*=1+(params.pelvis-1)*pelvis*.65+(params.thorax-1)*thorax*.72+(params.abdomen-1)*lumbar*.50;
  rz*=1+(params.pelvis-1)*pelvis*.55+(params.thorax-1)*thorax*.68+(params.abdomen-1)*lumbar*.45;
  const cz=.282+.032*(3*t*t-2*t*t*t)+.004*Math.exp(-Math.pow((xc-.10)/.10,2)),dx=x-xc,cap=.074;
  const q=Math.sqrt(Math.pow(dx/cap,2)+Math.pow(y/ry,2)+Math.pow((z-cz)/rz,2))-1;
  return q*Math.min(ry,rz,cap);
}
function bodySdf(x,y,z){let d=torsoSdf(x,y,z);const add=(v,k=.012)=>{d=smin(d,v,k)};
  add(ellipsoid(x,y,z,.140,0,.306,.085,.084,.096),.015);
  add(taperedCapsule(x,y,z,[.170,0,.330],[.285,0,.392],.055,.043),.014);
  add(taperedCapsule(x,y,z,[.170,0,.265],[.312,0,.370],.041,.035),.011);
  add(ellipsoid(x,y,z,.350,0,.425,.074,.063*params.head,.074),.015);
  add(ellipsoid(x,y,z,.406,0,.397,.045*params.muzzle,.039,.032),.009);
  add(ellipsoid(x,y,z,.405,0,.370,.044*params.muzzle,.037,.021),.008);
  add(ellipsoid(x,y,z,.373,0,.433,.048,.052*params.head,.043),.009);
  for(const side of [-1,1]){
    add(ellipsoid(x,y,z,.355,side*.038,.405,.050,.033*params.head,.043),.008);
    const tip=[.322,side*.050,.505+.055*(params.ears-1)],base=[.338,side*.046,.458];
    add(taperedCapsule(x,y,z,base,tip,.024,.0028),.008);add(ellipsoid(x,y,z,.338,side*.045,.458,.032,.023,.028),.008);
    const sy=side*.058,lr=params.limbs;
    add(ellipsoid(x,y,z,.132,sy,.300,.048,.030*lr,.058),.010);
    add(taperedCapsule(x,y,z,[.142,sy,.294],[.110,sy,.174],.027*lr,.021*lr),.007);
    add(taperedCapsule(x,y,z,[.110,sy,.174],[.140,sy,.062],.021*lr,.0145*lr),.006);
    add(taperedCapsule(x,y,z,[.140,sy,.062],[.166,sy,.024],.0145*lr,.0105*lr),.004);
    add(ellipsoid(x,y,z,.185,sy,.014,.038*params.paws,.021*params.paws,.013),.005);
    const hy=side*.065;
    add(ellipsoid(x,y,z,-.175,hy,.288,.072,.044*lr,.078),.010);
    add(taperedCapsule(x,y,z,[-.175,hy,.282],[-.055,hy,.190],.037*lr,.027*lr),.008);
    add(taperedCapsule(x,y,z,[-.055,hy,.190],[-.205,hy,.082],.027*lr,.017*lr),.006);
    add(taperedCapsule(x,y,z,[-.205,hy,.082],[-.148,hy,.026],.017*lr,.011*lr),.004);
    add(ellipsoid(x,y,z,-.118,hy,.014,.043*params.paws,.023*params.paws,.013),.005);
  }
  const tail=[[-.285,0,.293],[-.375,.002,.287],[-.470,.008,.270],[-.560,.015,.258],[-.640,.023,.292],[-.705,.032,.360]];
  for(let i=0;i<tail.length-1;i++){const u=i/(tail.length-1),v=(i+1)/(tail.length-1);add(taperedCapsule(x,y,z,tail[i],tail[i+1],mix(.027,.008,u),mix(.027,.008,v)),.007)}
  return d;
}'''
    text = text[:start] + new_field + text[end:]
    print("neutral-standing body field: patched")

replace_once(
    "t=(1-smoothstep(.17,.29,z))*.28;",
    "t=(1-smoothstep(.17,.29,z))*.20;",
    "undercoat contrast",
)
replace_once(
    "t=smoothstep(.245,.38,z)*(1-smoothstep(.09,.16,Math.abs(y)))*.28;",
    "t=smoothstep(.260,.40,z)*(1-smoothstep(.08,.15,Math.abs(y)))*.18;",
    "dorsal contrast",
)
replace_once("*bodyBand*.58;", "*bodyBand*.22;", "body stripe contrast")
replace_once("*smoothstep(.18,.34,z)*.34;", "*smoothstep(.19,.35,z)*.14;", "side stripe contrast")
replace_once(
    "if(x>.285){t=smoothstep(.15,.9,Math.sin((y+.07)*72+(z-.32)*28))*.25;",
    "if(x>.285){t=smoothstep(.15,.9,Math.sin((y+.07)*72+(z-.34)*28))*.10;",
    "face stripe contrast",
)
replace_once("if(x<-.26){t=smoothstep(.15,.85,Math.sin((-x+z)*92))*.52;", "if(x<-.26){t=smoothstep(.15,.85,Math.sin((-x+z)*92))*.30;", "tail stripe contrast")
replace_once(
    "schema:'cat_kaopu/cat_body_bind_r2_stats@1.0',buildId:'cat-body-bind-v1-r2-20260917'",
    "schema:'cat_kaopu/cat_body_bind_r3_stats@1.0',buildId:'cat-body-bind-v1-r3-20260917'",
    "stats identity",
)
replace_once(
    "fieldRepresentation:'reference-calibrated-section-sdf',referenceCalibrated:true,fieldSmoothingPasses:1,featuresDefault:false",
    "fieldRepresentation:'neutral-standing-section-sdf',referenceCalibrated:true,neutralStanding:true,lowContrastCoat:true,fieldSmoothingPasses:1,featuresDefault:false",
    "stats fields",
)
replace_once(
    "for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),eyeMat);eye.position.set(.414,side*.054,.397);eye.scale.set(.011,.009,.012);features.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),pupilMat);pupil.position.set(.424,side*.058,.397);pupil.scale.set(.0035,.0025,.007);features.add(pupil);const earGeo=new THREE.BufferGeometry();const s=side;earGeo.setAttribute('position',new THREE.Float32BufferAttribute([.326,s*.044,.446,.350,s*.047,.442,.322,s*.056,.498],3));earGeo.computeVertexNormals();features.add(new THREE.Mesh(earGeo,innerMat))}\nconst nose=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),noseMat);nose.position.set(.458,0,.371);nose.scale.set(.009,.014,.008);features.add(nose);",
    "for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),eyeMat);eye.position.set(.408,side*.050,.415);eye.scale.set(.010,.008,.011);features.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),pupilMat);pupil.position.set(.417,side*.053,.415);pupil.scale.set(.003,.0022,.0065);features.add(pupil);const earGeo=new THREE.BufferGeometry();const s=side;earGeo.setAttribute('position',new THREE.Float32BufferAttribute([.326,s*.041,.456,.347,s*.044,.452,.322,s*.052,.503],3));earGeo.computeVertexNormals();features.add(new THREE.Mesh(earGeo,innerMat))}\nconst nose=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),noseMat);nose.position.set(.451,0,.390);nose.scale.set(.008,.012,.007);features.add(nose);",
    "feature scale",
)
replace_once(
    "const skeleton=new THREE.Group();skeleton.visible=false;scene.add(skeleton);const anchors={pelvis:[-.175,0,.268],lumbar:[-.045,0,.279],thorax:[.115,0,.302],neck:[.215,0,.326],head:[.355,0,.404],tail0:[-.292,0,.280],tail1:[-.470,.008,.255]};for(const side of [-1,1]){anchors[`shoulder${side}`]=[.155,side*.060,.290];anchors[`elbow${side}`]=[.116,side*.060,.170];anchors[`wrist${side}`]=[.144,side*.060,.060];anchors[`forepaw${side}`]=[.185,side*.060,.016];anchors[`hip${side}`]=[-.175,side*.068,.264];anchors[`stifle${side}`]=[-.055,side*.068,.178];anchors[`hock${side}`]=[-.205,side*.068,.076];anchors[`hindpaw${side}`]=[-.120,side*.068,.016]}",
    "const skeleton=new THREE.Group();skeleton.visible=false;scene.add(skeleton);const anchors={pelvis:[-.175,0,.292],lumbar:[-.045,0,.300],thorax:[.105,0,.315],neck:[.215,0,.350],head:[.350,0,.425],tail0:[-.292,0,.300],tail1:[-.470,.008,.270]};for(const side of [-1,1]){anchors[`shoulder${side}`]=[.145,side*.058,.305];anchors[`elbow${side}`]=[.110,side*.058,.174];anchors[`wrist${side}`]=[.140,side*.058,.062];anchors[`forepaw${side}`]=[.185,side*.058,.014];anchors[`hip${side}`]=[-.175,side*.065,.288];anchors[`stifle${side}`]=[-.055,side*.065,.190];anchors[`hock${side}`]=[-.205,side*.065,.082];anchors[`hindpaw${side}`]=[-.118,side*.065,.014]}",
    "skeleton anchors",
)
replace_once("controls.target.set(-.045,0,.270)", "controls.target.set(-.045,0,.292)", "view target")

HTML.write_text(text, encoding="utf-8")

capture = R2_CAPTURE.read_text(encoding="utf-8")
capture = capture.replace("body-bind-v1-r2", "body-bind-v1-r3")
capture = capture.replace("R2", "R3").replace("r2", "r3")
capture = capture.replace("cat-body-bind-v1-r2-20260917", "cat-body-bind-v1-r3-20260917")
marker = "  report.assertions.referenceCalibrated = report.stats?.referenceCalibrated === true\n    && report.stats?.fieldSmoothingPasses === 1\n    && report.stats?.featuresDefault === false;"
replacement = "  report.assertions.referenceCalibrated = report.stats?.referenceCalibrated === true\n    && report.stats?.neutralStanding === true\n    && report.stats?.lowContrastCoat === true\n    && report.stats?.fieldSmoothingPasses === 1\n    && report.stats?.featuresDefault === false;"
if marker not in capture:
    raise SystemExit("R3 stats assertion marker missing")
capture = capture.replace(marker, replacement, 1)
marker = "  await page.evaluate(() => document.querySelector('#featureBtn')?.click());\n\n  report.parameterSamples.default"
replacement = "  await page.evaluate(() => document.querySelector('#featureBtn')?.click());\n  await page.evaluate(() => document.querySelector('#coatBtn')?.click());\n  await page.evaluate(() => window.__CAT_BODY_BIND_V1_SET_VIEW__('quarter-front'));\n  await capture('neutralGreyQuarter', 'CAT_BODY_BIND_V1_R3_NEUTRAL_GREY_QUARTER_2026-09-17.png');\n  await page.evaluate(() => document.querySelector('#coatBtn')?.click());\n\n  report.parameterSamples.default"
if marker not in capture:
    raise SystemExit("R3 neutral evidence marker missing")
capture = capture.replace(marker, replacement, 1)
marker = "  report.assertions.featuresAreOptional = report.screenshots.featureScaleQuarter.sha256 !== report.screenshots['quarter-front'].sha256;"
replacement = "  report.assertions.featuresAreOptional = report.screenshots.featureScaleQuarter.sha256 !== report.screenshots['quarter-front'].sha256;\n  report.assertions.neutralGreyEvidence = report.screenshots.neutralGreyQuarter.sha256 !== report.screenshots['quarter-front'].sha256;"
capture = capture.replace(marker, replacement, 1)
R3_CAPTURE.write_text(capture, encoding="utf-8")
print("built Cat Body Bind V1 R3 neutral-standing body and QA source")
