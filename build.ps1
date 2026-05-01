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
Write-Host "[1/3] Build du frontend React..." -ForegroundColor Yellow
Set-Location "$ROOT\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "      Installation des dépendances npm..." -ForegroundColor Gray
    npm install
}

npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build frontend échoué"; exit 1 }
Write-Host "[✓] Frontend buildé" -ForegroundColor Green

# --- 2. Copier le build dans backend/web ---
Write-Host "[2/3] Copie du build dans backend/web..." -ForegroundColor Yellow
$webDest = "$ROOT\backend\web"
if (Test-Path $webDest) { Remove-Item -Recurse -Force $webDest }
Copy-Item -Recurse "$ROOT\frontend\dist" $webDest
Write-Host "[✓] Fichiers copiés dans backend/web" -ForegroundColor Green

# --- 3. Build Backend Go ---
Write-Host "[3/3] Compilation Go → cyber-hub.exe..." -ForegroundColor Yellow
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
