import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { ConfigManager } from '@/utils/config/manager';
import { DataManager } from '@/utils/config/data-manager';
import { RepositoryManager } from '@/utils/repository';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

type InitAnswers = {
  name: string;
  email: string;
  team: string;
  workspaceName: string;
  workspacePath: string;
  cloneRepos: boolean;
  cloneType?: 'required' | 'all';
  setupDependencies?: boolean;
  setupGitHub?: boolean;
};

type ConfigDownloadOptions = {
  provider: string;
  gistId?: string;
  token?: string;
  fileName?: string;
  repository?: string;
  branch?: string;
  path?: string;
  localPath?: string;
};

type InitCheckpoint = {
  version: string;
  timestamp: string;
  step: 'essential-tools' | 'config-download' | 'user-input' | 'config-creation' | 'github-auth' | 'repo-cloning' | 'completed';
  answers?: Partial<InitAnswers>;
  configDownloadOptions?: ConfigDownloadOptions;
  needsSetup?: boolean;
  force?: boolean;
};

export class InitCommand {
  private checkpointFile: string;

  constructor() {
    const configManager = ConfigManager.getInstance();
    this.checkpointFile = join(configManager.getConfigDir(), '.init-checkpoint.json');
  }

  getCommand(): Command {
    return new Command('init')
      .description('Initialize your developer workspace')
      .option('--force', 'Force re-initialization even if config exists')
      .option('--resume', 'Resume from last checkpoint if available')
      .option('--clean', 'Remove any existing checkpoint and start fresh')
      .action(async (options) => {
        await this.execute(options.force, options.resume, options.clean);
      });
  }

  async execute(force = false, resume = false, clean = false): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();

    // Handle clean option
    if (clean) {
      await this.clearCheckpoint();
      console.log(chalk.green('✅ Checkpoint cleared. Starting fresh initialization.'));
    }

