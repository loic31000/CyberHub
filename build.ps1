# ============================================================
# Cyber-Hub — Script de build Windows
# Produit un seul fichier cyber-hub.exe
# USAGE LÉGAL UNIQUEMENT
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       CYBER-HUB — BUILD WINDOWS      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# --- 1. Build Frontend ---
Write-Host "[1/2] Build du frontend React..." -ForegroundColor Yellow
Set-Location "$ROOT\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "      Installation des dépendances npm..." -ForegroundColor Gray
    npm ci
}

npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build frontend échoué"; exit 1 }
Write-Host "[✓] Frontend buildé" -ForegroundColor Green

# Vite écrit directement dans backend/web ; ne pas effacer ses fichiers avant l'embed Go.
$webIndex = Join-Path $ROOT 'backend\web\index.html'
if (-not (Test-Path -LiteralPath $webIndex)) { Write-Error "Build frontend absent : $webIndex"; exit 1 }

# --- 2. Build Backend Go ---
Write-Host "[2/2] Compilation Go → cyber-hub.exe..." -ForegroundColor Yellow
Set-Location "$ROOT\backend"

go mod download
if ($LASTEXITCODE -ne 0) { Write-Error "go mod download échoué"; exit 1 }

$env:CGO_ENABLED = "0"
go build -ldflags="-s -w" -o "$ROOT\cyber-hub.exe" .
if ($LASTEXITCODE -ne 0) { Write-Error "Compilation Go échouée"; exit 1 }

Write-Host "[✓] cyber-hub.exe généré !" -ForegroundColor Green
Write-Host ""
Write-Host "══════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Lance l'application :" -ForegroundColor Green
Write-Host "   .\cyber-hub.exe" -ForegroundColor White
Write-Host " Puis ouvre : http://localhost:7743" -ForegroundColor White
Write-Host "══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Set-Location $ROOT
