# Procedural Clothing Integration Contract V1

## 1. 输入契约

### 1.1 Proportion

服装适配器接受项目 `ProportionProfile` 或等价字段：

```js
{
  subject_id,
  proportion_revision,
  measurements: {
    body_height,
    shoulder_width,
    chest_circumference,
    waist_circumference,
    hip_circumference,
    neck_circumference,
    upper_arm_circumference,
    torso_length,
    arm_length,
    chest_depth,
    waist_depth
  }
}
```

缺失围度时允许使用明确的比例回退值，回退来源必须写入质量报告。正式生产人物应提供真实测量或程序化人体表面测量结果。

### 1.2 Rig

运行时输入为：

```text
Float32Array jointSkinMatrices
layout: column-major 4 × 4
meaning: final joint world matrix × inverse bind matrix
source: simulationRig.finalPose
```

关节表由载荷保存。每个顶点固定保存四个关节索引和四个归一化权重。

### 1.3 Body Surface

Hybrid 和 Dynamic 模式接受可替换的解析式碰撞接口：

```js
sampleBodySDF(x, y, z) => {
  distance: number,
  normal: [number, number, number]
}
```

`distance` 使用米。正值表示位于人体表面外部，负值表示进入人体内部。服装求解器只读取该接口。

## 2. 输出契约

`compileGarment()` 返回 `GarmentPayload`。调用方可以直接创建 Three.js `BufferGeometry`、编码成 `HRLG`、使用 `deformGarment()` 执行 CPU 骨骼变形、将相同 TypedArray 上传 WebGPU，或使用 `stepHybridCloth()` 进行轻量布料修正。

## 3. Three.js 接入

```text
position        ← positions
normal          ← normals
index           ← indices
skinIndex       ← skinJoints
skinWeight      ← skinWeights
materialCoord   ← materialCoords
regionId        ← regionIds
```

`materialCoord` 是米制程序化坐标，只供函数材质使用。

## 4. WebGPU 接入

推荐缓冲区包含 Rest Vertex Buffer、Skin Joint Buffer、Skin Weight Buffer、Material Coordinate Buffer、Constraint Edge Buffer、Constraint Rest Length Buffer、Dynamic Position A/B Buffer、Normal Output Buffer、Joint Matrix Buffer 与 Material DNA Uniform Buffer。

计算顺序：

```text
finalPose matrices
→ skin target pass
→ stretch and seam pass
→ body collision pass
→ normal pass
→ render pass
```

## 5. 版本检查

穿着前同时检查 `garmentRevision`、`garmentHash`、`materialRevision`、`materialHash`、`proportionRevision`、`bodyHash`、`patternGraphHash`、`topologySignature` 和 `payload.contentHash`。

人物比例变化后，旧 FitContract 标记为失效，必须重新编译。只发生姿势变化时继续使用同一 GarmentPayload，逐帧更新最终骨骼矩阵。
