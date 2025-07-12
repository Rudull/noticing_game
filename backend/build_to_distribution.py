#!/usr/bin/env python3
"""
Noticing Game - Build to Distribution Directory

This script builds the Noticing Game executable and places all build artifacts
in the distribution directory for easy packaging and distribution.

Usage:
    python build_to_distribution.py [options]

Options:
    --platform PLATFORM    Target platform (windows, linux, auto) - default: auto
    --clean                 Clean previous build files before building
    --debug                 Create executable with debug output
    --onedir               Create one-directory bundle instead of one-file
    --test                 Test the built executable after creation
    --help                 Show this help message

Author: Rafael Hernandez Bustamante
License: GPL-3.0
"""

import sys
import os
import argparse
import subprocess
import shutil
import platform
from pathlib import Path
from datetime import datetime

def print_banner():
    """Print the build script banner"""
    print("=" * 80)
    print("🎮 NOTICING GAME - BUILD TO DISTRIBUTION")
    print("=" * 80)
    print("Build executable and place all artifacts in distribution directory")
    print("for easy packaging and distribution")
    print()

def find_project_root():
    """Find the correct project root directory"""
    # Start from script location
    script_dir = Path(__file__).parent

    # Should be in backend directory
    if script_dir.name == "backend" and script_dir.parent.name == "noticing_game":
        return script_dir.parent

    # Search upwards for noticing_game directory
    current_dir = Path.cwd()
    for parent in [current_dir] + list(current_dir.parents):
        noticing_game_dir = parent / "noticing_game"
        if noticing_game_dir.exists() and (noticing_game_dir / "backend").exists():
            return noticing_game_dir

    raise FileNotFoundError("Could not find noticing_game project root directory")

def detect_platform():
    """Detect the current platform"""
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system in ["linux", "darwin"]:
        return "linux"
    else:
        return "unknown"

def get_build_script_path(target_platform):
    """Get the appropriate build script for the platform"""
    project_root = find_project_root()
    backend_dir = project_root / "backend"

    if target_platform == "windows":
        return backend_dir / "build_yt-dlp_executable_windows.py"
    else:
        return backend_dir / "build_yt-dlp_executable_linux.py"

def prepare_distribution_directory():
    """Prepare the distribution directory"""
    project_root = find_project_root()
    dist_dir = project_root / "distribution"

    print(f"📁 Distribution directory: {dist_dir}")

    # Create distribution directory if it doesn't exist
    dist_dir.mkdir(exist_ok=True)

    # Create subdirectories
    subdirs = ['dist', 'build', 'logs', 'packages']
    for subdir in subdirs:
        (dist_dir / subdir).mkdir(exist_ok=True)
        print(f"   Created: {subdir}/")

    # Create build info file
    build_info = {
        'build_date': datetime.now().isoformat(),
        'platform': platform.system(),
        'python_version': sys.version,
        'project_root': str(project_root),
        'distribution_dir': str(dist_dir)
    }

    build_info_file = dist_dir / "build_info.txt"
    with open(build_info_file, 'w') as f:
        f.write("Noticing Game - Build Information\n")
        f.write("=" * 40 + "\n\n")
        for key, value in build_info.items():
            f.write(f"{key}: {value}\n")

    print(f"✅ Distribution directory prepared")
    return dist_dir

def clean_distribution_directory():
    """Clean the distribution directory"""
    project_root = find_project_root()
    dist_dir = project_root / "distribution"

    if not dist_dir.exists():
        return

    print("🧹 Cleaning distribution directory...")

    # Clean subdirectories but keep the structure
    subdirs_to_clean = ['dist', 'build']
    for subdir in subdirs_to_clean:
        subdir_path = dist_dir / subdir
        if subdir_path.exists():
            print(f"   Cleaning {subdir}/")
            shutil.rmtree(subdir_path)
            subdir_path.mkdir()

    print("✅ Distribution directory cleaned")

import threading
import time

