#!/usr/bin/env python3
"""
Noticing Game - Subtitle Extraction Server
Backend server for subtitle extraction on YouTube, Netflix, and Disney+. Compatible with Chromium-based browsers.
"""

import json
import logging
import re
import argparse
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import tempfile
import os
import xml.etree.ElementTree as ET
from pathlib import Path
from version import __version__

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def load_config():
    """Load configuration from file"""
    default_config = {
        'server_host': '127.0.0.1',
        'server_port': 5000,
        'debug': False
    }

    config_file = Path.home() / ".noticing_game_config.json"

    if config_file.exists():
        try:
            with open(config_file, 'r') as f:
                saved_config = json.load(f)
                # Only use server-related config from the file
                server_config = {
                    'server_host': saved_config.get('server_host', default_config['server_host']),
                    'server_port': saved_config.get('server_port', default_config['server_port']),
                    'debug': saved_config.get('debug', default_config['debug'])
                }
                return server_config
        except Exception as e:
            logger.warning(f"Error loading config file: {e}, using defaults")
            return default_config
    else:
        logger.info("Configuration file not found, using defaults")
        return default_config

class SubtitleExtractor:
    """Class to handle YouTube subtitle extraction using yt-dlp"""

    def __init__(self):
        self.ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en', 'es', 'en-US', 'en-GB'],
            'subtitlesformat': 'ttml',
            'skip_download': True,
            'extract_flat': False,
            # Try to use browser cookies to avoid 429 errors and access age-restricted content
            'cookiesfrombrowser': ('chrome',), 
        }

    def extract_video_id(self, url):
        """Extract YouTube video ID from URL"""
        patterns = [
            r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
            r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})',
            r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        # If it's already just the video ID
        if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
            return url

        return None

    def parse_ttml_subtitles(self, ttml_content):
        """Parse TTML subtitle content and extract text with timestamps"""
        try:
            root = ET.fromstring(ttml_content)

            # Define namespaces
            namespaces = {
                'ttml': 'http://www.w3.org/ns/ttml',
                'ttm': 'http://www.w3.org/ns/ttml#metadata',
                'ttp': 'http://www.w3.org/ns/ttml#parameter',
                'tts': 'http://www.w3.org/ns/ttml#styling'
            }

            subtitles = []

            # Find all p elements (subtitle segments)
            for p in root.findall('.//ttml:p', namespaces):
                begin = p.get('begin', '0s')
                end = p.get('end', '0s')
                text = ''.join(p.itertext()).strip()

                if text:
                    # Convert time format to seconds
                    start_seconds = self.time_to_seconds(begin)
                    end_seconds = self.time_to_seconds(end)

                    subtitles.append({
                        'text': text,
                        'start': start_seconds,
                        'end': end_seconds,
                        'duration': end_seconds - start_seconds
                    })

            return subtitles

        except ET.ParseError as e:
            logger.error(f"Error parsing TTML: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error parsing TTML: {e}")
            return []

    def time_to_seconds(self, time_str):
        """Convert time string to seconds"""
        if not time_str:
            return 0.0

        try:
            # Handle format like "12.345s"
            if time_str.endswith('s'):
                return float(time_str[:-1])

            # Handle format like "00:01:23.456"
            if ':' in time_str:
                parts = time_str.split(':')
                if len(parts) == 3:
                    hours, minutes, seconds = parts
                    return float(hours) * 3600 + float(minutes) * 60 + float(seconds)
                elif len(parts) == 2:
                    minutes, seconds = parts
                    return float(minutes) * 60 + float(seconds)

            return float(time_str)

        except (ValueError, TypeError):
            logger.warning(f"Could not parse time: {time_str}")
            return 0.0

    def parse_vtt_subtitles(self, vtt_content):
        """Parse WebVTT subtitle content"""
        try:
            subtitles = []
            
            # Simple VTT parser
            lines = vtt_content.splitlines()
            buffer = {
                'start': None,
                'end': None,
                'text': []
            }
            
            # Regex for VTT timestamp: 00:00:00.000 or 00:00.000
            time_pattern = r'((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{3})'
            
            for line in lines:
                line = line.strip()
                if not line:
                    # End of block, save if we have data
                    if buffer['start'] is not None and buffer['text']:
                        subtitles.append({
                            'text': ' '.join(buffer['text']).strip(),
                            'start': buffer['start'],
                            'end': buffer['end'],
                            'duration': buffer['end'] - buffer['start']
                        })
                        buffer = {'start': None, 'end': None, 'text': []}
                    continue
                
                if 'WEBVTT' in line or 'X-TIMESTAMP' in line or line.startswith('NOTE'):
                    continue
                
                # Check for timestamp line
                time_match = re.search(time_pattern, line)
                if time_match:
                    # If we had a previous buffer that wasn't saved (e.g. no empty line), save it now
                    if buffer['start'] is not None and buffer['text']:
                        subtitles.append({
                            'text': ' '.join(buffer['text']).strip(),
                            'start': buffer['start'],
                            'end': buffer['end'],
                            'duration': buffer['end'] - buffer['start']
                        })
                        buffer = {'start': None, 'end': None, 'text': []}
                    
                    buffer['start'] = self.time_to_seconds(time_match.group(1))
                    buffer['end'] = self.time_to_seconds(time_match.group(2))
                    continue
                
                # If we have a start time, this must be text
                if buffer['start'] is not None:
                    # Remove VTT tags like <c.color> or <b>
                    clean_line = re.sub(r'<[^>]+>', '', line)
                    if clean_line:
                        buffer['text'].append(clean_line)
            
            # Check for last buffer
            if buffer['start'] is not None and buffer['text']:
                subtitles.append({
                    'text': ' '.join(buffer['text']).strip(),
                    'start': buffer['start'],
                    'end': buffer['end'],
                    'duration': buffer['end'] - buffer['start']
                })
                
            return subtitles
            
        except Exception as e:
            logger.error(f"Error parsing VTT: {e}")
            return []

    def get_subtitles(self, video_url):
        """Extract subtitles from YouTube video"""
        video_id = self.extract_video_id(video_url)
        if not video_id:
            raise ValueError("Invalid YouTube URL or video ID")

        logger.info(f"Extracting subtitles for video: {video_id}")

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Configure yt-dlp with temporary directory
                # Configure yt-dlp with temporary directory
                ydl_opts = self.ydl_opts.copy()
                ydl_opts['outtmpl'] = os.path.join(temp_dir, '%(id)s.%(ext)s')

                info = None
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        # Extract video info
                        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                except yt_dlp.utils.DownloadError as e:
                    # Check for cookie-related errors and retry without cookies
                    err_msg = str(e).lower()
                    if ("cookies" in err_msg or "could not copy" in err_msg) and 'cookiesfrombrowser' in ydl_opts:
                        logger.warning(f"Cookie access issue detected: {e}. Retrying without browser cookies...")
                        ydl_opts.pop('cookiesfrombrowser', None)
                        
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                    else:
                        raise e

                # Check if subtitles are available (must have 'info' by now)
                subtitles_info = info.get('subtitles', {})
                auto_subtitles_info = info.get('automatic_captions', {})

                if not subtitles_info and not auto_subtitles_info:
                    raise ValueError("No subtitles available for this video")

                # Smart subtitle selection: prioritize English (manual or auto) over other languages
                selected_lang = None
                subtitle_source = None
                
                # Priority order: Manual EN > Auto EN > Manual ES > Auto ES > Any Manual > Any Auto
                lang_priority = ['en', 'en-US', 'en-GB', 'es']
                
                # First, try to find preferred language in manual subtitles
                for lang in lang_priority:
                    if lang in subtitles_info:
                        selected_lang = lang
                        subtitle_source = "manual"
                        break
                
                # If no preferred manual subtitle found, try automatic captions
                if not selected_lang:
                    for lang in lang_priority:
                        if lang in auto_subtitles_info:
                            selected_lang = lang
                            subtitle_source = "automatic"
                            break
                
                # If still not found, fall back to any manual subtitle
                if not selected_lang and subtitles_info:
                    selected_lang = list(subtitles_info.keys())[0]
                    subtitle_source = "manual"
                
                # Finally, fall back to any automatic caption
                if not selected_lang and auto_subtitles_info:
                    selected_lang = list(auto_subtitles_info.keys())[0]
                    subtitle_source = "automatic"
                
                if not selected_lang:
                    raise ValueError("No subtitles could be selected")

                logger.info(f"Using {subtitle_source} subtitles in language: {selected_lang}")

                # For auto-generated subtitles, try multiple formats (optimized order)
                parsed_subtitles = []
                subtitle_file = None
                
                if subtitle_source == "automatic":
                    # Try VTT first (most reliable for ASR), then JSON3, then TTML
                    formats_to_try = ['vtt', 'json3', 'ttml']
                else:
                    # For manual subtitles, TTML is usually sufficient
                    formats_to_try = ['ttml', 'vtt']
                
                last_error = None

                for format_index, subtitle_format in enumerate(formats_to_try):
                    try:
                        logger.info(f"Attempting to download subtitles in {subtitle_format} format ({format_index + 1}/{len(formats_to_try)})...")
                        
                        # Update download options for this format
                        ydl_opts_current = ydl_opts.copy()
                        ydl_opts_current['outtmpl'] = os.path.join(temp_dir, '%(id)s.%(ext)s')
                        ydl_opts_current['writesubtitles'] = subtitle_source == "manual"
                        ydl_opts_current['writeautomaticsub'] = subtitle_source == "automatic"
                        ydl_opts_current['subtitleslangs'] = [selected_lang]
                        ydl_opts_current['subtitlesformat'] = subtitle_format
                        # Add timeout to prevent hanging
                        ydl_opts_current['socket_timeout'] = 15
                        
                        # Add user agent to avoid bot detection
                        ydl_opts_current['http_headers'] = {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }

                        with yt_dlp.YoutubeDL(ydl_opts_current) as ydl_download:
                            ydl_download.download([f"https://www.youtube.com/watch?v={video_id}"])

                        # Find subtitle file with this format
                        # Note: yt-dlp might append language code
                        subtitle_files = []
                        
                        # For json3, usage is inconsistent, sometimes it's just .json
                        possible_extensions = [subtitle_format]
                        if subtitle_format == 'json3':
                            possible_extensions.append('json')
                        
                        for file in os.listdir(temp_dir):
                            for ext in possible_extensions:
                                if file.endswith(f'.{ext}') and (selected_lang in file or len(os.listdir(temp_dir)) == 1):
                                    subtitle_files.append(file)
                        
                        if subtitle_files:
                            subtitle_file = os.path.join(temp_dir, subtitle_files[0])
                            
                            with open(subtitle_file, 'r', encoding='utf-8') as f:
                                subtitle_content = f.read()

                            # Parse based on format
                            if subtitle_format == 'json3' or subtitle_files[0].endswith('.json3') or (subtitle_files[0].endswith('.json') and 'events' in subtitle_content):
                                parsed_subtitles = self.parse_json3_subtitles(subtitle_content)
                            elif subtitle_format == 'vtt' or subtitle_files[0].endswith('.vtt'):
                                parsed_subtitles = self.parse_vtt_subtitles(subtitle_content)
                            else:
                                parsed_subtitles = self.parse_ttml_subtitles(subtitle_content)
                            
                            if parsed_subtitles:
                                logger.info(f"Successfully parsed {len(parsed_subtitles)} subtitles using {subtitle_format} format")
                                break  # Success! Stop trying other formats
                            else:
                                logger.warning(f"Parsed 0 subtitles with {subtitle_format}, trying next format...")
                                # Clean up empty file before next attempt
                                try:
                                    os.remove(subtitle_file)
                                except:
                                    pass
                        else:
                            logger.warning(f"No subtitle file found for format {subtitle_format}")
                            logger.warning(f"Files in temp dir: {os.listdir(temp_dir)}")
                            
                    except Exception as e:
                        last_error = e
                        logger.warning(f"Failed to get subtitles in {subtitle_format} format: {e}")
                        # Only try next format if we haven't succeeded
                        if format_index < len(formats_to_try) - 1:
                            logger.info(f"Trying next format...")
                        continue
                
                if not parsed_subtitles:
                    error_msg = f"Could not parse subtitle content in any supported format. Last error: {last_error}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                return {
                    'success': True,
                    'video_id': video_id,
                    'video_title': info.get('title', 'Unknown'),
                    'language': selected_lang,
                    'source': subtitle_source,
                    'subtitle_count': len(parsed_subtitles),
                    'subtitles': parsed_subtitles
                }

            except yt_dlp.DownloadError as e:
                error_msg = str(e)
                if "Private video" in error_msg:
                    raise ValueError("This video is private and cannot be accessed")
                elif "Video unavailable" in error_msg:
                    raise ValueError("This video is unavailable")
                elif "not available" in error_msg.lower():
                    raise ValueError("This video or its subtitles are not available")
                else:
                    raise ValueError(f"Download error: {error_msg}")

            except Exception as e:
                logger.error(f"Error extracting subtitles: {e}")
                raise ValueError(f"Error extracting subtitles: {str(e)}")

