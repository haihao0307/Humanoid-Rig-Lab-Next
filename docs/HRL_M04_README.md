# HRL-M04 Procedural Clothing System V0.1.0

该目录是 Humanoid Rig Lab Next 的独立服装系统基础包。目标是让一套标准衣服通过版本化 DNA、衣片函数、人体测量和最终骨骼矩阵，适配到不同虚拟人物上。

## 数据链

```text
GarmentIntent
  → GarmentDNA
  → PatternGraph
  → SeamGraph
  → MaterialDNA
  → FitContract
  → GarmentCompiler
  → TypedArray GarmentPayload
  → HRLG Binary
  → simulationRig.finalPose
  → GarmentRuntime
```

## 标准圆领上衣

第一件标准衣服由前片、后片、左袖、右袖、领口带、左右侧缝、肩缝、袖窿连接和领口连接组成。

人体参数改变时，系统重新求解胸围、腰围、下摆、肩宽、衣长、袖长、袖围、领口宽度和表面净空。拓扑分辨率保持稳定，便于动画、缓存和版本比较。

## 材质

当前包含棉针织、羊毛斜纹、丝绸缎面三套函数材质预设。材质 DNA 同时包含厚度、面密度、经纬伸长、剪切、弯曲、阻尼、摩擦、空气阻力、粗糙度、纤维光泽、各向异性和微结构频率。表面细节由解析函数在运行时求值。

## 二进制输出

`HRLG@1` 把元数据和 13 个二进制分段写入单一 `ArrayBuffer`：

`POSI`、`NORM`、`INDX`、`JONT`、`WGHT`、`MCRD`、`RGID`、`SEAM`、`EDGE`、`RLEN`、`IVMS`、`FLWT`、`MUNI`。

## 运行

```bash
npm run test:procedural-clothing
python -m http.server 8080
```

浏览器打开 `procedural-clothing-lab.html`。
