#!/bin/bash

# Noticing Game - Linux/macOS Service Installer
# This script installs the Noticing Game subtitle extraction server as a system service
#
# For Linux: Uses systemd
# For macOS: Uses launchd
#
# Requirements:
# - Python 3.8+
# - Required Python packages (flask, flask-cors, yt-dlp, requests)
# - Sudo privileges for system service installation
#
# Usage:
#   ./install_linux_service.sh install    # Install the service
#   ./install_linux_service.sh start      # Start the service
#   ./install_linux_service.sh stop       # Stop the service
#   ./install_linux_service.sh restart    # Restart the service
#   ./install_linux_service.sh remove     # Remove the service
#   ./install_linux_service.sh status     # Check service status
#   ./install_linux_service.sh enable     # Enable auto-start
#   ./install_linux_service.sh disable    # Disable auto-start
#   ./install_linux_service.sh help       # Show help
#
# Author: Rafael Hernandez Bustamante
# License: GPL-3.0

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Service configuration
SERVICE_NAME="noticing-game-subtitle-server"
SERVICE_DISPLAY_NAME="Noticing Game Subtitle Server"
SERVICE_DESCRIPTION="Backend server for Noticing Game Chrome extension that extracts YouTube subtitles using yt-dlp"

# Detect OS
OS_TYPE=""
INIT_SYSTEM=""

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS_TYPE="linux"
        if command -v systemctl &> /dev/null; then
            INIT_SYSTEM="systemd"
        elif command -v service &> /dev/null; then
            INIT_SYSTEM="sysv"
        else
            INIT_SYSTEM="unknown"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS_TYPE="macos"
        INIT_SYSTEM="launchd"
    else
        OS_TYPE="unknown"
        INIT_SYSTEM="unknown"
    fi
}

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
    echo -e "${PURPLE}======================================================================${NC}"
    echo -e "${PURPLE}🎮 NOTICING GAME - LINUX/MACOS SERVICE INSTALLER${NC}"
    echo -e "${PURPLE}======================================================================${NC}"
    echo "Install the subtitle extraction server as a system service"
    echo "to start automatically when your computer boots up."
    echo
    echo -e "Operating System: ${BLUE}$OS_TYPE${NC}"
    echo -e "Init System: ${BLUE}$INIT_SYSTEM${NC}"
    echo
}

