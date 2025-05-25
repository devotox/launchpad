---
title: "Launchpad CLI"
description: "The essential developer onboarding tool for LoveHolidays - your starting point into the organization and beyond"
---

![Launchpad CLI Cover Image](mdc:img/company/cover.png)

# Launchpad CLI

Welcome to **Launchpad** - the comprehensive command-line interface designed to be every developer's starting point into the LoveHolidays organization and beyond.

## Overview

Launchpad CLI is the essential onboarding tool that streamlines the developer experience at LoveHolidays. Whether you're a new team member joining the organization or an existing developer exploring new projects, Launchpad provides you with the tools, resources, and guidance needed to get up and running quickly.

## What is Launchpad?

Launchpad is more than just a CLI tool - it's your gateway to the LoveHolidays developer ecosystem. It serves as:

- **Your First Step**: The initial tool every developer uses when joining LoveHolidays
- **Project Bootstrap**: Quick setup and initialization of new projects
- **Resource Hub**: Access to documentation, best practices, and organizational standards
- **Development Environment**: Streamlined setup of local development environments
- **Knowledge Base**: Centralized access to team knowledge and processes

## Key Features

### 🚀 Quick Onboarding
- Automated development environment setup
- Repository access and cloning
- Dependency management and installation with pnpm
- Configuration of essential tools and services
- Turbo repo workspace setup

### 📚 Knowledge Integration
- Access to organizational documentation
- Best practice guidelines
- Code standards and conventions
- Team contact information and escalation paths

### 🛠️ Project Management
- Project creation and scaffolding
- Template selection and customization
- Integration with existing LoveHolidays infrastructure
- Automated CI/CD setup
- Turbo repo integration for monorepo projects

### 🔧 Development Tools
- Environment configuration
- Service discovery and connection
- Testing framework setup
- Deployment pipeline integration

### Features

- **Process Management**: Track, monitor, and control running processes
- **Log Management**: Centralized logging with real-time viewing
- **Parallel/Sequential Execution**: Choose execution mode based on needs
- **Interactive Mode**: Select repositories when none specified
- **Environment Support**: Different commands for dev/prod environments
- **Error Handling**: Graceful error handling and recovery
- **Docker Compose Support**: Automatic detection and proper handling of containerized applications

### Docker Compose Support

Launchpad automatically detects Docker Compose applications and uses the appropriate commands:

- **Automatic Detection**: Looks for `docker-compose.yml`, `compose.yml`, and other common compose file names
- **NPM Script Detection**: Detects when npm scripts use Docker Compose commands (e.g., `"dev": "docker-compose up"`)
- **Smart Commands**: Uses `docker compose up` for dev/start, `docker compose stop` for graceful shutdown
- **Proper Cleanup**: The `down` command removes containers, networks, and optionally volumes
- **Container Logs**: Shows Docker container logs instead of process logs for compose applications

#### Docker Compose Commands

```bash
# Start Docker Compose services in development mode
launchpad app dev -r my-docker-app

# Stop Docker Compose services gracefully
launchpad app stop -r my-docker-app

# Stop and remove containers, networks (use for cleanup)
launchpad app down -r my-docker-app

# Stop and remove everything including volumes
launchpad app down -r my-docker-app --volumes

# View container logs
launchpad app logs -r my-docker-app --follow
```

#### NPM Scripts with Docker Compose

Launchpad also detects when your npm scripts use Docker Compose commands:

```json
{
  "scripts": {
    "dev": "docker-compose up --build",
    "start": "docker compose -f docker-compose.prod.yml up -d",
    "test": "docker-compose run --rm app npm test"
  }
}
```

When you run `launchpad app dev`, it will:
1. Execute the npm script as usual
2. Detect that it uses Docker Compose
3. Track the Docker services that are started
4. Use proper Docker Compose commands when stopping (instead of just killing the npm process)

## Getting Started

Every developer at LoveHolidays begins their journey with Launchpad. The tool is designed to be intuitive and self-guiding, ensuring that you can get productive quickly regardless of your experience level with our technology stack.

### Installation

```bash
# Installation using pnpm (our preferred package manager)
pnpm install -g @loveholidays/launchpad-cli
```

### First Steps

```bash
# Initialize your developer workspace
launchpad init

# Set up your development environment
launchpad setup all

# Explore available commands
launchpad help

# Set up your first project
launchpad create project

# Set up a new turbo repo workspace
launchpad create workspace
```

## Application Management

Launchpad includes a powerful application management system that allows you to run commands across multiple repositories with ease. This is perfect for managing microservices, monorepos, or any multi-repository development workflow.

### Quick Start with App Commands

