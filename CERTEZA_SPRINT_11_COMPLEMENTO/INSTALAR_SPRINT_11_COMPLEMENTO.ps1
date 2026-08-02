$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$package = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $root "respaldo-sprint-11-complemento-$stamp"

if (-not (Test-Path (Join-Path $root "package.json"))) {
  throw "Ejecuta este instalador desde la raiz del proyecto Certeza Habitacional."
}

New-Item -ItemType Directory -Force -Path $backup | Out-Null

$targets = @(
  "app\panel\inspecciones\page.tsx",
  "app\panel\inspecciones\[id]\page.tsx",
  "app\panel\inspecciones\[id]\actions.ts",
  "app\panel\inspecciones\[id]\editar\page.tsx",
  "app\panel\inspecciones\[id]\editar\actions.ts"
)

foreach ($target in $targets) {
  $sourceExisting = Join-Path $root $target
  if (Test-Path -LiteralPath $sourceExisting) {
    $backupTarget = Join-Path $backup $target
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupTarget) | Out-Null
    Copy-Item -LiteralPath $sourceExisting -Destination $backupTarget -Force
  }
}

$files = @(
  @{ Source = "payload\app\panel\inspecciones\page.tsx.txt"; Target = "app\panel\inspecciones\page.tsx" },
  @{ Source = "payload\app\panel\inspecciones\[id]\page.tsx.txt"; Target = "app\panel\inspecciones\[id]\page.tsx" },
  @{ Source = "payload\app\panel\inspecciones\[id]\actions.ts.txt"; Target = "app\panel\inspecciones\[id]\actions.ts" },
  @{ Source = "payload\app\panel\inspecciones\[id]\editar\page.tsx.txt"; Target = "app\panel\inspecciones\[id]\editar\page.tsx" },
  @{ Source = "payload\app\panel\inspecciones\[id]\editar\actions.ts.txt"; Target = "app\panel\inspecciones\[id]\editar\actions.ts" }
)

foreach ($file in $files) {
  $source = Join-Path $package $file.Source
  $target = Join-Path $root $file.Target
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

if (Test-Path (Join-Path $root ".next")) {
  Remove-Item (Join-Path $root ".next") -Recurse -Force
}

Write-Host "Archivos instalados. Ejecutando validacion..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "La compilacion fallo. El respaldo esta en $backup"
}

Write-Host "SPRINT_11_COMPLEMENTO_INSTALADO" -ForegroundColor Green
Write-Host "Respaldo: $backup" -ForegroundColor Yellow
