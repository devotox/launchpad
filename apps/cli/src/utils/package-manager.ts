import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { match } from 'ts-pattern';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface PackageManagerInfo {
  manager: PackageManager;
  lockFile: string;
  installCommand: string[];
}

export class PackageManagerDetector {
  /**
   * Detects the package manager to use based on lock files present in the repository
   */
  async detectPackageManager(repoPath: string): Promise<PackageManagerInfo> {
    const lockFiles = [
      { file: 'pnpm-lock.yaml', manager: 'pnpm' as const },
      { file: 'yarn.lock', manager: 'yarn' as const },
      { file: 'bun.lockb', manager: 'bun' as const },
      { file: 'package-lock.json', manager: 'npm' as const }
    ];

    // Check for lock files in order of preference
    for (const { file, manager } of lockFiles) {
      const lockFilePath = join(repoPath, file);
      try {
        await fs.access(lockFilePath);
        return this.getPackageManagerInfo(manager, file);
      } catch {
        // Lock file doesn't exist, continue checking
      }
    }

    // No lock file found, check package.json for packageManager field
    try {
      const packageJsonPath = join(repoPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent) as { packageManager?: string };

      if (packageJson.packageManager) {
        const manager = this.parsePackageManagerField(packageJson.packageManager);
        if (manager) {
          return this.getPackageManagerInfo(manager, 'package.json packageManager field');
        }
      }
    } catch {
      // package.json doesn't exist or is invalid
    }

    // Default to npm if no lock file or packageManager field is found
    return this.getPackageManagerInfo('npm', 'default (no lock file found)');
  }

  private parsePackageManagerField(packageManager: string): PackageManager | null {
    // packageManager field format is typically "pnpm@8.0.0" or "yarn@3.0.0"
    const manager = packageManager.split('@')[0];

    return match(manager)
      .with('pnpm', () => 'pnpm' as const)
      .with('yarn', () => 'yarn' as const)
      .with('npm', () => 'npm' as const)
      .with('bun', () => 'bun' as const)
      .otherwise(() => null);
  }

  private getPackageManagerInfo(manager: PackageManager, lockFile: string): PackageManagerInfo {
    const installCommand = match(manager)
      .with('pnpm', () => ['pnpm', 'install'])
      .with('yarn', () => ['yarn', 'install'])
      .with('bun', () => ['bun', 'install'])
      .with('npm', () => ['npm', 'install'])
      .exhaustive();

    return {
      manager,
      lockFile,
      installCommand
    };
  }

  /**
   * Checks if a specific package manager is available on the system
   */
  async isPackageManagerAvailable(manager: PackageManager): Promise<boolean> {
    try {
      const { execa } = await import('execa');
      await execa(manager, ['--version'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the best available package manager for installation
   * Falls back to available alternatives if the detected manager isn't installed
   */
  async getBestAvailablePackageManager(repoPath: string): Promise<PackageManagerInfo> {
    const detected = await this.detectPackageManager(repoPath);

    // Check if the detected package manager is available
    const isAvailable = await this.isPackageManagerAvailable(detected.manager);

    if (isAvailable) {
      return detected;
    }

    // If detected manager isn't available, try fallbacks in order of preference
    const fallbacks: PackageManager[] = ['pnpm', 'yarn', 'npm', 'bun'];

    for (const manager of fallbacks) {
      if (manager === detected.manager) continue; // Skip the one we already tried

      const isManagerAvailable = await this.isPackageManagerAvailable(manager);
      if (isManagerAvailable) {
        return {
          ...this.getPackageManagerInfo(manager, `fallback (${detected.manager} not available)`),
          lockFile: `${detected.lockFile} (using ${manager} as fallback)`
        };
      }
    }

    // If no package manager is available, return npm as last resort
    return this.getPackageManagerInfo('npm', 'last resort (no package managers available)');
  }
}
