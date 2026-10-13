from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'material-shaders.mjs';s=p.read_text()
# R11 knit-controls defines yarn-twist as a length in mm, not turns/mm.
s=s.replace('arc*uTwist*6.28318530718','arc/max(.3,uTwist)*6.28318530718')
s=s.replace('vSolidCoord.x*uTwist*6.28318530718','vSolidCoord.x/max(.3,uTwist)*6.28318530718')
s=s.replace('core+=(V*cos(phase)+W*sin(phase))*radius*.48;radius*=.62;', '''vec3 plyT=normalize(T+(-sin(phase)*V+cos(phase)*W)*(radius*.51*6.28318530718/max(.3,uTwist)));core+=(V*cos(phase)+W*sin(phase))*radius*.51;V=normalize(V-plyT*dot(V,plyT));W=normalize(cross(V,plyT));radius*=.43;''')
# Unresolved crimp is averaged, but the yarn remains a closed 3-D cross section.
s=s.replace('float crimpFilter=uLOD<.5?.55:1.;','float crimpFilter=uLOD<.5?0.:1.;')
p.write_text(s)
p=r/'solid-textiles.mjs';s=p.read_text()
s=s.replace('+shader.fragmentShader;', "+'\\n'+shader.fragmentShader;")
s=s.replace('[Math.max(6,Math.ceil(48/crossPitch/5)),Math.ceil(48/crossPitch*1.5),Math.ceil(48/crossPitch*3)]','[4,Math.ceil(48/crossPitch*1.5),Math.ceil(48/crossPitch*3)]')
s=s.replace("stats.lod='closed low-pass crimp at subpixel distances; explicit crossings at close range'", "stats.lod='closed cross-sections with subpixel crimp average; native crossings restored in macro';stats.twistConvention='R11 twist pitch in mm, not turns/mm'")
p.write_text(s)
# Element-screenshot stability polling can stall behind a long software-GPU frame.
# Capture the same actual canvas rectangle without substituting any pixels.
p=r/'qa-mp04.cjs';s=p.read_text()
s=s.replace("await p.locator('#stage').screenshot({path:path.join(out,name+'.png'),timeout:240000});", "const clip=await p.locator('#stage').boundingBox();await p.screenshot({path:path.join(out,name+'.png'),clip,timeout:240000});")
p.write_text(s)
p=r/'_build/bootstrap.py';s=p.read_text().replace("'ui.py','refinement.py']", "'ui.py','refinement.py','visual-fixes.py']");p.write_text(s)
print('Native twist-pitch fixed; leather preprocessor line separated; distant closed-yarn budget reduced')
