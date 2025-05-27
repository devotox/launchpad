import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { ConfigManager, DataManager } from '@/utils/config';
import { RepositoryManager } from '@/utils/repository';

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
}

export class InitCommand {
  getCommand(): Command {
    return new Command('init')
      .description('Initialize your developer workspace')
      .option('--force', 'Force re-initialization even if config exists')
      .action(async (options) => {
        await this.execute(options.force);
      });
  }

  async execute(force = false): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();

    // Check if config already exists
    if (!force && (await configManager.hasConfig())) {
      const existingConfig = await configManager.getConfig();
      console.log(chalk.yellow('⚠️  Launchpad is already initialized!'));
      console.log(chalk.gray(`Config found at: ${configManager.getConfigPath()}`));
      console.log(chalk.gray(`Current team: ${existingConfig?.user.team}`));
      console.log(chalk.gray('Use --force to re-initialize'));
      return;
    }

    console.log(chalk.cyan('🚀 Welcome to LoveHolidays Launchpad!'));
    console.log(chalk.gray("Let's set up your developer workspace...\n"));

    // Check if essential tools are installed
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
        console.log(chalk.gray('This will install: Homebrew, Git, Node.js (via Volta), PNPM, and GitHub CLI\n'));

        // Import and run setup command
        const { SetupCommand } = await import('./setup');
        const setupCommand = new SetupCommand();
        await setupCommand.runFullSetup(true); // true = essentialOnly

        console.log(chalk.green('\n✅ Essential tools setup completed!'));
        console.log(chalk.gray('Continuing with workspace initialization...\n'));
      } else {
        console.log(chalk.yellow('\n⚠️  Continuing without setup. Some features may not work properly.'));
        console.log(chalk.gray('You can run setup later with: launchpad setup all --essential-only\n'));
      }
    }

    const teamChoices = await dataManager.getTeamChoices();

    const answers = await inquirer.prompt<InitAnswers>([
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
          return emailDomain ? (emailDomain.split('.')[0] || 'workspace') : 'workspace';
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
        when: () => !needsSetup // Only ask if setup wasn't needed/run
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

    // Create config
    const config = await configManager.createDefaultConfig({
      name: answers.name,
      email: answers.email,
      team: answers.team
    }, answers.workspaceName);

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

    // Get team information
    const team = await dataManager.getTeamById(answers.team);
    if (!team) {
      console.error(chalk.red('❌ Team not found'));
      return;
    }

    // Setup GitHub authentication if requested
    if (answers.setupGitHub) {
      await this.setupGitHubAuthentication();
    }

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
    console.log(chalk.gray(`Tools: ${team.tools.join(', ')}`));
    console.log(chalk.gray(`Default branch: ${team.config.defaultBranch}`));
    console.log(chalk.gray(`CI/CD: ${team.config.cicdPipeline}`));
    console.log(chalk.gray(`Monitoring: ${team.config.monitoringTools.join(', ')}`));
    if (team.config.communicationPreferences.standupTime) {
      console.log(
        chalk.gray(
          `Daily standup: ${team.config.communicationPreferences.standupTime} (${team.config.communicationPreferences.timezone})`
        )
      );
    }

    // Clone repositories if requested
    if (answers.cloneRepos) {
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

    // Show onboarding resources
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

    console.log(chalk.cyan('\n🎯 Next Steps:'));
    console.log(chalk.green('  1. 📖 Start with the MMB Team Onboarding Guide (link above)'));
    console.log(chalk.gray("  2. Join your team's Slack channels"));
    if (!answers.setupGitHub && !needsSetup) {
      console.log(chalk.yellow('  3. 🔐 Set up GitHub authentication: gh auth login'));
      console.log(chalk.yellow('  4. 🔒 Configure SAML SSO for LoveHolidays organization'));
      console.log(chalk.gray('  5. Set up your development environment: launchpad setup all'));
    } else {
      console.log(chalk.gray('  3. Set up your development environment (if not done): launchpad setup all'));
    }
    if (answers.cloneRepos) {
      const stepNum = answers.setupGitHub ? 4 : 6;
      console.log(chalk.gray(`  ${stepNum}. Navigate to your workspace: cd ${answers.workspacePath}`));
      console.log(chalk.gray(`  ${stepNum + 1}. Explore the codebase and run the applications`));
    } else {
      const stepNum = answers.setupGitHub ? 4 : 6;
      console.log(chalk.gray(`  ${stepNum}. Run "launchpad create project" to start a new project`));
    }
    const finalStep = answers.cloneRepos ? (answers.setupGitHub ? 6 : 8) : (answers.setupGitHub ? 5 : 7);
    console.log(chalk.gray(`  ${finalStep}. Attend your first team standup`));

    console.log(chalk.green(`\nWelcome to LoveHolidays, ${answers.name}! 🎉`));
    console.log(
      chalk.cyan("💡 Tip: Use 'launchpad team --help' to explore team-specific commands")
    );
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
        const platform = process.platform;
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
              console.log(chalk.gray('Setup cancelled. Install GitHub CLI and re-run: launchpad init --force'));
              return;
            }

            console.log(chalk.yellow('⚠️  Skipping GitHub authentication. Repository cloning may fail.'));
            console.log(chalk.gray('After installing GitHub CLI, run: gh auth login'));
            return;
          }
        } else if (platform === 'linux') {
          console.log(chalk.yellow('⚠️  GitHub CLI not found.'));
          console.log(chalk.gray('Please install GitHub CLI:'));
          console.log(chalk.blue('• Ubuntu/Debian: https://github.com/cli/cli/blob/trunk/docs/install_linux.md#debian-ubuntu-linux-raspberry-pi-os-apt'));
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
            console.log(chalk.gray('Setup cancelled. Install GitHub CLI and re-run: launchpad init --force'));
            return;
          }

          console.log(chalk.yellow('⚠️  Skipping GitHub authentication. Repository cloning may fail.'));
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
            console.log(chalk.gray('Setup cancelled. Install GitHub CLI and re-run: launchpad init --force'));
            return;
          }

          console.log(chalk.yellow('⚠️  Skipping GitHub authentication. Repository cloning may fail.'));
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
        console.log(chalk.gray('Skipping GitHub authentication. You can set this up later with: gh auth login'));
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
    console.log(chalk.blue('• SSO Documentation: https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on'));

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
        const platform = process.platform;

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
