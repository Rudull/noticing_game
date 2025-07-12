#!/usr/bin/env python3
"""
Noticing Game Backend - Server Startup Script

This script helps you start the Noticing Game subtitle extraction server.
It checks dependencies, provides helpful error messages, and starts the server.

Usage:
    python start_server.py

    Or with options:
    python start_server.py --port 5000 --host 127.0.0.1 --debug
"""

import sys
import os
import argparse
import subprocess
import platform
import json
from pathlib import Path

def load_config():
    """Load configuration from file"""
    default_config = {
        'server_host': '127.0.0.1',
        'server_port': 5000
    }

    config_file = Path.home() / ".noticing_game_config.json"

    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
                # Merge with defaults to ensure all keys exist
                return {**default_config, **config}
        except Exception as e:
            print(f"⚠️  Warning: Error loading config from {config_file}: {e}")
            print("Using default configuration")
            return default_config
    else:
        return default_config

def print_banner():
    """Print the startup banner"""
    print("=" * 60)
    print("🎮 NOTICING GAME - SUBTITLE EXTRACTION SERVER")
    print("=" * 60)
    print("Backend server for YouTube subtitle extraction")
    print("Using yt-dlp for reliable subtitle access")
    print()

def check_python_version():
    """Check if Python version is compatible"""
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 8):
        print("❌ ERROR: Python 3.8 or higher is required")
        print(f"   Current version: {sys.version}")
        print("   Please upgrade Python and try again.")
        return False

    print(f"✅ Python version: {sys.version.split()[0]} (Compatible)")
    return True

def check_dependencies():
    """Check if all required dependencies are installed"""
    required_packages = [
        ('flask', 'Flask'),
        ('flask_cors', 'Flask-CORS'),
        ('yt_dlp', 'yt-dlp'),
        ('requests', 'requests')
    ]

    missing_packages = []

    for package_name, display_name in required_packages:
        try:
            __import__(package_name)
            print(f"✅ {display_name}: Installed")
        except ImportError:
            print(f"❌ {display_name}: Missing")
            missing_packages.append(display_name)

    if missing_packages:
        print("\n⚠️  Missing dependencies detected!")
        print("To install missing packages, run:")
        print(f"   pip install {' '.join(pkg.lower().replace('-', '_') for pkg in missing_packages)}")
        print("\nOr install all requirements:")
        print("   pip install -r requirements.txt")
        return False

    return True

def check_server_file():
    """Check if the main server file exists"""
    server_file = Path(__file__).parent / "subtitle_server.py"
    if not server_file.exists():
        print("❌ ERROR: subtitle_server.py not found")
        print(f"   Expected location: {server_file}")
        print("   Please ensure you're in the correct directory.")
        return False

    print(f"✅ Server file: {server_file}")
    return True

def check_port_available(host, port):
    """Check if the specified port is available"""
    import socket

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex((host, port))
            if result == 0:
                print(f"⚠️  Port {port} is already in use on {host}")
                return False
            else:
                print(f"✅ Port {port} is available on {host}")
                return True
    except Exception as e:
        print(f"⚠️  Could not check port availability: {e}")
        return True  # Assume it's available

def install_dependencies():
    """Try to install dependencies automatically"""
    print("\n🔧 Attempting to install dependencies...")

    try:
        # Check if pip is available
        subprocess.run([sys.executable, "-m", "pip", "--version"],
                      check=True, capture_output=True)

        # Install requirements
        requirements_file = Path(__file__).parent / "requirements.txt"
        if requirements_file.exists():
            print("   Installing from requirements.txt...")
            subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)],
                          check=True)
            print("✅ Dependencies installed successfully!")
            return True
        else:
            print("   Installing individual packages...")
            packages = ["flask", "flask-cors", "yt-dlp", "requests"]
            subprocess.run([sys.executable, "-m", "pip", "install"] + packages,
                          check=True)
            print("✅ Dependencies installed successfully!")
            return True

    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False
    except FileNotFoundError:
        print("❌ pip not found. Please install pip first.")
        return False

