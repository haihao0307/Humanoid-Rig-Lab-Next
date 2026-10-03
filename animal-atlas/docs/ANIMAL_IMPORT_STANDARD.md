# 靠谱动物交付规范 1.1

交给其他工作台的要求：输出一个 UTF-8 的 `动物名.kaopu.json`，作为完整动物包。动物生成与生命逻辑属于“乐器”，形态及动作选择属于“乐谱”，仓库统一保存档案、调用接口和展示。规范约束数据结构与接口，不规定动物能有多少功能、采用什么成长算法、有哪些动作或知识。

**当前直接导入：K4/K5 程序化动物包、已安装运行器的引用包、完整内嵌 GLB 包。新程序化引擎必须先注册运行器及适配器，再交动物包；把任意 JS/HTML 放进 JSON 不会自动执行。** 这是当前实现边界。这里不把未知运行器误写成“已经支持”。新增引擎后，共用档案和参数面板不需要为每只动物重写。

## 文件与角色

推荐完整封套 `kaopu/content@1`：

```json
{
  "schema": "kaopu/content@1",
  "payload": {
    "schema": "kaopu/animal@1",
    "animal": {
      "name": "动物名称",
      "category": "land",
      "basicData": { "见下文": "应填写完整 basic@1 对象" },
      "profile": { "见下文": "应填写完整 profile@1 对象" }
    },
    "instrument": { "id": "kaopu/mammal", "version": "K5.0.0" },
    "score": {
      "schema": "kaopu/score@1",
      "instrument": { "id": "kaopu/mammal", "version": "K5.0.0" },
      "name": "动物名称",
      "notation": "此处必须替换为原工作台输出的完整 K5|... 动物谱",
      "parameters": { "scale": 1, "bulk": 1, "color": "#a17255" }
    }
  },
  "knowledge": {},
  "extensions": {}
}
```

上面是结构示意，不是可直接导入的动物；不要把占位文字当动物谱。`examples/procedural-dog.kaopu.json` 是从实际工作台导出、再导入验证的完整示例。

| 对象 | 责任与关系 |
| --- | --- |
| `animal` | 名称、分类、尺寸/体重与共同档案，描述当前个体 |
| `instrument` | 唯一引擎 ID 与精确版本；指纹引擎还需 `assetSha256` |
| `score` | 指向同一乐器，保存完整生成谱及当前实际参数 |
| `knowledge` | 任意 JSON 知识结构、证据、生命周期说明、关系；仓库原样保留，不据此自动模拟 |
| `extensions` | 额外功能元数据、专属知识或引擎扩展；原样保留 |

也可直接交付 `payload` 本身。内容封套要求独立动物资源/完整生成谱，不能只放 `atlas-reference`；引用包直接交付 `kaopu/animal@1`。单独 `score.json` 是配方，接收方需已有匹配乐器/动物资源，不能把它当完整动物。

`name` 为 1–60 字；`category` 使用当前目录的 `land / ocean / birds / coast`，以仓库 `src/catalog.js` 实际分类为准。不限制动物生物学分类；知识中的分类树可自行扩展。文件不依赖旁边的文件、CDN 或远程资源。当前 animal/content/score/recipe JSON 上限 90 MiB，烘焙 bake JSON 上限 180 MiB，GLB 上限 64 MiB，K4/K5 文本谱上限 100 KB。不是鼓励把重复运行库放进每份谱。

## 所有动物共同档案

`basicData`：

```json
{
  "schema": "kaopu/basic@1",
  "units": { "length": "m", "mass": "kg" },
  "referenceSpanM": 0.8,
  "massKg": 12,
  "sourceSpan": 2,
  "metersPerUnit": 0.4,
  "basis": "user-declared",
  "stage": "导出时的基准姿态",
  "measure": "reference-pose-maximum-span"
}
```

`referenceSpanM` 是基准姿态最大包围跨度，包含尾、翼、足，不能擅自叫体长。`sourceSpan` 是同一姿态在生成器原单位下的最大跨度；`metersPerUnit = referenceSpanM / sourceSpan`。两次测量必须来自同一形态/坐标空间。跨度范围 `0.001–100 m`，体重 `0.000001–200000 kg`，所有数值有限且正；体重独立声明，不能靠展示缩放推导。`basis` 为 `user-declared` 或 `planning-estimate`。无实测资料可用明确的规划估算；不伪称测量。缺尺寸/体重时导入窗口要求补齐才入库。

`profile`：

```json
{
  "schema": "kaopu/profile@1",
  "ageYears": null,
  "growthStage": null,
  "bodyCondition": null,
  "health": null,
  "color": null
}
```

| 字段 | 类型与单位 | 约定 |
| --- | --- | --- |
| `ageYears` | 有限数 `0–1000` 或 `null` | 年，可用小数；0 是初生，未知必须 `null` |
| `growthStage` | 枚举或 `null` | `newborn / juvenile / growing / adult / senior`；档案可独立声明；演示控件按演示成熟年限联动 |
| `bodyCondition` | 有限数 `0–100` 或 `null` | 仓库自定义胖瘦记录，低→偏瘦、高→丰满；不代表通用生物学量表 |
| `health` | 有限数 `0–100` 或 `null` | 仓库自定义健康状态记录，低→较差、高→较好；不是医疗诊断 |
| `color` | `#RRGGBB` 或 `null` | 主体色记录；不是完整花纹/多材质描述，多色放专属参数 |

