import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import chalk from 'chalk';

export class RepositoryManager {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async listRepositories(detailed = false): Promise<void> {
    try {
      const repositories = await this.findRepositories();

      console.log(chalk.cyan('\n📁 Available Repositories'));
      console.log(chalk.gray('─'.repeat(30)));

      if (repositories.length === 0) {
        console.log(chalk.yellow('No repositories found in workspace.'));
        return;
      }

      for (const repo of repositories) {
        console.log(chalk.white(`\n📦 ${repo}`));

        if (detailed) {
          await this.showDetailedRepoInfo(repo);
        } else {
          await this.showBasicRepoInfo(repo);
        }
      }

      console.log(chalk.gray(`\nTotal: ${repositories.length} repositories`));
    } catch (error) {
      console.log(chalk.red('❌ Failed to list repositories:'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async findRepositories(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.workspacePath, { withFileTypes: true });
      const directories = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith('.') && name !== 'node_modules');

      // Filter to only include directories that look like repositories
      const repositories: string[] = [];

      for (const dir of directories) {
        if (await this.isRepository(dir)) {
          repositories.push(dir);
        }
      }

      return repositories.sort();
    } catch {
      return [];
    }
  }

  private async isRepository(dirName: string): Promise<boolean> {
    const dirPath = join(this.workspacePath, dirName);

    try {
      // Check for common repository indicators
      const indicators = [
        'package.json',
        '.git',
        'Dockerfile',
        'docker-compose.yml',
        'requirements.txt',
        'Gemfile',
        'go.mod'
      ];

      for (const indicator of indicators) {
        try {
          await fs.access(join(dirPath, indicator));
          return true;
        } catch {
          // Continue checking other indicators
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  private async showBasicRepoInfo(repo: string): Promise<void> {
    const repoPath = join(this.workspacePath, repo);

    try {
      // Check for package.json
      const packageJsonPath = join(repoPath, 'package.json');
      try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent) as {
          description?: string;
          version?: string;
        };

        if (packageJson.description) {
          console.log(chalk.gray(`   ${packageJson.description}`));
        }

        if (packageJson.version) {
          console.log(chalk.gray(`   Version: ${packageJson.version}`));
        }
      } catch {
        // No package.json or invalid JSON
        console.log(chalk.gray('   (No package.json found)'));
      }
    } catch (error) {
      console.log(
        chalk.gray(
          `   Error reading repository info: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async showDetailedRepoInfo(repo: string): Promise<void> {
    const repoPath = join(this.workspacePath, repo);

    try {
      await this.showBasicRepoInfo(repo);

      // Check for Docker support
      const dockerIndicators = await this.checkDockerSupport(repoPath);
      if (dockerIndicators.length > 0) {
        console.log(chalk.gray(`   🐳 Docker: ${dockerIndicators.join(', ')}`));
      }

      // Check for available scripts
      const scripts = await this.getAvailableScripts(repoPath);
      if (scripts.length > 0) {
        console.log(
          chalk.gray(
            `   📜 Scripts: ${scripts.slice(0, 5).join(', ')}${scripts.length > 5 ? '...' : ''}`
          )
        );
      }

      // Show directory size
      const size = await this.getDirectorySize(repoPath);
      console.log(chalk.gray(`   📊 Size: ${this.formatSize(size)}`));
    } catch (error) {
      console.log(
        chalk.gray(
          `   Error reading detailed info: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async checkDockerSupport(repoPath: string): Promise<string[]> {
    const dockerFiles = [
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml'
    ];

    const found: string[] = [];

    for (const file of dockerFiles) {
      try {
        await fs.access(join(repoPath, file));
        found.push(file);
      } catch {
        // File doesn't exist
      }
    }

    return found;
  }

  private async getAvailableScripts(repoPath: string): Promise<string[]> {
    try {
      const packageJsonPath = join(repoPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent) as { scripts?: Record<string, string> };

      return packageJson.scripts ? Object.keys(packageJson.scripts) : [];
    } catch {
      return [];
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const stats = await fs.stat(dirPath);
      if (stats.isFile()) {
        return stats.size;
      }

      if (stats.isDirectory()) {
        const entries = await fs.readdir(dirPath);
        let totalSize = 0;

        for (const entry of entries) {
          // Skip node_modules and other large directories for performance
          if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) {
            continue;
          }

          const entryPath = join(dirPath, entry);
          totalSize += await this.getDirectorySize(entryPath);
        }

        return totalSize;
      }

      return 0;
    } catch {
      return 0;
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }
}
