[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $root 'native-host\bin'
$output = Join-Path $outputDirectory 'codex-firefox-bridge.exe'
$pathFile = Join-Path $outputDirectory 'original-host.path'
$manifestPath = Join-Path $outputDirectory 'com.simonrendon.zen_browser_use_secure.json'
$chromeRegistryPath = 'Registry::HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.openai.codexextension'
$firefoxRegistryPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\com.simonrendon.zen_browser_use_secure'

$chromeManifestPath = (Get-ItemProperty -LiteralPath $chromeRegistryPath).'(default)'
if ([string]::IsNullOrWhiteSpace($chromeManifestPath) -or -not (Test-Path -LiteralPath $chromeManifestPath)) {
  throw 'The installed OpenAI Chrome native-host manifest could not be found.'
}

$chromeManifest = Get-Content -LiteralPath $chromeManifestPath -Raw | ConvertFrom-Json
$originalHost = [string]$chromeManifest.path
if (-not (Test-Path -LiteralPath $originalHost -PathType Leaf)) {
  throw "The OpenAI extension host does not exist at '$originalHost'."
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
  $cargoPath = Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
  if (Test-Path -LiteralPath $cargoPath) {
    $cargo = Get-Item -LiteralPath $cargoPath
  }
}
if (-not $cargo) {
  throw 'Rust/Cargo is required for a development build. Release users should run the companion installer.'
}
$cargoExecutable = if ($cargo.Source) { $cargo.Source } else { $cargo.FullName }
& $cargoExecutable build --release --locked --manifest-path (Join-Path $root 'native-host\Cargo.toml')
if ($LASTEXITCODE -ne 0) { throw 'The Firefox companion failed to compile.' }
Copy-Item -LiteralPath (Join-Path $root 'native-host\target\release\codex-firefox-bridge.exe') -Destination $output -Force

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($pathFile, $originalHost + [Environment]::NewLine, $utf8NoBom)
$firefoxManifest = [ordered]@{
  name = 'com.simonrendon.zen_browser_use_secure'
  description = 'Secure Browser Use native-messaging bridge for Zen'
  path = $output
  type = 'stdio'
  allowed_extensions = @('{2ed87dbc-332c-4f85-9655-bd6e7b932d43}')
}
$firefoxManifestJson = $firefoxManifest | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($manifestPath, $firefoxManifestJson + [Environment]::NewLine, $utf8NoBom)

New-Item -Path $firefoxRegistryPath -Force | Out-Null
Set-Item -LiteralPath $firefoxRegistryPath -Value $manifestPath

[pscustomobject]@{
  Adapter = $output
  OriginalHost = $originalHost
  FirefoxManifest = $manifestPath
  ExtensionId = '{2ed87dbc-332c-4f85-9655-bd6e7b932d43}'
}
