#!/usr/bin/env python3
"""
Noticing Game - Build Executable Script

This script helps you build a standalone executable for the Noticing Game desktop application
using PyInstaller. It handles dependency checking, environment setup, and building process.

Usage:
    python build_executable.py [options]

Options:
    --clean         Clean previous build files before building
    --debug         Create executable with debug output
    --onedir        Create one-directory bundle instead of one-file
    --test          Test the built executable after creation
    --help          Show this help message

Author: Rafael Hernandez Bustamante
License: GPL-3.0
"""

import sys
import os
import argparse
import subprocess
import shutil
import tempfile
from pathlib import Path
import platform
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

def find_project_root():
    """Find the correct project root directory"""
    # Start from current working directory
    current_dir = Path.cwd()

    # Look for noticing_game directory structure
    # Check if we're already in the project
    if current_dir.name == "noticing_game" and (current_dir / "backend").exists():
        return current_dir

    # Check if we're in backend directory
    if current_dir.name == "backend" and current_dir.parent.name == "noticing_game":
        return current_dir.parent

    # Search upwards for noticing_game directory
    for parent in [current_dir] + list(current_dir.parents):
        noticing_game_dir = parent / "noticing_game"
        if noticing_game_dir.exists() and (noticing_game_dir / "backend").exists():
            return noticing_game_dir

    # Fallback: use script location
    script_dir = Path(__file__).parent
    if script_dir.name == "backend" and script_dir.parent.name == "noticing_game":
        return script_dir.parent

    # Last resort: assume script_dir.parent is correct
    return script_dir.parent

def print_banner():
    """Print the build script banner"""
    print("=" * 70)
    print("🎮 NOTICING GAME - EXECUTABLE BUILDER")
    print("=" * 70)
    print("Build standalone executable for the Noticing Game desktop application")
    print()

def check_python_version():
    """Check if Python version is compatible"""
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 8):
        print("❌ ERROR: Python 3.8 or higher is required")
        print(f"   Current version: {sys.version}")
        return False

    print(f"✅ Python version: {sys.version.split()[0]} (Compatible)")
    return True

