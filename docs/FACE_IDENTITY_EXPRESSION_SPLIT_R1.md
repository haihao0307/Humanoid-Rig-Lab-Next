# 面部固定身份与临时表情分层 R1

## 目的

此前 `appearance.face.offsetsMm` 和 `appearance.face.weights` 共用 `jarvis/face_pose@1`。切换表情预设时只生成新的 `weights`，会把人物原有脸型位移一起清空。本轮将人物长期中性脸与当前临时表情拆成两个子状态。

## 新数据结构

```json
{
  "schema": "jarvis/face_profile@2",
  "revision": "r3-independent-lip-opening",
  "identity": {
    "schema": "jarvis/face_identity@1",
    "neutralOffsetsMm": {}
  },
  "expression": {
    "schema": "jarvis/face_expression@1",
    "weights": {}
  }
}
```

`identity.neutralOffsetsMm` 保存人物长期长相；`expression.weights` 保存微笑、眨眼、皱眉、抿嘴等临时状态。渲染时先应用固定身份，再叠加临时表情。表情插值和恢复中性只处理 `expression`。

## 旧数据迁移

继续接受 `jarvis/face_pose@1` 与无 schema 的旧对象：

- `offsetsMm` 迁移到 `identity.neutralOffsetsMm`；
- `weights` 迁移到 `expression.weights`；
- 明确记录迁移假设为 `legacy offsets = neutral identity`。

旧文件无法证明每个历史位移最初是否属于身份或一次临时修形，因此这一解释是兼容性假设，不是事实复原。

## 页面检查

打开 `index.html?review=face` 会自动进入面部近景和面部设置。面板新增：

1. 参考、清瘦、宽阔、圆润、棱角五个中性脸起点；
2. 固定身份局部微调；
3. 独立的临时表情区；
4. “检查身份/表情分层”按钮。

建议先选一个明显的身份起点，再依次点击微笑、惊讶和中性。人物应始终回到该人物自己的中性脸，而不是公共参考脸。

## 已验证与未验证

源码检查、旧 schema 迁移、身份保持、NPC uniform 传递、装配构建和文件审计进入自动检查。浏览器中的真实外观仍需用户在固定预览页确认；本文件不把源码检查等同于视觉验收。
