import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { match } from 'ts-pattern';

import { DataManager } from '@/utils/config';

import type { SetupComponent } from '@/utils/config';

export class SetupCommand {
  getCommand(): Command {
    const setupCmd = new Command('setup').description('Set up development tools and environment');

    // Main setup commands
    setupCmd
      .command('all')
      .description('Interactive setup of all development tools')
      .action(async () => {
        await this.runFullSetup(false);
      });

    setupCmd
      .command('essential')
      .description('Interactive setup of essential development tools only')
      .action(async () => {
        await this.runFullSetup(true);
      });

    // Individual component setups
    setupCmd
      .command('xcode')
      .description('Install Xcode Command Line Tools')
      .action(async () => {
        await this.setupComponent('xcode-cli-tools');
      });

    setupCmd
      .command('homebrew')
      .description('Install Homebrew package manager')
      .action(async () => {
        await this.setupComponent('homebrew');
      });

    setupCmd
      .command('node')
      .description('Install Node.js and NPM via Volta')
      .action(async () => {
        await this.setupComponent('node-volta');
      });

    setupCmd
      .command('pnpm')
      .description('Install PNPM package manager')
      .action(async () => {
        await this.setupComponent('pnpm');
      });

    setupCmd
      .command('git')
      .description('Install Git version control')
      .action(async () => {
        await this.setupComponent('git');
      });

    setupCmd
      .command('docker')
      .description('Install Docker Desktop')
      .action(async () => {
        await this.setupComponent('docker-desktop');
      });

    setupCmd
      .command('kubernetes')
      .description('Set up Kubernetes tools (kubectl, Lens)')
      .action(async () => {
        await this.setupKubernetes();
      });

    setupCmd
      .command('github')
      .description('Set up GitHub CLI and authentication')
      .action(async () => {
        await this.setupGitHub();
      });

    setupCmd
      .command('gcloud')
      .description('Install Google Cloud SDK')
      .action(async () => {
        await this.setupComponent('google-cloud-sdk');
      });

    setupCmd
      .command('npm-token')
      .description('Set up NPM token for LoveHolidays packages')
      .action(async () => {
        await this.setupComponent('npm-token');
      });

    setupCmd
      .command('google-workspace')
      .description('Verify Google Workspace access')
      .action(async () => {
        await this.setupComponent('google-workspace');
      });

    setupCmd
      .command('vpn')
      .description('Set up OpenVPN client')
      .action(async () => {
        await this.setupComponent('vpn-access');
      });

    setupCmd
      .command('bruno')
      .description('Install Bruno API client')
      .action(async () => {
        await this.setupComponent('bruno');
      });

    setupCmd
      .command('postman')
      .description('Install Postman API client')
      .action(async () => {
        await this.setupComponent('postman');
      });

    setupCmd
      .command('insomnia')
      .description('Install Insomnia API client')
      .action(async () => {
        await this.setupComponent('insomnia');
      });

    setupCmd
      .command('figma')
      .description('Install Figma design tool')
      .action(async () => {
        await this.setupComponent('figma');
      });

    setupCmd
      .command('slack')
      .description('Install Slack communication platform')
      .action(async () => {
        await this.setupComponent('slack');
      });

    setupCmd
      .command('iterm2')
      .description('Install iTerm2 terminal (macOS)')
      .action(async () => {
        await this.setupComponent('iterm2');
      });

    setupCmd
      .command('alacritty')
      .description('Install Alacritty terminal')
      .action(async () => {
        await this.setupComponent('alacritty');
      });

    setupCmd
      .command('ngrok')
      .description('Install ngrok tunneling service')
      .action(async () => {
        await this.setupComponent('ngrok');
      });

    setupCmd
      .command('api-client')
      .description('Install API development tools')
      .action(async () => {
        await this.setupApiClient();
      });

    setupCmd
      .command('terminal')
      .description('Install enhanced terminal options')
      .action(async () => {
        await this.setupTerminal();
      });

    setupCmd
      .command('loveholidays')
      .description('Set up LoveHolidays-specific tools and access')
      .action(async () => {
        await this.setupLoveHolidays();
      });

    setupCmd
      .command('status')
      .description('Check installation status of all tools')
      .action(async () => {
        await this.checkSetupStatus();
      });

    return setupCmd;
  }

  private detectPlatform(): 'macos' | 'linux' | 'windows' {
    return match(process.platform)
      .with('darwin', () => 'macos' as const)
      .with('linux', () => 'linux' as const)
      .with('win32', () => 'windows' as const)
      .otherwise(() => 'linux' as const); // fallback
  }

