param(
  [string]$Version = "0.185.1"
)

$ErrorActionPreference = "Stop"
$vendorDir = Join-Path $PSScriptRoot "vendor"
New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null

$files = @(
  @{
    Name = "three.webgpu.js"
    MinimumBytes = 1000000
    Urls = @(
      "https://cdn.jsdelivr.net/npm/three@$Version/build/three.webgpu.js",
      "https://unpkg.com/three@$Version/build/three.webgpu.js"
    )
  },
  @{
    Name = "three.core.js"
    MinimumBytes = 700000
    Urls = @(
      "https://cdn.jsdelivr.net/npm/three@$Version/build/three.core.js",
      "https://unpkg.com/three@$Version/build/three.core.js"
    )
  }
)

foreach ($file in $files) {
  $target = Join-Path $vendorDir $file.Name
  if ((Test-Path $target) -and ((Get-Item $target).Length -ge $file.MinimumBytes)) {
    Write-Host "$($file.Name) already exists."
    continue
  }

  $downloaded = $false
  foreach ($url in $file.Urls) {
    $temp = "$target.download"
    try {
      Write-Host "Downloading $($file.Name) from $url"
      if (Test-Path $temp) { Remove-Item $temp -Force }
      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $temp -TimeoutSec 90
      $size = (Get-Item $temp).Length
      if ($size -lt $file.MinimumBytes) {
        throw "Downloaded file is unexpectedly small: $size bytes"
      }
      Move-Item -Path $temp -Destination $target -Force
      $downloaded = $true
      break
    } catch {
      Write-Warning $_.Exception.Message
      if (Test-Path $temp) { Remove-Item $temp -Force }
    }
  }

  if (-not $downloaded) {
    throw "Unable to download $($file.Name)."
  }
}

Write-Host "Three.js $Version local WebGPU runtime is ready in vendor/."
