# Launchpad App Commands

This document provides comprehensive documentation for the Launchpad CLI application management system, which allows you to run commands across multiple repositories with ease.

## Overview

The app command system is designed to handle multi-repository development workflows, supporting both traditional npm-based applications and Docker Compose containerized applications. It automatically detects the type of application and uses the appropriate commands.

## Implementation Status

The app command system is **fully implemented and functional**:

### ✅ What Works
- All command parsing and routing
- Repository selection (interactive, specific, or all)
- Docker Compose detection and handling
- NPM script execution
- Process management and tracking
- Log management and viewing
- Parallel and sequential execution
- Environment-specific commands (dev, prod)
- Graceful shutdown and cleanup

### 🔧 Current Features
- **Process Tracking**: All running processes are tracked with PIDs
- **Log Management**: Logs are stored in `workspace/.launchpad/logs/`
- **Docker Integration**: Automatic detection and appropriate command mapping
- **Interactive Mode**: When no repos specified, prompts for selection
- **Error Handling**: Graceful error handling with continuation options

## Quick Reference

### Basic Commands

```bash
launchpad app dev --all              # Start all repos in development mode
launchpad app start -r aurora mmb    # Start specific repositories
launchpad app build --env prod       # Build for production
launchpad app test --watch           # Run tests in watch mode
launchpad app lint --fix             # Run linting with auto-fix
launchpad app run typecheck --all    # Run custom commands
launchpad app list --detailed        # List available repositories
launchpad app status                 # Show running process status
launchpad app logs -r aurora --follow # Follow logs for a repository
launchpad app stop --all             # Stop all running processes
launchpad app down --all --volumes   # Stop and remove Docker containers
launchpad app kill --force           # Force kill all processes
```

## Command Reference

### `launchpad app dev`

Start development mode for repositories. This is typically the most commonly used command for daily development.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to run in dev mode
- `-a, --all` - Run all repositories in dev mode
- `-p, --parallel` - Run in parallel (default: true)

**Examples:**
```bash
launchpad app dev --all                    # Start all repos
launchpad app dev -r aurora mmb            # Start specific repos
launchpad app dev -r frontend --parallel   # Explicitly run in parallel
```

**Behavior:**
- **NPM projects**: Runs `npm run dev`
- **Docker Compose**: Runs `docker compose up --build`

**Note**: The system automatically detects Docker Compose projects by looking for compose files (`docker-compose.yml`, `compose.yml`, etc.) and uses appropriate Docker commands.

### `launchpad app start`

Start development servers for repositories. Similar to `dev` but may use different scripts.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to start
- `-a, --all` - Start all repositories
- `-p, --parallel` - Start in parallel (default: true)

**Examples:**
```bash
launchpad app start --all              # Start all repos
launchpad app start -r backend         # Start specific repo
```

**Behavior:**
- **NPM projects**: Runs `npm run dev` (dev env) or `npm start` (prod env)
- **Docker Compose**: Runs `docker compose up --build` (dev) or `docker compose up -d` (prod)

### `launchpad app build`

Build repositories for deployment or testing.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to build
- `-a, --all` - Build all repositories
- `-e, --env <environment>` - Build environment: dev, prod (default: prod)
- `-p, --parallel` - Build in parallel (default: true)

**Examples:**
```bash
launchpad app build --all --env prod      # Production build for all
launchpad app build -r frontend --env dev # Development build for one repo
```

**Behavior:**
- **NPM projects**: Runs `npm run build:dev` or `npm run build`
- **Docker Compose**: Runs `docker compose build`

### `launchpad app test`

Run tests for repositories.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to test
- `-a, --all` - Test all repositories
- `-w, --watch` - Watch mode for tests (default: false)
- `-p, --parallel` - Run tests in parallel (default: false)

**Examples:**
```bash
launchpad app test --all                  # Run all tests once
launchpad app test -r backend --watch     # Run tests in watch mode
```

**Behavior:**
- **NPM projects**: Runs `npm test` with optional `--watch` flag
- **Docker Compose**: Runs `docker compose run --rm app npm test`

### `launchpad app lint`

