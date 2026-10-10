@echo off
REM ============================================================
REM  IA no Pendrive - iniciar no Windows (de dois cliques)
REM  Opcional: edite PORTA e CONTEXTO abaixo.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title IA no Pendrive
set "PORTA=8080"
set "CONTEXTO=8192"
set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
set "SERVER=%RAIZ%\motor\windows\llama-server.exe"

echo ============================================
echo         IA no Pendrive
echo ============================================

if not exist "%SERVER%" (
  echo [ERRO] Motor nao encontrado em motor\windows. Copie a pasta inteira para o pendrive.
  pause & exit /b 1
)

REM ---------- escolher o modelo (maior primeiro) ----------
set N=0
for /f "delims=" %%F in ('dir /b /o-s "%RAIZ%\modelos\*.gguf" 2^>nul ^| findstr /v /i "mmproj"') do (
  set /a N+=1
  set "MOD!N!=%%F"
)
if %N%==0 (
  echo.
  echo [ERRO] Nenhum modelo .gguf na pasta "modelos".
  echo Rode primeiro o arquivo baixar-modelos.bat ^(precisa de internet uma vez^)
  echo ou copie um arquivo .gguf para a pasta "modelos".
  echo.
  pause & exit /b 1
)
set "ESC=1"
if %N% GTR 1 (
  echo.
  echo Modelos encontrados ^(o maior costuma ser o mais inteligente^):
  for /l %%i in (1,1,%N%) do echo   [%%i] !MOD%%i!
  set /p "ESC=Escolha o numero [1]: "
)
set "MODELO="
for /f "delims=0123456789" %%x in ("!ESC!") do set "ESC=1"
if !ESC! GTR %N% set "ESC=1"
if !ESC! LSS 1 set "ESC=1"
for %%i in (!ESC!) do set "MODELO=!MOD%%i!"
echo Modelo: !MODELO!

REM ---------- acesso pelo celular ----------
set "HOST=127.0.0.1"
echo.
choice /c SN /n /t 15 /d N /m "Liberar acesso pelo celular na mesma Wi-Fi? [S/N] (15s = N): "
if errorlevel 2 (set "HOST=127.0.0.1") else (set "HOST=0.0.0.0")

REM ---------- ja esta rodando? ----------
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:%PORTA%/health -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
  echo Ja existe um servidor rodando na porta %PORTA%. Abrindo o navegador...
  start "" "http://localhost:%PORTA%/"
  timeout /t 3 >nul & exit /b 0
)

REM ---------- descobrir o IP da rede ----------
set "IP="
if "%HOST%"=="0.0.0.0" (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "$c=Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1; if($c){$c.IPv4Address[0].IPAddress}"`) do set "IP=%%i"
  if "!IP!"=="" set "IP=IP-DO-PC"
)

set "GPU_ARGS="
:rodar
echo.
echo Carregando o modelo ^(pode levar de 10 s a 1 min no pendrive^)...
echo Quando ficar pronto, o navegador abre sozinho.
if "%HOST%"=="0.0.0.0" (
  echo.
  echo ****************************************************************
  echo   No CELULAR ^(mesma Wi-Fi^), abra:  http://!IP!:%PORTA%/
  echo   Se o Windows perguntar sobre o Firewall, clique em "Permitir".
  echo ****************************************************************
)
echo Para desligar a IA, feche esta janela.
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 600;$i++){try{$r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:%PORTA%/health -TimeoutSec 2; if($r.StatusCode -eq 200){Write-Host ''; Write-Host '>>> Servidor pronto. No PC: http://localhost:%PORTA%/' -ForegroundColor Green; Start-Process 'http://localhost:%PORTA%/'; break}}catch{}; Start-Sleep 1}"
"%SERVER%" -m "%RAIZ%\modelos\!MODELO!" --host %HOST% --port %PORTA% --path "%RAIZ%\app" -c %CONTEXTO% --jinja -lv 2 %GPU_ARGS%
set "COD=%errorlevel%"
if not "%COD%"=="0" if "%GPU_ARGS%"=="" (
  echo.
  echo [AVISO] O motor fechou com erro ^(%COD%^).
  choice /c SN /n /m "Tentar de novo so com CPU (sem placa de video)? [S/N]: "
  if not errorlevel 2 (
    set "GPU_ARGS=--device none -ngl 0"
    goto rodar
  )
)
echo.
if not "%COD%"=="0" echo Nao deu certo. Veja "Problemas comuns" no README.md
pause
