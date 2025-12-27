# Noticing Game Backend

Backend server for the Noticing Game Chrome extension that provides YouTube subtitle extraction using `yt-dlp`.

## Overview

This backend server solves the problem of YouTube's restrictions on direct subtitle access from browser extensions. It uses `yt-dlp` (a powerful YouTube downloader) to extract subtitles from YouTube videos and provides them via a REST API that the Chrome extension can consume.

## Features

- Extract subtitles from YouTube videos using `yt-dlp`
- Support for both manual and automatic subtitles
- Multiple language support (prioritizes English and Spanish)
- CORS-enabled for browser extension access
- Parse TTML subtitle format with timestamps
- RESTful API with JSON responses
- Error handling and logging
- Desktop GUI application with system tray integration
- Auto-startup configuration
- Server information endpoint
- Automated yt-dlp maintenance system with safe updates and rollback


## Requirements

- Python 3.8 or higher
- Internet connection
- YouTube videos with available subtitles

## Quick Start

### 1. Install Python Dependencies

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt
```

### 2. Run the Server

```bash
python subtitle_server.py
```

The server will start using the configured host and port (default: `http://localhost:5000`)

### 3. Test the Server

Open your browser and visit (using your configured host and port):
```
http://localhost:5000/extract-subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID
```

## Installation

### Option 1: Development Mode (Recommended for Contributors)

This method uses `setup.py` to install the project in "editable" mode. This means any changes you make to the source code will be reflected immediately without reinstalling.

```bash
# Navigate to the backend directory
cd backend

# Install in editable mode with development dependencies
pip install -e ".[dev]"
```

### Option 2: Anaconda / Conda (Recommended for automatic environment management)

If you use Anaconda, the `environment.yml` file provides **automatic environment setup and normalization**:

#### First-time setup:
```bash
# Create the environment from the yml file
conda env create -f environment.yml

# Activate it
conda activate noticing
```

#### Updating/Normalizing an existing environment:
If you've been developing and installed extra packages, use `--prune` to **remove packages not listed** in `environment.yml`:

```bash
# Activate the environment first
conda activate noticing

# Update and clean (removes unused packages automatically)
conda env update -f environment.yml --prune
```

The `--prune` flag will:
- ✅ Install any missing packages from `environment.yml`
- ✅ Update packages to match specified versions
- ❌ **Remove** packages that aren't in the specification

#### Alternative: Manual setup with pip
```bash
conda create -n noticing python=3.11
conda activate noticing
pip install -e .
```

### Option 3: Standard Virtual Environment (venv)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install the project
pip install -e .
```

### Option 4: Simple Pip Installation (Production/User)

If you just want to install the dependencies and run the server:

```bash
pip install -r requirements.txt
```

## API Endpoints

### GET /

Health check endpoint.

**Response:**
```json
{
  "status": "running",
  "service": "Noticing Game Subtitle Server",
  "version": "0.1.3",
  "timestamp": "2023-12-01T10:30:00"
}
```

### GET /info

Server information endpoint with version, author, and license details.

**Response:**
```json
{
  "name": "Noticing Game - Subtitle Extraction Server",
  "version": "0.1.3",
  "description": "Backend server using yt-dlp to extract YouTube subtitles for the Noticing Game extension",
  "author": "Rafael Hernandez Bustamante",
  "license": "GNU General Public License v3.0 (GPL-3.0)",
  "repository": "https://github.com/Rudull/noticing-game",
  "endpoints": {
    "/": "Health check",
    "/info": "Server information",
    "/extract-subtitles": "Extract subtitles from YouTube video (POST/GET)"
  },
  "timestamp": "2023-12-01T10:30:00"
}
```

### POST /extract-subtitles

Extract subtitles from a YouTube video.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "success": true,
  "video_id": "VIDEO_ID",
  "video_title": "Video Title",
  "language": "en",
  "source": "automatic",
  "subtitle_count": 150,
  "subtitles": [
    {
      "text": "Hello, welcome to this video",
      "start": 0.0,
      "end": 3.5,
      "duration": 3.5
    },
    ...
  ]
}
```