Run linting for repositories.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to lint
- `-a, --all` - Lint all repositories
- `--fix` - Auto-fix linting issues (default: false)
- `-p, --parallel` - Run linting in parallel (default: true)

**Examples:**
```bash
launchpad app lint --all --fix           # Lint and fix all repos
launchpad app lint -r frontend           # Lint specific repo
```

**Behavior:**
- **NPM projects**: Runs `npm run lint` with optional `--fix` flag
- **Docker Compose**: Runs `docker compose run --rm app npm run lint`

### `launchpad app status`

Show status of all running processes.

**Examples:**
```bash
launchpad app status                      # Show all running processes
```

**Output includes:**
- Repository name
- Command being run
- Process ID (PID)
- Uptime
- Docker Compose file (if applicable)
- Log file location

### `launchpad app logs`

View logs from running processes.

**Options:**
- `-r, --repo <repo>` - Show logs for specific repository
- `-f, --follow` - Follow logs in real-time (default: false)

**Examples:**
```bash
launchpad app logs -r aurora             # Show recent logs
launchpad app logs -r aurora --follow    # Follow logs in real-time
launchpad app logs                       # Interactive selection
```

**Behavior:**
- **NPM projects**: Shows logs from log files
- **Docker Compose**: Shows container logs using `docker compose logs`

### `launchpad app stop`

Stop running processes gracefully.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to stop
- `-a, --all` - Stop all running processes

**Examples:**
```bash
launchpad app stop --all                 # Stop all processes
launchpad app stop -r aurora mmb         # Stop specific repos
launchpad app stop                       # Interactive selection
```

**Behavior:**
- **NPM projects**: Sends SIGTERM signal, then SIGKILL if needed
- **Docker Compose**: Runs `docker compose stop`

### `launchpad app down`

Stop and remove Docker Compose containers, networks, and optionally volumes. This command is specifically for Docker Compose applications.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to run down on
- `-a, --all` - Run down on all repositories
- `--volumes` - Remove volumes as well (default: false)

**Examples:**
```bash
launchpad app down --all                 # Stop and remove containers
launchpad app down -r backend --volumes  # Remove containers and volumes
```

**Behavior:**
- **NPM projects**: No effect (use `stop` instead)
- **Docker Compose**: Runs `docker compose down` with optional `--volumes --remove-orphans`

### `launchpad app kill`

Force kill all running processes.

**Options:**
- `--force` - Force kill processes (default: false)

**Examples:**
```bash
launchpad app kill                       # Kill all processes
launchpad app kill --force               # Force kill (more aggressive)
```

**Behavior:**
- **NPM projects**: Sends SIGKILL signal
- **Docker Compose**: Runs `docker compose down` with optional cleanup flags

### `launchpad app run <command>`

Run any custom command across repositories.

**Options:**
- `-r, --repos <repos...>` - Specific repositories to run command on
- `-a, --all` - Run on all repositories
- `-e, --env <environment>` - Environment (dev, prod, test) (default: dev)
- `-p, --parallel` - Run commands in parallel (default: false)
- `-w, --watch` - Watch mode if supported by command (default: false)

**Examples:**
```bash
launchpad app run typecheck --all        # Run type checking
launchpad app run clean -r frontend      # Clean specific repo
launchpad app run custom-script --all    # Run custom npm script
```

### `launchpad app list`

List all available repositories in the workspace.

**Options:**
- `--detailed` - Show detailed repository information (default: false)

**Examples:**
```bash
launchpad app list                       # List all repositories
launchpad app list --detailed            # Show detailed information
```

**Output includes:**
- Repository names
- Repository paths (with --detailed)
- Available npm scripts (with --detailed)
- Docker Compose detection (with --detailed)

## Docker Compose Support

Launchpad automatically detects Docker Compose applications and handles them appropriately.

### Detection

Launchpad automatically detects Docker Compose projects by looking for compose files in the repository directory. The detection logic is implemented in the `AppRunner` class and checks for the presence of standard Docker Compose file names.

**Common compose file names detected:**
- `docker-compose.yml`
- `docker-compose.yaml`
- `compose.yml`
- `compose.yaml`
- `docker-compose.dev.yml`
- `docker-compose.development.yml`

