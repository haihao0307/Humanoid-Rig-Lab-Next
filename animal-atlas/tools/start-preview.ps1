$ErrorActionPreference = 'Stop'
$AtlasRoot = Split-Path -Parent $PSScriptRoot
$AtlasUrl = 'http://127.0.0.1:8924/index.html'

function Test-AtlasService {
    try {
        $Reply = Invoke-RestMethod -Uri 'http://127.0.0.1:8924/health' -TimeoutSec 2
        return $Reply.app -eq 'animal-atlas'
    } catch { return $false }
}

if (Test-AtlasService) {
    Write-Output "Animal Atlas is already running: $AtlasUrl"
    exit 0
}
if (Get-NetTCPConnection -LocalPort 8924 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 8924 is occupied by another service. No process was stopped.'
}
$AtlasNode = (Get-Command node -ErrorAction Stop).Source
$AtlasScript = Join-Path $PSScriptRoot 'serve.mjs'
$AtlasLogs = Join-Path $AtlasRoot 'qa'
New-Item -ItemType Directory -Path $AtlasLogs -Force | Out-Null
$AtlasProcess = Start-Process -FilePath $AtlasNode -ArgumentList ('"' + $AtlasScript + '"') -WorkingDirectory $AtlasRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $AtlasLogs 'preview.out.log') -RedirectStandardError (Join-Path $AtlasLogs 'preview.err.log') -PassThru
for ($AtlasAttempt = 0; $AtlasAttempt -lt 30; $AtlasAttempt++) {
    if (Test-AtlasService) {
        Write-Output "Animal Atlas started (PID $($AtlasProcess.Id)): $AtlasUrl"
        exit 0
    }
    if ($AtlasProcess.HasExited) { throw "Preview exited. See $AtlasLogs\preview.err.log" }
    Start-Sleep -Milliseconds 250
}
throw "Preview did not become ready. See $AtlasLogs\preview.err.log"
