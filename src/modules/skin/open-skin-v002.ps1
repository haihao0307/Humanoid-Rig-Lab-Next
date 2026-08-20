$ErrorActionPreference = 'Stop'
$moduleFolder = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$root = [System.IO.Path]::GetFullPath((Join-Path $moduleFolder '..\..\..'))
$expectedBuild = 'skin-v002-single-surface-guard'
$pidPath = Join-Path $moduleFolder 'skin-v002-server.pid'
$launcherLog = Join-Path $moduleFolder 'skin-v002-launch.log'
$serverLog = Join-Path $moduleFolder 'skin-v002-server.log'
$errorLog = Join-Path $moduleFolder 'skin-v002-launch-error.log'
$serverErrorLog = Join-Path $moduleFolder 'skin-v002-server-error.log'

function Write-ReviewLog {
  param([string]$Message)
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Write-Host $line
  Add-Content -LiteralPath $launcherLog -Value $line -Encoding UTF8
}

function Read-BuildId {
  param([int]$Port)
  try {
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $uri = "http://127.0.0.1:$Port/src/modules/skin/skin-build.json?ts=$stamp"
    $manifest = Invoke-RestMethod -Uri $uri -TimeoutSec 1
    return [string]$manifest.buildId
  }
  catch {
    return $null
  }
}

function Test-PortOpen {
  param([int]$Port)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne(220)) { return $false }
    $client.EndConnect($result)
    return $true
  }
  catch {
    return $false
  }
  finally {
    $client.Close()
  }
}

function Ensure-ThreeRuntime {
  $runtimePath = Join-Path $root 'node_modules\three\build\three.webgpu.js'
  if (Test-Path -LiteralPath $runtimePath) {
    Write-ReviewLog 'Locked local Three.js runtime 0.185.1 is ready.'
    return
  }

  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) {
    Write-ReviewLog 'npm.cmd was not found. The editor will use its online Three.js fallback.'
    return
  }

  Write-ReviewLog 'Installing locked local Three.js runtime 0.185.1 for this extracted workspace.'
  Push-Location -LiteralPath $root
  try {
    & $npm.Source install --no-audit --no-fund 2>&1 | ForEach-Object {
      $line = [string]$_
      Write-Host $line
      Add-Content -LiteralPath $launcherLog -Value $line -Encoding UTF8
    }
    if ($LASTEXITCODE -ne 0) {
      Write-ReviewLog 'Local Three.js installation failed. The editor will still try its online fallback.'
    }
  }
  finally {
    Pop-Location
  }
}

try {
  Set-Location -LiteralPath $root
  Remove-Item -LiteralPath $errorLog, $serverErrorLog, $serverLog -Force -ErrorAction SilentlyContinue
  "SKIN V002 verified launcher" | Set-Content -LiteralPath $launcherLog -Encoding UTF8
  Write-ReviewLog "Workspace: $root"

  $port = $null
  $reuse = $false
  foreach ($candidate in 4192..4210) {
    $servedBuild = Read-BuildId -Port $candidate
    if ($servedBuild -eq $expectedBuild) {
      $port = $candidate
      $reuse = $true
      Write-ReviewLog "Reusing verified SKIN V002 server on port $candidate."
      break
    }
    if (-not (Test-PortOpen -Port $candidate)) {
      $port = $candidate
      break
    }
    Write-ReviewLog "Port $candidate belongs to another process or build. It will not be reused."
  }
  if (-not $port) { throw 'No free verified review port was found from 4192 through 4210.' }

  if (-not $reuse) {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js was not found. Install Node.js 18 or newer.' }
    $versionText = (& $node.Source --version).Trim()
    if ($versionText -notmatch '^v([0-9]+)' -or [int]$Matches[1] -lt 18) {
      throw "Node.js 18 or newer is required. Current version: $versionText"
    }

    Ensure-ThreeRuntime
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    $oldPort = $env:PORT
    $oldNoOpen = $env:NO_OPEN
    $env:PORT = [string]$port
    $env:NO_OPEN = '1'
    try {
      $process = Start-Process -FilePath $node.Source -ArgumentList 'server.mjs', '--skin-build=skin-v002-single-surface-guard' -WorkingDirectory $root -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog -PassThru
      Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ascii
    }
    finally {
      $env:PORT = $oldPort
      $env:NO_OPEN = $oldNoOpen
    }

    $ready = $false
    foreach ($attempt in 1..60) {
      Start-Sleep -Milliseconds 200
      if ((Read-BuildId -Port $port) -eq $expectedBuild) {
        $ready = $true
        break
      }
      if ($process.HasExited) { break }
    }
    if (-not $ready) {
      if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
      Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
      throw "The V002 server did not become ready on port $port. Review $serverErrorLog."
    }
    Write-ReviewLog "Started verified SKIN V002 server on port $port with PID $($process.Id)."
  }

  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $url = "http://127.0.0.1:$port/src/modules/skin/verify.html?build=$expectedBuild&ts=$stamp"
  Write-Host ''
  Write-Host 'SKIN V002 verified review entry' -ForegroundColor Green
  Write-Host "Project folder: $root"
  Write-Host "Review address: $url"
  Write-Host ''
  Start-Process $url
}
catch {
  $_.Exception.ToString() | Set-Content -LiteralPath $errorLog -Encoding UTF8
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
