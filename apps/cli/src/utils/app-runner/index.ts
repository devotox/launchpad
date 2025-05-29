import { join } from 'node:path';

import { ConfigManager } from '@/utils/config/manager';
import { DataManager } from '@/utils/config/data-manager';

import { CommandResolver } from './command-resolver';
import { DockerDetector } from './docker-detector';
import { LogManager } from './log-manager';
import { ProcessManager } from './process-manager';
import { RepositoryManager } from './repository-manager';

import type { RunOptions, RunningProcess } from './types';
import type { Repository, Team, DevCommand } from '@/utils/config/types';

// Supports custom devCommand per repository (see teams.json) for running custom dev scripts in sequence.

export class AppRunner {
  private workspacePath: string;
  private logDir: string;

  private processManager: ProcessManager;
  private dockerDetector: DockerDetector;
  private commandResolver: CommandResolver;
  private logManager: LogManager;
  private repositoryManager: RepositoryManager;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;

    // Use ConfigManager to get the proper logs directory
    const configManager = ConfigManager.getInstance();
    this.logDir = configManager.getLogsDir();

    // Initialize managers
    this.processManager = new ProcessManager(this.logDir);
    this.dockerDetector = new DockerDetector();
    this.commandResolver = new CommandResolver();
    this.logManager = new LogManager(this.logDir);
    this.repositoryManager = new RepositoryManager(workspacePath);
  }

  async ensureLogDir(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    await configManager.ensureLogsDir();
  }

  async runCommand(command: string, repositories: string[], options: RunOptions): Promise<void> {
    await this.ensureLogDir();

    if (options.parallel) {
      await this.runParallel(command, repositories, options);
    } else {
      await this.runSequential(command, repositories, options);
    }
  }

  private async runParallel(
    command: string,
    repositories: string[],
    options: RunOptions
  ): Promise<void> {
    const promises = repositories.map(async (repo) =>
      this.runSingleCommand(command, repo, options)
    );

    await this.processManager.runParallel(promises, command, repositories.length);
  }

  private async runSequential(
    command: string,
    repositories: string[],
    options: RunOptions
  ): Promise<void> {
    await this.processManager.runSequential(
      repositories,
      async (repo: string) => this.runSingleCommand(command, repo, options),
      command
    );
  }

  private async runSingleCommand(
    command: string,
    repo: string,
    options: RunOptions
  ): Promise<void> {
    const repoPath = join(this.workspacePath, repo);
    // Fetch the full Team object for the current user
    const configManager = ConfigManager.getInstance();
    const userInfo = await configManager.getUserInfo();
    let repoObj: Repository | undefined = undefined;
    if (userInfo) {
      const dataManager = DataManager.getInstance();
      const team: Team | undefined = await dataManager.getTeamById(userInfo.team);
      if (team && Array.isArray(team.repositories)) {
        repoObj = team.repositories.find((r) => r.name === repo);
      }
    }
    // Check for a custom command array or string for this command (e.g., devCommand, buildCommand, etc)
    const customCommandKey = `${command}Command` as keyof Repository;
    let customCommands: string[] | DevCommand[] | undefined;
    if (repoObj && typeof repoObj[customCommandKey] === 'string') {
      customCommands = [repoObj[customCommandKey] as string];
    } else if (repoObj && Array.isArray(repoObj[customCommandKey])) {
      // Filter out undefined/null
      customCommands = (repoObj[customCommandKey] as (string | DevCommand | undefined)[]).filter(Boolean) as string[] | DevCommand[];
    }
    // Support new DevCommand[] structure for 'dev' command
    if (
      command === 'dev' &&
      Array.isArray(customCommands) &&
      customCommands.length > 0 &&
      typeof customCommands[0] === 'object' &&
      customCommands[0] !== undefined &&
      'command' in customCommands[0]
    ) {
      // Interactive selection if more than one
      const devCommands = (customCommands as unknown[]).filter((c): c is DevCommand => !!c && typeof c === 'object' && 'command' in c);
      if (!devCommands.length) {
        throw new Error('No valid dev commands found for this repository.');
      }
      let selected: DevCommand;
      if (devCommands.length === 1) {
        if (!devCommands[0]) throw new Error('No valid dev commands found for this repository.');
        selected = devCommands[0];
      } else {
        const inquirer = (await import('inquirer')).default;
        const { chosen } = await inquirer.prompt([
          {
            type: 'list',
            name: 'chosen',
            message: `Select dev command for ${repo}:`,
            choices: devCommands.map((cmd, idx) => ({
              name: `${cmd.type}${cmd.label ? ` - ${cmd.label}` : ''}: ${Array.isArray(cmd.command) ? cmd.command.join(' ') : cmd.command}`,
              value: idx
            }))
          }
        ]);
        const idx = typeof chosen === 'number' && chosen >= 0 && chosen < devCommands.length ? chosen : 0;
        if (!devCommands[idx]) throw new Error('No valid dev commands found for this repository.');
        selected = devCommands[idx];
      }
      // Run the selected dev command
      let actualCommand: string[];
      const knownManagers = ['pnpm', 'npm', 'yarn', 'bun'];
      if (Array.isArray(selected.command)) {
        const first = selected.command[0] ?? '';
        if (typeof first === 'string' && knownManagers.includes(first)) {
          actualCommand = selected.command as string[];
        } else {
          actualCommand = await this.commandResolver.resolveCommand((selected.command as string[]).join(' '), options, { isDockerCompose: false }, repoPath);
        }
      } else if (typeof selected.command === 'string') {
        const splitCmd = selected.command.trim().split(/\s+/);
        const first = splitCmd[0] ?? '';
        if (typeof first === 'string' && knownManagers.includes(first)) {
          actualCommand = splitCmd;
        } else {
          actualCommand = await this.commandResolver.resolveCommand(selected.command, options, { isDockerCompose: false }, repoPath);
        }
      } else {
        actualCommand = await this.commandResolver.resolveCommand(String(selected.command), options, { isDockerCompose: false }, repoPath);
      }
      let commandStr = '';
      if (Array.isArray(selected.command) && selected.command.every((c) => typeof c === 'string')) {
        commandStr = (selected.command as string[]).join(' ');
      } else if (typeof selected.command === 'string') {
        commandStr = selected.command;
      } else {
        commandStr = '';
      }
      await this.processManager.runSingleCommand({
        actualCommand,
        repo,
        repoPath,
        command: commandStr,
        options,
        dockerInfo: { isDockerCompose: false },
        npmDockerInfo: { usesDocker: false, dockerCommand: '', services: [] }
      });
      return;
    }
    if (customCommands && customCommands.length > 0) {
      for (const customCmdRaw of customCommands) {
        // Only handle string[] or string legacy commands here
        if (typeof customCmdRaw === 'string') {
          // string
          const customCmd = customCmdRaw;
          const knownManagers = ['pnpm', 'npm', 'yarn', 'bun'];
          let actualCommand: string[];
          const splitCmd = customCmd.trim().split(/\s+/);
          const first = splitCmd[0] ?? '';
          if (typeof first === 'string' && knownManagers.includes(first)) {
            actualCommand = splitCmd;
          } else {
            actualCommand = await this.commandResolver.resolveCommand(customCmd, options, { isDockerCompose: false }, repoPath);
          }
          await this.processManager.runSingleCommand({
            actualCommand,
            repo,
            repoPath,
            command: customCmd,
            options,
            dockerInfo: { isDockerCompose: false },
            npmDockerInfo: { usesDocker: false, dockerCommand: '', services: [] }
          });
        } else if (Array.isArray(customCmdRaw) && customCmdRaw.every((c) => typeof c === 'string')) {
          // string[]
          const customCmd = customCmdRaw as string[];
          const knownManagers = ['pnpm', 'npm', 'yarn', 'bun'];
          let actualCommand: string[];
          const first = customCmd[0] ?? '';
          if (typeof first === 'string' && knownManagers.includes(first)) {
            actualCommand = customCmd;
          } else {
            actualCommand = await this.commandResolver.resolveCommand(customCmd.join(' '), options, { isDockerCompose: false }, repoPath);
          }
          await this.processManager.runSingleCommand({
            actualCommand,
            repo,
            repoPath,
            command: customCmd.join(' '),
            options,
            dockerInfo: { isDockerCompose: false },
            npmDockerInfo: { usesDocker: false, dockerCommand: '', services: [] }
          });
        }
      }
      return;
    }

    // Detect Docker Compose usage
    const dockerInfo = await this.dockerDetector.detectDockerCompose(repoPath);
    const npmDockerInfo = await this.dockerDetector.detectNpmDockerUsage(repoPath, command);

    // Resolve the actual command to run
    const actualCommand = await this.commandResolver.resolveCommand(command, options, dockerInfo, repoPath);

    // Run the command through process manager
    await this.processManager.runSingleCommand({
      actualCommand,
      repo,
      repoPath,
      command,
      options,
      dockerInfo,
      npmDockerInfo
    });
  }

  // Delegate methods to appropriate managers
  async stopAll(): Promise<void> {
    return this.processManager.stopAll();
  }

  async stopRepositories(repositories: string[]): Promise<void> {
    return this.processManager.stopRepositories(repositories);
  }

  async killAll(force = false): Promise<void> {
    return this.processManager.killAll(force);
  }

  async showStatus(): Promise<void> {
    return this.processManager.showStatus();
  }

  async showLogs(repo: string, follow = false): Promise<void> {
    return this.logManager.showLogs(repo, follow);
  }

  async getRunningProcesses(): Promise<RunningProcess[]> {
    return this.processManager.getRunningProcesses();
  }

  async listRepositories(detailed = false): Promise<void> {
    return this.repositoryManager.listRepositories(detailed);
  }
}

// Re-export types for convenience
export type { RunOptions, RunningProcess } from './types';
