# R16: continuous perioral attachment

Supersedes the R15 visual candidate, which the user rejected as insufficient.

The two tapered external lip strips have been replaced by one closed annular surface. Its outer boundary follows the actual clipped face-mesh boundary, including grid vertices at tangencies. Boundary positions and encoded normals are identical to their face counterparts. The face shader no longer discards an overlapping lip apron. Separate material draw meshes remain; this is a shared geometric boundary, not one combined indexed mesh.

Sectional knot rails were replaced by a smooth analytic roll profile. The inner return now samples the same free-edge function. Jaw weights converge to surrounding skin at both commissures. The contact shadow is limited to the mouth width and fades with jaw opening. The recessed oral wall remains visible behind the neutral fissure instead of exposing the background.

Research consulted: [upper lip muscle system](https://pubmed.ncbi.nlm.nih.gov/24406557/). Anatomical continuity informed the design; the procedural parameters are authored, not measured anatomy.

Validation: build, check-pure, and check-face-anatomy with parameter fixtures passed (21 source checks, 83165 fixture assertions). Added checks cover actual attachment edges, exact boundary positions and identical normals on planar and sloped source fixtures. The sloped fixture retains slope 2 but its depth origin is .205, keeping the entire mouth boundary above the source sampler's .12 cutoff. Incomplete/nonmanifold source support is rejected rather than silently stitched.

Actual headless Chrome captures: `../face-review-r16-20260916/`, including front, oblique, smile 0.6, jawOpen 0.45 plus lipPart 0.3. Startup ready, no page errors, no desktop mouse control. The hard raised lip border and extended horizontal contact shadow are reduced/removed in these views; inspected opening has connected corners. This does not certify every expression or identity. The surrounding nose/chin surface and oral anatomy remain simplified.

Local candidate only; no GitHub main publication or merge in this revision.

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [ ] 用户看到的是可交互三维工作台：入口已构建，未确认用户打开。
- [x] 人物/动物几何、骨骼和动作来自真实运行时。
- [x] 镜头、选择、动作或参数控制可以实际操作：镜头和表情通道已实测。
- [ ] 公网固定链接和真实浏览器已验证：仅验证本地浏览器，未部署公网。
- [x] 如果只有截图而没有工作台，本轮判定失败：本轮有源码及可交互工作台。
