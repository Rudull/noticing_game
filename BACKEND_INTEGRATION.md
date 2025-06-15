# Backend Integration - Noticing Game

## Overview

This document describes the new backend architecture for the Noticing Game Chrome extension, which solves YouTube subtitle extraction issues by using a Python server with `yt-dlp`.

## Problem Statement

YouTube has implemented increasingly strict restrictions on direct access to subtitle data from browser extensions. The original approach of extracting subtitles directly from the YouTube player's internal data structures was failing due to:

1. **Access Restrictions**: YouTube blocks direct access to `ytInitialPlayerResponse` and subtitle URLs
2. **CORS Policies**: Cross-origin restrictions prevent extensions from fetching subtitle data
3. **Rate Limiting**: YouTube applies rate limiting to prevent automated subtitle extraction
4. **Dynamic Loading**: Subtitle data is loaded dynamically and may not be available when the extension runs

## Solution Architecture

### New Hybrid Architecture

The new solution uses a **hybrid client-server architecture**:

```
┌─────────────────┐    HTTP API    ┌─────────────────┐    yt-dlp     ┌─────────────────┐
│  Chrome         │────────────────│  Python Flask   │──────────────│  YouTube        │
│  Extension      │                │  Backend Server │              │  (Subtitles)    │
│  (Frontend)     │                │  (Backend)      │              │                 │
└─────────────────┘                └─────────────────┘              └─────────────────┘
```

#### Components:

1. **Chrome Extension (Frontend)**
   - Handles UI interactions
   - Processes extracted subtitles
   - Manages word detection and game logic
   - Communicates with backend via HTTP API

2. **Python Flask Server (Backend)**
   - Runs locally on user's machine
   - Uses `yt-dlp` for reliable subtitle extraction
   - Provides RESTful API for subtitle data
   - Handles YouTube restrictions and rate limiting

3. **yt-dlp Integration**
   - Robust YouTube subtitle extraction
   - Supports multiple subtitle formats (TTML, SRT, VTT)
   - Handles both manual and automatic subtitles
   - Bypasses YouTube's browser restrictions

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Internet connection
- Chrome browser with Noticing Game extension

### Quick Setup

1. **Navigate to Backend Directory**
   ```bash
   cd 3.Proyectos_de_Software/noticing_game/backend
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Server**
   
   **Option A - Simple Start:**
   ```bash
   python subtitle_server.py
   ```
   
   **Option B - Using Startup Script (Recommended):**
   ```bash
   # Windows
   start_server.bat
   
   # macOS/Linux
   ./start_server.sh
   
   # Cross-platform Python script
   python start_server.py --auto-install
   ```

4. **Verify Server is Running**
   
   Open browser and visit: `http://localhost:5000`
   
   You should see:
   ```json
   {
     "status": "running",
     "service": "Noticing Game Subtitle Server",
     "version": "1.0.0",
     "timestamp": "2023-12-01T10:30:00"
   }
   ```

### Detailed Setup

#### For Windows Users