check_dependencies() {
    echo "Checking dependencies..."

    # Check if running as root for system service installation
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root. Service will be installed system-wide."
    else
        print_info "Running as user. Service will be installed for current user only."
    fi

    # Check Python version
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        echo "Install Python 3.8+ first:"
        if [[ "$OS_TYPE" == "linux" ]]; then
            echo "  Ubuntu/Debian: sudo apt update && sudo apt install python3 python3-pip"
            echo "  CentOS/RHEL: sudo yum install python3 python3-pip"
            echo "  Arch: sudo pacman -S python python-pip"
        elif [[ "$OS_TYPE" == "macos" ]]; then
            echo "  macOS: brew install python3"
        fi
        return 1
    fi

    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    MAJOR_VERSION=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    MINOR_VERSION=$(echo $PYTHON_VERSION | cut -d'.' -f2)

    if [ "$MAJOR_VERSION" -lt 3 ] || ([ "$MAJOR_VERSION" -eq 3 ] && [ "$MINOR_VERSION" -lt 8 ]); then
        print_error "Python 3.8 or higher is required"
        echo "Current version: $PYTHON_VERSION"
        return 1
    fi

    print_success "Python version: $PYTHON_VERSION"

    # Check if subtitle_server.py exists
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    SERVER_SCRIPT="$SCRIPT_DIR/subtitle_server.py"

    if [ ! -f "$SERVER_SCRIPT" ]; then
        print_error "Server script not found: $SERVER_SCRIPT"
        echo "Make sure you're running this from the backend directory"
        return 1
    fi

    print_success "Server script found: $SERVER_SCRIPT"

    # Check required Python packages
    echo "Checking Python packages..."
    missing_packages=()

    for package in flask flask_cors yt_dlp requests; do
        if python3 -c "import $package" &> /dev/null; then
            print_success "$package: Available"
        else
            print_warning "$package: Missing"
            missing_packages+=("$package")
        fi
    done

    if [ ${#missing_packages[@]} -gt 0 ]; then
        print_warning "Missing packages: ${missing_packages[*]}"
        echo
        echo "Install missing packages with:"
        echo "  pip3 install ${missing_packages[*]}"
        echo "Or install all requirements:"
        echo "  pip3 install -r requirements.txt"
        echo
        read -p "Install missing packages now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Installing missing packages..."
            if pip3 install "${missing_packages[@]}"; then
                print_success "Packages installed successfully!"
            else
                print_error "Failed to install packages"
                return 1
            fi
        else
            print_error "Please install missing packages first"
            return 1
        fi
    fi

    return 0
}

create_systemd_service() {
    local user_mode=""
    local service_dir=""
    local python_cmd=""

    # Determine service directory and user mode
    if [[ $EUID -eq 0 ]]; then
        service_dir="/etc/systemd/system"
        user_mode=""
    else
        service_dir="$HOME/.config/systemd/user"
        user_mode="--user"
        mkdir -p "$service_dir"
    fi

    # Find Python executable
    if command -v python3 &> /dev/null; then
        python_cmd="python3"
    else
        python_cmd="python"
    fi

    # Create service file
    local service_file="$service_dir/${SERVICE_NAME}.service"

    cat > "$service_file" << EOF
[Unit]
Description=${SERVICE_DESCRIPTION}
After=network.target
Wants=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${SCRIPT_DIR}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=PYTHONPATH=${SCRIPT_DIR}
ExecStart=${python_cmd} ${SERVER_SCRIPT}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${SCRIPT_DIR}

[Install]
WantedBy=default.target
EOF

    echo "Created systemd service file: $service_file"

    # Reload systemd
    systemctl $user_mode daemon-reload

    return 0
}

create_launchd_service() {
    local plist_dir=""
    local python_cmd=""

    # Determine plist directory
    if [[ $EUID -eq 0 ]]; then
        plist_dir="/Library/LaunchDaemons"
    else
        plist_dir="$HOME/Library/LaunchAgents"
        mkdir -p "$plist_dir"
    fi

    # Find Python executable
    if command -v python3 &> /dev/null; then
        python_cmd=$(which python3)
    else
        python_cmd=$(which python)
    fi

    # Create plist file
    local plist_file="$plist_dir/com.noticingame.subtitle-server.plist"

    cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.noticingame.subtitle-server</string>

    <key>ProgramArguments</key>
    <array>
        <string>${python_cmd}</string>
        <string>${SERVER_SCRIPT}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/noticing-game-subtitle-server.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/noticing-game-subtitle-server.error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
        <key>PYTHONPATH</key>
        <string>${SCRIPT_DIR}</string>
    </dict>
</dict>
</plist>
EOF

    echo "Created launchd plist file: $plist_file"

    return 0
}

install_service() {
    echo "Installing $SERVICE_DISPLAY_NAME..."

    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        create_systemd_service
        print_success "Systemd service installed successfully!"

        # Show next steps
        echo
        echo "Next steps:"
        if [[ $EUID -eq 0 ]]; then
            echo "  sudo systemctl enable $SERVICE_NAME    # Enable auto-start"
            echo "  sudo systemctl start $SERVICE_NAME     # Start now"
            echo "  sudo systemctl status $SERVICE_NAME    # Check status"
        else
            echo "  systemctl --user enable $SERVICE_NAME    # Enable auto-start"
            echo "  systemctl --user start $SERVICE_NAME     # Start now"
            echo "  systemctl --user status $SERVICE_NAME    # Check status"
        fi

    elif [[ "$INIT_SYSTEM" == "launchd" ]]; then
        create_launchd_service
        print_success "Launchd service installed successfully!"

        # Show next steps
        echo
        echo "Next steps:"
        if [[ $EUID -eq 0 ]]; then
            echo "  sudo launchctl load /Library/LaunchDaemons/com.noticingame.subtitle-server.plist"
        else
            echo "  launchctl load ~/Library/LaunchAgents/com.noticingame.subtitle-server.plist"
        fi

    else
        print_error "Unsupported init system: $INIT_SYSTEM"
        return 1
    fi

    echo
    print_info "Service will be available at http://localhost:5000"

    return 0
}

remove_service() {
    echo "Removing $SERVICE_DISPLAY_NAME..."

    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        local user_mode=""
        local service_dir=""

        if [[ $EUID -eq 0 ]]; then
            service_dir="/etc/systemd/system"
            user_mode=""
        else
            service_dir="$HOME/.config/systemd/user"
            user_mode="--user"
        fi

        local service_file="$service_dir/${SERVICE_NAME}.service"

        # Stop and disable service
        systemctl $user_mode stop "$SERVICE_NAME" 2>/dev/null || true
        systemctl $user_mode disable "$SERVICE_NAME" 2>/dev/null || true

        # Remove service file
        if [ -f "$service_file" ]; then
            rm "$service_file"
            print_success "Service file removed: $service_file"
        fi

        # Reload systemd
        systemctl $user_mode daemon-reload

    elif [[ "$INIT_SYSTEM" == "launchd" ]]; then
        local plist_dir=""

        if [[ $EUID -eq 0 ]]; then
            plist_dir="/Library/LaunchDaemons"
        else
            plist_dir="$HOME/Library/LaunchAgents"
        fi

        local plist_file="$plist_dir/com.noticingame.subtitle-server.plist"

        # Unload service
        if [[ $EUID -eq 0 ]]; then
            launchctl unload "$plist_file" 2>/dev/null || true
        else
            launchctl unload "$plist_file" 2>/dev/null || true
        fi

        # Remove plist file
        if [ -f "$plist_file" ]; then
            rm "$plist_file"
            print_success "Plist file removed: $plist_file"
        fi

    else
        print_error "Unsupported init system: $INIT_SYSTEM"
        return 1
    fi

    print_success "Service removed successfully!"
    return 0
}

start_service() {
    echo "Starting $SERVICE_DISPLAY_NAME..."

    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        local user_mode=""
        if [[ $EUID -ne 0 ]]; then
            user_mode="--user"
        fi

        systemctl $user_mode start "$SERVICE_NAME"
        print_success "Service started successfully!"

    elif [[ "$INIT_SYSTEM" == "launchd" ]]; then
        local plist_file=""

        if [[ $EUID -eq 0 ]]; then
            plist_file="/Library/LaunchDaemons/com.noticingame.subtitle-server.plist"
        else
            plist_file="$HOME/Library/LaunchAgents/com.noticingame.subtitle-server.plist"
        fi

        launchctl load "$plist_file"
        print_success "Service started successfully!"

    else
        print_error "Unsupported init system: $INIT_SYSTEM"
        return 1
    fi

    echo "Server should be available at http://localhost:5000"
    return 0
}

stop_service() {
    echo "Stopping $SERVICE_DISPLAY_NAME..."

    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        local user_mode=""
        if [[ $EUID -ne 0 ]]; then
            user_mode="--user"
        fi

        systemctl $user_mode stop "$SERVICE_NAME"
        print_success "Service stopped successfully!"

    elif [[ "$INIT_SYSTEM" == "launchd" ]]; then
        local plist_file=""

        if [[ $EUID -eq 0 ]]; then
            plist_file="/Library/LaunchDaemons/com.noticingame.subtitle-server.plist"
        else
            plist_file="$HOME/Library/LaunchAgents/com.noticingame.subtitle-server.plist"
        fi

        launchctl unload "$plist_file"
        print_success "Service stopped successfully!"

    else
        print_error "Unsupported init system: $INIT_SYSTEM"
        return 1
    fi

    return 0
}

restart_service() {
    echo "Restarting $SERVICE_DISPLAY_NAME..."

    stop_service
    sleep 2
    start_service

    return 0
}

status_service() {
    echo "Checking $SERVICE_DISPLAY_NAME status..."

    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        local user_mode=""
        if [[ $EUID -ne 0 ]]; then
            user_mode="--user"
        fi

        if systemctl $user_mode is-active --quiet "$SERVICE_NAME"; then
            print_success "Service is running"
            echo "Server should be available at http://localhost:5000"
        else
            print_warning "Service is not running"
        fi

        echo
        echo "Detailed status:"
        systemctl $user_mode status "$SERVICE_NAME" --no-pager || true

    elif [[ "$INIT_SYSTEM" == "launchd" ]]; then
        if launchctl list | grep -q "com.noticingame.subtitle-server"; then
            print_success "Service is running"
            echo "Server should be available at http://localhost:5000"
        else
            print_warning "Service is not running"
        fi

    else
        print_error "Unsupported init system: $INIT_SYSTEM"
        return 1
    fi

    return 0
}

enable_service() {
    echo "Enabling $SERVICE_DISPLAY_NAME auto-start..."

    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        local user_mode=""
        if [[ $EUID -ne 0 ]]; then
            user_mode="--user"
        fi

        systemctl $user_mode enable "$SERVICE_NAME"
        print_success "Service enabled for auto-start!"

    elif [[ "$INIT_SYSTEM" == "launchd" ]]; then
        print_info "Launchd services are auto-enabled when loaded"
        print_success "Service is already configured for auto-start!"

    else
        print_error "Unsupported init system: $INIT_SYSTEM"
        return 1
    fi

    return 0
}

disable_service() {
    echo "Disabling $SERVICE_DISPLAY_NAME auto-start..."

    if [[ "$INIT_SYSTEM" == "systemd" ]]; then
        local user_mode=""
        if [[ $EUID -ne 0 ]]; then
            user_mode="--user"
        fi

        systemctl $user_mode disable "$SERVICE_NAME"
        print_success "Service disabled from auto-start!"

    elif [[ "$INIT_SYSTEM" == "launchd" ]]; then
        print_info "To disable launchd auto-start, unload the service:"
        if [[ $EUID -eq 0 ]]; then
            echo "  sudo launchctl unload /Library/LaunchDaemons/com.noticingame.subtitle-server.plist"
        else
            echo "  launchctl unload ~/Library/LaunchAgents/com.noticingame.subtitle-server.plist"
        fi

    else
        print_error "Unsupported init system: $INIT_SYSTEM"
        return 1
    fi

    return 0
}

show_help() {
    echo "USAGE:"
    echo "  $0 <command>"
    echo
    echo "COMMANDS:"
    echo "  install    Install the service"
    echo "  remove     Remove the service"
    echo "  start      Start the service"
    echo "  stop       Stop the service"
    echo "  restart    Restart the service"
    echo "  status     Show service status"
    echo "  enable     Enable auto-start on boot"
    echo "  disable    Disable auto-start on boot"
    echo "  help       Show this help"
    echo
    echo "EXAMPLES:"
    echo "  # Install and start the service"
    echo "  $0 install"
    echo "  $0 enable"
    echo "  $0 start"
    echo
    echo "  # Check if it's working"
    echo "  $0 status"
    echo
    echo "NOTES:"
    if [[ "$OS_TYPE" == "linux" ]]; then
        echo "  • For system-wide installation, run with sudo"
        echo "  • For user installation, run as regular user"
        echo "  • Service logs: journalctl -u $SERVICE_NAME (system) or"
        echo "    journalctl --user -u $SERVICE_NAME (user)"
    elif [[ "$OS_TYPE" == "macos" ]]; then
        echo "  • For system-wide installation, run with sudo"
        echo "  • For user installation, run as regular user"
        echo "  • Service logs: /tmp/noticing-game-subtitle-server.log"
    fi
    echo "  • Server will be available at http://localhost:5000"
    echo "  • The service will start automatically on boot (if enabled)"
}

main() {
    # Detect OS and init system
    detect_os

    print_banner

    if [[ "$OS_TYPE" == "unknown" || "$INIT_SYSTEM" == "unknown" ]]; then
        print_error "Unsupported operating system or init system"
        echo "This script supports:"
        echo "  • Linux with systemd"
        echo "  • macOS with launchd"
        exit 1
    fi

    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    command="$1"

    case "$command" in
        install)
            if ! check_dependencies; then
                exit 1
            fi
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
        enable)
            enable_service
            ;;
        disable)
            disable_service
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo "Use 'help' to see available commands"
            exit 1
            ;;
    esac
}

# Get the script directory for service configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/subtitle_server.py"

# Run main function
main "$@"
