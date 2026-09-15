from pathlib import Path
import textwrap

# Reproduce the accepted R6 candidate exactly before changing the nose.
workflow = Path('.github/workflows/face-eye-optics-r6-candidate.yml').read_text(encoding='utf-8')
marker = "          python3 - <<'PY'\n"
start = workflow.index(marker) + len(marker)
end = workflow.index("\n          PY", start)
exec(compile(textwrap.dedent(workflow[start:end]), 'r6-candidate-patch', 'exec'), {})

face = Path('body/FaceAnatomy.js')
text = face.read_text(encoding='utf-8')
replacements = {
    "revision:'r10-procedural-optical-integration'": "revision:'r11-nasal-subunit-continuity'",
    "smoothingRadiusM:.0045,nostrils:{x:.0093,y:1.4793,rx:.0036,ry:.00165,tilt:.10,depth:.0050},": "smoothingRadiusM:.0045,nostrils:{x:.0090,y:1.4778,rx:.00345,ry:.00205,tilt:.16,depth:.0052},",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'R7 header anchor mismatch ({count}): {old}')
    text = text.replace(old, new, 1)

old_nose = """  nose:{knots:[[1.465,.191,.015],[1.471,.190,.014],[1.475,.189,.0105],[1.480,.197,.010],[1.487,.203,.0115],[1.494,.200,.0105],[1.505,.193,.011],[1.518,.187,.012],[1.530,.181,.015],[1.538,.178,.019]],
    underturn:[[1.465,0],[1.471,0],[1.475,.0020],[1.480,-.0035],[1.487,-.0004],[1.494,0]],underturnWidth:.023,underturnCentreWeight:.40,columellaDrop:.0013,alarHeight:.0040,columellaHeight:.0012},
"""
new_nose = """  nose:{knots:[[1.465,.1900,.0135],[1.471,.1905,.0125],[1.476,.1930,.0100],[1.481,.1990,.0088],[1.486,.2035,.0088],[1.490,.2025,.0092],[1.496,.1985,.0102],[1.506,.1930,.0115],[1.518,.1870,.0125],[1.530,.1810,.0150],[1.538,.1780,.0190]],
    underturn:[[1.465,0],[1.471,.0004],[1.476,.0014],[1.480,-.0021],[1.486,-.0008],[1.494,0]],underturnWidth:.0225,underturnCentreWeight:.30,columellaDrop:.0016,
    tipY:1.486,tipRx:.0105,tipRy:.0072,tipHeight:.00035,domeX:.0046,domeRx:.0048,domeRy:.0058,domeHeight:.00125,
    alarX:.0140,alarY:1.4805,alarRx:.0058,alarRy:.0056,alarHeight:.0018,alarGrooveX:.0170,alarGrooveY:1.4870,alarGrooveRx:.0048,alarGrooveRy:.0085,alarGrooveDepth:.00072,
    sidewallX:.0145,sidewallY:1.503,sidewallRx:.0090,sidewallRy:.0180,sidewallHeight:.00030,columellaHeight:.00155},
"""
count = text.count(old_nose)
if count != 1:
    raise SystemExit(f'R7 nose parameter anchor mismatch: {count}')
text = text.replace(old_nose, new_nose, 1)

old_loop = """      const ridge=(center-baseline)*Math.exp(-.5*(x/width)**2),alar=nose.alarHeight*Math.exp(-(((Math.abs(x)-.0125)/.0045)**2)-((y-1.4815)/.0045)**2),columella=nose.columellaHeight*Math.exp(-((x/.003)**2)-((y-1.477)/.004)**2);
      height[at(i,j)]+=(baseline+ridge+alar+columella-height[at(i,j)])*blend;}}
"""
new_loop = """      const ax=Math.abs(x),ridge=(center-baseline)*Math.exp(-.5*(x/width)**2);
      const tip=nose.tipHeight*Math.exp(-((x/nose.tipRx)**2)-(((y-nose.tipY)/nose.tipRy)**2));
      const domes=nose.domeHeight*(Math.exp(-(((x-nose.domeX)/nose.domeRx)**2)-(((y-nose.tipY)/nose.domeRy)**2))+Math.exp(-(((x+nose.domeX)/nose.domeRx)**2)-(((y-nose.tipY)/nose.domeRy)**2)));
      const alar=nose.alarHeight*Math.exp(-(((ax-nose.alarX)/nose.alarRx)**2)-(((y-nose.alarY)/nose.alarRy)**2));
      const groove=-nose.alarGrooveDepth*Math.exp(-(((ax-nose.alarGrooveX)/nose.alarGrooveRx)**2)-(((y-nose.alarGrooveY)/nose.alarGrooveRy)**2));
      const sidewall=nose.sidewallHeight*Math.exp(-(((ax-nose.sidewallX)/nose.sidewallRx)**2)-(((y-nose.sidewallY)/nose.sidewallRy)**2));
      const columella=nose.columellaHeight*Math.exp(-((x/.0032)**2)-(((y-1.4775)/.0042)**2));
      height[at(i,j)]+=(baseline+ridge+tip+domes+alar+groove+sidewall+columella-height[at(i,j)])*blend;}}
"""
count = text.count(old_loop)
if count != 1:
    raise SystemExit(f'R7 nasal surface anchor mismatch: {count}')
text = text.replace(old_loop, new_loop, 1)
face.write_text(text, encoding='utf-8', newline='\n')

check = Path('tools/check-face-anatomy.mjs')
value = check.read_text(encoding='utf-8')
old_revision = "revision:'r10-procedural-optical-integration'"
if value.count(old_revision) != 1:
    raise SystemExit('R7 face check revision anchor mismatch')
value = value.replace(old_revision, "revision:'r11-nasal-subunit-continuity'", 1)
source_anchor = " check(source.includes(\"revision:'r11-nasal-subunit-continuity'\")&&source.includes(\"id:'upperLidSulcus'\")&&source.includes(\"id:'lowerLidTransition'\"),'versioned orbital transition separates broad socket depth from local lid sulci');"
if value.count(source_anchor) != 1:
    raise SystemExit('R7 source contract anchor mismatch')
value = value.replace(
    source_anchor,
    source_anchor + "\n check(source.includes('domeX:.0046')&&source.includes('alarGrooveDepth:.00072')&&source.includes('sidewallHeight:.00030'),'nasal tip domes, alar lobules, grooves and sidewalls are explicit bounded subunits');",
    1,
)
parameter_anchor = " const cavity=full.meshes.find(m=>m.name==='noseInterior'),n=api.parameters.nostrils;"
if value.count(parameter_anchor) != 1:
    raise SystemExit('R7 parameter contract anchor mismatch')
value = value.replace(
    parameter_anchor,
    parameter_anchor
    + "\n const nose=api.parameters.nose;check(n.ry>n.rx*.5&&n.ry<n.rx*.7,'nostril aperture is oval rather than a horizontal slit');"
    + "\n check(nose.domeHeight>nose.tipHeight&&nose.alarGrooveDepth>0&&nose.alarHeight>nose.alarGrooveDepth,'tip, ala and alar groove retain ordered bounded amplitudes');"
    + "\n check(nose.knots.every((row,i,all)=>i===0||row[0]>all[i-1][0])&&nose.knots.every(row=>row[2]>.008&&row[2]<.020),'nasal profile rails are ordered and bounded');",
    1,
)
check.write_text(value, encoding='utf-8', newline='\n')