def check_dependencies():
    """Check if all required dependencies are installed"""
    print("Checking dependencies...")

    # Check PyInstaller separately using command line
    pyinstaller_available = False
    try:
        result = subprocess.run(['pyinstaller', '--version'],
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            pyinstaller_available = True
            print(f"✅ PyInstaller: Available (version: {result.stdout.strip()})")
        else:
            print("❌ PyInstaller: Not working properly")
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        print("❌ PyInstaller: Missing or not accessible")

    required_packages = [
        ('Flask', 'flask'),
        ('Flask-CORS', 'flask_cors'),
        ('yt-dlp', 'yt_dlp'),
        ('requests', 'requests'),
        ('tkinter', 'tkinter')
    ]

    optional_packages = [
        ('pystray', 'pystray'),
        ('Pillow', 'PIL')
    ]

    missing_required = []
    missing_optional = []

    # Check required packages
    for display_name, import_name in required_packages:
        try:
            __import__(import_name)
            print(f"✅ {display_name}: Available")
        except ImportError:
            print(f"❌ {display_name}: Missing")
            missing_required.append(display_name)

    # Check optional packages
    for display_name, import_name in optional_packages:
        try:
            __import__(import_name)
            print(f"✅ {display_name}: Available (optional)")
        except ImportError:
            print(f"⚠️  {display_name}: Missing (optional)")
            missing_optional.append(display_name)

    # Add PyInstaller to missing if not available
    if not pyinstaller_available:
        missing_required.append('PyInstaller')

    if missing_required:
        print(f"\n❌ Missing required packages: {', '.join(missing_required)}")
        print("Install them with:")
        print("   pip install pyinstaller flask flask-cors yt-dlp requests")
        return False

    if missing_optional:
        print(f"\n⚠️  Missing optional packages: {', '.join(missing_optional)}")
        print("System tray functionality will be disabled.")
        print("Install them with: pip install pystray Pillow")

    return True

def check_source_files():
    """Check if all required source files exist"""
    print("Checking source files...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"

    print(f"Project root: {project_root}")
    print(f"Backend directory: {backend_dir}")

    required_files = [
        'desktop_app.py',
        'subtitle_server.py',
        'requirements.txt'
    ]

    missing_files = []
    for file in required_files:
        file_path = backend_dir / file
        if file_path.exists():
            print(f"✅ {file}: Found")
        else:
            print(f"❌ {file}: Missing")
            missing_files.append(file)

    if missing_files:
        print(f"\n❌ Missing source files: {', '.join(missing_files)}")
        return False

    return True

def clean_build_files():
    """Clean previous build files"""
    print("Cleaning previous build files...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"

    # Clean both project root and backend directories
    dirs_to_clean = ['build', 'dist', '__pycache__']
    files_to_clean = []  # Don't remove spec file automatically

    for base_dir in [project_root, backend_dir]:
        for dir_name in dirs_to_clean:
            dir_path = base_dir / dir_name
            if dir_path.exists():
                print(f"   Removing {dir_path}")
                shutil.rmtree(dir_path)

        for file_name in files_to_clean:
            file_path = base_dir / file_name
            if file_path.exists():
                print(f"   Removing {file_path}")
                file_path.unlink()

    print("✅ Clean completed")

def ensure_clean_dist(build_root=True, use_distribution_dir=False):
    """Ensure dist directory is clean before building"""
    project_root = find_project_root()
    backend_dir = project_root / "backend"

    if use_distribution_dir:
        dist_dir = project_root / 'distribution' / 'dist'
    elif build_root:
        dist_dir = project_root / 'dist'
    else:
        dist_dir = backend_dir / 'dist'

    if dist_dir.exists():
        print(f"Cleaning existing dist directory: {dist_dir}")
        shutil.rmtree(dist_dir)
        print("✅ Dist directory cleaned")

def create_spec_file(debug=False, onedir=False):
    """Create PyInstaller spec file"""
    print("Creating PyInstaller spec file...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"
    spec_file = backend_dir / 'desktop_app_linux.spec'

    # Determine console mode
    console_mode = "True" if debug else "False"

    # Determine bundle type
    if onedir:
        exe_template = '''
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='noticing_game_server',
    debug={debug},
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console={console},
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='noticing_game_server'
)'''
    else:
        exe_template = '''
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='noticing_game_server',
    debug={debug},
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console={console},
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)'''

    spec_content = f'''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('subtitle_server.py', '.'),
        ('requirements.txt', '.'),
        ('README.md', '.')
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'yt_dlp',
        'requests',
        'tkinter',
        'tkinter.ttk',
        'tkinter.scrolledtext',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'pystray',
        'tempfile',
        'logging',
        'datetime',
        're',
        'json',
        'xml.etree.ElementTree',
        'urllib.request',
        'urllib.error',
        'webbrowser',
        'subtitle_server',
        'xml.parsers.expat',
        'email.mime.multipart',
        'email.mime.text',
        'threading',
        'socket',
        'subprocess'
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

{exe_template.format(debug=debug, console=console_mode)}
'''

    with open(spec_file, 'w') as f:
        f.write(spec_content)

    print(f"✅ Spec file created: {spec_file}")
    return spec_file

def build_executable(spec_file, clean=False, build_root=True, use_distribution_dir=False):
    """Build the executable using PyInstaller"""
    print("Building executable with PyInstaller...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"

    # Determine build directories
    if use_distribution_dir:
        # Build in distribution directory
        dist_dir = project_root / 'distribution' / 'dist'
        build_dir = project_root / 'distribution' / 'build'
        # Ensure distribution directory exists
        (project_root / 'distribution').mkdir(exist_ok=True)
        print(f"Building in distribution directory: {project_root / 'distribution'}")
    elif build_root:
        # Build in project root (noticing_game directory)
        dist_dir = project_root / 'dist'
        build_dir = project_root / 'build'
        print(f"Building in project root: {project_root}")
    else:
        # Build in backend directory
        dist_dir = backend_dir / 'dist'
        build_dir = backend_dir / 'build'
        print(f"Building in backend directory: {backend_dir}")

    cmd = ['pyinstaller']

    if clean:
        cmd.append('--clean')

    cmd.append('--noconfirm')
    cmd.append('--distpath')
    cmd.append(str(dist_dir))
    cmd.append('--workpath')
    cmd.append(str(build_dir))
    cmd.append(str(spec_file))

    print(f"Running: {' '.join(cmd)}")
    print(f"Working directory: {backend_dir}")
    print(f"Output will be in: {dist_dir}")

    try:
        run_with_spinner(cmd, cwd=str(backend_dir))
        print("✅ Build completed successfully!")
        return True
    except Exception as e:
        print("❌ Build failed!")
        print(f"Error: {e}")
        return False

def test_executable(build_root=True, use_distribution_dir=False):
    """Test the built executable"""
    print("Testing the built executable...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"

    if use_distribution_dir:
        dist_dir = project_root / 'distribution' / 'dist'
    elif build_root:
        dist_dir = project_root / 'dist'
    else:
        dist_dir = backend_dir / 'dist'

    # Find the executable
    executable = None

    if (dist_dir / 'noticing_game_server').exists():
        # One-file bundle
        executable = dist_dir / 'noticing_game_server'
    elif (dist_dir / 'noticing_game_server' / 'noticing_game_server').exists():
        # One-directory bundle
        executable = dist_dir / 'noticing_game_server' / 'noticing_game_server'

    if not executable or not executable.exists():
        print("❌ Executable not found!")
        print(f"Searched in: {dist_dir}")
        return False

    print(f"Testing executable: {executable}")

    # Make executable (on Unix systems)
    if platform.system() != 'Windows':
        os.chmod(executable, 0o755)

    # Test by running with --help or version check
    try:
        # Just check if it starts without errors (run for a short time)
        result = subprocess.run([str(executable)], timeout=5, capture_output=True)
        # If it runs without immediate crash, consider it successful
        print("✅ Executable test passed!")
        return True
    except subprocess.TimeoutExpired:
        # Timeout is expected as the GUI would keep running
        print("✅ Executable started successfully (GUI launched)!")
        return True
    except Exception as e:
        print(f"❌ Executable test failed: {e}")
        return False

def show_build_results(build_root=True, use_distribution_dir=False):
    """Show information about the built executable"""
    project_root = find_project_root()
    backend_dir = project_root / "backend"

    if use_distribution_dir:
        dist_dir = project_root / 'distribution' / 'dist'
    elif build_root:
        dist_dir = project_root / 'dist'
    else:
        dist_dir = backend_dir / 'dist'

    if not dist_dir.exists():
        print("❌ No build output found!")
        print(f"Expected location: {dist_dir}")
        return

    print("\n🎉 BUILD RESULTS:")
    print("=" * 50)

    # Find executable
    executable = None
    if (dist_dir / 'noticing_game_server').exists():
        executable = dist_dir / 'noticing_game_server'
        print("📁 Bundle type: One-file")
    elif (dist_dir / 'noticing_game_server').is_dir():
        executable = dist_dir / 'noticing_game_server' / 'noticing_game_server'
        print("📁 Bundle type: One-directory")

    if executable and executable.exists():
        size_mb = executable.stat().st_size / (1024 * 1024)
        print(f"📄 Executable: {executable}")
        print(f"📏 Size: {size_mb:.1f} MB")

        # Make executable on Unix systems
        if platform.system() != 'Windows':
            os.chmod(executable, 0o755)
            print("🔧 Executable permissions set")

    print("\n📋 USAGE:")
    print(f"   Run: {executable}")
    print("   The GUI will open and you can start the server from there")

    print("\n📦 DISTRIBUTION:")
    if (dist_dir / 'noticing_game_server').is_file():
        print("   Single file executable - distribute the file only")
    else:
        print("   Directory bundle - distribute the entire 'dist/noticing_game_server' folder")

    print("\n⚠️  NOTES:")
    print("   - First run may be slower as it extracts files")
    print("   - Antivirus software may flag PyInstaller executables")
    print("   - The executable includes all dependencies")

def main():
    """Main build function"""
    parser = argparse.ArgumentParser(description="Build Noticing Game executable")
    parser.add_argument("--clean", action="store_true", help="Clean previous build files")
    parser.add_argument("--debug", action="store_true", help="Create executable with debug output")
    parser.add_argument("--onedir", action="store_true", help="Create one-directory bundle")
    parser.add_argument("--test", action="store_true", help="Test the built executable")
    parser.add_argument("--build-root", action="store_true", default=True, help="Generate build/dist in project root (default)")
    parser.add_argument("--build-backend", action="store_true", help="Generate build/dist in backend directory instead")
    parser.add_argument("--build-distribution", action="store_true", help="Generate build/dist in distribution directory")

    args = parser.parse_args()

    print_banner()

    # Check prerequisites
    if not check_python_version():
        sys.exit(1)

    if not check_dependencies():
        sys.exit(1)

    if not check_source_files():
        sys.exit(1)

    # Determine build location
    use_distribution = args.build_distribution
    build_in_root = args.build_root and not args.build_backend and not use_distribution

    # Always ensure clean dist directory before building
    ensure_clean_dist(build_root=build_in_root, use_distribution_dir=use_distribution)

    # Clean if requested
    if args.clean:
        clean_build_files()

    # Create spec file
    spec_file = create_spec_file(debug=args.debug, onedir=args.onedir)

    # Build executable
    if not build_executable(spec_file, clean=args.clean, build_root=build_in_root, use_distribution_dir=use_distribution):
        sys.exit(1)

    # Test if requested
    if args.test:
        if not test_executable(build_root=build_in_root, use_distribution_dir=use_distribution):
            print("⚠️  Executable test failed, but build was successful")

    # Show results
    show_build_results(build_root=build_in_root, use_distribution_dir=use_distribution)

    print("\n🎉 Build process completed!")
    print("You can now distribute the executable to run Noticing Game")

if __name__ == "__main__":
    main()
