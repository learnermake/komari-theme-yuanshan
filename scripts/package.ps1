param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\yuanshan-theme.zip')
)

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputPath = [System.IO.Path]::GetFullPath($OutputPath)
$temporaryPath = "$outputPath.tmp.zip"

if (Test-Path -LiteralPath $temporaryPath) {
  Remove-Item -LiteralPath $temporaryPath -Force
}

# tar stores archive names with POSIX separators. Compress-Archive stores Windows
# backslashes, which Komari on Linux cannot resolve as dist/index.html.
tar.exe -a -c -f $temporaryPath -C $projectRoot komari-theme.json dist preview.jpg
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to create the theme archive.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($temporaryPath)
try {
  $entries = $archive.Entries.FullName
  $hasManifest = $entries -contains 'komari-theme.json'
  $hasEntry = $entries -contains 'dist/index.html'
  $hasWindowsPaths = ($entries | Where-Object { $_.Contains('\') }).Count -gt 0
  if (-not $hasManifest -or -not $hasEntry -or $hasWindowsPaths) {
    throw 'Invalid theme archive: expected root manifest and dist/index.html with POSIX paths.'
  }
} finally {
  $archive.Dispose()
}

Move-Item -LiteralPath $temporaryPath -Destination $outputPath -Force
Write-Output "Created $outputPath"
