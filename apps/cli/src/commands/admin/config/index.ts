import { Command } from 'commander';

import { BackupHandler } from './backup-handler';
import { RestoreHandler } from './restore-handler';
import { SyncHandler } from './sync-handler';
import { ProviderHandler } from './provider-handler';

export class ConfigCommand {
  private backupHandler = new BackupHandler();
  private restoreHandler = new RestoreHandler();
  private syncHandler = new SyncHandler();
  private providerHandler = new ProviderHandler();

  getCommand(): Command {
    const configCmd = new Command('config')
      .description('Manage configuration sync');

    // Download/Upload commands
    configCmd
      .command('download')
      .description('Download configuration from remote source')
      .option('--provider <provider>', 'Provider (gist, github, local)', 'gist')
      .option('--repository <repo>', 'GitHub repository (org/repo)')
      .option('--branch <branch>', 'Git branch', 'main')
      .option('--token <token>', 'GitHub personal access token')
      .option('--path <path>', 'File path in repository', 'launchpad-config.json')
      .option('--gist-id <gistId>', 'GitHub Gist ID (supports: gistId, username/gistId, or full URL)')
      .option('--file-name <fileName>', 'File name in gist', 'launchpad-config.json')
      .option('--local-path <path>', 'Local file path for local provider')
      .action(async (options) => {
        await this.syncHandler.downloadConfig(options);
      });

    configCmd
      .command('upload')
      .description('Upload current configuration to remote source')
      .option('--provider <provider>', 'Provider (gist, github, local)', 'gist')
      .option('--repository <repo>', 'GitHub repository (org/repo)')
      .option('--branch <branch>', 'Git branch', 'main')
      .option('--token <token>', 'GitHub personal access token')
      .option('--path <path>', 'File path in repository', 'launchpad-config.json')
      .option('--message <message>', 'Commit message')
      .option('--gist-id <gistId>', 'GitHub Gist ID (supports: gistId, username/gistId, or full URL)')
      .option('--file-name <fileName>', 'File name in gist', 'launchpad-config.json')
      .option('--description <description>', 'Gist description')
      .option('--local-path <path>', 'Local file path for local provider')
      .action(async (options) => {
        await this.syncHandler.uploadConfig(options);
      });

    // Backup commands
    configCmd
      .command('backup')
      .description('Create a local backup of configuration')
      .option('--type <type>', 'Config type to backup (teams, setup-components, global-docs, or all)', 'all')
      .option('--output <path>', 'Output file path')
      .action(async (options) => {
        await this.backupHandler.backupConfig(options);
      });

    configCmd
      .command('backup:selective')
      .description('Interactive selective backup of configuration files')
      .action(async () => {
        await this.backupHandler.selectiveBackup();
      });

    // Restore commands
    configCmd
      .command('restore')
      .description('Restore configuration from a backup file')
      .option('--type <type>', 'Config type to restore (teams, setup-components, global-docs, or auto-detect)')
      .option('--input <path>', 'Input file path')
      .option('--no-backup', 'Skip creating backup before restore')
      .action(async (options) => {
        await this.restoreHandler.restoreConfig(options);
      });

    configCmd
      .command('restore:selective')
      .description('Interactive selective restore of configuration files')
      .action(async () => {
        await this.restoreHandler.selectiveRestore();
      });

    // Backup management
    configCmd
      .command('backups:list')
      .description('List available backup files')
      .option('--dir <directory>', 'Backup directory to search')
      .action(async (options) => {
        await this.backupHandler.listBackups(options);
      });

    configCmd
      .command('backups:cleanup')
      .description('Clean up old backup files')
      .option('--days <days>', 'Retention period in days', '30')
      .option('--dry-run', 'Show what would be deleted without actually deleting')
      .action(async (options) => {
        await this.backupHandler.cleanupBackups(options);
      });

    // Setup and providers
    configCmd
      .command('setup')
      .description('Setup sync configuration')
      .action(async () => {
        await this.syncHandler.setupSyncConfig();
      });

    configCmd
      .command('providers')
      .description('Manage sync providers')
      .action(async () => {
        await this.providerHandler.manageSyncProviders();
      });

    return configCmd;
  }
}
