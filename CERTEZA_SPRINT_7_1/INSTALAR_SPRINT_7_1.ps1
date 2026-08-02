$ErrorActionPreference = "Stop"

$paquete = Split-Path -Parent $MyInvocation.MyCommand.Path
$proyecto = Split-Path -Parent $paquete

if (-not (Test-Path (Join-Path $proyecto "package.json"))) {
  Write-Host "No se encontro package.json en la carpeta superior." -ForegroundColor Red
  Write-Host "Extrae CERTEZA_SPRINT_7_1 dentro de la raiz del proyecto y ejecuta de nuevo." -ForegroundColor Yellow
  exit 1
}

Write-Host "Instalando correccion Sprint 7.1..." -ForegroundColor Cyan

$archivos = @(
  "auth.ts",
  "app\api\auth\[...nextauth]\route.ts",
  "app\login\actions.ts",
  "app\login\login-form.tsx",
  "app\login\page.tsx",
  "app\panel\layout.tsx",
  "types\next-auth.d.ts"
)

foreach ($relativo in $archivos) {
  $origen = Join-Path $paquete $relativo
  $destino = Join-Path $proyecto $relativo
  $carpetaDestino = Split-Path -Parent $destino
  New-Item -ItemType Directory -Force -Path $carpetaDestino | Out-Null
  Copy-Item -LiteralPath $origen -Destination $destino -Force
  Write-Host "Copiado: $relativo" -ForegroundColor Green
}

$proxy = Join-Path $proyecto "proxy.ts"
$middleware = Join-Path $proyecto "middleware.ts"
if (Test-Path $proxy) { Remove-Item $proxy -Force }
if (Test-Path $middleware) { Remove-Item $middleware -Force }

$siguiente = Join-Path $proyecto ".next"
if (Test-Path $siguiente) { Remove-Item $siguiente -Recurse -Force }

Write-Host "" 
Write-Host "Sprint 7.1 instalado." -ForegroundColor Green
Write-Host "Ahora ejecuta desde la raiz del proyecto:" -ForegroundColor Cyan
Write-Host "  npm run dev"
Write-Host "Despues abre: http://localhost:3000/login"
