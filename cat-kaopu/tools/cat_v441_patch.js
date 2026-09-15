(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CatV441Patch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function patchV440ToV441(source) {
    if (typeof source !== 'string' || !source.includes("window.__CAT_V440_READY__")) {
      throw new Error('V4.40 source marker missing');
    }

    let text = source;
    const applied = [];

    function replaceOnce(needle, replacement, label) {
      const index = text.indexOf(needle);
      if (index < 0) throw new Error('V4.41 patch marker missing: ' + label);
      text = text.slice(0, index) + replacement + text.slice(index + needle.length);
      applied.push(label);
    }

    function replaceRegex(pattern, replacement, label) {
      if (!pattern.test(text)) throw new Error('V4.41 patch pattern missing: ' + label);
      text = text.replace(pattern, replacement);
      applied.push(label);
    }

    replaceOnce(
      '<title>CAT KAOPU V4.40 · 独立耳眼控制与短毛方向场</title>',
      '<title>CAT KAOPU V4.41 · 眼睑眨眼与角膜响应第一层</title>',
      'title'
    );

    replaceOnce(
      'alt="V4.40 独立耳眼控制与短毛方向场静态回退"',
      'alt="V4.41 眼睑眨眼与角膜响应第一层静态回退"',
      'fallback-alt'
    );

    replaceOnce(
      '<button class="active" id="eyeLayer">眼球层</button><button class="active" id="earLayer">耳骨层</button>',
      '<button class="active" id="eyeLayer">眼球层</button><button class="active" id="blinkLayer">眼睑层</button><button class="active" id="earLayer">耳骨层</button>',
      'toolbar-blink-toggle'
    );

    replaceOnce(
      '<aside><h1>CAT KAOPU V4.40</h1><div class="sub">V4.32 冻结整猫表面 → V4.34 权重基线 → V4.39 坐卧修形 → V4.40 独立耳眼控制与短毛方向场</div><span class="tag good">代码化整猫</span><span class="tag good">GPU 蒙皮</span><span class="tag good">34 骨</span><span class="tag good">独立左右耳</span><span class="tag good">程序化视线</span><span class="tag good">程序化虹膜</span><span class="tag good">短毛方向场</span><span class="tag good">V4.38/V4.39 回归</span><span class="tag warnTag">生产候选</span>',
      '<aside><h1>CAT KAOPU V4.41 DEV</h1><div class="sub">V4.40 冻结为表现基线 → V4.41 只增加眼睑、确定性眨眼、角膜与瞳孔亮度响应</div><span class="tag good">V4.32 中性表面不变</span><span class="tag good">CATV440 载荷复用</span><span class="tag good">34 骨不变</span><span class="tag good">程序化眼睑</span><span class="tag good">确定性眨眼</span><span class="tag good">角膜高光</span><span class="tag good">瞳孔亮度响应</span><span class="tag warnTag">开发候选·未视觉验收</span>',
      'aside-header'
    );

    const eyeSection = `<section><h2>眼睑、角膜与耳眼第一层</h2><div class="row"><button class="active" id="autoExpression">自动耳眼</button><button class="active" id="eyeToggle">眼球着色</button><button class="active" id="blinkToggle">眼睑与眨眼</button><button class="active" id="earToggle">耳骨蒙皮</button><button class="active" id="furToggle">短毛方向</button><button id="furDebugToggle">毛流检查</button></div><label><span>视线左右</span><input id="gazeYaw" max="24" min="-24" step="1" type="range" value="0"/><output>0°</output></label><label><span>视线上下</span><input id="gazePitch" max="14" min="-14" step="1" type="range" value="0"/><output>0°</output></label><label><span>眨眼闭合</span><input id="blink" max="1" min="0" step="0.02" type="range" value="0"/><output>0%</output></label><label><span>环境亮度</span><input id="eyeLight" max="1" min="0" step="0.02" type="range" value="0.55"/><output>0.55</output></label><label><span>角膜响应</span><input id="corneaStrength" max="1" min="0" step="0.02" type="range" value="0.78"/><output>0.78</output></label><label><span>左耳转向</span><input id="earLeft" max="18" min="-18" step="1" type="range" value="0"/><output>0°</output></label><label><span>右耳转向</span><input id="earRight" max="18" min="-18" step="1" type="range" value="0"/><output>0°</output></label><label><span>短毛强度</span><input id="furStrength" max="1" min="0" step="0.05" type="range" value="0.72"/><output>0.72</output></label><div class="note">V4.41 的眼睑为眼球着色器内的受限开合层，眨眼采用可复验的确定性时间曲线；角膜使用双高光、边缘菲涅耳和湿润缘近似。它还不是独立眼睑网格，也不改变 V4.32 头脸轮廓、V4.40 眼球位置或任何骨长。</div></section>`;
    replaceRegex(
      /<section><h2>耳眼与短毛第一层<\/h2>[\s\S]*?<\/section>/,
      eyeSection,
      'eye-section'
    );

    replaceOnce(
      '<div class="kpi"><b>视线</b><span id="kGaze">0.0° / 0.0°</span></div><div class="kpi"><b>左右耳</b>',
      '<div class="kpi"><b>视线</b><span id="kGaze">0.0° / 0.0°</span></div><div class="kpi"><b>眨眼闭合</b><span id="kBlink">0%</span></div><div class="kpi"><b>瞳孔 / 角膜</b><span id="kPupil">1.00 / 0.78</span></div><div class="kpi"><b>左右耳</b>',
      'eye-kpis'
    );

    replaceRegex(
      /<section><h2>本轮边界<\/h2><div class="note">[\s\S]*?<\/div><\/section>/,
      '<section><h2>本轮边界</h2><div class="note">本轮只处理眼睛表现层：眼睑开合、确定性眨眼、瞳孔亮度响应、角膜与湿润缘。V4.32 中性整猫表面、V4.34 基础蒙皮、V4.39 坐卧修形、V4.40 左右耳骨与短毛方向场全部保持不变。耳根大幅压耳修形、真实眼睑几何、泪膜折射、胡须与毛色仍不在本轮范围。</div></section>',
      'boundary-note'
    );

    replaceRegex(
      /<section><h2>测试顺序<\/h2><div class="note">[\s\S]*?<\/div><\/section>/,
      '<section><h2>测试顺序</h2><div class="note">先运行“眨眼与角膜测试”，观察完整闭眼、半闭眼、重新睁眼时是否无闪烁和虹膜漂移；再调节环境亮度，确认瞳孔宽度连续变化；关闭角膜响应后比较高光与湿润缘。最后回归站立、坐姿、趴卧、直行、转向和耳眼追踪，确认身体、耳骨、接触和短毛方向均未改变。</div></section>',
      'test-order'
    );

    replaceOnce(
      '{"id":"focus","label":"耳眼追踪测试","duration":4.8,"loop":true,"status":"expression_layer_candidate"}',
      '{"id":"blink_test","label":"眨眼与角膜测试","duration":4.0,"loop":true,"status":"eyelid_cornea_stage1"},{"id":"focus","label":"耳眼追踪测试","duration":4.8,"loop":true,"status":"expression_layer_candidate"}',
      'blink-test-action'
    );

    replaceOnce(
      '"version":"V4.40","initial":"idle"',
      '"version":"V4.41","initial":"idle"',
      'behavior-version'
    );

    replaceOnce(
      'Deterministic preview only. V4.40 preserves V4.39 locomotion and posture correction, adds two expression ear bones, shader-only gaze/iris, and a first anisotropic short-fur direction field.',
      'Deterministic preview only. V4.41 reuses the CATV440 payload and preserves all V4.40 body, ear, locomotion and posture data while adding a shader eyelid, deterministic blink, pupil-light response and first corneal clearcoat approximation.',
      'behavior-boundary'
    );

    replaceOnce(
      'let autoExpression=true,eyeLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,furStrength=.72;',
      'let autoExpression=true,eyeLayerEnabled=true,blinkLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,manualLight=.55,corneaStrength=.78,furStrength=.72;',
      'expression-globals'
    );

    replaceOnce(
      "let expressionState={gazeYaw:0,gazePitch:0,earLeft:0,earRight:0,earPitchL:0,earPitchR:0,mode:'auto'};",
      "let expressionState={gazeYaw:0,gazePitch:0,earLeft:0,earRight:0,earPitchL:0,earPitchR:0,blink:0,light:.55,pupilScale:.91,cornea:.78,mode:'auto'};\nfunction blinkEnvelope(x){if(x<0||x>.28)return 0;if(x<.07)return smooth01(x/.07);if(x<.11)return 1;return 1-smooth01((x-.11)/.17)}\nfunction deterministicBlink(source,t){if(source==='blink_test'){const x=((t%4)+4)%4;return Math.max(blinkEnvelope(x-.35),blinkEnvelope(x-1.45),.72*blinkEnvelope(x-2.65))}const periods={idle:4.9,look:5.7,focus:4.6,alert:6.2,sniff:5.1,groom:4.3,tail:5.5,walk:5.8,walk_forward:6.1,turn_left:6.4,turn_right:6.4},offsets={idle:.4,look:1.1,focus:.7,alert:2.0,sniff:.2,groom:1.6,tail:.9,walk:1.3,walk_forward:.6,turn_left:1.8,turn_right:.3};const p=periods[source]||5.6,x=((t+(offsets[source]||0))%p+p)%p;let b=blinkEnvelope(x-(p-.31));if(source==='groom')b=Math.max(b,.10+.08*(.5+.5*Math.sin(t*3.1)));if(source==='sniff')b=Math.max(b,.06);if(source==='alert')b*=.62;return Math.max(0,Math.min(1,b))}",
      'blink-runtime'
    );

    replaceOnce(
      "const q=(x,d)=>2*Math.PI*x/d;if(source==='focus')",
      "let blink=blinkLayerEnabled?deterministicBlink(source,t):0,light=manualLight,pupilScale=1.25-.62*Math.max(0,Math.min(1,light)),cornea=corneaStrength;const q=(x,d)=>2*Math.PI*x/d;if(source==='blink_test'){const a=q(t,4);gy=7*Math.sin(a*.5);gp=1.5*Math.sin(a);eL=2*Math.sin(a*.7);eR=-2*Math.sin(a*.63);pL=pR=-2}else if(source==='focus')",
      'expression-blink-state'
    );

    replaceOnce(
      "if(!autoExpression){gy=manualGazeYaw;gp=manualGazePitch;eL=manualEarLeft;eR=manualEarRight;pL=pR=0}",
      "if(!autoExpression){gy=manualGazeYaw;gp=manualGazePitch;eL=manualEarLeft;eR=manualEarRight;pL=pR=0;blink=blinkLayerEnabled?manualBlink:0}",
      'manual-blink'
    );

    replaceOnce(
      "if(!eyeLayerEnabled){gy=0;gp=0}if(!earLayerEnabled){eL=eR=pL=pR=0}",
      "if(!eyeLayerEnabled){gy=0;gp=0;blink=0}if(!blinkLayerEnabled)blink=0;if(!earLayerEnabled){eL=eR=pL=pR=0}",
      'layer-boundaries'
    );

    replaceOnce(
      "return{gazeYaw:gy,gazePitch:gp,earLeft:eL,earRight:eR,earPitchL:pL,earPitchR:pR,mode:autoExpression?'auto':'manual',source}}",
      "return{gazeYaw:gy,gazePitch:gp,earLeft:eL,earRight:eR,earPitchL:pL,earPitchR:pR,blink,light,pupilScale,cornea,mode:autoExpression?'auto':'manual',source}}",
      'expression-return'
    );

    const fsReplacement = `const fs=\`#version 300 es
precision highp float;in vec3 vN;flat in float vPart;in vec3 vWeightColor;in float vCorr;in vec3 vEyeDir;in vec3 vFurT;in vec3 vBindP;uniform float uWeightMode;uniform float uCorrectiveDebug;uniform vec2 uGaze;uniform float uEyeEnabled;uniform float uBlink;uniform float uPupilScale;uniform float uCorneaStrength;uniform float uFurEnabled;uniform float uFurStrength;uniform float uFurDebug;out vec4 outColor;vec3 heat(float x){x=clamp(x,0.,1.);return mix(mix(vec3(.03,.18,.40),vec3(.06,.85,.72),smoothstep(0.,.5,x)),vec3(1.,.28,.08),smoothstep(.5,1.,x));}float hash31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));if(vPart>.5&&uEyeEnabled>.5){float cy=cos(uGaze.x),sy=sin(uGaze.x),cp=cos(uGaze.y),sp=sin(uGaze.y);vec3 g=normalize(vec3(cp*cy,cp*sy,sp));vec3 r=normalize(cross(vec3(0.,0.,1.),g));if(length(r)<.01)r=vec3(0.,1.,0.);vec3 u=normalize(cross(g,r));vec3 e=normalize(vEyeDir);float ex=dot(e,r),ey=dot(e,u),ef=dot(e,g),rad=sqrt(ex*ex+ey*ey);float iris=(1.-smoothstep(.34,.43,rad))*smoothstep(.25,.55,ef);float pupilW=.038*clamp(uPupilScale,.58,1.35);float pupil=(1.-smoothstep(pupilW,pupilW+.028,abs(ex)))*(1.-smoothstep(.17,.24,abs(ey)))*smoothstep(.35,.72,ef);vec3 irisCol=mix(vec3(.12,.055,.015),vec3(.68,.48,.13),.75+.25*clamp(ey*2.+.5,0.,1.));vec3 eyeCol=mix(vec3(.025,.018,.012),irisCol,iris);eyeCol=mix(eyeCol,vec3(.003),pupil);float lidBase=.245-.10*ex*ex,gap=mix(lidBase,.006,smoothstep(0.,1.,uBlink)),upper=ey-gap,lower=-ey-gap*.82,lidEdge=max(upper,lower),lidMask=smoothstep(-.012,.016,lidEdge),seam=(1.-smoothstep(.003,.022,abs(ey+.012*ex)))*smoothstep(.72,1.,uBlink);float lidLight=.32+.48*max(dot(n,l1),0.);vec3 lidCol=vec3(.43,.39,.34)*lidLight;lidCol=mix(lidCol,vec3(.075,.043,.028),seam*.72);float openMask=1.-lidMask;vec3 h1=normalize(vec3(.52,-.35,.78)),h2=normalize(vec3(.22,.68,.70));float spec1=pow(max(dot(n,h1),0.),72.),spec2=pow(max(dot(n,h2),0.),32.),fres=pow(1.-max(dot(n,g),0.),3.);float wet=(1.-smoothstep(.004,.035,abs(lidEdge)))*openMask;eyeCol+=openMask*uCorneaStrength*(vec3(.78,.86,.92)*spec1*.72+vec3(.32,.38,.44)*spec2*.22+vec3(.10,.14,.17)*fres*.30);eyeCol+=wet*uCorneaStrength*vec3(.20,.18,.13)*.34;eyeCol=mix(eyeCol,lidCol,lidMask);outColor=vec4(pow(max(eyeCol,vec3(0.)),vec3(1./2.2)),1.);return;}float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;vec3 base=uWeightMode>.5?vWeightColor:vec3(.69,.655,.59);if(uCorrectiveDebug>.5)base=heat(vCorr/.008);if(uFurDebug>.5&&vPart<.5){vec3 t=normalize(vFurT);base=.5+.5*t;d=.82;}else if(uFurEnabled>.5&&vPart<.5&&uWeightMode<.5&&uCorrectiveDebug<.5){vec3 t=normalize(vFurT);vec3 lt=normalize(l1-n*dot(l1,n)+vec3(.0001));float aniso=pow(abs(dot(t,lt)),5.);float micro=hash31(floor(vBindP*720.));base*=1.+(micro-.5)*.055*uFurStrength;base+=vec3(.11,.095,.075)*aniso*.18*uFurStrength;d*=1.+(aniso-.35)*.08*uFurStrength;}vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}\`;`;
    replaceRegex(
      /const fs=`#version 300 es[\s\S]*?`;\nconst lineVS=/,
      fsReplacement + '\nconst lineVS=',
      'eye-fragment-shader'
    );

    replaceOnce(
      "furDebug:gl.getUniformLocation(pr,'uFurDebug')},LU=",
      "furDebug:gl.getUniformLocation(pr,'uFurDebug'),blink:gl.getUniformLocation(pr,'uBlink'),pupil:gl.getUniformLocation(pr,'uPupilScale'),cornea:gl.getUniformLocation(pr,'uCorneaStrength')},LU=",
      'eye-uniform-locations'
    );

    replaceOnce(
      "gl.uniform1f(U.furDebug,furDebugEnabled?1:0);gl.drawElements",
      "gl.uniform1f(U.furDebug,furDebugEnabled?1:0);gl.uniform1f(U.blink,expressionState.blink);gl.uniform1f(U.pupil,expressionState.pupilScale);gl.uniform1f(U.cornea,expressionState.cornea);gl.drawElements",
      'eye-uniform-frame'
    );

    replaceOnce(
      "$('#kGaze').textContent=expressionState.gazeYaw.toFixed(1)+'° / '+expressionState.gazePitch.toFixed(1)+'°';$('#kEars')",
      "$('#kGaze').textContent=expressionState.gazeYaw.toFixed(1)+'° / '+expressionState.gazePitch.toFixed(1)+'°';$('#kBlink').textContent=Math.round(expressionState.blink*100)+'%';$('#kPupil').textContent=expressionState.pupilScale.toFixed(2)+' / '+expressionState.cornea.toFixed(2);$('#kEars')",
      'eye-kpi-runtime'
    );

    replaceOnce(
      "expression:{...expressionState,eyeLayerEnabled,earLayerEnabled,furLayerEnabled,furStrength,furDebugEnabled},camera:",
      "expression:{...expressionState,eyeLayerEnabled,blinkLayerEnabled,earLayerEnabled,furLayerEnabled,furStrength,furDebugEnabled,manualLight,corneaStrength},camera:",
      'eye-metrics'
    );

    replaceOnce(
      "manualSlider('#gazeYaw',v=>manualGazeYaw=v);manualSlider('#gazePitch',v=>manualGazePitch=v);manualSlider('#earLeft',v=>manualEarLeft=v);manualSlider('#earRight',v=>manualEarRight=v);manualSlider('#furStrength',v=>furStrength=v,v=>v.toFixed(2));",
      "manualSlider('#gazeYaw',v=>manualGazeYaw=v);manualSlider('#gazePitch',v=>manualGazePitch=v);manualSlider('#earLeft',v=>manualEarLeft=v);manualSlider('#earRight',v=>manualEarRight=v);manualSlider('#furStrength',v=>furStrength=v,v=>v.toFixed(2));$('#blink').oninput=e=>{autoExpression=false;$('#autoExpression').classList.remove('active');$('#autoExpression').textContent='手动耳眼';manualBlink=+e.target.value;e.target.nextElementSibling.value=Math.round(manualBlink*100)+'%'};$('#eyeLight').oninput=e=>{manualLight=+e.target.value;e.target.nextElementSibling.value=manualLight.toFixed(2)};$('#corneaStrength').oninput=e=>{corneaStrength=+e.target.value;e.target.nextElementSibling.value=corneaStrength.toFixed(2)};",
      'eye-controls'
    );

    replaceOnce(
      "$('#eyeToggle').onclick=e=>{eyeLayerEnabled=!eyeLayerEnabled;e.currentTarget.classList.toggle('active',eyeLayerEnabled)};$('#earToggle')",
      "$('#eyeToggle').onclick=e=>{eyeLayerEnabled=!eyeLayerEnabled;e.currentTarget.classList.toggle('active',eyeLayerEnabled)};$('#blinkToggle').onclick=e=>{blinkLayerEnabled=!blinkLayerEnabled;e.currentTarget.classList.toggle('active',blinkLayerEnabled)};$('#earToggle')",
      'blink-toggle'
    );

    replaceOnce(
      "$('#eyeLayer').onclick=$('#eyeToggle').onclick;$('#earLayer')",
      "$('#eyeLayer').onclick=$('#eyeToggle').onclick;$('#blinkLayer').onclick=$('#blinkToggle').onclick;$('#earLayer')",
      'toolbar-blink-wire'
    );

    replaceOnce(
      "window.__CAT_V440_RENDER_STATE__='eye-ear-short-fur'",
      "window.__CAT_V440_RENDER_STATE__='eyelid-cornea-stage1'",
      'render-state'
    );

    replaceOnce(
      "shortFurDirectionField:true,correctiveRepresentation:",
      "shortFurDirectionField:true,shaderEyelid:true,deterministicBlink:true,pupilLightResponse:true,cornealClearcoatApproximation:true,payloadVersion:'CATV440',correctiveRepresentation:",
      'stats-features'
    );

    replaceOnce(
      "if(cfg.furStrength!==undefined)furStrength=+cfg.furStrength;",
      "if(cfg.furStrength!==undefined)furStrength=+cfg.furStrength;if(cfg.blink!==undefined)manualBlink=+cfg.blink;if(cfg.light!==undefined)manualLight=+cfg.light;if(cfg.cornea!==undefined)corneaStrength=+cfg.cornea;",
      'expression-api-values'
    );

    replaceOnce(
      "if(cfg.eyeEnabled!==undefined)eyeLayerEnabled=!!cfg.eyeEnabled;",
      "if(cfg.eyeEnabled!==undefined)eyeLayerEnabled=!!cfg.eyeEnabled;if(cfg.blinkEnabled!==undefined)blinkLayerEnabled=!!cfg.blinkEnabled;",
      'expression-api-layer'
    );

    replaceOnce(
      "return{autoExpression,manualGazeYaw,manualGazePitch,manualEarLeft,manualEarRight,furStrength,eyeLayerEnabled,earLayerEnabled,furLayerEnabled,furDebugEnabled}};",
      "return{autoExpression,manualGazeYaw,manualGazePitch,manualEarLeft,manualEarRight,manualBlink,manualLight,corneaStrength,furStrength,eyeLayerEnabled,blinkLayerEnabled,earLayerEnabled,furLayerEnabled,furDebugEnabled}};",
      'expression-api-return'
    );

    text = text.replace(/__CAT_V440_/g, '__CAT_V441_');
    applied.push('public-api-version');

    replaceOnce(
      "window.__CAT_V441_READY__='static-fallback';window.__CAT_V441_ERROR__=String(err)",
      "window.__CAT_V441_READY__='static-fallback';window.__CAT_V441_ERROR__=String(err)",
      'fallback-api-check'
    );

    return {
      html: text,
      report: {
        schema: 'cat_kaopu/v441_patch_report@1.0',
        sourceVersion: 'V4.40',
        outputVersion: 'V4.41-dev',
        payloadVersion: 'CATV440',
        applied,
        invariants: {
          neutralSurface: 'V4.32 unchanged',
          baseSkinWeights: 'V4.34 plus V4.40 ear region unchanged',
          boneCount: 34,
          payloadBytesUnchanged: true,
          locomotionAndPostureCodeUnchanged: true
        },
        features: [
          'shader eyelid aperture',
          'deterministic blink envelopes',
          'pupil response to light control',
          'dual corneal highlight and wet rim approximation'
        ],
        acceptance: {
          visualAcceptance: false,
          productionReady: false,
          userReviewRequired: true
        }
      }
    };
  }

  return { patchV440ToV441 };
});