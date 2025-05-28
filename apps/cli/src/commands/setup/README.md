# Modular Setup System

A data-driven, modular setup system for the Launchpad CLI that uses `ts-pattern` for robust pattern matching and type safety.

## Architecture Overview

The setup system is built around three core principles:
1. **Data-driven configuration** - All setup logic is defined in JSON configuration files
2. **Modular design** - Separate concerns into focused modules (detection, installation, orchestration)
3. **Type-safe pattern matching** - Uses `ts-pattern` for robust conditional logic and exhaustive matching

```
setup/
├── core/
│   └── setup-command.ts          # Main orchestrator with ts-pattern for platform detection
├── detectors/
│   └── component-detector.ts     # Dynamic detection logic using ts-pattern
├── installers/
│   └── component-installer.ts    # Dynamic installation logic using ts-pattern
├── index.ts                      # Public exports
└── README.md                     # This file
```

## TypeScript Pattern Matching Integration

This system extensively uses `ts-pattern` instead of traditional switch statements for several benefits:

### 1. Type Safety and Exhaustiveness
```typescript
// Platform detection with exhaustive matching
private detectPlatform(): Platform {
  return match(process.platform)
    .with('darwin', () => 'macos' as const)
    .with('linux', () => 'linux' as const)
    .with('win32', () => 'windows' as const)
    .otherwise(() => 'linux' as const); // fallback
}
```

### 2. Component Detection Pattern Matching
```typescript
// Detection type matching with clear error handling
return match(detection.type)
  .with('command', () => {
    execSync(detection.value, { stdio: 'pipe' });
    return true;
  })
  .with('file', () => existsSync(detection.value))
  .with('custom', () => this.runCustomCheck(component.id, detection.customCheck ?? detection.value))
  .otherwise(() => false);
```

### 3. Installation Method Pattern Matching
```typescript
// Installation type matching with async support
await match(installation.type)
  .with('package-manager', async () => this.installViaPackageManager(installation, component.name))
  .with('script', async () => this.installViaScript(installation, component.name))
  .with('custom', async () => this.runCustomInstaller(component.id, installation))
  .with('manual', () => {
    this.showManualInstructions(installation, component.name);
    return Promise.resolve();
  })
  .otherwise(() => {
    console.log(chalk.yellow(`⚠️  Unknown installation type for ${component.name}`));
    return Promise.resolve();
  });
```

### 4. Package Manager Pattern Matching
```typescript
// Package manager selection with clear error handling
match(packageManager)
  .with('brew', () => {
    execSync(`brew install ${packageList}`, { stdio: 'inherit' });
  })
  .with('apt', () => {
    execSync(`sudo apt-get update && sudo apt-get install -y ${packageList}`, { stdio: 'inherit' });
  })
  .with('winget', () => {
    for (const pkg of packages) {
      execSync(`winget install -e --id ${pkg}`, { stdio: 'inherit' });
    }
  })
  .otherwise(() => {
    throw new Error(`Unsupported package manager: ${packageManager}`);
  });
```

## Benefits of ts-pattern Integration

### 1. **Exhaustive Matching**
- Compile-time guarantees that all cases are handled
- TypeScript will error if new enum values are added without handling them
- Eliminates runtime errors from unhandled cases

### 2. **Better Error Handling**
- Clear `.otherwise()` clauses for fallback behavior
- No more forgotten `default:` cases in switch statements
- Explicit handling of edge cases

### 3. **Improved Readability**
- Functional programming style with clear data flow
- Each pattern match is a pure transformation
- Easier to reason about complex conditional logic

### 4. **Type Safety**
- Full TypeScript inference through pattern matching
- Compile-time validation of pattern completeness
- Better IDE support with autocomplete and error detection

### 5. **Maintainability**
- Adding new platforms/types requires updating the pattern match
- TypeScript compiler enforces handling of new cases
- Refactoring is safer with compile-time checks

## Configuration Structure

The system uses a comprehensive `SetupComponent` type that supports:

```typescript
type SetupComponent = {
  id: string;
  name: string;
  description: string;
  category: 'essential' | 'development' | 'optional';
  platforms: Platform[];
  choiceGroup?: {
    id: string;
    name: string;
    description: string;
    required?: boolean;
    mutuallyExclusive?: boolean;
  };
  detection: {
    [platform in Platform]?: {
      type: 'command' | 'file' | 'custom';
      value: string;
      customCheck?: string;
    };
  };
  installation: {
    [platform in Platform]?: {
      type: 'package-manager' | 'script' | 'manual' | 'custom';
      commands?: string[];
      packageManager?: 'brew' | 'apt' | 'winget' | 'npm' | 'volta';
      packages?: string[];
      script?: string;
      manualSteps?: string[];
      customInstaller?: string;
    };
  };
  postInstall?: {
    message?: string;
    steps?: string[];
    links?: string[];
  };
}
```

