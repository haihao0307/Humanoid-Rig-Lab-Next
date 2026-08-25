import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultArtifactRoot = join(repositoryRoot, 'artifacts', 'qa', 'human-core-v5-procedural-deform');

const REGION_CHECKS = Object.freeze([
  '肩腋连接', '上臂连接', '肘部折叠', '前臂扭转', '手掌方向', '髋与腹股沟',
  '膝部弯曲', '脚踝和脚方向', '左右对称', '非对称预设方向', '体型预设差异', '骨架和表面对齐',
]);

const GROUP_ORDER = Object.freeze([
  'Reference Body', 'BodyDNA Presets', 'Shoulder', 'Elbow', 'Forearm Twist',
  'Hip', 'Knee', 'Squat', 'Lunge', 'WebGPU', 'WebGL2',
]);

export async function buildProceduralDeformQAGallery({ artifactRoot = defaultArtifactRoot, report = null } = {}) {
  const root = resolve(artifactRoot);
  const qaReport = report ?? JSON.parse(await readFile(join(root, 'browser-qa-report.json'), 'utf8'));
  const output = join(root, 'visual-review-gallery.html');
  const screenshots = Array.isArray(qaReport.screenshots) ? qaReport.screenshots : [];
  const sections = [];
  for (const group of GROUP_ORDER) {
    const entries = screenshots.filter((entry) => group === 'WebGPU'
      ? entry.backend === 'webgpu'
      : group === 'WebGL2'
        ? entry.backend === 'webgl2'
        : evidenceGroup(entry) === group);
    if (!entries.length) continue;
    sections.push(`<section><h2>${escapeHTML(group)}</h2><div class="cards">${entries.map(renderEvidenceCard).join('')}</div></section>`);
  }
  const embedded = JSON.stringify(qaReport).replaceAll('</script>', '<\\/script>');
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Human Core V5 Procedural Deform Visual Review</title>
<style>
:root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#07101e;color:#dcecff}body{margin:0;padding:24px;background:linear-gradient(145deg,#07101e,#0b192b)}header,section,.review{max-width:1500px;margin:0 auto 24px}h1{margin:0 0 8px;color:#72d8ff}h2{border-bottom:1px solid #24415d;padding-bottom:8px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.summary div,.card,.review{background:#0d2035;border:1px solid #24415d;border-radius:10px;padding:12px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}.card img{width:100%;aspect-ratio:4/3;object-fit:contain;background:#02060d;border-radius:7px}.meta{font:12px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.decision{display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;margin-top:8px}.decision input[type=text],textarea,input[type=text]{background:#071524;color:#e8f4ff;border:1px solid #355877;border-radius:6px;padding:8px}textarea{width:100%;min-height:80px;box-sizing:border-box}.regions{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:14px 0}button{background:#1e78a5;color:white;border:0;border-radius:7px;padding:10px 16px;cursor:pointer}.pending{color:#ffc95c}.pass{color:#64ecae}.fail{color:#ff7f89}
</style></head><body>
<header><h1>Human Core V5 Procedural Deform 视觉验收画廊</h1>
<p class="pending">自动浏览器合同不等于用户视觉通过。本页面不会修改仓库中的 visualAcceptance。</p>
<div class="summary"><div><b>Commit</b><br>${escapeHTML(qaReport.commit ?? 'unknown')}</div><div><b>状态</b><br>${escapeHTML(qaReport.status ?? 'unknown')}</div><div><b>运行数</b><br>${qaReport.runs?.length ?? 0}</div><div><b>截图数</b><br>${screenshots.length}</div></div></header>
${sections.join('\n')}
<section class="review"><h2>用户区域验收</h2><label>Reviewer <input id="reviewer" type="text" placeholder="姓名或标识"></label>
<div class="regions">${REGION_CHECKS.map((label, index) => `<label><input type="checkbox" data-region-index="${index}"> ${escapeHTML(label)}</label>`).join('')}</div>
<label>Notes<textarea id="overall-notes" placeholder="记录失败姿势、区域和截图文件名"></textarea></label><p><button id="export-review">Export User Review JSON</button></p></section>
<script id="qa-report" type="application/json">${embedded}</script>
<script>
const report=JSON.parse(document.querySelector('#qa-report').textContent);const regionLabels=${JSON.stringify(REGION_CHECKS)};
document.querySelector('#export-review').addEventListener('click',()=>{const screenshotResults=[...document.querySelectorAll('[data-evidence]')].map(card=>({file:card.dataset.evidence,backend:card.dataset.backend,preset:card.dataset.preset,poseId:card.dataset.pose,camera:card.dataset.camera,result:card.querySelector('input[value=pass]').checked?'pass':card.querySelector('input[value=fail]').checked?'fail':'pending',notes:card.querySelector('[data-shot-notes]').value}));const regionResults=regionLabels.map((label,index)=>({region:label,pass:document.querySelector('[data-region-index="'+index+'"]').checked}));const pass=screenshotResults.length>0&&screenshotResults.every(item=>item.result==='pass')&&regionResults.every(item=>item.pass);const review={schema:'humanoid_rig/user_visual_review@5.0',commit:report.commit,reviewedAt:new Date().toISOString(),reviewer:document.querySelector('#reviewer').value.trim()||'unavailable',backend:[...new Set(screenshotResults.map(item=>item.backend))],screenshotResults,regionResults,result:pass?'pass':'fail',notes:document.querySelector('#overall-notes').value,visualAcceptanceChanged:false};const blob=new Blob([JSON.stringify(review,null,2)+'\\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const link=Object.assign(document.createElement('a'),{href:url,download:'user-visual-review.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),0)});
</script></body></html>`;
  await writeFile(output, html);
  return { output, screenshotCount: screenshots.length, groupCount: sections.length };
}

function renderEvidenceCard(entry) {
  const path = String(entry.artifactPath ?? `${entry.backend}/${String(entry.file ?? '').split('/').at(-1)}`);
  const metadata = {
    commit: entry.commit,
    browser: entry.browserName,
    backend: entry.backend,
    preset: entry.preset,
    poseId: entry.poseId,
    camera: entry.camera,
    displayMode: entry.displayMode,
    angles: entry.measuredAngles,
    rigSurfaceErrors: entry.rigSurfaceErrors,
    geometry: { vertexCount: entry.vertexCount, triangleCount: entry.triangleCount, topologyFingerprint: entry.topologyFingerprint },
    screenshotContent: {
      foregroundPixelRatio: entry.foregroundPixelRatio,
      foregroundBoundingBox: entry.foregroundBoundingBox,
      foregroundBoundingBoxAreaRatio: entry.foregroundBoundingBoxAreaRatio,
      silhouetteFingerprint: entry.silhouetteFingerprint,
      perceptualHash: entry.perceptualHash,
      gate: entry.contentGate,
    },
    consoleErrors: entry.consoleErrors?.length ?? 0,
    glbRequests: entry.glbRequests?.length ?? 0,
    checklist: entry.checklistResult,
  };
  return `<article class="card" data-evidence="${escapeHTML(path)}" data-backend="${escapeHTML(entry.backend)}" data-preset="${escapeHTML(entry.preset)}" data-pose="${escapeHTML(entry.poseId)}" data-camera="${escapeHTML(entry.camera)}">
  <h3>${escapeHTML(entry.backend)} · ${escapeHTML(entry.preset)} · ${escapeHTML(entry.poseId)}</h3>
  <img src="${escapeHTML(path)}" alt="${escapeHTML(entry.poseId)} ${escapeHTML(entry.camera)}">
  <div class="meta">${escapeHTML(JSON.stringify(metadata, null, 2))}</div>
  <div class="decision"><label><input type="radio" name="${escapeHTML(path)}" value="pass"> Pass</label><label><input type="radio" name="${escapeHTML(path)}" value="fail"> Fail</label><input data-shot-notes type="text" placeholder="截图备注"></div></article>`;
}

function evidenceGroup(entry) {
  if (entry.preset && entry.preset !== 'Reference') return 'BodyDNA Presets';
  const pose = String(entry.poseId ?? '');
  if (/t-pose|arm-raise/.test(pose)) return 'Shoulder';
  if (/elbow/.test(pose)) return 'Elbow';
  if (/forearm/.test(pose)) return 'Forearm Twist';
  if (/hip/.test(pose)) return 'Hip';
  if (/knee/.test(pose)) return 'Knee';
  if (/squat/.test(pose)) return 'Squat';
  if (/lunge/.test(pose)) return 'Lunge';
  return 'Reference Body';
}

function escapeHTML(value) {
  return String(value ?? 'unavailable').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function parseRoot(argv) {
  const index = argv.indexOf('--root');
  return index >= 0 && argv[index + 1] ? resolve(argv[index + 1]) : defaultArtifactRoot;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await buildProceduralDeformQAGallery({ artifactRoot: parseRoot(process.argv.slice(2)) }), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    process.exitCode = 1;
  }
}
