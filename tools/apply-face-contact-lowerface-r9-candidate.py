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
    "revision:'r12-perioral-chin-continuity'": "revision:'r13-neutral-oral-seal-lower-face'",
    "whiteRollUpper:.00012,whiteRollLower:.00005,whiteRollCentre:1.045,whiteRollWidth:.065": "whiteRollUpper:.00006,whiteRollLower:.00002,whiteRollCentre:1.040,whiteRollWidth:.052",
    "perioral:{philtrumY:1.4690,ridgeX:.0032,ridgeRx:.0021,ridgeRy:.0090,ridgeHeight:.00030,grooveRx:.0035,grooveRy:.0095,grooveDepth:.00022,\n    labiomentalY:1.4450,labiomentalRx:.0230,labiomentalRy:.0048,labiomentalDepth:.00038,\n    mentalisY:1.4355,mentalisRx:.0210,mentalisRy:.0060,mentalisHeight:.00072}": "perioral:{columellaBridgeY:1.4770,columellaBridgeRx:.0038,columellaBridgeRy:.0046,columellaBridgeHeight:.00018,\n    subnasaleY:1.4734,subnasaleRx:.0046,subnasaleRy:.0038,subnasaleDepth:.00014,\n    philtrumY:1.4688,ridgeX:.0031,ridgeRx:.0019,ridgeRy:.0088,ridgeHeight:.00036,grooveRx:.0031,grooveRy:.0089,grooveDepth:.00026,\n    labiomentalY:1.4452,labiomentalRx:.0195,labiomentalRy:.0040,labiomentalDepth:.00027,\n    mentalisY:1.4368,mentalisRx:.0145,mentalisRy:.0072,mentalisHeight:.00050,mentalisWingX:.0125,mentalisWingY:1.4350,mentalisWingRx:.0175,mentalisWingRy:.0095,mentalisWingHeight:.00018,\n    chinBaseY:1.4297,chinBaseRx:.0260,chinBaseRy:.0065,chinBaseHeight:.00012}",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'R9 parameter anchor mismatch: {old!r}, count={count}')
    text = text.replace(old, new, 1)

old_depth = """function compactPerioralDepth(x,y){
  const p=COMPACT_FACE_ANATOMY.perioral;
  const ridges=compactFaceBump(x,y,-p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight)+compactFaceBump(x,y,p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight);
  const groove=compactFaceBump(x,y,0,p.philtrumY,p.grooveRx,p.grooveRy,-p.grooveDepth);
  const crease=compactFaceBump(x,y,0,p.labiomentalY,p.labiomentalRx,p.labiomentalRy,-p.labiomentalDepth);
  const chin=compactFaceBump(x,y,0,p.mentalisY,p.mentalisRx,p.mentalisRy,p.mentalisHeight);
  return ridges+groove+crease+chin;
}
"""
new_depth = """function compactPerioralDepth(x,y){
  const p=COMPACT_FACE_ANATOMY.perioral;
  const bridge=compactFaceBump(x,y,0,p.columellaBridgeY,p.columellaBridgeRx,p.columellaBridgeRy,p.columellaBridgeHeight);
  const subnasale=compactFaceBump(x,y,0,p.subnasaleY,p.subnasaleRx,p.subnasaleRy,-p.subnasaleDepth);
  const ridges=compactFaceBump(x,y,-p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight)+compactFaceBump(x,y,p.ridgeX,p.philtrumY,p.ridgeRx,p.ridgeRy,p.ridgeHeight);
  const groove=compactFaceBump(x,y,0,p.philtrumY,p.grooveRx,p.grooveRy,-p.grooveDepth);
  const crease=compactFaceBump(x,y,0,p.labiomentalY,p.labiomentalRx,p.labiomentalRy,-p.labiomentalDepth);
  const mentalis=compactFaceBump(x,y,0,p.mentalisY,p.mentalisRx,p.mentalisRy,p.mentalisHeight);
  const wings=compactFaceBump(x,y,-p.mentalisWingX,p.mentalisWingY,p.mentalisWingRx,p.mentalisWingRy,p.mentalisWingHeight)+compactFaceBump(x,y,p.mentalisWingX,p.mentalisWingY,p.mentalisWingRx,p.mentalisWingRy,p.mentalisWingHeight);
  const base=compactFaceBump(x,y,0,p.chinBaseY,p.chinBaseRx,p.chinBaseRy,p.chinBaseHeight);
  return bridge+subnasale+ridges+groove+crease+mentalis+wings+base;
}
"""
if text.count(old_depth) != 1:
    raise SystemExit('R9 perioral depth anchor mismatch')
