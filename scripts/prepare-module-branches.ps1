$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $root

function Run-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed: git $($Args -join ' ')"
  }
}

if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
  throw 'Git for Windows was not found. Install Git or use GitHub Desktop.'
}

if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) {
  Run-Git init
  Run-Git branch -M main
}

$remote = (& git remote get-url origin 2>$null)
if (-not $remote) {
  Run-Git remote add origin 'https://github.com/haihao0307/Humanoid-Rig-Lab-Next.git'
}

Run-Git fetch origin --prune
Run-Git checkout main
Run-Git push -u origin main

$branches = @('integration', 'work/proportion', 'work/skin', 'work/pose', 'work/animation')
foreach ($branch in $branches) {
  & git show-ref --verify --quiet "refs/heads/$branch"
  if ($LASTEXITCODE -ne 0) {
    Run-Git branch $branch main
  }
  Run-Git push -u origin $branch
}

Write-Host ''
Write-Host 'Module branches are ready:' -ForegroundColor Green
$branches | ForEach-Object { Write-Host "  $_" }
Write-Host ''
Write-Host 'Use GitHub Desktop to switch branches and apply module patches.'
