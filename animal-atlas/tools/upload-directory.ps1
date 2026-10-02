# Uses the existing Git credential helper; credentials never enter logs or files.
param([switch]$UpdateExistingDirectory,[string]$ExpectedDirectoryTree)
$ErrorActionPreference = 'Stop'
$atlasRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $atlasRoot
$atlasRepo = 'haihao0307/Humanoid-Rig-Lab-Next'
$atlasDestination = 'animal-atlas'
$atlasApi = "https://api.github.com/repos/$atlasRepo"
$atlasReply = "protocol=https`nhost=github.com`n`n" | git -c credential.interactive=never credential fill
if ($LASTEXITCODE -ne 0) { throw 'Git credential helper failed.' }
$atlasCredential = @{}
foreach ($line in $atlasReply) { $pair = $line -split '=', 2; if ($pair.Count -eq 2) { $atlasCredential[$pair[0]] = $pair[1] } }
if (-not $atlasCredential.password) { throw 'Missing GitHub credential.' }
$atlasHeaders = @{ Authorization = 'Bearer ' + $atlasCredential.password; Accept = 'application/vnd.github+json'; 'User-Agent' = 'AnimalAtlasDirectoryUploader'; 'X-GitHub-Api-Version' = '2022-11-28' }
$atlasReply = $null
$atlasCredential = $null
function Invoke-AtlasApi($method, $route, $body = $null) {
    $options = @{ Uri = "$atlasApi/$route"; Method = $method; Headers = $atlasHeaders; TimeoutSec = 240 }
    if ($null -ne $body) { $options.Body = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 12 -Compress)); $options.ContentType = 'application/json; charset=utf-8' }
    Invoke-RestMethod @options
}
$atlasAccount = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $atlasHeaders -TimeoutSec 30
if ($atlasAccount.login -ne 'haihao0307') { throw 'Credential belongs to a different GitHub account.' }
$atlasRef = Invoke-AtlasApi GET 'git/ref/heads/main'
$atlasBase = $atlasRef.object.sha
$atlasCommit = Invoke-AtlasApi GET "git/commits/$atlasBase"
$atlasOldTree = Invoke-AtlasApi GET "git/trees/$($atlasCommit.tree.sha)"
if ($atlasOldTree.tree.path -contains $atlasDestination) {
    $atlasPrevious = @($atlasOldTree.tree | Where-Object path -eq $atlasDestination)[0]
    if (-not $UpdateExistingDirectory -or -not $ExpectedDirectoryTree -or $atlasPrevious.sha -ne $ExpectedDirectoryTree) { throw 'Updating an existing directory requires explicit mode and its exact expected tree; concurrent edits are protected.' }
}
$atlasLocalHead = (git rev-parse HEAD).Trim()
$atlasLocalTree = (git rev-parse 'HEAD^{tree}').Trim()
$atlasRows = @(git -c core.quotePath=false ls-tree -r HEAD | ForEach-Object {
    if ($_ -notmatch '^(\d+) blob ([0-9a-f]+)\t(.+)$') { throw 'Unsupported local tree entry.' }
    $path = $Matches[3]
    $full = Join-Path $atlasRoot $path
    [pscustomobject]@{ path = $path; full = $full; mode = $Matches[1]; sha = $Matches[2]; bytes = (Get-Item -LiteralPath $full).Length }
})
if ($atlasRows.Where({ $_.bytes -ge 100MB }).Count) { throw 'File exceeds GitHub blob size limit.' }
$atlasInline = @($atlasRows | Where-Object { $_.bytes -le 524288 -and $_.path -notmatch '\.(png|jpg|jpeg|zip|part\d+)$' })
$atlasBlobs = @($atlasRows | Where-Object { $_.bytes -gt 524288 -or $_.path -match '\.(png|jpg|jpeg|zip|part\d+)$' } | Sort-Object bytes -Descending)
Write-Output "Uploading $($atlasRows.Count) files under $atlasDestination; $($atlasBlobs.Count) binary/large blobs. Base $atlasBase"
$atlasCache = Join-Path $atlasRoot 'qa/upload-blobs'
New-Item -ItemType Directory -Path $atlasCache -Force | Out-Null
$atlasBlobResults = @($atlasBlobs | ForEach-Object -Parallel {
    $row = $_
    $headers = $using:atlasHeaders
    $api = $using:atlasApi
    $cache = Join-Path $using:atlasCache ($row.sha + '.json')
    if (Test-Path -LiteralPath $cache) { Write-Host ('Reused uploaded ' + $row.path); return [pscustomobject]@{ path=$row.path; sha=$row.sha; mode=$row.mode } }
    $raw = [System.IO.File]::ReadAllBytes($row.full)
    $body = @{ content = [Convert]::ToBase64String($raw); encoding = 'base64' } | ConvertTo-Json -Compress
    $raw = $null
    $response = Invoke-RestMethod -Uri "$api/git/blobs" -Method POST -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 90
    if ($response.sha -ne $row.sha) { throw "Blob identity mismatch: $($row.path)" }
    @{sha=$response.sha; repository='haihao0307/Humanoid-Rig-Lab-Next'} | ConvertTo-Json -Compress | Set-Content -LiteralPath $cache -Encoding utf8
    Write-Host "Uploaded $($row.path) ($($row.bytes) bytes)"
    [pscustomobject]@{ path = $row.path; sha = $response.sha; mode = $row.mode }
} -ThrottleLimit 3)
if ($atlasBlobResults.Count -ne $atlasBlobs.Count) { throw 'Incomplete blob upload.' }
$atlasElements = [System.Collections.Generic.List[object]]::new()
if ($atlasPrevious) {
    $atlasPreviousFiles = Invoke-AtlasApi GET "git/trees/$($atlasPrevious.sha)?recursive=1"
    if ($atlasPreviousFiles.truncated) { throw 'Cannot safely reconcile a truncated previous directory.' }
    $atlasCurrentPaths = @($atlasRows.path)
    foreach ($row in $atlasPreviousFiles.tree) {
        if ($row.type -eq 'blob' -and $atlasCurrentPaths -notcontains $row.path) { $atlasElements.Add(@{ path = "$atlasDestination/$($row.path)"; mode = $row.mode; type = 'blob'; sha = $null }) }
    }
}
foreach ($row in $atlasInline) {
    $bytes = [System.IO.File]::ReadAllBytes($row.full)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $atlasElements.Add(@{ path = "$atlasDestination/$($row.path)"; mode = $row.mode; type = 'blob'; content = $content })
}
foreach ($row in $atlasBlobResults) { $atlasElements.Add(@{ path = "$atlasDestination/$($row.path)"; mode = $row.mode; type = 'blob'; sha = $row.sha }) }
$atlasNewTree = Invoke-AtlasApi POST 'git/trees' @{ base_tree = $atlasCommit.tree.sha; tree = $atlasElements.ToArray() }
$atlasRootTree = Invoke-AtlasApi GET "git/trees/$($atlasNewTree.sha)"
$atlasChild = @($atlasRootTree.tree | Where-Object path -eq $atlasDestination)
if ($atlasChild.Count -ne 1 -or $atlasChild[0].sha -ne $atlasLocalTree) { throw 'Uploaded directory differs from the local committed snapshot.' }
foreach ($row in $atlasOldTree.tree) {
    if ($row.path -eq $atlasDestination) { continue }
    $new = @($atlasRootTree.tree | Where-Object path -eq $row.path)
    if ($new.Count -ne 1 -or $new[0].sha -ne $row.sha -or $new[0].mode -ne $row.mode) { throw "Protected root changed: $($row.path)" }
}
$atlasCandidate = Invoke-AtlasApi POST 'git/commits' @{ message = $(if ($atlasPrevious) { 'Add animal warehouse contract, form baking and shared rehearsal stage' } else { 'Add animal-atlas v1.2 workbench, source and offline package' }); tree = $atlasNewTree.sha; parents = @($atlasBase) }
$atlasFresh = Invoke-AtlasApi GET 'git/ref/heads/main'
if ($atlasFresh.object.sha -ne $atlasBase) { throw 'Main advanced during upload; do not overwrite concurrent work.' }
$atlasPromoted = Invoke-AtlasApi PATCH 'git/refs/heads/main' @{ sha = $atlasCandidate.sha; force = $false }
if ($atlasPromoted.object.sha -ne $atlasCandidate.sha) { throw 'Remote ref update did not match uploaded commit.' }
$atlasVerified = Invoke-AtlasApi GET 'git/ref/heads/main'
if ($atlasVerified.object.sha -ne $atlasCandidate.sha) { throw 'Remote verification failed.' }
$atlasReceipt = [ordered]@{ passed = $true; repository = $atlasRepo; branch = 'main'; directory = $atlasDestination; baseSha = $atlasBase; headSha = $atlasCandidate.sha; localSnapshotSha = $atlasLocalHead; localTreeSha = $atlasLocalTree; remoteDirectoryTreeSha = $atlasChild[0].sha; files = $atlasRows.Count; existingRootPathsUnchanged = $true; forcePush = $false; url = "https://github.com/$atlasRepo/tree/main/$atlasDestination"; completedAt = [DateTime]::UtcNow.ToString('o') }
$atlasReceipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $atlasRoot 'qa/GITHUB_UPLOAD_REPORT.json') -Encoding utf8
$atlasHeaders.Clear()
$atlasReceipt | ConvertTo-Json -Depth 4