  private getCategoryTitle(category: string): string {
    return match(category)
      .with('essential', () => 'Essential Tools')
      .with('development', () => 'Development Tools')
      .with('optional', () => 'Optional Tools')
      .otherwise(() => category.charAt(0).toUpperCase() + category.slice(1));
  }

    private async checkComponentInstalled(componentId: string): Promise<boolean> {
    const { execSync } = await import('node:child_process');
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const platform = this.detectPlatform();

    try {
      const command = match(componentId)
        .with('homebrew', () => 'brew --version')
        .with('git', () => 'git --version')
        .with('node-volta', 'node-nvm', 'node-asdf', () => 'node --version')
        .with('pnpm', () => 'pnpm --version')
        .with('github-cli', () => 'gh --version')
        .with('docker-desktop', 'docker-engine', () => 'docker --version')
        .with('xcode-cli-tools', () => 'xcode-select -p')
        .with('vscode', () => 'code --version')
        .with('google-cloud-sdk', () => 'gcloud --version')
        .with('ngrok', () => 'ngrok version')
        .with('kubernetes-lens', () => {
          // Check if Lens is installed (application check)
          if (platform === 'macos') {
            return existsSync('/Applications/Lens.app') ? 'echo "installed"' : null;
          }
          if (platform === 'linux') {
            return 'which lens || which lens-desktop';
          }
          if (platform === 'windows') {
            return 'where lens';
          }
          return null;
        })
        .with('figma', () => {
          // Check if Figma is installed (application check)
          if (platform === 'macos') {
            return existsSync('/Applications/Figma.app') ? 'echo "installed"' : null;
          }
          if (platform === 'windows') {
            return 'where figma';
          }
          return null;
        })
        .with('iterm2', () => {
          // Check if iTerm2 is installed (macOS only)
          if (platform === 'macos') {
            return existsSync('/Applications/iTerm.app') ? 'echo "installed"' : null;
          }
          return null;
        })
        .with('alacritty', () => 'alacritty --version')
        .with('kitty', () => 'kitty --version')
        .with('bruno', () => {
          // Check if Bruno is installed (application check)
          if (platform === 'macos') {
            return existsSync('/Applications/Bruno.app') ? 'echo "installed"' : null;
          }
          return 'which bruno';
        })
        .with('postman', () => {
          // Check if Postman is installed (application check)
          if (platform === 'macos') {
            return existsSync('/Applications/Postman.app') ? 'echo "installed"' : null;
          }
          return 'which postman';
        })
        .with('insomnia', () => {
          // Check if Insomnia is installed (application check)
          if (platform === 'macos') {
            return existsSync('/Applications/Insomnia.app') ? 'echo "installed"' : null;
          }
          return 'which insomnia';
        })
        .with('github-access', () => {
          // Check if GitHub SSH key exists or gh is authenticated
          const sshKeyPath = join(process.env['HOME'] || '', '.ssh', 'id_rsa');
          const sshKeyPathEd25519 = join(process.env['HOME'] || '', '.ssh', 'id_ed25519');
          if (existsSync(sshKeyPath) || existsSync(sshKeyPathEd25519)) {
            return 'echo "ssh-key-exists"';
          }
          return 'gh auth status';
        })
        .with('npm-token', () => {
          // Check if NPM token is set in environment variables
          if (process.env['NPM_TOKEN'] || process.env['NODE_AUTH_TOKEN'] || process.env['NPM_AUTH_TOKEN']) {
            return 'echo "npm-token-set"';
          }
          // Also check if .npmrc exists and contains a token
          const npmrcPath = join(process.env['HOME'] || '', '.npmrc');
          if (existsSync(npmrcPath)) {
            try {
              const { readFileSync } = require('node:fs');
              const npmrcContent = readFileSync(npmrcPath, 'utf-8');
              if (npmrcContent.includes('_authToken') || npmrcContent.includes('//registry.npmjs.org/:_authToken')) {
                return 'echo "npmrc-token-exists"';
              }
            } catch {
              // If we can't read the file, assume no token
            }
          }
          return null;
        })
        .with('kubernetes-access', () => {
          // Check if kubectl is installed and configured
          return 'kubectl version --client';
        })
        .with('vpn-access', () => {
          // Check if OpenVPN client is installed
          if (platform === 'macos') {
            return 'which openvpn || which tunnelblick';
          }
          if (platform === 'linux') {
            return 'which openvpn';
          }
          if (platform === 'windows') {
            return 'where openvpn';
          }
          return null;
        })
        .with('google-workspace', () => {
          // This is more of a configuration check - we'll assume it needs manual verification
          return null;
        })
        .otherwise(() => null);

      if (command) {
        execSync(command, { stdio: 'pipe' });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private groupByCategory(components: SetupComponent[]): Record<string, SetupComponent[]> {
    return components.reduce((acc, component) => {
      const { category } = component;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(component);
      return acc;
    }, {} as Record<string, SetupComponent[]>);
  }

  async runFullSetup(essentialOnly = false): Promise<void> {
    console.log(chalk.cyan('🚀 LoveHolidays Development Environment Setup'));
    console.log(
      chalk.gray('This will guide you through setting up all necessary development tools\n')
    );

    const dataManager = DataManager.getInstance();
    const platform = this.detectPlatform();

    // Get available components for the current platform
    const allComponents = await dataManager.getSetupComponents();
    const availableComponents = allComponents.filter((comp) => comp.platforms.includes(platform));

    // Filter by category if essential only
    const components = essentialOnly
      ? availableComponents.filter((comp) => comp.category === 'essential')
      : availableComponents;

    // Group components by category
    const categories = this.groupByCategory(components);

    console.log(chalk.yellow(`Platform detected: ${platform}`));
    console.log(chalk.yellow(`Setup mode: ${essentialOnly ? 'Essential only' : 'Full setup'}\n`));

    // Process each category
    for (const [category, categoryComponents] of Object.entries(categories)) {
      console.log(chalk.yellow(`\n📦 ${this.getCategoryTitle(category)}`));
      console.log(chalk.gray('─'.repeat(40)));

      for (const component of categoryComponents) {
        const shouldInstall = await this.promptForComponent(component);
        if (shouldInstall) {
          await this.installComponent(component);
        }
      }
    }

    console.log(chalk.green('\n✅ Setup completed!'));
    console.log(chalk.gray("Run 'launchpad setup status' to check installation status"));
  }

  async setupComponent(componentId: string): Promise<void> {
    const dataManager = DataManager.getInstance();
    const components = await dataManager.getSetupComponents();
    const component = components.find((comp) => comp.id === componentId);

    if (!component) {
      console.log(chalk.red(`❌ Component '${componentId}' not found`));
      return;
    }

    const platform = this.detectPlatform();
    if (!component.platforms.includes(platform)) {
      console.log(
        chalk.red(`❌ Component '${component.name}' is not available for ${platform}`)
      );
      return;
    }

    console.log(chalk.cyan(`\n🔧 Setting up ${component.name}`));
    console.log(chalk.gray(component.description));

    const isInstalled = await this.checkComponentInstalled(component.id);
    if (isInstalled) {
      console.log(chalk.yellow(`⚠️  ${component.name} is already installed`));
      return;
    }

    await this.installComponent(component);
  }

  async setupKubernetes(): Promise<void> {
    console.log(chalk.cyan('\n☸️  Setting up Kubernetes tools'));
    console.log(chalk.gray('This will install kubectl and Lens IDE\n'));

    const kubernetesComponents = ['kubernetes-lens'];
    for (const componentId of kubernetesComponents) {
      await this.setupComponent(componentId);
    }

    console.log(chalk.green('\n✅ Kubernetes setup completed!'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray('1. Configure kubectl with your cluster credentials'));
    console.log(chalk.gray('2. Open Lens and connect to your clusters'));
  }

  async setupGitHub(): Promise<void> {
    console.log(chalk.cyan('\n🐙 Setting up GitHub access'));
    console.log(chalk.gray('This will install GitHub CLI and help configure authentication\n'));

    await this.setupComponent('github-cli');
    await this.setupComponent('github-access');

    console.log(chalk.green('\n✅ GitHub setup completed!'));
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray("1. Run 'gh auth login' to authenticate"));
    console.log(chalk.gray('2. Configure SSH keys for repository access'));
  }

  async setupApiClient(): Promise<void> {
    console.log(chalk.cyan('\n🔌 Setting up API development tools'));
    console.log(chalk.gray('Choose your preferred API client\n'));

    const apiClients = ['bruno', 'postman', 'insomnia'];
    const choices = apiClients.map((id) => ({
      name: id.charAt(0).toUpperCase() + id.slice(1),
      value: id
    }));

    const { selectedClient } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedClient',
        message: 'Which API client would you like to install?',
        choices
      }
    ]);

    await this.setupComponent(selectedClient);
  }

