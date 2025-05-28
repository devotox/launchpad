import { match } from 'ts-pattern';

import type { RunOptions, DockerComposeInfo } from './types';
import { PackageManagerDetector } from '@/utils/package-manager';

export class CommandResolver {
  private packageManagerDetector = new PackageManagerDetector();

  async resolveCommand(
    command: string,
    options: RunOptions,
    dockerInfo: DockerComposeInfo,
    repoPath?: string
  ): Promise<string[]> {
    // Check if it's a shell command (starts with sh: or contains shell operators)
    if (command.startsWith('sh:') || this.isShellCommand(command)) {
      return this.resolveShellCommand(command);
    }

    // If it's a Docker Compose project, use Docker Compose commands
    if (dockerInfo.isDockerCompose && dockerInfo.composeFile) {
      return this.resolveDockerComposeCommand(command, options, dockerInfo.composeFile, repoPath);
    }

    // Otherwise, use package manager commands
    return this.resolvePackageManagerCommand(command, options, repoPath);
  }

  private isShellCommand(command: string): boolean {
    // Detect shell commands by common patterns
    const shellPatterns = [
      /\s*echo\s+/,
      /\s*printenv/,
      /\s*env\s*/,
      /\s*cat\s+/,
      /\s*ls\s*/,
      /\s*pwd/,
      /\|\s*grep/,
      /&&/,
      /\|\|/,
      /;/,
      />/,
      /</
    ];

    return shellPatterns.some(pattern => pattern.test(command));
  }

  private resolveShellCommand(command: string): string[] {
    // Remove sh: prefix if present
    const actualCommand = command.startsWith('sh:') ? command.slice(3) : command;
    return ['sh', '-c', actualCommand];
  }

  private async resolveDockerComposeCommand(
    command: string,
    options: RunOptions & { volumes?: boolean },
    composeFile: string,
    repoPath?: string
  ): Promise<string[]> {
    const baseCmd = ['compose', '-f', composeFile];

    // For Docker Compose commands that need package manager detection
    const getPackageManagerCommand = async (subCommand: string): Promise<string[]> => {
      if (!repoPath) {
        return ['npm', subCommand]; // fallback to npm
      }

      const packageManagerInfo = await this.packageManagerDetector.getBestAvailablePackageManager(repoPath);
      return [packageManagerInfo.manager, subCommand];
    };

    return match(command)
      .with('dev', () => [...baseCmd, 'up', '--build'])
      .with('start', () =>
        match(options.environment)
          .with('dev', () => [...baseCmd, 'up', '--build'])
          .with('prod', () => [...baseCmd, 'up', '-d'])
          .otherwise(() => [...baseCmd, 'up'])
      )
      .with('build', () => [...baseCmd, 'build'])
      .with('test', async () => {
        const packageManagerCmd = await getPackageManagerCommand('test');
        const cmd = [...baseCmd, 'run', '--rm', 'app', ...packageManagerCmd];
        if (options.watch) {
          cmd.push('--', '--watch');
        }
        return cmd;
      })
      .with('stop', () => [...baseCmd, 'stop'])
      .with('down', () => {
        const cmd = [...baseCmd, 'down'];
        if (options.volumes) {
          cmd.push('--volumes', '--remove-orphans');
        }
        return cmd;
      })
      .with('logs', () => [...baseCmd, 'logs', '-f'])
      .otherwise(async () => {
        const packageManagerCmd = await getPackageManagerCommand('run');
        return [...baseCmd, 'run', '--rm', 'app', ...packageManagerCmd, command];
      });
  }

  private async resolvePackageManagerCommand(command: string, options: RunOptions, repoPath?: string): Promise<string[]> {
    // Get the appropriate package manager
    const packageManagerInfo = repoPath
      ? await this.packageManagerDetector.getBestAvailablePackageManager(repoPath)
      : { manager: 'npm' as const, lockFile: 'fallback', installCommand: ['npm', 'install'] };

    const { manager } = packageManagerInfo;

    return match(command)
      .with('dev', () =>
        match(options.environment)
          .with('dev', () => [manager, 'run', 'dev'])
          .otherwise(() => [manager, 'run', 'dev'])
      )
      .with('start', () =>
        match(options.environment)
          .with('dev', () => [manager, 'run', 'dev'])
          .with('prod', () => this.getStartCommand(manager))
          .otherwise(() => this.getStartCommand(manager))
      )
      .with('build', () =>
        match(options.environment)
          .with('dev', () => [manager, 'run', 'build:dev'])
          .with('prod', () => [manager, 'run', 'build'])
          .otherwise(() => [manager, 'run', 'build'])
      )
      .with('test', () => {
        const baseCmd = this.getTestCommand(manager);
        if (options.watch) {
          baseCmd.push('--', '--watch');
        }
        return baseCmd;
      })
      .with('lint', () => {
        const baseCmd = [manager, 'run', 'lint'];
        if (options.fix) {
          baseCmd.push('--', '--fix');
        }
        return baseCmd;
      })
      .with('install', () => packageManagerInfo.installCommand)
      .otherwise(() => [manager, 'run', command]);
  }

  private getStartCommand(manager: string): string[] {
    return match(manager)
      .with('npm', () => ['npm', 'start'])
      .otherwise(() => [manager, 'run', 'start']);
  }

  private getTestCommand(manager: string): string[] {
    return match(manager)
      .with('npm', () => ['npm', 'test'])
      .otherwise(() => [manager, 'run', 'test']);
  }

  isLongRunningCommand(command: string): boolean {
    const longRunningCommands = ['dev', 'start', 'serve', 'watch'];
    return longRunningCommands.includes(command);
  }
}
