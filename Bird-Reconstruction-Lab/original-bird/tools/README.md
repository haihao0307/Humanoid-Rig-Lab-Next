# Original Bird Reference Measurement Tool

用途：在任何鸟类 GLB/GLTF 进入 Original Bird 研究前，先生成结构测量记录，避免根据文件名、截图或“看起来像”直接把参考升级为母体真值。

## 输出

- SHA-256、字节数、容器类型；
- scene/node/mesh/primitive/accessor/buffer 数；
- POSITION accessor 顶点计数；
- 已知 TRIANGLES primitive 三角面计数；
- material/texture/image 数；
- skin 数及 joint 数；
- animation clip / channel / sampler 数；
- morph target 数；
- mesh-local accessor bounds；
- 从 node 名称得到的鸟类解剖语义提示；
- scale/taxonomy/age/sex/anatomy/visual acceptance 的明确 unknown/false 边界。

## 使用

```bash
python Bird-Reconstruction-Lab/original-bird/tools/measure_bird_reference.py reference.glb -o measurement.json
python Bird-Reconstruction-Lab/original-bird/tools/measure_bird_reference.py --self-test
```

注意：
- accessor bounds 目前是 mesh-local，不应用 node/world transform；
- glTF 线性距离约定为 metre，但并不证明作者导出时使用了正确的真实鸟尺度，所以 realWorldScaleVerified 始终先为 false；
- node 名字只能作为语义提示，不能自动证明骨骼解剖正确；
- 本工具不把外部网格转成运行时资产，只做参考审计。
