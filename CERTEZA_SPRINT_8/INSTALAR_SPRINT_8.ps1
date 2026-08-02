$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Split-Path -Parent $root

Write-Host "Instalando Sprint 8 en: $project" -ForegroundColor Cyan
Copy-Item "$root\app\panel\clientes" "$project\app\panel" -Recurse -Force
Copy-Item "$root\app\panel\inspectores" "$project\app\panel" -Recurse -Force
Copy-Item "$root\app\panel\agenda" "$project\app\panel" -Recurse -Force
Copy-Item "$root\app\panel\page.tsx" "$project\app\panel\page.tsx" -Force

Set-Location $project
npx prisma@6.16.2 generate
Write-Host "SPRINT_8_INSTALADO" -ForegroundColor Green
Write-Host "Ejecuta: npm run dev" -ForegroundColor Yellow
