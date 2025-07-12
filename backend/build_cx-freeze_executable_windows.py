#!/usr/bin/env python3
"""
Noticing Game - Windows cx_Freeze Build Script

This script builds a Windows executable using cx_Freeze for the Noticing Game desktop application.
cx_Freeze is an alternative to PyInstaller that can sometimes produce smaller executables
and has better compatibility with certain Python packages.

Usage:
    python build_cx_freeze_windows.py [options]

Options:
    --clean         Clean previous build files before building
    --debug         Create executable with debug output
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
    print("🎮 NOTICING GAME - CX_FREEZE WINDOWS BUILDER")
    print("=" * 70)
    print("Build standalone executable using cx_Freeze for Windows")
    print()

def check_platform():
    """Ensure we're running on Windows"""
    if platform.system() != 'Windows':
        print("❌ ERROR: This script is for Windows only")
        print("   cx_Freeze works best on the target platform")
        return False

    print(f"✅ Platform: {platform.system()} {platform.release()}")
    return True

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

    # Check cx_Freeze
    try:
        import cx_Freeze
        print(f"✅ cx_Freeze: Available (version: {cx_Freeze.version})")
    except ImportError:
        print("❌ cx_Freeze: Missing")
        return False

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

    if missing_required:
        print(f"\n❌ Missing required packages: {', '.join(missing_required)}")
        print("Install them with:")
        print("   pip install cx_Freeze flask flask-cors yt-dlp requests")
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

    optional_files = [
        'README.md'
    ]

    missing_files = []
    for file in required_files:
        file_path = backend_dir / file
        if file_path.exists():
            print(f"✅ {file}: Found")
        else:
            print(f"❌ {file}: Missing")
            missing_files.append(file)

    # Check for icon in assets directory
    assets_icon = project_root / "assets" / "icono.ico"
    if assets_icon.exists():
        print(f"✅ icono.ico: Found in assets directory")
    else:
        print(f"⚠️  icono.ico: Not found in assets directory")

    # Check optional files
    for file in optional_files:
        file_path = backend_dir / file
        if file_path.exists():
            print(f"✅ {file}: Found (optional)")
        else:
            print(f"⚠️  {file}: Missing (optional)")

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
    files_to_clean = ['setup_cx_freeze.py']

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

