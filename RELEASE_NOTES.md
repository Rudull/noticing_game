# 🚀 Release: Sync, Streaming & Listening Mode
### Extension v0.4.3 | Backend Server v0.1.3

We are excited to announce a major update for **Noticing Game**! This release brings cross-device synchronization, expands support to major streaming platforms, adds dedicated listening tools, and introduces a robust fallback mode.

---

## ✨ New Features

### ☁️ User Auth & Cloud Sync
*   **Sync Across Devices:** You can now log in to synchronize your progress, settings, and streaks across different computers. Start watching on your laptop and continue on your desktop without losing a beat.
*   **Manual Backups:** Added options to Export/Import your data as a JSON file for local safekeeping.

### 📺 Netflix & Disney+ Support
*   **Multi-Platform:** The game now works seamlessly on **Netflix** and **Disney+**, in addition to YouTube.
*   **Fullscreen Mode:** The UI has been optimized to persist and adapt correctly when you enter fullscreen mode on any of these platforms.

### 🎧 Listening Mode (Blur)
*   **Train Your Ears:** We added a new **"Blur Subtitles"** toggle. When enabled, subtitles are hidden by default, forcing you to rely on audio.
*   **Interactive Reveal:** Simply hover over the blurred area to peek at the text if you get stuck.

### 📊 Activity Heatmap
*   **Visualize Progress:** Check out the new Github-style activity heatmap in the panel.
*   **Streak Tracking:** Keep your daily learning streak alive and watch your activity grow over the year.

### 🧠 Smarter Detection
*   **Phrasal Verbs:** The engine now intelligently detects and matches multi-word expressions and phrasal verbs (e.g., "give up", "look forward to"), treating them as single units.

### 📇 Anki Integration
*   **Import Decks:** Connect directly to Anki (via AnkiConnect) and import your existing decks to use as game lists.
*   **Refined Sync:** Improved stability for exporting captured words and detecting duplicates.

---

## 🛡️ Reliability & Backend Improvements

*   **🚑 Emergency Mode (Smart Fallback):** If the backend server goes offline or isn't installed, the extension now automatically attempts to extract subtitles directly from the page. You can play without the server!
*   **🔄 Automatic Backend Updates:** The desktop server application now includes a self-update mechanism to pull the latest version from GitHub Releases automatically.

---

## 📥 Installation / Update

### Extension
*   **Already installed?** Chrome should update it automatically. If not, go to `chrome://extensions/` and click "Update".
*   **New?** Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/noticing-game/amdacddmlfphgmclpjhbdhcmnldojlpj).

### Backend Server (Optional but Recommended)
For local subtitle extraction and best performance:
1.  **Windows:** Download [`noticing_game_server.exe`](https://github.com/Rudull/noticing-game/releases/latest/download/noticing_game_server.exe)
2.  **Linux:** Download [`noticing_game_server`](https://github.com/Rudull/noticing-game/releases/latest/download/noticing_game_server)

---

*Happy Noticing!* 🧐
