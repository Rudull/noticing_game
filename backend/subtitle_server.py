#!/usr/bin/env python3
"""
Noticing Game - Subtitle Extraction Server
Backend server using yt-dlp to extract YouTube subtitles for the Noticing Game extension.
"""

import json
import logging
import re
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
import tempfile
import os
import xml.etree.ElementTree as ET

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

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

    def get_subtitles(self, video_url):
        """Extract subtitles from YouTube video"""
        video_id = self.extract_video_id(video_url)
        if not video_id:
            raise ValueError("Invalid YouTube URL or video ID")

        logger.info(f"Extracting subtitles for video: {video_id}")

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Configure yt-dlp with temporary directory
                ydl_opts = self.ydl_opts.copy()
                ydl_opts['outtmpl'] = os.path.join(temp_dir, '%(id)s.%(ext)s')

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # Extract video info
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

                    # Check if subtitles are available
                    subtitles_info = info.get('subtitles', {})
                    auto_subtitles_info = info.get('automatic_captions', {})

                    if not subtitles_info and not auto_subtitles_info:
                        raise ValueError("No subtitles available for this video")

                    # Prefer manual subtitles over automatic ones
                    available_langs = []
                    subtitle_source = "manual"

                    if subtitles_info:
                        available_langs = list(subtitles_info.keys())
                    elif auto_subtitles_info:
                        available_langs = list(auto_subtitles_info.keys())
                        subtitle_source = "automatic"

                    # Select best language (prefer English)
                    selected_lang = None
                    lang_priority = ['en', 'en-US', 'en-GB', 'es']

                    for lang in lang_priority:
                        if lang in available_langs:
                            selected_lang = lang
                            break

                    if not selected_lang:
                        selected_lang = available_langs[0]

                    logger.info(f"Using {subtitle_source} subtitles in language: {selected_lang}")

                    # Download subtitles
                    ydl_opts['writesubtitles'] = subtitle_source == "manual"
                    ydl_opts['writeautomaticsub'] = subtitle_source == "automatic"
                    ydl_opts['subtitleslangs'] = [selected_lang]

                    with yt_dlp.YoutubeDL(ydl_opts) as ydl_download:
                        ydl_download.download([f"https://www.youtube.com/watch?v={video_id}"])

                    # Find and read subtitle file
                    subtitle_files = []
                    for file in os.listdir(temp_dir):
                        if file.endswith('.ttml') and selected_lang in file:
                            subtitle_files.append(file)

                    if not subtitle_files:
                        raise ValueError("Subtitle file not found after download")

                    subtitle_file = os.path.join(temp_dir, subtitle_files[0])

                    with open(subtitle_file, 'r', encoding='utf-8') as f:
                        subtitle_content = f.read()

                    # Parse subtitles
                    parsed_subtitles = self.parse_ttml_subtitles(subtitle_content)

                    if not parsed_subtitles:
                        raise ValueError("Could not parse subtitle content")

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
        'version': '0.1.0',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/info', methods=['GET'])
def info():
    """Server information endpoint"""
    return jsonify({
        'name': 'Noticing Game - Subtitle Extraction Server',
        'version': '0.1.0',
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

if __name__ == '__main__':
    logger.info("Starting Noticing Game Subtitle Server...")
    logger.info("Server will be available at http://localhost:5000")
    logger.info("Use POST /extract-subtitles with JSON body: {'url': 'youtube_url'}")
    logger.info("Or GET /extract-subtitles?url=youtube_url for testing")

    # Run the server
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=False,
        threaded=True
    )
