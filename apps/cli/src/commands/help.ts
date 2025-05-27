import chalk from 'chalk';
import { Command } from 'commander';

export class HelpCommand {
  getCommand(): Command {
    return new Command('help').description('Show detailed help and resources').action(() => {
      this.showHelp();
    });
  }

  private showHelp(): void {
    console.log(chalk.cyan.bold('\n🚀 LoveHolidays Launchpad CLI\n'));

    console.log(chalk.yellow('Available Commands:'));
    console.log(chalk.gray('  init           Initialize your developer workspace'));
    console.log(chalk.gray('  create project Create a new project'));
    console.log(chalk.gray('  create workspace Create a new turbo repo workspace'));
    console.log(chalk.gray('  help           Show this help message\n'));

    console.log(chalk.yellow('Resources:'));
    console.log(chalk.gray('  📚 Documentation: https://docs.loveholidays.com'));
    console.log(chalk.gray('  💬 Slack: #engineering-support'));
    console.log(chalk.gray('  🎯 Jira: https://loveholidays.atlassian.net'));
    console.log(chalk.gray('  📖 Confluence: https://loveholidays.atlassian.net/wiki\n'));

    console.log(chalk.yellow('Getting Started:'));
    console.log(chalk.gray('  1. Run "launchpad init" to set up your workspace'));
    console.log(chalk.gray('  2. Use "launchpad create project" to start building'));
    console.log(chalk.gray('  3. Check our docs for best practices and guidelines\n'));

    console.log(chalk.green('Welcome to the LoveHolidays engineering team! 🎉'));
  }
}
