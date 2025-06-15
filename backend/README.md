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

The server will start on `http://localhost:5000`

### 3. Test the Server

Open your browser and visit:
```
http://localhost:5000/extract-subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID
```

## Installation

### Option 1: Using pip (Recommended)

```bash
# Install directly from requirements
pip install -r requirements.txt

# Or install with development dependencies
pip install -r requirements.txt
pip install pytest pytest-flask black flake8
```

### Option 2: Using setup.py

```bash
# Install the package
pip install -e .

# With development dependencies
pip install -e ".[dev]"
```

### Option 3: Virtual Environment (Recommended for development)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
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
  "version": "1.0.0",
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

Edit `subtitle_server.py` to modify:

- **Host:** Change `host='127.0.0.1'` to `host='0.0.0.0'` for external access
- **Port:** Change `port=5000` to your preferred port
- **Debug:** Set `debug=True` for development

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
├── subtitle_server.py    # Main server application
├── requirements.txt      # Python dependencies
├── setup.py             # Package setup
├── README.md            # This file
└── tests/               # Test files (if any)
```

## Security Considerations

- The server runs on localhost by default (127.0.0.1)
- Only accepts requests from browser extensions via CORS
- No authentication required for local use
- For production use, consider adding authentication

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

## Changelog

### Version 1.0.0
- Initial release
- Basic subtitle extraction with yt-dlp
- Flask REST API
- TTML parsing support
- Multi-language support