$ErrorActionPreference = 'Stop'
$moduleFolder = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$root = [System.IO.Path]::GetFullPath((Join-Path $moduleFolder '..\..\..'))
$pidPath = Join-Path $moduleFolder 'skin-v002-server.pid'

if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Host 'No SKIN V002 server PID file was found.'
  exit 0
}

$serverPid = [int](Get-Content -LiteralPath $pidPath -Raw).Trim()
$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid" -ErrorAction SilentlyContinue
if ($processInfo -and $processInfo.CommandLine -match 'server\.mjs' -and $processInfo.CommandLine -match 'skin-v002-single-surface-guard') {
  Stop-Process -Id $serverPid -Force
  Write-Host "Stopped SKIN V002 server process $serverPid."
}
else {
  Write-Host "PID $serverPid does not carry the SKIN V002 launch token. No process was stopped."
}
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
