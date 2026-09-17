# SoundPulse - 1-Click Launch Script
# Starts a lightweight local HTTP server and opens SoundPulse in your default browser.

$port = 8080
$path = $PSScriptRoot
if (-not $path) { $path = Get-Location }

# Test if port is available, or find next
while ($true) {
    $listenerTest = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if (-not $listenerTest) { break }
    $port++
}

$url = "http://localhost:$port/"
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host " SoundPulse - Fully Online Ad-Free Music App" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "Starting server at $url" -ForegroundColor Green
Write-Host "Serving files from $path" -ForegroundColor Gray
Write-Host "Press Ctrl+C at any time to stop the server." -ForegroundColor Yellow
Write-Host ""

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
} catch {
    Write-Host "Could not start HttpListener on $url. Trying fallback browser open..." -ForegroundColor Red
    Start-Process "msedge" "$path\index.html"
    exit
}

# Open browser
Start-Process $url

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($rawUrl)) { $rawUrl = "index.html" }
        $filePath = Join-Path $path $rawUrl

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
