$ErrorActionPreference = 'Stop'
$atlasRoot = Split-Path -Parent $PSScriptRoot
$atlasHtml = Join-Path $atlasRoot '打开动物集成工作台.html'
if (-not (Test-Path -LiteralPath $atlasHtml)) { throw '先运行 npm run build 生成工作台。' }
$atlasDist = Join-Path $atlasRoot 'dist'
New-Item -ItemType Directory -Path $atlasDist -Force | Out-Null
$atlasReadme = Join-Path $atlasDist 'OFFLINE_README.txt'
@'
动物工作台 V1.2

解压后，使用支持 WebGL2 的 Chrome 或 Edge 打开“打开动物集成工作台.html”。
所有动物、运行时和缩略图已经内嵌，无需联网或启动服务器。
首次加载及大型模型切换可能需要几秒。

左侧分类与目录，中央鼠标拖动观察，最右侧调整对象参数及展示光线。
收藏、删除、导入和导出在界面中直接可用；导入格式要求可在导入窗口展开查看。
新增动物与参数保存在当前浏览器，换浏览器时请导出靠谱动物包。
右上角新增排练台，可放入多个动物当前形态，调整位置、大小、关系与光线。
默认导出靠谱烘焙文件；排练台可导出独立 HTML 或完整排练谱。
排练关系为人工编排的整体运动，原骨骼动作在单动物工作台演示。

源码、来源清单、构建工具和验收记录保存在 GitHub 仓库的 animal-atlas 目录。
'@ | Set-Content -LiteralPath $atlasReadme -Encoding utf8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$atlasZip = Join-Path $atlasDist 'animal-atlas-v1.2.0-offline.zip'
$atlasStream = [System.IO.File]::Open($atlasZip, [System.IO.FileMode]::Create)
$atlasArchive = [System.IO.Compression.ZipArchive]::new($atlasStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($atlasArchive, $atlasHtml, '打开动物集成工作台.html', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($atlasArchive, $atlasReadme, 'OFFLINE_README.txt', [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
} finally { $atlasArchive.Dispose(); $atlasStream.Dispose() }
$atlasManifest = [ordered]@{
    version = '1.2.0'
    html = [ordered]@{ file = '打开动物集成工作台.html'; bytes = (Get-Item -LiteralPath $atlasHtml).Length; sha256 = (Get-FileHash -LiteralPath $atlasHtml -Algorithm SHA256).Hash.ToLowerInvariant() }
    archive = [ordered]@{ file = 'animal-atlas-v1.2.0-offline.zip'; bytes = (Get-Item -LiteralPath $atlasZip).Length; sha256 = (Get-FileHash -LiteralPath $atlasZip -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$atlasManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $atlasDist 'OFFLINE_MANIFEST.json') -Encoding utf8
$atlasManifest | ConvertTo-Json -Depth 4
