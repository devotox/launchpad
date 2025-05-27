import chalk from 'chalk';
import inquirer from 'inquirer';
import { match } from 'ts-pattern';

import { ConfigManager } from '@/utils/config';

import type { SyncConfig } from '@/utils/config/types';

export class ProviderHandler {
  private configManager = ConfigManager.getInstance();

  async manageSyncProviders(): Promise<void> {
    const syncConfig = await this.configManager.getSyncConfig();

    console.log(chalk.cyan('\n🔄 Manage Sync Providers'));
    console.log(chalk.gray('─'.repeat(40)));

    if (!syncConfig) {
      console.log(chalk.yellow('No sync configuration found. Run \'launchpad admin config setup\' first.'));
      return;
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Add new provider', value: 'add' },
          { name: 'List providers', value: 'list' },
          { name: 'Set default provider', value: 'default' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);

    await match(action)
      .with('add', async () => this.addSyncProvider())
      .with('list', async () => this.listSyncProviders())
      .with('default', async () => this.selectDefaultSyncProvider())
      .otherwise(async () => Promise.resolve());
  }

  async addSyncProvider(): Promise<void> {
    console.log(chalk.cyan('\n➕ Add Sync Provider'));
    console.log(chalk.gray('─'.repeat(30)));

    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select provider type:',
        choices: [
          { name: 'GitHub Gist (Recommended)', value: 'gist' },
          { name: 'GitHub Repository', value: 'github' },
          { name: 'Google Drive', value: 'googledrive' },
          { name: 'Local File System', value: 'local' }
        ]
      }
    ]);

    if (provider === 'github') {
      const githubConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'repository',
          message: 'GitHub repository (org/repo):',
          validate: (input: string) => {
            if (!input.includes('/')) return 'Repository must be in format \'org/repo\'';
            return true;
          }
        },
        {
          type: 'input',
          name: 'branch',
          message: 'Branch name:',
          default: 'main'
        },
        {
          type: 'input',
          name: 'path',
          message: 'File path in repository:',
          default: 'launchpad-config.json'
        },
        {
          type: 'password',
          name: 'token',
          message: 'GitHub personal access token (optional):'
        }
      ]);

      await this.configManager.setSyncProvider('github', {
        repository: githubConfig.repository,
        branch: githubConfig.branch,
        path: githubConfig.path,
        token: githubConfig.token || undefined
      });

      console.log(chalk.green('✅ GitHub provider configured successfully!'));
    } else if (provider === 'gist') {
      const gistConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'gistId',
          message: 'GitHub Gist ID (leave empty to create new gist when uploading):'
        },
        {
          type: 'input',
          name: 'fileName',
          message: 'File name in gist:',
          default: 'launchpad-config.json'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Gist description:',
          default: 'Launchpad configuration'
        },
        {
          type: 'password',
          name: 'token',
          message: 'GitHub personal access token:',
          validate: (input: string) => input.length > 0 || 'Token is required for Gist operations'
        }
      ]);

      await this.configManager.setSyncProvider('gist', {
        gistId: gistConfig.gistId || '',
        fileName: gistConfig.fileName,
        description: gistConfig.description,
        token: gistConfig.token
      });

      console.log(chalk.green('✅ GitHub Gist provider configured successfully!'));
    } else if (provider === 'googledrive') {
      const driveConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'folderId',
          message: 'Google Drive folder ID:',
          validate: (input: string) => input.length > 0 || 'Folder ID is required'
        },
        {
          type: 'input',
          name: 'fileName',
          message: 'File name:',
          default: 'launchpad-config.json'
        }
      ]);

      await this.configManager.setSyncProvider('googledrive', {
        folderId: driveConfig.folderId,
        fileName: driveConfig.fileName
      });

      console.log(chalk.green('✅ Google Drive provider configured successfully!'));
    } else if (provider === 'local') {
      const localConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Local backup directory:',
          default: this.configManager.getConfigDir()
        },
        {
          type: 'confirm',
          name: 'autoBackup',
          message: 'Enable automatic backups?',
          default: true
        },
        {
          type: 'number',
          name: 'backupRetention',
          message: 'Backup retention (days):',
          default: 30
        }
      ]);

      await this.configManager.setSyncProvider('local', {
        path: localConfig.path,
        autoBackup: localConfig.autoBackup,
        backupRetention: localConfig.backupRetention
      });

      console.log(chalk.green('✅ Local provider configured successfully!'));
    }
  }

  async listSyncProviders(): Promise<void> {
    const syncConfig = await this.configManager.getSyncConfig();

    console.log(chalk.cyan('\n🔄 Configured Sync Providers'));
    console.log(chalk.gray('─'.repeat(40)));

    if (!syncConfig) {
      console.log(chalk.yellow('No sync configuration found.'));
      return;
    }

    const providers = Object.entries(syncConfig.providers);
    if (providers.length === 0) {
      console.log(chalk.yellow('No sync providers configured.'));
      return;
    }

    console.log(chalk.white(`Default provider: ${chalk.green(syncConfig.defaultProvider)}`));
    console.log(chalk.white(`Auto sync: ${syncConfig.autoSync ? chalk.green('Enabled') : chalk.gray('Disabled')}`));
    console.log('');

    for (const [name, config] of providers) {
      const isDefault = name === syncConfig.defaultProvider;
      const badge = isDefault ? chalk.green('[DEFAULT]') : chalk.gray('[CONFIGURED]');

      console.log(chalk.white(`${badge} ${name.toUpperCase()}`));

      if (name === 'github' && config) {
        const githubConfig = config as SyncConfig['providers']['github'];
        if (githubConfig) {
          console.log(chalk.gray(`  Repository: ${githubConfig.repository}`));
          console.log(chalk.gray(`  Branch: ${githubConfig.branch}`));
          console.log(chalk.gray(`  Path: ${githubConfig.path}`));
          console.log(chalk.gray(`  Token: ${githubConfig.token ? 'Configured' : 'Not set'}`));
        }
      } else if (name === 'gist' && config) {
        const gistConfig = config as SyncConfig['providers']['gist'];
        if (gistConfig) {
          console.log(chalk.gray(`  Gist ID: ${gistConfig.gistId || 'Will create new'}`));
          console.log(chalk.gray(`  File name: ${gistConfig.fileName}`));
          console.log(chalk.gray(`  Description: ${gistConfig.description}`));
          console.log(chalk.gray(`  Token: ${gistConfig.token ? 'Configured' : 'Not set'}`));
        }
      } else if (name === 'googledrive' && config) {
        const driveConfig = config as SyncConfig['providers']['googledrive'];
        if (driveConfig) {
          console.log(chalk.gray(`  Folder ID: ${driveConfig.folderId}`));
          console.log(chalk.gray(`  File name: ${driveConfig.fileName}`));
        }
      } else if (name === 'local' && config) {
        const localConfig = config as SyncConfig['providers']['local'];
        if (localConfig) {
          console.log(chalk.gray(`  Path: ${localConfig.path}`));
          console.log(chalk.gray(`  Auto backup: ${localConfig.autoBackup ? 'Yes' : 'No'}`));
          console.log(chalk.gray(`  Retention: ${localConfig.backupRetention} days`));
        }
      }
      console.log('');
    }
  }

  async selectDefaultSyncProvider(): Promise<void> {
    const syncConfig = await this.configManager.getSyncConfig();

    if (!syncConfig) {
      console.log(chalk.yellow('No sync configuration found.'));
      return;
    }

    const providers = Object.keys(syncConfig.providers);
    if (providers.length === 0) {
      console.log(chalk.yellow('No sync providers configured.'));
      return;
    }

    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select default sync provider:',
        choices: providers.map(p => ({
          name: `${p} ${p === syncConfig.defaultProvider ? '(current)' : ''}`,
          value: p
        }))
      }
    ]);

    await this.configManager.setDefaultSyncProvider(provider as SyncConfig['defaultProvider']);
    console.log(chalk.green(`✅ Default sync provider set to '${provider}'!`));
  }

  async setDefaultSyncProvider(provider: string): Promise<void> {
    const syncConfig = await this.configManager.getSyncConfig();

    if (!syncConfig) {
      console.log(chalk.red('❌ No sync configuration found. Run \'launchpad admin config setup\' first.'));
      return;
    }

    if (!syncConfig.providers[provider as keyof typeof syncConfig.providers]) {
      console.log(chalk.red(`❌ Sync provider '${provider}' not configured.`));
      console.log(chalk.gray(`Available providers: ${Object.keys(syncConfig.providers).join(', ')}`));
      return;
    }

    await this.configManager.setDefaultSyncProvider(provider as SyncConfig['defaultProvider']);
    console.log(chalk.green(`✅ Default sync provider set to '${provider}'!`));
  }
}
