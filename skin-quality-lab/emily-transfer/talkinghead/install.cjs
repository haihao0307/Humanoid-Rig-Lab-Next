const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (app.includes("VERSION='emily-transfer/4.0.0'")) {
  console.log('ET04 is already installed.');
  process.exit(0);
}
const baselineHash = '92b0a0012bdf71c548a4aed5e30a5fea00e677e04e4528b35a2c11394745fca9';
if (crypto.createHash('sha256').update(app).digest('hex') !== baselineHash) {
  throw new Error('The application differs from the reviewed ET03 baseline.');
}
function patch(before, after) {
  if (!app.includes(before)) throw new Error('Required integration anchor is missing: ' + before);
  app = app.split(before).join(after);
}
patch("import {EYE_VERSION} from './eyes/EyeSystem.js';\nimport {ResearchEyes as EyeSystem} from './research/ResearchEyes.js';", "import {EYE_VERSION,IntegratedEyes as EyeSystem} from './talkinghead/IntegratedEyes.js';");
patch("VERSION='emily-transfer/3.0.0'", "VERSION='emily-transfer/4.0.0'");
patch("document.title='眼球与眼睑 · ET03'", "document.title='TalkingHead × 原人头 · ET04'");
patch("'ET03 · CONTACT'", "'ET04 · TALKINGHEAD'");
patch("eyesRig=new EyeSystem({mesh,skin,scene,camera,canvas:", "eyesRig=new EyeSystem({mesh,skin,scene,camera,fuzz,canvas:");
// Skin detail remains in original model space. Thickness lighting follows world space.
patch('varying vec3 vSkinPosition;', 'varying vec3 vSkinPosition;varying vec3 vSkinWorld;');
patch('vSkinPosition=transformed;', 'vSkinPosition=transformed;vSkinWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
patch('skinThickness(vSkinPosition-worldN*.00012)', 'skinThickness(vSkinWorld-worldN*.00012)');
patch("'emily-transfer-et03'", "'emily-transfer-et04'");
patch("'skin-lookdev-r02.json'", "'skin-eyes-talkinghead-et04.json'");
patch('const dt=Math.min(.08,(now-last)/1000);last=now;', 'const dt=Math.min(.08,(now-last)/1000);last=now;if(document.hidden)return;');
patch('if(now-lastStat>1500){state.fps=', 'if(now-lastStat>1500){updateBehaviorUI();state.fps=');
patch("document.querySelectorAll('[data-eye-mode]').forEach(b=>b.classList.toggle('active',b.dataset.eyeMode===c.mode));", "document.querySelectorAll('[data-eye-mode]').forEach(b=>b.classList.toggle('active',b.dataset.eyeMode===c.mode));updateBehaviorUI();");
patch("$('blinkEye').onclick=()=>eyesRig?.blink();", "$('blinkEye').onclick=()=>{eyesRig?.blink();$('researchClosure').value=0;};");
const bindings = fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8');
patch('};researchControls();apply();init().catch(fail);', '};researchControls();\n' + bindings + '\napply();init().catch(fail);');
const panel = fs.readFileSync(path.join(__dirname, 'ui.html'), 'utf8');
const aside = '<aside class="side" aria-label="皮肤与光线参数">';
if (!html.includes(aside)) throw new Error('Existing parameter panel is missing.');
html = html.replace(aside, () => aside + panel);
html = html.replace('ET03 · CONTACT', 'ET04 · TALKINGHEAD');
html = html.replace('</style>', '.th-section{background:#222a30}.th-section summary{font-size:11px;cursor:pointer}.th-section .row button{font-size:10px}.th-section .hint{line-height:1.7}\n</style>');
const attribution = '<strong>TalkingHead 1.7.0 / MIT</strong><br>© Mika Suominen。实际复用眨眼、注视与动画求值代码；由适配层驱动当前眼睑。当前未接入语音。<br><br>';
html = html.replace('<div class="credits">', () => '<div class="credits">' + attribution);
fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('ET04 integration applied to the verified ET03 application.');
