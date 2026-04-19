@echo off
echo [Minlluminati] 서버 재시작 중...

REM WSL2 재시작 (Vanguard가 죽여놨을 수 있음)
echo [1/3] WSL 재시작...
wsl --shutdown
timeout /t 3 /nobreak >nul

REM Docker Desktop이 실행 중인지 확인, 아니면 시작
echo [2/3] Docker 확인 중...
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I /N "Docker Desktop.exe" >NUL
if "%ERRORLEVEL%"=="1" (
    echo Docker Desktop 시작 중... (30초 대기)
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    timeout /t 30 /nobreak >nul
) else (
    echo Docker Desktop 이미 실행 중.
    timeout /t 5 /nobreak >nul
)

REM 컨테이너 재시작
echo [3/3] 컨테이너 재시작...
cd /d "%~dp0"
docker compose up -d

echo.
echo [완료] 서버가 재시작되었습니다.
echo 접속: http://localhost:3000
pause
