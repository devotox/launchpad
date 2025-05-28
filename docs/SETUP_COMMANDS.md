# Launchpad Setup Commands

This document provides a comprehensive overview of the Launchpad CLI setup system, which automates the installation and configuration of development tools for LoveHolidays.

## Overview

The setup system is designed to handle all the tools and services mentioned in the MMB onboarding documentation, providing both interactive full setup and granular individual component setup.

## Quick Reference

### Main Commands

```bash
launchpad setup all                    # Interactive setup of all tools
launchpad setup essential              # Only essential tools (choice-based)
launchpad setup status                 # Check installation status
```

### Individual Components

#### Essential Development Tools
```bash
launchpad setup xcode          # Xcode Command Line Tools (macOS only)
launchpad setup homebrew       # Homebrew package manager (macOS)
launchpad setup node           # Node.js and NPM
launchpad setup pnpm           # PNPM package manager
launchpad setup git            # Git version control
launchpad setup github         # GitHub CLI and authentication
launchpad setup npm-token      # NPM token for LoveHolidays packages
launchpad setup google-workspace # Google Workspace access verification
launchpad setup vpn            # OpenVPN setup
```

#### Development Environment
```bash
launchpad setup docker         # Docker Desktop
launchpad setup kubernetes     # Kubernetes CLI (kubectl) and Lens
launchpad setup gcloud         # Google Cloud SDK
launchpad setup bruno          # Bruno API client
launchpad setup ngrok          # ngrok tunneling service
```

#### Communication & Design
```bash
launchpad setup figma          # Figma design tool
launchpad setup slack          # Slack communication
```

#### Optional Tools
```bash
launchpad setup postman        # Postman API client
launchpad setup insomnia       # Insomnia API client
launchpad setup iterm2         # iTerm2 terminal (macOS only)
launchpad setup alacritty      # Alacritty terminal
```

### Grouped Setup Commands

```bash
launchpad setup kubernetes     # Sets up kubectl + Lens
launchpad setup github         # Sets up GitHub CLI + authentication
launchpad setup api-client     # Interactive choice of API client
launchpad setup terminal       # Interactive choice of terminal
launchpad setup loveholidays   # All LoveHolidays-specific tools
```

**Note**: The setup system now includes **real implementations** for most components. Setup components are stored in `~/.config/launchpad/setup-components.json`. The essential setup uses choice-based logic to handle alternatives like Node.js version managers intelligently.

## Component Categories

### Essential Tools
Required for all LoveHolidays development:
- Xcode Command Line Tools (macOS)
- Homebrew (macOS)
- Node.js & NPM (via Volta, NVM, or ASDF - not brew!)
- PNPM (via npm or volta)
- Git
- GitHub CLI & Authentication
- OpenVPN
- NPM Token Setup
- Google Workspace Access

### Development Tools
Core development environment:
- Docker Desktop
- Kubernetes CLI (kubectl)
- Lens (Kubernetes IDE)
- Google Cloud SDK
- Bruno (API client)
- ngrok

### Communication & Design
Team collaboration tools:
- Figma
- Slack

### Optional Tools
Additional productivity tools:
- Postman (alternative API client)
- Insomnia (alternative API client)
- iTerm2 (enhanced terminal for macOS)
- Alacritty (GPU-accelerated terminal)

## Platform Support

The setup system automatically detects your platform and installs appropriate tools:

- **macOS**: Full support including Homebrew, Xcode tools, iTerm2
- **Windows**: Cross-platform tools only
- **Linux**: Cross-platform tools only

## Features

### Dependency Management
- Automatically installs prerequisites before dependent tools
- Example: Installing GitHub CLI before GitHub Authentication
- Example: Installing Node.js before PNPM

### Interactive Setup
- Prompts for each component during full setup
- Essential tools are pre-selected by default
- Optional tools require explicit confirmation

### Status Checking
- Mock installation status checking (ready for real implementation)
- Categorized status display
- Clear indicators of what's installed vs. missing

### Next Steps Guidance
- Component-specific next steps after installation
- Links to relevant documentation
- Manual configuration guidance where needed

### Type-Safe Pattern Matching
- Uses `ts-pattern` for robust pattern matching instead of switch statements
- Provides better type safety and exhaustive checking
- Makes the code more maintainable and less error-prone

## Current Implementation Status

The setup system now includes **real implementations** for most components:

