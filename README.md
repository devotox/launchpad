---
title: "Launchpad CLI"
description: "The essential developer onboarding tool for LoveHolidays - your starting point into the organization and beyond"
---

![Launchpad CLI Cover Image](mdc:img/company/cover.png)

# Launchpad CLI

Welcome to **Launchpad** - the comprehensive command-line interface designed to be every developer's starting point into the LoveHolidays organization and beyond.

## What is Launchpad?

Launchpad CLI is the essential onboarding tool that streamlines the developer experience at LoveHolidays. Whether you're a new team member joining the organization or an existing developer exploring new projects, Launchpad provides you with the tools, resources, and guidance needed to get up and running quickly.

Launchpad is more than just a CLI tool - it's your gateway to the LoveHolidays developer ecosystem. It serves as:

- **Your First Step**: The initial tool every developer uses when joining LoveHolidays
- **Project Bootstrap**: Quick setup and initialization of new projects
- **Resource Hub**: Access to documentation, best practices, and organizational standards
- **Development Environment**: Streamlined setup of local development environments
- **Knowledge Base**: Centralized access to team knowledge and processes

## Why Choose Launchpad?

At LoveHolidays, we believe that great developer experiences lead to great products. Launchpad embodies this philosophy by:

- **Reducing Time to Productivity**: Get new developers contributing to projects faster
- **Ensuring Consistency**: Standardized setup processes across all teams using pnpm and Turbo
- **Sharing Knowledge**: Centralized access to tribal knowledge and best practices
- **Supporting Growth**: Resources for both new developers and experienced team members exploring new areas

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

## Installation

### For Local Development (Current)
```bash
# Clone the repository and install locally
git clone <repository-url>
cd launchpad
pnpm install
pnpm run install:local
```

This will build the CLI and install it globally so you can use the `launchpad` command anywhere.

### For Published Package (Future)
```bash
# Installation using pnpm (our preferred package manager)
pnpm install -g @loveholidays/launchpad-cli
```

## Quick Start

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

For detailed documentation, see [APP_COMMANDS.md](./docs/APP_COMMANDS.md).

## Development Environment Setup

Launchpad automates the installation of all development tools you need for LoveHolidays.

```bash
# Set up everything you need
launchpad setup all

# Essential tools only (recommended for quick start)
launchpad setup all --essential-only

# Check what's installed
launchpad setup status
```

For the complete setup command reference, see [SETUP_COMMANDS.md](./docs/SETUP_COMMANDS.md).

## CLI Development

For contributors working on the CLI itself:

```bash
# Run directly from source (fastest for development)
pnpm cli --help
pnpm cli init

# Watch mode - auto-restart on changes
pnpm dev:cli

# Build and test production version
pnpm cli:build
pnpm cli:built --help
```

## Local Development

### Installing for Development

```bash
# Clone, build, and install globally
git clone <repository-url>
cd launchpad
pnpm install
pnpm run install:local
```

Now you can use `launchpad` anywhere on your system.

### Quick Development

For rapid iteration while developing the CLI:

```bash
# Run directly from source (no build needed)
pnpm cli --help
pnpm cli init

# Or watch mode (auto-restart on changes)
pnpm dev:cli
```

### Uninstalling

```bash
pnpm run uninstall:local
```

## Vision

Launchpad represents our commitment to developer experience excellence. As the organization grows and evolves, Launchpad grows with it, continuously incorporating new tools, processes, and knowledge to ensure every developer has what they need to succeed.

---
