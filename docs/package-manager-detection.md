# Package Manager Detection & Repository Overwrite Features

## Package Manager Detection

The Launchpad CLI now automatically detects the appropriate package manager to use for each repository based on lock files and package.json configuration.

### Detection Priority

The CLI checks for package managers in the following order:

1. **pnpm** - Detected by `pnpm-lock.yaml`
2. **yarn** - Detected by `yarn.lock`
3. **bun** - Detected by `bun.lockb`
4. **npm** - Detected by `package-lock.json`
5. **package.json** - Falls back to `packageManager` field (e.g., `"packageManager": "pnpm@8.0.0"`)
6. **Default** - Uses npm if no lock file or packageManager field is found

### Fallback Behavior

If the detected package manager is not available on the system, the CLI will:

1. Try alternative package managers in order of preference: pnpm → yarn → npm → bun
2. Show a clear message about which package manager is being used as a fallback
3. Fall back to npm as the last resort

### Example Output

```bash
📦 Installing dependencies for booking-store...
   Using pnpm (detected from: pnpm-lock.yaml)
✅ Dependencies installed for booking-store using pnpm
```

## Repository Overwrite Options

When cloning repositories that already exist, the CLI now provides flexible options for handling conflicts.

### Command Line Options

#### `--overwrite` Flag

Automatically overwrite existing repositories without prompting:

```bash
launchpad init --overwrite
```

#### Interactive Mode (Default)

When `--overwrite` is not specified, the CLI will prompt for each existing repository:

```bash
⚠️  Repository booking-store already exists.
Do you want to overwrite it? (y/N): 
```

#### Skip Mode

Without any flags, existing repositories are skipped:

```bash
⚠️  Repository booking-store already exists, skipping...
```

### Usage Examples

```bash
# Force overwrite all existing repositories
launchpad init --force --overwrite

# Interactive mode - prompt for each existing repository
launchpad init --force

# Resume from checkpoint with overwrite
launchpad init --resume --overwrite
```

### Output Summary

The CLI provides clear feedback about the cloning results:

```bash
✅ Successfully cloned 3 repositories
⏭️  Skipped 2 existing repositories
❌ Failed to clone 1 repositories:
   • private-repo
```

## Technical Implementation

### Package Manager Detection

- **File**: `apps/cli/src/utils/package-manager.ts`
- **Class**: `PackageManagerDetector`
- **Methods**:
  - `detectPackageManager()` - Detects based on lock files
  - `getBestAvailablePackageManager()` - Includes fallback logic
  - `isPackageManagerAvailable()` - Checks system availability

### Repository Cloning

- **File**: `apps/cli/src/utils/repository.ts`
- **Method**: `cloneRepository()` - Updated with overwrite options
- **Method**: `cloneRepositories()` - Batch cloning with options

### Command Integration

- **File**: `apps/cli/src/commands/init.ts`
- **Flag**: `--overwrite` - Added to init command
- **Integration**: Passes overwrite options through the initialization flow

## TypeScript Path Configuration

The CLI uses TypeScript path mapping for clean imports:

```typescript
// ✅ Good - Using tsconfig paths
import { PackageManagerDetector } from '@/utils/package-manager';

// ❌ Avoid - Relative imports
import { PackageManagerDetector } from '../package-manager';
```

### Path Mappings

- `@/*` → `src/*` - Maps to source directory
- `@Root/*` → `*` - Maps to project root

This ensures consistent, maintainable imports throughout the codebase. 
