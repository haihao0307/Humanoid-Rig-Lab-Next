[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [ValidateSet('chrome', 'msedge', 'chromium')]
    [string]$BrowserChannel,
    [switch]$Headed,
    [string]$OutputDirectory,
    [switch]$KeepServer
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$defaultOutput = Join-Path $projectRoot 'artifacts\qa\human-core-v5-procedural-deform'
$qaOutput = if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { $defaultOutput } else { [System.IO.Path]::GetFullPath($OutputDirectory) }
$logRoot = Join-Path $projectRoot 'artifacts\logs\procedural-deform-browser-qa'
$launcherLog = Join-Path $logRoot 'windows-launcher.log'
$serverStdout = Join-Path $logRoot 'manual-server.stdout.log'
$serverStderr = Join-Path $logRoot 'manual-server.stderr.log'
$serverPidFile = Join-Path $logRoot 'manual-server.pid'

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

function Write-QALog {
    param([string]$Message)
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    Add-Content -LiteralPath $launcherLog -Value $line -Encoding UTF8
}

function Invoke-QACommand {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    Write-QALog ("Running: {0} {1}" -f $Executable, ($Arguments -join ' '))
    & $Executable @Arguments 2>&1 | Tee-Object -FilePath $launcherLog -Append
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Executable $($Arguments -join ' ')"
    }
}

try {
    Set-Location -LiteralPath $projectRoot
    Write-QALog "Project root: $projectRoot"
    Write-QALog ("Commit: {0}" -f (& git rev-parse HEAD))

    $nodeText = (& node --version 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeText)) {
        throw 'Node.js was not found. Required: Node 22 or newer. Install with: winget install OpenJS.NodeJS.LTS'
    }
    $nodeVersion = [version]($nodeText.TrimStart('v').Split('-')[0])
    if ($nodeVersion.Major -lt 22) {
        throw "Current Node version: $nodeVersion. Required: Node 22 or newer. Upgrade with: winget install OpenJS.NodeJS.LTS. QA stopped before browser launch."
    }
    Write-QALog "Node version: $nodeVersion (required: 22 or newer)"

    $npmText = (& npm --version 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($npmText)) {
        throw 'npm was not found next to Node.js. Reinstall the Node.js LTS package.'
    }
    Write-QALog "npm version: $npmText"

    $playwrightPackage = Join-Path $projectRoot 'node_modules\playwright\package.json'
    if (-not $SkipInstall -and -not (Test-Path -LiteralPath $playwrightPackage)) {
        Invoke-QACommand -Executable 'npm' -Arguments @('ci', '--no-audit', '--no-fund')
    }
    elseif ($SkipInstall -and -not (Test-Path -LiteralPath $playwrightPackage)) {
        throw 'Pinned Playwright dependency is missing and -SkipInstall was used. Run without -SkipInstall once.'
    }

    $chromiumExecutable = & node -e "import('playwright').then(({chromium})=>console.log(chromium.executablePath()))"
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($chromiumExecutable) -or -not (Test-Path -LiteralPath $chromiumExecutable.Trim())) {
        if ($SkipInstall) {
            throw 'Playwright Chromium is missing and -SkipInstall was used. Run: npx playwright install chromium'
        }
        Invoke-QACommand -Executable 'npx' -Arguments @('playwright', 'install', 'chromium')
    }

    $runnerArguments = @(
        'run', 'test:human-core-v5-procedural-deform-browser', '--',
        '--all-backends', '--continue-on-webgpu-failure', '--output', $qaOutput
    )
    if ($Headed) { $runnerArguments += '--headed' } else { $runnerArguments += '--headless' }
    if (-not [string]::IsNullOrWhiteSpace($BrowserChannel)) {
        $runnerArguments += @('--browser-channel', $BrowserChannel)
    }

    Invoke-QACommand -Executable 'npm' -Arguments $runnerArguments
    Invoke-QACommand -Executable 'npm' -Arguments @('run', 'test:human-core-v5-procedural-deform-qa', '--', '--output', $qaOutput)

    $gallery = Join-Path $qaOutput 'visual-review-gallery.html'
    if (-not (Test-Path -LiteralPath $gallery)) {
        throw "Visual review gallery was not generated: $gallery"
    }

    if ($KeepServer) {
        $server = Start-Process -FilePath 'node' -ArgumentList @('server.mjs') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serverStdout -RedirectStandardError $serverStderr -PassThru
        Start-Sleep -Seconds 2
        if ($server.HasExited) {
            throw "Manual review server exited early. See $serverStderr"
        }
        Set-Content -LiteralPath $serverPidFile -Value $server.Id -Encoding ASCII
        Write-QALog "Manual review server remains available at http://127.0.0.1:4173/ (PID $($server.Id))."
    }

    Write-QALog "Opening offline QA gallery: $gallery"
    Start-Process -FilePath $gallery
    Write-QALog 'Automated contract finished. Visual acceptance remains pending until you inspect the gallery and export User Review JSON.'
    exit 0
}
catch {
    Write-QALog "FAILED: $($_.Exception.Message)"
    Write-QALog "Review logs in: $logRoot"
    exit 1
}
