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
        self.is_server_running = False
        self.auto_check_enabled = True
        self.tray_icon = None

        # Configuration
        self.config_file = Path.home() / ".noticing_game_config.json"
        self.load_config()

        # Setup logging
        self.setup_logging()

        # Find server script
        self.script_dir = Path(__file__).parent
        self.server_script = self.script_dir / "subtitle_server.py"

        # Setup GUI
        self.setup_gui()

        # Start status monitoring
        self.start_status_monitoring()

        # Setup system tray if available
        if TRAY_AVAILABLE and self.config.get('enable_tray', True):
            self.setup_system_tray()

    def load_config(self):
        """Load configuration from file"""
        default_config = {
            'auto_start': False,
            'minimize_to_tray': True,
            'enable_tray': True,
            'check_interval': 5,
            'server_host': '127.0.0.1',
            'server_port': 5000
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
        self.root.geometry("600x500")
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

        # Title
        title_label = ttk.Label(main_frame, text="🎮 Noticing Game Server Manager",
                               font=('Arial', 16, 'bold'))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))

        # Server status section
        status_frame = ttk.LabelFrame(main_frame, text="Server Status", padding="10")
        status_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        status_frame.columnconfigure(1, weight=1)

        ttk.Label(status_frame, text="Status:").grid(row=0, column=0, sticky=tk.W)
        self.status_label = ttk.Label(status_frame, text="Checking...",
                                     font=('Arial', 10, 'bold'))
        self.status_label.grid(row=0, column=1, sticky=tk.W, padx=(10, 0))

        ttk.Label(status_frame, text="URL:").grid(row=1, column=0, sticky=tk.W)
        self.url_label = ttk.Label(status_frame, text="http://localhost:5000",
                                  foreground="blue", cursor="hand2")
        self.url_label.grid(row=1, column=1, sticky=tk.W, padx=(10, 0))
        self.url_label.bind("<Button-1>", self.open_server_url)

        # Control buttons
        control_frame = ttk.Frame(main_frame)
        control_frame.grid(row=2, column=0, columnspan=3, pady=(0, 10))

        self.start_button = ttk.Button(control_frame, text="▶ Start Server",
                                      command=self.start_server, style="success.TButton")
        self.start_button.pack(side=tk.LEFT, padx=(0, 5))

        self.stop_button = ttk.Button(control_frame, text="⏹ Stop Server",
                                     command=self.stop_server, style="danger.TButton")
        self.stop_button.pack(side=tk.LEFT, padx=(0, 5))

        self.restart_button = ttk.Button(control_frame, text="🔄 Restart",
                                        command=self.restart_server)
        self.restart_button.pack(side=tk.LEFT, padx=(0, 5))

        ttk.Button(control_frame, text="⚙️ Settings",
                  command=self.show_settings).pack(side=tk.LEFT, padx=(0, 5))

        # Log viewer
        log_frame = ttk.LabelFrame(main_frame, text="Server Log", padding="10")
        log_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        main_frame.rowconfigure(3, weight=1)

        self.log_text = scrolledtext.ScrolledText(log_frame, height=15, width=70)
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
        self.status_bar.grid(row=4, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 0))

        # Setup window close handler
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        # Configure custom button styles
        style.configure("success.TButton", foreground="green")
        style.configure("danger.TButton", foreground="red")

    def setup_system_tray(self):
        """Setup system tray icon"""
        def create_image():
            # Create a simple icon
            image = Image.new('RGB', (64, 64), color='white')
            draw = ImageDraw.Draw(image)
            draw.ellipse([8, 8, 56, 56], fill='blue')
            draw.text((20, 25), "NG", fill='white')
            return image

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

        # Create tray icon
        self.tray_icon = pystray.Icon(
            "noticing_game",
            create_image(),
            "Noticing Game Server",
            menu
        )

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

    def check_server_status(self):
        """Check if the server is running"""
        try:
            import urllib.request
            import urllib.error

            url = f"http://{self.config['server_host']}:{self.config['server_port']}"

            try:
                with urllib.request.urlopen(url, timeout=2) as response:
                    if response.getcode() == 200:
                        self.update_status(True, "Running ✅")
                        return True
            except (urllib.error.URLError, urllib.error.HTTPError):
                pass

            self.update_status(False, "Stopped ⏹")
            return False

        except Exception as e:
            self.logger.error(f"Error checking server status: {e}")
            self.update_status(False, "Error ❌")
            return False

    def update_status(self, running, status_text):
        """Update the server status in the GUI"""
        try:
            self.is_server_running = running

            # Update status label
            self.status_label.config(text=status_text)

            # Update button states
            if running:
                self.start_button.config(state="disabled")
                self.stop_button.config(state="normal")
                self.restart_button.config(state="normal")
                self.status_bar.config(text="Server is running at http://localhost:5000")
            else:
                self.start_button.config(state="normal")
                self.stop_button.config(state="disabled")
                self.restart_button.config(state="disabled")
                self.status_bar.config(text="Server is stopped")

            # Update tray icon tooltip
            if self.tray_icon:
                self.tray_icon.title = f"Noticing Game Server - {status_text}"

        except Exception as e:
            self.logger.error(f"Error updating status: {e}")

    def start_server(self):
        """Start the server"""
        try:
            if self.is_server_running:
                self.log_message("Server is already running")
                return

            if not self.server_script.exists():
                messagebox.showerror("Error", f"Server script not found: {self.server_script}")
                return

            self.log_message("Starting server...")

            # Start server process
            self.server_process = subprocess.Popen(
                [sys.executable, str(self.server_script)],
                cwd=str(self.script_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )

            # Start thread to read server output
            def read_output():
                try:
                    for line in iter(self.server_process.stdout.readline, ''):
                        if line:
                            self.log_message(f"[SERVER] {line.strip()}")

                    # Process has ended
                    if self.server_process:
                        return_code = self.server_process.poll()
                        if return_code is not None and return_code != 0:
                            self.log_message(f"Server process ended with code {return_code}")
                except Exception as e:
                    self.logger.error(f"Error reading server output: {e}")

            thread = threading.Thread(target=read_output, daemon=True)
            thread.start()

            self.log_message("Server start command sent")

            # Check if server actually started after a delay
            def delayed_check():
                time.sleep(3)
                if self.check_server_status():
                    self.log_message("✅ Server started successfully!")
                else:
                    self.log_message("❌ Server failed to start")

            threading.Thread(target=delayed_check, daemon=True).start()

        except Exception as e:
            self.logger.error(f"Error starting server: {e}")
            self.log_message(f"❌ Error starting server: {e}")
            messagebox.showerror("Error", f"Failed to start server: {e}")

    def stop_server(self):
        """Stop the server"""
        try:
            if not self.is_server_running and not self.server_process:
                self.log_message("Server is not running")
                return

            self.log_message("Stopping server...")

            if self.server_process:
                self.server_process.terminate()

                # Wait for graceful shutdown
                try:
                    self.server_process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    self.log_message("Server didn't stop gracefully, forcing termination...")
                    self.server_process.kill()

                self.server_process = None

            self.log_message("✅ Server stopped")

        except Exception as e:
            self.logger.error(f"Error stopping server: {e}")
            self.log_message(f"❌ Error stopping server: {e}")
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
        url = f"http://{self.config['server_host']}:{self.config['server_port']}"
        webbrowser.open(url)
        self.log_message(f"Opened {url} in browser")

    def show_settings(self):
        """Show settings dialog"""
        settings_window = tk.Toplevel(self.root)
        settings_window.title("Settings")
        settings_window.geometry("400x300")
        settings_window.resizable(False, False)
        settings_window.transient(self.root)
        settings_window.grab_set()

        # Center the window
        settings_window.geometry("+%d+%d" % (
            self.root.winfo_rootx() + 100,
            self.root.winfo_rooty() + 100
        ))

        main_frame = ttk.Frame(settings_window, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Auto-start setting
        auto_start_var = tk.BooleanVar(value=self.config.get('auto_start', False))
        ttk.Checkbutton(main_frame, text="Start server automatically when app opens",
                       variable=auto_start_var).pack(anchor=tk.W, pady=5)

        # Minimize to tray setting
        if TRAY_AVAILABLE:
            minimize_tray_var = tk.BooleanVar(value=self.config.get('minimize_to_tray', True))
            ttk.Checkbutton(main_frame, text="Minimize to system tray",
                           variable=minimize_tray_var).pack(anchor=tk.W, pady=5)

        # Server settings
        ttk.Label(main_frame, text="Server Host:").pack(anchor=tk.W, pady=(20, 5))
        host_var = tk.StringVar(value=self.config.get('server_host', '127.0.0.1'))
        ttk.Entry(main_frame, textvariable=host_var).pack(fill=tk.X, pady=(0, 10))

        ttk.Label(main_frame, text="Server Port:").pack(anchor=tk.W, pady=5)
        port_var = tk.StringVar(value=str(self.config.get('server_port', 5000)))
        ttk.Entry(main_frame, textvariable=port_var).pack(fill=tk.X, pady=(0, 10))

        # Check interval
        ttk.Label(main_frame, text="Status Check Interval (seconds):").pack(anchor=tk.W, pady=5)
        interval_var = tk.StringVar(value=str(self.config.get('check_interval', 5)))
        ttk.Entry(main_frame, textvariable=interval_var).pack(fill=tk.X, pady=(0, 20))

        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(20, 0))

        def save_settings():
            try:
                self.config['auto_start'] = auto_start_var.get()
                if TRAY_AVAILABLE:
                    self.config['minimize_to_tray'] = minimize_tray_var.get()
                self.config['server_host'] = host_var.get()
                self.config['server_port'] = int(port_var.get())
                self.config['check_interval'] = int(interval_var.get())

                self.save_config()
                self.log_message("Settings saved")
                settings_window.destroy()

            except ValueError as e:
                messagebox.showerror("Error", "Please enter valid numeric values for port and interval")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save settings: {e}")

        ttk.Button(button_frame, text="Save", command=save_settings).pack(side=tk.RIGHT)
        ttk.Button(button_frame, text="Cancel",
                  command=settings_window.destroy).pack(side=tk.RIGHT, padx=(0, 10))

    def on_closing(self):
        """Handle window close event"""
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

        if self.server_process:
            self.stop_server()

        if self.tray_icon:
            self.tray_icon.stop()

        self.root.quit()
        self.root.destroy()

    def run(self):
        """Run the application"""
        try:
            # Auto-start server if configured
            if self.config.get('auto_start', False):
                self.root.after(1000, self.start_server)  # Start after GUI is ready

            # Start tray icon in separate thread if available
            if self.tray_icon:
                tray_thread = threading.Thread(target=self.tray_icon.run, daemon=True)
                tray_thread.start()

            # Initial status check
            self.root.after(500, self.check_server_status)

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
        # Check if server script exists
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