  async setupTerminal(): Promise<void> {
    const platform = this.detectPlatform();
    console.log(chalk.cyan('\n💻 Setting up enhanced terminal'));
    console.log(chalk.gray('Choose your preferred terminal emulator\n'));

    const terminals = platform === 'macos' ? ['iterm2', 'alacritty', 'kitty'] : ['alacritty', 'kitty'];
    const choices = terminals.map((id) => ({
      name: id === 'iterm2' ? 'iTerm2' : id.charAt(0).toUpperCase() + id.slice(1),
      value: id
    }));

    const { selectedTerminal } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTerminal',
        message: 'Which terminal would you like to install?',
        choices
      }
    ]);

    await this.setupComponent(selectedTerminal);
  }

  async setupLoveHolidays(): Promise<void> {
    console.log(chalk.cyan('\n❤️  Setting up LoveHolidays-specific tools'));
    console.log(chalk.gray('This will configure access to internal tools and services\n'));

    const lhComponents = ['npm-token', 'vpn-access', 'google-workspace', 'kubernetes-access'];
    for (const componentId of lhComponents) {
      await this.setupComponent(componentId);
    }

    console.log(chalk.green('\n✅ LoveHolidays setup completed!'));
  }

  async checkSetupStatus(): Promise<void> {
    console.log(chalk.cyan('\n📊 Development Environment Status'));
    console.log(chalk.gray('─'.repeat(40)));

    const dataManager = DataManager.getInstance();
    const platform = this.detectPlatform();
    const allComponents = await dataManager.getSetupComponents();
    const availableComponents = allComponents.filter((comp) => comp.platforms.includes(platform));

    const categories = this.groupByCategory(availableComponents);

    for (const [category, components] of Object.entries(categories)) {
      console.log(chalk.yellow(`\n${this.getCategoryTitle(category)}:`));
      for (const component of components) {
        const isInstalled = await this.checkComponentInstalled(component.id);
        const status = isInstalled ? chalk.green('✅ Installed') : chalk.red('❌ Not installed');
        console.log(`  ${status} ${component.name}`);
      }
    }
  }

  private async promptForComponent(component: SetupComponent): Promise<boolean> {
    const isInstalled = await this.checkComponentInstalled(component.id);
    if (isInstalled) {
      console.log(chalk.green(`✅ ${component.name} is already installed`));
      return false;
    }

    const { shouldInstall } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInstall',
        message: `Install ${component.name}? (${component.description})`,
        default: component.category === 'essential'
      }
    ]);

    return shouldInstall;
  }

  private async installComponent(component: SetupComponent): Promise<void> {
    console.log(chalk.blue(`🔄 Installing ${component.name}...`));

    const { execSync } = await import('node:child_process');
    const platform = this.detectPlatform();

    try {
      await match(component.id)
        .with('homebrew', async () => {
          if (platform === 'macos') {
            execSync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', { stdio: 'inherit' });
          }
        })
        .with('xcode-cli-tools', async () => {
          if (platform === 'macos') {
            execSync('xcode-select --install', { stdio: 'inherit' });
          }
        })
        .with('git', async () => {
          await match(platform)
            .with('macos', async () => {
              execSync('brew install git', { stdio: 'inherit' });
            })
            .with('linux', async () => {
              execSync('sudo apt-get update && sudo apt-get install -y git', { stdio: 'inherit' });
            })
            .with('windows', async () => {
              console.log(chalk.yellow('Please download Git from: https://git-scm.com/download/win'));
            })
            .exhaustive();
        })
        .with('node-volta', async () => {
          // Install Volta first
          execSync('curl https://get.volta.sh | bash', { stdio: 'inherit' });
          // Source the shell to get volta in PATH
          execSync('source ~/.bashrc || source ~/.zshrc || true', { stdio: 'inherit', shell: '/bin/bash' });
        })
        .with('pnpm', async () => {
          // Try volta first, fallback to npm
          try {
            execSync('volta install pnpm', { stdio: 'inherit' });
          } catch {
            execSync('npm install -g pnpm', { stdio: 'inherit' });
          }
        })
        .with('github-cli', async () => {
          await match(platform)
            .with('macos', async () => {
              execSync('brew install gh', { stdio: 'inherit' });
            })
            .with('linux', async () => {
              execSync('curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt update && sudo apt install gh -y', { stdio: 'inherit' });
            })
            .with('windows', async () => {
              execSync('winget install --id GitHub.cli', { stdio: 'inherit' });
            })
            .exhaustive();
        })
        .with('docker-desktop', async () => {
          await match(platform)
            .with('macos', async () => {
              execSync('brew install --cask docker', { stdio: 'inherit' });
            })
            .with('windows', async () => {
              console.log(chalk.yellow('Please download Docker Desktop from: https://www.docker.com/products/docker-desktop'));
            })
            .otherwise(async () => {
              console.log(chalk.yellow('Please install Docker Engine for your Linux distribution'));
            });
        })
        .with('docker-engine', async () => {
          if (platform === 'linux') {
            execSync('curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh', { stdio: 'inherit' });
          }
        })
        .with('vscode', async () => {
          await match(platform)
            .with('macos', async () => {
              execSync('brew install --cask visual-studio-code', { stdio: 'inherit' });
            })
            .with('linux', async () => {
              execSync('sudo snap install --classic code', { stdio: 'inherit' });
            })
            .with('windows', async () => {
              execSync('winget install -e --id Microsoft.VisualStudioCode', { stdio: 'inherit' });
            })
            .exhaustive();
        })
        .with('bruno', async () => {
          await match(platform)
            .with('macos', async () => {
              execSync('brew install --cask bruno', { stdio: 'inherit' });
            })
            .with('linux', async () => {
              console.log(chalk.yellow('Please download Bruno from: https://www.usebruno.com/downloads'));
            })
            .with('windows', async () => {
              console.log(chalk.yellow('Please download Bruno from: https://www.usebruno.com/downloads'));
            })
            .exhaustive();
        })
        .with('figma', async () => {
          await match(platform)
            .with('macos', async () => {
              execSync('brew install --cask figma', { stdio: 'inherit' });
            })
            .with('windows', async () => {
              execSync('winget install -e --id Figma.Figma', { stdio: 'inherit' });
            })
            .otherwise(async () => {
              console.log(chalk.yellow('Figma is available as a web app at: https://www.figma.com'));
            });
        })
        .with('iterm2', async () => {
          if (platform === 'macos') {
            execSync('brew install --cask iterm2', { stdio: 'inherit' });
          }
        })
        .with('alacritty', async () => {
          await match(platform)
            .with('macos', async () => {
              execSync('brew install --cask alacritty', { stdio: 'inherit' });
            })
            .with('linux', async () => {
              execSync('sudo apt-get install -y alacritty', { stdio: 'inherit' });
            })
            .with('windows', async () => {
              execSync('winget install -e --id Alacritty.Alacritty', { stdio: 'inherit' });
            })
            .exhaustive();
        })
        .otherwise(async () => {
          console.log(chalk.yellow(`Installation for ${component.name} is not yet implemented`));
          console.log(chalk.gray('This component requires manual installation'));
        });

      console.log(chalk.green(`✅ ${component.name} installed successfully`));

      // Add component-specific post-install messages
      match(component.id)
        .with('homebrew', () => {
          console.log(chalk.gray("   Run 'brew --version' to verify installation"));
        })
        .with('node-volta', () => {
          console.log(chalk.gray("   Restart your terminal or run: source ~/.bashrc"));
          console.log(chalk.gray("   Then run 'volta install node@lts' to install the latest LTS Node.js"));
          console.log(chalk.gray("   Run 'volta install pnpm' to install PNPM via Volta"));
        })
        .with('docker-desktop', () => {
          console.log(chalk.gray('   Start Docker Desktop from Applications'));
        })
        .with('github-cli', () => {
          console.log(chalk.gray("   Run 'gh auth login' to authenticate with GitHub"));
        })
        .with('npm-token', () => {
          console.log(chalk.gray('   Add your NPM token to ~/.npmrc'));
        })
        .with('vpn-access', () => {
          console.log(chalk.gray('   Download VPN config from IT support'));
        })
        .with('github-access', () => {
          console.log(chalk.gray('   Set up SSH keys and personal access tokens'));
          console.log(chalk.gray('   Visit: https://github.com/settings/keys'));
        })
        .with('google-workspace', () => {
          console.log(chalk.gray('   Verify access to Google Workspace'));
          console.log(chalk.gray('   Contact IT if you need access'));
        })
        .otherwise(() => {
          // No specific post-install message
        });

    } catch (error) {
      console.error(chalk.red(`❌ Failed to install ${component.name}: ${error}`));
      console.log(chalk.gray('You may need to install this component manually'));
    }
  }
}