### Command Mapping

| Launchpad Command | NPM Command | Docker Compose Command |
|-------------------|-------------|------------------------|
| `dev` | `npm run dev` | `docker compose up --build` |
| `start` (dev) | `npm run dev` | `docker compose up --build` |
| `start` (prod) | `npm start` | `docker compose up -d` |
| `build` | `npm run build` | `docker compose build` |
| `test` | `npm test` | `docker compose run --rm app npm test` |
| `lint` | `npm run lint` | `docker compose run --rm app npm run lint` |
| `stop` | SIGTERM/SIGKILL | `docker compose stop` |
| `down` | N/A | `docker compose down` |
| `logs` | File logs | `docker compose logs` |

### Docker Compose Best Practices

1. **Use `stop` for graceful shutdown** - Stops containers but keeps them for restart
2. **Use `down` for cleanup** - Removes containers and networks
3. **Use `down --volumes` for complete cleanup** - Also removes volumes
4. **Use `logs --follow` for real-time monitoring** - Shows live container output

## Process Management

### Process Tracking

Launchpad tracks all running processes and provides:
- Process ID (PID) tracking
- Uptime monitoring
- Log file management
- Docker Compose file detection
- Graceful shutdown handling

### Log Management

- **NPM projects**: Logs stored in `workspace/.launchpad/logs/`
- **Docker Compose**: Uses native Docker logging
- **Real-time viewing**: Use `--follow` flag for live logs
- **Historical logs**: View recent output without `--follow`

### Error Handling

- Graceful error handling for failed commands
- Continuation options for sequential execution
- Clear error messages with context
- Automatic cleanup on process termination

## Interactive Mode

When no repositories are specified with `-r` or `--all`, Launchpad enters interactive mode:

1. **Repository Selection**: Choose from available repositories using checkboxes
2. **Process Selection**: For stop/logs commands, select from running processes
3. **Validation**: Ensures at least one selection is made
4. **Clear Feedback**: Shows selected options before execution

## Examples and Workflows

### Daily Development Workflow

```bash
# Start your development environment
launchpad app dev --all

# Check what's running
launchpad app status

# View logs from a specific service
launchpad app logs -r backend --follow

# Stop everything at end of day
launchpad app stop --all
```

### Docker Compose Workflow

```bash
# Start containerized services
launchpad app dev -r docker-backend

# Check container status
launchpad app status

# View container logs
launchpad app logs -r docker-backend --follow

# Clean shutdown and cleanup
launchpad app down -r docker-backend --volumes
```

### Testing Workflow

```bash
# Run tests once
launchpad app test --all

# Run tests in watch mode for active development
launchpad app test -r frontend --watch

# Lint and fix issues
launchpad app lint --all --fix
```

### Build and Deploy Workflow

```bash
# Build for production
launchpad app build --all --env prod

# Test the production build
launchpad app test --all

# Clean up development processes
launchpad app stop --all
```

## Troubleshooting

### Common Issues

1. **Repository not found**: Ensure the repository exists in your workspace
2. **Docker Compose not detected**: Check that compose file exists and is named correctly
3. **Processes not stopping**: Use `kill --force` for stubborn processes
4. **Permission errors**: Ensure Docker is running and accessible

### Debug Information

Use `launchpad app status` to see:
- Which processes are running
- Process IDs for manual intervention
- Log file locations for debugging
- Docker Compose file paths

### Manual Cleanup

If automatic cleanup fails:

```bash
# For NPM processes
ps aux | grep node
kill -9 <PID>

# For Docker Compose
docker compose -f docker-compose.yml down --remove-orphans --volumes
```

## Integration with Root Scripts

For convenience, these root-level scripts are available:

```bash
pnpm app:dev      # launchpad app dev --all
pnpm app:start    # launchpad app start --all
pnpm app:build    # launchpad app build --all
pnpm app:test     # launchpad app test --all
pnpm app:status   # launchpad app status
pnpm app:stop     # launchpad app stop --all
pnpm app:down     # launchpad app down --all
pnpm app:kill     # launchpad app kill
```

These provide quick access to common operations without typing the full command.
