#!/bin/bash

# Noticing Game - Linux Service Installer
# This script installs the Noticing Game subtitle extraction server as a systemd service,
# allowing it to start automatically when the computer boots up.
#
# Requirements:
# - Linux system with systemd
# - Python 3.8+
# - sudo privileges
#
# Usage:
#     sudo ./install_linux_service.sh install    # Install the service
#     sudo ./install_linux_service.sh start      # Start the service
#     sudo ./install_linux_service.sh stop       # Stop the service
#     sudo ./install_linux_service.sh restart    # Restart the service
#     sudo ./install_linux_service.sh status     # Check service status
#     sudo ./install_linux_service.sh remove     # Remove the service
#     sudo ./install_linux_service.sh logs       # Show service logs
#
# Author: Rafael Hernandez Bustamante
# License: GPL-3.0

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service configuration
SERVICE_NAME="noticing-game-subtitle-server"
SERVICE_DISPLAY_NAME="Noticing Game - Subtitle Extraction Server"
SERVICE_DESCRIPTION="Backend server for Noticing Game Chrome extension that extracts YouTube subtitles using yt-dlp"
SERVICE_USER="noticing-game"
SERVICE_GROUP="noticing-game"

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_SCRIPT="$BACKEND_DIR/subtitle_server.py"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SERVICE_ENV_FILE="/etc/default/${SERVICE_NAME}"
LOG_DIR="/var/log/${SERVICE_NAME}"
WORK_DIR="/opt/${SERVICE_NAME}"

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
    echo "=" * 70
    echo "🎮 NOTICING GAME - LINUX SERVICE INSTALLER"
    echo "=" * 70
    echo "Install the subtitle extraction server as a systemd service"
    echo "to start automatically when your computer boots up."
    echo
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        echo "Example: sudo $0 install"
        exit 1
    fi
}

check_systemd() {
    if ! command -v systemctl &> /dev/null; then
        print_error "systemd is not available on this system"
        echo "This installer only works on systems with systemd."
        exit 1
    fi
    print_success "systemd is available"
}

check_python() {
    local python_cmd=""

    if command -v python3 &> /dev/null; then
        python_cmd="python3"
    elif command -v python &> /dev/null; then
        python_cmd="python"
    else
        print_error "Python is not installed"
        echo "Please install Python 3.8 or higher"
        exit 1
    fi

    # Check Python version
    local python_version=$($python_cmd --version 2>&1 | cut -d' ' -f2)
    local major_version=$(echo $python_version | cut -d'.' -f1)
    local minor_version=$(echo $python_version | cut -d'.' -f2)

    if [ "$major_version" -lt 3 ] || ([ "$major_version" -eq 3 ] && [ "$minor_version" -lt 8 ]); then
        print_error "Python 3.8 or higher is required"
        echo "Current version: $python_version"
        exit 1
    fi

    print_success "Python version: $python_version (Compatible)"
    echo "PYTHON_CMD=$python_cmd" > /tmp/noticing_game_python
}