text = text.replace(old_depth, new_depth, 1)

old_bed = """    }}
  // Reapply bounded philtral, labiomental and mentalis volumes after the
  // inherited oral ridge has been replaced by its smooth attachment bed.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const x=x0+i*dx,y=y0+j*dy;height[at(i,j)]+=compactPerioralDepth(x,y);}
"""
new_bed = """    }}
  // Replace the inherited central-chin facets with a second bounded Hermite
  // bed. It preserves the upper/lower attachment values and tangents, while
  // lateral averaging removes the horizontal source layers visible in closeup.
  const chinSource=height.slice(),readChin=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (chinSource[at(i,j)]*(1-a)+chinSource[at(i+1,j)]*a)*(1-b)+(chinSource[at(i,j+1)]*(1-a)+chinSource[at(i+1,j+1)]*a)*b;};
  const chinLo=1.4270,chinHi=1.4495,chinSpan=chinHi-chinLo;
  const chinProfile=x=>{const row=[0,0,0,0];let total=0;for(let k=-7;k<=7;k++){const xx=x+k*dx,w=Math.exp(-.5*(k*dx/.0032)**2),e=.0011;
    const values=[readChin(xx,chinLo),readChin(xx,chinHi),(readChin(xx,chinLo+e)-readChin(xx,chinLo-e))/(2*e),(readChin(xx,chinHi+e)-readChin(xx,chinHi-e))/(2*e)];
    for(let q=0;q<4;q++)row[q]+=values[q]*w;total+=w;}return row.map(v=>v/total);};
  const chinProfiles=Array.from({length:nx+1},(_,i)=>chinProfile(x0+i*dx));
  for(let j=0;j<=ny;j++){const y=y0+j*dy;if(y<=chinLo||y>=chinHi)continue;const t=(y-chinLo)/chinSpan,t2=t*t,t3=t2*t;
    for(let i=0;i<=nx;i++){const x=x0+i*dx,u=clamp((.037-Math.abs(x-p.lips.centreX))/.013,0,1);if(!u)continue;
      const [a,b,d0,d1]=chinProfiles[i],m0=clamp(d0,-.35,.55)*chinSpan,m1=clamp(d1,-.35,.55)*chinSpan;
      const bed=(2*t3-3*t2+1)*a+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b+(t3-t2)*m1;
      const v=clamp(Math.min((y-chinLo)/.0065,(chinHi-y)/.0065),0,1),blend=.82*u*u*(3-2*u)*v*v*(3-2*v);
      height[at(i,j)]+=(bed-height[at(i,j)])*blend;
    }}
  // Reapply bounded columella, philtral, labiomental and mentalis volumes after
  // the inherited oral and central-chin ridges have been replaced.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const x=x0+i*dx,y=y0+j*dy;height[at(i,j)]+=compactPerioralDepth(x,y);}
"""
if text.count(old_bed) != 1:
    raise SystemExit('R9 lower-face bed anchor mismatch')
text = text.replace(old_bed, new_bed, 1)

old_surface = """  const lipSurface=(x,upper,t)=>{const q=compactLipOutline(x),edge=upper?q.top:q.bottom,r=compactLipRadial(lp.apron*t),y=q.seam+(edge-q.seam)*r+(upper?1:-1)*.000008*Math.min(1,(q.top-q.bottom)/.004)*(1-3*t*t+2*t*t*t);
"""
new_surface = """  const lipSurface=(x,upper,t)=>{const q=compactLipOutline(x),edge=upper?q.top:q.bottom,r=compactLipRadial(lp.apron*t),y=q.seam+(edge-q.seam)*r;
"""
if text.count(old_surface) != 1:
    raise SystemExit('R9 neutral lip seal anchor mismatch')
text = text.replace(old_surface, new_surface, 1)

old_shader_header = """  return `uniform float compactFaceSkinMode;
  ${compactLipShapeShader()}
"""
new_shader_header = """  return `uniform float compactFaceSkinMode,compactLipOpen;
  ${compactLipShapeShader()}
"""
if text.count(old_shader_header) != 1:
    raise SystemExit('R9 face fragment uniform anchor mismatch')
