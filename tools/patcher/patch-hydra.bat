@echo off
REM ============================================
REM Hydra Launcher Patcher - Windows Batch Script
REM ============================================
REM 
REM Edit the URLs below to match your backend
REM 

set API_URL=http://localhost:3001
set AUTH_URL=http://localhost:3001/auth
set WS_URL=ws://localhost:3001/ws
set NIMBUS_URL=http://localhost:3001
set CHECKOUT_URL=http://localhost:3001/checkout

REM Default installation paths to try
set HYDRA_PATH_1=C:\Program Files\Hydra
set HYDRA_PATH_2=%LOCALAPPDATA%\Programs\Hydra
set HYDRA_PATH_3=%USERPROFILE%\AppData\Local\Programs\Hydra

echo.
echo ======================================================
echo        Hydra Launcher Backend URL Patcher
echo ======================================================
echo.

REM Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Find Hydra installation
set HYDRA_FOUND=

if exist "%HYDRA_PATH_1%\resources\app.asar" (
    set HYDRA_FOUND=%HYDRA_PATH_1%
    echo [FOUND] Hydra at: %HYDRA_PATH_1%
) else if exist "%HYDRA_PATH_2%\resources\app.asar" (
    set HYDRA_FOUND=%HYDRA_PATH_2%
    echo [FOUND] Hydra at: %HYDRA_PATH_2%
) else if exist "%HYDRA_PATH_3%\resources\app.asar" (
    set HYDRA_FOUND=%HYDRA_PATH_3%
    echo [FOUND] Hydra at: %HYDRA_PATH_3%
)

if "%HYDRA_FOUND%"=="" (
    echo [ERROR] Could not find Hydra installation
    echo.
    echo Please enter the path to your Hydra installation:
    set /p HYDRA_FOUND="Path: "
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo.
    echo [INFO] Installing dependencies...
    call npm install
)

echo.
echo [INFO] Target Backend URLs:
echo        API:      %API_URL%
echo        Auth:     %AUTH_URL%
echo        WS:       %WS_URL%
echo        Nimbus:   %NIMBUS_URL%
echo        Checkout: %CHECKOUT_URL%
echo.

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

node patch-hydra.js "%HYDRA_FOUND%" ^
    --api-url %API_URL% ^
    --auth-url %AUTH_URL% ^
    --ws-url %WS_URL% ^
    --nimbus-url %NIMBUS_URL% ^
    --checkout-url %CHECKOUT_URL%

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
