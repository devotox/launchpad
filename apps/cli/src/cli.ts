import chalk from 'chalk';
import { Command } from 'commander';

import { AdminCommand } from '@/commands/admin';
import { AppCommand } from '@/commands/app';
import { CreateCommand } from '@/commands/create';
import { HelpCommand } from '@/commands/help';
import { InitCommand } from '@/commands/init';
import { SetupCommand } from '@/commands/setup';
import { TeamCommand } from '@/commands/team';

export class LaunchpadCLI {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
    this.registerCommands();
  }

  private setupProgram(): void {
    this.program
      .name('launchpad')
      .description('The essential developer onboarding tool for LoveHolidays')
      .version('1.0.0')
      .addHelpText(
        'after',
        `
${chalk.cyan('Examples:')}
  ${chalk.gray('$')} launchpad init
  ${chalk.gray('$')} launchpad setup all --essential-only
  ${chalk.gray('$')} launchpad setup status
  ${chalk.gray('$')} launchpad setup kubernetes
  ${chalk.gray('$')} launchpad setup github
  ${chalk.gray('$')} launchpad setup loveholidays
  ${chalk.gray('$')} launchpad create project
  ${chalk.gray('$')} launchpad create workspace
  ${chalk.gray('$')} launchpad team qr
  ${chalk.gray('$')} launchpad team info
  ${chalk.gray('$')} launchpad team slack
  ${chalk.gray('$')} launchpad app dev --all
  ${chalk.gray('$')} launchpad app start -r aurora mmb
  ${chalk.gray('$')} launchpad app status
  ${chalk.gray('$')} launchpad app stop --all
  ${chalk.gray('$')} launchpad app down --all --volumes
  ${chalk.gray('$')} launchpad admin teams:list
  ${chalk.gray('$')} launchpad admin teams:add
  ${chalk.gray('$')} launchpad admin docs:add
  ${chalk.gray('$')} launchpad help

${chalk.cyan('Quick Start:')}
  ${chalk.gray('1.')} launchpad init                    ${chalk.gray('# Initialize your workspace')}
  ${chalk.gray('2.')} launchpad setup all --essential-only  ${chalk.gray('# Set up essential tools')}
  ${chalk.gray('3.')} launchpad team qr                 ${chalk.gray('# Quick team reference')}
  ${chalk.gray('4.')} launchpad app dev --all           ${chalk.gray('# Start all repos in dev mode')}

${chalk.cyan('Administration:')}
  ${chalk.gray('•')} Use 'launchpad admin' commands to manage teams and configuration
  ${chalk.gray('•')} Add teams with 'launchpad admin teams:add'
  ${chalk.gray('•')} Manage documentation with 'launchpad admin docs:add'
  ${chalk.gray('•')} View config locations with 'launchpad admin info'

${chalk.cyan('Docker Compose Support:')}
  ${chalk.gray('•')} Automatically detects docker-compose.yml files
  ${chalk.gray('•')} Uses appropriate Docker commands for containerized apps
  ${chalk.gray('•')} Supports graceful shutdown with 'stop' and 'down' commands
      `
      );
  }

  private registerCommands(): void {
    // Register init command
    const initCommand = new InitCommand();
    this.program.addCommand(initCommand.getCommand());

    // Register setup command
    const setupCommand = new SetupCommand();
    this.program.addCommand(setupCommand.getCommand());

    // Register create command
    const createCommand = new CreateCommand();
    this.program.addCommand(createCommand.getCommand());

    // Register team command
    const teamCommand = new TeamCommand();
    this.program.addCommand(teamCommand.getCommand());

    // Register app command
    const appCommand = new AppCommand();
    this.program.addCommand(appCommand.getCommand());

    // Register admin command
    const adminCommand = new AdminCommand();
    this.program.addCommand(adminCommand.getCommand());

    // Register help command
    const helpCommand = new HelpCommand();
    this.program.addCommand(helpCommand.getCommand());
  }

  public async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}