text = text.replace(old_shader_header, new_shader_header, 1)

old_moisture = """  float compactLipMoisture(vec3 p){
    vec4 q=compactLipShape(p);float t=abs(p.y-q.y)/max(p.y>q.y?q.z:q.w,.00001);
    float zone=smoothstep(.03,.25,t)*(1.-smoothstep(.60,.95,t))*(1.-smoothstep(.65,.95,abs(q.x)));
    return zone*(p.y>q.y?.28:1.);
  }
"""
new_moisture = """  float compactLipMoisture(vec3 p){
    vec4 q=compactLipShape(p);float t=abs(p.y-q.y)/max(p.y>q.y?q.z:q.w,.00001);
    float zone=smoothstep(.03,.25,t)*(1.-smoothstep(.60,.95,t))*(1.-smoothstep(.65,.95,abs(q.x)));
    return zone*(p.y>q.y?.28:1.);
  }
  float compactLipContactShadow(vec3 p){
    vec4 q=compactLipShape(p);float u=abs(q.x),width=mix(.00020,.00011,smoothstep(.70,1.,u));
    float line=exp(-pow((p.y-q.y)/width,2.));
    float distribution=.10+.42*exp(-pow(u/.46,2.))+.36*smoothstep(.72,.98,u);
    return line*distribution*(1.-smoothstep(.025,.18,compactLipOpen));
  }
"""
if text.count(old_moisture) != 1:
    raise SystemExit('R9 contact-shadow function anchor mismatch')
text = text.replace(old_moisture, new_moisture, 1)

old_pigment = """    return (1.-smoothstep(.88,1.08,radial))*smoothstep(0.,.24,1.-abs(q.x));
"""
new_pigment = """    return (1.-smoothstep(.94,1.12,radial))*smoothstep(0.,.24,1.-abs(q.x));
"""
if text.count(old_pigment) != 1:
    raise SystemExit('R9 pigment feather anchor mismatch')
text = text.replace(old_pigment, new_pigment, 1)

old_mask = """  void compactFaceSurfaceMask(vec3 p){
    if(compactFaceSkinMode<.5||p.z<.13)return;
"""
new_mask = """  void compactFaceSurfaceMask(vec3 p){
    if(compactFeature>9.5&&compactFeature<10.5&&compactLipOpen<.025)discard;
    if(compactFaceSkinMode<.5||p.z<.13)return;
"""
if text.count(old_mask) != 1:
    raise SystemExit('R9 closed-mouth cavity gate anchor mismatch')
text = text.replace(old_mask, new_mask, 1)

face.write_text(text, encoding='utf-8', newline='\n')

workbench = Path('body/CompactWorkbench.js')
w = workbench.read_text(encoding='utf-8')
old_classification = """const isSkin=c.name==='skin'||c.name==='FJ2811'||c.name==='eyeLidSkin'||c.name==='faceSkin'||c.name==='faceLip',lip=c.name==='FJ2814'||c.name==='faceLip',brow=c.name==='FJ2812'||c.name==='faceBrow',sclera=['FJ1317','FJ1368','eyeSclera'].includes(c.name),margin=c.name==='eyeLidMargin',pupil=c.name==='eyePupil',tear=c.name==='eyeTearDuct',nose=c.name==='noseInterior'||c.name==='mouthInterior';
      const feature=eye||(lip?3:sclera?5:margin?6:pupil?7:tear?8:nose?9:0);
      const color=this.view==='clay'?[.54,.55,.55]:lip?skin.color:brow?[.105,.067,.047]:sclera?[.52,.50,.44]:margin?skin.lipColor.map((v,i)=>v*.55+skin.color[i]*.45):pupil?[.0007,.0005,.0003]:tear?skin.lipColor:nose?[.085,.035,.024]:isSkin?skin.color:[.497,.391,.296];
"""
new_classification = """const isSkin=c.name==='skin'||c.name==='FJ2811'||c.name==='eyeLidSkin'||c.name==='faceSkin'||c.name==='faceLip',lip=c.name==='FJ2814'||c.name==='faceLip',brow=c.name==='FJ2812'||c.name==='faceBrow',sclera=['FJ1317','FJ1368','eyeSclera'].includes(c.name),margin=c.name==='eyeLidMargin',pupil=c.name==='eyePupil',tear=c.name==='eyeTearDuct',nose=c.name==='noseInterior',mouth=c.name==='mouthInterior';
      const feature=eye||(lip?3:sclera?5:margin?6:pupil?7:tear?8:nose?9:mouth?10:0);
      const color=this.view==='clay'?[.54,.55,.55]:lip?skin.color:brow?[.105,.067,.047]:sclera?[.52,.50,.44]:margin?skin.lipColor.map((v,i)=>v*.55+skin.color[i]*.45):pupil?[.0007,.0005,.0003]:tear?skin.lipColor:nose?[.085,.035,.024]:mouth?[.055,.016,.013]:isSkin?skin.color:[.497,.391,.296];
"""
if w.count(old_classification) != 1:
    raise SystemExit('R9 renderer feature classification anchor mismatch')
