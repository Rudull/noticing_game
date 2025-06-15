#!/bin/bash

# Noticing Game Backend - Unix/Linux/macOS Startup Script
# This script helps Unix/Linux/macOS users start the subtitle extraction server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  INFO: $1${NC}"
}

print_banner() {
    echo "==============================================================="
    echo "🎮 NOTICING GAME - SUBTITLE EXTRACTION SERVER"
    echo "==============================================================="
    echo "Backend server for YouTube subtitle extraction"
    echo "Using yt-dlp for reliable subtitle access"
    echo
}

check_python() {
    echo "Checking Python installation..."

    # Check if python3 is available
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        print_error "Python is not installed or not in PATH"
        echo
        echo "Please install Python 3.8 or higher:"
        echo "  - Ubuntu/Debian: sudo apt update && sudo apt install python3 python3-pip"
        echo "  - CentOS/RHEL: sudo yum install python3 python3-pip"
        echo "  - macOS: brew install python3 (requires Homebrew)"
        echo "  - Or download from: https://www.python.org/downloads/"
        exit 1
    fi

    # Check Python version
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
    MAJOR_VERSION=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    MINOR_VERSION=$(echo $PYTHON_VERSION | cut -d'.' -f2)

    if [ "$MAJOR_VERSION" -lt 3 ] || ([ "$MAJOR_VERSION" -eq 3 ] && [ "$MINOR_VERSION" -lt 8 ]); then
        print_error "Python 3.8 or higher is required"
        echo "Current version: $PYTHON_VERSION"
        echo "Please upgrade Python and try again."
        exit 1
    fi

    print_success "Python version: $PYTHON_VERSION (Compatible)"
}

check_pip() {
    echo "Checking pip installation..."

    if $PYTHON_CMD -m pip --version &> /dev/null; then
        PIP_CMD="$PYTHON_CMD -m pip"
    elif command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
    else
        print_error "pip is not installed"
        echo
        echo "Please install pip:"
        echo "  - Ubuntu/Debian: sudo apt install python3-pip"
        echo "  - CentOS/RHEL: sudo yum install python3-pip"
        echo "  - macOS: python3 -m ensurepip --upgrade"
        exit 1
    fi

    print_success "pip is available"
}

check_server_file() {
    echo "Checking server file..."

    if [ ! -f "subtitle_server.py" ]; then
        print_error "subtitle_server.py not found"
        echo "Please make sure you're running this script from the backend directory"
        echo "Current directory: $(pwd)"
        exit 1
    fi

    print_success "Server file found"
}

install_dependencies() {
    echo
    echo "🔧 Installing dependencies..."

    # Try to install from requirements.txt first
    if [ -f "requirements.txt" ]; then
        echo "Installing from requirements.txt..."
        if $PIP_CMD install -r requirements.txt; then
            print_success "Dependencies installed from requirements.txt!"
            return 0
        else
            print_warning "Failed to install from requirements.txt, trying manual installation..."
        fi
    else
        print_warning "requirements.txt not found, installing manually..."
    fi

    # Manual installation
    echo "Installing dependencies manually..."
    if $PIP_CMD install flask flask-cors yt-dlp requests; then
        print_success "Dependencies installed successfully!"
        return 0
    else
        print_error "Failed to install dependencies"
        echo
        echo "Please try installing manually:"
        echo "  $PIP_CMD install flask flask-cors yt-dlp requests"
        echo
        echo "If you get permission errors, try:"
        echo "  $PIP_CMD install --user flask flask-cors yt-dlp requests"
        exit 1
    fi
}

check_port() {
    local host=${1:-127.0.0.1}
    local port=${2:-5000}

    echo "Checking if port $port is available..."

    if command -v nc &> /dev/null; then
        if nc -z "$host" "$port" 2>/dev/null; then
            print_warning "Port $port is already in use on $host"
            echo "You may need to stop the existing service or use a different port"
            return 1
        else
            print_success "Port $port is available on $host"
            return 0
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -ln | grep ":$port " &> /dev/null; then
            print_warning "Port $port appears to be in use"
            return 1
        else
            print_success "Port $port appears to be available"
            return 0
        fi
    else
        print_info "Cannot check port availability (nc or netstat not found)"
        return 0
    fi
}

print_startup_info() {
    local host=${1:-127.0.0.1}
    local port=${2:-5000}

    echo
    echo "🚀 STARTING SERVER..."
    echo "   Host: $host"
    echo "   Port: $port"
    echo "   URL: http://$host:$port"
    echo
    echo "📋 AVAILABLE ENDPOINTS:"
    echo "   Health Check: http://$host:$port/"
    echo "   Extract Subtitles: http://$host:$port/extract-subtitles"
    echo
    echo "📚 USAGE:"
    echo "   POST /extract-subtitles"
    echo '   Body: {"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
    echo
    echo "   GET /extract-subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID"
    echo
    echo "⚠️  IMPORTANT:"
    echo "   - Keep this terminal open while using the Chrome extension"
    echo "   - The server must be running for the extension to work"
    echo "   - Press Ctrl+C to stop the server"
    echo
}

# Function to handle cleanup on exit
cleanup() {
    echo
    echo
    echo "🛑 Server stopped"
    echo "   Goodbye!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Parse command line arguments
HOST="127.0.0.1"
PORT="5000"
AUTO_INSTALL=false
DEBUG=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --auto-install)
            AUTO_INSTALL=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo
            echo "Options:"
            echo "  --host HOST        Host to bind to (default: 127.0.0.1)"
            echo "  --port PORT        Port to bind to (default: 5000)"
            echo "  --auto-install     Automatically install missing dependencies"
            echo "  --debug            Enable debug mode"
            echo "  --help, -h         Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_banner

    check_python
    check_pip
    check_server_file

    # Check/install dependencies
    echo "Checking dependencies..."

    # Check if main packages are available
    missing_deps=()
    for package in flask flask_cors yt_dlp requests; do
        if ! $PYTHON_CMD -c "import $package" &> /dev/null; then
            missing_deps+=("$package")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_warning "Missing dependencies: ${missing_deps[*]}"

        if [ "$AUTO_INSTALL" = true ]; then
            install_dependencies
        else
            echo
            echo "💡 TIP: Use --auto-install to automatically install missing dependencies"
            echo "   $0 --auto-install"
            echo
            read -p "Install dependencies now? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                install_dependencies
            else
                echo "Please install dependencies manually and try again."
                exit 1
            fi
        fi
    else
        print_success "All dependencies are installed"
    fi

    check_port "$HOST" "$PORT"
    print_startup_info "$HOST" "$PORT"

    echo "🎬 Server is starting..."
    echo "   Waiting for requests..."
    echo

    # Start the server
    if [ "$DEBUG" = true ]; then
        print_info "Debug mode enabled"
        FLASK_DEBUG=1 $PYTHON_CMD subtitle_server.py
    else
        $PYTHON_CMD subtitle_server.py
    fi
}

# Run main function
main "$@"
