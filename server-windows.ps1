$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$separatorChars = [char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
$rootPrefix = $root.TrimEnd($separatorChars) + [System.IO.Path]::DirectorySeparatorChar
$address = [System.Net.IPAddress]::Parse('127.0.0.1')
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.md'   = 'text/markdown; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.glb'  = 'model/gltf-binary'
  '.gltf' = 'model/gltf+json'
  '.wasm' = 'application/wasm'
}

function Get-FreePort {
  foreach ($candidate in 4173..4190) {
    $test = $null
    try {
      $test = [System.Net.Sockets.TcpListener]::new($address, $candidate)
      $test.Start()
      $test.Stop()
      return $candidate
    }
    catch {
      if ($test) {
        try { $test.Stop() } catch { }
      }
    }
  }
  throw 'No free local port was found between 4173 and 4190.'
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = 'text/plain; charset=utf-8',
    [bool]$SendBody = $true
  )

  $header = @(
    "HTTP/1.1 $Status $StatusText"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    'Cache-Control: no-cache'
    'Cross-Origin-Opener-Policy: same-origin'
    'Cross-Origin-Resource-Policy: same-origin'
    'X-Content-Type-Options: nosniff'
    'Connection: close'
    ''
    ''
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($SendBody -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

$port = Get-FreePort
$listener = [System.Net.Sockets.TcpListener]::new($address, $port)
$url = "http://127.0.0.1:$port/"

try {
  $listener.Start()
  Write-Host ''
  Write-Host 'Humanoid Rig Lab Next is running.' -ForegroundColor Green
  Write-Host $url -ForegroundColor Cyan
  Write-Host 'Keep this window open. Press Ctrl+C to stop the local server.'
  Write-Host ''
  Start-Process $url

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
      $requestLine = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') { }

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Bad Request')
        Send-Response -Stream $stream -Status 400 -StatusText 'Bad Request' -Body $body
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      if ($method -ne 'GET' -and $method -ne 'HEAD') {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
        Send-Response -Stream $stream -Status 405 -StatusText 'Method Not Allowed' -Body $body
        continue
      }

      $rawPath = $parts[1].Split('?')[0]
      $relativePath = [System.Uri]::UnescapeDataString($rawPath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = 'index.html'
      }
      $relativePath = $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))

      if (Test-Path -LiteralPath $fullPath -PathType Container) {
        $fullPath = Join-Path $fullPath 'index.html'
      }

      $insideRoot = $fullPath.Equals($root, [System.StringComparison]::OrdinalIgnoreCase) -or $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
      if (-not $insideRoot -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        Send-Response -Stream $stream -Status 404 -StatusText 'Not Found' -Body $body -SendBody ($method -ne 'HEAD')
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($fullPath)
      $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }
      Send-Response -Stream $stream -Status 200 -StatusText 'OK' -Body $body -ContentType $contentType -SendBody ($method -ne 'HEAD')
    }
    catch {
      Write-Warning $_.Exception.Message
    }
    finally {
      if ($reader) { $reader.Dispose() }
      if ($client) { $client.Close() }
    }
  }
}
finally {
  if ($listener) { $listener.Stop() }
}
