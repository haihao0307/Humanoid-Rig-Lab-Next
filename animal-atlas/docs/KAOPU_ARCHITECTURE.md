# 靠谱架构初版：乐器、乐谱与动物包

本版的入口是动物目录里的 **＋ 导入动物**。选择或拖入一个文件，平台识别格式、匹配乐器、校验数据，在独立 iframe 内真正生成或加载动物；预览通过后点击 **加入动物目录**。只有参数的乐谱使用 **应用乐谱到已有动物**。失败不会添加条目。预览可以关闭取消。

## 概念与当前能力

**乐器**是已经注册的生成器或运行器，负责解读一类谱，声明版本、支持的参数及动作。动物文件不能携带 JS/HTML 来注册新乐器。第一版使用现有实现，未重写动物生成逻辑：

| 乐器 ID | 固定版本 | 读取内容 | 实际能力 |
| --- | --- | --- | --- |
| `kaopu/quad` | `K4.0.0` | 完整 `K4|…` 四足形体谱 | 程序化静态形体、颜色、粗糙度、尺寸 |
| `kaopu/mammal` | `K5.0.0` | 完整 `K5|…` 哺乳四足谱 | 程序化静态形体、颜色、粗糙度、尺寸、丰满度 |
| `kaopu/gltf` | `1.0.0` | 自包含 glTF 2.0 GLB | 原网格、材质、骨架、Morph 与已有动画片段；尺寸、叠色、粗糙度倍率、速度、暂停 |
| `atlas/<adapter>` | 原动物版本 | 平台内置动物工作台 | 原工作台已有参数和动作，模型源码 SHA256 必须匹配 |

**乐谱**是声明数据，包含乐器身份、动物形体谱（可选）、参数和动作选择。K4/K5 的 notation 就是已有动物谱；仅参数的 GLB 乐谱依赖先前导入的模型。动作只选择已经存在的片段，不生成新动作。未支持的年龄、生长等字段会拒绝导入。

**动物包**是可以恢复对象的交换格式：名称、分类、乐器声明、乐谱，以及 GLB 模型资源（如需要）。程序化动物只携带谱，接收平台用匹配乐器重新生成动物。内置复杂工作台仍通过原适配器运行；其动物包是同版对象引用，接收平台必须已经内嵌该工作台。完整复杂材质与动作跨网页使用仍可导出独立 HTML。

## 可以成功导入的文件

| 文件 | 要求 | 结果 |
| --- | --- | --- |
| `.txt` / `.score.txt` | UTF-8，完整 `K4|…` 或 `K5|…`，不超过 100 KB；通过原解析器的必需段、有限数值与范围检查 | 新的陆地程序化动物 |
| `.glb` | glTF 2.0；文件完整、所有资源内嵌；1 至 200 万顶点；不超过 64 MiB | 新模型动物，有动画才显示动作 |
| `.kaopu.json` | `kaopu/animal@1`，注册乐器版本匹配；完整谱或内嵌 GLB；参数有效；不超过 90 MiB | 新动物或已有工作台参数恢复 |
| `.score.json` | `kaopu/score@1`；程序化谱可独立生成；仅参数谱必须有匹配的已安装模型 | 生成动物或恢复已有对象 |
| `.animal.json` | 兼容旧 `animal-atlas/recipe@1`，已有动物 ID 与原 SHA256 匹配 | 恢复旧配方 |

GLB 使用普通 PNG/JPEG/WebP 内嵌贴图，支持 GLTFLoader 当前内建的标准材质扩展。需要 Draco/Meshopt 网格解码或 KTX2/BasisU 贴图解码的文件首版拒绝；请在原导出工具里关闭这些压缩。外部 URL、相对文件引用、未知必需扩展均拒绝。HTML、JS、FBX、OBJ、外置 `.gltf` 和其他谱头暂不接收。

GLB 展示会用独立父节点归一化最大边长为 2 个场景单位、水平居中并落到地面。原网格节点、骨骼关系和动画保持不变；这是展示尺度，不是动物真实尺寸标定。GLB 导入目前使用沙滩展示台，动物分类只管理目录；不会自动推断或切换栖息环境。

## 数据契约

参数乐谱（真实鱼版本指纹由导入窗口的 **下载参数乐谱示例** 生成）：

