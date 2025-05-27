import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { DataManager } from '@/utils/config';

export class DocsCommand {
  getCommand(): Command {
    const docsCmd = new Command('docs')
      .description('Manage global onboarding documentation');

    docsCmd
      .command('list')
      .description('List all global documentation')
      .action(async () => {
        await this.listDocs();
      });

    docsCmd
      .command('add')
      .description('Add a new global documentation link')
      .action(async () => {
        await this.addDoc();
      });

    // Interactive management mode
    docsCmd
      .action(async () => {
        await this.manageDocs();
      });

    return docsCmd;
  }

  private async manageDocs(): Promise<void> {
    console.log(chalk.cyan('\n📚 Global Documentation Management'));
    console.log(chalk.gray('─'.repeat(40)));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Add new documentation link', value: 'add' },
          { name: 'List all documentation', value: 'list' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'add':
        await this.addDoc();
        break;
      case 'list':
        await this.listDocs();
        break;
    }
  }

  private async addDoc(): Promise<void> {
    console.log(chalk.cyan('\n➕ Add Global Documentation Link'));
    console.log(chalk.gray('─'.repeat(35)));

    const { url } = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Documentation URL:',
        validate: (input: string) => {
          if (!input.trim()) return 'URL is required';
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      }
    ]);

    const dataManager = DataManager.getInstance();
    const docs = await dataManager.getGlobalOnboardingDocs();

    if (docs.includes(url)) {
      console.log(chalk.yellow('⚠️  Documentation URL already exists.'));
      return;
    }

    docs.push(url);
    await dataManager.updateGlobalOnboardingDocs(docs);
    console.log(chalk.green('✅ Documentation link added successfully!'));
  }

  private async listDocs(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const docs = await dataManager.getGlobalOnboardingDocs();

    console.log(chalk.cyan('\n📚 Global Onboarding Documentation'));
    console.log(chalk.gray('─'.repeat(40)));

    if (docs.length === 0) {
      console.log(chalk.yellow('No global documentation links found.'));
      return;
    }

    docs.forEach((doc, index) => {
      console.log(chalk.white(`${index + 1}. ${doc}`));
    });
  }
}
