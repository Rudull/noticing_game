#!/usr/bin/env python3
"""
Noticing Game - Windows Service Installer

This script installs the Noticing Game subtitle extraction server as a Windows service,
allowing it to start automatically when the computer boots up.

Requirements:
- Python 3.8+
- pywin32 package (pip install pywin32)
- Administrator privileges (run as administrator)

Usage:
    python install_windows_service.py install    # Install the service
    python install_windows_service.py start      # Start the service
    python install_windows_service.py stop       # Stop the service
    python install_windows_service.py restart    # Restart the service
    python install_windows_service.py remove     # Remove the service
    python install_windows_service.py debug      # Run in debug mode (not as service)

Author: Rafael Hernandez Bustamante
License: GPL-3.0
"""

import sys
import os
import time
import logging
import subprocess
from pathlib import Path

# Check if we're on Windows
if sys.platform != 'win32':
    print("❌ This script is only for Windows systems.")
    print("For other systems, use the regular startup scripts or system service managers.")
    sys.exit(1)

# Try to import Windows service modules
try:
    import win32serviceutil
    import win32service
    import win32event
    import servicemanager
    import socket
except ImportError:
    print("❌ ERROR: pywin32 package is required but not installed.")
    print("\nTo install it, run:")
    print("   pip install pywin32")
    print("\nAfter installation, run:")
    print("   python -m pywin32_postinstall -install")
    print("\nThen try again with administrator privileges.")
    sys.exit(1)

