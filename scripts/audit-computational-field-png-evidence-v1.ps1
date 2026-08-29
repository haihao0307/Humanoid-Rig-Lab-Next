param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$screenshotDirectory = Join-Path $RepositoryRoot 'artifacts\qa\task18a-computational-human-field-v1\screenshots'
$outputPath = Join-Path $RepositoryRoot 'artifacts\qa\task18a-computational-human-field-v1\png-content-audit.json'
$files = @()
Get-ChildItem -LiteralPath $screenshotDirectory -Filter '*.png' | Sort-Object Name | ForEach-Object {
  $bitmap = [System.Drawing.Bitmap]::FromFile($_.FullName)
  try {
    $width = $bitmap.Width
    $height = $bitmap.Height
    $background = $bitmap.GetPixel(0, 0).ToArgb()
    $different = 0
    $colors = New-Object 'System.Collections.Generic.HashSet[int]'
    for ($y = 0; $y -lt $height; $y += 8) {
      for ($x = 0; $x -lt $width; $x += 8) {
        $color = $bitmap.GetPixel($x, $y).ToArgb()
        [void]$colors.Add($color)
        if ($color -ne $background) { $different += 1 }
      }
    }
    $sampled = [math]::Ceiling($width / 8) * [math]::Ceiling($height / 8)
    $isContactSheet = $_.Name -like '*contact-sheet.png'
    $files += [ordered]@{
      name = $_.Name
      bytes = $_.Length
      width = $width
      height = $height
      sampledPixels = $sampled
      nonBackgroundSamples = $different
      distinctSampleColors = $colors.Count
      dimensionsPassed = if ($isContactSheet) { $width -ge 1400 -and $height -ge 1200 } else { $width -eq 950 -and $height -eq 800 }
      contentPassed = $different -ge 100 -and $colors.Count -ge 20
    }
  } finally {
    $bitmap.Dispose()
  }
}
$required = @(
  'field-a-pose-front.png','field-a-pose-side.png','field-a-pose-back.png','field-a-pose-three-quarter.png',
  'field-t-pose-front.png','field-shoulder-150.png','field-elbow-135.png','field-forearm-pronation.png','field-spine-twist.png','field-hip-90.png','field-deep-squat.png','field-knee-135.png',
  'field-head-face-closeup.png','field-shoulder-axilla-closeup.png','field-elbow-closeup.png','field-hand-closeup.png','field-chest-waist-closeup.png','field-pelvis-groin-closeup.png','field-knee-closeup.png','field-ankle-foot-closeup.png',
  'field-normal-debug.png','field-region-debug.png','field-gradient-debug.png','inverse-warp-debug.png','jacobian-debug.png','pose-corrective-debug.png',
  'reference-vs-field-front.png','reference-vs-field-side.png','reference-vs-field-three-quarter.png',
  'computational-field-contact-sheet.png','nine-pose-contact-sheet.png','field-debug-contact-sheet.png'
)
$names = @($files | ForEach-Object { $_.name })
$missing = @($required | Where-Object { $_ -notin $names })
$report = [ordered]@{
  schema = 'humanoid_rig/task18a_png_content_audit@1.0'
  method = 'System.Drawing PNG decode with dimensions and stride-8 color/content sampling; no visual acceptance asserted'
  requiredCount = $required.Count
  decodedCount = $files.Count
  missingFiles = $missing
  files = $files
  passed = $missing.Count -eq 0 -and $files.Count -eq $required.Count -and @($files | Where-Object { -not $_.dimensionsPassed -or -not $_.contentPassed }).Count -eq 0
  task18aVisualAcceptance = $false
  visualAcceptance = $false
  productionReady = $false
  userVisualAcceptance = 'pending'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outputPath -Encoding utf8
$report | ConvertTo-Json -Depth 3
