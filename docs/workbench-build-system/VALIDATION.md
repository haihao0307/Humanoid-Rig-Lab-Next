# V1.0 验证范围与限制

日期：2026-10-10。交付对象为方法论、模板、记录检查器及只读CI，不是新三维工作台。

## 已实际执行

本地环境Python 3.13.5，标准库，无第三方安装或网络调用。运行：

```bash
python3 -m unittest discover -s tests -p 'test_workbench_methodology.py' -v
python3 tools/workbench_methodology.py lint
python3 tools/workbench_methodology.py check docs/workbench-build-system/RECEIPT.template.json --task docs/workbench-build-system/TASK.template.json --evidence-root .
```

42项单元测试全部通过，失败0。方法论文件、JSON和相对链接检查通过。未填写模板的发布检查返回退出码1，按预期拒绝，不把初始化误报为完成。

测试包括合法但source/build不同的版本谱系、限定用户接受范围，以及错误身份、旧构建、旧检查、无时区/过期时间、越权路径、受保护路径、越界符号链接、缺证据/错误哈希、删掉必需门槛、重复门槛、额外失败、假公网、自己审核自己、手机视口冒充实机、无物理证据、无视觉接受的影视级主张、未授权实验资产、静默回退、恶意/畸形JSON、初始化拒绝覆盖。

测试数据均是明确的synthetic fixture。检查器默认拒绝fixture用于实际交付；CLI不提供绕过该限制的开关。通过42项测试只证明这些记录检查行为，不证明任何人物、鞋子、眼睛或布料达到质量标准。

根AGENTS的原始10610字节前缀与既有Git blob `0c923a2071ef22ee2e3fb1484cecdad76e48d671`核对一致，仅追加方法论入口，不删除旧制度。发布差异应只包含本方法论文件、独立工具/测试/workflow和该追加项；不改变工作台生产源码。

## CI与独立性

新workflow仅检查本方法论路径，contents权限只读，固定checkout版本，稀疏检出、不保存凭据，不运行既有人物/材料台、不发布或写回Git。workflow文件存在不等于运行成功；GitHub实际运行结论须以当前提交对应的Actions日志为准。

本地作者自测不是独立审查；未声称已召集其他专家或获用户接受。方法论目前是可试用的V1记录体系，尚未经历从新领域到用户接受的顶尖工作台的完整独立端到端验证。

## 必须保留的限制

检查器验证字段、版本关联、路径及证据哈希，不能证明报告内容诚实、外部URL当前可达、DNS不指向内网、检查条件充分或图像好看。不同字符串的审核人字段不证明现实中存在独立审核人。远端Git谱系、真实浏览器/实机、科学标定和用户意见必须由真实验证补齐。

历史案例主要为实际读取的源码、README、来源表和交付报告；旧报告不冒充本轮重跑。资料包没有复制商业源码、模型、纹理、私人照片或凭据。主分支未合并与跨仓库未自动接入状态见registry及Draft PR。