    // Check for existing checkpoint
    const checkpoint = await this.loadCheckpoint();
    if (checkpoint && !clean && !force) {
      console.log(chalk.yellow('🔄 Previous initialization was interrupted.'));
      console.log(chalk.gray(`Last step: ${checkpoint.step}`));
      console.log(chalk.gray(`Timestamp: ${new Date(checkpoint.timestamp).toLocaleString()}`));

      const { shouldResume } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldResume',
          message: 'Would you like to resume from where you left off?',
          default: true
        }
      ]);

      if (shouldResume) {
        return this.resumeFromCheckpoint(checkpoint);
      }
      await this.clearCheckpoint();
    }

    // Check if config already exists
    if (!force && (await configManager.hasConfig())) {
      const existingConfig = await configManager.getConfig();
      console.log(chalk.yellow('⚠️  Launchpad is already initialized!'));
      console.log(chalk.gray(`Config found at: ${configManager.getConfigPath()}`));
      console.log(chalk.gray(`Current team: ${existingConfig?.user.team}`));
      console.log(chalk.gray('Use --force to re-initialize or --resume to continue setup'));
      return;
    }

    console.log(chalk.cyan('🚀 Welcome to LoveHolidays Launchpad!'));
    console.log(chalk.gray("Let's set up your developer workspace...\n"));

    // Start fresh initialization
    await this.runFullInitialization(force);
  }

  private async runFullInitialization(force = false): Promise<void> {
    try {
      // Step 1: Essential tools check
      await this.saveCheckpoint({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        step: 'essential-tools',
        force
      });

      const needsSetup = await this.checkEssentialTools();
      if (needsSetup) {
        console.log(chalk.yellow('⚠️  Some essential development tools are missing.'));
        console.log(chalk.gray('Launchpad requires certain tools to be installed first.\n'));

        const { runSetup } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'runSetup',
            message: 'Would you like to run the setup process now? (Recommended)',
            default: true
          }
        ]);

        if (runSetup) {
          console.log(chalk.cyan('\n🔧 Running essential tools setup...'));
          console.log(
            chalk.gray(
              'This will install: Homebrew, Git, Node.js (via Volta), PNPM, and GitHub CLI\n'
            )
          );

          // Import and run setup command
          const { SetupCommand } = await import('@/commands/setup/core/setup-command');
          const setupCommand = new SetupCommand();
          await setupCommand.runEssentialChoiceSetup();

          console.log(chalk.green('\n✅ Essential tools setup completed!'));
          console.log(chalk.gray('Continuing with workspace initialization...\n'));
        } else {
          console.log(
            chalk.yellow('\n⚠️  Continuing without setup. Some features may not work properly.')
          );
          console.log(
            chalk.gray('You can run setup later with: launchpad setup essential\n')
          );
        }
      }

      // Step 2: Download initial configuration
      await this.saveCheckpoint({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        step: 'config-download',
        needsSetup,
        force
      });

      await this.downloadInitialConfig();

      // Step 3: User input
      await this.saveCheckpoint({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        step: 'user-input',
        needsSetup,
        force
      });

      const answers = await this.collectUserInput();

      // Step 4: Config creation
      await this.saveCheckpoint({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        step: 'config-creation',
        answers,
        needsSetup,
        force
      });

      await this.createConfiguration(answers);

      // Step 5: GitHub authentication
      if (answers.setupGitHub) {
        await this.saveCheckpoint({
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          step: 'github-auth',
          answers,
          needsSetup,
          force
        });

        await this.setupGitHubAuthentication();
      }

      // Step 6: Repository cloning
      if (answers.cloneRepos) {
        await this.saveCheckpoint({
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          step: 'repo-cloning',
          answers,
          needsSetup,
          force
        });

        await this.handleRepositoryCloning(answers);
      }

      // Step 7: Completion
      await this.saveCheckpoint({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        step: 'completed',
        answers,
        needsSetup,
        force
      });

      await this.showCompletionMessage(answers);

      // Clear checkpoint on successful completion
      await this.clearCheckpoint();

    } catch (error) {
      console.error(chalk.red('\n❌ Initialization failed:'), error);
      console.log(chalk.yellow('\n💡 Your progress has been saved.'));
      console.log(chalk.gray('Run "launchpad init --resume" to continue from where you left off.'));
      throw error;
    }
  }

  private async resumeFromCheckpoint(checkpoint: InitCheckpoint): Promise<void> {
    console.log(chalk.cyan(`\n🔄 Resuming initialization from: ${checkpoint.step}`));
    console.log(chalk.gray('─'.repeat(50)));

    const dataManager = DataManager.getInstance();

    try {
      switch (checkpoint.step) {
        case 'essential-tools':
          console.log(chalk.gray('Resuming from essential tools check...'));
          await this.runFullInitialization(checkpoint.force);
          break;

        case 'config-download': {
          console.log(chalk.gray('Resuming from configuration download...'));
          await this.downloadInitialConfig();
          const answers1 = await this.collectUserInput();
          await this.createConfiguration(answers1);
          if (answers1.setupGitHub) await this.setupGitHubAuthentication();
          if (answers1.cloneRepos) await this.handleRepositoryCloning(answers1);
          await this.showCompletionMessage(answers1);
          break;
        }

        case 'user-input': {
          console.log(chalk.gray('Resuming from user input collection...'));
          const answers2 = await this.collectUserInput();
          await this.createConfiguration(answers2);
          if (answers2.setupGitHub) await this.setupGitHubAuthentication();
          if (answers2.cloneRepos) await this.handleRepositoryCloning(answers2);
          await this.showCompletionMessage(answers2);
          break;
        }

        case 'config-creation': {
          if (!checkpoint.answers) {
            console.log(chalk.yellow('⚠️  No saved answers found. Starting from user input...'));
            const answers3 = await this.collectUserInput();
            await this.createConfiguration(answers3);
            if (answers3.setupGitHub) await this.setupGitHubAuthentication();
            if (answers3.cloneRepos) await this.handleRepositoryCloning(answers3);
            await this.showCompletionMessage(answers3);
          } else {
            console.log(chalk.gray('Resuming from configuration creation...'));
            const answers = checkpoint.answers as InitAnswers;
            await this.createConfiguration(answers);
            if (answers.setupGitHub) await this.setupGitHubAuthentication();
            if (answers.cloneRepos) await this.handleRepositoryCloning(answers);
            await this.showCompletionMessage(answers);
          }
          break;
        }

        case 'github-auth': {
          if (!checkpoint.answers) {
            console.log(chalk.yellow('⚠️  No saved answers found. Cannot resume GitHub auth.'));
            return;
          }
          console.log(chalk.gray('Resuming from GitHub authentication...'));
          const answers4 = checkpoint.answers as InitAnswers;
          if (answers4.setupGitHub) await this.setupGitHubAuthentication();
          if (answers4.cloneRepos) await this.handleRepositoryCloning(answers4);
          await this.showCompletionMessage(answers4);
          break;
        }

        case 'repo-cloning': {
          if (!checkpoint.answers) {
            console.log(chalk.yellow('⚠️  No saved answers found. Cannot resume repository cloning.'));
            return;
          }
          console.log(chalk.gray('Resuming from repository cloning...'));
          const answers5 = checkpoint.answers as InitAnswers;
          if (answers5.cloneRepos) await this.handleRepositoryCloning(answers5);
          await this.showCompletionMessage(answers5);
          break;
        }

        case 'completed':
          console.log(chalk.green('✅ Initialization was already completed!'));
          if (checkpoint.answers) {
            await this.showCompletionMessage(checkpoint.answers as InitAnswers);
          }
          break;

        default:
          console.log(chalk.yellow('⚠️  Unknown checkpoint step. Starting fresh...'));
          await this.runFullInitialization(checkpoint.force);
      }

      // Clear checkpoint on successful completion
      await this.clearCheckpoint();

    } catch (error) {
      console.error(chalk.red('\n❌ Resume failed:'), error);
      console.log(chalk.yellow('\n💡 Your progress has been saved.'));
      console.log(chalk.gray('You can try resuming again with: launchpad init --resume'));
      throw error;
    }
  }

  private async collectUserInput(): Promise<InitAnswers> {
    const dataManager = DataManager.getInstance();

    let teamChoices = await dataManager.getTeamChoices();

    // Always add a "None/Skip" option for users who don't have teams yet
    if (teamChoices.length === 0) {
      console.log(chalk.yellow('\n⚠️  No teams found in configuration.'));
      console.log(chalk.gray('You can set up your team later with: launchpad admin teams add'));
      console.log('');
    }

    // Add the "None" option to allow users to skip team selection
    teamChoices = [
      ...teamChoices,
      {
        name: teamChoices.length === 0
          ? 'None - Set up team later (Recommended for now)'
          : 'None - Set up team later',
        value: 'none'
      }
    ];

    return inquirer.prompt<InitAnswers>([
      {
        type: 'input',
        name: 'name',
        message: "What's your name?",
        validate: (input: string) => input.length > 0 || 'Please enter your name'
      },
      {
        type: 'input',
        name: 'email',
        message: "What's your email address?",
        default: (answers: Partial<InitAnswers>) => {
          const name = answers.name?.toLowerCase().trim();
          if (!name) return '';
          const nameParts = name.split(/\s+/);
          if (nameParts.length >= 2) {
            return `${nameParts[0]}.${nameParts[nameParts.length - 1]}@loveholidays.com`;
          }
          return `${name}@loveholidays.com`;
        },
        validate: (input: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) || 'Please enter a valid email address';
        }
      },
      {
        type: 'list',
        name: 'team',
        message: 'Which team are you joining?',
        choices: teamChoices
      },
      {
        type: 'input',
        name: 'workspaceName',
        message: 'What would you like to name your workspace?',
        default: (answers: Partial<InitAnswers>) => {
          const emailParts = answers.email?.split('@') || [];
          const emailDomain = emailParts.length > 1 ? emailParts[1] : null;
          return emailDomain ? emailDomain.split('.')[0] || 'workspace' : 'workspace';
        },
        validate: (input: string) => input.length > 0 || 'Please enter a workspace name'
      },
      {
        type: 'input',
        name: 'workspacePath',
        message: 'Where would you like to create your workspace?',
        default: (answers: Partial<InitAnswers>) =>
          `${process.env['HOME']}/Documents/${answers.workspaceName || 'workspace'}`,
        validate: (input: string) => input.length > 0 || 'Please enter a workspace path'
      },
      {
        type: 'confirm',
        name: 'setupGitHub',
        message: 'Would you like to verify GitHub authentication (required for repository access)?',
        default: true,
        when: () => true // Always ask this question
      },
      {
        type: 'confirm',
        name: 'cloneRepos',
        message: "Would you like to clone your team's repositories?",
        default: true,
        when: (answers) => answers.setupGitHub
      },
      {
        type: 'list',
        name: 'cloneType',
        message: 'Which repositories would you like to clone?',
        choices: [
          { name: 'Required repositories only (recommended)', value: 'required' },
          { name: 'All team repositories', value: 'all' }
        ],
        when: (answers) => answers.cloneRepos
      },
      {
        type: 'confirm',
        name: 'setupDependencies',
        message: 'Would you like to automatically install dependencies?',
        default: true,
        when: (answers) => answers.cloneRepos
      }
    ]);
  }

  private async createConfiguration(answers: InitAnswers): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();

    // Create config
    const config = await configManager.createDefaultConfig(
      {
        name: answers.name,
        email: answers.email,
        team: answers.team
      },
      answers.workspaceName
    );

    // Update workspace path
    await configManager.updateConfig({
      workspace: {
        name: answers.workspaceName,
        path: answers.workspacePath,
        repositories: []
      },
      preferences: {
        ...config.preferences,
        autoClone: answers.cloneRepos,
        setupDependencies: answers.setupDependencies || false
      }
    });

    console.log(chalk.green('\n✅ Configuration saved successfully!'));
    console.log(chalk.gray(`Config location: ${configManager.getConfigPath()}`));

    // Get team information (if a team was selected)
    let team = null;
    if (answers.team !== 'none') {
      team = await dataManager.getTeamById(answers.team);
      if (!team) {
        console.error(chalk.red('❌ Team not found'));
        return;
      }
    }

    if (team) {
      console.log(chalk.cyan(`\n👥 Welcome to the ${team.name} team!`));
      console.log(chalk.gray(`Team lead: ${team.lead}`));
      console.log(chalk.gray(`Main Slack channel: ${team.slackChannels.main}`));
      if (team.slackChannels.standup) {
        console.log(chalk.gray(`Standup channel: ${team.slackChannels.standup}`));
      }
      if (team.slackChannels.alerts) {
        console.log(chalk.gray(`Alerts channel: ${team.slackChannels.alerts}`));
      }
      if (team.slackChannels.social) {
        console.log(chalk.gray(`Social channel: ${team.slackChannels.social}`));
      }
      // Handle both old array format and new unified tools structure
      if (Array.isArray(team.tools)) {
        console.log(chalk.gray(`Tools: ${team.tools.join(', ')}`));
      } else if (team.tools && typeof team.tools === 'object') {
        // New unified structure - show count of categories
        const categoryCount = Object.keys(team.tools).length;
        console.log(chalk.gray(`Tools: ${categoryCount} categories configured`));
      } else {
        console.log(chalk.gray('Tools: None configured'));
      }
      console.log(chalk.gray(`Default branch: ${team.config.defaultBranch || 'main'}`));
      console.log(chalk.gray(`CI/CD: ${team.config.cicdPipeline || 'Not configured'}`));
      if (team.config.monitoringTools && Array.isArray(team.config.monitoringTools)) {
        console.log(chalk.gray(`Monitoring: ${team.config.monitoringTools.join(', ')}`));
      } else {
        console.log(chalk.gray('Monitoring: Not configured'));
      }
      if (team.config.communicationPreferences?.standupTime) {
        console.log(
          chalk.gray(
            `Daily standup: ${team.config.communicationPreferences.standupTime} (${team.config.communicationPreferences.timezone || 'UTC'})`
          )
        );
      }
    } else {
      console.log(chalk.cyan('\n👤 Individual Setup Complete!'));
      console.log(chalk.gray('You can join a team later with: launchpad admin teams add'));
    }
  }

  private async handleRepositoryCloning(answers: InitAnswers): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();

    // Get team information
    let team = null;
    if (answers.team !== 'none') {
      team = await dataManager.getTeamById(answers.team);
    }

    if (!team) {
      console.log(chalk.yellow('\n⚠️  No team selected. Skipping repository cloning.'));
      return;
    }

    console.log(chalk.cyan('\n📦 Cloning Team Repositories'));
    console.log(chalk.gray('─'.repeat(30)));

    const repoManager = new RepositoryManager(answers.workspacePath);
    const onlyRequired = answers.cloneType === 'required';

    try {
      const clonedRepos = await repoManager.cloneRepositories(team.repositories, onlyRequired);

      // Update config with cloned repositories
      await configManager.updateConfig({
        workspace: {
          name: answers.workspaceName,
          path: answers.workspacePath,
          repositories: clonedRepos
        }
      });

      // Setup dependencies if requested
      if (answers.setupDependencies && clonedRepos.length > 0) {
        await repoManager.setupRepositories(clonedRepos);
      }

      if (clonedRepos.length > 0) {
        console.log(chalk.green(`\n✅ Successfully set up ${clonedRepos.length} repositories!`));
      } else {
        console.log(chalk.yellow('\n⚠️  No repositories were cloned.'));
        console.log(chalk.gray('This might be due to authentication issues.'));
        console.log(chalk.cyan('\n🔧 Troubleshooting:'));
        console.log(chalk.gray('1. Install GitHub CLI if not already installed:'));
        console.log(chalk.gray('   • macOS: brew install gh (requires Homebrew)'));
        console.log(chalk.gray('   • Linux: https://cli.github.com/'));
        console.log(chalk.gray('   • Windows: winget install --id GitHub.cli'));
        console.log(chalk.gray('2. Authenticate with GitHub: gh auth login'));
        console.log(chalk.gray('3. Set up SAML SSO for LoveHolidays organization'));
        console.log(chalk.gray('4. Test access with: gh repo list loveholidays'));
        console.log(chalk.gray('5. Try cloning manually: git clone [repo-url]'));
        console.log(chalk.gray('6. Re-run init with: launchpad init --force'));
      }
    } catch (error) {
      console.log(chalk.red('\n❌ Repository cloning encountered issues.'));
      console.log(chalk.gray(`Error: ${error}`));
      console.log(chalk.cyan('\n🔧 Next Steps:'));
      console.log(chalk.gray('1. Complete GitHub SSO setup if not done'));
      console.log(chalk.gray('2. Test repository access manually'));
      console.log(chalk.gray('3. Re-run initialization: launchpad init --force'));
    }
  }

  private async showCompletionMessage(answers: InitAnswers): Promise<void> {
    const dataManager = DataManager.getInstance();

    // Get team information for onboarding resources
    let team = null;
    if (answers.team !== 'none') {
      team = await dataManager.getTeamById(answers.team);
    }

    // Show onboarding resources
    if (team) {
      console.log(chalk.cyan('\n📚 Essential Onboarding Resources:'));
      const onboardingDocs = await dataManager.getAllOnboardingDocs(team.id);
      onboardingDocs.forEach((doc: string, index: number) => {
        if (index === 0) {
          // Highlight the main onboarding guide
          console.log(chalk.green(`  🎯 ${doc}`));
        } else {
          console.log(chalk.gray(`  • ${doc}`));
        }
      });
    }

    console.log(chalk.cyan('\n🎯 Next Steps:'));
    console.log(chalk.green('  1. 📖 Start with the MMB Team Onboarding Guide (link above)'));
    console.log(chalk.gray("  2. Join your team's Slack channels"));
    if (!answers.setupGitHub) {
      console.log(chalk.yellow('  3. 🔐 Set up GitHub authentication: gh auth login'));
      console.log(chalk.yellow('  4. 🔒 Configure SAML SSO for LoveHolidays organization'));
      console.log(chalk.gray('  5. Set up your development environment: launchpad setup all'));
    } else {
      console.log(
        chalk.gray('  3. Set up your development environment (if not done): launchpad setup all')
      );
    }
    if (answers.cloneRepos) {
      const stepNum = answers.setupGitHub ? 4 : 6;
      console.log(
        chalk.gray(`  ${stepNum}. Navigate to your workspace: cd ${answers.workspacePath}`)
      );
      console.log(chalk.gray(`  ${stepNum + 1}. Explore the codebase and run the applications`));
    } else {
      const stepNum = answers.setupGitHub ? 4 : 6;
      console.log(
        chalk.gray(`  ${stepNum}. Run "launchpad create project" to start a new project`)
      );
    }
    const finalStep = answers.cloneRepos
      ? answers.setupGitHub
        ? 6
        : 8
      : answers.setupGitHub
        ? 5
        : 7;
    console.log(chalk.gray(`  ${finalStep}. Attend your first team standup`));

    console.log(chalk.green(`\nWelcome to LoveHolidays, ${answers.name}! 🎉`));
    console.log(
      chalk.cyan("💡 Tip: Use 'launchpad team --help' to explore team-specific commands")
    );
  }

  private async saveCheckpoint(checkpoint: InitCheckpoint): Promise<void> {
    try {
      const configManager = ConfigManager.getInstance();
      await configManager.ensureConfigDir();
      await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
      // Don't fail the entire process if checkpoint saving fails
      console.warn(chalk.yellow('⚠️  Could not save checkpoint:'), error);
    }
  }

  private async loadCheckpoint(): Promise<InitCheckpoint | null> {
    try {
      const content = await fs.readFile(this.checkpointFile, 'utf-8');
      return JSON.parse(content) as InitCheckpoint;
    } catch {
      return null;
    }
  }

  private async clearCheckpoint(): Promise<void> {
    try {
      await fs.unlink(this.checkpointFile);
    } catch {
      // File doesn't exist or can't be deleted - that's fine
    }
  }

  private async setupGitHubAuthentication(): Promise<void> {
    console.log(chalk.cyan('\n🔐 Verifying GitHub Authentication'));
    console.log(chalk.gray('─'.repeat(40)));

    try {
      // Check if gh CLI is installed
      const { execSync } = await import('node:child_process');

      try {
        execSync('gh --version', { stdio: 'pipe' });
      } catch {
        console.log(chalk.yellow('⚠️  GitHub CLI (gh) is not installed.'));
        console.log(chalk.gray('Installing GitHub CLI...'));

        // Try to install gh CLI based on platform
        const { platform } = process;
        if (platform === 'darwin') {
          // Check if Homebrew is installed first
          try {
            execSync('brew --version', { stdio: 'pipe' });
            console.log(chalk.cyan('📦 Installing GitHub CLI via Homebrew...'));
            execSync('brew install gh', { stdio: 'inherit' });
            console.log(chalk.green('✅ GitHub CLI installed successfully!'));
          } catch {
            console.log(chalk.yellow('⚠️  Homebrew not found or GitHub CLI installation failed.'));
            console.log(chalk.gray('Please install GitHub CLI manually:'));
            console.log(chalk.blue('• Download from: https://cli.github.com/'));
            console.log(chalk.blue('• Or install Homebrew first: https://brew.sh/'));
            console.log(chalk.gray('• Then run: brew install gh'));

            const { continueWithoutGH } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'continueWithoutGH',
                message: 'Continue setup without GitHub CLI? (You can install it later)',
                default: true
              }
            ]);

            if (!continueWithoutGH) {
              console.log(
                chalk.gray('Setup cancelled. Install GitHub CLI and re-run: launchpad init --force')
              );
              return;
            }

            console.log(
              chalk.yellow('⚠️  Skipping GitHub authentication. Repository cloning may fail.')
            );
            console.log(chalk.gray('After installing GitHub CLI, run: gh auth login'));
            return;
          }
        } else if (platform === 'linux') {
          console.log(chalk.yellow('⚠️  GitHub CLI not found.'));
          console.log(chalk.gray('Please install GitHub CLI:'));
          console.log(
            chalk.blue(
              '• Ubuntu/Debian: https://github.com/cli/cli/blob/trunk/docs/install_linux.md#debian-ubuntu-linux-raspberry-pi-os-apt'
            )
          );
          console.log(chalk.blue('• Other Linux: https://cli.github.com/'));

          const { continueWithoutGH } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueWithoutGH',
              message: 'Continue setup without GitHub CLI? (You can install it later)',
              default: true
            }
          ]);

          if (!continueWithoutGH) {
            console.log(
              chalk.gray('Setup cancelled. Install GitHub CLI and re-run: launchpad init --force')
            );
            return;
          }

          console.log(
            chalk.yellow('⚠️  Skipping GitHub authentication. Repository cloning may fail.')
          );
          return;
        } else if (platform === 'win32') {
          console.log(chalk.yellow('⚠️  GitHub CLI not found.'));
          console.log(chalk.gray('Please install GitHub CLI:'));
          console.log(chalk.blue('• Download from: https://cli.github.com/'));
          console.log(chalk.blue('• Or use winget: winget install --id GitHub.cli'));
          console.log(chalk.blue('• Or use Chocolatey: choco install gh'));

          const { continueWithoutGH } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueWithoutGH',
              message: 'Continue setup without GitHub CLI? (You can install it later)',
              default: true
            }
          ]);

          if (!continueWithoutGH) {
            console.log(
              chalk.gray('Setup cancelled. Install GitHub CLI and re-run: launchpad init --force')
            );
            return;
          }

          console.log(
            chalk.yellow('⚠️  Skipping GitHub authentication. Repository cloning may fail.')
          );
          return;
        }
      }

      // Check if already authenticated
      try {
        execSync('gh auth status', { stdio: 'pipe' });
        console.log(chalk.green('✅ Already authenticated with GitHub!'));

        // Check SSO status
        console.log(chalk.cyan('\n🔒 Checking SAML SSO Authentication...'));
        console.log(chalk.gray('LoveHolidays uses SAML SSO for GitHub access.'));

        const { ssoSetup } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'ssoSetup',
            message: 'Do you need help setting up SAML SSO authentication?',
            default: true
          }
        ]);

        if (ssoSetup) {
          await this.guideSSOSetup();
        }

        return;
      } catch {
        // Not authenticated, proceed with auth flow
      }

      console.log(chalk.yellow('🔑 GitHub authentication required for repository access.'));
      console.log(chalk.gray('This will open your browser to authenticate with GitHub.'));

      const { proceedAuth } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceedAuth',
          message: 'Proceed with GitHub authentication?',
          default: true
        }
      ]);

      if (!proceedAuth) {
        console.log(
          chalk.gray(
            'Skipping GitHub authentication. You can set this up later with: gh auth login'
          )
        );
        return;
      }

      // Authenticate with GitHub
      console.log(chalk.cyan('🌐 Opening browser for GitHub authentication...'));
      execSync('gh auth login --web --scopes "repo,read:org"', { stdio: 'inherit' });

      // Verify authentication
      try {
        execSync('gh auth status', { stdio: 'pipe' });
        console.log(chalk.green('✅ Successfully authenticated with GitHub!'));

        // Guide through SSO setup
        await this.guideSSOSetup();
      } catch {
        console.log(chalk.red('❌ GitHub authentication failed.'));
        console.log(chalk.gray('You can retry later with: gh auth login'));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error setting up GitHub authentication: ${error}`));
      console.log(chalk.gray('You can set this up manually later with: gh auth login'));
    }
  }

  private async guideSSOSetup(): Promise<void> {
    console.log(chalk.cyan('\n🔒 SAML SSO Setup Required'));
    console.log(chalk.gray('─'.repeat(30)));

    console.log(chalk.yellow('⚠️  LoveHolidays uses SAML SSO for GitHub access.'));
    console.log(chalk.gray('You need to authorize your authentication for SSO access.'));

    console.log(chalk.white('\n📋 SSO Setup Steps:'));
    console.log(chalk.gray('1. Go to: https://github.com/settings/tokens'));
    console.log(chalk.gray('2. Find your personal access token'));
    console.log(chalk.gray('3. Click "Configure SSO" next to the token'));
    console.log(chalk.gray('4. Authorize the "loveholidays" organization'));
    console.log(chalk.gray('5. For SSH keys, visit: https://github.com/settings/keys'));
    console.log(chalk.gray('6. Click "Configure SSO" for each SSH key'));

    console.log(chalk.white('\n🔗 Helpful Links:'));
    console.log(chalk.blue('• Personal Access Tokens: https://github.com/settings/tokens'));
    console.log(chalk.blue('• SSH Keys: https://github.com/settings/keys'));
    console.log(
      chalk.blue(
        '• SSO Documentation: https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on'
      )
    );

    const { openBrowser } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openBrowser',
        message: 'Would you like to open the GitHub settings page now?',
        default: true
      }
    ]);

    if (openBrowser) {
      try {
        const { execSync } = await import('node:child_process');
        const { platform } = process;

        if (platform === 'darwin') {
          execSync('open https://github.com/settings/tokens');
        } else if (platform === 'linux') {
          execSync('xdg-open https://github.com/settings/tokens');
        } else if (platform === 'win32') {
          execSync('start https://github.com/settings/tokens');
        }

        console.log(chalk.green('🌐 Opened GitHub settings in your browser.'));
      } catch {
        console.log(chalk.yellow('Could not open browser automatically.'));
        console.log(chalk.gray('Please visit: https://github.com/settings/tokens'));
      }
    }

    console.log(chalk.cyan('\n💡 After SSO setup, test repository access with:'));
    console.log(chalk.gray('   gh repo list loveholidays'));
    console.log(chalk.gray('   git clone https://github.com/loveholidays/[repo-name].git'));
  }

  private async downloadInitialConfig(): Promise<void> {
    console.log(chalk.cyan('📥 Initial Configuration Setup'));
    console.log(chalk.gray('This will download teams, setup components, and documentation\n'));

    // Ask if they want to download configuration
    const { downloadConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'downloadConfig',
        message: 'Do you have access to a shared configuration (teams, components)?',
        default: true
      }
    ]);

    if (!downloadConfig) {
      console.log(chalk.gray('Skipping configuration download. You can set this up later with:'));
      console.log(chalk.gray('  launchpad admin config download\n'));
      return;
    }

    // Ask which provider to use
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Which configuration source would you like to use?',
        choices: [
          { name: 'GitHub Gist (simple file sharing) - Recommended', value: 'gist' },
          { name: 'GitHub Repository (version controlled)', value: 'github' },
          { name: 'Local file (backup/export file)', value: 'local' },
          { name: 'Skip for now', value: 'skip' }
        ]
      }
    ]);

    if (provider === 'skip') {
      console.log(chalk.gray('Skipping configuration download. You can set this up later.\n'));
      return;
    }

    let configOptions: ConfigDownloadOptions = { provider };

    // Collect provider-specific information
    if (provider === 'gist') {
      const gistAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'gistId',
          message: 'GitHub Gist ID (e.g., abc123def456 or full URL):',
          validate: (input: string) => input.length > 0 || 'Please enter a Gist ID'
        },
        {
          type: 'input',
          name: 'token',
          message: 'GitHub Personal Access Token (for private gists):',
          when: () => {
            console.log(chalk.gray('💡 Create a token at: https://github.com/settings/tokens'));
            console.log(chalk.gray('   Required scope: gist (for private gists)'));
            return true;
          }
        },
        {
          type: 'input',
          name: 'fileName',
          message: 'File name in gist:',
          default: 'launchpad-config.json'
        }
      ]);

      configOptions = { ...configOptions, ...gistAnswers };
    } else if (provider === 'github') {
      const githubAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'repository',
          message: 'GitHub repository (org/repo):',
          validate: (input: string) => {
            const repoRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
            return repoRegex.test(input) || 'Please enter a valid repository (org/repo)';
          }
        },
        {
          type: 'input',
          name: 'token',
          message: 'GitHub Personal Access Token:',
          when: () => {
            console.log(chalk.gray('💡 Create a token at: https://github.com/settings/tokens'));
            console.log(chalk.gray('   Required scope: repo (for private repos)'));
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
        }
      ]);

      configOptions = { ...configOptions, ...githubAnswers };
    } else if (provider === 'local') {
      const localAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'localPath',
          message: 'Path to configuration file:',
          validate: (input: string) => input.length > 0 || 'Please enter a file path'
        }
      ]);

      configOptions = { ...configOptions, ...localAnswers };
    }

    try {
      // Import and run admin config download command
      const { SyncHandler } = await import('@/commands/admin/config/sync-handler');
      const syncHandler = new SyncHandler();

      await syncHandler.downloadConfig(configOptions);

      // Note: The sync handler handles its own success/error messaging
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not download configuration.'));
      console.log(chalk.gray('You can try again later with: launchpad admin config download'));
      console.log(chalk.gray('Continuing with local setup...\n'));
    }
  }

  private async checkEssentialTools(): Promise<boolean> {
    const { execSync } = await import('node:child_process');
    const essentialTools = [
      { name: 'Git', command: 'git --version' },
      { name: 'Node.js', command: 'node --version' },
      { name: 'PNPM', command: 'pnpm --version' }
    ];

    // On macOS, also check for Homebrew
    if (process.platform === 'darwin') {
      essentialTools.unshift({ name: 'Homebrew', command: 'brew --version' });
    }

    const missingTools: string[] = [];

    for (const tool of essentialTools) {
      try {
        execSync(tool.command, { stdio: 'pipe' });
      } catch {
        missingTools.push(tool.name);
      }
    }

    if (missingTools.length > 0) {
      console.log(chalk.yellow(`Missing tools: ${missingTools.join(', ')}`));
      return true;
    }

    return false;
  }
}
