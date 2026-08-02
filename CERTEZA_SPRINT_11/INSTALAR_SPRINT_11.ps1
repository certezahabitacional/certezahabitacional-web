$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$InstallerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadRoot = Join-Path $InstallerRoot "payload"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "respaldo-sprint-11-$Timestamp"

Write-Host "" 
Write-Host "CERTEZA HABITACIONAL - INSTALADOR SPRINT 11" -ForegroundColor Cyan
Write-Host "Proyecto: $ProjectRoot"

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "Ejecuta este instalador desde la raiz del proyecto, donde se encuentra package.json."
}

$SchemaPath = Join-Path $ProjectRoot "prisma\schema.prisma"
if (-not (Test-Path $SchemaPath)) {
  throw "No se encontro prisma\schema.prisma."
}

$Schema = Get-Content $SchemaPath -Raw
foreach ($RequiredModel in @("model Inspeccion", "model Hallazgo", "model Fotografia")) {
  if (-not $Schema.Contains($RequiredModel)) {
    throw "El esquema de Prisma no contiene '$RequiredModel'. Instala y valida primero los Sprints 9 y 10."
  }
}

$Files = Get-ChildItem -Path $PayloadRoot -Recurse -File -Filter "*.txt"
if ($Files.Count -eq 0) {
  throw "El paquete no contiene archivos de instalacion."
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

foreach ($File in $Files) {
  $Relative = $File.FullName.Substring($PayloadRoot.Length + 1)
  $Relative = $Relative.Substring(0, $Relative.Length - 4)
  $Target = Join-Path $ProjectRoot $Relative

  if (Test-Path $Target) {
    $BackupTarget = Join-Path $BackupRoot $Relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $BackupTarget) -Force | Out-Null
    Copy-Item $Target $BackupTarget -Force
  }

  New-Item -ItemType Directory -Path (Split-Path -Parent $Target) -Force | Out-Null
  Copy-Item $File.FullName $Target -Force
  Write-Host "Instalado: $Relative" -ForegroundColor DarkGray
}

Write-Host "" 
Write-Host "Regenerando Prisma..." -ForegroundColor Yellow
& npx prisma@6.16.2 generate
if ($LASTEXITCODE -ne 0) {
  throw "No fue posible regenerar Prisma. El respaldo esta en $BackupRoot"
}

if (Test-Path (Join-Path $ProjectRoot ".next")) {
  Remove-Item (Join-Path $ProjectRoot ".next") -Recurse -Force
}

Write-Host "Compilando el proyecto..." -ForegroundColor Yellow
& npm run build
if ($LASTEXITCODE -ne 0) {
  throw "La compilacion fallo. Revisa el error mostrado. El respaldo esta en $BackupRoot"
}

Write-Host "" 
Write-Host "SPRINT_11_INSTALADO" -ForegroundColor Green
Write-Host "Respaldo: $BackupRoot"
Write-Host "Ejecuta: npm run dev"
Write-Host "Despues abre una inspeccion y usa Capturar inspeccion."
