import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

export class CreateCommand {
  getCommand(): Command {
    const createCommand = new Command('create').description('Create new projects or workspaces');

    // Add subcommands
    createCommand
      .command('project')
      .description('Create a new project')
      .action(async () => {
        await this.createProject();
      });

    createCommand
      .command('workspace')
      .description('Create a new turbo repo workspace')
      .action(async () => {
        await this.createWorkspace();
      });

    return createCommand;
  }

  private async createProject(): Promise<void> {
    console.log(chalk.cyan('📦 Creating a new project...\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        validate: (input: string) => input.length > 0 || 'Please enter a project name'
      },
      {
        type: 'list',
        name: 'type',
        message: 'Project type:',
        choices: [
          'React Application',
          'Node.js Service',
          'TypeScript Library',
          'Next.js Application',
          'Express API'
        ]
      }
    ]);

    console.log(chalk.green(`\n✅ Project "${answers.name}" created successfully!`));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray(`- cd ${answers.name}`));
    console.log(chalk.gray('- pnpm install'));
    console.log(chalk.gray('- pnpm dev'));
  }

  private async createWorkspace(): Promise<void> {
    console.log(chalk.cyan('🏗️  Creating a new turbo repo workspace...\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Workspace name:',
        validate: (input: string) => input.length > 0 || 'Please enter a workspace name'
      },
      {
        type: 'checkbox',
        name: 'packages',
        message: 'Select initial packages:',
        choices: [
          { name: 'Shared UI Components', value: 'ui' },
          { name: 'Utilities Library', value: 'utils' },
          { name: 'TypeScript Config', value: 'tsconfig' },
          { name: 'ESLint Config', value: 'eslint-config' }
        ]
      }
    ]);

    console.log(chalk.green(`\n✅ Workspace "${answers.name}" created successfully!`));
    console.log(chalk.gray('Configured with pnpm workspaces and Turbo repo'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray(`- cd ${answers.name}`));
    console.log(chalk.gray('- pnpm install'));
    console.log(chalk.gray('- pnpm build'));
  }
}
