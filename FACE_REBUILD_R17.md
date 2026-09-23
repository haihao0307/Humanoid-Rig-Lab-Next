# R17 facial reconstruction and artist reference review

Status: local candidate. Visual acceptance is false. This revision is not an AAA-quality certificate and has not been published to GitHub main.

The previous R15/R16 approach did not solve the likeness and construction problems. Repeating one rounded lip section across the mouth, blending independently authored nasal and oral beds, and attaching a replacement face outside the source surface's supported region produced an artificial result even when numerical continuity checks passed.

## References actually studied

- [Colin Thomas — Uncharted 4](https://www.formsintris.com/uncharted4). The public Sam gray sculpt and skin render were opened and enlarged in a background browser. Observed construction: dental support beneath lips, a projecting upper central tubercle, retreating upper wings, a broad lower-lip face, corners embedded into surrounding tissue, and a recessed transition before the chin. The reference's identity, age, beard and surface assets were not copied.
- [Yibing Jiang — Uncharted 4 materials](https://yibingjiang.artstation.com/projects/lNk0z). Separating regional material response, diffuse scattering and reflection matters; uniformly coloring a smooth mesh is insufficient.
- [William Pare-Jobin — character creation breakdown](https://marmoset.co/posts/real-time-character-design-creation-and-presentation-breakdown/). Primary forms and silhouette require review from multiple views before secondary detail.
- [Saurabh Jethani — realistic skin in Toolbag](https://marmoset.co/posts/creating-realistic-skin-toolbag-saurabh-jethani/). The base-topology, sculpt, noise, pore-detail and material-layer illustrations were actually viewed in a background browser. Lip detail and regional roughness need separate treatment; eye contact and small fibres contribute at close range.
- [Epic — Digital Humans](https://dev.epicgames.com/documentation/en-us/unreal-engine/digital-humans?application_version=4.27). Production digital-human shading uses more complete material and lighting models than this workbench's current local wrapped-light approximation.
- Anatomical construction references: [philtral musculature](https://pmc.ncbi.nlm.nih.gov/articles/PMC1231826/), [modiolus](https://pubmed.ncbi.nlm.nih.gov/23851821/), [nasolabial fold](https://pubmed.ncbi.nlm.nih.gov/2909048/), [mentalis](https://pubmed.ncbi.nlm.nih.gov/33514053/).

## Changes and evidence

`body/PerioralSurface.js` is the single owner of oral support, philtral columns, commissural volume, labiomental transition and lip sectional parameters. Upper central, upper lateral and lower sections have different curvature and projection. The lower lip has a broader face. The continuous oral annulus, mucosal return and cavity share actual boundaries.

The source-face replacement boundary was checked against the actual reconstructed detail group. The old 74 mm lateral radius had 224 unsupported samples out of 720; the 62 mm radius has complete source support. The final sculpt now returns to source positions, shading normals and interpolated skeletal influences. A dedicated actual-source test checks boundary support and error, and a separate fixture checks preservation of mixed skeletal weights. Nasal and oral underlays now share one nasal-column/philtrum section; the previous two independently blended targets created a horizontal shelf. Teeth use distinct incisor, lateral-incisor, canine and posterior crown sections instead of uniformly scaled rounded blocks.

The eye work repairs skin/globe registration, canthal depth and closed-lid continuity, adds tapered three-dimensional lashes that follow the lid, and uses the displayed lid edge to compute local contact visibility. Corneal reflection directions follow the actual lighting. Identity-driven free-edge reshaping remains limited by the existing attachment policy.

Skin uses separately filtered pigment, vascular and relief scales. Lip relief is attached to neutral material coordinates and persists while opening. These remain procedural approximations, not scan-derived material maps or a true subsurface diffusion simulation.

Review mode provides an isolated interactive face with a consistent studio light. Close inspection uses a fitted shadow volume. Color, gray material, neutral, smile, open mouth, closed eyes, front, oblique and profile views are inspected in an actual headless Chrome render; no desktop mouse interaction is used.

## Validation and remaining acceptance

Final source checks and geometry checks passed. The final actual browser capture completed at 2026-09-16 16:29:30 (Asia/Shanghai), with startup ready and no page errors. Compiled entry SHA-256: `00b4fb1c89688eb2c1d501f1befc707a5ed61938bea3468b5f9ef50de21131ee`. External reconstruction source hashes are also recorded in `capture.json`.

The first higher head-refinement candidate exceeded the existing 600,000-triangle source limit and was rejected. The retained head-only budget uses 70% of the previous head base pool, 30% of its extra front-face pool and 70% of its ear pool. The feature/body pools and hard limits are unchanged. Full source assembly, interface conformance and finalization passed at 583,288 triangles. This count precedes the added procedural facial/eye display layers.

Reproduction commands:

```
node tools/build-pure.mjs
node tools/check-pure.mjs
node tools/check-face-anatomy.mjs --parameter-fixtures
node tools/check-eye-anatomy.mjs --parameter-fixtures
node tools/test-face-source-boundary.mjs
node tools/test-head-chart-continuity.mjs
node tools/audit-head-display-sampling.mjs
```

Actual captures are outside the repository in `../face-review-r17-20260916/`. Its `capture.json` records the compiled entry hash, time, startup result and page errors, so intermediate screenshots are not confused with a later build. Artist-page screenshots are also outside the repository and are not runtime assets.

Final visual inspection rejects AAA acceptance: the face still reads as synthetic. Lip volumes and color remain too regular, the oral corners and upper nasal/oral transitions need sculptural refinement, the source head retains coarse planes, skin response lacks the layered character of the artist references, and the dentition/cavity remain visibly simplified. Closed eyes are continuous in the tested pose, but that does not certify all identities or expressions. The current workbench uses authored procedural anatomy, a simplified expression model and a local scattering approximation. The user has been asked whether the repository's model/texture restriction may be relaxed for a sculpt/retopology/material workflow; no such assets have been added while that choice is pending.

Local interactive preview: `http://127.0.0.1:8781/index.html?review=face&faceView=lips`. Its server binds only to localhost and does not take desktop mouse control. Current work remains uncommitted and unpublished.

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [ ] 用户看到的是可交互三维工作台：本地入口可运行，尚未确认用户打开。
- [x] 人物/动物几何、骨骼和动作来自真实运行时。
- [x] 镜头、选择、动作或参数控制可以实际操作：镜头、灰模切换和表情通道已通过真实浏览器操作。
- [ ] 公网固定链接和真实浏览器已验证：真实浏览器已验证，未部署公网链接。
- [x] 如果只有截图而没有工作台，本轮判定失败：本轮包含实际三维源码与可交互工作台，截图仅作为检查证据。
