import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { AppRunner } from '@/utils/app-runner';
import { ConfigManager } from '@/utils/config/manager';

type AppCommandOptions = {
  repos?: string[];
  all?: boolean;
  env?: string;
  parallel?: boolean;
  watch?: boolean;
  fix?: boolean;
  volumes?: boolean;
};

type StopOptions = {
  repos?: string[];
  all?: boolean;
};

type LogsOptions = {
  repo?: string;
  follow?: boolean;
};

type KillOptions = {
  force?: boolean;
};

export class AppCommand {
  getCommand(): Command {
    const appCmd = new Command('app').description(
      'Manage and run applications across repositories'
    );

    // Run commands
    appCmd
      .command('run <command>')
      .description('Run a command across repositories')
      .option('-r, --repos <repos...>', 'Specific repositories to run command on')
      .option('-a, --all', 'Run on all repositories')
      .option('-e, --env <environment>', 'Environment (dev, prod, test)', 'dev')
      .option('-p, --parallel', 'Run commands in parallel', false)
      .option('-w, --watch', 'Watch mode (if supported by command)', false)
      .action(async (command, options) => {
        await this.runCommand(command, options);
      });

    // Start services
    appCmd
      .command('start')
      .description('Start development servers for repositories')
      .option('-r, --repos <repos...>', 'Specific repositories to start')
      .option('-a, --all', 'Start all repositories')
      .option('-p, --parallel', 'Start in parallel', true)
      .action(async (options) => {
        await this.runCommand('start', { ...options, env: 'dev' });
      });

    // Development mode
    appCmd
      .command('dev')
      .description('Start development mode for repositories')
      .option('-r, --repos <repos...>', 'Specific repositories to run in dev mode')
      .option('-a, --all', 'Run all repositories in dev mode')
      .option('-p, --parallel', 'Run in parallel', true)
      .action(async (options) => {
        await this.runCommand('dev', { ...options, env: 'dev', watch: true });
      });

    // Build commands
    appCmd
      .command('build')
      .description('Build repositories')
      .option('-r, --repos <repos...>', 'Specific repositories to build')
      .option('-a, --all', 'Build all repositories')
      .option('-e, --env <environment>', 'Build environment (dev, prod)', 'prod')
      .option('-p, --parallel', 'Build in parallel', true)
      .action(async (options) => {
        await this.runCommand('build', options);
      });

    // Test commands
    appCmd
      .command('test')
      .description('Run tests for repositories')
      .option('-r, --repos <repos...>', 'Specific repositories to test')
      .option('-a, --all', 'Test all repositories')
      .option('-w, --watch', 'Watch mode for tests', false)
      .option('-p, --parallel', 'Run tests in parallel', false)
      .action(async (options) => {
        await this.runCommand('test', options);
      });

    // Lint commands
    appCmd
      .command('lint')
      .description('Run linting for repositories')
      .option('-r, --repos <repos...>', 'Specific repositories to lint')
      .option('-a, --all', 'Lint all repositories')
      .option('--fix', 'Auto-fix linting issues', false)
      .option('-p, --parallel', 'Run linting in parallel', true)
      .action(async (options) => {
        await this.runCommand('lint', options);
      });

    // Stop running processes
    appCmd
      .command('stop')
      .description('Stop running processes')
      .option('-r, --repos <repos...>', 'Specific repositories to stop')
      .option('-a, --all', 'Stop all running processes')
      .action(async (options) => {
        await this.stopProcesses(options);
      });

    // Status of running processes
    appCmd
      .command('status')
      .description('Show status of running processes')
      .action(async () => {
        await this.showStatus();
      });

    // Logs from running processes
    appCmd
      .command('logs')
      .description('Show logs from running processes')
      .option('-r, --repo <repo>', 'Show logs for specific repository')
      .option('-f, --follow', 'Follow logs in real-time', false)
      .action(async (options) => {
        await this.showLogs(options);
      });

    // Kill all processes
    appCmd
      .command('kill')
      .description('Kill all running processes')
      .option('--force', 'Force kill processes', false)
      .action(async (options) => {
        await this.killProcesses(options);
      });

    // List available repositories
    appCmd
      .command('list')
      .description('List all available repositories in the workspace')
      .option('--detailed', 'Show detailed repository information', false)
      .action(async (options) => {
        await this.listRepositories(options.detailed);
      });

    // Docker Compose down command
    appCmd
      .command('down')
      .description('Stop and remove Docker Compose containers, networks, and volumes')
      .option('-r, --repos <repos...>', 'Specific repositories to run down on')
      .option('-a, --all', 'Run down on all repositories')
      .option('--volumes', 'Remove volumes as well', false)
      .action(async (options) => {
        await this.runCommand('down', options);
      });

    return appCmd;
  }

