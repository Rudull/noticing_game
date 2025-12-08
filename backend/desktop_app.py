#!/usr/bin/env python3
"""
Noticing Game - Desktop Server Manager

A simple desktop application to manage the Noticing Game subtitle extraction server.
Provides an easy-to-use GUI for starting, stopping, and monitoring the server.

Features:
- Start/Stop server with one click
- Real-time server status monitoring
- Auto-start configuration
- Log viewer
- System tray integration
- Setup wizard for first-time users
- Auto-startup with OS

Requirements:
- Python 3.8+
- tkinter (usually included with Python)
- Optional: pystray for system tray (pip install pystray Pillow)

Usage:
    python desktop_app.py

Author: Rafael Hernandez Bustamante
License: GPL-3.0
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import threading
import subprocess
import time
import json
import sys
import os
import platform
import webbrowser
from pathlib import Path
import logging
from datetime import datetime
import tempfile
import requests
import re

VERSION = "0.1.2"
GITHUB_REPO = "Rudull/noticing_game"
GITHUB_RAW_URL = f"https://raw.githubusercontent.com/{GITHUB_REPO}/main/backend/desktop_app.py"

# Optional system tray support
try:
    import pystray
    from PIL import Image, ImageDraw
    TRAY_AVAILABLE = True
except ImportError:
    TRAY_AVAILABLE = False

class NoticingGameServerManager:
    """Main application class for the server manager"""

    def __init__(self):
        self.root = tk.Tk()
        self.server_process = None
        self.server_thread = None
        self.flask_app = None
        self.is_server_running = False
        self.auto_check_enabled = True
        self.tray_icon = None
        self.is_frozen = getattr(sys, 'frozen', False)
        self.latest_version = None
        self.download_url = None

        # UI Colors matching the extension
        self.primary_color = "#6544e9"
        self.primary_hover = "#5435d0"

        # Configuration
        self.config_file = Path.home() / ".noticing_game_config.json"
        self.load_config()

        # Setup logging
        self.setup_logging()

        # Find server script or prepare for embedded mode
        if self.is_frozen:
            # Running as PyInstaller executable
            self.script_dir = Path(sys.executable).parent
            self.server_script = None  # Will run embedded server
            # Icon path for executable (try to find in assets)
            self.icon_path = self.script_dir.parent / "assets" / "icono.ico"
            if not self.icon_path.exists():
                self.icon_path = self.script_dir / "icono.ico"
        else:
            # Running as Python script
            self.script_dir = Path(__file__).parent
            self.server_script = self.script_dir / "subtitle_server.py"
            # Icon path for development (use from assets directory)
            self.icon_path = self.script_dir.parent / "assets" / "icono.ico"

        # Setup GUI
        self.setup_gui()

        # Start status monitoring
        self.start_status_monitoring()

        # Setup system tray if available
        if TRAY_AVAILABLE and self.config.get('enable_tray', True):
            self.setup_system_tray()

        # Setup auto-startup if enabled
        self.setup_auto_startup()

        # Cleanup old update files
        self.cleanup_old_updates()

        # Check for updates
        threading.Thread(target=self.check_updates, daemon=True).start()

    def load_config(self):
        """Load configuration from file"""
        default_config = {
            'auto_start': False,
            'minimize_to_tray': True,
            'enable_tray': True,
            'check_interval': 5,
            'server_host': '127.0.0.1',
            'server_port': 5000,
            'auto_startup_os': False,
            # 'window_geometry': '950x700',  # Eliminado para no guardar/restaurar tamaño
            'window_position': None
        }

        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    self.config = {**default_config, **json.load(f)}
            except Exception as e:
                print(f"Error loading config: {e}")
                self.config = default_config
        else:
            self.config = default_config

    def save_config(self):
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")

    def setup_logging(self):
        """Setup logging for the application"""
        log_dir = Path.home() / ".noticing_game_logs"
        log_dir.mkdir(exist_ok=True)

        log_file = log_dir / "desktop_app.log"

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )

        self.logger = logging.getLogger('NoticingGameDesktop')

    def setup_gui(self):
        """Setup the main GUI"""
        self.root.title("Noticing Game - Server Manager")

        # Set fixed geometry for a smaller UI (no restaurar desde config)
        self.root.geometry('600x420')
        self.root.minsize(600, 420)

        self.root.resizable(True, True)

        # Configure style
        style = ttk.Style()
        style.theme_use('clam')

        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)

        # Server status section
        status_frame = ttk.LabelFrame(main_frame, text="Server Status", padding="10")
        status_frame.grid(row=0, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        status_frame.columnconfigure(1, weight=1)

        ttk.Label(status_frame, text="Status:").grid(row=0, column=0, sticky=tk.W)
        self.status_label = ttk.Label(status_frame, text="Checking...",
                                     font=('Arial', 10, 'bold'), foreground="#999999")
        self.status_label.grid(row=0, column=1, sticky=tk.W, padx=(10, 0))

        ttk.Label(status_frame, text="URL:").grid(row=1, column=0, sticky=tk.W)
        server_url = f"http://{self.config.get('server_host', '127.0.0.1')}:{self.config.get('server_port', 5000)}"
        self.url_label = ttk.Label(status_frame, text=server_url,
                                  foreground="blue", cursor="hand2")
        self.url_label.grid(row=1, column=1, sticky=tk.W, padx=(10, 0))
        self.url_label.bind("<Button-1>", self.open_server_url)

        # Control buttons - all in horizontal layout
        control_frame = ttk.Frame(main_frame)
        control_frame.grid(row=1, column=0, columnspan=3, pady=(0, 10))

        # Single row with all buttons horizontally arranged
        button_frame = ttk.Frame(control_frame)
        button_frame.pack(fill=tk.X, pady=5)

        self.start_button = ttk.Button(button_frame, text="Start Server",
                                      command=self.start_server, style="success.TButton")
        self.start_button.pack(side=tk.LEFT, padx=(0, 10))

        self.stop_button = ttk.Button(button_frame, text="Stop Server",
                                     command=self.stop_server, style="danger.TButton")
        self.stop_button.pack(side=tk.LEFT, padx=(0, 10))

        self.restart_button = ttk.Button(button_frame, text="Restart",
                                        command=self.restart_server)
        self.restart_button.pack(side=tk.LEFT, padx=(0, 10))

        self.settings_button = ttk.Button(button_frame, text="Settings",
                                         command=self.show_settings)
        self.settings_button.pack(side=tk.LEFT, padx=(0, 10))

        self.update_button = ttk.Button(button_frame, text="Update Available!",
                                       command=self.perform_update, style="success.TButton")
        # Don't pack it yet, only when update is available

        # Create circular About button with info icon
        self.about_button = ttk.Button(button_frame, text="ℹ",
                                      command=self.show_about, width=5)
        self.about_button.pack(side=tk.LEFT, padx=(0, 10))

        # Log button creation for debugging
        self.logger.info("UI buttons created: Start, Stop, Restart, Settings, About")

        # Log viewer
        log_frame = ttk.LabelFrame(main_frame, text="Server Log", padding="10")
        log_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        main_frame.rowconfigure(2, weight=1)

        self.log_text = scrolledtext.ScrolledText(log_frame, height=8, width=45)
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Log controls
        log_controls = ttk.Frame(log_frame)
        log_controls.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(5, 0))

        ttk.Button(log_controls, text="Clear Log",
                  command=self.clear_log).pack(side=tk.LEFT)
        ttk.Button(log_controls, text="Save Log",
                  command=self.save_log).pack(side=tk.LEFT, padx=(5, 0))

        # Status bar
        self.status_bar = ttk.Label(main_frame, text="Ready", relief=tk.SUNKEN)
        self.status_bar.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 0))

        # Setup window close handler
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        # Configure custom button styles with violet theme
        style.configure("success.TButton", foreground="green")
        style.configure("danger.TButton", foreground="red")
        style.configure("violet.TLabel", foreground="#6544e9", font=('Arial', 10, 'bold'))

        # Ensure all buttons are visible and properly rendered
        self.root.update_idletasks()
        self.ensure_ui_visibility()

    def ensure_ui_visibility(self):
        """Ensure all UI elements are visible and properly configured"""
        try:
            # Force update of all widgets
            self.root.update()

            # Ensure all buttons are configured and visible
            buttons = [
                ("Start", self.start_button),
                ("Stop", self.stop_button),
                ("Restart", self.restart_button),
                ("Settings", self.settings_button),
                ("Update", self.update_button),
                ("About", self.about_button)
            ]

            visible_buttons = []
            for name, button in buttons:
                if button:
                    button.update_idletasks()
                    # Ensure button is properly packed and visible
                    if not button.winfo_viewable() and name != "Update":
                        button.pack_configure()
                        # Additional force for PyInstaller
                        if self.is_frozen:
                            button.pack(side=tk.LEFT, padx=(0, 10))
                    visible_buttons.append(name)
                else:
                    self.logger.warning(f"Button '{name}' is None!")

            self.logger.info(f"UI visibility check - visible buttons: {', '.join(visible_buttons)}")

            # Special handling for PyInstaller executables
            if self.is_frozen:
                self.logger.info("Running as PyInstaller executable - applying additional UI fixes")
                # Force re-pack all buttons to ensure visibility
                for name, button in buttons:
                    if button and hasattr(button, 'pack'):
                        try:
                            button.pack_forget()
                            if name != "Update" or self.latest_version:
                                button.pack(side=tk.LEFT, padx=(0, 10))
                        except Exception as pack_error:
                            self.logger.warning(f"Failed to re-pack {name} button: {pack_error}")

            # Force refresh of main window
            self.root.geometry(self.root.geometry())

        except Exception as e:
            self.logger.error(f"Error ensuring UI visibility: {e}")

    def create_tray_image(self, color="active"):
        """Create system tray icon as simple colored circle with antialiasing for a cleaner look"""
        # Draw at higher resolution for antialiasing, then downscale
        high_res_size = 128
        final_size = 32
        image = Image.new('RGBA', (high_res_size, high_res_size), (0, 0, 0, 0))  # Transparent background
        draw = ImageDraw.Draw(image)

        center = high_res_size // 2
        outer_radius = center - 8  # Borde exterior
        border_width = 14  # Borde visible en alta resolución
        inner_radius = outer_radius - border_width

        if color == "active":
            # Active - violet color matching the Chrome extension UI
            fill_color = (101, 68, 233, 255)  # #6544e9 - primary violet
            border_color = (85, 53, 208, 255)  # Darker violet for border
        else:
            # Inactive - gray
            fill_color = (128, 128, 128, 255)  # Gray
            border_color = (96, 96, 96, 255)   # Darker gray for border

        # Dibuja el borde (círculo exterior)
        draw.ellipse(
            [center - outer_radius, center - outer_radius, center + outer_radius, center + outer_radius],
            fill=border_color
        )
        # Dibuja el círculo interior (relleno)
        draw.ellipse(
            [center - inner_radius, center - inner_radius, center + inner_radius, center + inner_radius],
            fill=fill_color
        )

        # Downscale with antialiasing for smooth edges
        image = image.resize((final_size, final_size), resample=Image.LANCZOS)

        # Limpieza de canal alfa en las esquinas: fuerza transparencia fuera del círculo
        from math import hypot
        pixels = image.load()
        center = final_size // 2
        radius = (final_size // 2) - 1  # Ajuste para que el círculo no toque los bordes

        for y in range(final_size):
            for x in range(final_size):
                if hypot(x - center, y - center) > radius:
                    r, g, b, a = pixels[x, y]
                    pixels[x, y] = (r, g, b, 0)

        return image

    def setup_system_tray(self):
        """Setup system tray icon"""
        def show_window(icon, item):
            self.root.deiconify()
            self.root.lift()

        def quit_app(icon, item):
            self.quit_application()

        def toggle_server(icon, item):
            if self.is_server_running:
                self.stop_server()
            else:
                self.start_server()

        # Create menu
        menu = pystray.Menu(
            pystray.MenuItem("Show", show_window, default=True),
            pystray.MenuItem("Start/Stop Server", toggle_server),
            pystray.MenuItem("Quit", quit_app)
        )

        # Create tray icon with active color initially
        self.tray_icon = pystray.Icon(
            "noticing_game",
            self.create_tray_image("active"),
            "Noticing Game Server",
            menu
        )

    def update_tray_icon(self, running):
        """Update tray icon based on server status"""
        if self.tray_icon:
            color = "active" if running else "inactive"
            self.tray_icon.icon = self.create_tray_image(color)
            status = "Running" if running else "Stopped"
            self.tray_icon.title = f"Noticing Game Server - {status}"

    def setup_auto_startup(self):
        """Setup auto-startup with operating system if enabled"""
        if not self.config.get('auto_startup_os', False):
            return

        try:
            if platform.system() == "Windows":
                self.setup_windows_startup()
            elif platform.system() == "Linux":
                self.setup_linux_startup()
            elif platform.system() == "Darwin":  # macOS
                self.setup_macos_startup()
        except Exception as e:
            self.logger.error(f"Error setting up auto-startup: {e}")

    def setup_windows_startup(self):
        """Setup Windows startup entry"""
        try:
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            app_name = "NoticingGameServer"
            app_path = f'"{sys.executable}" "{__file__}"'

            if self.config.get('auto_startup_os', False):
                # Add to startup
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
                    winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, app_path)
            else:
                # Remove from startup
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
                        winreg.DeleteValue(key, app_name)
                except FileNotFoundError:
                    pass  # Key doesn't exist, nothing to remove

        except ImportError:
            self.logger.warning("winreg not available for Windows startup setup")
        except Exception as e:
            self.logger.error(f"Error setting up Windows startup: {e}")

    def setup_linux_startup(self):
        """Setup Linux startup entry (XDG autostart)"""
        try:
            autostart_dir = Path.home() / ".config" / "autostart"
            autostart_dir.mkdir(parents=True, exist_ok=True)

            desktop_file = autostart_dir / "noticing-game-server.desktop"

            if self.config.get('auto_startup_os', False):
                # Create desktop entry
                desktop_content = f"""[Desktop Entry]
