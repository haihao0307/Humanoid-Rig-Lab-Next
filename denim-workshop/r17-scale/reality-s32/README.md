# RF01 S3.2 — 牛仔源端只读试装

此目录位于独立试装分支，不代表原工作分支或main已安装。原入口preview-v3.html已内联相同R17.2渲染器并安装既有只读导出器；原shader/几何不改。

在此目录执行`python install.py status`检查；`python install.py uninstall`逐字恢复原发布包装器；`python install.py install`重新试装。已有未知改动时拒绝覆盖；命令不会提交Git、推送或合并。进入原工作分支时拒绝安装/卸载。INSTALL_LOCK.json记录所有输入和输出摘要。

原界面末尾“世界规范接口”可独立导出当前读数，不需要规范平台。实物厚度/Tex仍未知，生产安装及用户视觉验收仍未完成。
