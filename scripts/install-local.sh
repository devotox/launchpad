#!/bin/bash

# Launchpad CLI Local Installation/Uninstallation Script
# This script builds the CLI and installs it globally for development, or uninstalls it

set -e  # Exit on any error

# Function to show usage
show_usage() {
    echo "Usage: $0 [install|uninstall]"
    echo ""
    echo "Commands:"
    echo "  install    Build and install Launchpad CLI globally (default)"
    echo "  uninstall  Uninstall Launchpad CLI from global packages"
    echo ""
    echo "Examples:"
    echo "  $0           # Install (default action)"
    echo "  $0 install   # Install explicitly"
    echo "  $0 uninstall # Uninstall"
}

# Function to install
install_cli() {
    echo "🚀 Installing Launchpad CLI locally..."

    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -d "apps/cli" ]; then
        echo "❌ Error: This script must be run from the root of the launchpad repository"
        exit 1
    fi

    # Build the CLI
    echo "📦 Building CLI..."
    pnpm run cli:build

    # Link it globally
    echo "🔗 Linking CLI globally..."
    cd apps/cli
    pnpm link --global

    echo ""
    echo "✅ Launchpad CLI has been installed globally!"
    echo ""
    echo "You can now use the 'launchpad' command anywhere:"
    echo "  launchpad --help"
    echo "  launchpad init"
    echo "  launchpad setup all"
    echo ""
    echo "To uninstall later, run:"
    echo "  ./scripts/install-local.sh uninstall"
    echo "  # or manually: pnpm remove --global @loveholidays/launchpad-cli"
    echo ""
}

# Function to uninstall
uninstall_cli() {
    echo "🗑️  Uninstalling Launchpad CLI..."

    # Check if the launchpad command exists
    if command -v launchpad >/dev/null 2>&1; then
        echo "📦 Found globally installed Launchpad CLI, removing..."

        # Remove the package from global installation
        pnpm remove --global @loveholidays/launchpad-cli 2>/dev/null || true

        # Double-check if it's still there after removal
        if command -v launchpad >/dev/null 2>&1; then
            echo "⚠️  Warning: 'launchpad' command still available after removal."
            echo "   This might be because it was installed differently."
            echo "   You may need to manually remove it or use a different method."
        else
            echo ""
            echo "✅ Launchpad CLI has been uninstalled successfully!"
            echo ""
            echo "The 'launchpad' command is no longer available globally."
        fi

        echo ""
        echo "To reinstall, run:"
        echo "  ./scripts/install-local.sh install"
        echo ""
    else
        echo "ℹ️  Launchpad CLI is not currently installed globally."
        echo ""
        echo "Nothing to uninstall. If you want to install it, run:"
        echo "  ./scripts/install-local.sh install"
        echo ""
    fi
}

# Parse command line arguments
ACTION="${1:-install}"

case "$ACTION" in
    "install")
        install_cli
        ;;
    "uninstall")
        uninstall_cli
        ;;
    "help"|"--help"|"-h")
        show_usage
        ;;
    *)
        echo "❌ Error: Unknown command '$ACTION'"
        echo ""
        show_usage
        exit 1
        ;;
esac
