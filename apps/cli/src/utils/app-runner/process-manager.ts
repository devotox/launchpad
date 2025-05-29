import { spawn } from 'node:child_process';
import { createWriteStream, promises as fs, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

import chalk from 'chalk';

import type {
  RunOptions,
  RunningProcess,
  RunSingleCommandParams,
  HandleProcessStreamsParams
} from './types';

export class ProcessManager {
  private runningProcesses: Map<string, RunningProcess> = new Map();
  private logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  async runParallel(promises: Promise<void>[], command: string, count: number): Promise<void> {
    console.log(chalk.cyan(`\n🔄 Running '${command}' in parallel on ${count} repositories...\n`));

    try {
      await Promise.all(promises);
      console.log(chalk.green(`\n✅ All repositories completed '${command}' successfully!`));
    } catch (error) {
      console.log(chalk.red(`\n❌ Some repositories failed to complete '${command}'`));
      console.log(
        chalk.gray(`Error details: ${error instanceof Error ? error.message : String(error)}`)
      );
    }
  }

  async runSequential(
    repositories: string[],
    runFunc: (repo: string) => Promise<void>,
    command: string
  ): Promise<void> {
    console.log(
      chalk.cyan(
        `\n🔄 Running '${command}' sequentially on ${repositories.length} repositories...\n`
      )
    );

    for (const repo of repositories) {
      try {
        await runFunc(repo);
        console.log(chalk.green(`✅ Completed '${command}' for ${repo}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed '${command}' for ${repo}`));
        console.log(chalk.gray(`Error: ${error instanceof Error ? error.message : String(error)}`));
        console.log(chalk.yellow('⚠️  Continuing with next repository...'));
      }
    }
  }

  async runSingleCommand(params: RunSingleCommandParams): Promise<void> {
    const { actualCommand, repo, repoPath, command, options, dockerInfo, npmDockerInfo } = params;
    // Check if repository exists
    try {
      await fs.access(repoPath);
    } catch {
      throw new Error(`Repository '${repo}' not found at ${repoPath}`);
    }

    // --- Node version detection logic ---
    let requiredNodeVersion: string | undefined;
    const nvmrcPath = join(repoPath, '.nvmrc');
    const nodeVersionPath = join(repoPath, '.node-version');
    const packageJsonPath = join(repoPath, 'package.json');
    if (existsSync(nvmrcPath)) {
      requiredNodeVersion = (await fs.readFile(nvmrcPath, 'utf-8')).trim();
    } else if (existsSync(nodeVersionPath)) {
      requiredNodeVersion = (await fs.readFile(nodeVersionPath, 'utf-8')).trim();
    } else if (existsSync(packageJsonPath)) {
      try {
        const pkgRaw = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg: unknown = JSON.parse(pkgRaw);
        if (typeof pkg === 'object' && pkg !== null && 'engines' in pkg && typeof (pkg as any).engines === 'object' && (pkg as any).engines !== null && 'node' in (pkg as any).engines) {
          requiredNodeVersion = (pkg as any).engines.node;
        }
      } catch {}
    }

    // Detect available Node version managers
    let nodeManager: 'nvm' | 'volta' | 'fnm' | undefined;
    try { execSync('command -v nvm', { stdio: 'ignore', shell: true }); nodeManager = 'nvm'; } catch {}
    if (!nodeManager) { try { execSync('command -v volta', { stdio: 'ignore', shell: true }); nodeManager = 'volta'; } catch {} }
    if (!nodeManager) { try { execSync('command -v fnm', { stdio: 'ignore', shell: true }); nodeManager = 'fnm'; } catch {} }

    // --- End Node version detection logic ---

    const logFile = join(this.logDir, `${repo}-${command}-${Date.now()}.log`);

    console.log(chalk.blue(`📦 ${repo}: ${actualCommand.join(' ')}`));
    if (dockerInfo.isDockerCompose) {
      console.log(chalk.gray(`   🐳 Docker Compose detected: ${dockerInfo.composeFile}`));
    }
    if (npmDockerInfo.usesDocker) {
      console.log(
        chalk.gray(`   🐳 NPM script uses Docker Compose: ${npmDockerInfo.dockerCommand}`)
      );
    }

    return new Promise((resolve, reject) => {
      let spawnCommand = actualCommand[0] ?? 'node';
      let spawnArgs = actualCommand.slice(1);
      const spawnEnv = {
        ...process.env,
        NODE_ENV: options.environment,
        ENVIRONMENT: options.environment,
        ENV: options.environment
      };

      // If a required Node version is found and a manager is available, wrap the command
      if (requiredNodeVersion && nodeManager) {
        console.log(chalk.cyan(`🔢 Using Node version ${requiredNodeVersion} via ${nodeManager}`));
        if (nodeManager === 'nvm') {
          spawnCommand = 'nvm';
          spawnArgs = ['exec', requiredNodeVersion, ...actualCommand];
        } else if (nodeManager === 'volta') {
          spawnCommand = 'volta';
          spawnArgs = ['run', `--node=${requiredNodeVersion}`, ...actualCommand];
        } else if (nodeManager === 'fnm') {
          spawnCommand = 'fnm';
          spawnArgs = ['exec', requiredNodeVersion, ...actualCommand];
        }
      } else if (requiredNodeVersion) {
        console.log(chalk.yellow(`⚠️  Required Node version ${requiredNodeVersion} detected, but no Node version manager (nvm, volta, fnm) found in PATH. Using current Node version: ${process.version}`));
      }

      const childProcess = spawn(spawnCommand, spawnArgs, {
        cwd: repoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: spawnEnv
      });

      const runningProcess: RunningProcess = {
        repo,
        command,
        pid: childProcess?.pid || 0,
        process: childProcess,
        startTime: new Date(),
        logFile,
        isDockerCompose: dockerInfo.isDockerCompose,
        composeFile: dockerInfo.composeFile,
        npmUsesDocker: npmDockerInfo.usesDocker,
        dockerServices: npmDockerInfo.services
      };

      this.runningProcesses.set(`${repo}-${command}`, runningProcess);
      this.handleProcessStreams({
        childProcess,
        repo,
        logFile,
        command,
        options,
        resolve,
        reject
      });
    });
  }

  private handleProcessStreams(params: HandleProcessStreamsParams): void {
    const { childProcess, repo, logFile, command, options, resolve, reject } = params;
    const logStream = createWriteStream(logFile);

    // Handle stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      logStream.write(`[STDOUT] ${output}`);

      if (this.isLongRunningCommand(command, options)) {
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
        if (!this.isLongRunningCommand(command, options)) {
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
    if (this.isLongRunningCommand(command, options)) {
      setTimeout(() => {
        console.log(chalk.green(`🚀 ${repo}: ${command} started (PID: ${childProcess?.pid})`));
        resolve();
      }, 1000);
    }
  }

  private isLongRunningCommand(command: string, options?: RunOptions): boolean {
    const longRunningCommands = ['dev', 'start', 'serve', 'watch'];
    // Watch mode makes any command long-running
    if (options?.watch) {
      return true;
    }
    return longRunningCommands.includes(command);
  }

  async stopAll(): Promise<void> {
    const processes = Array.from(this.runningProcesses.values());
    if (processes.length === 0) {
      console.log(chalk.yellow('No running processes to stop.'));
      return;
    }

    console.log(chalk.cyan(`\n🛑 Stopping ${processes.length} running process(es)...\n`));

    const stopPromises = processes.map(async (proc) => this.stopProcess(proc));
    await Promise.allSettled(stopPromises);

    console.log(chalk.green('✅ All processes stopped.'));
  }

  async stopRepositories(repositories: string[]): Promise<void> {
    const processes = Array.from(this.runningProcesses.values()).filter((proc) =>
      repositories.includes(proc.repo)
    );

    if (processes.length === 0) {
      console.log(chalk.yellow('No matching running processes to stop.'));
      return;
    }

    console.log(chalk.cyan(`\n🛑 Stopping ${processes.length} process(es)...\n`));

    const stopPromises = processes.map(async (proc) => this.stopProcess(proc));
    await Promise.allSettled(stopPromises);

    console.log(chalk.green('✅ Selected processes stopped.'));
  }

  private async stopProcess(proc: RunningProcess): Promise<void> {
    try {
      if (proc.isDockerCompose || proc.npmUsesDocker) {
        await this.stopDockerComposeProcess(proc);
      } else {
        await this.stopRegularProcess(proc);
      }
    } catch (error) {
      console.log(
        chalk.red(
          `❌ Failed to stop ${proc.repo}: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async stopDockerComposeProcess(proc: RunningProcess): Promise<void> {
    const composeFile = proc.composeFile || 'docker-compose.yml';

    return new Promise((resolve, reject) => {
      console.log(chalk.blue(`🐳 ${proc.repo}: Stopping Docker Compose services...`));

      const stopProcess = spawn('docker', ['compose', '-f', composeFile, 'stop'], {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      stopProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      stopProcess.stderr.on('data', (data) => {
        console.log(chalk.red(`${proc.repo}: ${data.toString().trim()}`));
      });

      stopProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green(`✅ ${proc.repo}: Docker Compose stopped`));
          // Also kill the original npm process if it exists
          if (proc.process && !proc.process.killed) {
            proc.process.kill('SIGTERM');
          }
          resolve();
        } else {
          reject(new Error(`Docker stop failed with code ${code}`));
        }
      });

      stopProcess.on('error', reject);
    });
  }

  private async stopRegularProcess(proc: RunningProcess): Promise<void> {
    return new Promise((resolve) => {
      console.log(chalk.blue(`🛑 ${proc.repo}: Stopping process (PID: ${proc.pid})...`));

      if (proc.process.killed) {
        console.log(chalk.gray(`${proc.repo}: Process already stopped`));
        resolve();
        return;
      }

      // Set up timeout for forceful kill
      const timeout = setTimeout(() => {
        if (!proc.process.killed) {
          console.log(chalk.yellow(`⚠️  ${proc.repo}: Force killing process...`));
          proc.process.kill('SIGKILL');
        }
      }, 5000);

      proc.process.on('exit', () => {
        clearTimeout(timeout);
        console.log(chalk.green(`✅ ${proc.repo}: Process stopped`));
        resolve();
      });

      // Attempt graceful shutdown first
      proc.process.kill('SIGTERM');
    });
  }

  async killAll(force = false): Promise<void> {
    const processes = Array.from(this.runningProcesses.values());
    if (processes.length === 0) {
      console.log(chalk.yellow('No running processes to kill.'));
      return;
    }

    console.log(
      chalk.red(`\n💀 ${force ? 'Force ' : ''}Killing ${processes.length} running process(es)...\n`)
    );

    for (const proc of processes) {
      try {
        const signal = force ? 'SIGKILL' : 'SIGTERM';
        console.log(
          chalk.red(`💀 ${proc.repo}: Killing process (PID: ${proc.pid}) with ${signal}...`)
        );

        if (!proc.process.killed) {
          proc.process.kill(signal);
        }

        // Clean up from our tracking
        this.runningProcesses.delete(`${proc.repo}-${proc.command}`);

        console.log(chalk.green(`✅ ${proc.repo}: Process killed`));
      } catch (error) {
        console.log(
          chalk.red(
            `❌ Failed to kill ${proc.repo}: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }

    console.log(chalk.green('✅ All processes killed.'));
  }

  async showStatus(): Promise<void> {
    const processes = Array.from(this.runningProcesses.values());

    console.log(chalk.cyan('\n🚀 Application Status'));
    console.log(chalk.gray('═'.repeat(35)));

    if (processes.length === 0) {
      console.log(chalk.yellow('📭 No running processes'));
      console.log('');
      console.log(chalk.cyan('⚡ Quick Actions'));
      console.log(chalk.gray('─'.repeat(15)));
      console.log(`   ${chalk.white('launchpad app dev --all')}     - Start all repositories`);
      console.log(`   ${chalk.white('launchpad app start -r <repo>')} - Start specific repository`);
      console.log('');
      return;
    }

    // Summary
    const runningCount = processes.filter(p => !p.process.killed).length;
    const stoppedCount = processes.length - runningCount;
    const dockerCount = processes.filter(p => p.isDockerCompose).length;

    console.log(chalk.white(`📊 Summary: ${chalk.green(runningCount)} running, ${chalk.red(stoppedCount)} stopped`));
    console.log(chalk.white(`🐳 Docker Compose: ${chalk.blue(dockerCount)} services`));
    console.log('');

    // Group by status
    const runningProcesses = processes.filter(p => !p.process.killed);
    const stoppedProcesses = processes.filter(p => p.process.killed);

    // Show running processes
    if (runningProcesses.length > 0) {
      console.log(chalk.cyan('🟢 Running Processes'));
      console.log(chalk.gray('─'.repeat(20)));

      for (const proc of runningProcesses) {
        const uptime = Date.now() - proc.startTime.getTime();
        const typeIcon = proc.isDockerCompose ? '🐳' : '⚡';

        console.log(`   ${typeIcon} ${chalk.white(proc.repo)} ${chalk.gray(`(${proc.command})`)}`);
        console.log(`      ${chalk.gray('PID:')} ${chalk.yellow(proc.pid)}`);
        console.log(`      ${chalk.gray('Uptime:')} ${chalk.green(this.formatUptime(uptime))}`);

        if (proc.isDockerCompose) {
          console.log(`      ${chalk.gray('Compose:')} ${chalk.blue(proc.composeFile)}`);
          if (proc.dockerServices && proc.dockerServices.length > 0) {
            console.log(`      ${chalk.gray('Services:')} ${chalk.cyan(proc.dockerServices.join(', '))}`);
          }
        }

        console.log(`      ${chalk.gray('Logs:')} ${chalk.gray(proc.logFile)}`);
        console.log('');
      }
    }

    // Show stopped processes
    if (stoppedProcesses.length > 0) {
      console.log(chalk.cyan('🔴 Stopped Processes'));
      console.log(chalk.gray('─'.repeat(20)));

      for (const proc of stoppedProcesses) {
        const typeIcon = proc.isDockerCompose ? '🐳' : '⚡';

        console.log(`   ${typeIcon} ${chalk.white(proc.repo)} ${chalk.gray(`(${proc.command})`)}`);
        console.log(`      ${chalk.gray('Status:')} ${chalk.red('Stopped')}`);
        console.log(`      ${chalk.gray('Last PID:')} ${chalk.yellow(proc.pid)}`);
        console.log(`      ${chalk.gray('Logs:')} ${chalk.gray(proc.logFile)}`);
        console.log('');
      }
    }

    // Quick actions
    console.log(chalk.cyan('⚡ Quick Actions'));
    console.log(chalk.gray('─'.repeat(15)));
    console.log(`   ${chalk.white('launchpad app stop --all')}     - Stop all processes`);
    console.log(`   ${chalk.white('launchpad app logs -r <repo>')} - View logs`);
    console.log(`   ${chalk.white('launchpad app kill')}           - Force kill all`);
    console.log('');
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

  getRunningProcesses(): RunningProcess[] {
    return Array.from(this.runningProcesses.values());
  }
}
