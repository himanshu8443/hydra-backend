@echo off
REM ============================================
REM Hydra Launcher Patcher - Windows Batch Script
REM ============================================
REM 
REM Configuration is now loaded from .env file
REM Edit .env to change URLs and paths
REM 

echo.
echo ======================================================
echo        Hydra Launcher Backend URL Patcher
echo ======================================================
echo.
echo Using configuration from .env file...
echo.

REM Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env exists
if not exist ".env" (
    echo [ERROR] .env file not found!
    echo Please create a .env file with your configuration.
    echo See README.md for details.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo.
    echo [INFO] Installing dependencies...
    call npm install
)

REM Check if Hydra is running
tasklist /FI "IMAGENAME eq Hydra.exe" 2>NUL | find /I /N "Hydra.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [WARNING] Hydra is currently running!
    echo Please close Hydra before patching.
    echo.
    choice /C YN /M "Would you like to force close Hydra"
    if errorlevel 2 (
        echo [CANCELLED] Please close Hydra and try again.
        pause
        exit /b 1
    )
    taskkill /F /IM Hydra.exe >nul 2>nul
    timeout /t 2 >nul
)

echo [INFO] Patching Hydra...
echo.

REM Run the patcher - it will read from .env automatically
node patch-hydra.js

echo.
if %errorlevel% equ 0 (
    echo ======================================================
    echo                    PATCH COMPLETE!
    echo ======================================================
    echo.
    echo You can now start Hydra and it will use your backend.
) else (
    echo ======================================================
    echo                    PATCH FAILED!
    echo ======================================================
    echo.
    echo Please check the error messages above.
)

echo.
pause
