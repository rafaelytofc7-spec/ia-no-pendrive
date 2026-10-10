@echo off
REM ============================================================
REM  IA no Pendrive - baixar modelos (Windows 10/11)
REM  Se a internet cair, rode de novo: o download continua.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title IA no Pendrive - baixar modelos
if not exist modelos mkdir modelos

echo ============================================
echo    IA no Pendrive - baixar modelos
echo ============================================
echo   [1] Recomendado: PC (Qwen3.5 4B) + celular (Qwen3.5 0.8B)  ~3,3 GB
echo   [2] So o leve para celular/navegador (Qwen3.5 0.8B)         ~0,5 GB
echo   [3] So o intermediario para PC fraco (Qwen3.5 2B)           ~1,3 GB
echo   [4] Todos os tres                                          ~4,6 GB
set "OP=%~1"
if "%OP%"=="" set /p "OP=Escolha [1]: "
if "%OP%"=="" set "OP=1"

set FALHAS=0
if "%OP%"=="2" (
  call :baixar Qwen3.5-0.8B-Q4_K_M.gguf unsloth/Qwen3.5-0.8B-GGUF 532517120
) else if "%OP%"=="3" (
  call :baixar Qwen3.5-2B-Q4_K_M.gguf unsloth/Qwen3.5-2B-GGUF 1280835840
) else if "%OP%"=="4" (
  call :baixar Qwen3.5-4B-Q4_K_M.gguf unsloth/Qwen3.5-4B-GGUF 2740937888
  call :baixar Qwen3.5-2B-Q4_K_M.gguf unsloth/Qwen3.5-2B-GGUF 1280835840
  call :baixar Qwen3.5-0.8B-Q4_K_M.gguf unsloth/Qwen3.5-0.8B-GGUF 532517120
) else (
  call :baixar Qwen3.5-4B-Q4_K_M.gguf unsloth/Qwen3.5-4B-GGUF 2740937888
  call :baixar Qwen3.5-0.8B-Q4_K_M.gguf unsloth/Qwen3.5-0.8B-GGUF 532517120
)
echo.
if "%FALHAS%"=="0" (echo Tudo certo. Agora de dois cliques em INICIAR-WINDOWS.bat) else (echo %FALHAS% download^(s^) com problema. Rode de novo para continuar.)
echo.
pause
exit /b %FALHAS%

:baixar
set "NOME=%~1"
set "REPO=%~2"
set "BYTES=%~3"
set "DEST=modelos\%NOME%"
echo.
echo ^>^> %NOME%
if exist "%DEST%" (
  for %%A in ("%DEST%") do if "%%~zA"=="%BYTES%" (echo    ja baixado. & exit /b 0)
)
if exist "%DEST%.part" (
  for %%A in ("%DEST%.part") do if "%%~zA"=="%BYTES%" (move /y "%DEST%.part" "%DEST%" >nul & echo    pronto. & exit /b 0)
)
set "URL=https://huggingface.co/%REPO%/resolve/main/%NOME%?download=true"
where curl >nul 2>&1
if errorlevel 1 (
  echo    curl nao encontrado, usando PowerShell ^(mais lento, sem barra de progresso^)...
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -OutFile '%DEST%.part'"
) else (
  curl -L --fail --retry 5 --retry-delay 3 -C - -o "%DEST%.part" "%URL%" --progress-bar
)
set "TAM=0"
if exist "%DEST%.part" for %%A in ("%DEST%.part") do set "TAM=%%~zA"
if "%TAM%"=="%BYTES%" (
  move /y "%DEST%.part" "%DEST%" >nul
  echo    pronto.
) else (
  echo    [ERRO] download incompleto ^(%TAM% de %BYTES% bytes^).
  set /a FALHAS+=1
)
exit /b 0