这些字段可以缺省以兼容旧文件；新工作台必须输出完整对象，未知写 `null`，不能默认写成年、健康、0 或黑色。如果 `animal.profile` 与 `score.profile` 同时存在，两份必须一致。不要把这些档案字段塞进 `score.parameters`，否则老乐器会拒绝不认识的参数。

## 参数与额外功能

`score.parameters` 的 key 必须是原运行器已经声明的 key，值为有限数、布尔或不超过 200 字的字符串。不得使用 `__proto__ / constructor / prototype`，key 不超过 80 字。不要改名成公共别名再导出；别名只用于仓库映射，确保往返仍能回到原工作台。

共同 UI 根据乐器实际能力映射尺寸倍率、颜色、明暗、粗糙度、动作速度与检查功能。**档案记录不等于形态算法**。用户已选择仓库提供统一演示映射，作用于尺寸、横截面比例、叠色和原生时钟，明确标为演示。真正的物种成长、健康或形体知识仍由乐器实现。六个实际演示 key、默认值、公式、快照往返与后续替换方式见 [统一演示运行规范](DEMONSTRATION_RUNTIME_STANDARD.md)。新功能仍放专属参数，不限制能力。

额外参数数量与功能主题不封顶；统一生成 UI 使用以下描述符：

```json
{
  "key": "tailCurl",
  "label": "尾巴卷曲",
  "type": "range",
  "min": 0,
  "max": 1,
  "step": 0.01,
  "value": 0.3,
  "section": "animal"
}
```

这是乐器 `describe().controls` 的声明，不是往 `parameters` 里放一份控件定义。`range` 声明 min/max/step；`select` 声明 `{value,label}` 选项；`color` 为 `#RRGGBB`；`checkbox` 为布尔。没有公共语义映射的控件自动进入“物种专属参数”，仍使用同一控件生成器。复杂知识、曲线、行为图、关系图可放完整动物谱或封套 `extensions`，运行器通过这些标量/选项控制它们；不是把曲线截成几个字段丢失功能。

动作由运行器声明 `{id,label}`，保存 `action` 原始 ID 与 `playing` 布尔值。没有原生动作的动物不凭空获得运动。点击动作与暂停必须操作真实生命时钟。

## 新乐器的接入合同

新算法不限功能，但接收平台必须有它的执行实现。交付动物包前，原工作台提供稳定的乐器 ID、版本、源码指纹、生成谱格式与以下语义接口，由仓库注册适配器：

```js
describe()       // 控件、动作、能力、参数范围
configuration()  // 当前原参数记录
set(key, value)  // 校验并应用参数，返回/可读取实际值
playAction(id)
pause(); resume()
meshes()         // 当前实际形态的可烘焙对象网格
bake()           // 当前参数与实际姿态快照
```

使用仓库 `AnimalRuntime` / `animal-atlas/1` 消息协议：父页指定 `channel`；请求 `set / snapshot / mesh / capture`，携带 `requestId`；返回 `applied / snapshot / mesh / capture` 或 `failure`，保持相同 requestId、channel。初始化返回 `ready`、controls、actions、record。鼠标观察由真实镜头实现。

烘焙网格为当前对象而非整个展示场景，Y 朝上；positions 为三分量，indices 为三角面，材质提供基础 PBR，uv/顶点色/内嵌纹理可选。动作、着色器与持续程序化变化留在原运行器。公共单位校准在 basicData 中；GLB 使用米时标注 metre，并避免二次换算。

当前 K4 乐器 `kaopu/quad@K4.0.0`、K5 `kaopu/mammal@K5.0.0`；必须使用完整 `K4|...` / `K5|...` 字符串。`atlas-reference` 必须引用已经安装的 animalId 与匹配指纹。带生命活动烘焙 `kaopu/bake@2` 只运行当前构建登记的指纹，不执行未知代码。

## 验收与交接

另一工作台先导出完整文件，再用本仓库 `contracts/animal-package.schema.json` 做结构检查；结构通过不代表语义/引擎通过。仓库导入还验证乐器版本、参数范围、档案、真实三维预览及尺寸/体重。成功预览→加入目录→调公共和专属参数→导出→重新导入→比较形态和记录。知识封套导入后导出仍应完整保留。

物种新功能应通过新增/升级乐器能力接入，不需要缩减为现有 K5 的能力。不支持的运行器明确报错，不能悄悄转换为静态替身后声称功能保留。

- [x] 文件规范针对真实程序化动物与三维运行器，没有用生成图片代替。
- [x] 本轮实际修改生产源码，统一档案可编辑、保存并随文件往返。
- [x] 交付包含可交互 standalone HTML；几何与原动作保持真实运行器。
- [x] 参数/选择/动作由实际测试与独立报告验证。
- [ ] 公网固定运行网址未部署；GitHub 为源码与离线交付仓库。
- [x] 单独截图不算工作台交付，文件结构检查不批准视觉或科学准确性。

格式依据：[MDN number input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number) 的空值与数值处理、[Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) 的米制坐标及 extras 元数据。年龄/健康记录约定为本仓库协议，不宣称是这些外部标准的生物学定义。
