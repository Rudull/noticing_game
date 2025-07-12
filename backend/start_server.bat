@echo off
setlocal enabledelayedexpansion

:: Noticing Game Backend - Windows Startup Script
:: This batch file helps Windows users start the subtitle extraction server

echo ===============================================================
echo 🎮 NOTICING GAME - SUBTITLE EXTRACTION SERVER
echo ===============================================================
echo Backend server for YouTube subtitle extraction
echo Using yt-dlp for reliable subtitle access
echo.

:: Check if Python is installed
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Python is not installed or not in PATH
    echo.
    echo Please install Python 3.8 or higher from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

:: Get Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✅ Python version: %PYTHON_VERSION%

:: Check if we're in the right directory
if not exist "subtitle_server.py" (
    echo ❌ ERROR: subtitle_server.py not found
    echo Please make sure you're running this script from the backend directory
    echo.
    echo Current directory: %cd%
    pause
    exit /b 1
)

echo ✅ Server file found

:: Check if requirements.txt exists
if not exist "requirements.txt" (
    echo ⚠️  WARNING: requirements.txt not found
    echo Will attempt to install dependencies manually
    goto INSTALL_MANUAL
)

:: Install dependencies from requirements.txt
echo.
echo 🔧 Installing dependencies...
echo Installing from requirements.txt...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies from requirements.txt
    echo Trying manual installation...
    goto INSTALL_MANUAL
)
echo ✅ Dependencies installed successfully!
goto START_SERVER

:INSTALL_MANUAL
echo Installing dependencies manually...
python -m pip install flask flask-cors yt-dlp requests
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    echo.
    echo Please try installing manually:
    echo   pip install flask flask-cors yt-dlp requests
    echo.
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully!

:START_SERVER
echo.
echo 🚀 STARTING SERVER...
echo    Configuration: Reading from %USERPROFILE%\.noticing_game_config.json
echo    Default Host: 127.0.0.1
echo    Default Port: 5000
echo    URL: Check desktop app or config file for current settings
echo.
echo 📋 AVAILABLE ENDPOINTS:
echo    Health Check: http://[configured_host]:[configured_port]/
echo    Extract Subtitles: http://[configured_host]:[configured_port]/extract-subtitles
echo.
echo 📝 CONFIGURATION:
echo    The server reads host and port from %USERPROFILE%\.noticing_game_config.json
echo    If no config file exists, defaults to 127.0.0.1:5000
echo    Use the desktop app Settings to configure host and port
echo.
echo 📚 USAGE:
echo    POST /extract-subtitles
echo    Body: {"url": "https://www.youtube.com/watch?v=VIDEO_ID"}
echo.
echo    GET /extract-subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID
echo.
echo ⚠️  IMPORTANT:
echo    - Keep this window open while using the Chrome extension
echo    - The server must be running for the extension to work
echo    - Press Ctrl+C to stop the server
echo.
echo 🎬 Server is starting...
echo    Waiting for requests...
echo.

:: Start the Python server
python subtitle_server.py

:: If we get here, the server has stopped
echo.
echo 🛑 Server stopped
pause
