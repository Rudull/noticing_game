# Noticing Game - Release v0.1.2

## 🚀 New Features

### 🔄 Automatic Updates (Backend)
- **Self-Updating Executable:** The desktop server now has the ability to update itself!
- **Smart Detection:** Automatically checks GitHub Releases for newer versions on startup.
- **One-Click Install:** When an update is found, simply click "Update Available" -> "Yes". The app will download the new version, install it, and restart automatically.
- **Cross-Platform:** Works on Windows and Linux (automatically handles executable permissions on Ubuntu/Debian).

## 🧩 Extension Updates (v0.3.3)

- **Version Sync:** Updated to require Backend v0.1.2.
- **Update Prompt:** Users with older server versions will be notified to update to this version to enable the new auto-update capabilities.

## 🛠️ Technical Details
- Implemented GitHub Releases API integration.
- Added automatic cleanup of temporary update files.
- Improved version checking logic.

---
*Note: This is a critical update that enables seamless future upgrades. It is highly recommended for all users.*