```bash
# Start all repositories in development mode
launchpad app dev --all

# Start specific repositories
launchpad app dev -r aurora mmb

# Check status of running processes
launchpad app status

# View logs from a specific repository
launchpad app logs -r aurora --follow

# Stop all running processes
launchpad app stop --all
```

### Available App Commands

- **`launchpad app dev`** - Start development mode for repositories
- **`launchpad app start`** - Start development servers
- **`launchpad app build`** - Build repositories (supports dev/prod environments)
- **`launchpad app test`** - Run tests (supports watch mode)
- **`launchpad app lint`** - Run linting (supports auto-fix)
- **`launchpad app status`** - Show status of running processes
- **`launchpad app logs`** - View logs from running processes
- **`launchpad app stop`** - Stop running processes gracefully
- **`launchpad app down`** - Stop and remove Docker Compose containers (use `--volumes` to remove volumes)
- **`launchpad app kill`** - Force kill all processes

### Convenient Root Scripts

For quick access, use these root-level scripts:

```bash
pnpm app:dev      # Start all repos in dev mode
pnpm app:start    # Start all repos
pnpm app:build    # Build all repos
pnpm app:test     # Test all repos
pnpm app:status   # Show process status
pnpm app:stop     # Stop all processes
pnpm app:down     # Stop and remove Docker containers
pnpm app:kill     # Kill all processes
```

### Features

- **Process Management**: Track, monitor, and control running processes
- **Log Management**: Centralized logging with real-time viewing
- **Parallel/Sequential Execution**: Choose execution mode based on needs
- **Interactive Mode**: Select repositories when none specified
- **Environment Support**: Different commands for dev/prod environments
- **Error Handling**: Graceful error handling and recovery
- **Docker Compose Support**: Automatic detection and proper handling of containerized applications

For detailed documentation, see [APP_COMMANDS.md](./APP_COMMANDS.md).

## Development Environment Setup

Launchpad includes a comprehensive setup system that automates the installation and configuration of all the tools you need for LoveHolidays development. The setup commands handle everything from essential development tools to team-specific configurations.

### Quick Setup

```bash
# Interactive setup of all development tools
launchpad setup all

# Essential tools only (recommended for quick start)
launchpad setup all --essential-only

# Check what's already installed
launchpad setup status
```

### Individual Component Setup

Set up specific tools and services individually:

```bash
# Essential Development Tools
launchpad setup xcode          # Xcode Command Line Tools (macOS)
launchpad setup homebrew       # Homebrew package manager
launchpad setup node           # Node.js and NPM
launchpad setup github         # GitHub CLI and authentication

# Development Environment
launchpad setup docker         # Docker Desktop
launchpad setup kubernetes     # Kubernetes tools (kubectl, Lens)
launchpad setup gcloud         # Google Cloud SDK

# API Development
launchpad setup api-client     # Choose from Bruno, Postman, or Insomnia

# Terminal Enhancement
launchpad setup terminal       # Enhanced terminal options (iTerm2, Alacritty)

# LoveHolidays Specific
launchpad setup loveholidays   # NPM tokens, Google Workspace, VPN
```

### Setup Categories

The setup system organizes tools into categories:

- **Essential Tools**: Required for all LoveHolidays development
  - Xcode Command Line Tools, Homebrew, Node.js (via Volta/NVM/ASDF), Git, GitHub CLI, VPN, NPM tokens
- **Development Tools**: Core development environment
  - Docker, Kubernetes, Google Cloud SDK, Bruno, ngrok
- **Communication & Design**: Team collaboration tools
  - Figma, Slack
- **Optional Tools**: Additional productivity tools
  - Alternative API clients, enhanced terminals

### Platform Support

Setup commands automatically detect your platform and install appropriate tools:
- **macOS**: Full support for all tools including Homebrew, Xcode tools
- **Windows**: Support for cross-platform tools
- **Linux**: Support for cross-platform tools

### What Gets Set Up

The setup system handles:

1. **Package Managers**: Homebrew (macOS), appropriate managers for other platforms
2. **Development Runtime**: Node.js via version managers (Volta/NVM/ASDF), NPM, pnpm
3. **Version Control**: Git, GitHub CLI with authentication setup
4. **Containerization**: Docker Desktop with configuration
5. **Cloud Tools**: Google Cloud SDK, Kubernetes CLI and Lens
6. **API Development**: Choice of Bruno, Postman, or Insomnia
7. **LoveHolidays Access**: NPM tokens, Google Workspace verification, VPN setup
8. **Terminal Enhancement**: iTerm2, Alacritty, or other terminal options

### Dependency Management

The setup system automatically handles dependencies:
- Installs prerequisites before dependent tools
- Provides clear next steps after installation
- Offers guidance for manual configuration steps

### Example Workflow