check_dependencies() {
    echo "Checking dependencies..."

    # Source python command
    source /tmp/noticing_game_python

    # Check if server script exists
    if [ ! -f "$SERVER_SCRIPT" ]; then
        print_error "Server script not found: $SERVER_SCRIPT"
        echo "Make sure you're running this from the correct directory"
        exit 1
    fi
    print_success "Server script found: $SERVER_SCRIPT"

    # Check required Python packages
    local missing_packages=()
    local required_packages=("flask" "flask_cors" "yt_dlp" "requests")

    for package in "${required_packages[@]}"; do
        if ! $PYTHON_CMD -c "import $package" &> /dev/null; then
            missing_packages+=("$package")
        fi
    done

    if [ ${#missing_packages[@]} -gt 0 ]; then
        print_warning "Missing packages: ${missing_packages[*]}"
        echo "Installing missing packages..."

        if [ -f "$BACKEND_DIR/requirements.txt" ]; then
            $PYTHON_CMD -m pip install -r "$BACKEND_DIR/requirements.txt"
        else
            $PYTHON_CMD -m pip install flask flask-cors yt-dlp requests
        fi

        print_success "Dependencies installed"
    else
        print_success "All dependencies are available"
    fi
}

create_service_user() {
    echo "Creating service user..."

    # Create group if it doesn't exist
    if ! getent group "$SERVICE_GROUP" &> /dev/null; then
        groupadd --system "$SERVICE_GROUP"
        print_success "Created group: $SERVICE_GROUP"
    fi

    # Create user if it doesn't exist
    if ! getent passwd "$SERVICE_USER" &> /dev/null; then
        useradd --system --gid "$SERVICE_GROUP" --home-dir "$WORK_DIR" \
                --shell /usr/sbin/nologin --comment "$SERVICE_DISPLAY_NAME" \
                "$SERVICE_USER"
        print_success "Created user: $SERVICE_USER"
    fi
}

create_directories() {
    echo "Creating directories..."

    # Create work directory
    mkdir -p "$WORK_DIR"
    chown "$SERVICE_USER:$SERVICE_GROUP" "$WORK_DIR"
    chmod 755 "$WORK_DIR"

    # Create log directory
    mkdir -p "$LOG_DIR"
    chown "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
    chmod 755 "$LOG_DIR"

    print_success "Directories created"
}

copy_files() {
    echo "Copying server files..."

    # Copy server files to work directory
    cp -r "$BACKEND_DIR"/* "$WORK_DIR/"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$WORK_DIR"
    chmod -R 644 "$WORK_DIR"/*
    chmod 755 "$WORK_DIR"/*.py

    print_success "Files copied to $WORK_DIR"
}

create_service_file() {
    echo "Creating systemd service file..."

    # Source python command
    source /tmp/noticing_game_python

    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=$SERVICE_DISPLAY_NAME
Documentation=https://github.com/Rudull/noticing-game
After=network.target
Wants=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$WORK_DIR
Environment=PATH=/usr/bin:/usr/local/bin
Environment=PYTHONPATH=$WORK_DIR
EnvironmentFile=-$SERVICE_ENV_FILE
ExecStart=$PYTHON_CMD $WORK_DIR/subtitle_server.py
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$LOG_DIR $WORK_DIR
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

    print_success "Service file created: $SERVICE_FILE"
}

create_environment_file() {
    echo "Creating environment file..."

    cat > "$SERVICE_ENV_FILE" << EOF
# Noticing Game Subtitle Server Configuration
# This file contains environment variables for the service

# Flask configuration
FLASK_ENV=production
FLASK_DEBUG=false

# Server configuration
SERVER_HOST=127.0.0.1
SERVER_PORT=5000

# Logging configuration
LOG_LEVEL=INFO
LOG_FILE=$LOG_DIR/server.log

# Python configuration
PYTHONUNBUFFERED=1
PYTHONIOENCODING=utf-8
EOF

    chmod 644 "$SERVICE_ENV_FILE"
    print_success "Environment file created: $SERVICE_ENV_FILE"
}

install_service() {
    print_banner

    echo "Installing $SERVICE_DISPLAY_NAME..."
    echo

    check_root
    check_systemd
    check_python
    check_dependencies
    create_service_user
    create_directories
    copy_files
    create_service_file
    create_environment_file

    # Reload systemd
    systemctl daemon-reload

    # Enable service
    systemctl enable "$SERVICE_NAME"

    print_success "Service installed successfully!"
    echo
    echo "Service name: $SERVICE_NAME"
    echo "Service file: $SERVICE_FILE"
    echo "Work directory: $WORK_DIR"
    echo "Log directory: $LOG_DIR"
    echo
    echo "To start the service now, run:"
    echo "  sudo systemctl start $SERVICE_NAME"
    echo
    echo "To check service status:"
    echo "  sudo systemctl status $SERVICE_NAME"
    echo
    echo "To view logs:"
    echo "  sudo journalctl -u $SERVICE_NAME -f"

    # Clean up
    rm -f /tmp/noticing_game_python
}

remove_service() {
    echo "Removing $SERVICE_DISPLAY_NAME..."

    check_root

    # Stop and disable service
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
        print_success "Service stopped"
    fi

    if systemctl is-enabled --quiet "$SERVICE_NAME"; then
        systemctl disable "$SERVICE_NAME"
        print_success "Service disabled"
    fi

    # Remove service file
    if [ -f "$SERVICE_FILE" ]; then
        rm -f "$SERVICE_FILE"
        print_success "Service file removed"
    fi

    # Remove environment file
    if [ -f "$SERVICE_ENV_FILE" ]; then
        rm -f "$SERVICE_ENV_FILE"
        print_success "Environment file removed"
    fi

    # Reload systemd
    systemctl daemon-reload
    systemctl reset-failed

    echo
    read -p "Do you want to remove the work directory ($WORK_DIR)? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$WORK_DIR"
        print_success "Work directory removed"
    fi

    echo
    read -p "Do you want to remove the service user ($SERVICE_USER)? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if getent passwd "$SERVICE_USER" &> /dev/null; then
            userdel "$SERVICE_USER"
            print_success "Service user removed"
        fi

        if getent group "$SERVICE_GROUP" &> /dev/null; then
            groupdel "$SERVICE_GROUP"
            print_success "Service group removed"
        fi
    fi

    print_success "Service removed successfully!"
}

start_service() {
    echo "Starting $SERVICE_DISPLAY_NAME..."

    check_root

    if ! systemctl is-enabled --quiet "$SERVICE_NAME"; then
        print_error "Service is not installed"
        echo "Run: sudo $0 install"
        exit 1
    fi

    systemctl start "$SERVICE_NAME"

    # Wait a moment and check status
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "Service started successfully!"
        echo "The subtitle extraction server is now running"
        echo "Server URL: http://127.0.0.1:5000"
    else
        print_error "Service failed to start"
        echo "Check logs with: sudo journalctl -u $SERVICE_NAME"
        exit 1
    fi
}

stop_service() {
    echo "Stopping $SERVICE_DISPLAY_NAME..."

    check_root

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
        print_success "Service stopped successfully!"
    else
        print_warning "Service is not running"
    fi
}

restart_service() {
    echo "Restarting $SERVICE_DISPLAY_NAME..."

    check_root

    systemctl restart "$SERVICE_NAME"

    # Wait a moment and check status
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "Service restarted successfully!"
    else
        print_error "Service failed to restart"
        echo "Check logs with: sudo journalctl -u $SERVICE_NAME"
        exit 1
    fi
}

status_service() {
    echo "Checking $SERVICE_DISPLAY_NAME status..."
    echo

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "Service is running"
        echo "Server URL: http://127.0.0.1:5000"
    else
        print_warning "Service is not running"
    fi

    echo
    echo "Detailed status:"
    systemctl status "$SERVICE_NAME" --no-pager
}

show_logs() {
    echo "Showing $SERVICE_DISPLAY_NAME logs..."
    echo "Press Ctrl+C to exit"
    echo

    journalctl -u "$SERVICE_NAME" -f
}

show_help() {
    print_banner

    echo "USAGE:"
    echo "  sudo $0 <command>"
    echo
    echo "COMMANDS:"
    echo "  install    Install the service (requires root)"
    echo "  remove     Remove the service (requires root)"
    echo "  start      Start the service"
    echo "  stop       Stop the service"
    echo "  restart    Restart the service"
    echo "  status     Show service status"
    echo "  logs       Show service logs (follow mode)"
    echo "  help       Show this help"
    echo
    echo "EXAMPLES:"
    echo "  # Install and start the service"
    echo "  sudo $0 install"
    echo "  sudo $0 start"
    echo
    echo "  # Check if it's working"
    echo "  sudo $0 status"
    echo
    echo "  # View live logs"
    echo "  sudo $0 logs"
    echo
    echo "NOTES:"
    echo "  • Run with sudo for all commands"
    echo "  • Service will start automatically on boot after installation"
    echo "  • Server will be available at http://127.0.0.1:5000"
    echo "  • Logs are available via journalctl"
    echo "  • Work directory: $WORK_DIR"
    echo "  • Log directory: $LOG_DIR"
}

# Main function
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    case "$1" in
        install)
            install_service
            ;;
        remove)
            remove_service
            ;;
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            status_service
            ;;
        logs)
            show_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use 'help' to see available commands"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
