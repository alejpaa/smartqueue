# Script de Inicio Rápido - SmartQueue SQA & Chaos Engineering

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "⚡ Iniciando Entorno de Desarrollo Local - SmartQueue ⚡" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Iniciar Docker Compose (PostgreSQL)
Write-Host "📦 1. Iniciando base de datos PostgreSQL en Docker..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Advertencia: Docker no parece estar ejecutándose. El backend usará SQLite automáticamente como fallback." -ForegroundColor Yellow
} else {
    Write-Host "✔ Contenedor PostgreSQL iniciado con éxito." -ForegroundColor Green
}
Write-Host ""

# 2. Iniciar Backend (FastAPI) en una nueva ventana de terminal
Write-Host "🚀 2. Iniciando Backend de FastAPI (nueva ventana)..." -ForegroundColor Green
$backendCmd = "cd backend; "
if ($LASTEXITCODE -eq 0) {
    # Si PostgreSQL está corriendo, configurar variable de entorno y poblar
    $backendCmd += "`$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/smartqueue'; uv run python -m app.seed; "
}
$backendCmd += "uv run uvicorn app.main:app --reload"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Write-Host "✔ Servidor Backend en ejecución." -ForegroundColor Green
Write-Host ""

# 3. Iniciar Frontend (Vite + React) en una nueva ventana de terminal
Write-Host "💻 3. Iniciando Frontend de React + Vite (nueva ventana)..." -ForegroundColor Yellow
$frontendCmd = "cd frontend; bun run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
Write-Host "✔ Servidor Frontend listo y abriendo navegador." -ForegroundColor Yellow
Write-Host ""

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "✨ ¡Todo se está ejecutando! Puedes interactuar con la app." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