# Initialize subtitle extractor
extractor = SubtitleExtractor()

@app.route('/', methods=['GET'])
def home():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'service': 'Noticing Game Subtitle Server',
        'version': __version__,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/info', methods=['GET'])
def info():
    """Server information endpoint"""
    return jsonify({
        'name': 'Noticing Game - Subtitle Extraction Server',
        'version': __version__,
        'description': 'Backend server for subtitle extraction on YouTube, Netflix, and Disney+. Compatible with Chromium-based browsers.',
        'author': 'Rafael Hernandez Bustamante',
        'license': 'GNU General Public License v3.0 (GPL-3.0)',
        'repository': 'https://github.com/Rudull/noticing-game',
        'endpoints': {
            '/': 'Health check',
            '/info': 'Server information',
            '/extract-subtitles': 'Extract subtitles from YouTube video (POST/GET)'
        },
        'timestamp': datetime.now().isoformat()
    })

@app.route('/extract-subtitles', methods=['POST'])
def extract_subtitles():
    """Extract subtitles from YouTube video"""
    try:
        data = request.get_json()

        if not data or 'url' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing video URL in request body'
            }), 400

        video_url = data['url']
        logger.info(f"Received subtitle extraction request for: {video_url}")

        # Extract subtitles
        result = extractor.get_subtitles(video_url)

        logger.info(f"Successfully extracted {result['subtitle_count']} subtitles")
        return jsonify(result)

    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@app.route('/extract-subtitles', methods=['GET'])
