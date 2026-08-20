$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$port = 4173
$address = [System.Net.IPAddress]::Parse('127.0.0.1')
$listener = [System.Net.Sockets.TcpListener]::new($address, $port)
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.glb'  = 'model/gltf-binary'
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = 'text/plain; charset=utf-8'
  )
  $header = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

try {
  $listener.Start()
  Write-Host "Humanoid Rig Lab is running at http://127.0.0.1:$port/" -ForegroundColor Green
  Write-Host 'Keep this window open. Press Ctrl+C to stop.'

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') { }

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2 -or $parts[0] -ne 'GET') {
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

      if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        Send-Response -Stream $stream -Status 404 -StatusText 'Not Found' -Body $body
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($fullPath)
      $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }
      Send-Response -Stream $stream -Status 200 -StatusText 'OK' -Body $body -ContentType $contentType
    }
    catch {
      Write-Warning $_.Exception.Message
    }
    finally {
      if ($client) { $client.Close() }
    }
  }
}
finally {
  $listener.Stop()
}
