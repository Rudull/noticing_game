
import os
import sys
import threading
import subprocess
import time
import requests
import re
import platform
import webbrowser
import logging
from pathlib import Path

class UpdateManager:
    """
    Manages the application update process:
    - Checks for updates from GitHub Releases
    - Downloads and installs updates
    - Handles application restart
    """

    def __init__(self, current_version, github_repo, main_script_path=None, logger=None, is_frozen=False):
        self.current_version = current_version
        self.github_repo = github_repo
        self.main_script_path = main_script_path
        self.logger = logger or logging.getLogger('UpdateManager')

        self.is_frozen = is_frozen
        self.latest_version = None
        self.download_url = None
        
        # Callbacks
        self.on_log = None # func(message)
        self.on_update_available = None # func(version, url)
        self.on_download_progress = None # func(percentage)
        self.on_download_complete = None # func()
        self.on_error = None # func(error_message)
        self.on_restart_required = None # func()

    def set_callbacks(self, on_log=None, on_update_available=None, 
                     on_file_download_progress=None, on_download_complete=None, 
                     on_error=None, on_restart_required=None):
        """Set callbacks for various events"""
        self.on_log = on_log
        self.on_update_available = on_update_available
        self.on_download_progress = on_file_download_progress
        self.on_download_complete = on_download_complete
        self.on_error = on_error
        self.on_restart_required = on_restart_required

    def log(self, message):
        """Internal log helper"""
        self.logger.info(message)
        if self.on_log:
            self.on_log(message)

    def check_updates(self, manual=False):
        """Check for updates on GitHub Releases"""
        try:
            self.logger.info("Checking for updates...")
            api_url = f"https://api.github.com/repos/{self.github_repo}/releases/latest"
            
            headers = {'Cache-Control': 'no-cache', 'Pragma': 'no-cache'}
            
            response = requests.get(api_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                tag_name = data.get('tag_name', '')
                
                version_match = re.search(r'(\d+(?:\.\d+)+)', tag_name)
                
                if version_match:
                    remote_version = version_match.group(1)
                    self.logger.info(f"Local: {self.current_version}, Remote: {remote_version}")
                    
                    if manual:
                         self.log(f"Update check: Local={self.current_version}, Remote={remote_version}")

                    if self.is_newer_version(self.current_version, remote_version):
                        self.latest_version = remote_version
                        self.download_url = self._find_asset_url(data)
                        
                        if self.on_update_available:
                            self.on_update_available(self.latest_version, self.download_url)
                    else:
                        if manual:
                            self.log("You are using the latest version.")
                else:
                     self.logger.warning(f"Could not parse version: {tag_name}")
                     if manual:
                         self.log(f"Error: Could not parse version from tag {tag_name}")
            else:
                self.logger.warning(f"Failed to check updates: {response.status_code}")
                if manual:
                    self.log(f"Update check failed: HTTP {response.status_code}")
                
        except Exception as e:
            self.logger.error(f"Error checking updates: {e}")
            if manual:
                self.log(f"Update check error: {e}")

    def is_newer_version(self, current, remote):
        """Compare two version strings"""
        try:
            c_parts = [int(x) for x in current.split('.')]
            r_parts = [int(x) for x in remote.split('.')]
            return r_parts > c_parts
        except Exception as e:
            return False

    def _find_asset_url(self, release_data):
        """Find the correct asset URL for the current platform"""
        asset_url = None
        system = platform.system()
        
        for asset in release_data.get('assets', []):
            name = asset['name'].lower()
            url = asset['browser_download_url']
            
            if system == "Windows" and name.endswith('.exe'):
                return url
            elif system == "Linux" and not name.endswith('.exe'):
                if name.endswith(('.dmg', '.pkg', '.msi', '.zip', 
                                '.tar.gz', '.tgz', '.deb', '.rpm')):
                    continue
                return url
            elif system == "Darwin" and (name.endswith('.dmg') or name.endswith('.app')):
                return url
        
        # Fallback: single asset
        if not asset_url and len(release_data.get('assets', [])) == 1:
             asset = release_data['assets'][0]
             name = asset['name'].lower()
             if not name.endswith(('.zip', '.tar', '.html')): 
                 return asset['browser_download_url']

        return release_data.get('html_url', f"https://github.com/{self.github_repo}/releases/latest")

    def perform_update(self):
        """Start the download process in a separate thread"""
        if not self.download_url or not self.latest_version:
            return

        # If dev mode or web URL, just open browser
        if not self.is_frozen or ("github.com" in self.download_url and "/releases/tag/" in self.download_url):
            webbrowser.open(self.download_url)
            return

        threading.Thread(target=self._download_and_install_thread, daemon=True).start()

    def _download_and_install_thread(self):
        """Internal method to run download in background"""
        try:
            current_exe = Path(sys.executable)
            download_dest = current_exe.with_name("update_temp")
            
            # Download
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
                    if total_size and self.on_download_progress:
                        progress = (wrote / total_size) * 100
                        self.on_download_progress(progress)
            
            if self.on_download_complete:
                self.on_download_complete()
            
            # Install (swap files)
            old_exe = current_exe.with_name(current_exe.name + ".old")
            if old_exe.exists():
                old_exe.unlink()
            
            current_exe.rename(old_exe)
            download_dest.rename(current_exe)
            
            # chmod for Linux/Mac
            if platform.system() != "Windows":
                try:
                    current_exe.chmod(current_exe.stat().st_mode | 0o755)
                except:
                    pass
            
            if self.on_restart_required:
                self.on_restart_required()
            
        except Exception as e:
            self.logger.error(f"Update failed: {e}")
            if self.on_error:
                self.on_error(str(e))

    def cleanup_old_updates(self):
        """Remove old executable files after update"""
        if not self.is_frozen:
            return
            
        try:
            current_exe = Path(sys.executable)
            old_exe = current_exe.with_name(current_exe.name + ".old")
            
            if old_exe.exists():
                old_exe.unlink()
                self.logger.info(f"Removed old version: {old_exe}")
        except Exception as e:
            self.logger.warning(f"Could not remove old version: {e}")

    def reboot_os(self):
        """Reboot the operating system"""
        try:
            self.logger.info("Initiating OS restart...")
            if platform.system() == "Windows":
                subprocess.run(["shutdown", "/r", "/t", "0"], check=True)
            else:
                subprocess.run(["reboot"], check=True)
        except Exception as e:
            self.logger.error(f"Failed to reboot OS: {e}")
            raise

    def restart_application(self, stop_server_callback=None):
        """Restart the application"""
        try:
            # Call provided callback to stop server/cleanup resources
            if stop_server_callback:
                stop_server_callback()
            
            self.logger.info(f"Restarting application...")
            
            # Flush stdout/stderr
            sys.stdout.flush()
            sys.stderr.flush()

            if platform.system() == "Windows":
                if self.is_frozen:
                    flags = 0x00000008 | 0x00000200 # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
                    subprocess.Popen([sys.executable] + sys.argv[1:], creationflags=flags, close_fds=True)
                else:
                    args = [sys.executable, self.main_script_path] + sys.argv[1:]
                    subprocess.Popen(args, close_fds=True)
                
                # Signal to just quit logic, caller should handle exit
                return True
            else:
                # Linux/Mac execv
                # Close logger/resources to be safe - done effectively by execv
                if self.is_frozen:
                     os.execv(sys.executable, sys.argv)
                elif self.main_script_path:
                     os.execv(sys.executable, [sys.executable, self.main_script_path] + sys.argv[1:])
                
                return False 
                
        except Exception as e:
            self.logger.error(f"Restart failed: {e}")
            raise
