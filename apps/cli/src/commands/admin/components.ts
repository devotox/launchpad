import chalk from 'chalk';
import { Command } from 'commander';

import { DataManager } from '@/utils/config';

export class ComponentsCommand {
  getCommand(): Command {
    const componentsCmd = new Command('components')
      .description('Manage setup components');

    componentsCmd
      .command('list')
      .description('List all setup components')
      .action(async () => {
        await this.listComponents();
      });

    componentsCmd
      .command('add')
      .description('Add a new setup component')
      .action(async () => {
        await this.addComponent();
      });

    // Interactive management mode
    componentsCmd
      .action(async () => {
        await this.manageComponents();
      });

    return componentsCmd;
  }

  private async manageComponents(): Promise<void> {
    console.log(chalk.cyan('\n🔧 Setup Components Management'));
    console.log(chalk.gray('─'.repeat(35)));
    console.log(chalk.yellow('Component management functionality is not yet implemented.'));
    console.log(chalk.gray('This feature will allow you to manage setup components for the CLI.'));
  }

  private async addComponent(): Promise<void> {
    console.log(chalk.cyan('\n➕ Add New Setup Component'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.yellow('Add component functionality is not yet implemented.'));
  }

  private async listComponents(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const components = await dataManager.getSetupComponents();

    console.log(chalk.cyan('\n🔧 All Setup Components'));
    console.log(chalk.gray('─'.repeat(30)));

    if (components.length === 0) {
      console.log(chalk.yellow('No setup components found.'));
      return;
    }

        for (const component of components) {
      console.log(chalk.white(`\n📦 ${component.name} (${component.id})`));
      console.log(chalk.gray(`   Description: ${component.description}`));
      console.log(chalk.gray(`   Category: ${component.category}`));
      console.log(chalk.gray(`   Platforms: ${component.platforms.join(', ')}`));

      if (component.dependencies && component.dependencies.length > 0) {
        console.log(chalk.gray(`   Dependencies: ${component.dependencies.join(', ')}`));
      }
    }
  }
}
