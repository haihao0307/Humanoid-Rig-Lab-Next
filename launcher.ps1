$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$logPath = Join-Path $root 'launcher.log'
$diagnosticsPath = Join-Path $root 'startup-diagnostics.txt'
$expectedBuildId = 'four-module-v002-20260819'
Set-Location -LiteralPath $root

function Write-LauncherLog {
  param([string]$Message)
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

function Test-RigServer {
  param([int]$Port)
  try {
    $response = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/BUILD_MANIFEST.json" -f $Port) -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ne 200) {
      return $false
    }
    $manifest = $response.Content | ConvertFrom-Json
    return ($manifest.id -eq $expectedBuildId)
  }
  catch {
    return $false
  }
}

try {
  "Humanoid Rig Lab Next startup diagnostics" | Set-Content -LiteralPath $diagnosticsPath -Encoding UTF8
  ("Time: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) | Add-Content -LiteralPath $diagnosticsPath -Encoding UTF8
  ("Folder: " + $root) | Add-Content -LiteralPath $diagnosticsPath -Encoding UTF8
  ("PowerShell: " + $PSVersionTable.PSVersion.ToString()) | Add-Content -LiteralPath $diagnosticsPath -Encoding UTF8
  ("Windows: " + [System.Environment]::OSVersion.VersionString) | Add-Content -LiteralPath $diagnosticsPath -Encoding UTF8

  if (Test-RigServer -Port 4173) {
    Write-LauncherLog ('The expected build ' + $expectedBuildId + ' is already running on port 4173. Opening it now.')
    Start-Process 'http://127.0.0.1:4173/'
    exit 0
  }

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    $nodeVersionText = (& $nodeCommand.Source --version 2>$null).Trim()
    $nodeMajor = 0
    if ($nodeVersionText -match '^v([0-9]+)') {
      $nodeMajor = [int]$Matches[1]
    }
    ("Node: " + $nodeVersionText + " at " + $nodeCommand.Source) | Add-Content -LiteralPath $diagnosticsPath -Encoding UTF8

    if ($nodeMajor -ge 18) {
      $threeRuntime = Join-Path $root 'node_modules\three\build\three.webgpu.js'
      if (-not (Test-Path -LiteralPath $threeRuntime)) {
        $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if ($npmCommand) {
          Write-LauncherLog 'Three.js local 3D runtime is missing. Installing locked version 0.185.1 once.'
          & $npmCommand.Source install --no-audit --no-fund 2>&1 | Tee-Object -FilePath $logPath -Append
          if ($LASTEXITCODE -ne 0) {
            Write-LauncherLog 'Three.js local installation failed. The site will still try the online CDN fallback.'
          }
        }
        else {
          Write-LauncherLog 'npm.cmd was not found. The site will try the online Three.js CDN fallback.'
        }
      }
      Write-LauncherLog ("Using Node.js " + $nodeVersionText + ". Keep this window open while reviewing the site.")
      & $nodeCommand.Source (Join-Path $root 'server.mjs') 2>&1 | Tee-Object -FilePath $logPath -Append
      $nodeExit = $LASTEXITCODE
      if ($nodeExit -eq 0) {
        exit 0
      }
      Write-LauncherLog ("Node server stopped with exit code " + $nodeExit + ". Trying the built-in PowerShell server.")
    }
    else {
      Write-LauncherLog ("Node.js is older than version 18. Using the built-in PowerShell server.")
    }
  }
  else {
    'Node: not found' | Add-Content -LiteralPath $diagnosticsPath -Encoding UTF8
    Write-LauncherLog 'Node.js was not found. Using the built-in PowerShell server.'
  }

  & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'server-windows.ps1')
  exit $LASTEXITCODE
}
catch {
  $message = $_.Exception.ToString()
  Write-Host ''
  Write-Host 'Startup error:' -ForegroundColor Red
  Write-Host $message -ForegroundColor Red
  Add-Content -LiteralPath $logPath -Value $message -Encoding UTF8
  Add-Content -LiteralPath $diagnosticsPath -Value $message -Encoding UTF8
  exit 1
}
