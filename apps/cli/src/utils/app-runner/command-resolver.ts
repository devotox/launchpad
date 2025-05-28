import { match } from 'ts-pattern';

import type { RunOptions, DockerComposeInfo } from './types';

export class CommandResolver {
  async resolveCommand(
    command: string,
    options: RunOptions,
    dockerInfo: DockerComposeInfo
  ): Promise<string[]> {
    // Check if it's a shell command (starts with sh: or contains shell operators)
    if (command.startsWith('sh:') || this.isShellCommand(command)) {
      return this.resolveShellCommand(command);
    }

    // If it's a Docker Compose project, use Docker Compose commands
    if (dockerInfo.isDockerCompose && dockerInfo.composeFile) {
      return this.resolveDockerComposeCommand(command, options, dockerInfo.composeFile);
    }

    // Otherwise, use regular npm commands
    return this.resolveNpmCommand(command, options);
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

  private resolveDockerComposeCommand(
    command: string,
    options: RunOptions & { volumes?: boolean },
    composeFile: string
  ): string[] {
    const baseCmd = ['compose', '-f', composeFile];

    return match(command)
      .with('dev', () => [...baseCmd, 'up', '--build'])
      .with('start', () =>
        match(options.environment)
          .with('dev', () => [...baseCmd, 'up', '--build'])
          .with('prod', () => [...baseCmd, 'up', '-d'])
          .otherwise(() => [...baseCmd, 'up'])
      )
      .with('build', () => [...baseCmd, 'build'])
      .with('test', () => {
        const cmd = [...baseCmd, 'run', '--rm', 'app', 'npm', 'test'];
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
      .otherwise(() => [...baseCmd, 'run', '--rm', 'app', 'npm', 'run', command]);
  }

  private resolveNpmCommand(command: string, options: RunOptions): string[] {
    return match(command)
      .with('dev', () =>
        match(options.environment)
          .with('dev', () => ['npm', 'run', 'dev'])
          .otherwise(() => ['npm', 'run', 'dev'])
      )
      .with('start', () =>
        match(options.environment)
          .with('dev', () => ['npm', 'run', 'dev'])
          .with('prod', () => ['npm', 'start'])
          .otherwise(() => ['npm', 'start'])
      )
      .with('build', () =>
        match(options.environment)
          .with('dev', () => ['npm', 'run', 'build:dev'])
          .with('prod', () => ['npm', 'run', 'build'])
          .otherwise(() => ['npm', 'run', 'build'])
      )
      .with('test', () => {
        const baseCmd = ['npm', 'test'];
        if (options.watch) {
          baseCmd.push('--', '--watch');
        }
        return baseCmd;
      })
      .with('lint', () => {
        const baseCmd = ['npm', 'run', 'lint'];
        if (options.fix) {
          baseCmd.push('--', '--fix');
        }
        return baseCmd;
      })
      .with('install', () => ['npm', 'install'])
      .otherwise(() => ['npm', 'run', command]);
  }

  isLongRunningCommand(command: string): boolean {
    const longRunningCommands = ['dev', 'start', 'serve', 'watch'];
    return longRunningCommands.includes(command);
  }
}