```json
{
  "schema": "kaopu/score@1",
  "instrument": {
    "id": "atlas/fish",
    "version": "鱼群 R13",
    "assetSha256": "对应源动物文件的完整SHA256"
  },
  "animalId": "fish",
  "name": "大型鱼参数谱",
  "parameters": { "group": false, "waterDensity": 1, "playing": true }
}
```

程序化动物包的结构：

```json
{
  "schema": "kaopu/animal@1",
  "animal": { "name": "我的程序化动物", "category": "land" },
  "instrument": { "id": "kaopu/mammal", "version": "K5.0.0" },
  "score": {
    "schema": "kaopu/score@1",
    "instrument": { "id": "kaopu/mammal", "version": "K5.0.0" },
    "notation": "这里填写完整的K5谱，不能只写谱头",
    "parameters": { "scale": 1, "bulk": 1, "environment": true }
  }
}
```

上面的 notation 是结构说明，不是有效动物谱。可直接导入的完整文件见 [examples](../examples)，窗口里的 **下载可导入动物包示例** 也包含完整陆龟 K4 谱。

GLB 动物包在相同结构中增加 `asset: { "format": "glb", "encoding": "base64", "data": "完整二进制的base64" }`；两处 instrument 均使用 `kaopu/gltf` / `1.0.0`，并包含原 GLB 二进制的完整 `assetSha256`。平台重新计算 SHA256 后匹配，改动模型文件必须更新指纹。乐谱不携带模型时，平台按动物 ID 或相同模型指纹找到已安装动物。

内置对象引用包使用 `asset: { "format": "atlas-reference", "animalId": "pig" }`，其 instrument 使用原适配器版本和源动物文件 SHA256。不携带整个原工作台源码。

分类取 `land`、`ocean`、`birds`、`coast`；动物名称 1 至 60 字。参数只允许数值、布尔值与短字符串，必须匹配运行器返回的 controls/actions，未知键和越界值拒绝。乐谱里的 `action` 必须是已有动作 ID。

## 保存、重复导入与导出

导入模型、谱和真实渲染缩略图存入 IndexedDB；当前参数与收藏沿用 localStorage。刷新相同文件/地址、相同浏览器配置可恢复。浏览器无法保存时明确提示只能用于本次会话，请导出动物包。关闭再打开其他浏览器或修改访问地址可能属于不同存储空间。

相同 GLB 二进制或相同 K4/K5 谱使用确定的 SHA256 派生 ID，重复导入不会新增重复条目，可以更新名称和应用参数。从目录移除只删除当前浏览器保存的导入条目，不修改原文件。新动物不会写入平台 HTML 源文件；分享时导出动物包或独立 HTML。

右侧增加两个导出选项：**靠谱乐谱** 和 **靠谱动物包**。GLB 动物包保留原 GLB，包括内嵌贴图、骨架和动画；参数另外写入乐谱。原有 **GLB 当前姿态** 仍是烘焙静态几何和基础材质的兼容输出，复杂材质请使用动物包或 HTML；**独立 HTML** 内嵌注册运行器、模型和当前参数。

## 代码与扩展边界

- `src/kaopu.js`：乐器身份、文件头/资源引用校验、参数契约与存储接口。
- `src/import-manager.js`：识别文件、候选预览、提交目录、持久化、交换格式。
- `src/imported.js`：内嵌 GLB 运行器、已有动画片段、展示归一化。
- `src/native.js`：原 K4/K5 乐器读取导入 notation。
- `src/bridge.js`：继续提供统一 controls/actions/set/mesh/capture/snapshot；native snapshot 额外返回原 notation。

流程是 `识别数据 → 匹配注册乐器 → 真正加载/生成 → 校验参数 → 三维预览 → 加入目录`。乐器新增或行为变更必须显式注册并升级版本；此版尚不是可安装任意第三方代码的插件系统，也不宣称已有完整动物行为编曲器。之后可在这个契约上增加新谱、动作序列和乐器能力，而不改变目录入口。

后台验收运行 `node tools/test-imports.mjs`；实际结果在 `qa/IMPORT_REPORT.json`，真实截图在 `qa/IMPORT_WINDOW.png`、`qa/IMPORT_PREVIEW_K4.png`、`qa/IMPORTED_ANIMAL.png`。规范基础：[glTF 2.0](https://github.com/KhronosGroup/glTF/tree/main/specification/2.0)、[Three.js GLTFLoader](https://threejs.org/docs/#GLTFLoader)。