### GET /extract-subtitles

Extract subtitles using GET method (for testing).

**Usage:**
```
GET /extract-subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID
```

## Usage Examples

### Using curl

```bash
# POST request
curl -X POST http://localhost:5000/extract-subtitles \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# GET request (for testing)
curl "http://localhost:5000/extract-subtitles?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Using Python requests

```python
import requests

# Extract subtitles
response = requests.post('http://localhost:5000/extract-subtitles',
                        json={'url': 'https://www.youtube.com/watch?v=VIDEO_ID'})

data = response.json()
if data['success']:
    print(f"Found {data['subtitle_count']} subtitles")
    for subtitle in data['subtitles']:
        print(f"[{subtitle['start']:.1f}s] {subtitle['text']}")
```

### Integration with Chrome Extension

The Chrome extension automatically communicates with this server. Make sure the server is running before using the extension.

## Configuration

### Server Configuration

The server reads its configuration from `~/.noticing_game_config.json`. You can configure:

- **Host:** Default is `127.0.0.1`. Use `0.0.0.0` for external access
- **Port:** Default is `5000`. Change to your preferred port
- **Debug:** Default is `false`. Set to `true` for development

#### Configuration Methods:

1. **Desktop App Settings (Recommended):**
   - Open the desktop app (`python desktop_app.py`)
   - Click "Settings" button
   - Configure host and port
   - Changes are saved automatically and server restarts if running

2. **Manual Configuration File:**
   Create or edit `~/.noticing_game_config.json`:
   ```json
   {
     "server_host": "127.0.0.1",
     "server_port": 8080,
     "debug": false
   }
   ```

3. **Command Line Arguments:**
   ```bash
   python subtitle_server.py --host 0.0.0.0 --port 8080 --debug
   python start_server.py --host 0.0.0.0 --port 8080
   ```

### yt-dlp Configuration

The server uses these yt-dlp options by default:

```python
ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'writesubtitles': True,
    'writeautomaticsub': True,
    'subtitleslangs': ['en', 'es', 'en-US', 'en-GB'],
    'subtitlesformat': 'ttml',
    'skip_download': True,
}
```

## yt-dlp Maintenance

To ensure the backend remains functional despite frequent YouTube platform changes, a maintenance script is included to manage `yt-dlp` updates safely.

### Features
- **Environment Guard**: Ensures script runs in the correct `noticing` Conda environment.
- **Fast Checks**: Queries PyPI directly (<1s) for the latest versions.
- **Smart Verification**: Validates updates against English Manual and ASR subtitle extraction test cases.
- **Auto-Rollback**: Automatically reverts to the previous version if an update fails verification.

### Usage
```bash
# Activate environment
conda activate noticing

# Run maintenance (check for updates, update and verify)
python maintain_yt_dlp.py

# Run verification only
python maintain_yt_dlp.py --verify-only
```


## Troubleshooting

### Common Issues

1. **"No subtitles available"**
   - The video doesn't have subtitles
   - Subtitles are disabled by the creator
   - Try a different video

2. **"Video unavailable"**
   - Video is private, deleted, or region-blocked
   - Check if the URL is correct

3. **Connection refused**
   - Make sure the server is running on port 5000
   - Check firewall settings

4. **CORS errors**
   - The server includes CORS headers, but check browser console
   - Make sure you're accessing from the correct origin

### Debug Mode

Run with debug logging:

```python
# In subtitle_server.py, change:
logging.basicConfig(level=logging.DEBUG)

# And run with:
app.run(debug=True)
```

### Testing Installation

```bash
# Test if yt-dlp works
python -c "import yt_dlp; print('yt-dlp imported successfully')"

# Test if Flask works
python -c "import flask; print('Flask imported successfully')"

