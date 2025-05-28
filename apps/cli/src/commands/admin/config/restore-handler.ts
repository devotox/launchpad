import { promises as fs } from 'node:fs';

import chalk from 'chalk';
import inquirer from 'inquirer';
import parseJson from 'parse-json';

import { DataManager } from '@/utils/config/data-manager';

import type { ConfigBundle, BackupData } from '@/utils/config/types';

export class RestoreHandler {
  private dataManager = DataManager.getInstance();

  async restoreConfig(options: {
    type?: string;
    input?: string;
    noBackup?: boolean;
  }): Promise<void> {
    try {
      if (!options.input) {
        console.log(chalk.red('❌ Input file path is required'));
        console.log(chalk.gray('Example: --input launchpad-backup-2024-01-01.json'));
        return;
      }

      console.log(chalk.cyan(`📁 Restoring configuration from: ${options.input}`));

      const content = await fs.readFile(options.input, 'utf-8');
      const backupData = parseJson(content) as ConfigBundle | BackupData;

      // Auto-detect backup type if not specified
      let configType = options.type;
      if (!configType) {
        if ('configType' in backupData && backupData.configType) {
          configType = backupData.configType;
          console.log(chalk.gray(`Auto-detected config type: ${configType}`));
        } else if (
          'teams' in backupData &&
          backupData.teams &&
          'setupComponents' in backupData &&
          backupData.setupComponents &&
          'globalDocs' in backupData &&
          backupData.globalDocs
        ) {
          configType = 'all';
          console.log(chalk.gray('Auto-detected config type: full bundle'));
        } else {
          console.log(chalk.red('❌ Cannot auto-detect config type. Please specify --type'));
          return;
        }
      }

      if (configType === 'all') {
        // Restore full bundle
        if (
          'teams' in backupData &&
          'setupComponents' in backupData &&
          'globalDocs' in backupData
        ) {
          const bundleData = backupData;
          console.log(chalk.yellow('⚠️  This will replace your current configuration.'));
          console.log(chalk.gray(`Bundle version: ${bundleData.version}`));
          console.log(chalk.gray(`Bundle timestamp: ${bundleData.timestamp}`));
          console.log(chalk.gray(`Teams: ${bundleData.teams.length}`));
          console.log(chalk.gray(`Setup components: ${bundleData.setupComponents.length}`));
          console.log(chalk.gray(`Global docs: ${bundleData.globalDocs.length}`));

          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Do you want to proceed with the restore?',
              default: false
            }
          ]);

          if (!confirm) {
            console.log(chalk.gray('Restore cancelled.'));
            return;
          }

          await this.dataManager.importConfigBundle(bundleData);
        } else {
          console.log(chalk.red('❌ Invalid bundle format'));
          return;
        }
      } else {
        // Restore selective config
        const validTypes = ['teams', 'setup-components', 'global-docs'];
        if (!configType || !validTypes.includes(configType)) {
          console.log(
            chalk.red(`❌ Invalid config type. Must be one of: ${validTypes.join(', ')}`)
          );
          return;
        }

        if ('data' in backupData && backupData.data) {
          console.log(
            chalk.yellow(`⚠️  This will replace your current ${configType} configuration.`)
          );
          console.log(chalk.gray(`Backup timestamp: ${backupData.timestamp}`));
          console.log(
            chalk.gray(
              `Items: ${Array.isArray(backupData.data) ? backupData.data.length : 'Unknown'}`
            )
          );
        } else {
          console.log(chalk.red('❌ Invalid backup data format'));
          return;
        }

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Do you want to proceed with restoring ${configType}?`,
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.gray('Restore cancelled.'));
          return;
        }

        await this.dataManager.restoreConfigFile(
          configType as 'teams' | 'setup-components' | 'global-docs',
          options.input,
          !options.noBackup
        );
      }

      console.log(chalk.green('✅ Configuration restored successfully!'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to restore config: ${error}`));
    }
  }

  async selectiveRestore(): Promise<void> {
    console.log(chalk.cyan('\n📁 Interactive Selective Restore'));
    console.log(chalk.gray('─'.repeat(40)));

    // List available backups
    const backups = await this.dataManager.listBackups();
    const selectiveBackups = backups.filter(
      (backup) => backup.type !== 'full-bundle' && backup.type !== 'unknown'
    );

    if (selectiveBackups.length === 0) {
      console.log(chalk.yellow('No selective backup files found.'));
      console.log(chalk.gray('Create backups with: launchpad admin config backup:selective'));
      return;
    }

    const { selectedBackup } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedBackup',
        message: 'Select backup file to restore:',
        choices: selectiveBackups.map((backup) => ({
          name: `${backup.type} - ${new Date(backup.timestamp).toLocaleString()} (${(backup.size / 1024).toFixed(1)}KB)`,
          value: backup.path
        }))
      }
    ]);

    const { createBackup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createBackup',
        message: 'Create backup of current data before restore?',
        default: true
      }
    ]);

    try {
      // Auto-detect config type from backup file
      const content = await fs.readFile(selectedBackup, 'utf-8');
      const backupData = parseJson(content) as BackupData;
      const { configType } = backupData;

      if (!configType) {
        console.log(chalk.red('❌ Cannot determine config type from backup file'));
        return;
      }

      await this.dataManager.restoreConfigFile(
        configType as 'teams' | 'setup-components' | 'global-docs',
        selectedBackup,
        createBackup
      );

      console.log(chalk.green('✅ Selective restore completed!'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to restore from backup: ${error}`));
    }
  }
}
