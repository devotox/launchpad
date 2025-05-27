import chalk from 'chalk';
import inquirer from 'inquirer';

import { DataManager } from '@/utils/config/data-manager';

import type { BackupConfigType, BackupFileInfo } from '@/utils/config/types';

export class BackupHandler {
  private dataManager = DataManager.getInstance();

  async backupConfig(options: { type: string; output?: string }): Promise<void> {
    console.log(chalk.cyan('\n💾 Creating Configuration Backup'));
    console.log(chalk.gray('─'.repeat(35)));

    try {
      const { type, output } = options;
      let backupPath: string;

      if (type === 'all') {
        backupPath = await this.createCompleteBackup(output);
      } else {
        backupPath = await this.createPartialBackup(type, output);
      }

      console.log(chalk.green(`✅ Backup created successfully: ${backupPath}`));
    } catch (error) {
      console.log(chalk.red('❌ Failed to create backup:'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async createCompleteBackup(outputPath?: string): Promise<string> {
    const { promises: fs } = await import('node:fs');
    const { join } = await import('node:path');

    // Create timestamped backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const configDir = this.dataManager.getTeamsFilePath().replace('/teams.json', '');
    const backupDir = join(configDir, 'backups');
    const timestampedDir = outputPath || join(backupDir, timestamp);

    // Ensure backup directory exists
    await fs.mkdir(timestampedDir, { recursive: true });

    // Create individual backup files for each config type
    const configTypes: BackupConfigType[] = ['teams', 'setup-components', 'global-docs'];

    for (const configType of configTypes) {
      const outputFile = join(timestampedDir, `${configType}.json`);
      await this.dataManager.backupConfigFile(configType, outputFile);
    }

    // Also create a complete bundle file for convenience
    const bundle = await this.dataManager.createConfigBundle();
    const bundlePath = join(timestampedDir, 'complete-bundle.json');
    await fs.writeFile(bundlePath, JSON.stringify(bundle, null, 2));

    // Add sync config backup (without sensitive tokens)
    try {
      const { ConfigManager } = await import('@/utils/config');
      const configManager = ConfigManager.getInstance();
      const syncConfig = await configManager.getSyncConfig();

      if (syncConfig) {
        // Create a sanitized version with empty tokens
        const sanitizedSyncConfig = {
          ...syncConfig,
          providers: Object.fromEntries(
            Object.entries(syncConfig.providers).map(([key, provider]) => {
              if (!provider) return [key, provider];

              // Sanitize sensitive fields by setting them to empty strings
              const sanitized = { ...provider } as Record<string, unknown>;
              if ('token' in sanitized) {
                (sanitized as { token: string }).token = '';
              }
              if ('credentials' in sanitized) {
                (sanitized as { credentials: string }).credentials = '';
              }

              return [key, sanitized];
            })
          )
        };

        const syncConfigPath = join(timestampedDir, 'sync-config.json');
        await fs.writeFile(syncConfigPath, JSON.stringify(sanitizedSyncConfig, null, 2));
      }
    } catch (error) {
      // Sync config backup is optional, don't fail the entire backup
      console.log(chalk.yellow(`⚠️  Could not backup sync config: ${error}`));
    }

    return timestampedDir;
  }

  private async createPartialBackup(type: string, outputPath?: string): Promise<string> {
    const validTypes: BackupConfigType[] = ['teams', 'setup-components', 'global-docs'];
    if (!validTypes.includes(type as BackupConfigType)) {
      throw new Error(`Invalid backup type: ${type}. Valid types: ${validTypes.join(', ')}`);
    }

    return this.dataManager.backupConfigFile(type as BackupConfigType, outputPath);
  }

  async selectiveBackup(): Promise<void> {
    console.log(chalk.cyan('\n🎯 Selective Configuration Backup'));
    console.log(chalk.gray('─'.repeat(40)));

    const { configTypes } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'configTypes',
        message: 'Select configuration types to backup:',
        choices: [
          { name: 'Teams', value: 'teams', checked: true },
          { name: 'Setup Components', value: 'setup-components', checked: true },
          { name: 'Global Documentation', value: 'global-docs', checked: true }
        ]
      }
    ]);

    if (configTypes.length === 0) {
      console.log(chalk.yellow('No configuration types selected. Backup cancelled.'));
      return;
    }

    try {
      const backupPaths: string[] = [];

      for (const configType of configTypes) {
        const backupPath = await this.dataManager.backupConfigFile(configType as BackupConfigType);
        backupPaths.push(backupPath);
      }

      console.log(chalk.green('\n✅ Selective backup completed:'));
      for (const path of backupPaths) {
        console.log(chalk.gray(`   ${path}`));
      }
    } catch (error) {
      console.log(chalk.red('❌ Failed to create selective backup:'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async listBackups(options: { dir?: string }): Promise<void> {
    console.log(chalk.cyan('\n📋 Available Backup Files'));
    console.log(chalk.gray('─'.repeat(30)));

    try {
      const backups = await this.dataManager.listBackups(options.dir);

      if (backups.length === 0) {
        console.log(chalk.yellow('No backup files found.'));
        return;
      }

      backups.forEach((backup: BackupFileInfo, index: number) => {
        console.log(chalk.white(`${index + 1}. ${backup.path}`));
        console.log(chalk.gray(`   Type: ${backup.type}`));
        console.log(chalk.gray(`   Date: ${backup.timestamp}`));
        console.log(chalk.gray(`   Size: ${this.formatFileSize(backup.size)}`));
        console.log('');
      });
    } catch (error) {
      console.log(chalk.red('❌ Failed to list backups:'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async cleanupBackups(options: { days: string; dryRun?: boolean }): Promise<void> {
    const retentionDays = Number.parseInt(options.days, 10);

    if (Number.isNaN(retentionDays) || retentionDays < 1) {
      console.log(chalk.red('❌ Invalid retention period. Must be a positive number.'));
      return;
    }

    console.log(chalk.cyan(`\n🧹 Cleanup Backups (${retentionDays} days retention)`));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      const deletedCount = await this.dataManager.cleanupOldBackups(retentionDays);

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would delete ${deletedCount} old backup files.`));
      } else {
        console.log(chalk.green(`✅ Deleted ${deletedCount} old backup files.`));
      }
    } catch (error) {
      console.log(chalk.red('❌ Failed to cleanup backups:'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
  }
}
