$ErrorActionPreference = "Stop"

Write-Host "Instalando dependencias de Certeza Habitacional..." -ForegroundColor Cyan
npm install next-auth@beta @prisma/client bcryptjs zod
npm install -D prisma tsx

Write-Host "Generando cliente Prisma..." -ForegroundColor Cyan
npx prisma generate

Write-Host "Aplicando la primera migracion..." -ForegroundColor Cyan
npx prisma migrate dev --name inicio_nube

Write-Host "Creando usuario administrador..." -ForegroundColor Cyan
npx tsx prisma/seed.ts

Write-Host "Sprint 7 instalado. Ejecuta: npm run dev" -ForegroundColor Green