Type=Application
Name=Noticing Game Server
Comment=Subtitle extraction server for Noticing Game
Exec={sys.executable} "{__file__}"
Icon={self.script_dir}/icon.png
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
"""
                desktop_file.write_text(desktop_content)
            else:
                # Remove desktop entry
                if desktop_file.exists():
                    desktop_file.unlink()

        except Exception as e:
            self.logger.error(f"Error setting up Linux startup: {e}")

    def setup_macos_startup(self):
        """Setup macOS startup entry (LaunchAgent)"""
        try:
            launch_agents_dir = Path.home() / "Library" / "LaunchAgents"
            launch_agents_dir.mkdir(parents=True, exist_ok=True)

            plist_file = launch_agents_dir / "com.noticingame.server.plist"

            if self.config.get('auto_startup_os', False):
                # Create plist
                plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.noticingame.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>{sys.executable}</string>
        <string>{__file__}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
"""
                plist_file.write_text(plist_content)

                # Load the plist
                subprocess.run(["launchctl", "load", str(plist_file)], check=True)
            else:
                # Unload and remove plist
                if plist_file.exists():
                    try:
                        subprocess.run(["launchctl", "unload", str(plist_file)], check=True)
                    except subprocess.CalledProcessError:
                        pass  # May not be loaded
                    plist_file.unlink()

        except Exception as e:
            self.logger.error(f"Error setting up macOS startup: {e}")

    def start_status_monitoring(self):
        """Start background thread to monitor server status"""
        def monitor():
            while self.auto_check_enabled:
                try:
                    self.check_server_status()
                    time.sleep(self.config.get('check_interval', 5))
                except Exception as e:
                    self.logger.error(f"Error in status monitoring: {e}")
                    time.sleep(5)

        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()

    def is_port_available(self, host, port):
        """Check if a port is available for binding"""
        try:
            import socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind((host, port))
                return True
        except socket.error:
            return False

    def check_server_status(self):
        """Check if the server is running"""
        try:
            import urllib.request
            import urllib.error
            import socket

            host = self.config.get('server_host', '127.0.0.1')
            port = self.config.get('server_port', 5000)
            url = f"http://{host}:{port}"

            # First check if port is open (faster than HTTP request)
            try:
                with socket.create_connection((host, port), timeout=1):
                    pass
            except (socket.error, socket.timeout):
                # Port is not open
                self.update_status(False, "Stopped")
                return False

            # Port is open, now check HTTP response
            try:
                with urllib.request.urlopen(url, timeout=3) as response:
                    if response.getcode() == 200:
                        self.update_status(True, "Running")
                        return True
            except (urllib.error.URLError, urllib.error.HTTPError, socket.timeout):
                # Port is open but HTTP failed
                self.update_status(False, "Error")
                return False

            self.update_status(False, "Stopped")
            return False

        except Exception as e:
            self.logger.error(f"Error checking server status: {e}")
            self.update_status(False, "Error")
            return False

    def update_status(self, running, status_text):
        """Update the server status in the GUI"""
        try:
            self.is_server_running = running

            # Update status label with violet color when running
            status_display = f"{status_text} {'✓' if running else '✗'}"
            if running:
                self.status_label.config(text=status_display, foreground="#6544e9",
                                       font=('Arial', 10, 'bold'))
            else:
                self.status_label.config(text=status_display, foreground="#dc3545",
                                       font=('Arial', 10, 'bold'))

            # Update button states
            if running:
                self.start_button.config(state="disabled")
                self.stop_button.config(state="normal")
                self.restart_button.config(state="normal")
                server_url = f"http://{self.config.get('server_host', '127.0.0.1')}:{self.config.get('server_port', 5000)}"
                self.status_bar.config(text=f"Server is running at {server_url}")
                # Update URL label
                self.url_label.config(text=server_url)
            else:
                self.start_button.config(state="normal")
                self.stop_button.config(state="disabled")
                self.restart_button.config(state="disabled")
                self.status_bar.config(text="Server is stopped")

            # Update tray icon
            self.update_tray_icon(running)

        except Exception as e:
            self.logger.error(f"Error updating status: {e}")

    def start_server(self):
        """Start the server"""
        try:
            # Check if server is already running first
            if self.is_server_running:
                self.log_message("Server is already running")
                return

            # Clean up any stale resources before starting
            self.cleanup_server_resources()

            # Check if port is available
            host = self.config.get('server_host', '127.0.0.1')
            port = self.config.get('server_port', 5000)

            # Valid port range for user applications: 1024-65535 (recommended: 5000-5100)
            valid_port_range = (1024, 65535)
            recommended_range = (5000, 5100)
            if not (valid_port_range[0] <= int(port) <= valid_port_range[1]):
                msg = (
                    f"The configured port ({port}) is outside the allowed range ({valid_port_range[0]}-{valid_port_range[1]}).\n"
                    f"Please select a port between {valid_port_range[0]} and {valid_port_range[1]} in Settings.\n"
                    f"Recommended range: {recommended_range[0]}-{recommended_range[1]}.\n\n"
                    "Remember to set the same port in the Noticing Game browser extension."
                )
                self.log_message(msg)
                import tkinter.messagebox as messagebox
                messagebox.showerror(
                    "Invalid Port",
                    msg
                )
                return

            if not self.is_port_available(host, port):
                msg = (
                    f"Port {port} is already in use. The server could NOT be started.\n\n"
                    "Please change the port in Settings to a free port.\n"
                    f"Allowed range: {valid_port_range[0]}-{valid_port_range[1]} (recommended: {recommended_range[0]}-{recommended_range[1]}).\n\n"
                    "IMPORTANT: The port configured here must match the one set in the Noticing Game browser extension."
                )
                self.log_message(msg)
                import tkinter.messagebox as messagebox
                messagebox.showerror(
                    "Port in Use",
                    msg
                )
                return

            self.log_message("Starting server...")

            if self.is_frozen:
                # Running as PyInstaller executable - run embedded server
                self.start_embedded_server()
            else:
                # Running as Python script - use subprocess
                if not self.server_script.exists():
                    messagebox.showerror("Error", f"Server script not found: {self.server_script}")
                    return

                self.start_subprocess_server()

            # Check if server actually started after a delay
            def delayed_check():
                import time
                time.sleep(3)
                if self.check_server_status():
                    self.log_message("Server started successfully!")
                else:
                    self.log_message("Server failed to start - checking again in 2 seconds...")
                    time.sleep(2)
                    if not self.check_server_status():
                        self.log_message("Server startup failed")
                        self.cleanup_server_resources()

            threading.Thread(target=delayed_check, daemon=True).start()

        except Exception as e:
            self.logger.error(f"Error starting server: {e}")
            self.log_message(f"Error starting server: {e}")
            self.cleanup_server_resources()
            messagebox.showerror("Error", f"Failed to start server: {e}")

    def start_embedded_server(self):
        """Start the Flask server in the same process (for PyInstaller executable)"""
        try:
            # Ensure clean state before starting
            self.cleanup_server_resources()

            # Import Flask components here to avoid issues
            from flask import Flask, request
            from flask_cors import CORS
            from subtitle_server import SubtitleExtractor, app as imported_app
            import threading
            import signal
            import socket
            import time

            # Create a fresh Flask app instance to avoid conflicts
            self.flask_app = Flask(__name__)
            CORS(self.flask_app)

            # Import the subtitle extractor
            extractor = SubtitleExtractor()

            # Add routes to the fresh app
            @self.flask_app.route('/', methods=['GET'])
            def home():
                from datetime import datetime
                return {
                    'status': 'running',
                    'service': 'Noticing Game Subtitle Server',
                    'version': VERSION,
                    'timestamp': datetime.now().isoformat()
                }

            @self.flask_app.route('/info', methods=['GET'])
            def info():
                from datetime import datetime
                return {
                    'name': 'Noticing Game - Subtitle Extraction Server',
                    'version': VERSION,
                    'description': 'Backend server using yt-dlp to extract YouTube subtitles for the Noticing Game extension',
                    'author': 'Rafael Hernandez Bustamante',
                    'license': 'GNU General Public License v3.0 (GPL-3.0)',
                    'repository': 'https://github.com/Rudull/noticing-game',
                    'endpoints': {
                        '/': 'Health check',
                        '/info': 'Server information',
                        '/extract-subtitles': 'Extract subtitles from YouTube video (POST/GET)'
                    },
                    'timestamp': datetime.now().isoformat()
                }

            @self.flask_app.route('/extract-subtitles', methods=['POST'])
            def extract_subtitles():
                try:
                    data = request.get_json()
                    if not data or 'url' not in data:
                        return {'success': False, 'error': 'Missing video URL in request body'}, 400

                    video_url = data['url']
                    result = extractor.get_subtitles(video_url)
                    return result
                except ValueError as e:
                    return {'success': False, 'error': str(e)}, 400
                except Exception as e:
                    return {'success': False, 'error': 'Internal server error'}, 500

            @self.flask_app.route('/extract-subtitles', methods=['GET'])
            def extract_subtitles_get():
                try:
                    video_url = request.args.get('url')
                    if not video_url:
                        return {'success': False, 'error': 'Missing video URL parameter'}, 400

                    result = extractor.get_subtitles(video_url)
                    return result
                except ValueError as e:
                    return {'success': False, 'error': str(e)}, 400
                except Exception as e:
                    return {'success': False, 'error': 'Internal server error'}, 500

            self.flask_shutdown = False
            self.server_socket = None

            # Create a custom server wrapper
            def run_flask():
                try:
                    import werkzeug.serving
                    from werkzeug.serving import WSGIRequestHandler

                    # Add shutdown route
                    @self.flask_app.route('/shutdown', methods=['POST', 'GET'])
                    def shutdown():
                        self.flask_shutdown = True
                        # Graceful shutdown
                        if hasattr(self, 'werkzeug_server') and self.werkzeug_server:
                            self.werkzeug_server.shutdown()
                        return 'Server shutting down...', 200

                    # Create server with proper socket reuse
                    host = self.config.get('server_host', '127.0.0.1')
                    port = self.config.get('server_port', 5000)

                    # Enable socket reuse
                    class ReuseWSGIRequestHandler(WSGIRequestHandler):
                        def setup(self):
                            self.connection = self.request
                            self.rfile = self.connection.makefile('rb', self.rbufsize)
                            self.wfile = self.connection.makefile('wb', self.wbufsize)

                    # Use the custom request handler
                    from werkzeug.serving import make_server
                    self.werkzeug_server = make_server(host, port, self.flask_app, request_handler=ReuseWSGIRequestHandler)
                    self.werkzeug_server.serve_forever()

                except Exception as e:
                    self.logger.error(f"Error in embedded server: {e}")

            # Start Flask in a separate thread
            self.server_thread = threading.Thread(target=run_flask, daemon=True)
            self.server_thread.start()
            
            self.is_server_running = True
            self.update_status(True, "Running")
            self.log_message(f"Server started on http://{self.config.get('server_host', '127.0.0.1')}:{self.config.get('server_port', 5000)}")

        except Exception as e:
            self.logger.error(f"Error starting embedded server: {e}")
            self.log_message(f"Error starting embedded server: {e}")
            self.cleanup_server_resources()

    def cleanup_old_updates(self):
        """Remove old executable files after update"""
        if not self.is_frozen:
            return
            
        try:
            # Check for .old files from previous updates
            current_exe = Path(sys.executable)
            old_exe = current_exe.with_name(current_exe.name + ".old")
            
            if old_exe.exists():
                try:
                    # Try to delete it (might fail if still locked, though unlikely on startup)
                    old_exe.unlink()
                    self.logger.info(f"Removed old version: {old_exe}")
                except Exception as e:
                    self.logger.warning(f"Could not remove old version: {e}")
        except Exception as e:
            self.logger.error(f"Error in cleanup: {e}")

    def check_updates(self):
        """Check for updates on GitHub Releases"""
        try:
            self.logger.info("Checking for updates...")
            # Use GitHub API to get the latest release
            api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
            response = requests.get(api_url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                tag_name = data.get('tag_name', '')
                remote_version = tag_name.lstrip('v')
                
                if remote_version:
                    self.logger.info(f"Local version: {VERSION}, Remote version: {remote_version}")
                    if self.is_newer_version(VERSION, remote_version):
                        self.latest_version = remote_version
                        
                        # Find the correct asset for this platform
                        asset_url = None
                        system = platform.system()
                        
                        for asset in data.get('assets', []):
                            name = asset['name'].lower()
                            url = asset['browser_download_url']
                            
                            if system == "Windows" and name.endswith('.exe'):
                                asset_url = url
                                break
                            elif system == "Linux" and not name.endswith('.exe') and '.' not in name:
                                # Assumption: Linux binary has no extension or specific name
                                # You might need to adjust this logic based on your actual release naming
                                asset_url = url
                                break
                            elif system == "Darwin" and (name.endswith('.dmg') or name.endswith('.app')):
                                asset_url = url
                                break
                        
                        # Fallback: if only one asset and it looks binary-ish, take it
                        if not asset_url and len(data.get('assets', [])) == 1:
                             asset_url = data['assets'][0]['browser_download_url']

                        if asset_url:
                            self.download_url = asset_url
                            self.root.after(0, self.show_update_available)
                        else:
                            # Fallback to release page if no suitable asset found
                            self.download_url = data.get('html_url', f"https://github.com/{GITHUB_REPO}/releases/latest")
                            self.logger.warning("No suitable asset found for auto-update, falling back to release page")
                            self.root.after(0, self.show_update_available)

            else:
                self.logger.warning(f"Failed to check updates: {response.status_code}")
        except Exception as e:
            self.logger.error(f"Error checking for updates: {e}")

    def is_newer_version(self, current, remote):
        """Compare two version strings"""
        try:
            c_parts = [int(x) for x in current.split('.')]
            r_parts = [int(x) for x in remote.split('.')]
            return r_parts > c_parts
        except:
            return False

    def show_update_available(self):
        """Show update button in UI"""
        self.update_button.pack(side=tk.LEFT, padx=(0, 10))
        self.log_message(f"Update available: {self.latest_version}")
        # Flash the button or something?
        
    def perform_update(self):
        """Handle update action - Download and Install"""
        if not self.latest_version or not self.download_url:
            return

        # If not frozen (dev mode) or URL is a webpage, just open browser
        if not self.is_frozen or "github.com" in self.download_url and "/releases/tag/" in self.download_url:
            msg = f"A new version ({self.latest_version}) is available.\n\nClick OK to open the download page."
            if messagebox.askokcancel("Update Available", msg):
                webbrowser.open(self.download_url)
            return

        # Confirm update
        msg = f"A new version ({self.latest_version}) is available.\n\nDo you want to download and install it now?\nThe application will restart automatically."
        if not messagebox.askyesno("Update Available", msg):
            return

        # Create progress dialog
        self.update_window = tk.Toplevel(self.root)
        self.update_window.title("Updating...")
        self.update_window.geometry("300x150")
        self.update_window.resizable(False, False)
        self.update_window.transient(self.root)
        self.update_window.grab_set()
        
        # Center
        self.update_window.geometry("+%d+%d" % (self.root.winfo_rootx() + 50, self.root.winfo_rooty() + 50))

        ttk.Label(self.update_window, text="Downloading update...", font=('Arial', 10)).pack(pady=20)
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(self.update_window, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill=tk.X, padx=20, pady=10)
        
        self.status_label = ttk.Label(self.update_window, text="Starting download...")
        self.status_label.pack(pady=5)

        # Start download in thread
        threading.Thread(target=self.download_and_install, daemon=True).start()

    def download_and_install(self):
        """Download and install the update in a background thread"""
        try:
            import shutil
            
            # Determine destination
            current_exe = Path(sys.executable)
            download_dest = current_exe.with_name("update_temp")
            
            self.root.after(0, lambda: self.status_label.config(text="Downloading..."))
            
            # Download with progress
            response = requests.get(self.download_url, stream=True, timeout=60)
            total_size = int(response.headers.get('content-length', 0))
            
            if response.status_code != 200:
                raise Exception(f"Download failed: {response.status_code}")
                
            block_size = 1024 * 8
            wrote = 0
            
            with open(download_dest, 'wb') as f:
                for data in response.iter_content(block_size):
                    wrote += len(data)
                    f.write(data)
                    if total_size:
                        progress = (wrote / total_size) * 100
                        self.root.after(0, lambda p=progress: self.progress_var.set(p))
                        
            self.root.after(0, lambda: self.status_label.config(text="Installing..."))
            
            # Prepare for swap
            old_exe = current_exe.with_name(current_exe.name + ".old")
            
            # Rename current to old
            if old_exe.exists():
                old_exe.unlink()
            
            current_exe.rename(old_exe)
            
            # Move new to current
            download_dest.rename(current_exe)
            
            # Make executable (Linux/Mac)
            if platform.system() != "Windows":
                try:
                    current_exe.chmod(current_exe.stat().st_mode | 0o111)
                except:
                    pass
            
            self.root.after(0, lambda: self.status_label.config(text="Restarting..."))
            time.sleep(1)
            
            # Restart
            self.root.after(0, self.restart_application)
            
        except Exception as e:
            self.logger.error(f"Update failed: {e}")
            self.root.after(0, lambda: messagebox.showerror("Update Failed", f"Failed to update: {e}"))
            self.root.after(0, lambda: self.update_window.destroy() if hasattr(self, 'update_window') else None)

    def restart_application(self):
        """Restart the application"""
        try:
            # Stop server first
            self.stop_server()
            
            # Re-launch
            if platform.system() == "Windows":
                subprocess.Popen([sys.executable] + sys.argv[1:])
            else:
                subprocess.Popen([sys.executable] + sys.argv[1:])
                
            self.quit_application()
        except Exception as e:
            self.logger.error(f"Restart failed: {e}")


    def start_subprocess_server(self):
        """Start the server as a subprocess (for development)"""
        try:
            # Ensure clean state before starting
            self.cleanup_server_resources()

            # Prepare environment
            env = os.environ.copy()
            env['FLASK_ENV'] = 'production'

            # Start server process with improved error handling
            self.server_process = subprocess.Popen(
                [sys.executable, str(self.server_script)],
                cwd=str(self.script_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1,
                env=env
            )

            # Start thread to read server output
            def read_output():
                try:
                    for line in iter(self.server_process.stdout.readline, ''):
                        if line:
                            line = line.strip()
                            if line:
                                self.log_message(f"[SERVER] {line}")

                    # Process has ended
                    if self.server_process:
                        return_code = self.server_process.poll()
                        if return_code is not None:
                            if return_code == 0:
                                self.log_message("Server process ended normally")
                            else:
                                self.log_message(f"Server process ended with error code {return_code}")
                                # Clean up on abnormal exit
                                self.cleanup_server_resources()
                except Exception as e:
                    self.logger.error(f"Error reading server output: {e}")
                    self.log_message(f"Error reading server output: {e}")

            thread = threading.Thread(target=read_output, daemon=True)
            thread.start()

            self.log_message("Server subprocess started")

        except Exception as e:
            self.log_message(f"Error starting subprocess server: {e}")
            self.cleanup_server_resources()
            raise

    def cleanup_server_resources(self):
        """Clean up server resources to ensure proper restart"""
        # Force close any remaining sockets
        if hasattr(self, 'server_socket') and self.server_socket:
            try:
                self.server_socket.close()
            except:
                pass

        # Clean up thread references
        if hasattr(self, 'server_thread') and self.server_thread:
            if self.server_thread.is_alive():
                try:
                    # Give thread a moment to finish
                    self.server_thread.join(timeout=2)
                except:
                    pass

        # Reset all server-related attributes
        self.flask_app = None
        self.server_thread = None
        self.server_socket = None
        self.server_process = None
        self.flask_shutdown = False
        self.is_server_running = False

        # Small delay to ensure port is released
        import time
        time.sleep(0.5)

    def stop_server(self):
        """Stop the server"""
        try:
            if not self.is_server_running and not self.server_process and not self.server_thread:
                self.log_message("Server is not running")
                self.cleanup_server_resources()
                return

            self.log_message("Stopping server...")

            if self.is_frozen and (self.flask_app or self.server_thread):
                # Stop embedded Flask server
                try:
                    import requests
                    import socket
                    import threading
                    import time

                    # Signal shutdown
                    self.flask_shutdown = True
                    self.log_message("Stopping embedded server...")

                    # Method 1: Try graceful shutdown via werkzeug server
                    if hasattr(self, 'werkzeug_server') and self.werkzeug_server:
                        try:
                            self.werkzeug_server.shutdown()
                            self.log_message("Werkzeug server shutdown initiated")
                        except Exception as e:
                            self.log_message(f"Werkzeug shutdown failed: {e}")

                    # Method 2: Try shutdown via HTTP request (fallback)
                    def send_shutdown_request():
                        try:
                            response = requests.get(
                                f"http://{self.config.get('server_host', '127.0.0.1')}:{self.config.get('server_port', 5000)}/shutdown",
                                timeout=2
                            )
                            self.log_message("HTTP shutdown request sent")
                        except requests.exceptions.RequestException:
                            self.log_message("HTTP shutdown failed (expected if server already stopped)")

                    # Send shutdown request in separate thread
                    shutdown_thread = threading.Thread(target=send_shutdown_request, daemon=True)
                    shutdown_thread.start()
                    shutdown_thread.join(timeout=3)

                    # Method 3: Force close socket
                    if hasattr(self, 'server_socket') and self.server_socket:
                        try:
                            self.server_socket.shutdown(socket.SHUT_RDWR)
                            self.server_socket.close()
                            self.log_message("Server socket closed forcefully")
                        except Exception as socket_error:
                            self.log_message(f"Socket close: {socket_error}")

                    # Wait for thread to finish with timeout
                    if self.server_thread and self.server_thread.is_alive():
                        self.log_message("Waiting for server thread to finish...")
                        self.server_thread.join(timeout=8)

                        if self.server_thread.is_alive():
                            self.log_message("Server thread taking longer than expected, continuing cleanup...")

                    # Clean up werkzeug server reference
                    if hasattr(self, 'werkzeug_server'):
                        try:
                            self.werkzeug_server.server_close()
                        except:
                            pass
                        self.werkzeug_server = None

                    self.log_message("Embedded server stopped")

                except Exception as e:
                    self.log_message(f"Error stopping embedded server: {e}")

            elif self.server_process:
                # Stop subprocess server
                try:
                    self.server_process.terminate()
                    self.log_message("Termination signal sent to server process")

                    # Wait for graceful shutdown
                    try:
                        self.server_process.wait(timeout=10)
                        self.log_message("Server process terminated gracefully")
                    except subprocess.TimeoutExpired:
                        self.log_message("Server didn't stop gracefully, forcing termination...")
                        self.server_process.kill()
                        try:
                            self.server_process.wait(timeout=5)
                            self.log_message("Server process killed")
                        except subprocess.TimeoutExpired:
                            self.log_message("Server process did not respond to kill signal")
                            # Final attempt
                            try:
                                self.server_process.kill()
                                self.log_message("Forced termination of server process")
                            except:
                                pass

                except Exception as e:
                    self.log_message(f"Error terminating server process: {e}")

                finally:
                    self.server_process = None

            # Clean up all resources
            self.cleanup_server_resources()

            # Force update status after stopping with delay
            self.root.after(2000, self.check_server_status)
            self.log_message("Server stopped successfully")

        except Exception as e:
            self.logger.error(f"Error stopping server: {e}")
            self.log_message(f"Error stopping server: {e}")
            self.cleanup_server_resources()
            messagebox.showerror("Error", f"Failed to stop server: {e}")

    def restart_server(self):
        """Restart the server"""
        self.log_message("Restarting server...")
        self.stop_server()
        time.sleep(2)
        self.start_server()

    def log_message(self, message):
        """Add a message to the log display"""
        try:
            timestamp = datetime.now().strftime("%H:%M:%S")
            formatted_message = f"[{timestamp}] {message}\n"

            # Update log display in GUI thread
            self.root.after(0, lambda: self._append_to_log(formatted_message))

            # Also log to file
            self.logger.info(message)

        except Exception as e:
            print(f"Error logging message: {e}")

    def _append_to_log(self, message):
        """Append message to log text widget (must be called from GUI thread)"""
        try:
            self.log_text.insert(tk.END, message)
            self.log_text.see(tk.END)

            # Limit log size to prevent memory issues
            line_count = int(self.log_text.index('end-1c').split('.')[0])
            if line_count > 1000:
                self.log_text.delete('1.0', '100.0')

        except Exception as e:
            print(f"Error appending to log: {e}")

    def clear_log(self):
        """Clear the log display"""
        self.log_text.delete('1.0', tk.END)
        self.log_message("Log cleared")

    def save_log(self):
        """Save log to file"""
        try:
            filename = filedialog.asksaveasfilename(
                defaultextension=".txt",
                filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
                title="Save log file"
            )

            if filename:
                log_content = self.log_text.get('1.0', tk.END)
                with open(filename, 'w') as f:
                    f.write(log_content)

                self.log_message(f"Log saved to: {filename}")

        except Exception as e:
            messagebox.showerror("Error", f"Failed to save log: {e}")

    def open_server_url(self, event):
        """Open server URL in browser"""
        url = f"http://{self.config.get('server_host', '127.0.0.1')}:{self.config.get('server_port', 5000)}"
        webbrowser.open(url)
        self.log_message(f"Opened {url} in browser")

    def show_settings(self):
            """Show settings dialog"""
            settings_window = tk.Toplevel(self.root)
            settings_window.title("Settings")
            settings_window.resizable(True, True)
            settings_window.transient(self.root)
            settings_window.grab_set()

            # Centrar la ventana relativa a la ventana principal
            self.root.update_idletasks()
            x = self.root.winfo_x() + (self.root.winfo_width() - settings_window.winfo_reqwidth()) / 2
            y = self.root.winfo_y() + (self.root.winfo_height() - settings_window.winfo_reqheight()) / 2
            settings_window.geometry(f"+{int(x)}+{int(y)}")

            main_frame = ttk.Frame(settings_window, padding="15")
            main_frame.pack(fill=tk.BOTH, expand=True)
            content_frame = ttk.Frame(main_frame)
            content_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

            # Auto-start setting
            auto_start_var = tk.BooleanVar(value=self.config.get('auto_start', False))
            ttk.Checkbutton(content_frame, text="Start server automatically when app opens",
                           variable=auto_start_var).pack(anchor=tk.W, pady=5)

            # Auto-startup with OS setting
            auto_startup_var = tk.BooleanVar(value=self.config.get('auto_startup_os', False))
            ttk.Checkbutton(content_frame, text="Start with operating system",
                           variable=auto_startup_var).pack(anchor=tk.W, pady=5)

            # Minimize to tray setting (always visible, disabled if not available)
            minimize_tray_var = tk.BooleanVar(value=self.config.get('minimize_to_tray', True))
            minimize_chk = ttk.Checkbutton(content_frame, text="Minimize to system tray",
                                       variable=minimize_tray_var)
            minimize_chk.pack(anchor=tk.W, pady=5)
            if not TRAY_AVAILABLE:
                minimize_chk.state(['disabled'])

            # Enable tray setting (always visible, disabled if not available)
            enable_tray_var = tk.BooleanVar(value=self.config.get('enable_tray', True))
            enable_chk = ttk.Checkbutton(content_frame, text="Enable system tray",
                                     variable=enable_tray_var)
            enable_chk.pack(anchor=tk.W, pady=5)
            if not TRAY_AVAILABLE:
                enable_chk.state(['disabled'])

            # Server settings
            ttk.Label(content_frame, text="Server Host:").pack(anchor=tk.W, pady=(15, 2))
            host_var = tk.StringVar(value=self.config.get('server_host', '127.0.0.1'))
            host_entry = ttk.Entry(content_frame, textvariable=host_var)
            host_entry.pack(fill=tk.X, pady=(0, 10))

            ttk.Label(content_frame, text="Server Port:").pack(anchor=tk.W, pady=2)
            port_var = tk.StringVar(value=str(self.config.get('server_port', 5000)))
            port_entry = ttk.Entry(content_frame, textvariable=port_var)
            port_entry.pack(fill=tk.X, pady=(0, 10))

            ttk.Label(content_frame, text="Status Check Interval (seconds):").pack(anchor=tk.W, pady=2)
            interval_var = tk.StringVar(value=str(self.config.get('check_interval', 5)))
            interval_entry = ttk.Entry(content_frame, textvariable=interval_var)
            interval_entry.pack(fill=tk.X, pady=(0, 10))

            button_frame = ttk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=(10, 0))

            def save_settings():
                try:
                    old_host = self.config.get('server_host', '127.0.0.1')
                    old_port = self.config.get('server_port', 5000)
                    old_auto_startup = self.config.get('auto_startup_os', False)
                    old_enable_tray = self.config.get('enable_tray', True)

                    new_host = host_var.get()
                    new_port = int(port_var.get())

                    self.config['auto_start'] = auto_start_var.get()
                    self.config['auto_startup_os'] = auto_startup_var.get()
                    self.config['minimize_to_tray'] = minimize_tray_var.get()
                    self.config['enable_tray'] = enable_tray_var.get()
                    self.config['server_host'] = new_host
                    self.config['server_port'] = new_port
                    self.config['check_interval'] = int(interval_var.get())

                    self.save_config()

                    if (old_host != new_host or old_port != new_port) and self.is_server_running:
                        self.log_message(f"Server configuration changed (host: {old_host} -> {new_host}, port: {old_port} -> {new_port})")
                        self.log_message("Restarting server with new configuration...")
                        self.restart_server()

                    if old_auto_startup != auto_startup_var.get():
                        self.setup_auto_startup()

                    if old_enable_tray != enable_tray_var.get():
                        if enable_tray_var.get() and TRAY_AVAILABLE:
                            if not self.tray_icon:
                                self.setup_system_tray()
                                if self.tray_icon:
                                    pass
                        else:
                            if self.tray_icon:
                                self.tray_icon.stop()
                                self.tray_icon = None

                    self.log_message("Settings saved successfully")
                    messagebox.showinfo("Settings", "Settings saved successfully!")
                    settings_window.destroy()

                except ValueError:
                    messagebox.showerror("Error", "Please enter valid numeric values for port and interval")
                except Exception as e:
                    messagebox.showerror("Error", f"Failed to save settings: {e}")

            def cancel_settings():
                settings_window.destroy()

            save_btn = ttk.Button(button_frame, text="Save Settings", command=save_settings)
            save_btn.pack(side=tk.RIGHT, padx=(5, 0))
            cancel_btn = ttk.Button(button_frame, text="Cancel", command=cancel_settings)
            cancel_btn.pack(side=tk.RIGHT)
            settings_window.focus_set()

    def show_about(self):
        """Show about/information dialog"""
        about_window = tk.Toplevel(self.root)
        about_window.title("About Noticing Game")
        about_window.geometry("500x500")
        about_window.resizable(False, False)
        about_window.transient(self.root)
        about_window.grab_set()

        # Center the window
        about_window.geometry("+%d+%d" % (
            self.root.winfo_rootx() + 100,
            self.root.winfo_rooty() + 100
        ))

        main_frame = ttk.Frame(about_window, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # App icon and title
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill=tk.X, pady=(0, 20))

        title_label = ttk.Label(title_frame, text="🎮 Noticing Game",
                               font=('Arial', 16, 'bold'),
                               foreground=self.primary_color)
        title_label.pack()

        subtitle_label = ttk.Label(title_frame, text="Subtitle Extraction Server",
                                  font=('Arial', 10))
        subtitle_label.pack()

        # Version info
        version_frame = ttk.LabelFrame(main_frame, text="Version Information", padding="10")
        version_frame.pack(fill=tk.X, pady=(0, 10))

        version_info = [
            ("Version:", "0.1.2"),
            ("Author:", "Rafael Hernandez Bustamante"),
            ("License:", "GNU General Public License v3.0 (GPL-3.0)")
        ]

        for i, (label, value) in enumerate(version_info):
            row_frame = ttk.Frame(version_frame)
            row_frame.pack(fill=tk.X, pady=2)

            ttk.Label(row_frame, text=label, font=('Arial', 9, 'bold')).pack(side=tk.LEFT)
            ttk.Label(row_frame, text=value, font=('Arial', 9)).pack(side=tk.LEFT, padx=(10, 0))

        # Description
        desc_frame = ttk.LabelFrame(main_frame, text="Description", padding="10")
        desc_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        desc_text = scrolledtext.ScrolledText(desc_frame, height=8, width=50, wrap=tk.WORD)
        desc_text.pack(fill=tk.BOTH, expand=True)

        description = """Noticing Game is a language learning tool that enhances your target language acquisition by detecting frequently used words from a custom list within YouTube video subtitles.

This desktop application manages the backend server that extracts subtitles from YouTube videos using yt-dlp, providing them to the Chrome extension for interactive vocabulary practice.

Features:
• YouTube subtitle extraction using yt-dlp
• Support for manual and automatic subtitles
• Multiple language support (English, Spanish)
• RESTful API for Chrome extension
• System tray integration
• Auto-startup configuration
• Real-time server monitoring"""

        desc_text.insert('1.0', description)
        desc_text.config(state='disabled')

        # Server info
        server_frame = ttk.LabelFrame(main_frame, text="Server Information", padding="10")
        server_frame.pack(fill=tk.X, pady=(0, 10))

        server_info = [
            ("Host:", f"{self.config.get('server_host', '127.0.0.1')}"),
            ("Port:", f"{self.config.get('server_port', 5000)}"),
            ("Status:", "Running" if self.is_server_running else "Stopped")
        ]

        for label, value in server_info:
            row_frame = ttk.Frame(server_frame)
            row_frame.pack(fill=tk.X, pady=2)

            ttk.Label(row_frame, text=label, font=('Arial', 9, 'bold')).pack(side=tk.LEFT)
            ttk.Label(row_frame, text=value, font=('Arial', 9)).pack(side=tk.LEFT, padx=(10, 0))

        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(10, 0))

        def open_server_info():
            if self.is_server_running:
                try:
                    import webbrowser
                    url = f"http://{self.config.get('server_host', '127.0.0.1')}:{self.config.get('server_port', 5000)}/info"
                    webbrowser.open(url)
                except Exception as e:
                    messagebox.showerror("Error", f"Could not open browser: {e}")
            else:
                messagebox.showwarning("Server Not Running", "Please start the server first to view server information.")

        ttk.Button(button_frame, text="View Server Info",
                  command=open_server_info).pack(side=tk.LEFT)

        ttk.Button(button_frame, text="Close",
                  command=about_window.destroy).pack(side=tk.RIGHT)

        # Focus on the about window
        about_window.focus_set()

    def on_closing(self):
        """Handle window close event"""
        # Save window geometry (size and position)
        geometry = self.root.geometry()

        # Parse geometry string (format: "WIDTHxHEIGHT+X+Y")
        if '+' in geometry or '-' in geometry:
            # Split geometry into size and position parts
            if '+' in geometry:
                size_part, pos_part = geometry.split('+', 1)
                x = int(pos_part.split('+')[0] if '+' in pos_part else pos_part.split('-')[0])
                y = int(pos_part.split('+')[1] if '+' in pos_part else pos_part.split('-')[1])
            else:
                size_part, pos_part = geometry.split('-', 1)
                x = -int(pos_part.split('+')[0] if '+' in pos_part else pos_part.split('-')[0])
                y = int(pos_part.split('+')[1] if '+' in pos_part else pos_part.split('-')[1])
        else:
            # No position in geometry string, get it separately
            size_part = geometry
            x, y = self.root.winfo_x(), self.root.winfo_y()

        # Solo guardar posición si lo deseas, pero no tamaño
        self.config['window_position'] = [x, y]
        self.save_config()

        if TRAY_AVAILABLE and self.config.get('minimize_to_tray', True) and self.tray_icon:
            # Minimize to tray instead of closing
            self.root.withdraw()
            if not hasattr(self, '_tray_message_shown'):
                self.tray_icon.notify("Noticing Game is still running in the system tray")
                self._tray_message_shown = True
        else:
            self.quit_application()

    def quit_application(self):
        """Quit the application completely"""
        self.auto_check_enabled = False

        if self.server_process or self.server_thread:
            self.stop_server()

        if self.tray_icon:
            self.tray_icon.stop()

        self.root.quit()
        self.root.destroy()

    def run(self):
        """Run the application"""
        try:
            # Ensure UI is properly initialized first
            self.root.update_idletasks()
            self.ensure_ui_visibility()

            # Log execution mode for debugging
            mode = "executable" if self.is_frozen else "development"
            self.log_message(f"Starting Noticing Game Server Manager in {mode} mode")

            # Auto-start server if configured
            if self.config.get('auto_start', False):
                self.root.after(1000, self.start_server)  # Start after GUI is ready

            # If both auto-startup and auto-start are enabled, start minimized to tray
            if (self.config.get('auto_startup_os', False) and
                self.config.get('auto_start', False) and
                self.config.get('minimize_to_tray', True) and
                TRAY_AVAILABLE and self.tray_icon):
                self.root.withdraw()  # Start hidden if running as auto-startup

            # Start tray icon in separate thread if available
            if self.tray_icon:
                tray_thread = threading.Thread(target=self.tray_icon.run, daemon=True)
                tray_thread.start()

            # Initial status check
            self.root.after(500, self.check_server_status)

            # Final UI refresh to ensure everything is visible
            self.root.after(100, self.ensure_ui_visibility)

            # Start GUI main loop
            self.root.mainloop()

        except KeyboardInterrupt:
            self.quit_application()
        except Exception as e:
            self.logger.error(f"Error running application: {e}")
            messagebox.showerror("Error", f"Application error: {e}")

def main():
    """Main entry point"""
    try:
        is_frozen = getattr(sys, 'frozen', False)

        if not is_frozen:
            # Check if server script exists (only in development mode)
            script_dir = Path(__file__).parent
            server_script = script_dir / "subtitle_server.py"

            if not server_script.exists():
                messagebox.showerror(
                    "Error",
                    f"Server script not found: {server_script}\n\n"
                    "Make sure this application is in the same directory as subtitle_server.py"
                )
                return

        # Check Python version
        if sys.version_info < (3, 8):
            messagebox.showerror(
                "Error",
                f"Python 3.8 or higher is required.\n"
                f"Current version: {sys.version}"
            )
            return

        # Create and run application
        app = NoticingGameServerManager()
        app.run()

    except Exception as e:
        error_msg = f"Failed to start Noticing Game Server Manager: {e}"
        print(error_msg)

        try:
            messagebox.showerror("Error", error_msg)
        except:
            pass  # GUI might not be available

if __name__ == "__main__":
    main()
