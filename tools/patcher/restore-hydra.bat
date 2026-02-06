@echo off
REM Restore Hydra to original (unpatched) state

echo.
echo ======================================================
echo        Hydra Launcher - Restore Original
echo ======================================================
echo.

set HYDRA_PATH_1=C:\Program Files\Hydra
set HYDRA_PATH_2=%LOCALAPPDATA%\Programs\Hydra
set HYDRA_PATH_3=%USERPROFILE%\AppData\Local\Programs\Hydra

set HYDRA_FOUND=

if exist "%HYDRA_PATH_1%\resources\app.asar.backup" (
    set HYDRA_FOUND=%HYDRA_PATH_1%
) else if exist "%HYDRA_PATH_2%\resources\app.asar.backup" (
    set HYDRA_FOUND=%HYDRA_PATH_2%
) else if exist "%HYDRA_PATH_3%\resources\app.asar.backup" (
    set HYDRA_FOUND=%HYDRA_PATH_3%
)

if "%HYDRA_FOUND%"=="" (
    echo [ERROR] No backup found. Nothing to restore.
    pause
    exit /b 1
)

echo [FOUND] Backup at: %HYDRA_FOUND%
echo.

REM Check if Hydra is running
tasklist /FI "IMAGENAME eq Hydra.exe" 2>NUL | find /I /N "Hydra.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [WARNING] Hydra is currently running. Closing...
    taskkill /F /IM Hydra.exe >nul 2>nul
    timeout /t 2 >nul
)

node patch-hydra.js "%HYDRA_FOUND%" --restore

echo.
echo [DONE] Hydra has been restored to its original state.
echo.
pause
