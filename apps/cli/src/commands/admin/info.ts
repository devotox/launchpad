import chalk from 'chalk';
import { Command } from 'commander';

import { DataManager } from '@/utils/config/data-manager/index';
import { ConfigManager } from '@/utils/config/manager';

export class InfoCommand {
  getCommand(): Command {
    return new Command('info').description('Show configuration file locations').action(async () => {
      await this.showInfo();
    });
  }

  private async showInfo(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();

    console.log(chalk.cyan('\n⚙️  Configuration Information'));
    console.log(chalk.gray('═'.repeat(40)));

    // Configuration Files Section
    console.log(chalk.cyan('📁 Configuration Files'));
    console.log(chalk.gray('─'.repeat(25)));
    console.log(`   ${chalk.white('Teams:')} ${chalk.gray(dataManager.getTeamsFilePath())}`);
    console.log(`   ${chalk.white('Setup Components:')} ${chalk.gray(dataManager.getSetupComponentsFilePath())}`);
    console.log(`   ${chalk.white('Global Docs:')} ${chalk.gray(dataManager.getGlobalDocsFilePath())}`);
    console.log(`   ${chalk.white('Main Config:')} ${chalk.gray(configManager.getConfigPath())}`);
    console.log(`   ${chalk.white('Sync Config:')} ${chalk.gray(configManager.getSyncConfigPath())}`);
    console.log('');

    // Directories Section
    console.log(chalk.cyan('📂 Directories'));
    console.log(chalk.gray('─'.repeat(15)));
    console.log(`   ${chalk.white('Config:')} ${chalk.gray(configManager.getConfigDir())}`);
    console.log(`   ${chalk.white('Logs:')} ${chalk.gray(configManager.getLogsDir())}`);
    console.log(`   ${chalk.white('Cache:')} ${chalk.gray(configManager.getCacheDir())}`);
    console.log('');

    // File Status Section
    console.log(chalk.cyan('📊 File Status'));
    console.log(chalk.gray('─'.repeat(15)));
    await this.checkFileExists('Teams', dataManager.getTeamsFilePath());
    await this.checkFileExists('Setup Components', dataManager.getSetupComponentsFilePath());
    await this.checkFileExists('Global Docs', dataManager.getGlobalDocsFilePath());
    await this.checkFileExists('Main Config', configManager.getConfigPath());
    await this.checkFileExists('Sync Config', configManager.getSyncConfigPath());

    console.log('');
    console.log(chalk.cyan('⚡ Quick Actions'));
    console.log(chalk.gray('─'.repeat(15)));
    console.log(`   ${chalk.white('launchpad admin teams:list')}    - View all teams`);
    console.log(`   ${chalk.white('launchpad admin teams:add')}     - Add new team`);
    console.log(`   ${chalk.white('launchpad admin docs:add')}      - Add documentation`);
    console.log(`   ${chalk.white('launchpad admin config backup')} - Backup configuration`);
    console.log('');
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
