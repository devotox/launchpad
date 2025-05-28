import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { match } from 'ts-pattern';

import { ComponentDetector } from '@/commands/setup/detectors/component-detector';
import { ComponentInstaller } from '@/commands/setup/installers/component-installer';
import { DataManager } from '@/utils/config/data-manager';

import type { Platform, SetupComponent, ChoiceGroup } from '@/utils/config/types';

export class SetupCommand {
  private detector: ComponentDetector;
  private installer: ComponentInstaller;

  constructor() {
    this.detector = new ComponentDetector();
    this.installer = new ComponentInstaller();
  }

  getCommand(): Command {
    const setupCmd = new Command('setup').description('Set up development tools and environment');

    // Main setup commands
    setupCmd
      .command('all')
      .description('Interactive setup of all development tools')
      .action(async () => {
        await this.runFullSetup();
      });

    setupCmd
      .command('essential')
      .description('Interactive setup of essential development tools only')
      .action(async () => {
        await this.runEssentialChoiceSetup();
      });

    setupCmd
      .command('status')
      .description('Check installation status of all tools')
      .action(async () => {
        await this.checkSetupStatus();
      });

    // Add a hook to dynamically add commands when the setup command is parsed
    setupCmd.hook('preAction', async () => {
      await this.addDynamicCommands(setupCmd);
    });

    return setupCmd;
  }

  private async addDynamicCommands(setupCmd: Command): Promise<void> {
    // Check if commands are already added to avoid duplicates
    if (setupCmd.commands.length > 3) {
      return;
    }

    try {
      const dataManager = DataManager.getInstance();
      const components = await dataManager.getSetupComponents();
      const platform = this.detectPlatform();

      // Filter components available for current platform
      const availableComponents = components.filter((comp) =>
        comp.platforms.includes(platform)
      );

      // Add individual component commands
      for (const component of availableComponents) {
        setupCmd
          .command(component.id)
          .description(`Install ${component.name}`)
          .action(async () => {
            await this.setupComponent(component.id);
          });
      }

      // Add grouped commands based on choice groups
      const choiceGroups = this.getChoiceGroups(availableComponents);
      for (const [, group] of Object.entries(choiceGroups)) {
        if (group.components.length > 1) {
          setupCmd
            .command(group.name.toLowerCase().replace(/\s+/g, '-'))
            .description(`Interactive choice of ${group.name.toLowerCase()}`)
            .action(async () => {
              await this.setupChoiceGroup(group);
            });
        }
      }
    } catch {
      console.warn(chalk.yellow('Warning: Could not load setup components for dynamic commands'));
    }
  }

  private detectPlatform(): Platform {
    return match(process.platform)
      .with('darwin', () => 'macos' as const)
      .with('linux', () => 'linux' as const)
      .with('win32', () => 'windows' as const)
      .otherwise(() => 'linux' as const); // fallback
  }

  private getChoiceGroups(components: SetupComponent[]) {
    const groups: Record<string, {
      id: string;
      name: string;
      description: string;
      required: boolean;
      mutuallyExclusive: boolean;
      components: SetupComponent[];
    }> = {};

    for (const component of components) {
      if (component.choiceGroup) {
        const groupId = component.choiceGroup.id;
        if (!groups[groupId]) {
          groups[groupId] = {
            id: groupId,
            name: component.choiceGroup.name,
            description: component.choiceGroup.description,
            required: component.choiceGroup.required ?? false,
            mutuallyExclusive: component.choiceGroup.mutuallyExclusive ?? false,
            components: []
          };
        }
        groups[groupId].components.push(component);
      }
    }

    return groups;
  }

  async runFullSetup(): Promise<void> {
    console.log(chalk.cyan('🚀 LoveHolidays Development Environment Setup'));
    console.log(
      chalk.gray('This will guide you through setting up all necessary development tools\n')
    );

    const dataManager = DataManager.getInstance();
    const platform = this.detectPlatform();

    // Get available components for the current platform
    const allComponents = await dataManager.getSetupComponents();
    const availableComponents = allComponents.filter((comp) => comp.platforms.includes(platform));

    // Group components by category
    const categories = this.groupByCategory(availableComponents);

    console.log(chalk.yellow(`Platform detected: ${platform}`));
    console.log(chalk.yellow('Setup mode: Full setup\n'));

    // Process each category
    for (const [category, categoryComponents] of Object.entries(categories)) {
      console.log(chalk.yellow(`\n📦 ${this.getCategoryTitle(category)}`));
      console.log(chalk.gray('─'.repeat(40)));

      for (const component of categoryComponents) {
        const shouldInstall = await this.promptForComponent(component);
        if (shouldInstall) {
          await this.installer.installComponent(component, platform);
        }
      }
    }

    console.log(chalk.green('\n✅ Setup completed!'));
    console.log(chalk.gray("Run 'launchpad setup status' to check installation status"));
  }

