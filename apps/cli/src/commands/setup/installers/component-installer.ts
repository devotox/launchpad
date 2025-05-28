import { execSync } from 'node:child_process';

import chalk from 'chalk';
import parseJson from 'parse-json';
import { match } from 'ts-pattern';

import type { SetupComponent, InstallationConfig, PostInstallConfig, CustomInstallConfig } from '@/utils/config/types';

type Platform = 'macos' | 'linux' | 'windows';

export class ComponentInstaller {
  installComponent(component: SetupComponent, platform: Platform): Promise<void> {
    console.log(chalk.blue(`🔄 Installing ${component.name}...`));

    const installation = component.installation[platform];
    if (!installation) {
      console.log(chalk.yellow(`⚠️  No installation method available for ${component.name} on ${platform}`));
      return Promise.resolve();
    }

    try {
      match(installation.type)
        .with('package-manager', () => this.installViaPackageManager(installation))
        .with('script', () => this.installViaScript(installation))
        .with('custom', () => this.runCustomInstaller(installation))
        .with('manual', () => {
          this.showManualInstructions(installation, component.name);
        })
        .otherwise(() => {
          console.log(chalk.yellow(`⚠️  Unknown installation type for ${component.name}`));
        });

      console.log(chalk.green(`✅ ${component.name} installed successfully`));

      // Show post-install information
      if (component.postInstall) {
        this.showPostInstallInfo(component.postInstall);
      }

      return Promise.resolve();
    } catch (error) {
      console.error(chalk.red(`❌ Failed to install ${component.name}: ${String(error)}`));
      console.log(chalk.gray('You may need to install this component manually'));
      return Promise.reject(error);
    }
  }

  private installViaPackageManager(installation: InstallationConfig): void {
    const { packageManager, packages, commands } = installation;

    if (commands) {
      for (const command of commands) {
        console.log(chalk.gray(`Running: ${command}`));
        execSync(command, { stdio: 'inherit' });
      }
      return;
    }

    if (!packageManager || !packages) {
      throw new Error('Package manager and packages must be specified');
    }

    const packageList = packages.join(' ');

    match(packageManager)
      .with('brew', () => {
        execSync(`brew install ${packageList}`, { stdio: 'inherit' });
      })
      .with('apt', () => {
        execSync(`sudo apt-get update && sudo apt-get install -y ${packageList}`, { stdio: 'inherit' });
      })
      .with('winget', () => {
        for (const pkg of packages) {
          execSync(`winget install -e --id ${pkg}`, { stdio: 'inherit' });
        }
      })
      .with('npm', () => {
        execSync(`npm install -g ${packageList}`, { stdio: 'inherit' });
      })
      .with('volta', () => {
        for (const pkg of packages) {
          execSync(`volta install ${pkg}`, { stdio: 'inherit' });
        }
      })
      .otherwise(() => {
        throw new Error(`Unsupported package manager: ${packageManager}`);
      });
  }

  private installViaScript(installation: InstallationConfig): void {
    const { script, commands } = installation;

    if (commands) {
      for (const command of commands) {
        console.log(chalk.gray(`Running: ${command}`));
        execSync(command, { stdio: 'inherit' });
      }
    } else if (script?.trim()) {
      console.log(chalk.gray('Running installation script...'));
      execSync(script, { stdio: 'inherit' });
    } else {
      throw new Error('No script or commands specified');
    }
  }

  private runCustomInstaller(installation: InstallationConfig): void {
    // Parse custom installer configuration from the config
    const customConfig = this.parseCustomConfig(installation);

    match(customConfig)
      .with({ type: 'script' }, (config) => {
        console.log(chalk.gray('Running custom installation script...'));
        execSync(config.script, { stdio: 'inherit' });
      })
      .with({ type: 'commands' }, (config) => {
        for (const command of config.commands) {
          console.log(chalk.gray(`Running: ${command}`));
          execSync(command, { stdio: 'inherit' });
        }
      })
      .with({ type: 'manual' }, (config) => {
        console.log(chalk.yellow('Manual installation required:'));
        config.steps.forEach((step: string, index: number) => {
          console.log(chalk.gray(`${index + 1}. ${step}`));
        });
        if (config.links) {
          console.log(chalk.gray('\nHelpful links:'));
          config.links.forEach((link: string) => {
            console.log(chalk.blue(`• ${link}`));
          });
        }
      })
      .with({ type: 'download' }, (config) => {
        console.log(chalk.yellow('Download required:'));
        console.log(chalk.blue(`Download from: ${config.url}`));
        if (config.message?.trim()) {
          console.log(chalk.gray(config.message));
        }
      })
      .otherwise(() => {
        // Fallback: if commands are specified, run them
        if (installation.commands) {
          for (const command of installation.commands) {
            console.log(chalk.gray(`Running: ${command}`));
            execSync(command, { stdio: 'inherit' });
          }
        } else {
          throw new Error('No custom installation configuration found');
        }
      });
  }

  private parseCustomConfig(installation: InstallationConfig): CustomInstallConfig {
    // If it's already an object, return it
    if (typeof installation.customInstaller === 'object' && installation.customInstaller !== null) {
      return installation.customInstaller;
    }

    // If customInstaller is a JSON string, parse it
    if (typeof installation.customInstaller === 'string') {
      const strValue = installation.customInstaller;
      if (strValue.trim()) {
        try {
          return parseJson(strValue) as CustomInstallConfig;
        } catch {
          // If not JSON, treat as a script
          return { type: 'script', script: strValue };
        }
      }
    }

    // Build config from installation properties
    if (installation.commands && installation.commands.length > 0) {
      return { type: 'commands', commands: installation.commands };
    }

    if (installation.manualSteps && installation.manualSteps.length > 0) {
      return { type: 'manual', steps: installation.manualSteps };
    }

    if (installation.script?.trim()) {
      return { type: 'script', script: installation.script };
    }

    throw new Error('No valid custom installation configuration');
  }

  private showManualInstructions(installation: InstallationConfig, componentName: string): void {
    console.log(chalk.yellow(`📋 Manual installation required for ${componentName}:`));

    if (installation.manualSteps) {
      installation.manualSteps.forEach((step: string, index: number) => {
        console.log(chalk.gray(`${index + 1}. ${step}`));
      });
    }
  }

  private showPostInstallInfo(postInstall: PostInstallConfig): void {
    if (postInstall.message?.trim()) {
      console.log(chalk.cyan(postInstall.message));
    }

    if (postInstall.steps) {
      console.log(chalk.gray('Next steps:'));
      postInstall.steps.forEach((step: string) => {
        console.log(chalk.gray(`• ${step}`));
      });
    }

    if (postInstall.links) {
      console.log(chalk.gray('Helpful links:'));
      postInstall.links.forEach((link: string) => {
        console.log(chalk.blue(`• ${link}`));
      });
    }
  }
}
