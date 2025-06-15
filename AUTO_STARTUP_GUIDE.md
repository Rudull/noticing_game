# Auto-Startup Guide - Noticing Game Backend Server

## Overview

This guide provides multiple methods to automatically start the Noticing Game subtitle extraction server when your computer boots up. Choose the method that best fits your technical comfort level and operating system.

## 🎯 **Quick Recommendations**

| User Type | Recommended Method | Why |
|-----------|-------------------|-----|
| **Beginner** | [Desktop Application](#method-3-desktop-application-auto-start) | Easy GUI, no technical setup |
| **Intermediate** | [System Service](#method-1-system-service-installation) | Reliable, starts with OS |
| **Advanced** | [Custom Integration](#method-4-manual-startup-scripts) | Full control and customization |

---

## Method 1: System Service Installation

### 🪟 **Windows Service**

**Advantages:**
- Starts automatically with Windows
- Runs in background without user login
- Most reliable method
- Professional integration

**Requirements:**
- Administrator privileges
- Python 3.8+
- pywin32 package

**Installation Steps:**

1. **Install pywin32 package:**
   ```cmd
   pip install pywin32
   python -m pywin32_postinstall -install
   ```

2. **Run as Administrator:**
   - Right-click Command Prompt → "Run as administrator"

3. **Navigate to backend directory:**
   ```cmd
   cd path\to\noticing_game\backend\auto_startup
   ```

4. **Install the service:**
   ```cmd
   python install_windows_service.py install
   ```

5. **Enable and start:**
   ```cmd
   python install_windows_service.py start
   python install_windows_service.py enable
   ```

6. **Verify installation:**
   ```cmd
   python install_windows_service.py status
   ```

**Management Commands:**
```cmd
python install_windows_service.py start     # Start service
python install_windows_service.py stop      # Stop service
python install_windows_service.py restart   # Restart service
python install_windows_service.py status    # Check status
python install_windows_service.py remove    # Uninstall service
```

### 🐧 **Linux Service (systemd)**

**Advantages:**
- Integrates with systemd
- Automatic restart on failure
- Proper logging with journald
- Standard Linux service management

**Installation Steps:**

1. **Make script executable:**
   ```bash
   chmod +x auto_startup/install_linux_service.sh
   ```

2. **Install service:**
   ```bash
   ./auto_startup/install_linux_service.sh install
   ```

3. **Enable and start:**
   ```bash
   ./auto_startup/install_linux_service.sh enable
   ./auto_startup/install_linux_service.sh start
   ```

4. **Check status:**
   ```bash
   ./auto_startup/install_linux_service.sh status
   ```

**Management Commands:**
```bash
./install_linux_service.sh start      # Start service
./install_linux_service.sh stop       # Stop service
./install_linux_service.sh restart    # Restart service
./install_linux_service.sh status     # Check status
./install_linux_service.sh enable     # Enable auto-start
./install_linux_service.sh disable    # Disable auto-start
./install_linux_service.sh remove     # Uninstall service
```

### 🍎 **macOS Service (launchd)**

**Advantages:**
- Native macOS integration
- Automatic startup and restart
- Proper system integration

**Installation Steps:**

1. **Make script executable:**
   ```bash
   chmod +x auto_startup/install_linux_service.sh
   ```

2. **Install service:**
   ```bash
   ./auto_startup/install_linux_service.sh install
   ```

3. **Start service:**
   ```bash
   ./auto_startup/install_linux_service.sh start
   ```

**Note:** The same script works for both Linux and macOS, automatically detecting the platform.

---

## Method 2: Task Scheduler / Cron Jobs

### 🪟 **Windows Task Scheduler**

1. **Open Task Scheduler:**
   - Press `Win + R`, type `taskschd.msc`, press Enter

2. **Create Basic Task:**
   - Click "Create Basic Task" in the right panel
   - Name: "Noticing Game Server"
   - Description: "Auto-start Noticing Game subtitle extraction server"

3. **Set Trigger:**
   - Choose "When the computer starts"
   - Click Next

4. **Set Action:**
   - Choose "Start a program"
   - Program: `python.exe` (or full path like `C:\Python39\python.exe`)
   - Arguments: `subtitle_server.py`
   - Start in: `C:\path\to\noticing_game\backend`

5. **Finish and Test:**
   - Check "Open the Properties dialog"
   - In Properties, go to "General" tab
   - Check "Run whether user is logged on or not"
   - Check "Run with highest privileges"

### 🐧 **Linux/macOS Cron Job**

1. **Edit crontab:**
   ```bash
   crontab -e
   ```

2. **Add startup entry:**
   ```bash
   @reboot cd /path/to/noticing_game/backend && python3 subtitle_server.py
   ```

3. **Alternative with full paths:**
   ```bash
   @reboot /usr/bin/python3 /path/to/noticing_game/backend/subtitle_server.py
   ```

4. **Save and verify:**
   ```bash
   crontab -l  # List current cron jobs
   ```

---

## Method 3: Desktop Application Auto-Start

### 📱 **GUI Desktop Manager**

**Advantages:**
- User-friendly graphical interface
- Easy start/stop controls
- Real-time status monitoring
- System tray integration
- No administrator privileges required

**Setup Steps:**

1. **Install optional dependencies for full features:**
   ```bash
   pip install pystray Pillow
   ```

2. **Run the desktop application:**
   ```bash
   python desktop_app.py
   ```

3. **Configure auto-start:**
   - Click "⚙️ Settings" button
   - Check "Start server automatically when app opens"
   - Click "Save"

4. **Add to system startup:**

   **Windows:**
   - Press `Win + R`, type `shell:startup`, press Enter
   - Create shortcut to `desktop_app.py` in this folder
   - Or create a batch file:
     ```batch
     @echo off
     cd /d "C:\path\to\noticing_game\backend"
     python desktop_app.py
     ```

   **Linux:**
   - Create desktop entry: `~/.config/autostart/noticing-game.desktop`
     ```ini
     [Desktop Entry]
     Type=Application
     Name=Noticing Game Server
     Exec=python3 /path/to/noticing_game/backend/desktop_app.py
     Hidden=false
     NoDisplay=false
     X-GNOME-Autostart-enabled=true
     ```

   **macOS:**
   - Go to System Preferences → Users & Groups → Login Items
   - Click "+" and add the desktop_app.py file

**Features:**
- ▶️ Start/Stop server with one click
- 🔄 Restart server
- 📊 Real-time status monitoring
- 📝 Live log viewer
- ⚙️ Settings configuration
- 🔧 System tray integration (if pystray installed)

---

## Method 4: Manual Startup Scripts

### 🪟 **Windows Startup Folder**

1. **Create startup batch file:**
   ```batch
   @echo off
   cd /d "C:\path\to\noticing_game\backend"
   start /min python subtitle_server.py
   ```

2. **Save as `start_noticing_game.bat`**

3. **Add to startup folder:**
   - Press `Win + R`, type `shell:startup`, press Enter
   - Copy the batch file to this folder

### 🐧 **Linux Autostart**

1. **Create desktop entry:**
   ```ini
   [Desktop Entry]
   Type=Application
   Name=Noticing Game Server
   Exec=/usr/bin/python3 /path/to/noticing_game/backend/subtitle_server.py
   Hidden=false
   NoDisplay=false
   X-GNOME-Autostart-enabled=true
   Terminal=false
   ```

2. **Save to:**
   ```bash
   ~/.config/autostart/noticing-game-server.desktop
   ```

3. **Make executable:**
   ```bash
   chmod +x ~/.config/autostart/noticing-game-server.desktop
   ```

### 🍎 **macOS Login Items**

1. **System Preferences → Users & Groups → Login Items**
2. **Click "+" to add item**
3. **Navigate to and select:**
   - The `start_server.sh` script, or
   - The `desktop_app.py` file, or
   - Create an Automator application

---

## 🔧 **Troubleshooting**

### Common Issues

#### 1. **Service Won't Start**

**Symptoms:** Service installs but doesn't start

**Solutions:**
```bash
# Check Python path
which python3

# Verify script exists and is executable
ls -la /path/to/subtitle_server.py

# Check dependencies
python3 -c "import flask, flask_cors, yt_dlp, requests; print('All dependencies OK')"

# Check service logs
# Linux:
journalctl -u noticing-game-subtitle-server
# Windows:
# Check Event Viewer → Windows Logs → Application
```

#### 2. **Permission Denied**

**Symptoms:** "Permission denied" or "Access denied" errors

**Solutions:**
```bash
# Make scripts executable (Linux/macOS)
chmod +x start_server.sh
chmod +x auto_startup/install_linux_service.sh

# Run as administrator (Windows)
# Right-click Command Prompt → "Run as administrator"

# Check file permissions
ls -la /path/to/noticing_game/backend/
```

#### 3. **Port Already in Use**

**Symptoms:** "Port 5000 is already in use"

**Solutions:**
```bash
# Find process using port 5000
# Linux/macOS:
lsof -ti:5000
sudo kill -9 <PID>

# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or change port in subtitle_server.py
```

#### 4. **Python Not Found**

**Symptoms:** "'python' is not recognized" or "command not found"

**Solutions:**
```bash
# Windows:
# Add Python to PATH during installation
# Or use full path: C:\Python39\python.exe

# Linux/macOS:
# Install Python 3
sudo apt install python3  # Ubuntu/Debian
brew install python3      # macOS

# Verify installation
python3 --version
```

#### 5. **Dependencies Missing**

**Symptoms:** "ModuleNotFoundError: No module named 'flask'"

**Solutions:**
```bash
# Install dependencies
pip install -r requirements.txt

# Or install individually
pip install flask flask-cors yt-dlp requests

# Check installation
python3 -c "import flask; print('Flask OK')"
```

### Verification Steps

1. **Check if server is running:**
   ```bash
   curl http://localhost:5000/
   ```

2. **Test subtitle extraction:**
   ```bash
   curl -X POST http://localhost:5000/extract-subtitles \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
   ```

3. **Check service status:**
   ```bash
   # Windows:
   python install_windows_service.py status
   
   # Linux:
   systemctl --user status noticing-game-subtitle-server
   
   # macOS:
   launchctl list | grep noticing
   ```

---

## 📊 **Method Comparison**

| Method | Difficulty | Reliability | Features | User Login Required |
|--------|------------|-------------|----------|-------------------|
| **System Service** | Hard | ⭐⭐⭐⭐⭐ | Auto-restart, logging | No |
| **Task Scheduler/Cron** | Medium | ⭐⭐⭐⭐ | Basic scheduling | Sometimes |
| **Desktop App** | Easy | ⭐⭐⭐ | GUI, monitoring | Yes |
| **Startup Scripts** | Easy | ⭐⭐ | Simple, lightweight | Yes |

---

## 🎯 **Recommendations by Use Case**

### **Home Users (Beginner)**
→ Use **Desktop Application** method
- Easy to set up and use
- Visual feedback and controls
- No administrator privileges needed

### **Power Users**
→ Use **System Service** method
- Most reliable
- Starts automatically with OS
- Professional integration

### **Developers**
→ Use **Task Scheduler/Cron** method
- Good balance of control and simplicity
- Easy to modify and debug
- Familiar tools

### **Enterprise/Server**
→ Use **System Service** method
- Proper service management
- Integration with system monitoring
- Automatic restart on failure

---

## 🆘 **Getting Help**

If you encounter issues:

1. **Check the logs:**
   - Service logs: Use system log viewers
   - Application logs: Check `~/.noticing_game_logs/`
   - Server logs: Console output or redirected files

2. **Test manually first:**
   ```bash
   python subtitle_server.py
   ```

3. **Verify dependencies:**
   ```bash
   python -c "import flask, flask_cors, yt_dlp, requests"
   ```

4. **Check the documentation:**
   - `backend/README.md`
   - `BACKEND_INTEGRATION.md`

5. **Contact support:**
   - GitHub issues
   - Check troubleshooting sections in other documentation

---

## 📝 **Next Steps**

After setting up auto-start:

1. **Test the setup** by restarting your computer
2. **Verify the server starts** automatically
3. **Test the Chrome extension** to ensure it connects
4. **Configure any additional settings** as needed
5. **Set up monitoring** if desired for production use

The Noticing Game backend server should now start automatically whenever your computer boots up, ensuring the Chrome extension always has access to subtitle extraction capabilities!