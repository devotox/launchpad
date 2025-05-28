import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { match } from 'ts-pattern';

import { ConfigManager } from '@/utils/config/manager';

export class ConfigCommand {
  getCommand(): Command {
    const configCmd = new Command('config').description('Manage configuration preferences');

    // Set command
    configCmd
      .command('set <key> <value>')
      .description('Set a configuration value')
      .action(async (key: string, value: string) => {
        await this.setConfigValue(key, value);
      });

    // Get command
    configCmd
      .command('get <key>')
      .description('Get a configuration value')
      .action(async (key: string) => {
        await this.getConfigValue(key);
      });

    // List command
    configCmd
      .command('list')
      .description('List all configuration values')
      .action(async () => {
        await this.listConfig();
      });

    // Environment command
    configCmd
      .command('env [environment]')
      .description('Get or set the default environment')
      .action(async (environment?: string) => {
        if (environment) {
          await this.setDefaultEnvironment(environment);
        } else {
          await this.getDefaultEnvironment();
        }
      });

    return configCmd;
  }

  private async setConfigValue(key: string, value: string): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    // Handle different configuration keys
    match(key)
      .with('environment', 'env', 'defaultEnvironment', async () => {
        await this.setDefaultEnvironment(value);
      })
      .with('editor', 'defaultEditor', 'preferredEditor', async () => {
        await configManager.updateConfig({
          preferences: { ...config.preferences, preferredEditor: value }
        });
        console.log(chalk.green(`✅ Set default editor to: ${value}`));
      })
      .with('terminal', 'preferredTerminal', async () => {
        await configManager.updateConfig({
          preferences: { ...config.preferences, preferredTerminal: value }
        });
        console.log(chalk.green(`✅ Set preferred terminal to: ${value}`));
      })
      .with('gitBranchPrefix', 'branchPrefix', async () => {
        await configManager.updateConfig({
          preferences: { ...config.preferences, gitBranchPrefix: value }
        });
        console.log(chalk.green(`✅ Set git branch prefix to: ${value}`));
      })
      .with('autoClone', async () => {
        const boolValue = value.toLowerCase() === 'true';
        await configManager.updateConfig({
          preferences: { ...config.preferences, autoClone: boolValue }
        });
        console.log(chalk.green(`✅ Set auto clone to: ${boolValue}`));
      })
      .with('setupDependencies', async () => {
        const boolValue = value.toLowerCase() === 'true';
        await configManager.updateConfig({
          preferences: { ...config.preferences, setupDependencies: boolValue }
        });
        console.log(chalk.green(`✅ Set setup dependencies to: ${boolValue}`));
      })
      .otherwise(() => {
        console.log(chalk.red(`❌ Unknown configuration key: ${key}`));
        console.log(chalk.gray('\nAvailable keys:'));
        console.log(chalk.gray('  • environment (or env, defaultEnvironment)'));
        console.log(chalk.gray('  • editor (or defaultEditor, preferredEditor)'));
        console.log(chalk.gray('  • terminal (or preferredTerminal)'));
        console.log(chalk.gray('  • gitBranchPrefix (or branchPrefix)'));
        console.log(chalk.gray('  • autoClone'));
        console.log(chalk.gray('  • setupDependencies'));
      });
  }

  private async getConfigValue(key: string): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    match(key)
      .with('environment', 'env', 'defaultEnvironment', () => {
        const env = config.preferences.defaultEnvironment || 'dev';
        console.log(chalk.green(`Default environment: ${env}`));
      })
      .with('editor', 'defaultEditor', 'preferredEditor', () => {
        const editor = config.preferences.preferredEditor || 'not set';
        console.log(chalk.green(`Preferred editor: ${editor}`));
      })
      .with('terminal', 'preferredTerminal', () => {
        const terminal = config.preferences.preferredTerminal || 'not set';
        console.log(chalk.green(`Preferred terminal: ${terminal}`));
      })
      .with('gitBranchPrefix', 'branchPrefix', () => {
        const prefix = config.preferences.gitBranchPrefix || 'not set';
        console.log(chalk.green(`Git branch prefix: ${prefix}`));
      })
      .with('autoClone', () => {
        console.log(chalk.green(`Auto clone: ${config.preferences.autoClone}`));
      })
      .with('setupDependencies', () => {
        console.log(chalk.green(`Setup dependencies: ${config.preferences.setupDependencies}`));
      })
      .otherwise(() => {
        console.log(chalk.red(`❌ Unknown configuration key: ${key}`));
      });
  }

  private async listConfig(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    console.log(chalk.cyan('\n📋 Configuration Settings'));
    console.log(chalk.gray('─'.repeat(40)));

    console.log(chalk.yellow('\nUser:'));
    console.log(chalk.white(`  Name: ${config.user.name}`));
    console.log(chalk.white(`  Email: ${config.user.email}`));
    console.log(chalk.white(`  Team: ${config.user.team}`));

    console.log(chalk.yellow('\nWorkspace:'));
    console.log(chalk.white(`  Name: ${config.workspace.name}`));
    console.log(chalk.white(`  Path: ${config.workspace.path}`));
    console.log(chalk.white(`  Repositories: ${config.workspace.repositories.length}`));

    console.log(chalk.yellow('\nPreferences:'));
    console.log(chalk.white(`  Default Environment: ${config.preferences.defaultEnvironment || 'dev'}`));
    console.log(chalk.white(`  Preferred Editor: ${config.preferences.preferredEditor || 'not set'}`));
    console.log(chalk.white(`  Preferred Terminal: ${config.preferences.preferredTerminal || 'not set'}`));
    console.log(chalk.white(`  Git Branch Prefix: ${config.preferences.gitBranchPrefix || 'not set'}`));
    console.log(chalk.white(`  Auto Clone: ${config.preferences.autoClone}`));
    console.log(chalk.white(`  Setup Dependencies: ${config.preferences.setupDependencies}`));
  }

  private async setDefaultEnvironment(environment: string): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    // Validate environment
    const validEnvironments = ['dev', 'staging', 'prod', 'test'];
    let finalEnvironment = environment;

    if (!validEnvironments.includes(environment)) {
      console.log(chalk.red(`❌ Invalid environment: ${environment}`));
      console.log(chalk.gray(`Valid environments: ${validEnvironments.join(', ')}`));

      // Offer to select from valid options
      const { selectedEnv } = await inquirer.prompt<{ selectedEnv: string }>({
        type: 'list',
        name: 'selectedEnv',
        message: 'Select a valid environment:',
        choices: validEnvironments
      });

      finalEnvironment = selectedEnv;
    }

    await configManager.updateConfig({
      preferences: {
        ...config.preferences,
        defaultEnvironment: finalEnvironment as 'dev' | 'staging' | 'prod' | 'test'
      }
    });

    console.log(chalk.green(`✅ Default environment set to: ${finalEnvironment}`));
  }

  private async getDefaultEnvironment(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    const environment = config.preferences.defaultEnvironment || 'dev';
    console.log(chalk.green(`Default environment: ${environment}`));
  }
}
