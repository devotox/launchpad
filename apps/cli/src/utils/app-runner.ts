import { promises as fs } from "node:fs";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import chalk from "chalk";
import { match } from "ts-pattern";
import { ConfigManager } from "@/utils/config";

export interface RunningProcess {
  repo: string;
  command: string;
  pid: number;
  process: ChildProcess;
  startTime: Date;
  logFile: string;
  isDockerCompose?: boolean;
  composeFile?: string;
  npmUsesDocker?: boolean; // npm script that uses docker compose
  dockerServices?: string[]; // services started by this process
}

export interface RunOptions {
  environment: string;
  parallel: boolean;
  watch: boolean;
  fix?: boolean;
}

export class AppRunner {
  private workspacePath: string;
  private runningProcesses: Map<string, RunningProcess> = new Map();
  private logDir: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    // Use ConfigManager to get the proper logs directory
    const configManager = ConfigManager.getInstance();
    this.logDir = configManager.getLogsDir();
  }

  async ensureLogDir(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    await configManager.ensureLogsDir();
  }

  async runCommand(
    command: string,
    repositories: string[],
    options: RunOptions
  ): Promise<void> {
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
    console.log(chalk.cyan(`\n🔄 Running '${command}' in parallel on ${repositories.length} repositories...\n`));

    const promises = repositories.map(repo => this.runSingleCommand(command, repo, options));

    try {
      await Promise.all(promises);
      console.log(chalk.green(`\n✅ All repositories completed '${command}' successfully!`));
    } catch (error) {
      console.log(chalk.red(`\n❌ Some repositories failed to complete '${command}'`));
    }
  }

  private async runSequential(
    command: string,
    repositories: string[],
    options: RunOptions
  ): Promise<void> {
    console.log(chalk.cyan(`\n🔄 Running '${command}' sequentially on ${repositories.length} repositories...\n`));

    for (const repo of repositories) {
      try {
        await this.runSingleCommand(command, repo, options);
        console.log(chalk.green(`✅ Completed '${command}' for ${repo}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed '${command}' for ${repo}`));
        if (!options.parallel) {
          // In sequential mode, ask if user wants to continue
          console.log(chalk.yellow("⚠️  Continuing with next repository..."));
        }
      }
    }
  }

  private async runSingleCommand(
    command: string,
    repo: string,
    options: RunOptions
  ): Promise<void> {
    const repoPath = join(this.workspacePath, repo);

    // Check if repository exists
    try {
      await fs.access(repoPath);
    } catch {
      throw new Error(`Repository '${repo}' not found at ${repoPath}`);
    }

    // Check if this is a Docker Compose project
    const dockerComposeInfo = await this.detectDockerCompose(repoPath);

    // Check if npm scripts use Docker Compose
    const npmDockerInfo = await this.detectNpmDockerUsage(repoPath, command);

    // Determine the actual command to run
    const actualCommand = await this.resolveCommand(command, options, dockerComposeInfo);
    const logFile = join(this.logDir, `${repo}-${command}-${Date.now()}.log`);

    console.log(chalk.blue(`📦 ${repo}: ${actualCommand.join(' ')}`));
    if (dockerComposeInfo.isDockerCompose) {
      console.log(chalk.gray(`   🐳 Docker Compose detected: ${dockerComposeInfo.composeFile}`));
    }
    if (npmDockerInfo.usesDocker) {
      console.log(chalk.gray(`   🐳 NPM script uses Docker Compose: ${npmDockerInfo.dockerCommand}`));
    }

    return new Promise((resolve, reject) => {
      const childProcess = spawn(actualCommand[0]!, actualCommand.slice(1), {
        cwd: repoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      // Store running process
      const runningProcess: RunningProcess = {
        repo,
        command,
        pid: childProcess.pid || 0,
        process: childProcess,
        startTime: new Date(),
        logFile,
        isDockerCompose: dockerComposeInfo.isDockerCompose,
        composeFile: dockerComposeInfo.composeFile,
        npmUsesDocker: npmDockerInfo.usesDocker,
        dockerServices: npmDockerInfo.services
      };

      this.runningProcesses.set(`${repo}-${command}`, runningProcess);

      // Create log file stream
      const logStream = createWriteStream(logFile);

      // Handle stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        logStream.write(`[STDOUT] ${output}`);

        // For long-running processes (dev, start), don't resolve immediately
        if (this.isLongRunningCommand(command)) {
          console.log(chalk.gray(`${repo}: ${output.trim()}`));
        }
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        logStream.write(`[STDERR] ${output}`);
        console.log(chalk.red(`${repo}: ${output.trim()}`));
      });

      // Handle process exit
      childProcess.on('close', (code: number | null) => {
        logStream.end();
        this.runningProcesses.delete(`${repo}-${command}`);

        if (code === 0) {
          if (!this.isLongRunningCommand(command)) {
            console.log(chalk.green(`✅ ${repo}: ${command} completed successfully`));
          }
          resolve();
        } else {
          console.log(chalk.red(`❌ ${repo}: ${command} failed with code ${code}`));
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      childProcess.on('error', (error: Error) => {
        logStream.end();
        this.runningProcesses.delete(`${repo}-${command}`);
        console.log(chalk.red(`❌ ${repo}: ${error.message}`));
        reject(error);
      });

      // For long-running commands, resolve immediately after starting
      if (this.isLongRunningCommand(command)) {
        setTimeout(() => {
          console.log(chalk.green(`🚀 ${repo}: ${command} started (PID: ${childProcess.pid})`));
          resolve();
        }, 1000);
      }
    });
  }

  private async detectDockerCompose(repoPath: string): Promise<{
    isDockerCompose: boolean;
    composeFile?: string;
  }> {
    const possibleFiles = [
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml',
      'docker-compose.dev.yml',
      'docker-compose.development.yml'
    ];

    for (const file of possibleFiles) {
      try {
        await fs.access(join(repoPath, file));
        return {
          isDockerCompose: true,
          composeFile: file
        };
      } catch {
        // File doesn't exist, continue checking
      }
    }

    return { isDockerCompose: false };
  }

  private async detectNpmDockerUsage(repoPath: string, command: string): Promise<{
    usesDocker: boolean;
    dockerCommand?: string;
    services?: string[];
    composeFile?: string;
  }> {
    try {
      const packageJsonPath = join(repoPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      if (!packageJson.scripts) {
        return { usesDocker: false };
      }

      // Map command to potential npm script names
      const scriptNames = this.getScriptNames(command);

      for (const scriptName of scriptNames) {
        const script = packageJson.scripts[scriptName];
        if (script && this.scriptUsesDockerCompose(script)) {
          const dockerInfo = this.parseDockerComposeScript(script);
          return {
            usesDocker: true,
            dockerCommand: script,
            services: dockerInfo.services,
            composeFile: dockerInfo.composeFile
          };
        }
      }

      return { usesDocker: false };
    } catch {
      return { usesDocker: false };
    }
  }

  private getScriptNames(command: string): string[] {
    return match(command)
      .with('dev', () => ['dev', 'start:dev', 'develop'])
      .with('start', () => ['start', 'serve', 'dev'])
      .with('build', () => ['build', 'build:prod', 'build:dev'])
      .with('test', () => ['test', 'test:unit', 'test:integration'])
      .with('lint', () => ['lint', 'lint:check'])
      .otherwise(() => [command]);
  }

  private scriptUsesDockerCompose(script: string): boolean {
    const dockerComposePatterns = [
      /docker-compose/,
      /docker compose/,
      /compose/
    ];

    return dockerComposePatterns.some(pattern => pattern.test(script));
  }

  private parseDockerComposeScript(script: string): {
    services?: string[];
    composeFile?: string;
  } {
    // Extract compose file if specified
    const composeFileMatch = script.match(/-f\s+([^\s]+)|--file\s+([^\s]+)/);
    const composeFile = composeFileMatch?.[1] || composeFileMatch?.[2] || 'docker-compose.yml';

    // Extract services if specified (services are usually at the end)
    const parts = script.split(/\s+/);
    const upIndex = parts.findIndex(part => part === 'up');

    if (upIndex !== -1) {
      // Services are typically after 'up' and any flags
      const afterUp = parts.slice(upIndex + 1);
      const services = afterUp.filter(part =>
        !part.startsWith('-') &&
        part !== 'up' &&
        part !== 'down' &&
        part !== 'build'
      );

      return {
        services: services.length > 0 ? services : undefined,
        composeFile
      };
    }

    return { composeFile };
  }

  private async resolveCommand(
    command: string,
    options: RunOptions,
    dockerInfo: { isDockerCompose: boolean; composeFile?: string }
  ): Promise<string[]> {
    // If it's a Docker Compose project, use Docker Compose commands
    if (dockerInfo.isDockerCompose && dockerInfo.composeFile) {
      return this.resolveDockerComposeCommand(command, options, dockerInfo.composeFile);
    }

    // Otherwise, use regular npm commands
    return this.resolveNpmCommand(command, options);
  }

  private resolveDockerComposeCommand(
    command: string,
    options: RunOptions & { volumes?: boolean },
    composeFile: string
  ): string[] {
    const baseCmd = ['compose', '-f', composeFile];

    return match(command)
      .with('dev', () => [...baseCmd, 'up', '--build'])
      .with('start', () => {
        return match(options.environment)
          .with('dev', () => [...baseCmd, 'up', '--build'])
          .with('prod', () => [...baseCmd, 'up', '-d'])
          .otherwise(() => [...baseCmd, 'up']);
      })
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
      .with('dev', () => {
        return match(options.environment)
          .with('dev', () => ['npm', 'run', 'dev'])
          .otherwise(() => ['npm', 'run', 'dev']);
      })
      .with('start', () => {
        return match(options.environment)
          .with('dev', () => ['npm', 'run', 'dev'])
          .with('prod', () => ['npm', 'start'])
          .otherwise(() => ['npm', 'start']);
      })
      .with('build', () => {
        return match(options.environment)
          .with('dev', () => ['npm', 'run', 'build:dev'])
          .with('prod', () => ['npm', 'run', 'build'])
          .otherwise(() => ['npm', 'run', 'build']);
      })
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
      .with('clean', () => ['npm', 'run', 'clean'])
      .with('typecheck', () => ['npm', 'run', 'typecheck'])
      .otherwise(() => ['npm', 'run', command]);
  }

  private isLongRunningCommand(command: string): boolean {
    return match(command)
      .with('dev', () => true)
      .with('start', () => true)
      .with('serve', () => true)
      .with('watch', () => true)
      .otherwise(() => false);
  }

  async stopAll(): Promise<void> {
    console.log(chalk.yellow("\n🛑 Stopping all running processes..."));

    const processes = Array.from(this.runningProcesses.values());

    if (processes.length === 0) {
      console.log(chalk.gray("No running processes found."));
      return;
    }

    for (const proc of processes) {
      await this.stopProcess(proc);
    }

    console.log(chalk.green(`✅ Stopped ${processes.length} processes`));
  }

  async stopRepositories(repositories: string[]): Promise<void> {
    console.log(chalk.yellow(`\n🛑 Stopping processes for: ${repositories.join(', ')}`));

    let stoppedCount = 0;

    for (const repo of repositories) {
      const processes = Array.from(this.runningProcesses.values())
        .filter(proc => proc.repo === repo);

      for (const proc of processes) {
        await this.stopProcess(proc);
        stoppedCount++;
      }
    }

    if (stoppedCount === 0) {
      console.log(chalk.gray("No running processes found for specified repositories."));
    } else {
      console.log(chalk.green(`✅ Stopped ${stoppedCount} processes`));
    }
  }

  private async stopProcess(proc: RunningProcess): Promise<void> {
    console.log(chalk.gray(`Stopping ${proc.repo} (${proc.command}) - PID: ${proc.pid}`));

    try {
      if (proc.isDockerCompose && proc.composeFile) {
        // For Docker Compose projects, use docker compose stop
        const repoPath = join(this.workspacePath, proc.repo);
        console.log(chalk.blue(`🐳 Using Docker Compose stop for ${proc.repo}`));

        const stopProcess = spawn('docker', ['compose', '-f', proc.composeFile, 'stop'], {
          cwd: repoPath,
          stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
          stopProcess.on('close', (code) => {
            if (code === 0) {
              resolve(void 0);
            } else {
              reject(new Error(`Docker Compose stop failed with code ${code}`));
            }
          });
          stopProcess.on('error', reject);
        });
      } else if (proc.npmUsesDocker) {
        // For npm scripts that use Docker Compose, stop the Docker services
        const repoPath = join(this.workspacePath, proc.repo);
        const composeFile = proc.composeFile || 'docker-compose.yml';

        console.log(chalk.blue(`🐳 Stopping Docker services started by npm script in ${proc.repo}`));

        // First try to stop gracefully
        const stopArgs = ['compose', '-f', composeFile, 'stop'];
        if (proc.dockerServices && proc.dockerServices.length > 0) {
          stopArgs.push(...proc.dockerServices);
        }

        const stopProcess = spawn('docker', stopArgs, {
          cwd: repoPath,
          stdio: 'inherit'
        });

        await new Promise((resolve) => {
          stopProcess.on('close', () => {
            // Also kill the npm process
            try {
              proc.process.kill('SIGTERM');
            } catch {
              // Process might already be dead
            }
            resolve(void 0);
          });
          stopProcess.on('error', () => {
            // If docker stop fails, still try to kill the npm process
            try {
              proc.process.kill('SIGTERM');
            } catch {
              // Process might already be dead
            }
            resolve(void 0);
          });
        });
      } else {
        // For regular processes, use SIGTERM
        proc.process.kill('SIGTERM');

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Force kill if still running
        if (!proc.process.killed) {
          proc.process.kill('SIGKILL');
        }
      }

      this.runningProcesses.delete(`${proc.repo}-${proc.command}`);
    } catch (error) {
      console.log(chalk.red(`Failed to stop ${proc.repo}: ${error}`));
    }
  }

  async killAll(force = false): Promise<void> {
    console.log(chalk.red(`\n💀 ${force ? 'Force killing' : 'Killing'} all processes...`));

    const processes = Array.from(this.runningProcesses.values());

    if (processes.length === 0) {
      console.log(chalk.gray("No running processes found."));
      return;
    }

    for (const proc of processes) {
      try {
        if (proc.isDockerCompose && proc.composeFile) {
          // For Docker Compose projects, use docker compose down (more forceful than stop)
          const repoPath = join(this.workspacePath, proc.repo);
          console.log(chalk.blue(`🐳 Using Docker Compose down for ${proc.repo}`));

          const killArgs = ['compose', '-f', proc.composeFile, 'down'];
          if (force) {
            killArgs.push('--remove-orphans', '--volumes');
          }

          const killProcess = spawn('docker', killArgs, {
            cwd: repoPath,
            stdio: 'inherit'
          });

          await new Promise((resolve) => {
            killProcess.on('close', () => resolve(void 0));
            killProcess.on('error', () => resolve(void 0)); // Continue even if it fails
          });
        } else if (proc.npmUsesDocker) {
          // For npm scripts that use Docker Compose, use docker compose down
          const repoPath = join(this.workspacePath, proc.repo);
          const composeFile = proc.composeFile || 'docker-compose.yml';

          console.log(chalk.blue(`🐳 Killing Docker services started by npm script in ${proc.repo}`));

          const killArgs = ['compose', '-f', composeFile, 'down'];
          if (force) {
            killArgs.push('--remove-orphans', '--volumes');
          }
          if (proc.dockerServices && proc.dockerServices.length > 0) {
            // For specific services, we can't use 'down' with service names, so use 'stop' then 'rm'
            const stopArgs = ['compose', '-f', composeFile, 'stop', ...proc.dockerServices];
            const rmArgs = ['compose', '-f', composeFile, 'rm', '-f', ...proc.dockerServices];

            const stopProcess = spawn('docker', stopArgs, { cwd: repoPath, stdio: 'inherit' });
            await new Promise((resolve) => {
              stopProcess.on('close', () => resolve(void 0));
              stopProcess.on('error', () => resolve(void 0));
            });

            const rmProcess = spawn('docker', rmArgs, { cwd: repoPath, stdio: 'inherit' });
            await new Promise((resolve) => {
              rmProcess.on('close', () => resolve(void 0));
              rmProcess.on('error', () => resolve(void 0));
            });
          } else {
            const killProcess = spawn('docker', killArgs, {
              cwd: repoPath,
              stdio: 'inherit'
            });

            await new Promise((resolve) => {
              killProcess.on('close', () => resolve(void 0));
              killProcess.on('error', () => resolve(void 0));
            });
          }

          // Also kill the npm process
          try {
            proc.process.kill(force ? 'SIGKILL' : 'SIGTERM');
          } catch {
            // Process might already be dead
          }
        } else {
          // For regular processes, use SIGKILL or SIGTERM
          proc.process.kill(force ? 'SIGKILL' : 'SIGTERM');
        }

        this.runningProcesses.delete(`${proc.repo}-${proc.command}`);
      } catch (error) {
        console.log(chalk.red(`Failed to kill ${proc.repo}: ${error}`));
      }
    }

    console.log(chalk.green(`✅ Killed ${processes.length} processes`));
  }

  async showStatus(): Promise<void> {
    console.log(chalk.cyan("\n📊 Process Status"));
    console.log(chalk.gray("═".repeat(50)));

    const processes = Array.from(this.runningProcesses.values());

    if (processes.length === 0) {
      console.log(chalk.gray("No running processes."));
      return;
    }

    for (const proc of processes) {
      const uptime = Date.now() - proc.startTime.getTime();
      const uptimeStr = this.formatUptime(uptime);

      console.log(chalk.green(`✅ ${proc.repo}`));
      console.log(chalk.gray(`   Command: ${proc.command}`));
      console.log(chalk.gray(`   PID: ${proc.pid}`));
      console.log(chalk.gray(`   Uptime: ${uptimeStr}`));
      if (proc.isDockerCompose) {
        console.log(chalk.gray(`   🐳 Docker Compose: ${proc.composeFile}`));
      }
      if (proc.npmUsesDocker) {
        console.log(chalk.gray(`   🐳 NPM uses Docker: ${proc.composeFile || 'docker-compose.yml'}`));
        if (proc.dockerServices && proc.dockerServices.length > 0) {
          console.log(chalk.gray(`   🐳 Services: ${proc.dockerServices.join(', ')}`));
        }
      }
      console.log(chalk.gray(`   Logs: ${proc.logFile}`));
      console.log();
    }
  }

  async showLogs(repo: string, follow = false): Promise<void> {
    const processes = Array.from(this.runningProcesses.values())
      .filter(proc => proc.repo === repo);

    if (processes.length === 0) {
      console.log(chalk.yellow(`⚠️  No running processes found for ${repo}`));
      return;
    }

    const proc = processes[0]!; // We know it exists from the length check

    console.log(chalk.cyan(`\n📋 Logs for ${repo} (${proc.command})`));

    if (proc.isDockerCompose && proc.composeFile) {
      console.log(chalk.gray(`🐳 Docker Compose: ${proc.composeFile}`));
      console.log(chalk.gray("─".repeat(50)));

      // For Docker Compose, show container logs
      const repoPath = join(this.workspacePath, proc.repo);

      if (follow) {
        const logsProcess = spawn('docker', ['compose', '-f', proc.composeFile, 'logs', '-f'], {
          cwd: repoPath,
          stdio: 'inherit'
        });

        process.on('SIGINT', () => {
          logsProcess.kill();
          process.exit(0);
        });
      } else {
        const logsProcess = spawn('docker', ['compose', '-f', proc.composeFile, 'logs', '--tail=50'], {
          cwd: repoPath,
          stdio: 'inherit'
        });

        await new Promise((resolve) => {
          logsProcess.on('close', resolve);
        });
      }
    } else if (proc.npmUsesDocker) {
      const composeFile = proc.composeFile || 'docker-compose.yml';
      console.log(chalk.gray(`🐳 NPM uses Docker: ${composeFile}`));
      if (proc.dockerServices && proc.dockerServices.length > 0) {
        console.log(chalk.gray(`🐳 Services: ${proc.dockerServices.join(', ')}`));
      }
      console.log(chalk.gray("─".repeat(50)));

      // Show Docker logs for npm-started services
      const repoPath = join(this.workspacePath, proc.repo);

      const logsArgs = ['compose', '-f', composeFile, 'logs'];
      if (follow) {
        logsArgs.push('-f');
      } else {
        logsArgs.push('--tail=50');
      }

      if (proc.dockerServices && proc.dockerServices.length > 0) {
        logsArgs.push(...proc.dockerServices);
      }

      if (follow) {
        const logsProcess = spawn('docker', logsArgs, {
          cwd: repoPath,
          stdio: 'inherit'
        });

        process.on('SIGINT', () => {
          logsProcess.kill();
          process.exit(0);
        });
      } else {
        const logsProcess = spawn('docker', logsArgs, {
          cwd: repoPath,
          stdio: 'inherit'
        });

        await new Promise((resolve) => {
          logsProcess.on('close', resolve);
        });
      }
    } else {
      console.log(chalk.gray(`Log file: ${proc.logFile}`));
      console.log(chalk.gray("─".repeat(50)));

      if (follow) {
        // Follow logs in real-time
        const tail = spawn('tail', ['-f', proc.logFile], { stdio: 'inherit' });

        process.on('SIGINT', () => {
          tail.kill();
          process.exit(0);
        });
      } else {
        // Show last 50 lines
        try {
          const content = await fs.readFile(proc.logFile, 'utf-8');
          const lines = content.split('\n').slice(-50);
          console.log(lines.join('\n'));
        } catch (error) {
          console.log(chalk.red(`Failed to read log file: ${error}`));
        }
      }
    }
  }

  async getRunningProcesses(): Promise<RunningProcess[]> {
    return Array.from(this.runningProcesses.values());
  }

  async listRepositories(detailed = false): Promise<void> {
    console.log(chalk.cyan("\n📂 Available Repositories"));
    console.log(chalk.gray("═".repeat(50)));

    try {
      // Get all directories in workspace
      const entries = await fs.readdir(this.workspacePath, { withFileTypes: true });
      const repositories = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name);

      if (repositories.length === 0) {
        console.log(chalk.yellow("No repositories found in workspace."));
        console.log(chalk.gray(`Workspace path: ${this.workspacePath}`));
        return;
      }

      console.log(chalk.gray(`Workspace: ${this.workspacePath}`));
      console.log(chalk.gray(`Found ${repositories.length} repositories:\n`));

      // Get running processes for status
      const runningProcesses = Array.from(this.runningProcesses.values());

      for (const repo of repositories) {
        const repoPath = join(this.workspacePath, repo);
        const runningProcs = runningProcesses.filter((proc) => proc.repo === repo);

        // Basic repository info
        console.log(chalk.white(`📦 ${repo}`));

        // Show running status
        if (runningProcs.length > 0) {
          console.log(chalk.green(`   Status: Running (${runningProcs.length} process${runningProcs.length > 1 ? 'es' : ''})`));
          for (const proc of runningProcs) {
            const uptime = Date.now() - proc.startTime.getTime();
            const uptimeStr = this.formatUptime(uptime);
            console.log(chalk.gray(`   • ${proc.command} (PID: ${proc.pid}, uptime: ${uptimeStr})`));
          }
        } else {
          console.log(chalk.gray("   Status: Stopped"));
        }

        if (detailed) {
          await this.showDetailedRepoInfo(repo, repoPath);
        }

        console.log(); // Empty line between repositories
      }

      // Summary
      const runningCount = repositories.filter((repo) =>
        runningProcesses.some((proc) => proc.repo === repo)
      ).length;

      console.log(chalk.cyan("📊 Summary:"));
      console.log(chalk.gray(`   Total repositories: ${repositories.length}`));
      console.log(chalk.gray(`   Running: ${runningCount}`));
      console.log(chalk.gray(`   Stopped: ${repositories.length - runningCount}`));

    } catch (error) {
      console.log(chalk.red(`❌ Failed to list repositories: ${error}`));
    }
  }

  private async showDetailedRepoInfo(_repo: string, repoPath: string): Promise<void> {
    try {
      // Check for package.json
      const packageJsonPath = join(repoPath, "package.json");
      try {
        await fs.access(packageJsonPath);
        const packageContent = await fs.readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageContent);

        console.log(chalk.gray(`   Description: ${packageJson.description || "No description"}`));
        console.log(chalk.gray(`   Version: ${packageJson.version || "Unknown"}`));

        // Show available scripts
        if (packageJson.scripts) {
          const scripts = Object.keys(packageJson.scripts);
          const commonScripts = scripts.filter((script) =>
            ["dev", "start", "build", "test", "lint"].includes(script)
          );
          if (commonScripts.length > 0) {
            console.log(chalk.gray(`   Scripts: ${commonScripts.join(", ")}`));
          }
        }
      } catch {
        console.log(chalk.gray("   Type: Non-Node.js project"));
      }

      // Check for Docker Compose
      const dockerInfo = await this.detectDockerCompose(repoPath);
      if (dockerInfo.isDockerCompose) {
        console.log(chalk.gray(`   🐳 Docker Compose: ${dockerInfo.composeFile}`));
      }

      // Check for Git
      try {
        await fs.access(join(repoPath, ".git"));
        console.log(chalk.gray("   📋 Git repository"));
      } catch {
        console.log(chalk.gray("   📋 Not a Git repository"));
      }

    } catch (error) {
      console.log(chalk.gray(`   ❌ Error reading repository info: ${error}`));
    }
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