def extract_subtitles_get():
    """Extract subtitles using GET method (for testing)"""
    try:
        video_url = request.args.get('url')

        if not video_url:
            return jsonify({
                'success': False,
                'error': 'Missing video URL parameter'
            }), 400

        logger.info(f"Received GET subtitle extraction request for: {video_url}")

        # Extract subtitles
        result = extractor.get_subtitles(video_url)

        logger.info(f"Successfully extracted {result['subtitle_count']} subtitles")
        return jsonify(result)

    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

def main():
    """Main function to start the server with configuration"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Start the Noticing Game subtitle extraction server")
    parser.add_argument("--host", help="Host to bind to (overrides config file)")
    parser.add_argument("--port", type=int, help="Port to bind to (overrides config file)")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")

    args = parser.parse_args()

    # Load configuration from file
    config = load_config()

    # Override with command line arguments if provided
    host = args.host if args.host else config['server_host']
    port = args.port if args.port else config['server_port']
    debug = args.debug if args.debug else config['debug']

    logger.info("Starting Noticing Game Subtitle Server...")
    logger.info(f"Server will be available at http://{host}:{port}")
    logger.info("Use POST /extract-subtitles with JSON body: {'url': 'youtube_url'}")
    logger.info("Or GET /extract-subtitles?url=youtube_url for testing")
    logger.info(f"Configuration loaded from: {Path.home() / '.noticing_game_config.json'}")

    if args.host or args.port:
        logger.info("Command line arguments override configuration file settings")

    # Run the server
    app.run(
        host=host,
        port=port,
        debug=debug,
        threaded=True
    )

if __name__ == '__main__':
    main()