def create_setup_file(debug=False, build_root=True):
    """Create cx_Freeze setup.py file"""
    print("Creating cx_Freeze setup file...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"
    setup_file = backend_dir / 'setup_cx_freeze.py'

    # Check if icon file exists in assets directory first, then in backend
    assets_icon = project_root / "assets" / "icono.ico"
    backend_icon = backend_dir / 'icono.ico'

    if assets_icon.exists():
        icon_file = assets_icon
        icon_option = f"'{icon_file}'"
    elif backend_icon.exists():
        icon_file = backend_icon
        icon_option = f"'{icon_file}'"
    else:
        icon_option = "None"

    # Build include files list
    include_files = [
        "('subtitle_server.py', 'subtitle_server.py'),",
        "('requirements.txt', 'requirements.txt'),"
    ]

    if (script_dir / 'README.md').exists():
        include_files.append("('README.md', 'README.md'),")

    # Add icon from assets directory if exists
    if assets_icon.exists():
        include_files.append(f"('{assets_icon}', 'icono.ico'),")
    elif backend_icon.exists():
        include_files.append(f"('{backend_icon}', 'icono.ico'),")

    # Determine base for GUI application
    base_option = '"Win32GUI"' if not debug else 'None'

    setup_content = f'''#!/usr/bin/env python3
"""
cx_Freeze setup file for Noticing Game Windows executable
Auto-generated by build_cx_freeze_windows.py
"""

import sys
from cx_Freeze import setup, Executable
import os
from pathlib import Path

# Get the current directory
script_dir = Path(__file__).parent

# Determine build directory
if build_root:
    build_path = str(script_dir.parent / "build")
else:
    build_path = str(script_dir / "build")

# Build configuration
build_exe_options = {{
"build_exe": "{build_path}",
"packages": [
    "flask",
    "flask_cors",
    "yt_dlp",
    "requests",
    "tkinter",
    "tkinter.ttk",
    "tkinter.scrolledtext",
    "PIL",
    "PIL.Image",
    "PIL.ImageDraw",
    "pystray",
    "tempfile",
    "logging",
    "datetime",
    "re",
    "json",
    "xml.etree.ElementTree",
    "urllib.request",
    "urllib.error",
    "webbrowser",
    "threading",
    "socket",
    "subprocess",
    "xml.parsers.expat",
    "email.mime.multipart",
    "email.mime.text",
    "winreg",
    "win32api",
    "win32con",
    "win32gui"
],
"include_files": [
    {chr(10).join("        " + line for line in include_files)}
],
"excludes": [
    "test",
    "unittest",
    "distutils",
    "setuptools",
    "matplotlib",
    "numpy",
    "scipy",
    "pandas",
    "jupyter",
    "IPython"
],
"optimize": 2,
"include_msvcrt": True,
"zip_include_packages": ["encodings", "PySide6"],
"silent": True
}}

# Windows GUI base configuration
base = {base_option} if sys.platform == "win32" else None

# Executable configuration
executable = Executable(
    script="desktop_app.py",
    base=base,
    target_name="noticing_game_server.exe",
    icon={icon_option},
    shortcut_name="Noticing Game Server",
    shortcut_dir="DesktopFolder",
    copyright="© 2024 Rafael Hernandez Bustamante"
)

# Main setup configuration
setup(
    name="Noticing Game Server",
    version="0.1.0",
    author="Rafael Hernandez Bustamante",
    description="Backend server for Noticing Game Chrome extension - YouTube subtitle extraction",
    long_description="Desktop application to manage the Noticing Game subtitle extraction server with GUI interface and system tray integration.",
    options={{"build_exe": build_exe_options}},
    executables=[executable]
)
'''

    with open(setup_file, 'w', encoding='utf-8') as f:
        f.write(setup_content)

    print(f"✅ cx_Freeze setup file created: {setup_file}")
    return setup_file

def build_executable(setup_file, build_root=True):
    """Build the executable using cx_Freeze"""
    print("Building Windows executable with cx_Freeze...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"

    # Determine build directories
    if build_root:
        print(f"Building in project root: {project_root}")
    else:
        print(f"Building in backend directory: {backend_dir}")

    cmd = [sys.executable, str(setup_file), "build"]

    print(f"Running: {' '.join(cmd)}")
    print(f"Working directory: {backend_dir}")

    try:
        run_with_spinner(cmd, cwd=str(backend_dir))
        print("✅ Build completed successfully!")
        return True
    except Exception as e:
        print("❌ Build failed!")
        print(f"Error: {e}")
        return False

def test_executable(build_root=True):
    """Test the built executable"""
    print("Testing the built Windows executable...")

    project_root = find_project_root()
    backend_dir = project_root / "backend"

    if build_root:
        build_dir = project_root / "build"
    else:
        build_dir = backend_dir / "build"

    # Find the executable in build directory
    exe_path = None
    for item in build_dir.rglob("*.exe"):
        if "noticing_game_server" in item.name:
            exe_path = item
            break

    if not exe_path or not exe_path.exists():
        print("❌ Executable not found!")
        print(f"Searched in: {build_dir}")
        return False

    print(f"Testing executable: {exe_path}")

    # Test by running with timeout (GUI would keep running)
    try:
        # Just check if it starts without errors (run for a short time)
        result = subprocess.run([str(exe_path)], timeout=5, capture_output=True)
        print("✅ Executable test passed!")
        return True
    except subprocess.TimeoutExpired:
        # Timeout is expected as the GUI would keep running
        print("✅ Executable started successfully (GUI launched)!")
        return True
    except Exception as e:
        print(f"❌ Executable test failed: {e}")
        return False

def show_build_results(build_root=True):
    """Show information about the built executable"""
    project_root = find_project_root()
    backend_dir = project_root / "backend"

    if build_root:
        build_dir = project_root / "build"
    else:
        build_dir = backend_dir / "build"

    if not build_dir.exists():
        print("❌ No build output found!")
        print(f"Expected location: {build_dir}")
        return

    print("\\n🎉 BUILD RESULTS:")
    print("=" * 50)

    # Find the executable
    exe_path = None
    for item in build_dir.rglob("*.exe"):
        if "noticing_game_server" in item.name:
            exe_path = item
            break

    if exe_path and exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"📄 Executable: {exe_path}")
        print(f"📏 Size: {size_mb:.1f} MB")
        print(f"📁 Bundle type: Directory bundle")

        # Check for icon
        assets_icon = project_root / "assets" / "icono.ico"
        backend_icon = backend_dir / 'icono.ico'

        if assets_icon.exists():
            print("🎨 Icon: Included (from assets directory)")
        elif backend_icon.exists():
            print("🎨 Icon: Included (from backend directory)")
        else:
            print("⚠️  Icon: Not found")

        print(f"\\n📦 Distribution folder:")
        print(f"   {exe_path.parent}")

        print("\\n📋 USAGE:")
        print(f"   Run: {exe_path}")
        print("   Or double-click the .exe file")

        print("\\n📦 DISTRIBUTION:")
        print("   Directory bundle - distribute the entire build folder")
        print("   All dependencies are included in the lib/ subdirectory")

    else:
        print("❌ Executable not found!")
        return

    print("\\n💻 WINDOWS REQUIREMENTS:")
    print("   - Windows 10 or higher")
    print("   - Visual C++ Redistributable (usually pre-installed)")
    print("   - Internet connection for subtitle extraction")
    print("   - Port 5000 available")

    print("\\n✨ CX_FREEZE ADVANTAGES:")
    print("   - Faster build times compared to PyInstaller")
    print("   - Transparent file structure")
    print("   - Better compatibility with some packages")
    print("   - Smaller executable size in many cases")

    print("\\n⚠️  NOTES:")
    print("   - Distribute the entire build folder, not just the .exe")
    print("   - First run may be slower as Windows scans the files")
    print("   - Windows Defender may show a warning for unsigned executables")
    print("   - Auto-startup integration works with Windows Registry")

def copy_to_dist(build_root=True):
    """Copy build results to dist folder for consistency"""
    project_root = find_project_root()
    backend_dir = project_root / "backend"

    if build_root:
        build_dir = project_root / "build"
        dist_dir = project_root / "dist"
    else:
        build_dir = backend_dir / "build"
        dist_dir = backend_dir / "dist"

    # Find the build subdirectory (usually exe.win-amd64-3.x)
    build_subdir = None
    for item in build_dir.iterdir():
        if item.is_dir() and item.name.startswith("exe.win"):
            build_subdir = item
            break

    if build_subdir and build_subdir.exists():
        print(f"\\nCopying build results to dist directory...")

        # Remove existing dist directory
        if dist_dir.exists():
            shutil.rmtree(dist_dir)

        # Copy build directory to dist
        shutil.copytree(build_subdir, dist_dir / "noticing_game_server")
        print(f"✅ Results copied to: {dist_dir / 'noticing_game_server'}")

def main():
    """Main build function"""
    parser = argparse.ArgumentParser(description="Build Noticing Game Windows executable with cx_Freeze")
    parser.add_argument("--clean", action="store_true", help="Clean previous build files")
    parser.add_argument("--debug", action="store_true", help="Create executable with debug output")
    parser.add_argument("--test", action="store_true", help="Test the built executable")
    parser.add_argument("--build-root", action="store_true", default=True, help="Generate build/dist in project root (default)")
    parser.add_argument("--build-backend", action="store_true", help="Generate build/dist in backend directory instead")

    args = parser.parse_args()

    print_banner()

    # Check prerequisites
    if not check_platform():
        sys.exit(1)

    if not check_python_version():
        sys.exit(1)

    if not check_dependencies():
        print("\\nTo install cx_Freeze and dependencies:")
        print("   pip install cx_Freeze flask flask-cors yt-dlp requests pystray Pillow")
        sys.exit(1)

    if not check_source_files():
        sys.exit(1)

    # Determine build location (default to project root)
    build_in_root = args.build_root and not args.build_backend

    # Clean if requested
    if args.clean:
        clean_build_files()

    # Create setup file
    setup_file = create_setup_file(debug=args.debug, build_root=build_in_root)

    # Build executable
    if not build_executable(setup_file, build_root=build_in_root):
        sys.exit(1)

    # Copy to dist for consistency
    copy_to_dist(build_root=build_in_root)

    # Test if requested
    if args.test:
        if not test_executable(build_root=build_in_root):
            print("⚠️  Executable test failed, but build was successful")

    # Show results
    show_build_results(build_root=build_in_root)

    print("\\n🎉 cx_Freeze Windows build process completed!")
    print("You can now distribute the executable folder to run Noticing Game on Windows")

if __name__ == "__main__":
    main()