1. **Install Python**
   - Download from [python.org](https://www.python.org/downloads/)
   - ✅ **IMPORTANT**: Check "Add Python to PATH" during installation

2. **Run Setup Script**
   ```cmd
   # Double-click start_server.bat or run in Command Prompt
   start_server.bat
   ```

3. **The script will:**
   - Check Python installation
   - Install required dependencies
   - Start the server
   - Show helpful information

#### For macOS/Linux Users

1. **Install Python** (if not already installed)
   ```bash
   # macOS (using Homebrew)
   brew install python3
   
   # Ubuntu/Debian
   sudo apt update && sudo apt install python3 python3-pip
   
   # CentOS/RHEL
   sudo yum install python3 python3-pip
   ```

2. **Run Setup Script**
   ```bash
   # Make executable (if needed)
   chmod +x start_server.sh
   
   # Run the script
   ./start_server.sh --auto-install
   ```

#### Manual Installation

If the automated scripts don't work:

```bash
# Install dependencies
pip install flask flask-cors yt-dlp requests

# Start server
python subtitle_server.py
```

## API Documentation

### Base URL
```
http://localhost:5000
```

### Endpoints

#### 1. Health Check
**GET /** 

Returns server status and basic information.

**Response:**
```json
{
  "status": "running",
  "service": "Noticing Game Subtitle Server",
  "version": "1.0.0",
  "timestamp": "2023-12-01T10:30:00"
}
```

#### 2. Extract Subtitles (POST)
**POST /extract-subtitles**

Extracts subtitles from a YouTube video.

**Request Body:**
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
    {
      "text": "Today we're going to learn about...",
      "start": 3.5,
      "end": 7.2,
      "duration": 3.7
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "No subtitles available for this video"
}
```

#### 3. Extract Subtitles (GET)
**GET /extract-subtitles?url=VIDEO_URL**

Alternative GET method for testing.

**Usage:**
```
http://localhost:5000/extract-subtitles?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## Extension Integration

### How It Works

1. **User Clicks "Play" in Extension**
   - Extension gets current YouTube video ID
   - Constructs video URL
   - Sends POST request to backend server

2. **Backend Processing**
   - Receives video URL
   - Uses `yt-dlp` to extract subtitles
   - Parses TTML/SRT format
   - Returns structured subtitle data

3. **Extension Processing**
   - Receives subtitle data
   - Processes text for word frequency analysis
   - Displays word buttons in UI
   - Tracks word appearances for game logic

### Modified Extension Code

The main changes are in `subtitle-extraction.js`:

```javascript
// New backend-first approach
async function getYouTubeSubtitles() {
    const videoId = window.YouTubeVideoUtils.getYouTubeVideoId();
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Call backend server
    const response = await fetch(`${BACKEND_URL}/extract-subtitles`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: videoUrl }),
    });

    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error);
    }

    // Process subtitles for word detection
    const subtitles = data.subtitles.map(sub => sub.text);
    
    return {
        success: true,
        subtitles: subtitles,
        language: data.language,
        source: "backend-yt-dlp"
    };
}
```

### Fallback Mechanism

The extension includes a fallback mechanism:

1. **Primary**: Try backend server
2. **Fallback**: If backend is offline, attempt DOM-based extraction
3. **User Notification**: Clear error messages when backend is unavailable

## Troubleshooting

### Common Issues

#### 1. Backend Server Not Running

**Symptom:** Extension shows "Backend server is not running"

**Solution:**
```bash
# Start the server
python subtitle_server.py

# Or use startup script
./start_server.sh
```

#### 2. Port Already in Use

**Symptom:** "Port 5000 is already in use"

**Solutions:**
```bash
# Option 1: Use different port
python subtitle_server.py --port 5001

# Option 2: Find and kill process using port 5000
# On Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# On macOS/Linux:
lsof -ti:5000 | xargs kill -9
```

#### 3. Python Not Found

**Symptom:** "'python' is not recognized as an internal or external command"

**Solution:**
- Reinstall Python and check "Add Python to PATH"
- Or use full path: `C:\Python39\python.exe subtitle_server.py`

#### 4. Dependencies Missing

**Symptom:** "ModuleNotFoundError: No module named 'flask'"

**Solution:**
```bash
pip install -r requirements.txt
```

#### 5. CORS Errors

**Symptom:** Browser console shows CORS errors

**Solution:**
- Server includes CORS headers by default
- Make sure you're accessing from `youtube.com`
- Check if server is running on correct port

#### 6. No Subtitles Available

**Symptom:** "No subtitles available for this video"

**Causes:**
- Video doesn't have subtitles
- Video is private/deleted
- Regional restrictions

**Solution:**
- Try a different video with known subtitles
- Check if video is accessible

### Debug Mode

Enable debug logging for troubleshooting:

```bash
python start_server.py --debug
```

This will show detailed logs including:
- Incoming requests
- yt-dlp operations
- Error stack traces

### Testing the Server

#### Basic Test
```bash
curl http://localhost:5000/
```

#### Subtitle Extraction Test
```bash
curl -X POST http://localhost:5000/extract-subtitles \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## Development

### Project Structure

```
backend/
├── subtitle_server.py      # Main Flask application
├── start_server.py         # Cross-platform startup script
├── start_server.sh         # Unix/Linux startup script
├── start_server.bat        # Windows startup script
├── requirements.txt        # Python dependencies
├── setup.py               # Package configuration
└── README.md              # Backend documentation
```

### Key Classes

#### SubtitleExtractor
Main class for subtitle extraction logic:

```python
class SubtitleExtractor:
    def __init__(self):
        self.ydl_opts = {
            'quiet': True,
            'writesubtitles': True,
            'subtitleslangs': ['en', 'es'],
            'subtitlesformat': 'ttml',
            'skip_download': True,
        }
    
    def get_subtitles(self, video_url):
        # Extract subtitles using yt-dlp
        pass
    
    def parse_ttml_subtitles(self, ttml_content):
        # Parse TTML XML format
        pass
```

### Adding New Features

#### Support for New Subtitle Formats

1. **Add format to yt-dlp options:**
   ```python
   self.ydl_opts['subtitlesformat'] = 'ttml/srt/vtt'
   ```

2. **Implement parser:**
   ```python
   def parse_srt_subtitles(self, srt_content):
       # Parse SRT format
       pass
   ```

#### Support for New Languages

1. **Update language priority:**
   ```python
   lang_priority = ['en', 'es', 'fr', 'de', 'it']
   ```

2. **Update yt-dlp options:**
   ```python
   'subtitleslangs': ['en', 'es', 'fr', 'de', 'it']
   ```

### Testing

#### Unit Tests
```bash
# Install test dependencies
pip install pytest pytest-flask

# Run tests
pytest
```

#### Integration Tests
```bash
# Test with real YouTube video
python -c "
from subtitle_server import SubtitleExtractor
extractor = SubtitleExtractor()
result = extractor.get_subtitles('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
print(f'Success: {result[\"success\"]}, Count: {result[\"subtitle_count\"]}')
"
```

## Performance Considerations

### Server Performance

- **Memory Usage**: Typically < 100MB
- **Extraction Time**: 2-5 seconds per video
- **Concurrent Requests**: Supported via Flask threading
- **Caching**: No caching implemented (each request is fresh)

### Extension Performance

- **Reduced Memory**: Subtitle processing moved to backend
- **Faster Startup**: Extension loads faster without heavy processing
- **Better Reliability**: Consistent subtitle extraction

### Optimization Opportunities

1. **Caching**: Cache extracted subtitles for recently accessed videos
2. **Connection Pooling**: Reuse HTTP connections
3. **Compression**: Compress subtitle data in transit
4. **Background Processing**: Pre-extract subtitles for popular videos

## Security Considerations

### Local Server Security

- **Localhost Only**: Server binds to 127.0.0.1 by default
- **No Authentication**: Suitable for local use only
- **CORS Enabled**: Allows browser extension access
- **No Data Storage**: No persistent data storage

### Production Considerations

For production deployment (not recommended for typical users):

1. **Add Authentication**: Implement API keys or OAuth
2. **Use HTTPS**: Set up SSL certificates
3. **Rate Limiting**: Implement request rate limiting
4. **Logging**: Add comprehensive request logging
5. **Monitoring**: Set up health checks and monitoring

## Deployment Options

### Local Development (Recommended)

```bash
python subtitle_server.py
```

### Production Deployment

#### Using Gunicorn (Linux/macOS)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 subtitle_server:app
```

#### Using Docker
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY subtitle_server.py .
EXPOSE 5000

CMD ["python", "subtitle_server.py"]
```

## Future Enhancements

### Planned Features

1. **Multiple Video Support**: Handle playlists and multiple videos
2. **Batch Processing**: Extract subtitles for multiple videos at once
3. **Subtitle Translation**: Translate subtitles to different languages
4. **Advanced Filtering**: Filter subtitles by speaker, confidence, etc.
5. **WebSocket Support**: Real-time subtitle streaming
6. **GUI Interface**: Desktop application for non-technical users

### Integration Opportunities

1. **Other Platforms**: Support for Vimeo, Dailymotion, etc.
2. **AI Enhancement**: Use AI to improve subtitle quality
3. **Learning Analytics**: Track learning progress and statistics
4. **Social Features**: Share word lists and progress with friends

## Conclusion

The new backend architecture solves the fundamental problem of YouTube subtitle access restrictions while providing a more robust and maintainable solution. The hybrid approach combines the best of both worlds:

- **Reliability**: yt-dlp provides consistent subtitle extraction
- **Performance**: Local server ensures fast response times
- **Flexibility**: Easy to extend and modify
- **User Experience**: Seamless integration with the Chrome extension

The solution is designed to be user-friendly with comprehensive setup scripts and clear documentation, making it accessible to users of all technical levels.

For questions or issues, please refer to the troubleshooting section or contact the development team.