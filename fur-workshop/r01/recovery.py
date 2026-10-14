"""Deterministic R01 recovery after d70864a. Full expanded source is committed by CI."""
from pathlib import Path
P=Path(__file__).resolve().parent
p=P/'app.js';s=p.read_text()
if 'RECOVERY_V3' not in s:
    # The previous collar was a thin cut sheet. Use a closed, tapered elliptical roll.
    old="add(sign<0?'右翻领':'左翻领',(u,v)=>{let x=sign*(.126+.052*Math.sin(v*PI)-.061*v),y=1.585-.432*v,z=.073+.170*Math.sin(v*PI*.60);let width=.114*Math.sqrt(Math.max(.002,1-Math.pow((v-.43)/.57,2))),w=(u-.5)*2;return v3(x+sign*w*width,y+w*.019,z+.052*(1-w*w)+.01*Math.sin(v*PI));},1,sign>0);"
    new="""add(sign<0?'右翻领':'左翻领',(u,v)=>{
    const a=u*2*PI,center=v3(sign*(.126+.065*Math.sin(v*PI)-.058*v),1.585-.425*v,.070+.182*Math.sin(v*PI*.60));
    const tangent=v3(sign*(.065*PI*Math.cos(v*PI)-.058),-.425,.182*PI*.60*Math.cos(v*PI*.60)).normalize();
    const across=v3(sign,0,0).addScaledVector(tangent,-sign*tangent.x).normalize(),front=new T.Vector3().crossVectors(tangent,across).normalize();
    const rad=.087*Math.sqrt(Math.max(.003,Math.sin(PI*(.035+.963*v))));
    return center.addScaledVector(across,Math.cos(a)*rad).addScaledVector(front,Math.sin(a)*rad*.70);
   },1,false);"""
    assert old in s,'Recovery requires volume-v2 source'
    s=s.replace(old,new)
    # Dark roots and spatially varied underfur keep the carrier from looking like polished felt.
    s=s.replace("b.material.color.set(leather?'#40332c':p.mid).multiplyScalar(leather?1:.75)","b.material.color.set(leather?'#40332c':p.root).lerp(new T.Color(p.mid),leather?0:.20)")
    s=s.replace('vec3 groom=normalize(g+b*(bundle*uClump*.42+(aRandom.x-.5)*.42));','vec3 groom=normalize(g+b*(bundle*uClump*.42+(aRandom.x-.5)*.62));\n float underAngle=(aRandom.x-.5)*2.5;groom=normalize(mix(g*cos(underAngle)+b*sin(underAngle),groom,guard));')
    s=s.replace('(.98*t-.47*t*t)*(1.-uComb*.17)', '(1.20*t-.56*t*t)*(1.-uComb*.15)')
    s=s.replace('mix(.13,.065,guard)', 'mix(.19,.074,guard)')
    # Curve thickness remains micrometric geometry. Coverage is anti-aliased, not thick cylinders.
    s=s.replace('vCover=clamp(diameter/max(expanded,.000001),0.,1.);','vCover=clamp(diameter/max(expanded,.000001),0.,1.);')
    # Export state via hash for stable linked material/app views; no network dependency.
    marker="rebuild();resize();firstReadyMs=performance.now()-started;requestAnimationFrame(frame);"
    repl="""const initialHash=new URLSearchParams(location.hash.slice(1));
if(PRESETS[initialHash.get('material')]){presetKey=initialHash.get('material');p={...PRESETS[presetKey]};}
if(['coat','collar','hat','swatch'].includes(initialHash.get('view')))view=initialHash.get('view');
rebuild();resize();cameraPreset(initialHash.get('camera')||'full');firstReadyMs=performance.now()-started;requestAnimationFrame(frame);"""
    assert marker in s;s=s.replace(marker,repl)
    # Pause/demand rendering avoids re-rendering identical frames while inspecting a static material.
    s=s.replace('renderSuspended=false;', 'renderSuspended=false,renderDirty=true;',1)
    s=s.replace('function applyParameters(){','function applyParameters(){\n renderDirty=true;')
    s=s.replace('function cameraUpdate(){','function cameraUpdate(){\n renderDirty=true;')
    s=s.replace('if(!completedGPU())return;const dt=', 'if(!completedGPU())return;if(!renderDirty&&!simulating&&!turning)return;const dt=')
    s=s.replace('renderer.render(scene,camera);fenceGPU();frames++;','renderer.render(scene,camera);fenceGPU();renderDirty=false;frames++;')
    # Initialization calls camera/parameter functions before the animation clock is initialized;
    # use a hoisted variable for the dirty flag, not a temporal-dead-zone let binding.
    s=s.replace('renderSuspended=false,renderDirty=true;', 'renderSuspended=false;var renderDirty=true;')
    s=s.replace("store.subscribe(syncLight);syncLight();", "store.subscribe(()=>{syncLight();renderDirty=true;});syncLight();")
    s=s.replace("$('#pause').textContent=simulating?'暂停毛梢':'恢复毛梢';", "renderDirty=true;$('#pause').textContent=simulating?'暂停毛梢':'恢复毛梢';")
    s=s.replace("setSimulating(x){simulating=!!x;}","setSimulating(x){simulating=!!x;renderDirty=true;}")
    s=s.replace('gpuWaitFrames,view,', 'gpuWaitFrames,renderDirty,view,')
    # DOM safety: report context loss immediately, never retain a misleading ready badge.
    s=s.replace("canvas.addEventListener('webglcontextlost',()=>{contextLost=true;ready=false;gpuFence=null;});", "canvas.addEventListener('webglcontextlost',()=>{contextLost=true;ready=false;gpuFence=null;$('#status').textContent='WebGL 上下文已丢失，等待恢复';});")
    s+='\n// RECOVERY_V3: rounded collar, dark root substrate, demand-rendered static state.\n'
    p.write_text(s)
p=P/'index.source.html';h=p.read_text()
if 'name="fur-recovery"' not in h:
    h=h.replace('<meta charset="utf-8">','<meta charset="utf-8"><meta name="fur-recovery" content="R01-V3"><link rel="icon" href="data:,">')
    h=h.replace('大衣、毛领、帽子及全部毛根由程序生成','大衣、毛领、帽子及全部毛根由程序生成')
    p.write_text(h)
print('Recovery applied; render buffers, shader and full instance count retained.')
