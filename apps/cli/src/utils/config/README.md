# Configuration System

The Launchpad CLI uses a modular configuration system that follows platform conventions and best practices.

## Architecture

The configuration system is organized into several modules:

- **`types.ts`** - TypeScript interfaces and type definitions
- **`paths.ts`** - Cross-platform path resolution following XDG Base Directory specification
- **`defaults.ts`** - Default configuration creation, validation, and migration
- **`manager.ts`** - Main ConfigManager class that orchestrates all config operations
- **`data-manager.ts`** - DataManager class for handling JSON data files
- **`index.ts`** - Public API exports

## Configuration Directory

The system automatically chooses the appropriate configuration directory based on the platform:

### Unix-like systems (macOS, Linux)
- **XDG compliant** (default): `~/.config/launchpad/`
- **Traditional dotfile**: `~/.launchpad/` (fallback)

### Windows
- **Default**: `%USERPROFILE%\.launchpad\`

### Environment Variables
- `XDG_CONFIG_HOME` - Override config directory on Unix systems
- `XDG_DATA_HOME` - Override data directory on Unix systems

## Directory Structure

```
~/.config/launchpad/          # Config directory
├── config.json               # Main configuration file
├── teams.json                # Team definitions
├── setup-components.json     # Setup components
├── global-docs.json          # Global onboarding docs
├── logs/                     # Application logs
│   ├── repo1-dev-*.log
│   └── repo2-build-*.log
└── cache/                    # Cache directory
    └── ...
```

## Usage

### Basic Usage

```typescript
import { ConfigManager } from '@/utils/config';

const configManager = ConfigManager.getInstance();

// Check if config exists
const hasConfig = await configManager.hasConfig();

// Load configuration
const config = await configManager.getConfig();

// Create default config
const newConfig = await configManager.createDefaultConfig({
  name: "John Doe",
  email: "john.doe@loveholidays.com",
  team: "mmb"
});

// Update configuration
await configManager.updateConfig({
  workspace: {
    path: "/custom/workspace/path",
    repositories: ["repo1", "repo2"]
  }
});
```

### Data Management

```typescript
import { DataManager } from '@/utils/config';

const dataManager = DataManager.getInstance();

// Get teams
const teams = await dataManager.getTeams();
const team = await dataManager.getTeamById("mmb");

// Get setup components
const components = await dataManager.getSetupComponents();
const macComponents = await dataManager.getSetupComponentsByPlatform("macos");

// Get onboarding docs
const globalDocs = await dataManager.getGlobalOnboardingDocs();
const allDocs = await dataManager.getAllOnboardingDocs("mmb");
```

### Custom Configuration Directory

```typescript
import { ConfigManager } from '@/utils/config';

// Use custom config directory
const configManager = ConfigManager.getInstance({
  customConfigDir: "/custom/config/path"
});

// Disable XDG compliance (use traditional dotfiles)
const configManager = ConfigManager.getInstance({
  useXDGConfig: false
});
```

### Path Utilities

```typescript
import { getConfigDirectory, getConfigPaths, getDataDirectory } from '@/utils/config';

// Get config directory
const configDir = getConfigDirectory();
console.log(configDir); // ~/.config/launchpad

// Get all paths
const paths = getConfigPaths();
console.log(paths.configFile); // ~/.config/launchpad/config.json
console.log(paths.logsDir);    // ~/.config/launchpad/logs
console.log(paths.cacheDir);   // ~/.config/launchpad/cache

// Get data directory (for logs, cache)
const dataDir = getDataDirectory();
console.log(dataDir); // ~/.local/share/launchpad (XDG) or ~/.config/launchpad (fallback)
```

### Configuration Validation and Migration

```typescript
import { validateConfig, migrateConfig } from '@/utils/config';

// Validate configuration
const isValid = validateConfig(someConfig);

// Migrate old configuration
const migratedConfig = migrateConfig(oldConfig);
```

## Configuration Schema

```typescript
interface LaunchpadConfig {
  user: {
    name: string;
    email: string;
    team: string;
  };
  workspace: {
    path: string;
    repositories: string[];
  };
  preferences: {
    defaultEditor?: string;
    autoClone: boolean;
    setupDependencies: boolean;
    preferredEditor: string;
    preferredTerminal: string;
    preferredSlackChannel: string;
    gitBranchPrefix?: string;
    customWorkflows: Record<string, unknown>;
  };
  teamSettings?: {
    slackNotifications: boolean;
    preferredSlackChannel: string;
    gitBranchPrefix?: string;
    customWorkflows: Record<string, unknown>;
  };
  lastUpdated: string;
}
```

## Data Files

The system stores data in separate JSON files for easy management:

### teams.json
Contains team definitions with repositories, Slack channels, and configuration.

### setup-components.json
Contains setup components for different platforms and categories.

### global-docs.json
Contains global onboarding documentation links.

## Features

### Cross-Platform Support
- Automatically detects platform and uses appropriate conventions
- Supports XDG Base Directory specification on Unix systems
- Graceful fallback to traditional dotfile approach

### Validation and Migration
- Automatic configuration validation on load
- Built-in migration system for config schema changes
- Type-safe configuration handling

### Singleton Pattern
- Single instance ensures consistent configuration access
- Lazy loading of configuration data
- Automatic directory creation

### JSON Data Management
- Separate JSON files for different data types
- Automatic file creation with default data
- Easy external editing for admin tools

### Integration with App Components
- Centralized logs directory management
- Cache directory for temporary files
- Team-specific configuration helpers

## Best Practices

1. **Always use ConfigManager.getInstance()** - Don't create new instances
2. **Use DataManager for team/setup data** - Don't hardcode static data
3. **Check for config existence** before assuming it's available
4. **Use type-safe methods** for accessing team-specific data
5. **Handle errors gracefully** when config operations fail
6. **Use the provided path utilities** instead of hardcoding paths

## Migration Guide

If you're updating from the old config system:

```typescript
// Old way
import { ConfigManager } from '@/utils/config';
const configManager = ConfigManager.getInstance();

// New way (same API, but now modular with JSON data files)
import { ConfigManager, DataManager } from '@/utils/config';
const configManager = ConfigManager.getInstance();
const dataManager = DataManager.getInstance();

// Additional utilities now available
import { getConfigDirectory, validateConfig } from '@/utils/config';
```

The API remains the same, but the system is now more robust and follows platform conventions.
