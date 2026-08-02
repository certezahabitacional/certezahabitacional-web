$ErrorActionPreference = "Stop"

$projectRoot = (Get-Location).Path
$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesRoot = Join-Path $packageRoot "files"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $projectRoot "respaldo-etapa-12-$timestamp"

Write-Host "Creando respaldo en $backup"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$targets = @(
  "app\api\inspecciones\[id]\route.ts",
  "app\api\inspecciones\[id]\firmas\route.ts",
  "app\panel\inspecciones\[id]\firmas\page.tsx"
)

foreach ($relative in $targets) {
  $source = Join-Path $filesRoot $relative
  $destination = Join-Path $projectRoot $relative

  if (Test-Path -LiteralPath $destination) {
    $backupFile = Join-Path $backup $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupFile) | Out-Null
    Copy-Item -LiteralPath $destination -Destination $backupFile -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}

Remove-Item (Join-Path $projectRoot ".next") -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Validando Prisma..."
& npx prisma@6.16.2 validate
if ($LASTEXITCODE -ne 0) { throw "Prisma no pudo validar el esquema." }

Write-Host "Regenerando Prisma Client..."
& npx prisma@6.16.2 generate
if ($LASTEXITCODE -ne 0) { throw "No fue posible regenerar Prisma Client." }

Write-Host "Compilando el proyecto..."
& npm run build
if ($LASTEXITCODE -ne 0) {
  throw "La compilacion fallo. El respaldo esta en $backup"
}

Write-Host ""
Write-Host "ETAPA_12_INSTALADA"
Write-Host "Firmas sincronizadas con Supabase."
Write-Host "Respaldo: $backup"
