# 上传到 GitHub

目标仓库：`haihao0307/Humanoid-Rig-Lab-Next`

## 推荐方式：GitHub Desktop

1. 解压完整文件包。
2. 在 GitHub Desktop 中选择“Add an Existing Repository from your Hard Drive”。
3. 选择本项目文件夹。
4. 仓库尚未初始化时，先选择“Create a repository”。
5. Repository URL 设置为目标仓库。
6. 提交全部文件并 Push origin。

## Windows 一键脚本

双击 `同步到GitHub.bat`。脚本只调用本机 Git 和 Git Credential Manager，不会保存账号密码或令牌。首次推送时 GitHub 可能打开浏览器要求登录授权。

## GitHub 网页上传

仓库为空时，可以在仓库页面选择“uploading an existing file”，将解压后的全部内容拖入上传区域并提交。网页上传不适合后续频繁迭代，后续优先使用 GitHub Desktop。

## Pages

文件推送到 main 后，进入仓库 Settings，打开 Pages，将 Source 设为 GitHub Actions。随后 Actions 中的 `Deploy review site to GitHub Pages` 会发布网站。