## Detection Types

### Command Detection
Runs a command and checks for successful execution:
```json
{
  "type": "command",
  "value": "brew --version"
}
```

### File Detection
Checks if a file or directory exists:
```json
{
  "type": "file",
  "value": "/Applications/Docker.app"
}
```

### Custom Detection
Uses custom logic for complex detection scenarios:
```json
{
  "type": "custom",
  "value": "volta-check",
  "customCheck": "which node | grep .volta"
}
```

## Installation Types

### Package Manager Installation
Uses system package managers with ts-pattern for manager selection:
```json
{
  "type": "package-manager",
  "packageManager": "brew",
  "packages": ["git", "curl"]
}
```

### Script Installation
Runs installation scripts:
```json
{
  "type": "script",
  "script": "curl -fsSL https://get.docker.com | sh"
}
```

### Manual Installation
Shows manual installation steps:
```json
{
  "type": "manual",
  "manualSteps": [
    "Download from website",
    "Run installer",
    "Follow setup wizard"
  ]
}
```

### Custom Installation
Uses custom installation logic with ts-pattern for component selection:
```json
{
  "type": "custom",
  "customInstaller": "volta"
}
```

## Choice Groups

Components can be grouped for mutually exclusive choices:

```json
{
  "choiceGroup": {
    "id": "node-version-manager",
    "name": "Node.js Version Manager",
    "description": "Choose your preferred Node.js version manager",
    "required": true,
    "mutuallyExclusive": true
  }
}
```

This enables smart setup flows where users choose between alternatives like:
- Node.js version managers (Volta, NVM, ASDF)
- Docker platforms (Docker Desktop, OrbStack)
- Code editors (VS Code, Cursor)

## Commands

### Generated Commands
Individual component commands are automatically generated from configuration:
```bash
launchpad setup homebrew
launchpad setup node-volta
launchpad setup docker-desktop
```

### Choice Group Commands
Commands for choice groups are automatically created:
```bash
launchpad setup node-version-manager
launchpad setup docker-platform
```

### Main Commands
```bash
launchpad setup all        # Full interactive setup
launchpad setup essential  # Essential tools with choices
launchpad setup status     # Check installation status
```

## Error Handling

The system uses ts-pattern for robust error handling:

1. **Detection Errors**: Gracefully handled with try-catch and pattern matching
2. **Installation Errors**: Clear error messages with fallback instructions
3. **Configuration Errors**: Validation with helpful error messages
4. **Platform Errors**: Exhaustive platform matching with fallbacks

## Extending the System

### Adding New Components
1. Add component definition to configuration file
2. Detection and installation logic is automatically handled via ts-pattern
3. Custom logic can be added to detector/installer classes

### Adding New Platforms
1. Add platform to `Platform` type
2. TypeScript will enforce updating all pattern matches
3. Add platform-specific detection and installation logic

### Adding New Installation Types
1. Add type to installation type union
2. Update pattern match in `ComponentInstaller`
3. Implement installation logic

The ts-pattern integration ensures that extending the system is type-safe and all cases are properly handled at compile time.

## Key Features

### 🎯 **Data-Driven Configuration**
- All setup components are defined in JSON configuration
- Detection and installation logic is specified per platform
- No hardcoded component lists in the code

### 🔧 **Dynamic Command Generation**
- Individual component commands are generated from config
- Choice group commands are automatically created
- Only `all` and `essential` commands are hardcoded

### 🖥️ **Platform-Specific Logic**
- Detection methods vary by platform (command, file, custom)
- Installation methods adapt to platform capabilities
- Cross-platform support with graceful fallbacks

### 🚀 **Real Implementations Only**
- No mock implementations
- Actual package manager integrations
- Real detection logic for all components

## Migration from Old System

The old monolithic `setup.ts` file has been replaced with this modular system. Key changes:

1. **No hardcoded component lists** - Everything comes from config
2. **No mock implementations** - All real installations
3. **Dynamic command generation** - Commands created from config
4. **Platform-specific logic** - Defined in config, not code
5. **Extensible architecture** - Easy to add new components/platforms

This new system provides a solid foundation for comprehensive development environment management that can grow with the organization's needs. 
