# Noticing Game - Quick Build Scripts Guide

This directory contains scripts to create standalone executables for the Noticing Game backend on different operating systems.

---

## 🖼️ Application Screenshots

Below are screenshots of the Noticing Game desktop application and its settings window for visual reference:

![The game interface](assets/noticin-game-server.png)

![The game interface](assets/noticin-game-server-settings.png)

---

---

## 📁 Available Scripts

- **Linux/macOS:**
  - `build_yt-dlp_executable_linux.py`
- **Windows:**
  - `build_yt-dlp_executable_windows.py`
  - `build_cx-freeze_executable_windows.py` (alternative)
- **Distribution Packaging:**
  - `build_to_distribution.py` (prepares a complete, ready-to-ship package for **Windows, Linux, and macOS**)

---

## 🚀 Basic Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
pip install pyinstaller flask flask-cors yt-dlp requests pystray Pillow
# For cx_Freeze (optional, Windows only)
pip install cx_Freeze
```

---

### 2. Build Commands

#### Linux/macOS

```bash
python build_yt-dlp_executable_linux.py --clean --build-root
```

#### Windows (PyInstaller recommended)

```cmd
python build_yt-dlp_executable_windows.py --clean --build-root
```

#### Windows (cx_Freeze alternative)

```cmd
python build_cx-freeze_executable_windows.py --clean --build-root
```

---

### 3. Useful Options

- `--clean`         Clean previous build files before compiling.
- `--build-root`    Generate executables in the project root (recommended).
- `--build-backend` Generate executables in the backend directory.

---

### 4. Packaging for Distribution

- **`build_to_distribution.py`** automates building and packaging all necessary files for distribution on **Windows, Linux, and macOS**.
- It detects your platform automatically and runs the appropriate build.
- The result is a `distribution/` folder containing the executable, dependencies, startup scripts, and documentation—ready to deliver or deploy.

#### Example usage

```bash
python build_to_distribution.py --clean --test
```

- You can add flags like `--platform windows` or `--platform linux` to force a specific platform.
- The output will be in the `distribution/` folder, ready to copy to another machine or distribute.

---

For advanced information, see the main project README.

---
