import { ProjectHubClient } from '../../src/project-hub.js';
import { estimatePoseFromImage } from '../../src/modules/pose/image-pose-estimator.js';
import {
  analyzeCharacterImage,
  applyCharacterGeneration,
  loadGeneratedCharacter,
  saveCharacterGeneratorVersion,
} from './index.js';

const hub = new ProjectHubClient({ module: 'integration', title: 'Character Generator' });
const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map((element) => [element.id, element]));
let selectedFile = null;
let selectedImage = null;
let selectedImageUrl = '';
let currentAnalysis = null;
let currentState = hub.getState();

elements.characterImageInput.addEventListener('change', async () => {
  const file = elements.characterImageInput.files?.[0] || null;
  if (!file) return;
  try {
    setStatus('正在读取图片…');
    selectedFile = file;
    selectedImage = await loadImage(file);
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    selectedImageUrl = URL.createObjectURL(file);
    elements.characterImagePreview.src = selectedImageUrl;
    elements.imagePreviewWrap.hidden = false;
    elements.sourceImageName.textContent = file.name;
    elements.sourceImageMeta.textContent = `${selectedImage.naturalWidth} × ${selectedImage.naturalHeight} · ${formatBytes(file.size)}`;
    elements.analyzeCharacterButton.disabled = false;
    currentAnalysis = null;
    renderAnalysis(null);
    setStatus('图片已就绪。点击“分析图片”调用 HRL-M03。');
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.analyzeCharacterButton.addEventListener('click', async () => {
  if (!selectedFile || !selectedImage) return;
  elements.analyzeCharacterButton.disabled = true;
  elements.generateCharacterButton.disabled = true;
  try {
    setStatus('正在运行 HRL-M03 人体关键点识别；首次使用可能需要下载模型…');
    const [observation, contentHash] = await Promise.all([
      estimatePoseFromImage(selectedImage),
      hashFile(selectedFile),
    ]);
    currentAnalysis = analyzeCharacterImage({
      observation,
      source_image: {
        file_name: selectedFile.name,
        mime_type: selectedFile.type,
        byte_length: selectedFile.size,
        width: selectedImage.naturalWidth,
        height: selectedImage.naturalHeight,
        content_hash: contentHash,
      },
      base_state: currentState,
      character_name: elements.characterNameInput.value,
    });
    renderAnalysis(currentAnalysis);
    elements.generateCharacterButton.disabled = false;
    setStatus('分析完成。请确认模块数据后生成 Character。');
  } catch (error) {
    setStatus(error.message || String(error), true);
  } finally {
    elements.analyzeCharacterButton.disabled = !selectedImage;
  }
});

elements.generateCharacterButton.addEventListener('click', () => {
  if (!currentAnalysis) return;
  try {
    const next = applyCharacterGeneration(currentState, currentAnalysis);
    hub.replaceState(next, `从图片生成 Character ${currentAnalysis.character_name}`, {
      changedModules: ['proportion', 'pose', 'clothing', 'integration'],
    });
    currentAnalysis = null;
    elements.generateCharacterButton.disabled = true;
    setStatus('Character 已生成并写入项目状态。');
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

elements.saveCharacterVersionButton.addEventListener('click', () => {
  try {
    hub.transaction((state) => {
      Object.assign(state, saveCharacterGeneratorVersion(state));
    }, { module: 'integration', summary: '保存 Character Generator 新版本' });
    setStatus('Character 与 Generator 新版本已保存。');
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

hub.subscribe((state) => {
  currentState = state;
  elements.generatorSync.textContent = `${hub.transport} · Project revision ${state.revision}`;
  renderSavedState(state);
});

function renderAnalysis(analysis) {
  elements.emptyAnalysisResult.hidden = Boolean(analysis);
  elements.analysisResult.hidden = !analysis;
  if (!analysis) return;
  elements.confidenceGrid.innerHTML = Object.entries(analysis.confidence).map(([key, value]) => `
    <div><b>${Math.round(Number(value) * 100)}%</b><span>${escapeHtml(key)}</span></div>
  `).join('');
  const outputs = analysis.outputs;
  const rows = [
    ['ProportionProfile', outputs.proportion_profile.proportion_profile_id],
    ['BodyShape', outputs.body_shape.body_shape_id],
    ['FaceIdentity', outputs.face_identity.face_id],
    ['ClothingProfile', `${outputs.clothing_profile.clothing_profile_id} · ${outputs.clothing_profile.assets.length} assets`],
    ['PoseSnapshot', outputs.pose_snapshot.schema],
    ['CharacterProfile', '将在生成时写入 Character Core'],
  ];
  elements.outputList.innerHTML = rows.map(([label, value]) => `<div class="output-item"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
  elements.analysisJson.textContent = JSON.stringify(analysis, null, 2);
}

function renderSavedState(state) {
  const generator = state.characterGenerator;
  const sessionId = generator?.active_session_id;
  const session = sessionId ? generator.sessions?.[sessionId] : null;
  elements.saveCharacterVersionButton.disabled = !session;
  elements.savedCharacter.hidden = !session;
  if (!session) return;
  const loaded = loadGeneratedCharacter(state, sessionId);
  elements.savedCharacterId.textContent = loaded.character.character_id;
  elements.savedCharacterVersion.textContent = `v${loaded.character.version}`;
  elements.savedGeneratorVersion.textContent = `v${session.version}`;
  elements.savedGeneratorStatus.textContent = session.status;
  elements.generationSummary.innerHTML = `<strong>${escapeHtml(loaded.character.name)}</strong><p>${escapeHtml(session.character_id)} 已连接 Proportion、BodyShape、Face、Clothing 和 Pose 数据。</p>`;
  if (!currentAnalysis) {
    elements.emptyAnalysisResult.hidden = true;
    elements.analysisResult.hidden = false;
    const restoredAnalysis = {
      confidence: session.analysis.confidence || {},
      outputs: session.outputs,
      adapters: session.analysis.adapters || {},
    };
    renderAnalysis(restoredAnalysis);
    elements.analysisJson.textContent = JSON.stringify(session, null, 2);
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片无法读取。')); };
    image.src = url;
  });
}
async function hashFile(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
function setStatus(message, error = false) {
  elements.generatorStatus.textContent = message;
  elements.generatorStatus.style.color = error ? '#ff9b9b' : '';
}
function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
