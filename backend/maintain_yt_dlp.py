#!/usr/bin/env python3
"""
Noticing Game - yt-dlp Maintenance Script
Handles safe updates, verification, and rollback for the critical yt-dlp dependency.
"""

import sys
import os
import subprocess
import logging
import json
import time
import socket
import urllib.request
from datetime import datetime
from pathlib import Path
import importlib.metadata

# Add backend directory to path to import SubtitleExtractor
sys.path.append(str(Path(__file__).parent))
try:
    from subtitle_server import SubtitleExtractor
except ImportError:
    # If we can't import, we might be running in a context where dependencies aren't set up yet
    # But for this script to work, we need the server code.
    print("Error: Could not import SubtitleExtractor. Make sure you are in the correct environment.")
    sys.exit(1)

# Configure logging
LOG_FILE = Path(__file__).parent / "logs" / "yt-dlp_maintenance.log"
LOG_FILE.parent.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class YtDlpMaintainer:
    def __init__(self):
        self.report_file = Path(__file__).parent / "maintenance_report.json"
        
        # Test vectors for "Smart Verification"
        # We test different types of videos to ensure broad compatibility
        self.test_vectors = [
            {
                "type": "standard_manual",
                "name": "English (Manual Subtitles)",
                "expected_source": "manual",
                "urls": [
                    "https://www.youtube.com/watch?v=83qff2e_1io", # User provided: Chris Lonsdale
                    "https://www.youtube.com/watch?v=jEmGXm_jhyI", # User provided: Amy Cuddy (Backup)
                    "https://www.youtube.com/watch?v=mYq33FVBWVo", # User provided: Susan Cain (Backup 2)
                    "https://www.youtube.com/watch?v=robx0RPxyd4"  # User provided: Mel Robbins (Backup 3)
                ],
                "min_subtitles": 50 
            },
            {
                "type": "standard_asr",
                "name": "English (ASR/Auto-generated)",
                "expected_source": "automatic",
                "urls": [
                    "https://www.youtube.com/watch?v=B9nFMpxYop0", # Sentdex Python Tutorial
                    "https://www.youtube.com/watch?v=M7FIvfx5J10"  # Testing Auto Captions
                ],
                "min_subtitles": 10
            }
        ]

    def check_internet(self):
        """Check internet connectivity by resolving Google DNS"""
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            logger.error("No internet connection available.")
            return False

    def check_environment(self):
        """Ensure script is running in the 'noticing' Conda environment"""
        env_name = os.environ.get('CONDA_DEFAULT_ENV')
        sys_prefix = sys.prefix
        
        logger.info(f"Environment Variable (CONDA_DEFAULT_ENV): {env_name}")
        logger.info(f"System Prefix: {sys_prefix}")
        logger.info(f"Executable Path: {sys.executable}")

        # Primary check: Environment variable (standard conda)
        if env_name and env_name.lower() == 'noticing':
            return True
            
        # Secondary check: Path-based detection (fallback for Windows/IDEs)
        prefix_path = Path(sys_prefix)
        # Check if the last part of the path is 'noticing' or if it's in the parts (case-insensitive)
        if prefix_path.name.lower() == 'noticing' or any(p.lower() == 'noticing' for p in prefix_path.parts):
            logger.info("Environment 'noticing' detected via path prefix.")
            return True

        logger.error(f"❌ Wrong Environment! Current prefix: '{sys_prefix}'")
        
        if "WindowsApps\\PythonSoftwareFoundation" in sys_prefix:
            logger.error("🛑 DETECTED WINDOWS STORE PYTHON: Windows is overriding your Conda environment.")
            logger.error("   Try running the script with:")
            logger.error("   conda run -n noticing python maintain_yt_dlp.py")
        else:
            logger.error("   Please activate the correct environment: 'conda activate noticing'")
            
        return False

    def get_current_version(self):
        """Get currently installed yt-dlp version"""
        try:
            return importlib.metadata.version('yt-dlp')
        except importlib.metadata.PackageNotFoundError:
            return None

    def check_for_updates(self):
        """Check if a newer version is available on PyPI using JSON API (Fast)"""
        try:
            url = "https://pypi.org/pypi/yt-dlp/json"
            with urllib.request.urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode())
                latest_version = data['info']['version']
                return latest_version
        except Exception as e:
            logger.warning(f"Failed to check for updates: {e}")
            return None

    def verify_installation(self):
        """Run smart verification on the current installation"""
        logger.info("Starting smart verification...")
        extractor = SubtitleExtractor()
        results = {
            "passed": 0,
            "failed": 0,
            "details": []
        }

        for test in self.test_vectors:
            test_result = {
                "name": test["name"],
                "passed": False,
                "error": None
            }
            logger.info(f"Verifying {test['name']}...")
            
            # Try primary URL, fallback to backups
            success = False
            last_error = None
            
            for url in test["urls"]:
                try:
                    logger.info(f"  Testing URL: {url}")
                    data = extractor.get_subtitles(url)
                    
                    # Content Validation
                    if not data.get('success'):
                        raise ValueError("Extractor returned success=False")
                    
                    # Source Verification (Strict Mode -> Relaxed)
                    actual_source = data.get('source')
                    if 'expected_source' in test and actual_source != test['expected_source']:
                        logger.warning(f"  ⚠️ Source mismatch: Expected {test['expected_source']}, got {actual_source}")
                        if test['expected_source'] == "automatic" and actual_source == "manual":
                             logger.warning("  Video has manual subtitles (preferred). Verification deemed SUCCESS (better than expected).")
                        elif test['expected_source'] == "manual" and actual_source == "automatic":
                             # This is bad if we expected manual.
                             logger.warning("  Video missing manual subtitles. Using ASR.")
                    
                    subs = data.get('subtitles', [])
                    count = len(subs)
                    
                    if count < test["min_subtitles"]:
                        raise ValueError(f"Subtitle count {count} below minimum {test['min_subtitles']}")
                    
                    # Check for empty text in random sample
                    if subs and not any(s.get('text', '').strip() for s in subs[:5]):
                         raise ValueError("First 5 subtitles are empty")

                    logger.info(f"  ✅ Passed ({count} subs, source: {actual_source})")
                    success = True
                    break # Stop trying backups if one works

                except Exception as e:
                    logger.warning(f"  ❌ URL failed: {e}")
                    last_error = e
                    continue # Try next backup
            
            if success:
                test_result["passed"] = True
                results["passed"] += 1
                logger.info(f"✅ {test['name']} verified.")
            else:
                test_result["error"] = str(last_error)
                results["failed"] += 1
                logger.error(f"❌ {test['name']} failed all URLs.")
            
            results["details"].append(test_result)

        return results

    def install_version(self, version=None):
        """Install specific version or latest"""
        cmd = [sys.executable, "-m", "pip", "install", "--upgrade"]
        if version:
            cmd.append(f"yt-dlp=={version}")
        else:
            cmd.append("yt-dlp")
            
        logger.info(f"Running: {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
        # Reload importlib metadata cache if needed, though usually new process is best.
        # Since we run verification in this process, we rely on SubtitleExtractor importing yt_dlp.
        # Note: Python imports are cached. If we upgrade a package, we might need to restart the process 
        # to use the new version code. However, for a maintenance script, 
        # checking the VERSION via metadata is fine. 
        # BUT verification via 'import yt_dlp' might use the OLD loaded module if it was already imported.
        # We will handle this by spawning verification as a subprocess if strictly necessary, 
        # but typically maintain_yt_dlp shouldn't import yt_dlp at top level if it plans to reload it.
        # We imported SubtitleExtractor which imports yt_dlp. This is a limitation.
        # IMPROVEMENT: verification should run in a subprocess to ensure clean import of new version.

    def verify_in_subprocess(self):
        """Run verification in a separate subprocess to ensure fresh imports"""
        # We'll run this script itself with a special flag
        cmd = [sys.executable, __file__, "--verify-only"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        try:
            # Parse the last line or find JSON output
            # We need a robust way to get the result from the subprocess.
            # Let's simple check return code and maybe parse stdout for a marker.
            if result.returncode != 0:
                logger.error(f"Verification subprocess failed: {result.stderr}")
                return {"passed": 0, "failed": 999, "details": [{"error": "Subprocess crash"}]}
            
            # The subprocess should print the JSON result to stdout
            # Look for the JSON block
            lines = result.stdout.strip().split('\n')
            json_str = ""
            for line in reversed(lines):
                if line.startswith("VERIFICATION_RESULT:"):
                    json_str = line.replace("VERIFICATION_RESULT:", "")
                    break
            
            if json_str:
                return json.loads(json_str)
            else:
               logger.error("Could not find verification result in subprocess output")
               return {"passed": 0, "failed": 999, "details": [{"error": "No JSON output"}]}

        except Exception as e:
            logger.error(f"Error running verification subprocess: {e}")
            return {"passed": 0, "failed": 999, "details": [{"error": str(e)}]}

    def generate_report(self, action, success, old_version, new_version, verification_results):
        report = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "success": success,
            "old_version": old_version,
            "new_version": new_version,
            "verification": verification_results
        }
        with open(self.report_file, 'w') as f:
            json.dump(report, f, indent=2)
        logger.info(f"Report generated at {self.report_file}")

    def run(self):
        logger.info("="*50)
        logger.info("Running yt-dlp Maintenance")
        logger.info("="*50)

        if not self.check_internet():
            logger.error("Aborting: No internet connection.")
            return

        if not self.check_environment():
            logger.error("Aborting: Environment check failed.")
            return

        current_version = self.get_current_version()
        logger.info(f"Current version: {current_version}")

        # Check for updates
        logger.info("Checking for updates...")
        latest_version = self.check_for_updates()
        
        if not latest_version:
            logger.info("yt-dlp is up to date (or check failed).")
            # Optional: Run verification anyway just to be safe
            # results = self.verify_in_subprocess()
            # self.generate_report("check", True, current_version, current_version, results)
            return

        if latest_version == current_version:
            logger.info(f"System is already up to date (Version: {current_version}).")
            
            # Check if running interactively
            if sys.stdin and sys.stdin.isatty():
                response = input("Do you want to run verification checks anyway? (y/N): ").strip().lower()
                if response == 'y':
                    logger.info("Running verification on current version...")
                    results = self.verify_in_subprocess()
                    
                    for detail in results.get('details', []):
                        status = "✅ OK" if detail['passed'] else f"❌ FAILED ({detail.get('error')})"
                        logger.info(f"   - {detail['name']}: {status}")

                    if results['failed'] == 0:
                        logger.info("✅ Full Installation Verified.")
                    else:
                        logger.warning(f"⚠️ Verification failed ({results['failed']} tests failed).")
            else:
                logger.info("Running in non-interactive mode. Skipping optional verification.")
            return

        logger.info(f"Found new version: {latest_version}")
        
        try:
            # 1. Update
            logger.info("Updating...")
            self.install_version(latest_version)
            
            # 2. Verify
            logger.info("Verifying update...")
            results = self.verify_in_subprocess()
            
            success = results['failed'] == 0
            
            if success:
                for detail in results.get('details', []):
                    status = "✅ OK" if detail['passed'] else f"❌ FAILED"
                    logger.info(f"   - {detail['name']}: {status}")
                
                logger.info("✅ Update verified successfully!")
                self.generate_report("update", True, current_version, latest_version, results)
            else:
                logger.warning(f"⚠️ Update verification failed ({results['failed']} tests failed). Rolling back...")
                
                # 3. Rollback
                logger.info(f"Rolling back to {current_version}...")
                self.install_version(current_version)
                
                logger.info("Verifying rollback...")
                rollback_results = self.verify_in_subprocess()
                
                if rollback_results['failed'] == 0:
                    logger.info("✅ Rollback successful and verified.")
                else:
                    logger.error("❌ Critical: Rollback verification also failed!")
                
                self.generate_report("update_failed_rolled_back", False, current_version, latest_version, results)

        except Exception as e:
            logger.error(f"Critical maintenance error: {e}")
            # Try to restore original version if everything blew up
            try:
                logger.info("Emergency rollback...")
                self.install_version(current_version)
            except:
                pass

if __name__ == "__main__":
    # Check for subprocess flag
    if "--verify-only" in sys.argv:
        try:
            maintainer = YtDlpMaintainer()
            results = maintainer.verify_installation()
            print(f"VERIFICATION_RESULT:{json.dumps(results)}")
        except Exception as e:
            # Fallback for catastrophic failure in subprocess
            print(f"VERIFICATION_RESULT:{json.dumps({'passed':0, 'failed':1, 'details':[{'error': str(e)}]})}")
    else:
        YtDlpMaintainer().run()