  async runEssentialChoiceSetup(): Promise<void> {
    console.log(chalk.cyan('🚀 LoveHolidays Essential Development Setup (Choice-based)'));
    console.log(
      chalk.gray('This will guide you through setting up essential tools with choices for alternatives\n')
    );

    const dataManager = DataManager.getInstance();
    const platform = this.detectPlatform();

    // Get available essential components for the current platform
    const allComponents = await dataManager.getSetupComponents();
    const essentialComponents = allComponents.filter(
      (comp) => comp.category === 'essential' && comp.platforms.includes(platform)
    );

    console.log(chalk.yellow(`Platform detected: ${platform}`));
    console.log(chalk.yellow('Setup mode: Essential with choices\n'));

    // Group components by choice group
    const choiceGroups = this.getChoiceGroups(essentialComponents);
    const singleComponents: SetupComponent[] = [];

    for (const component of essentialComponents) {
      if (!component.choiceGroup) {
        singleComponents.push(component);
      }
    }

    console.log(chalk.yellow('📦 Essential Tools with Choices'));
    console.log(chalk.gray('─'.repeat(40)));

    // Handle choice groups
    for (const [, group] of Object.entries(choiceGroups)) {
      await this.handleChoiceGroup(group, platform);
    }

    console.log(chalk.yellow('\n📦 Other Essential Tools'));
    console.log(chalk.gray('─'.repeat(40)));

    // Handle single essential components
    for (const component of singleComponents) {
      const shouldInstall = await this.promptForComponent(component);
      if (shouldInstall) {
        await this.installer.installComponent(component, platform);
      }
    }

    console.log(chalk.green('\n✅ Essential setup with choices completed!'));
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
      console.log(chalk.red(`❌ Component '${component.name}' is not available for ${platform}`));
      return;
    }

    console.log(chalk.cyan(`\n🔧 Setting up ${component.name}`));
    console.log(chalk.gray(component.description));

    const isInstalled = await this.detector.checkComponentInstalled(component, platform);
    if (isInstalled) {
      console.log(chalk.yellow(`⚠️  ${component.name} is already installed`));
      return;
    }

    await this.installer.installComponent(component, platform);
  }

  async setupChoiceGroup(group: {
    id: string;
    name: string;
    description: string;
    required: boolean;
    mutuallyExclusive: boolean;
    components: SetupComponent[];
  }): Promise<void> {
    const platform = this.detectPlatform();
    await this.handleChoiceGroup(group, platform);
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
        const isInstalled = await this.detector.checkComponentInstalled(component, platform);
        const status = isInstalled ? chalk.green('✅ Installed') : chalk.red('❌ Not installed');
        console.log(`  ${status} ${component.name}`);
      }
    }
  }

  private async handleChoiceGroup(group: ChoiceGroup, platform: Platform): Promise<void> {
    console.log(chalk.cyan(`\n🔧 ${group.name}`));
    console.log(chalk.gray(group.description));

    // Check if any component in this group is already installed
    const installedComponents = [];
    for (const component of group.components) {
      const isInstalled = await this.detector.checkComponentInstalled(component, platform);
      if (isInstalled) {
        installedComponents.push(component);
      }
    }

    if (installedComponents.length > 0) {
      console.log(chalk.green(`✅ Already installed: ${installedComponents.map(c => c.name).join(', ')}`));

      // If mutually exclusive and something is installed, skip this group
      if (group.mutuallyExclusive) {
        return;
      }
    }

    // Show choices for this group
    const choices = group.components.map((comp: SetupComponent) => ({
      name: `${comp.name} - ${comp.description}`,
      value: comp.id,
      short: comp.name
    }));

    if (!group.required) {
      choices.push({
        name: 'Skip this group',
        value: 'skip',
        short: 'Skip'
      });
    }

    const { selectedComponent } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedComponent',
        message: `Choose your preferred ${group.name.toLowerCase()}:`,
        choices
      }
    ]);

    if (selectedComponent !== 'skip') {
      const component = group.components.find((comp: SetupComponent) => comp.id === selectedComponent);
      if (component) {
        await this.installer.installComponent(component, platform);
      }
    }
  }

  private async promptForComponent(component: SetupComponent): Promise<boolean> {
    const platform = this.detectPlatform();
    const isInstalled = await this.detector.checkComponentInstalled(component, platform);
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

  private groupByCategory(components: SetupComponent[]): Record<string, SetupComponent[]> {
    return components.reduce(
      (acc, component) => {
        const { category } = component;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(component);
        return acc;
      },
      {} as Record<string, SetupComponent[]>
    );
  }

  private getCategoryTitle(category: string): string {
    return match(category)
      .with('essential', () => 'Essential Tools')
      .with('development', () => 'Development Tools')
      .with('optional', () => 'Optional Tools')
      .otherwise(() => `${category.charAt(0).toUpperCase()}${category.slice(1)} Tools`);
  }
}
