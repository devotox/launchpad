import { join } from 'node:path';

import { ConfigManager } from '@/utils/config';

import { CommandResolver } from './command-resolver';
import { DockerDetector } from './docker-detector';
import { LogManager } from './log-manager';
import { ProcessManager } from './process-manager';
import { RepositoryManager } from './repository-manager';

import type { RunOptions, RunningProcess } from './types';

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

    // Detect Docker Compose usage
    const dockerInfo = await this.dockerDetector.detectDockerCompose(repoPath);
    const npmDockerInfo = await this.dockerDetector.detectNpmDockerUsage(repoPath, command);

    // Resolve the actual command to run
    const actualCommand = await this.commandResolver.resolveCommand(command, options, dockerInfo);

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