```bash
# 1. Check current status
launchpad setup status

# 2. Set up essential tools first
launchpad setup all --essential-only

# 3. Add development tools as needed
launchpad setup docker
launchpad setup kubernetes

# 4. Set up team-specific access
launchpad setup loveholidays

# 5. Verify everything is working
launchpad setup status
```

## CLI Development

If you're working on the Launchpad CLI itself, we've set up convenient commands to develop from the root directory:

### Quick Development Commands (from root)

```bash
# Run CLI directly from source (TypeScript) - fastest for development
pnpm cli --help
pnpm cli init
pnpm cli create project

# Development with watch mode (auto-restarts on file changes)
pnpm dev:cli

# Build only the CLI package
pnpm cli:build

# Run the built CLI (after building)
pnpm cli:built --help
```

### Development Workflow

1. **Make changes** to CLI source files in `apps/cli/src/`

2. **Test immediately** without building:
   ```bash
   pnpm cli --help
   pnpm cli init
   ```

3. **For watch mode development** (auto-restart on changes):
   ```bash
   pnpm dev:cli
   # This runs in watch mode - make changes and see them immediately
   ```

4. **Build and test the production version**:
   ```bash
   pnpm cli:build
   pnpm cli:built --help
   ```

### Available Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm cli [args]` | Run CLI from TypeScript source (fastest) |
| `pnpm dev:cli` | Watch mode - auto-restart on file changes |
| `pnpm cli:build` | Build only the CLI package |
| `pnpm cli:built [args]` | Run the built CLI binary |
| `pnpm cli:dev` | Alternative watch mode using CLI's dev script |

## Local Development

If you're working on the Launchpad CLI itself or want to run it locally for development purposes, follow these steps:

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd launchpad
   pnpm install
   ```

2. **Build the CLI:**
   ```bash
   # Build all packages (including the CLI)
   pnpm run build

   # Or build just the CLI
   cd apps/cli
   pnpm run build
   ```

### Running Locally

You have several options to run the CLI locally:

#### Option 1: Direct Node Execution
```bash
# From the CLI directory
cd apps/cli
node dist/bin/launchpad.js --help

# Or using the npm script
pnpm run start --help
```

#### Option 2: Global Link (Recommended for Development)
```bash
# From the CLI directory
cd apps/cli
pnpm link --global

# Now you can use 'launchpad' globally
launchpad --help
launchpad init
```

#### Option 3: Using pnpm exec
```bash
# From the root directory
pnpm exec --filter @loveholidays/launchpad-cli launchpad --help
```

### Development Workflow

1. **Watch mode for development:**
   ```bash
   # From the CLI directory - rebuilds on file changes
   cd apps/cli
   pnpm run dev
   ```

2. **Testing your changes:**
   ```bash
   # If you've linked globally, just run:
   launchpad --help

   # Or rebuild and test:
   pnpm run build
   node dist/bin/launchpad.js --help
   ```

3. **Code quality checks:**
   ```bash
   # Run linting
   pnpm run lint:biome
   pnpm run lint:oxlint

   # Format code
   pnpm run format:biome:write

   # Run all checks and fix issues
   pnpm run check:write
   ```

### Updating Your Local Installation

When you make changes to the CLI:

1. **Rebuild the CLI:**
   ```bash
   cd apps/cli
   pnpm run build
   ```

2. **If you're using global link, it updates automatically** - no need to re-link!

3. **If you installed globally via npm/pnpm install:**
   ```bash
   # Unlink the old version
   pnpm unlink --global @loveholidays/launchpad-cli

   # Rebuild and link the new version
   pnpm run build
   pnpm link --global
   ```

### Troubleshooting

- **Command not found after linking:** Make sure your global pnpm bin directory is in your PATH
- **Changes not reflected:** Ensure you've run `pnpm run build` after making changes
- **Permission errors:** You might need to use `sudo` for global operations on some systems

### Binary Configuration

The CLI is configured with the following binary setup in `apps/cli/package.json`:

```json
{
  "bin": {
    "launchpad": "dist/bin/launchpad.js"
  }
}
```

This means when installed globally, the `launchpad` command will execute the compiled JavaScript file at `dist/bin/launchpad.js`.

## Why Launchpad?

At LoveHolidays, we believe that great developer experiences lead to great products. Launchpad embodies this philosophy by:

- **Reducing Time to Productivity**: Get new developers contributing to projects faster
- **Ensuring Consistency**: Standardized setup processes across all teams using pnpm and Turbo
- **Sharing Knowledge**: Centralized access to tribal knowledge and best practices
- **Supporting Growth**: Resources for both new developers and experienced team members exploring new areas

## Vision

Launchpad represents our commitment to developer experience excellence. As the organization grows and evolves, Launchpad grows with it, continuously incorporating new tools, processes, and knowledge to ensure every developer has what they need to succeed.

---

*Last updated: December 19, 2024*
