# R15 lip surface correction — candidate

Baseline: GitHub main `3c3e9a4b7b250f4c8db20c15e2e5fab4ca9ce568`.
Local branch: `feature/face-lip-surface-continuity-20260916`.

## Diagnosis and implementation

- Outer lip and inner mucosa previously selected pigment using absolute Z. Separate generated material domains now carry their identity through renderer chunks and draw uniforms.
- The supporting lip surface previously returned to the face over a narrow band. Broader sectional support, bounded corner slopes, bicubic surface sampling and a shared nasal underside displacement improve the attachment. Lateral smoothing ends at the vermilion border.
- Lip apron and facial skin previously used different jaw weights. The apron now blends into the surrounding skin's jaw field.
- Oral geometry used fixed reference depths and protruded through the chin during the inspected opening pose. The complete oral assembly is now translated behind the generated facial envelope while preserving internal relationships and normals.
- Procedural microrelief is reduced after removing its erroneous absolute-depth gate.

Anatomical reference consulted: https://pubmed.ncbi.nlm.nih.gov/8341737/ (Cupid's bow and vermilion border). This remains authored procedural geometry, not measured anatomy.

## Validation

`node tools/build-pure.mjs`, `node tools/check-pure.mjs` and
`node tools/check-face-anatomy.mjs --parameter-fixtures` passed.
The latter reports 21 source checks and 77167 fixture assertions, including shifted source depths and preservation of oral assembly relationships. These assertions are not visual acceptance.

Headless Chrome rendered the actual generated 3D workbench: neutral front, oblique, whole face, bilateral smile at 0.6, and jawOpen 0.45 with lipPart 0.3. No desktop mouse input was used. Screenshots and capture metadata are outside the source repository in `../face-review-r15-20260916/`.

Remaining visual issues: pointed commissures, triangular transitions at the open-mouth corners, coarse surrounding facial shading and simplified oral anatomy. Lip and skin remain separate meshes with a masked attachment; they are not a welded manifold. Prioritize shared commissure topology and a continuous inner oral wall before further pigment tuning. Uninspected identities, extreme expressions and combinations are not accepted.

## Delivery checklist

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码。
- [ ] 用户看到的是可交互三维工作台：本地入口已构建，当前交付附实拍；未确认用户打开。
- [x] 人物/动物几何、骨骼和动作来自真实运行时。
- [x] 镜头、选择、动作或参数控制可以实际操作：镜头及表情 API 已实测。
- [ ] 公网固定链接和真实浏览器已验证：仅本地无头浏览器，未部署公网。
- [x] 如果只有截图而没有工作台，本轮判定失败：本轮包含源代码及装配后的工作台。

This candidate is local; it has not been published or merged into GitHub main.
