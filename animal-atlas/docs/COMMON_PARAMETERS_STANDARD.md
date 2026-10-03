# 统一参数数据集与最小共用界面

当前对象只维护一份原参数状态。`src/parameter-catalog.json` 是唯一公共参数字典；`parameter-schema.js` 负责类型、选项、范围校验和语义映射，`parameter-ui.js` 是共同的控件生成器。原动物只提供参数能力、原始范围和专属数据，不再各自定义一套界面。

19 个原运行器的实际基线在 `qa/COMMON_INVENTORY.json`。全部有同样的 9 项展示台控制与米/千克基本数据；13 个有原生动作，6 个静态。共享基础是身份与乐器、物理基准、按能力的外观/动作/检查、展示环境；物种差异是扩展描述。

控件只用四种数据类型：`range / select / color / checkbox`，统一字段为 `key、type、label、value、min/max/step 或 options、section`。公共字典增加 `commonId、uiLabel、unit、uiGroup`。范围、选项和实际值仍取原模块，模板可覆盖默认值；UI 不写动物专用分支。K4/K5 与导入对象的共用参数模板、9 项展示参数均由同一字典生成。未知专属参数仍使用同一控件生成器。

右侧“对象”最上方固定显示年龄、阶段、跨度、体重、胖瘦、健康、颜色；原模型颜色、形体倍率和丰满度集中在同区且标为模型。动作与剩余外观在下方，物种专属参数默认折叠，对象说明、校准测量与来源说明收在底部。“展示与光线”使用全部动物共有的 9 项参数。隐藏的栖息环境参数仍只在对应环境显示。

## 语义边界

| 通用标识 | 原参数 | 条件 |
| --- | --- | --- |
| `object.scale` | fish `bodyScale`、native/imported `scale` | 形态倍率；Palau `zoom` 是镜头放大，保留为专属项 |
| `surface.color / tint / tone` | `color / tint / brightness、coatTone` | 分别为覆盖颜色、叠色、标量明暗倍率，不互换值 |
| `surface.roughness / roughnessFactor` | native `roughness` / imported `roughness`、life `coatRoughness` | 绝对值与倍率分开；原材质保持原模块的钳制方式 |
| `motion.rate` | fish/cat/eagle/crab/Palau/imported `speed` | 保留连续范围或离散枚举；dog `paceSlider` 是位移步态目标，不映射为播放速度 |
| `inspection.bones / wire` | `bones / skeleton / wire` | 仅当原模块声明支持；不代表解剖学真实性 |
| `presentation.*` | 9 项展示台控制 | 相对光强，不声明为 lux；主光方向为度；环绕速度保留原范围 |

`referenceSpanM` 是基准姿态最大跨度，不能改称体长；`massKg` 保留估算/用户声明依据，不通过形体缩放推算。年龄、生长、胖瘦和健康现在是所有动物共有的可编辑仓库档案；它们不代表当前全部生成器都支持相应变化算法。统一 `kaopu/profile@1` 定义来自同一参数字典的 warehouse 字段，未填严格为 null。

## 管家接口与兼容

`window.__ATLAS__.common()` 返回 `kaopu/common@1`：动物 ID、已有 basicData、profile、生命周期能力、公共控件、专属控件。它是当前状态的派生视图，不另存第二套参数。

```js
const animal = window.__ATLAS__.common();
await window.__ATLAS__.setCommon('presentation.exposure', 1.1);
// 先读取控件是否支持，再使用其原范围或原选项。
if (animal.controls.some(c => c.commonId === 'object.scale')) {
  await window.__ATLAS__.setCommon('object.scale', 1.05);
}
```

`lifecycle.action / playing` 仅对已有动作的动物开放；`physical.referenceSpanM / massKg` 更新已有物理基准。`profile.ageYears / growthStage / bodyCondition / health / color` 更新共同档案；模型有直接主体色控制时 profile.color 也更新原色控件。未知公共参数拒绝执行。原生成器参数仍用原 key，不写第二份别名状态。档案独立为可选 top-level profile（烘焙放 source.profile），随配方、乐谱、动物包、GLB extras 和 HTML 传递；旧文件无该字段仍兼容。原材质叠色保持单独参数，不覆盖主体色记录。受信运行器机制保持。

构建仅内嵌一份公共桥接源码，让工作台直接引用活动支持对象中的 bridge，移除重复字符串。没有增加一份 19 动物 × 全参数的常驻数据集，没有新增模型/贴图或网格缓存。接口层削减不能宣称等于所有曲面数据也缩小。

单位原则参考 [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)；播放速度与原动作时钟的区别参考 [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)。本轮仍保留各动物原生活系统。

- [x] 没有用生成图片代替真实三维实现。
- [x] 实际修改生产源码与参数数据集。
- [x] 交付本体是可交互三维工作台与独立 HTML。
- [x] 几何、骨骼与动作保留原真实运行器。
- [x] 镜头、选择、动作、参数与兼容门禁通过，绑定最终候选的机器报告与独立报告。
- [ ] 未建立公网固定部署；GitHub 为源码与离线包仓库。
- [x] 截图不替代工作台；用户视觉、科学准确性与生产就绪不由本轮程序检查自动批准。