  async runCommand(command: string, options: AppCommandOptions): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    const appRunner = new AppRunner(config.workspace.path);

    // Determine which repositories to run on
    let targetRepos: string[] = [];

    if (options.all) {
      targetRepos = config.workspace.repositories;
    } else if (options.repos) {
      targetRepos = options.repos;
    } else {
      // Interactive selection
      if (config.workspace.repositories.length === 0) {
        console.log(chalk.yellow('⚠️  No repositories found in workspace.'));
        console.log(chalk.gray("Run 'launchpad init' to set up repositories."));
        return;
      }

      const { selectedRepos } = await inquirer.prompt<{ selectedRepos: string[] }>({
        type: 'checkbox',
        name: 'selectedRepos',
        message: `Select repositories to run '${command}' on:`,
        choices: config.workspace.repositories.map((repo) => ({
          name: repo,
          value: repo,
          checked: false
        }))
      });

      if (selectedRepos.length === 0) {
        console.log(chalk.yellow('⚠️  No repositories selected.'));
        return;
      }

      targetRepos = selectedRepos;
    }

    if (targetRepos.length === 0) {
      console.log(chalk.yellow('⚠️  No repositories selected.'));
      return;
    }

    console.log(chalk.cyan(`\n🚀 Running '${command}' on ${targetRepos.length} repositories...`));
    console.log(chalk.gray(`Environment: ${options.env || 'dev'}`));
    console.log(chalk.gray(`Parallel: ${options.parallel ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`Repositories: ${targetRepos.join(', ')}`));

    await appRunner.runCommand(command, targetRepos, {
      environment: options.env || 'dev',
      parallel: options.parallel || false,
      watch: options.watch || false,
      fix: options.fix || false
    });
  }

  async stopProcesses(options: StopOptions): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red('❌ No configuration found.'));
      return;
    }

    const appRunner = new AppRunner(config.workspace.path);

    if (options.all) {
      await appRunner.stopAll();
    } else if (options.repos) {
      await appRunner.stopRepositories(options.repos);
    } else {
      // Interactive selection of running processes
      const runningProcesses = await appRunner.getRunningProcesses();

      if (runningProcesses.length === 0) {
        console.log(chalk.yellow('⚠️  No running processes found.'));
        return;
      }

      const { selectedProcesses } = await inquirer.prompt<{ selectedProcesses: string[] }>({
        type: 'checkbox',
        name: 'selectedProcesses',
        message: 'Select processes to stop:',
        choices: runningProcesses.map((proc) => ({
          name: `${proc.repo} (${proc.command}) - PID: ${proc.pid}`,
          value: proc.repo
        }))
      });

      if (selectedProcesses.length > 0) {
        await appRunner.stopRepositories(selectedProcesses);
      }
    }
  }

  async showStatus(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red('❌ No configuration found.'));
      return;
    }

    const appRunner = new AppRunner(config.workspace.path);
    await appRunner.showStatus();
  }

  async showLogs(options: LogsOptions): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red('❌ No configuration found.'));
      return;
    }

    const appRunner = new AppRunner(config.workspace.path);

    if (options.repo) {
      await appRunner.showLogs(options.repo, options.follow);
    } else {
      // Interactive selection
      const runningProcesses = await appRunner.getRunningProcesses();

      if (runningProcesses.length === 0) {
        console.log(chalk.yellow('⚠️  No running processes found.'));
        return;
      }

      const { selectedRepo } = await inquirer.prompt<{ selectedRepo: string }>({
        type: 'list',
        name: 'selectedRepo',
        message: 'Select repository to view logs:',
        choices: runningProcesses.map((proc) => ({
          name: `${proc.repo} (${proc.command})`,
          value: proc.repo
        }))
      });

      await appRunner.showLogs(selectedRepo, options.follow);
    }
  }

  async killProcesses(options: KillOptions): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red('❌ No configuration found.'));
      return;
    }

    const appRunner = new AppRunner(config.workspace.path);
    await appRunner.killAll(options.force);
  }

  async listRepositories(detailed: boolean): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red('❌ No configuration found.'));
      return;
    }

    const appRunner = new AppRunner(config.workspace.path);
    await appRunner.listRepositories(detailed);
  }
}
