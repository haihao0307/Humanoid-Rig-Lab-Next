from pathlib import Path


def replace(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, got {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')


face = Path('body/FaceAnatomy.js')
text = face.read_text(encoding='utf-8')

replacements = {
    "revision:'r11-nasal-subunit-continuity',columns:160,rows:152": "revision:'r12-perioral-chin-continuity',columns:160,rows:176",
    "bounds:[-.073,.072,1.433,1.575],ellipse:[-.0005,1.506,.068,.067]": "bounds:[-.073,.072,1.414,1.579],ellipse:[-.0005,1.498,.069,.080]",
    "if(Math.max(p[ia+1],p[ib+1],p[ic+1])<1.425||Math.min(p[ia+1],p[ib+1],p[ic+1])>1.58": "if(Math.max(p[ia+1],p[ib+1],p[ic+1])<1.410||Math.min(p[ia+1],p[ib+1],p[ic+1])>1.58",
    "if(loX>.08||hiX<-.08||loY>1.58||hiY<1.425": "if(loX>.08||hiX<-.08||loY>1.58||hiY<1.410",
    "Math.floor(Math.max(1.425,loY)/size)": "Math.floor(Math.max(1.410,loY)/size)",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'face header/sampler anchor mismatch: {old!r}, count={count}')
    text = text.replace(old, new, 1)

old_lips = """  lips:{centreX:-.0006,halfWidth:.0255,seamY:1.4586,apron:1.75,innerDepth:.0032,columns:160,rings:36,
    // Authored landmarks and sectional rails, visually informed by VAA and Ten24.
    // Rows: abs(horizontal parameter), fissure, upper border, lower border (m).
    outline:[[0,-.00085,.0043,-.0064],[.22,-.00035,.0050,-.0064],[.45,.00030,.0041,-.0056],[.70,.00006,.0025,-.0036],[.88,-.00030,.00075,-.00165],[1,-.00045,-.00045,-.00045]],
    upperSection:[[0,.0023],[.20,.00255],[.50,.00235],[.85,.00190],[1,.00165],[1.75,0]],
    lowerSection:[[0,.0023],[.20,.0032],[.50,.0038],[.75,.0038],[1,.0030],[1.75,0]]},
"""
new_lips = """  lips:{centreX:-.0006,halfWidth:.0244,seamY:1.4587,apron:1.60,innerDepth:.0027,columns:160,rings:36,
    // Authored landmarks and sectional rails, visually informed by VAA and Ten24.
    // Rows: abs(horizontal parameter), fissure, upper border, lower border (m).
    outline:[[0,-.00035,.00325,-.00460],[.18,.00015,.00395,-.00475],[.38,.00045,.00355,-.00420],[.62,.00015,.00245,-.00320],[.82,-.00010,.00110,-.00190],[.94,-.00022,.00018,-.00065],[1,-.00028,-.00028,-.00028]],
    upperSection:[[0,.00165],[.18,.00190],[.45,.00178],[.78,.00145],[1,.00115],[1.14,.00122],[1.36,.00055],[1.60,0]],
    lowerSection:[[0,.00165],[.20,.00210],[.48,.00245],[.75,.00235],[1,.00165],[1.18,.00095],[1.42,.00042],[1.60,0]],
    whiteRollUpper:.00024,whiteRollLower:.00012,whiteRollCentre:1.06,whiteRollWidth:.14},
  perioral:{philtrumY:1.4690,ridgeX:.0032,ridgeRx:.0021,ridgeRy:.0090,ridgeHeight:.00030,grooveRx:.0035,grooveRy:.0095,grooveDepth:.00022,
    labiomentalY:1.4398,labiomentalRx:.0245,labiomentalRy:.0058,labiomentalDepth:.00052,
    mentalisY:1.4268,mentalisRx:.0225,mentalisRy:.0115,mentalisHeight:.00105},
"""
if text.count(old_lips) != 1:
    raise SystemExit(f'lip parameter block mismatch: {text.count(old_lips)}')
text = text.replace(old_lips, new_lips, 1)

old_form = """function compactFaceFormDepth(x,y){
  let depth=0;for(const f of COMPACT_FACE_ANATOMY.forms){const r=Math.hypot((x-f.x)/f.rx,(y-f.y)/f.ry);if(r<1)depth+=f.z*(1-r)**4*(1+4*r);}
  const n=COMPACT_FACE_ANATOMY.nostrils;for(const side of [-1,1]){const r=Math.hypot((x-side*n.x)/n.rx,(y-n.y-n.tilt*(side*x-n.x))/n.ry);if(r<2.5)depth+=.00040*Math.exp(-(((r-1.18)/.48)**2));}
  return depth;
}
"""
new_form = """function compactFaceFormDepth(x,y){
  let depth=0;for(const f of COMPACT_FACE_ANATOMY.forms){const r=Math.hypot((x-f.x)/f.rx,(y-f.y)/f.ry);if(r<1)depth+=f.z*(1-r)**4*(1+4*r);}
  const n=COMPACT_FACE_ANATOMY.nostrils;for(const side of [-1,1]){const r=Math.hypot((x-side*n.x)/n.rx,(y-n.y-n.tilt*(side*x-n.x))/n.ry);if(r<2.5)depth+=.00040*Math.exp(-(((r-1.18)/.48)**2));}
  return depth;
}
function compactFaceBump(x,y,cx,cy,rx,ry,amplitude){
  const r=Math.hypot((x-cx)/rx,(y-cy)/ry);return r<1?amplitude*(1-r)**4*(1+4*r):0;
}
function compactPerioralDepth(x,y){
  const p=COMPACT_FACE_ANATOMY.perioral;
  const ridges=compactFaceBump(x,y,-p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight)+compactFaceBump(x,y,p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight);
  const groove=compactFaceBump(x,y,0,p.philtrumY,p.grooveRx,p.grooveRy,-p.grooveDepth);
  const crease=compactFaceBump(x,y,0,p.labiomentalY,p.labiomentalRx,p.labiomentalRy,-p.labiomentalDepth);
  const chin=compactFaceBump(x,y,0,p.mentalisY,p.mentalisRx,p.mentalisRy,p.mentalisHeight);
  return ridges+groove+crease+chin;
}
"""
if text.count(old_form) != 1:
    raise SystemExit('perioral function insertion anchor mismatch')
text = text.replace(old_form, new_form, 1)

old_relief = """function compactLipReliefDepth(u,t,upper){
  const p=COMPACT_FACE_ANATOMY.lips,r=t*p.apron,envelope=Math.pow(Math.max(0,1-u*u),.72);
  const base=compactLipCurve(upper?p.upperSection:p.lowerSection,r,1,true);
  const pad=upper?Math.exp(-((u/.20)**2)):Math.exp(-(((Math.abs(u)-.30)/.24)**2));
  const swell=(upper?.00055:.00035)*pad*Math.sin(Math.PI*Math.min(1,r))*Math.max(0,1-r);
  return envelope*(base+swell);
}
"""
new_relief = """function compactLipReliefDepth(u,t,upper){
  const p=COMPACT_FACE_ANATOMY.lips,r=t*p.apron,envelope=Math.pow(Math.max(0,1-u*u),.82);
  const base=compactLipCurve(upper?p.upperSection:p.lowerSection,r,1,true);
  const pad=upper?Math.exp(-((u/.22)**2)):Math.exp(-(((Math.abs(u)-.28)/.25)**2));
  const swell=(upper?.00034:.00018)*pad*Math.sin(Math.PI*Math.min(1,r))*Math.max(0,1-r);
  const whiteRoll=(upper?p.whiteRollUpper:p.whiteRollLower)*Math.exp(-(((r-p.whiteRollCentre)/p.whiteRollWidth)**2))*Math.pow(Math.max(0,1-u*u),1.25);
  return envelope*(base+swell)+whiteRoll;
}
"""
if text.count(old_relief) != 1:
    raise SystemExit('lip relief anchor mismatch')
text = text.replace(old_relief, new_relief, 1)

old_oral = """  const oralLo=1.440,oralHi=1.474,oralSpan=oralHi-oralLo;
"""
new_oral = """  const oralLo=1.429,oralHi=1.476,oralSpan=oralHi-oralLo;
"""
if text.count(old_oral) != 1:
    raise SystemExit('oral bed bounds anchor mismatch')
text = text.replace(old_oral, new_oral, 1)

old_post_bed = """    }}
  // A small shared commissure depression recesses the joining lips into skin.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const x=x0+i*dx,y=y0+j*dy,q=compactLipOutline(x),r=Math.hypot((Math.abs(x-p.lips.centreX)-p.lips.halfWidth*.98)/.0035,(y-q.seam)/.0026);
    if(r<1)height[at(i,j)]-=.00055*Math.pow(1-r,4)*(1+4*r);
  }
"""
new_post_bed = """    }}
  // Reapply bounded philtral, labiomental and mentalis volumes after the
  // inherited oral ridge has been replaced by its smooth attachment bed.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const x=x0+i*dx,y=y0+j*dy;height[at(i,j)]+=compactPerioralDepth(x,y);}
  // The oral commissures are shallow three-dimensional insertions, not two
  // sharp lip wedges meeting at a black point.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const x=x0+i*dx,y=y0+j*dy,q=compactLipOutline(x),r=Math.hypot((Math.abs(x-p.lips.centreX)-p.lips.halfWidth*.975)/.0044,(y-q.seam)/.0033);
    if(r<1)height[at(i,j)]-=.00034*Math.pow(1-r,4)*(1+4*r);
  }
"""
if text.count(old_post_bed) != 1:
    raise SystemExit('perioral bed insertion anchor mismatch')
text = text.replace(old_post_bed, new_post_bed, 1)

old_surface = """  const lipSurface=(x,upper,t)=>{const q=compactLipOutline(x),edge=upper?q.top:q.bottom,r=compactLipRadial(lp.apron*t),y=q.seam+(edge-q.seam)*r+(upper?1:-1)*.000035*Math.min(1,(q.top-q.bottom)/.004)*(1-3*t*t+2*t*t*t);
"""
new_surface = """  const lipSurface=(x,upper,t)=>{const q=compactLipOutline(x),edge=upper?q.top:q.bottom,r=compactLipRadial(lp.apron*t),y=q.seam+(edge-q.seam)*r+(upper?1:-1)*.000008*Math.min(1,(q.top-q.bottom)/.004)*(1-3*t*t+2*t*t*t);
"""
if text.count(old_surface) != 1:
    raise SystemExit('neutral lip closure anchor mismatch')
text = text.replace(old_surface, new_surface, 1)

old_inner = """    const innerPoint=(x,t)=>{const q=compactLipOutline(x),a=lipSurface(x,upper,0),angle=t*Math.PI/2,sign=upper?1:-1;return [x,a[1]+sign*.0008*q.envelope*(1-Math.cos(angle)),a[2]-lp.innerDepth*q.envelope*Math.sin(angle)];};
"""
new_inner = """    const innerPoint=(x,t)=>{const q=compactLipOutline(x),a=lipSurface(x,upper,0),angle=t*Math.PI/2,sign=upper?1:-1;return [x,a[1]+sign*.00055*q.envelope*(1-Math.cos(angle)),a[2]-lp.innerDepth*q.envelope*Math.sin(angle)];};
"""
if text.count(old_inner) != 1:
    raise SystemExit('inner vermilion return anchor mismatch')
text = text.replace(old_inner, new_inner, 1)

old_mouth = """  const mouthPoint=(a,t)=>{const x=lp.centreX+lp.halfWidth*.998*Math.cos(a)*(1-.38*t),q=compactLipOutline(x),seam=lipSurface(x,true,0)[2];return [x,q.seam+.0007*Math.sin(a)*(1+3*t),seam-.0020-.010*t];};
"""
new_mouth = """  const mouthPoint=(a,t)=>{const x=lp.centreX+lp.halfWidth*.992*Math.cos(a)*(1-.38*t),q=compactLipOutline(x),seam=lipSurface(x,true,0)[2];return [x,q.seam+.00045*Math.sin(a)*(1+3*t),seam-.0030-.010*t];};
"""
if text.count(old_mouth) != 1:
    raise SystemExit('oral interior anchor mismatch')
text = text.replace(old_mouth, new_mouth, 1)

old_report = """nostrilFrames,nasalUnderturn:true,innerVermilion:true,lipSectionRails:true,roundedInnerReturn:true,triangles:output.reduce((s,m)=>s+m.triangles,0),sourceCoefficientsModified:false,measuredAnatomy:false"""
new_report = """nostrilFrames,nasalUnderturn:true,innerVermilion:true,lipSectionRails:true,roundedInnerReturn:true,perioralContinuity:true,philtrum:true,labiomentalCrease:true,mentalisPad:true,triangles:output.reduce((s,m)=>s+m.triangles,0),sourceCoefficientsModified:false,measuredAnatomy:false"""
if text.count(old_report) != 1:
    raise SystemExit('face anatomy report anchor mismatch')
text = text.replace(old_report, new_report, 1)

face.write_text(text, encoding='utf-8', newline='\n')

check = Path('tools/check-face-anatomy.mjs')
value = check.read_text(encoding='utf-8')
value = value.replace("revision:'r11-nasal-subunit-continuity'", "revision:'r12-perioral-chin-continuity'", 1)
source_anchor = " check(source.includes('domeX:.0046')&&source.includes('alarGrooveDepth:.00072')&&source.includes('sidewallHeight:.00030'),'nasal tip domes, alar lobules, grooves and sidewalls are explicit bounded subunits');"
if value.count(source_anchor) != 1:
    raise SystemExit('face source check anchor mismatch')
value = value.replace(source_anchor, source_anchor + "\n check(source.includes('function compactPerioralDepth')&&source.includes('whiteRollUpper:.00024')&&source.includes('mentalisHeight:.00105'),'philtrum, white roll, labiomental crease and mentalis pad are explicit bounded structures');", 1)
api_anchor = "globalThis.api={create:compactCreateFaceAnatomy,sample:compactFaceRaySampler,form:compactFaceFormDepth,outline:compactLipOutline,relief:compactLipReliefDepth,radial:compactLipRadial,opening:compactLipOpening,parameters:COMPACT_FACE_ANATOMY};"
api_replacement = "globalThis.api={create:compactCreateFaceAnatomy,sample:compactFaceRaySampler,form:compactFaceFormDepth,perioral:compactPerioralDepth,outline:compactLipOutline,relief:compactLipReliefDepth,radial:compactLipRadial,opening:compactLipOpening,parameters:COMPACT_FACE_ANATOMY};"
if value.count(api_anchor) != 1:
    raise SystemExit('face fixture API anchor mismatch')
value = value.replace(api_anchor, api_replacement, 1)
plane_anchor = "const plane={name:'skin',canonicalPositions:Float32Array.from([-.09,1.43,.19,.09,1.43,.19,.09,1.59,.19,-.09,1.59,.19]),indices:Uint16Array.from([0,1,2,0,2,3])};"
plane_replacement = "const plane={name:'skin',canonicalPositions:Float32Array.from([-.09,1.40,.19,.09,1.40,.19,.09,1.59,.19,-.09,1.59,.19]),indices:Uint16Array.from([0,1,2,0,2,3])};"
if value.count(plane_anchor) != 1:
    raise SystemExit('synthetic face plane anchor mismatch')
value = value.replace(plane_anchor, plane_replacement, 1)
parameter_anchor = " check(nose.knots.every((row,i,all)=>i===0||row[0]>all[i-1][0])&&nose.knots.every(row=>row[2]>.008&&row[2]<.020),'nasal profile rails are ordered and bounded');"
parameter_insert = """ check(nose.knots.every((row,i,all)=>i===0||row[0]>all[i-1][0])&&nose.knots.every(row=>row[2]>.008&&row[2]<.020),'nasal profile rails are ordered and bounded');
 const lips=api.parameters.lips,centre=api.outline(lips.centreX),peak=api.outline(lips.centreX+lips.halfWidth*.18),centralHeight=centre.top-centre.bottom;
 check(lips.halfWidth>.023&&lips.halfWidth<.025&&centralHeight>.007&&centralHeight<.009,'neutral mouth width and central vermilion height remain bounded');
 check(peak.top>centre.top&&centre.bottom>peak.bottom,'Cupid bow and lower-lip belly remain distinct without an inflated uniform ring');
 check(api.relief(0,0,true)<.0021&&api.relief(0,0,false)<.0021,'neutral free-edge projection remains below the former swollen candidate');
 check(api.perioral(-api.parameters.perioral.ridgeX,api.parameters.perioral.philtrumY)>0&&api.perioral(0,api.parameters.perioral.philtrumY)<0,'philtral ridges flank a central groove');
 check(api.perioral(0,api.parameters.perioral.labiomentalY)<0&&api.perioral(0,api.parameters.perioral.mentalisY)>0,'labiomental crease separates lower lip support from the mentalis pad');"""
if value.count(parameter_anchor) != 1:
    raise SystemExit('face parameter check insertion anchor mismatch')
value = value.replace(parameter_anchor, parameter_insert, 1)
check.write_text(value, encoding='utf-8', newline='\n')

Path('docs/FACE_PERIORAL_CHIN_R8.md').write_text(
    '''# 口周与下巴连续结构 R8

2026-09-15。本阶段针对 R7 浏览器近景中最明显的下脸问题：上下唇像独立充气环、口角尖锐、唇缝过黑、人中缺失、下唇到下巴之间形成宽硬阴影，以及中央下巴仍受旧曲面折面限制。

## 结构修改

- `body/FaceAnatomy.js` 升级为 `r12-perioral-chin-continuity`。
- 正面面部替换域向下覆盖中央下巴，但仍限制在头部中央椭圆范围，不改变 Core Rig、骨长或下颌骨父子关系。
- 上下唇重新定义宽度、唇峰、唇珠、下唇腹和口角收束；中性中央唇红总高度由约 10.7 mm 收敛到约 7.9 mm。
- 唇部前突曲线整体减弱，且上下唇自由边使用相同接触深度，减少侧面双层凸起和中性唇缝暴露。
- 新增独立白唇缘局部隆起，不再用整片唇体膨胀冒充白唇缘。
- 人中由两条有界人中嵴和中央凹沟组成；下唇下方建立浅而宽的颏唇沟，并在其下加入独立颏肌/下巴软组织垫。
- 口角凹陷变宽、变浅，防止上下唇以尖楔相交。
- 口腔入口进一步后移，中性闭口仍保留极窄接触线，但不应形成贯穿整口的黑槽。

## 依据与边界

上唇从鼻底延伸至唇红缘，中央包含人中凹沟及成对人中嵴；上下唇在口角汇合。下唇与下巴之间由颏唇沟分隔，下巴体积主要来自下颌前部、颏肌和皮下软组织。当前实现只把这些关系转成有界程序化形态，不是医学扫描、组织有限元或统计人脸模型。

## 验证

- 完整源码装配与纯文件审计
- 面部几何、鼻腔、唇部内返、口腔深度及绑定参数夹具
- 身份/表情分层、NPC uniform 隔离和启动测试
- 独立浏览器单人物正面、侧面、嘴鼻近景与中性/张口检查

浏览器截图仍需用户判断。`visualAcceptance=false`，`productionReady=false`。
''',
    encoding='utf-8',
    newline='\n',
)

readme = Path('README.md')
readme_text = readme.read_text(encoding='utf-8')
marker = '# 重建人物 R2 · 行为与人物模块修整 R11\n'
entry = '''
2026-09-15 **口周与下巴连续结构 R8**：缩小并减薄中性唇体，重新建立唇峰、唇珠、下唇腹、白唇缘与宽浅口角；新增人中嵴/凹沟、颏唇沟和颏肌软组织垫，并把中央面部替换域向下延伸到下巴。实现仍为程序化候选，等待固定视角视觉验收。见 [口周与下巴连续结构 R8](docs/FACE_PERIORAL_CHIN_R8.md)。
'''
if marker not in readme_text:
    raise SystemExit('README title anchor missing')
if entry.strip() not in readme_text:
    readme_text = readme_text.replace(marker, marker + entry, 1)
readme.write_text(readme_text, encoding='utf-8', newline='\n')