def run_with_spinner(cmd, cwd=None):
    spinner = ['|', '/', '-', '\\']
    done = False

    def target():
        nonlocal done
        try:
            subprocess.run(cmd, cwd=cwd, check=True)
        finally:
            done = True

    thread = threading.Thread(target=target)
    thread.start()

    i = 0
    while not done:
        sys.stdout.write(f"\r⏳ Build en progreso... {spinner[i % len(spinner)]}")
        sys.stdout.flush()
        time.sleep(0.2)
        i += 1
    sys.stdout.write("\r✅ Build finalizado.                      \n")
    thread.join()

def run_build_script(target_platform, args):
    """Run the appropriate build script"""
    print(f"🚀 Starting build for platform: {target_platform}")

    build_script = get_build_script_path(target_platform)

    if not build_script.exists():
        raise FileNotFoundError(f"Build script not found: {build_script}")

    print(f"📄 Using build script: {build_script.name}")

    # Construct command
    cmd = [sys.executable, str(build_script), "--build-distribution"]

    if args.clean:
        cmd.append("--clean")
    if args.debug:
        cmd.append("--debug")
    if args.onedir:
        cmd.append("--onedir")
    if args.test:
        cmd.append("--test")

    print(f"💻 Running: {' '.join(cmd[1:])}")
    print()

    # Run the build script with spinner
    try:
        run_with_spinner(cmd, cwd=str(build_script.parent))
        print()
        print("✅ Build script completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print()
        print(f"❌ Build script failed with exit code: {e.returncode}")
        return False

def copy_additional_files():
    """Copy additional files to distribution directory"""
    print("📦 Copying additional files...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"
    dist_dir = project_root / "distribution"

    # Files to copy from backend
    files_to_copy = [
        'README.md',
        'requirements.txt',
        'start_server.py',
        'start_server.sh',
        'start_server.bat'
    ]

    copied_files = []
    for file_name in files_to_copy:
        src_file = backend_dir / file_name
        if src_file.exists():
            dst_file = dist_dir / file_name
            shutil.copy2(src_file, dst_file)
            copied_files.append(file_name)
            print(f"   Copied: {file_name}")

    # Copy assets directory if exists
    assets_dir = project_root / "assets"
    if assets_dir.exists():
        dst_assets = dist_dir / "assets"
        if dst_assets.exists():
            shutil.rmtree(dst_assets)
        shutil.copytree(assets_dir, dst_assets)
        print(f"   Copied: assets/ directory")

    # Copy auto_startup directory
    auto_startup_dir = backend_dir / "auto_startup"
    if auto_startup_dir.exists():
        dst_auto_startup = dist_dir / "auto_startup"
        if dst_auto_startup.exists():
            shutil.rmtree(dst_auto_startup)
        shutil.copytree(auto_startup_dir, dst_auto_startup)
        print(f"   Copied: auto_startup/ directory")

    print(f"✅ Copied {len(copied_files)} additional files")

def create_distribution_readme():
    """Create a README file for the distribution"""
    project_root = find_project_root()
    dist_dir = project_root / "distribution"

    readme_content = """# Noticing Game - Distribution Package

This directory contains the built executable and all necessary files for distributing the Noticing Game application.

## Contents

- `dist/` - Built executable and dependencies
- `build/` - Build artifacts (for debugging)
- `assets/` - Application icons and resources
- `auto_startup/` - System service installation scripts
- `logs/` - Build logs and information
- `*.md` - Documentation files
- `requirements.txt` - Python dependencies
- `start_server.*` - Manual server startup scripts

## Running the Application

### Windows
1. Navigate to `dist/` directory
2. Run `noticing_game_server.exe`

### Linux/macOS
1. Navigate to `dist/` directory
2. Run `./noticing_game_server`

## Installation as System Service

See the `auto_startup/` directory for scripts to install the application as a system service that starts automatically with your operating system.

### Windows
```
cd auto_startup
python install_windows_service.py install
python install_windows_service.py start
```

### Linux/macOS
```
cd auto_startup
chmod +x install_linux_service.sh
./install_linux_service.sh install
./install_linux_service.sh start
```

## Manual Server Only

If you prefer to run only the subtitle extraction server without the GUI:

### Windows
```
start_server.bat
```

### Linux/macOS
```
chmod +x start_server.sh
./start_server.sh
```

### Python
```
python start_server.py
```

## Requirements

- Windows 10+ / Linux / macOS
- Internet connection for subtitle extraction
- Port 5000 available (default)

## Support

For issues and documentation, visit:
https://github.com/Rudull/noticing-game

## License

GNU General Public License v3.0 (GPL-3.0)
"""

    readme_file = dist_dir / "README_DISTRIBUTION.md"
    with open(readme_file, 'w', encoding='utf-8') as f:
        f.write(readme_content)

    print("✅ Created distribution README")

def show_distribution_summary():
    """Show summary of the distribution build"""
    project_root = find_project_root()
    dist_dir = project_root / "distribution"

    print("\n" + "=" * 80)
    print("🎉 DISTRIBUTION BUILD COMPLETED!")
    print("=" * 80)

    print(f"\n📁 Distribution Location: {dist_dir}")

    # Show directory structure
    print("\n📦 Distribution Contents:")
    try:
        for item in sorted(dist_dir.iterdir()):
            if item.is_dir():
                file_count = len(list(item.rglob("*"))) if item.exists() else 0
                print(f"   📂 {item.name}/ ({file_count} items)")
            else:
                size_kb = item.stat().st_size / 1024
                print(f"   📄 {item.name} ({size_kb:.1f} KB)")
    except Exception as e:
        print(f"   ⚠️  Could not list contents: {e}")

    # Find executable
    dist_dist_dir = dist_dir / "dist"
    executable = None
    if dist_dist_dir.exists():
        for item in dist_dist_dir.rglob("*"):
            if item.is_file() and ("noticing_game_server" in item.name):
                executable = item
                break

    if executable:
        size_mb = executable.stat().st_size / (1024 * 1024)
        print(f"\n🚀 Executable: {executable}")
        print(f"📏 Size: {size_mb:.1f} MB")

    print("\n📋 Next Steps:")
    print("1. Test the executable in the dist/ directory")
    print("2. Copy the entire distribution/ folder to target machines")
    print("3. Run the executable or install as system service")
    print("4. See README_DISTRIBUTION.md for detailed instructions")

    print(f"\n✨ Distribution package ready for deployment!")

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Build Noticing Game to distribution directory")
    parser.add_argument("--platform", choices=["windows", "linux", "auto"], default="auto",
                       help="Target platform (default: auto-detect)")
    parser.add_argument("--clean", action="store_true", help="Clean previous build files")
    parser.add_argument("--debug", action="store_true", help="Create executable with debug output")
    parser.add_argument("--onedir", action="store_true", help="Create one-directory bundle")
    parser.add_argument("--test", action="store_true", help="Test the built executable")

    args = parser.parse_args()

    print_banner()

    try:
        # Detect platform if auto
        if args.platform == "auto":
            target_platform = detect_platform()
            if target_platform == "unknown":
                print("❌ Could not detect platform. Please specify with --platform")
                sys.exit(1)
        else:
            target_platform = args.platform

        print(f"🎯 Target platform: {target_platform}")
        print(f"🔧 Current platform: {platform.system()}")

        if target_platform == "windows" and platform.system() != "Windows":
            print("⚠️  Warning: Building Windows executable on non-Windows platform")

        # Find project root
        project_root = find_project_root()
        print(f"📁 Project root: {project_root}")

        # Clean if requested
        if args.clean:
            clean_distribution_directory()

        # Prepare distribution directory
        dist_dir = prepare_distribution_directory()

        # Run the build script
        if not run_build_script(target_platform, args):
            print("❌ Build failed!")
            sys.exit(1)

        # Copy additional files
        copy_additional_files()

        # Create distribution README
        create_distribution_readme()

        # Show summary
        show_distribution_summary()

    except KeyboardInterrupt:
        print("\n❌ Build cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Build error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
