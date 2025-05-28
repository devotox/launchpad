# Dynamic Component Detection and Installation

This document explains how the refactored component detection and installation system works without hardcoded logic.

## Overview

The component detector and installer are now fully configuration-driven, removing all hardcoded logic for specific components. Instead of having special cases for components like `node-volta`, `npm-token`, etc., all behavior is defined in the configuration JSON.

## Component Detection

The detection system supports three types of checks, plus a powerful custom type:

### 1. Command Detection
```json
{
  "type": "command",
  "value": "volta --version"
}
```

### 2. File Detection
```json
{
  "type": "file",
  "value": "$HOME/.volta/bin/volta"
}
```

### 3. Custom Detection
Custom detection uses JSON-encoded configuration strings that support:

#### Environment Variable Check
```json
{
  "type": "custom",
  "customCheck": "{\"type\": \"env\", \"variable\": \"NPM_TOKEN\"}"
}
```

#### File Contains Check
```json
{
  "type": "custom", 
  "customCheck": "{\"type\": \"file-contains\", \"file\": \"$HOME/.npmrc\", \"pattern\": \"_authToken\"}"
}
```

#### Path Includes Check
```json
{
  "type": "custom",
  "customCheck": "{\"type\": \"path-includes\", \"command\": \"which node\", \"includes\": \".volta\"}"
}
```

#### Combined Checks
```json
{
  "type": "custom",
  "customCheck": "{\"type\": \"combined\", \"operator\": \"OR\", \"checks\": [{\"type\": \"file\", \"value\": \"$HOME/.ssh/id_rsa\"}, {\"type\": \"command\", \"command\": \"gh auth status\"}]}"
}
```

## Component Installation

The installation system supports four types:

### 1. Package Manager
```json
{
  "type": "package-manager",
  "packageManager": "brew",
  "packages": ["node", "npm"]
}
```

### 2. Script
```json
{
  "type": "script",
  "script": "curl https://get.volta.sh | bash"
}
```

### 3. Manual
```json
{
  "type": "manual",
  "manualSteps": [
    "Download from website",
    "Run installer",
    "Configure settings"
  ]
}
```

### 4. Custom Installation
Custom installation uses JSON-encoded configuration strings:

#### Script Type
```json
{
  "type": "custom",
  "customInstaller": "{\"type\": \"script\", \"script\": \"curl -o- install.sh | bash\"}"
}
```

#### Commands Type
```json
{
  "type": "custom",
  "customInstaller": "{\"type\": \"commands\", \"commands\": [\"apt update\", \"apt install package\"]}"
}
```

#### Manual Type with Links
```json
{
  "type": "custom",
  "customInstaller": "{\"type\": \"manual\", \"steps\": [\"Step 1\", \"Step 2\"], \"links\": [\"https://docs.example.com\"]}"
}
```

#### Download Type
```json
{
  "type": "custom",
  "customInstaller": "{\"type\": \"download\", \"url\": \"https://example.com/installer.exe\", \"message\": \"Run the downloaded installer\"}"
}
```

## Example: Migrating Hardcoded Components

### Before (Hardcoded):
```typescript
private checkNodeVolta(): boolean {
  try {
    const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
    return nodePath.includes('.volta');
  } catch {
    return false;
  }
}
```

### After (Configuration):
```json
{
  "detection": {
    "macos": {
      "type": "custom",
      "customCheck": "{\"type\": \"path-includes\", \"command\": \"which node\", \"includes\": \".volta\"}"
    }
  }
}
```

## Benefits

1. **No Code Changes Required**: Add new components by updating configuration only
2. **Platform-Specific Logic**: Different detection/installation per OS without code duplication
3. **Flexible Combinations**: Use combined checks for complex detection scenarios
4. **Maintainable**: All component logic in one place (configuration files)
5. **Extensible**: Easy to add new check types or installation methods

## Configuration Schema

The full configuration for a component looks like:

```json
{
  "id": "component-id",
  "name": "Component Name",
  "description": "Component description",
  "category": "essential|development|optional",
  "platforms": ["macos", "linux", "windows"],
  "detection": {
    "macos": { /* detection config */ },
    "linux": { /* detection config */ },
    "windows": { /* detection config */ }
  },
  "installation": {
    "macos": { /* installation config */ },
    "linux": { /* installation config */ },
    "windows": { /* installation config */ }
  },
  "postInstall": {
    "message": "Success message",
    "steps": ["Next step 1", "Next step 2"],
    "links": ["https://docs.example.com"]
  }
}
```

## Adding New Components

To add a new component:

1. Create the component configuration in your `setup-components.json`
2. Define detection logic using the available detection types
3. Define installation logic using the available installation types
4. No code changes required!

The system will automatically use your configuration to detect and install the component. 