# Test the server
python subtitle_server.py
```

## Desktop Application

The backend includes a desktop GUI application (`desktop_app.py`) that provides:

- **Easy server management**: Start/stop server with one click
- **System tray integration**: Runs in background with colored status indicator
- **Auto-startup**: Configure to start with your operating system
- **Real-time monitoring**: Live server status and log viewing
- **Settings management**: Configure host, port, and other options with automatic restart
- **About dialog**: Version information and server details
- **Configuration persistence**: All settings are saved to `~/.noticing_game_config.json`

### Running the Desktop App

```bash
python desktop_app.py
```

### System Tray Icon

- **Violet circle**: Server is running
- **Gray circle**: Server is stopped
- **Right-click**: Access menu options

### Configuration Management

The desktop app automatically:
- Reads configuration from `~/.noticing_game_config.json`
- Saves changes to host/port settings
- Restarts the server when host/port changes (if running)
- Updates all URLs and status displays with new configuration

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-flask

# Run tests
pytest

# Run with coverage
pytest --cov=subtitle_server
```

### Code Formatting

```bash
# Install formatting tools
pip install black flake8

# Format code
black subtitle_server.py

# Check style
flake8 subtitle_server.py
```

### Project Structure

```
backend/
├── desktop_app.py           # Desktop GUI application
├── subtitle_server.py       # Main server application
├── start_server.py          # Cross-platform server startup script
├── start_server.bat         # Windows server startup script
├── start_server.sh          # Linux/macOS server startup script
├── maintain_yt_dlp.py       # Automated yt-dlp maintenance script
├── requirements.txt         # Python dependencies
├── environment.yml          # Conda environment specification (with --prune support)
├── setup.py                # Package setup
├── README.md               # This file
├── build_executable_*.py   # Build scripts for different platforms
├── auto_startup/           # Auto-startup service scripts
└── tests/                  # Test files (if any)
```

## Security Considerations

- The server runs on localhost by default (127.0.0.1:5000)
- Host and port are configurable via desktop app settings
- Only accepts requests from browser extensions via CORS
- No authentication required for local use
- For production use, consider adding authentication
- When changing host to 0.0.0.0, ensure firewall rules are appropriate

## Performance

- Subtitle extraction typically takes 2-5 seconds
- Temporary files are automatically cleaned up
- Server supports concurrent requests
- Memory usage is minimal (< 100MB typically)

## Limitations

- Requires internet connection
- Some videos may not have subtitles
- Rate limiting may apply for excessive requests
- Regional restrictions may affect availability

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

## Support

For issues and questions:
- Check the troubleshooting section above
- Open an issue on GitHub
- Contact: Rafael Hernandez Bustamante

## Build Executables

The project includes scripts to build standalone executables:

- `build_executable_windows.py` - Windows executable with PyInstaller
- `build_executable_linux.py` - Linux/macOS executable with PyInstaller
- `build_cx_freeze_windows.py` - Windows executable with cx_Freeze

### Building

```bash
# Windows (PyInstaller)
python build_executable_windows.py --clean --test

# Linux/macOS (PyInstaller)
python build_executable_linux.py --clean --test

# Windows (cx_Freeze alternative)
python build_cx_freeze_windows.py --clean --test
```

## Distribution Packaging

To create a complete, ready-to-ship package (including executable, dependencies, assets, startup scripts, and documentation) for **Windows, Linux, or macOS**, use:

```bash
python build_to_distribution.py --clean --test
```

The result will be in the `distribution/` folder, ready to deliver or deploy on another machine.

You can force a specific platform with `--platform windows` or `--platform linux`.

## Auto-Startup Services

Install as system service for automatic startup:

- **Windows**: `auto_startup/install_windows_service.py`
- **Linux/macOS**: `auto_startup/install_linux_service.sh`

## Assets Integration

The application uses icons from the `../assets/` directory:
- `icono.ico` - Windows executable icon
- Icon path is automatically detected from assets folder

## Changelog

### Version 0.1.3
- **Automated yt-dlp Maintenance:** New script for safe updates, verification (Manual/ASR), and automatic rollback.
- **Automatic Updates:** Desktop app can now self-update from GitHub Releases.
- Initial release
- Basic subtitle extraction with yt-dlp
- Flask REST API with `/info` endpoint
- TTML parsing support
- Multi-language support
- Desktop GUI application with system tray
- Auto-startup configuration
- Build scripts for multiple platforms
- Service installation scripts