w = w.replace(old_classification, new_classification, 1)

old_color = """if(compactFeature>2.5&&compactFeature<3.5)color*=mix(vec3(1.),compactLipTint(R),compactLipPigment(R));
"""
new_color = """if(compactFeature>2.5&&compactFeature<3.5){float lipPigment=compactLipPigment(R);color*=mix(vec3(1.),compactLipTint(R),lipPigment);color*=1.-.22*compactLipContactShadow(R);}
"""
if w.count(old_color) != 1:
    raise SystemExit('R9 contact shading anchor mismatch')
w = w.replace(old_color, new_color, 1)
workbench.write_text(w, encoding='utf-8', newline='\n')

check = Path('tools/check-face-anatomy.mjs')
c = check.read_text(encoding='utf-8')
c = c.replace("revision:'r12-perioral-chin-continuity'", "revision:'r13-neutral-oral-seal-lower-face'", 1)
old_source = """ check(source.includes('function compactPerioralDepth')&&source.includes('whiteRollUpper:.00012')&&source.includes('mentalisHeight:.00072'),'philtrum, white roll, labiomental crease and mentalis pad are explicit bounded structures');
"""
new_source = """ check(source.includes('function compactPerioralDepth')&&source.includes('whiteRollUpper:.00006')&&source.includes('mentalisWingHeight:.00018'),'columella bridge, philtrum, bounded white roll and distributed mentalis volume are explicit');
 check(source.includes('const chinLo=1.4270,chinHi=1.4495')&&source.includes('compactLipContactShadow')&&source.includes('compactLipOpen<.025'),'lower-face Hermite bed, nonuniform contact shadow and closed-mouth cavity gate are explicit');
 check(renderer.includes("mouth=c.name==='mouthInterior'")&&renderer.includes('mouth?10:0')&&renderer.includes('compactLipContactShadow(R)'),'mouth interior has a dedicated feature gate and the lip seam uses controlled shading');
"""
if c.count(old_source) != 1:
    raise SystemExit('R9 face source checks anchor mismatch')
c = c.replace(old_source, new_source, 1)
old_perioral_checks = """ check(api.perioral(-api.parameters.perioral.ridgeX,api.parameters.perioral.philtrumY)>0&&api.perioral(0,api.parameters.perioral.philtrumY)<0,'philtral ridges flank a central groove');
 check(api.perioral(0,api.parameters.perioral.labiomentalY)<0&&api.perioral(0,api.parameters.perioral.mentalisY)>0,'labiomental crease separates lower lip support from the mentalis pad');
"""
new_perioral_checks = """ check(api.perioral(0,api.parameters.perioral.columellaBridgeY)>0&&api.perioral(0,api.parameters.perioral.subnasaleY)<api.perioral(0,api.parameters.perioral.columellaBridgeY),'columella bridge transitions through a bounded subnasale recess');
 check(api.perioral(-api.parameters.perioral.ridgeX,api.parameters.perioral.philtrumY)>0&&api.perioral(0,api.parameters.perioral.philtrumY)<0,'philtral ridges flank a central groove');
 check(api.perioral(0,api.parameters.perioral.labiomentalY)<0&&api.perioral(0,api.parameters.perioral.mentalisY)>0,'labiomental crease separates lower lip support from the mentalis pad');
 check(api.perioral(api.parameters.perioral.mentalisWingX,api.parameters.perioral.mentalisWingY)>0,'paired mentalis wings distribute the central chin volume');
"""
if c.count(old_perioral_checks) != 1:
    raise SystemExit('R9 perioral parameter checks anchor mismatch')
c = c.replace(old_perioral_checks, new_perioral_checks, 1)
check.write_text(c, encoding='utf-8', newline='\n')
