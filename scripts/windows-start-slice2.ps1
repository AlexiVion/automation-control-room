[CmdletBinding()]
param(
    [ValidateRange(1024,65535)][int]$Port = 3300,
    [string]$Project = "acrphase5local",
    [switch]$NoBrowser
)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$compose = "ops/compose/product.yml"
Set-Location $repo

function Assert-Exit([string]$Name) {
    if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit code $LASTEXITCODE)" }
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop is required."
}
$dockerOS = (& docker info --format '{{.OSType}}').Trim()
Assert-Exit "Docker info"
if ($dockerOS -ne "linux") { throw "Switch Docker Desktop to Linux containers." }
$env:ACR_WEB_PORT = "$Port"
$origin = "http://localhost:$Port"

Write-Host "[1/6] Validate local-only Docker Compose" -ForegroundColor Cyan
docker compose -p $Project -f $compose config --quiet
Assert-Exit "Compose configuration"

Write-Host "[2/6] Build ONE image (Windows Docker Desktop safe)" -ForegroundColor Cyan
$shared = "${Project}-shared:slice2"
docker build -f ops/compose/Dockerfile.product -t $shared .
Assert-Exit "Shared image build"

Write-Host "[3/6] Tag all four processes to reuse one image" -ForegroundColor Cyan
foreach ($service in @("migrate", "api", "worker", "web")) {
    docker image tag $shared "${Project}-${service}:latest"
    Assert-Exit "Tag $service"
}

Write-Host "[4/6] Migrate and start web/API/worker (preserve PostgreSQL volume)" -ForegroundColor Cyan
docker compose -p $Project -f $compose up --no-build --force-recreate -d --wait --wait-timeout 180 web worker
if ($LASTEXITCODE -ne 0) {
    docker compose -p $Project -f $compose ps -a
    docker compose -p $Project -f $compose logs --tail 100
    throw "Slice 2 product startup failed"
}
$actualOrigin = (& docker compose -p $Project -f $compose exec -T api printenv ACR_ALLOWED_ORIGINS).Trim()
Assert-Exit "Read allowed origin"
if ($actualOrigin -ne $origin) { throw "Origin mismatch: expected $origin, got $actualOrigin" }

Write-Host "[5/6] Real HTTP smoke (history, metrics, approval, CRM, isolation)" -ForegroundColor Cyan
docker compose -p $Project -f $compose exec -T `
    -e ACR_API_BASE=http://api:3100 `
    -e ACR_WEB_BASE=http://web:3000 `
    -e "ACR_ORIGIN=$origin" `
    api npm run test:product
if ($LASTEXITCODE -ne 0) {
    docker compose -p $Project -f $compose logs --tail 120
    throw "Slice 2 HTTP smoke failed"
}

Write-Host "[6/6] Unit tests for history cursors and graph states" -ForegroundColor Cyan
docker compose -p $Project -f $compose exec -T api npm run test:history
Assert-Exit "History cursor tests"
docker compose -p $Project -f $compose exec -T api npm run test:canvas
Assert-Exit "Canvas state tests"

Write-Host ""
Write-Host "SLICE2_WINDOWS_PASS" -ForegroundColor Green
Write-Host "URL: $origin"
Write-Host "Commit: $((& git rev-parse HEAD).Trim())"
Write-Host "Database volume preserved." -ForegroundColor Green
docker compose -p $Project -f $compose ps
if (-not $NoBrowser) { Start-Process $origin }
