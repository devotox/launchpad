import chalk from 'chalk';
import { Command } from 'commander';

import { ConfigManager, DataManager } from '@/utils/config';

export class InfoCommand {
  getCommand(): Command {
    const infoCmd = new Command('info')
      .description('Show configuration file locations')
      .action(async () => {
        await this.showInfo();
      });

    return infoCmd;
  }

  private async showInfo(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();

    console.log(chalk.cyan('\n📁 Configuration Information'));
    console.log(chalk.gray('─'.repeat(35)));

    console.log(chalk.white('\nConfiguration Files:'));
    console.log(chalk.gray(`   Teams: ${dataManager.getTeamsFilePath()}`));
    console.log(chalk.gray(`   Setup Components: ${dataManager.getSetupComponentsFilePath()}`));
    console.log(chalk.gray(`   Global Docs: ${dataManager.getGlobalDocsFilePath()}`));
    console.log(chalk.gray(`   Main Config: ${configManager.getConfigPath()}`));
    console.log(chalk.gray(`   Sync Config: ${configManager.getSyncConfigPath()}`));

    console.log(chalk.white('\nDirectories:'));
    console.log(chalk.gray(`   Config Directory: ${configManager.getConfigDir()}`));
    console.log(chalk.gray(`   Logs Directory: ${configManager.getLogsDir()}`));
    console.log(chalk.gray(`   Cache Directory: ${configManager.getCacheDir()}`));

    // Check file existence
    console.log(chalk.white('\nFile Status:'));
    await this.checkFileExists('Teams', dataManager.getTeamsFilePath());
    await this.checkFileExists('Setup Components', dataManager.getSetupComponentsFilePath());
    await this.checkFileExists('Global Docs', dataManager.getGlobalDocsFilePath());
    await this.checkFileExists('Main Config', configManager.getConfigPath());
    await this.checkFileExists('Sync Config', configManager.getSyncConfigPath());
  }

  private async checkFileExists(name: string, path: string): Promise<void> {
    try {
      const { promises: fs } = await import('node:fs');
      await fs.access(path);
      console.log(chalk.green(`   ✅ ${name}: exists`));
    } catch {
      console.log(chalk.red(`   ❌ ${name}: not found`));
    }
  }
}
