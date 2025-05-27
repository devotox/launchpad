import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { DataManager } from '@/utils/config';

import type { SetupComponent } from '@/utils/config';

export class SetupCommand {
  getCommand(): Command {
    const setupCmd = new Command('setup').description('Set up development tools and environment');

    // Main setup command
    setupCmd
      .command('all')
      .description('Interactive setup of all development tools')
      .option('--essential-only', 'Only install essential tools')
      .action(async (options) => {
        await this.runFullSetup(options.essentialOnly);
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
      .description('Install Node.js and NPM')
      .action(async () => {
        await this.setupComponent('node-nvm');
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
    switch (process.platform) {
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      case 'win32':
        return 'windows';
      default:
        return 'linux'; // fallback
    }
  }

  private getCategoryTitle(category: string): string {
    switch (category) {
      case 'essential':
        return 'Essential Tools';
      case 'development':
        return 'Development Tools';
      case 'optional':
        return 'Optional Tools';
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }

  private async checkComponentInstalled(_componentId: string): Promise<boolean> {
    // Mock implementation - in a real scenario, this would check if the component is actually installed
    // For now, we'll return false to indicate nothing is installed yet
    return false;
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
          await this.mockInstallComponent(component);
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

    await this.mockInstallComponent(component);
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

  private async mockInstallComponent(component: SetupComponent): Promise<void> {
    console.log(chalk.blue(`🔄 Installing ${component.name}...`));

    // Simulate installation time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(chalk.green(`✅ ${component.name} installed successfully`));

    // Add component-specific post-install messages
    switch (component.id) {
      case 'homebrew':
        console.log(chalk.gray("   Run 'brew --version' to verify installation"));
        break;
      case 'node-nvm':
        console.log(chalk.gray("   Run 'nvm install --lts' to install the latest LTS Node.js"));
        break;
      case 'docker-desktop':
        console.log(chalk.gray('   Start Docker Desktop from Applications'));
        break;
      case 'github-cli':
        console.log(chalk.gray("   Run 'gh auth login' to authenticate with GitHub"));
        break;
      case 'npm-token':
        console.log(chalk.gray('   Add your NPM token to ~/.npmrc'));
        break;
      case 'vpn-access':
        console.log(chalk.gray('   Download VPN config from IT support'));
        break;
    }
  }
}