### What Works
- ✅ All command parsing and routing
- ✅ Platform detection (`macos`, `linux`, `windows`)
- ✅ Component categorization and filtering
- ✅ Interactive prompts and user experience
- ✅ JSON-based component storage system
- ✅ Grouped commands (kubernetes, github, api-client, terminal, loveholidays)
- ✅ **Real installation implementations** for most components
- ✅ **Choice-based essential setup** with smart handling of alternatives
- ✅ **Proper detection logic** for installed components

### Real Implementations
Most setup commands now have **real implementations** that:
- Actually install the tools using platform-appropriate package managers
- Detect existing installations correctly
- Handle Node.js version managers intelligently (Volta, NVM, ASDF)
- Provide real installation commands and post-install guidance
- Support cross-platform installation where possible

### Choice-Based Essential Setup
The `launchpad setup essential` command uses intelligent choice-based logic:
- Groups mutually exclusive tools (like Node.js version managers)
- Skips choices when something is already installed
- Only prompts for what's actually needed
- Provides clear feedback about existing installations

### LoveHolidays Grouped Setup
The `launchpad setup loveholidays` command installs these components:
- `npm-token` - NPM authentication for LoveHolidays packages
- `vpn-access` - OpenVPN client configuration  
- `google-workspace` - Google Workspace access verification
- `kubernetes-access` - Kubernetes cluster access setup

### Production Ready

The architecture now includes real implementations:
- `checkComponentInstalled()` - Real detection logic for most components
- `installComponent()` - Real installation commands using platform package managers
- Component data is stored in JSON files and loaded dynamically
- Platform detection works correctly (`macos`, `linux`, `windows`)
- Type-safe interfaces ensure component structure consistency
- Choice-based logic handles alternatives intelligently

### Component IDs Used in Code

The actual component IDs referenced in the implementation:
- `xcode-cli-tools`, `homebrew`, `node-nvm`, `pnpm`, `git`
- `docker-desktop`, `kubernetes-lens`, `google-cloud-sdk`
- `github-cli`, `github-access`, `npm-token`, `google-workspace`, `vpn-access`
- `bruno`, `postman`, `insomnia`, `figma`, `slack`
- `iterm2`, `alacritty`, `ngrok`, `kubernetes-access`

## Example Workflows

### New Developer Onboarding
```bash
# 1. Initialize workspace
launchpad init

# 2. Check current status
launchpad setup status

# 3. Set up essential tools
launchpad setup essential

# 4. Add development tools as needed
launchpad setup docker
launchpad setup kubernetes

# 5. Set up LoveHolidays-specific access
launchpad setup loveholidays

# 6. Verify everything is working
launchpad setup status
```

### Specific Tool Setup
```bash
# Just need Docker for a project
launchpad setup docker

# Need Kubernetes tools
launchpad setup kubernetes  # Installs kubectl + Lens

# Need API development tools
launchpad setup api-client  # Choose Bruno, Postman, or Insomnia
```

### Platform-Specific Setup
```bash
# macOS developer
launchpad setup xcode       # Xcode Command Line Tools
launchpad setup homebrew    # Package manager
launchpad setup iterm2      # Enhanced terminal

# Cross-platform developer
launchpad setup node        # Node.js runtime
launchpad setup docker      # Containerization
launchpad setup alacritty   # GPU-accelerated terminal
```

## Integration with MMB Docs

The setup commands directly correspond to tools mentioned in the MMB onboarding documentation:

- **Section 5.1**: `launchpad setup xcode`
- **Section 5.2**: `launchpad setup homebrew`, `launchpad setup node`, `launchpad setup pnpm`
- **Section 5.3**: `launchpad setup docker`, `launchpad setup figma`, `launchpad setup terminal`, `launchpad setup api-client`
- **GitHub Setup**: `launchpad setup github`
- **Kubernetes**: `launchpad setup kubernetes`
- **NPM**: `launchpad setup npm-token`
- **VPN**: `launchpad setup vpn`

## Future Enhancements

The setup system is designed to be extensible:

1. **Real Installation Logic**: Replace mocks with actual installation commands
2. **Configuration Management**: Store and sync tool configurations
3. **Team-Specific Tools**: Add team-specific tool requirements
4. **Version Management**: Handle specific tool versions
5. **Health Checks**: Verify tool functionality after installation
6. **Backup/Restore**: Save and restore development environment configurations

---

*This setup system provides a foundation for comprehensive development environment management at LoveHolidays, with room for growth and real implementation.*