def get_system_info():
    """Get system information for debugging"""
    return {
        'platform': platform.system(),
        'platform_version': platform.version(),
        'python_version': sys.version,
        'cwd': os.getcwd(),
        'script_dir': str(Path(__file__).parent)
    }

def print_startup_info(host, port):
    """Print server startup information"""
    print("\n🚀 STARTING SERVER...")
    print(f"   Host: {host}")
    print(f"   Port: {port}")
    print(f"   URL: http://{host}:{port}")
    print()
    print("📋 AVAILABLE ENDPOINTS:")
    print(f"   Health Check: http://{host}:{port}/")
    print(f"   Extract Subtitles: http://{host}:{port}/extract-subtitles")
    print()
    print("📚 USAGE:")
    print("   POST /extract-subtitles")
    print('   Body: {"url": "https://www.youtube.com/watch?v=VIDEO_ID"}')
    print()
    print("   GET /extract-subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID")
    print()
    print("⚠️  IMPORTANT:")
    print("   - Keep this server running while using the Chrome extension")
    print("   - The server must be accessible from your browser")
    print("   - Press Ctrl+C to stop the server")
    print()

def main():
    """Main startup function"""
    # Load configuration from file first
    config = load_config()

    parser = argparse.ArgumentParser(description="Start the Noticing Game subtitle server")
    parser.add_argument("--host", default=config['server_host'], help=f"Host to bind to (default: {config['server_host']})")
    parser.add_argument("--port", type=int, default=config['server_port'], help=f"Port to bind to (default: {config['server_port']})")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument("--auto-install", action="store_true", help="Automatically install missing dependencies")
    parser.add_argument("--system-info", action="store_true", help="Print system information and exit")

    args = parser.parse_args()

    # Print banner
    print_banner()

    # Print system info if requested
    if args.system_info:
        info = get_system_info()
        print("🖥️  SYSTEM INFORMATION:")
        for key, value in info.items():
            print(f"   {key}: {value}")
        return

    # Check Python version
    if not check_python_version():
        sys.exit(1)

    # Check if server file exists
    if not check_server_file():
        sys.exit(1)

    # Check dependencies
    if not check_dependencies():
        if args.auto_install:
            if not install_dependencies():
                sys.exit(1)
            # Recheck after installation
            if not check_dependencies():
                print("❌ Dependencies still missing after installation")
                sys.exit(1)
        else:
            print("\n💡 TIP: Use --auto-install to automatically install missing dependencies")
            print("   python start_server.py --auto-install")
            sys.exit(1)

    # Check port availability
    check_port_available(args.host, args.port)

    # Print startup information
    print_startup_info(args.host, args.port)

    # Show if using config file or command line arguments
    if args.host != config['server_host'] or args.port != config['server_port']:
        print("💡 Using command line arguments (overriding config file)")
    else:
        config_file = Path.home() / ".noticing_game_config.json"
        if config_file.exists():
            print(f"📁 Using configuration from: {config_file}")
        else:
            print("📁 Using default configuration (no config file found)")

    try:
        # Import and start the server
        sys.path.insert(0, str(Path(__file__).parent))
        from subtitle_server import app

        print("🎬 Server is starting...")
        print("   Waiting for requests...")

        # Start the Flask server
        app.run(
            host=args.host,
            port=args.port,
            debug=args.debug,
            threaded=True
        )

    except ImportError as e:
        print(f"❌ Failed to import server: {e}")
        print("   Make sure subtitle_server.py is in the same directory")
        sys.exit(1)
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {args.port} is already in use")
            print("   Try a different port: python start_server.py --port 5001")
        else:
            print(f"❌ Network error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
        print("   Goodbye!")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        print("\n🐛 DEBUG INFO:")
        info = get_system_info()
        for key, value in info.items():
            print(f"   {key}: {value}")
        sys.exit(1)

if __name__ == "__main__":
    main()
