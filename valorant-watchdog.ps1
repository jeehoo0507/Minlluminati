# valorant-watchdog.ps1
# 발로란트 실행 중에는 대기, 종료되면 Docker 서버 자동 재시작
# 사용법: 발로란트 켜기 전에 이 스크립트 먼저 실행

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$valorantProcess = "VALORANT-Win64-Shipping"
$vanguardProcess = "vgc"

Write-Host "[Minlluminati Watchdog] 시작됨" -ForegroundColor Cyan
Write-Host "발로란트가 종료되면 서버를 자동으로 재시작합니다." -ForegroundColor Gray
Write-Host ""

# 발로란트가 켜질 때까지 대기
Write-Host "발로란트 실행 감지 대기 중..." -ForegroundColor Yellow
while (-not (Get-Process -Name $valorantProcess -ErrorAction SilentlyContinue)) {
    Start-Sleep -Seconds 3
}
Write-Host "발로란트 실행 감지됨. 종료될 때까지 대기..." -ForegroundColor Yellow

# 발로란트가 꺼질 때까지 대기
while (Get-Process -Name $valorantProcess -ErrorAction SilentlyContinue) {
    Start-Sleep -Seconds 5
}
Write-Host "발로란트 종료됨. 서버 재시작 중..." -ForegroundColor Green

# WSL 재시작
Write-Host "[1/3] WSL 재시작..." -ForegroundColor Cyan
wsl --shutdown
Start-Sleep -Seconds 5

# Docker Desktop 재시작 확인
Write-Host "[2/3] Docker 확인..." -ForegroundColor Cyan
$dockerRunning = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerRunning) {
    Write-Host "Docker Desktop 시작 중... (40초 대기)" -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Start-Sleep -Seconds 40
} else {
    Start-Sleep -Seconds 8
}

# 컨테이너 재시작
Write-Host "[3/3] 컨테이너 재시작..." -ForegroundColor Cyan
Set-Location $scriptDir
docker compose up -d

Write-Host ""
Write-Host "[완료] 서버 재시작 완료!" -ForegroundColor Green
Write-Host "접속: http://localhost:3000" -ForegroundColor Cyan
Read-Host "엔터를 누르면 종료"