class NoticingGameService(win32serviceutil.ServiceFramework):
    """
    Windows service class for the Noticing Game subtitle extraction server
    """

    # Service configuration
    _svc_name_ = "NoticingGameSubtitleServer"
    _svc_display_name_ = "Noticing Game - Subtitle Extraction Server"
    _svc_description_ = "Backend server for Noticing Game Chrome extension that extracts YouTube subtitles using yt-dlp"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.running = True

        # Setup logging
        self.setup_logging()

        # Get the script directory
        self.script_dir = Path(__file__).parent.parent
        self.server_script = self.script_dir / "subtitle_server.py"

        self.logger.info("Service initialized")
        self.logger.info(f"Script directory: {self.script_dir}")
        self.logger.info(f"Server script: {self.server_script}")

    def setup_logging(self):
        """Setup logging for the service"""
        log_dir = Path.home() / "AppData" / "Local" / "NoticingGame"
        log_dir.mkdir(exist_ok=True)

        log_file = log_dir / "service.log"

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )

        self.logger = logging.getLogger('NoticingGameService')

    def SvcStop(self):
        """Stop the service"""
        self.logger.info("Service stop requested")
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        self.running = False

    def SvcDoRun(self):
        """Main service execution"""
        self.logger.info("Service starting...")

        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )

        self.main()

    def main(self):
        """Main service logic"""
        try:
            # Verify server script exists
            if not self.server_script.exists():
                self.logger.error(f"Server script not found: {self.server_script}")
                return

            # Start the Flask server as a subprocess
            self.logger.info("Starting subtitle extraction server...")

            # Prepare environment
            env = os.environ.copy()
            env['FLASK_ENV'] = 'production'

            # Start the server process
            server_process = subprocess.Popen(
                [sys.executable, str(self.server_script)],
                cwd=str(self.script_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW  # Run without console window
            )

            self.logger.info(f"Server process started with PID: {server_process.pid}")

            # Monitor the service
            while self.running:
                # Check if stop was requested
                if win32event.WaitForSingleObject(self.hWaitStop, 1000) == win32event.WAIT_OBJECT_0:
                    self.logger.info("Stop event received, shutting down...")
                    break

                # Check if server process is still running
                if server_process.poll() is not None:
                    self.logger.error("Server process died unexpectedly")

                    # Try to restart it
                    self.logger.info("Attempting to restart server process...")
                    server_process = subprocess.Popen(
                        [sys.executable, str(self.server_script)],
                        cwd=str(self.script_dir),
                        env=env,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                    self.logger.info(f"Server process restarted with PID: {server_process.pid}")

            # Cleanup
            self.logger.info("Stopping server process...")
            server_process.terminate()

            # Wait a bit for graceful shutdown
            try:
                server_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.logger.warning("Server process didn't stop gracefully, killing it...")
                server_process.kill()

            self.logger.info("Service stopped successfully")

        except Exception as e:
            self.logger.error(f"Service error: {e}")
            raise

def print_banner():
    """Print the service installer banner"""
    print("=" * 70)
    print("🎮 NOTICING GAME - WINDOWS SERVICE INSTALLER")
    print("=" * 70)
    print("Install the subtitle extraction server as a Windows service")
    print("to start automatically when your computer boots up.")
    print()

def check_admin_privileges():
    """Check if running with administrator privileges"""
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def check_dependencies():
    """Check if all required dependencies are available"""
    print("Checking dependencies...")

    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        return False

    print(f"✅ Python version: {sys.version.split()[0]}")

    # Check if subtitle_server.py exists
    script_dir = Path(__file__).parent.parent
    server_script = script_dir / "subtitle_server.py"

    if not server_script.exists():
        print(f"❌ Server script not found: {server_script}")
        print("   Make sure you're running this from the correct directory")
        return False

    print(f"✅ Server script found: {server_script}")

    # Check required Python packages
    required_packages = ['flask', 'flask_cors', 'yt_dlp', 'requests']
    missing_packages = []

    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}: Available")
        except ImportError:
            print(f"❌ {package}: Missing")
            missing_packages.append(package)

    if missing_packages:
        print(f"\n⚠️  Missing packages: {', '.join(missing_packages)}")
        print("Install them with: pip install -r requirements.txt")
        return False

    return True

def install_service():
    """Install the Windows service"""
    print("Installing Noticing Game service...")

    try:
        # Install the service
        win32serviceutil.InstallService(
            NoticingGameService._svc_reg_class_,
            NoticingGameService._svc_name_,
            NoticingGameService._svc_display_name_,
            description=NoticingGameService._svc_description_,
            startType=win32service.SERVICE_AUTO_START  # Start automatically
        )

        print("✅ Service installed successfully!")
        print(f"   Service name: {NoticingGameService._svc_name_}")
        print(f"   Display name: {NoticingGameService._svc_display_name_}")
        print("   Start type: Automatic (starts with Windows)")
        print()
        print("To start the service now, run:")
        print(f"   python {__file__} start")

    except Exception as e:
        print(f"❌ Failed to install service: {e}")
        return False

    return True

def remove_service():
    """Remove the Windows service"""
    print("Removing Noticing Game service...")

    try:
        # Stop the service first if it's running
        try:
            win32serviceutil.StopService(NoticingGameService._svc_name_)
            print("   Service stopped")
        except:
            pass  # Service might not be running

        # Remove the service
        win32serviceutil.RemoveService(NoticingGameService._svc_name_)
        print("✅ Service removed successfully!")

    except Exception as e:
        print(f"❌ Failed to remove service: {e}")
        return False

    return True

def start_service():
    """Start the Windows service"""
    print("Starting Noticing Game service...")

    try:
        win32serviceutil.StartService(NoticingGameService._svc_name_)
        print("✅ Service started successfully!")
        print("   The subtitle extraction server is now running")
        print("   It will start automatically when Windows boots")

    except Exception as e:
        print(f"❌ Failed to start service: {e}")
        return False

    return True

def stop_service():
    """Stop the Windows service"""
    print("Stopping Noticing Game service...")

    try:
        win32serviceutil.StopService(NoticingGameService._svc_name_)
        print("✅ Service stopped successfully!")

    except Exception as e:
        print(f"❌ Failed to stop service: {e}")
        return False

    return True

def restart_service():
    """Restart the Windows service"""
    print("Restarting Noticing Game service...")

    try:
        win32serviceutil.RestartService(NoticingGameService._svc_name_)
        print("✅ Service restarted successfully!")

    except Exception as e:
        print(f"❌ Failed to restart service: {e}")
        return False

    return True

def status_service():
    """Show service status"""
    print("Checking Noticing Game service status...")

    try:
        status = win32serviceutil.QueryServiceStatus(NoticingGameService._svc_name_)
        state = status[1]

        state_names = {
            win32service.SERVICE_STOPPED: "Stopped",
            win32service.SERVICE_START_PENDING: "Start Pending",
            win32service.SERVICE_STOP_PENDING: "Stop Pending",
            win32service.SERVICE_RUNNING: "Running",
            win32service.SERVICE_CONTINUE_PENDING: "Continue Pending",
            win32service.SERVICE_PAUSE_PENDING: "Pause Pending",
            win32service.SERVICE_PAUSED: "Paused"
        }

        state_name = state_names.get(state, f"Unknown ({state})")

        print(f"   Service status: {state_name}")

        if state == win32service.SERVICE_RUNNING:
            print("   ✅ Server is running and available at http://localhost:5000")
        else:
            print("   ⚠️  Server is not running")

    except Exception as e:
        if "specified service does not exist" in str(e).lower():
            print("   ❌ Service is not installed")
        else:
            print(f"   ❌ Error checking status: {e}")

def debug_mode():
    """Run the service in debug mode (not as a service)"""
    print("Running in debug mode...")
    print("Press Ctrl+C to stop")
    print()

    try:
        service = NoticingGameService(['debug'])
        service.main()
    except KeyboardInterrupt:
        print("\nStopped by user")

def show_help():
    """Show help information"""
    print("USAGE:")
    print(f"   python {Path(__file__).name} <command>")
    print()
    print("COMMANDS:")
    print("   install    Install the service (requires admin privileges)")
    print("   remove     Remove the service (requires admin privileges)")
    print("   start      Start the service")
    print("   stop       Stop the service")
    print("   restart    Restart the service")
    print("   status     Show service status")
    print("   debug      Run in debug mode (not as service)")
    print("   help       Show this help")
    print()
    print("EXAMPLES:")
    print("   # Install and start the service")
    print(f"   python {Path(__file__).name} install")
    print(f"   python {Path(__file__).name} start")
    print()
    print("   # Check if it's working")
    print(f"   python {Path(__file__).name} status")
    print()
    print("NOTES:")
    print("   • Run as Administrator for install/remove commands")
    print("   • Service logs are saved to: %USERPROFILE%\\AppData\\Local\\NoticingGame\\service.log")
    print("   • The service will start automatically when Windows boots")
    print("   • Server will be available at http://localhost:5000")

def main():
    """Main function"""
    print_banner()

    if len(sys.argv) < 2:
        show_help()
        return

    command = sys.argv[1].lower()

    if command == 'help':
        show_help()
        return

    # Check admin privileges for install/remove
    if command in ['install', 'remove']:
        if not check_admin_privileges():
            print("❌ ERROR: Administrator privileges required")
            print("   Right-click Command Prompt and select 'Run as administrator'")
            print("   Then run this command again")
            return

        if not check_dependencies():
            print("❌ ERROR: Dependencies check failed")
            print("   Please install missing dependencies first")
            return

    # Execute command
    commands = {
        'install': install_service,
        'remove': remove_service,
        'start': start_service,
        'stop': stop_service,
        'restart': restart_service,
        'status': status_service,
        'debug': debug_mode
    }

    if command in commands:
        try:
            commands[command]()
        except Exception as e:
            print(f"❌ Error executing command '{command}': {e}")
    else:
        print(f"❌ Unknown command: {command}")
        print("Use 'help' to see available commands")

if __name__ == '__main__':
    if len(sys.argv) == 1:
        main()
    else:
        # Handle service management commands
        if sys.argv[1].lower() in ['install', 'remove', 'start', 'stop', 'restart', 'status', 'debug', 'help']:
            main()
        else:
            # Let win32serviceutil handle service-specific commands
            win32serviceutil.HandleCommandLine(NoticingGameService)
