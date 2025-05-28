import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import chalk from 'chalk';
import { execa } from 'execa';
import inquirer from 'inquirer';
import type { Repository } from '@/utils/config/types';

export class RepositoryManager {
  constructor(private workspacePath: string) {}

  async checkGitAuthentication(): Promise<boolean> {
    try {
      // Only use GitHub CLI for authentication testing
      const { execSync } = await import('node:child_process');

      try {
        // Check if GitHub CLI is installed and authenticated
        execSync('gh --version', { stdio: 'pipe' });
        execSync('gh auth status', { stdio: 'pipe' });

        // For non-SSO scenarios, basic authentication is enough
        // We'll detect SSO requirements when we actually try to access repos
        return true;
      } catch {
        // GitHub CLI not available or not authenticated
        return false;
      }
    } catch {
      return false;
    }
  }

  private getOrganizationFromRepos(repositories: Repository[]): string | null {
    // Extract organization name from repository URLs
    for (const repo of repositories) {
      if (repo.url.includes('github.com')) {
        const match = repo.url.match(/github\.com[/:]([\w-]+)\//);
        if (match?.[1]) {
          return match[1];
        }
      }
    }
    return null;
  }

  async checkOrganizationAccess(organization: string): Promise<{ hasAccess: boolean; requiresSSO: boolean }> {
    try {
      const { execSync } = await import('node:child_process');

      // Test access to the organization
      const result = await execa('gh', ['repo', 'list', organization, '--limit', '1'], {
        timeout: 10000,
        reject: false
      });

      if (result.exitCode === 0) {
        return { hasAccess: true, requiresSSO: false };
      }

      // Check if the error is SSO-related
      const errorMessage = result.stderr || '';
      if (errorMessage.includes('SAML SSO') || errorMessage.includes('organization has enabled')) {
        return { hasAccess: false, requiresSSO: true };
      }

      // Other error (e.g., organization doesn't exist, no permissions)
      return { hasAccess: false, requiresSSO: false };
    } catch {
      return { hasAccess: false, requiresSSO: false };
    }
  }

  async setupGitHubCLI(): Promise<void> {
    console.log(chalk.cyan('\n🔐 Setting up GitHub CLI'));
    console.log(chalk.gray('─'.repeat(30)));

    try {
      // Check if gh CLI is already installed
      const { execSync } = await import('node:child_process');

      try {
        execSync('gh --version', { stdio: 'pipe' });
        console.log(chalk.green('✅ GitHub CLI is already installed!'));
      } catch {
        console.log(chalk.yellow('⚠️  GitHub CLI (gh) is not installed.'));
        console.log(chalk.cyan('📦 Installing GitHub CLI...'));

        // Try to install gh CLI based on platform
        const { platform } = process;
        if (platform === 'darwin') {
          // Check if Homebrew is installed first
          try {
            execSync('brew --version', { stdio: 'pipe' });
            console.log(chalk.blue('🍺 Installing GitHub CLI via Homebrew...'));
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
                chalk.gray('Setup cancelled. You can install GitHub CLI and try again.')
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
              chalk.gray('Setup cancelled. Install GitHub CLI and try again.')
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
              chalk.gray('Setup cancelled. Install GitHub CLI and try again.')
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
      let isAuthenticated = false;
      try {
        execSync('gh auth status', { stdio: 'pipe' });
        isAuthenticated = true;
        console.log(chalk.green('✅ Already authenticated with GitHub!'));
      } catch {
        // Not authenticated, proceed with auth flow
        isAuthenticated = false;
      }

      // If not authenticated, do the authentication
      if (!isAuthenticated) {
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
        try {
          execSync('gh auth login --web --scopes "repo,read:org,gist"', { stdio: 'inherit' });
          console.log(chalk.green('✅ Successfully authenticated with GitHub!'));
        } catch {
          console.log(chalk.red('❌ GitHub authentication failed.'));
          console.log(chalk.gray('You can retry later with: gh auth login'));
          return;
        }
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error setting up GitHub authentication: ${error}`));
      console.log(chalk.gray('You can set this up manually later with: gh auth login'));
    }
  }

  async setupSAMLSSO(organization: string): Promise<void> {
    console.log(chalk.yellow(`⚠️  SAML SSO authorization required for ${organization} organization.`));
    console.log(chalk.gray('The GitHub CLI token needs SAML SSO authorization.'));

    console.log(chalk.cyan('\n💡 SAML SSO Authorization Options:'));
    console.log(chalk.gray('1. Create a new pre-authorized token (recommended - faster)'));
    console.log(chalk.gray('2. Authorize the existing GitHub CLI token'));

    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'How would you like to set up SAML SSO authorization?',
        choices: [
          {
            name: 'Create new pre-authorized token (recommended)',
            value: 'create-preauth'
          },
          {
            name: 'Authorize existing GitHub CLI token',
            value: 'authorize-existing'
          },
          {
            name: 'Skip for now (repositories will not be accessible)',
            value: 'skip'
          }
        ]
      }
    ]);

    if (authMethod === 'skip') {
      console.log(chalk.yellow('⚠️  Skipping SAML SSO setup. Repository cloning will fail.'));
      console.log(chalk.red(`🚫 Cannot proceed with repository cloning without SAML SSO authentication for ${organization}.`));
      console.log(chalk.gray('You can set this up later at: https://github.com/settings/tokens'));
      return;
    }

    if (authMethod === 'create-preauth') {
      await this.guidePreAuthorizedTokenCreation(organization);
    } else if (authMethod === 'authorize-existing') {
      await this.guideSSOSetup(organization);
    }

    // Test again after SSO setup
    console.log(chalk.cyan(`\n🔍 Testing SAML SSO access to ${organization}...`));
    const { hasAccess } = await this.checkOrganizationAccess(organization);
    if (hasAccess) {
      console.log(chalk.green(`✅ SAML SSO access to ${organization} organization verified!`));
      console.log(chalk.green('🚀 Ready to proceed with repository cloning.'));
    } else {
      console.log(chalk.yellow('⚠️  SAML SSO access test still failing. You may need to complete the setup manually.'));
      console.log(chalk.red(`🚫 Repository cloning will not proceed until SAML SSO access to ${organization} is working.`));
      console.log(chalk.gray('Visit: https://github.com/settings/tokens to configure SSO'));
    }
  }

  private async guideSSOSetup(organization: string): Promise<void> {
    console.log(chalk.cyan('\n🔒 SAML SSO Setup Required'));
    console.log(chalk.gray('─'.repeat(30)));

    console.log(chalk.yellow(`⚠️  ${organization} uses SAML SSO for GitHub access.`));
    console.log(chalk.gray('Your GitHub authentication needs to be authorized for SAML SSO.'));

    // Get the current token to show in instructions
    const { execSync } = await import('node:child_process');
    let currentToken = '';
    try {
      currentToken = execSync('gh auth token', { encoding: 'utf8' }).trim();
    } catch {
      // If we can't get the token, continue without showing it
    }

    console.log(chalk.white('\n📋 SAML SSO Setup Steps:'));
    console.log(chalk.gray('1. Go to: https://github.com/settings/tokens'));
    if (currentToken) {
      console.log(chalk.gray(`2. Find your token: ${currentToken.substring(0, 8)}...`));
    } else {
      console.log(chalk.gray('2. Find your personal access token (created by GitHub CLI)'));
    }
    console.log(chalk.gray('3. Click "Configure SSO" next to the token'));
    console.log(chalk.gray('4. Click "Authorize" for the organization'));
    console.log(chalk.gray('5. You should see a green checkmark next to the organization'));

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

    // Interactive loop to test SAML SSO setup
    let ssoConfigured = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!ssoConfigured && attempts < maxAttempts) {
      attempts++;

      const { completed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'completed',
          message: `Have you authorized the token for ${organization} organization? (Attempt ${attempts}/${maxAttempts})`,
          default: false
        }
      ]);

      if (!completed) {
        if (attempts < maxAttempts) {
          console.log(chalk.yellow('⚠️  Please complete the SAML SSO authorization before continuing.'));
          console.log(chalk.gray('The token must be authorized for the organization.'));
          continue;
        }
        console.log(chalk.yellow('⚠️  Skipping SAML SSO verification.'));
        console.log(chalk.gray('Repository cloning may fail until SAML SSO is configured.'));
        break;
      }

      // Test the SAML SSO setup
      console.log(chalk.cyan('🔍 Testing SAML SSO authorization...'));

      try {
        const testResult = await execa('gh', ['repo', 'list', organization, '--limit', '1'], {
          timeout: 15000,
          reject: false
        });

        if (testResult.exitCode === 0) {
          console.log(chalk.green('✅ SAML SSO authorization successful!'));
          console.log(chalk.gray('You can now access repositories.'));
          ssoConfigured = true;
        } else {
          console.log(chalk.red('❌ SAML SSO authorization test failed.'));
          console.log(chalk.gray('The token may not be properly authorized yet.'));

          if (attempts < maxAttempts) {
            console.log(chalk.yellow('\n💡 Please check:'));
            console.log(chalk.gray('1. You clicked "Configure SSO" next to your token'));
            console.log(chalk.gray('2. You clicked "Authorize" for the organization'));
            console.log(chalk.gray('3. You see a green checkmark next to the organization'));
            console.log(chalk.gray('4. You may need to wait a few seconds for changes to take effect'));
          }
        }
      } catch (error) {
        console.log(chalk.red('❌ Error testing SAML SSO authorization.'));
        console.log(chalk.gray(`Error: ${error}`));

        if (attempts < maxAttempts) {
          console.log(chalk.yellow('Please try completing the SAML SSO setup again.'));
        }
      }
    }

    if (!ssoConfigured) {
      console.log(chalk.yellow('\n⚠️  SAML SSO setup was not completed successfully.'));
      console.log(chalk.gray('You can complete this setup later and then try cloning repositories again.'));
    }

    console.log(chalk.cyan('\n💡 After SSO setup, test repository access with:'));
    console.log(chalk.gray(`   gh repo list ${organization}`));
    console.log(chalk.gray(`   gh repo clone ${organization}/[repo-name]`));
  }

  private async guidePreAuthorizedTokenCreation(organization: string): Promise<void> {
    console.log(chalk.cyan('\n🔑 Creating New Pre-Authorized Token'));
    console.log(chalk.gray('─'.repeat(40)));

    console.log(chalk.green('✨ This method creates a token that works immediately with SAML SSO!'));
    console.log(chalk.gray('You will create a token with all necessary scopes and authorize it for LoveHolidays in one step.'));

    console.log(chalk.white('\n📋 Pre-Authorized Token Creation Steps:'));
    console.log(chalk.gray('1. Go to: https://github.com/settings/tokens/new'));
    console.log(chalk.gray('2. Set a descriptive note (e.g., "Launchpad CLI - LoveHolidays")'));
    console.log(chalk.gray('3. Set expiration (recommend 90 days or no expiration)'));
    console.log(chalk.gray('4. Select these scopes:'));
    console.log(chalk.blue('   ✓ repo (Full control of private repositories)'));
    console.log(chalk.blue('   ✓ read:org (Read org and team membership)'));
    console.log(chalk.blue('   ✓ gist (Create gists)'));
    console.log(chalk.gray('5. Click "Generate token"'));
    console.log(chalk.gray('6. IMMEDIATELY click "Configure SSO" next to the new token'));
    console.log(chalk.gray('7. Click "Authorize" for the organization'));
    console.log(chalk.gray('8. Copy the token (starts with ghp_)'));

    console.log(chalk.yellow('\n⚠️  Important: You must authorize SSO BEFORE leaving the page!'));
    console.log(chalk.gray('Once you navigate away, you cannot see the token again.'));

    const { openBrowser } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openBrowser',
        message: 'Would you like to open the GitHub token creation page?',
        default: true
      }
    ]);

    if (openBrowser) {
      try {
        const { execSync } = await import('node:child_process');
        const { platform } = process;

        const tokenUrl = `https://github.com/settings/tokens/new?scopes=repo,read:org,gist&description=Launchpad%20CLI%20-%20${organization}`;

        if (platform === 'darwin') {
          execSync(`open "${tokenUrl}"`);
        } else if (platform === 'linux') {
          execSync(`xdg-open "${tokenUrl}"`);
        } else if (platform === 'win32') {
          execSync(`start "${tokenUrl}"`);
        }

        console.log(chalk.green('🌐 Opened GitHub token creation page with pre-filled scopes.'));
      } catch {
        console.log(chalk.yellow('Could not open browser automatically.'));
        console.log(chalk.gray('Please visit: https://github.com/settings/tokens/new'));
      }
    }

    console.log(chalk.cyan('\n⏳ Please complete the token creation process in your browser...'));
    console.log(chalk.gray('1. Generate the token with the pre-filled scopes'));
    console.log(chalk.gray('2. IMMEDIATELY click "Configure SSO" next to the new token'));
    console.log(chalk.gray('3. Authorize the organization'));
    console.log(chalk.gray('4. Copy the token (starts with ghp_)'));
    console.log(chalk.gray('5. Return here and paste it below'));

    // Wait for the user to create and paste the token
    const { newToken } = await inquirer.prompt([
      {
        type: 'password',
        name: 'newToken',
        message: 'Paste your newly created pre-authorized token here:',
        validate: (input: string) => {
          if (!input.trim()) return 'Token is required';
          if (!input.startsWith('ghp_')) return 'Token should start with ghp_';
          if (input.length < 40) return 'Token appears to be incomplete';
          return true;
        }
      }
    ]);

    // Configure GitHub CLI to use the new token
    console.log(chalk.cyan('🔧 Configuring GitHub CLI with your new token...'));
    try {
      const { execSync } = await import('node:child_process');
      execSync(`echo "${newToken}" | gh auth login --with-token`, { stdio: 'pipe' });
      console.log(chalk.green('✅ GitHub CLI configured with new pre-authorized token!'));

      // Test the token immediately
      console.log(chalk.cyan('🔍 Testing token access to organization...'));
      const testResult = await execa('gh', ['repo', 'list', organization, '--limit', '1'], {
        timeout: 15000,
        reject: false
      });

      if (testResult.exitCode === 0) {
        console.log(chalk.green('✅ Token works perfectly! SAML SSO is properly configured.'));
        console.log(chalk.green('🚀 Ready to proceed with repository cloning.'));
      } else {
        console.log(chalk.red('❌ Token test failed. The token may not be properly authorized for SAML SSO.'));
        console.log(chalk.yellow('\n💡 Please check:'));
        console.log(chalk.gray('1. You clicked "Configure SSO" next to the token'));
        console.log(chalk.gray('2. You clicked "Authorize" for the organization'));
        console.log(chalk.gray('3. You see a green checkmark next to the organization'));
        console.log(chalk.gray('4. The token was copied correctly (starts with ghp_)'));

        // Ask if they want to try again
        const { tryAgain } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'tryAgain',
            message: 'Would you like to try creating a new token?',
            default: true
          }
        ]);

        if (tryAgain) {
          console.log(chalk.cyan('🔄 Let\'s try again...'));
          return this.guidePreAuthorizedTokenCreation(organization); // Recursive call to try again
        }
        console.log(chalk.yellow('⚠️  Token setup incomplete. Repository cloning will not proceed.'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Failed to configure GitHub CLI with the token.'));
      console.log(chalk.gray(`Error: ${error}`));
      console.log(chalk.yellow('⚠️  Token setup failed. Repository cloning will not proceed.'));
    }
  }

  async setupPersonalAccessToken(): Promise<void> {
    console.log(chalk.cyan('\n🔑 Personal Access Token Setup Instructions:'));
    console.log(
      chalk.gray('1. Go to GitHub Settings > Developer settings > Personal access tokens')
    );
    console.log(chalk.gray("2. Click 'Generate new token (classic)'"));
    console.log(chalk.gray("3. Select scopes: 'repo' (for private repositories)"));
    console.log(chalk.gray('4. Copy the generated token'));
    console.log(chalk.gray('5. Configure Git to use the token:'));
    console.log(chalk.gray('   git config --global credential.helper store'));
    console.log(chalk.gray("   git config --global user.name 'Your Name'"));
    console.log(chalk.gray("   git config --global user.email 'your.email@loveholidays.com'"));
    console.log(
      chalk.gray('\n6. When prompted for password during git operations, use your token')
    );

    console.log(
      chalk.yellow('\n💡 Tip: You can also use GitHub CLI (gh auth login) for easier setup')
    );
  }

  async setupSSHKey(): Promise<void> {
    console.log(chalk.cyan('\n🔐 SSH Key Setup Instructions:'));
    console.log(chalk.gray("1. Generate an SSH key (if you don't have one):"));
    console.log(chalk.gray("   ssh-keygen -t ed25519 -C 'your.email@loveholidays.com'"));
    console.log(chalk.gray('\n2. Add the SSH key to your SSH agent:'));
    console.log(chalk.gray('   eval "$(ssh-agent -s)"'));
    console.log(chalk.gray('   ssh-add ~/.ssh/id_ed25519'));
    console.log(chalk.gray('\n3. Copy your public key:'));
    console.log(chalk.gray('   cat ~/.ssh/id_ed25519.pub'));
    console.log(chalk.gray('\n4. Add the key to your GitHub account:'));
    console.log(chalk.gray('   Go to GitHub Settings > SSH and GPG keys > New SSH key'));
    console.log(chalk.gray('\n5. Test the connection:'));
    console.log(chalk.gray('   ssh -T git@github.com'));

    console.log(chalk.yellow('\n💡 Note: SSH URLs will be used for cloning (git@github.com:...)'));
  }

  async ensureWorkspaceExists(): Promise<void> {
    try {
      await fs.access(this.workspacePath);
    } catch {
      await fs.mkdir(this.workspacePath, { recursive: true });
      console.log(chalk.green(`✅ Created workspace directory: ${this.workspacePath}`));
    }
  }

  async cloneRepository(repo: Repository): Promise<boolean> {
    const repoPath = join(this.workspacePath, repo.name);

    try {
      // Check if repository already exists
      await fs.access(repoPath);
      console.log(chalk.yellow(`⚠️  Repository ${repo.name} already exists, skipping...`));
      return true;
    } catch {
      // Repository doesn't exist, proceed with cloning
    }

    try {
      console.log(chalk.blue(`📦 Cloning ${repo.name}...`));

      // For GitHub repositories, we MUST use GitHub CLI if SAML SSO is enabled
      if (repo.url.includes('github.com')) {
        // Check if GitHub CLI is available and authenticated
        const { execSync } = await import('node:child_process');

        try {
          execSync('gh --version', { stdio: 'pipe' });
          execSync('gh auth status', { stdio: 'pipe' });
        } catch {
          console.error(chalk.red(`❌ GitHub CLI is required for cloning ${repo.name}`));
          console.log(chalk.yellow('💡 GitHub CLI is not installed or not authenticated.'));
          console.log(chalk.gray('Please complete the authentication setup first.'));
          return false;
        }

        // Extract org/repo from URL for GitHub CLI
        const urlMatch = repo.url.match(/github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/);
        if (!urlMatch) {
          console.error(chalk.red(`❌ Could not parse GitHub URL for ${repo.name}`));
          console.log(chalk.gray(`URL: ${repo.url}`));
          return false;
        }

        const [, org, repoName] = urlMatch;

        // Use GitHub CLI to clone (this respects SAML SSO)
        await execa('gh', ['repo', 'clone', `${org}/${repoName}`, repoPath]);
        console.log(chalk.green(`✅ Successfully cloned ${repo.name} using GitHub CLI`));
        return true;
      }

      // Non-GitHub repositories can use regular git clone
      await execa('git', ['clone', repo.url, repoPath]);
      console.log(chalk.green(`✅ Successfully cloned ${repo.name}`));
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Permission denied') ||
        errorMessage.includes('could not read Username') ||
        errorMessage.includes('SAML SSO') ||
        errorMessage.includes('organization has enabled or enforced SAML SSO')
      ) {
        console.error(chalk.red(`❌ Authentication failed for ${repo.name}`));
        console.log(chalk.yellow('💡 This appears to be a SAML SSO authentication issue.'));
        console.log(chalk.gray('The GitHub CLI token needs SAML SSO authorization.'));
        console.log(chalk.cyan('\n🔧 To fix this:'));
        console.log(chalk.gray('1. Go to: https://github.com/settings/tokens'));
        console.log(chalk.gray('2. Find your GitHub CLI token'));
        console.log(chalk.gray('3. Click "Configure SSO" next to the token'));
        console.log(chalk.gray('4. Authorize the organization'));
        console.log(chalk.gray('5. Re-run: launchpad init --force'));
      } else {
        console.error(chalk.red(`❌ Failed to clone ${repo.name}:`), errorMessage);
      }
      return false;
    }
  }

  async cloneRepositories(repositories: Repository[], onlyRequired = false): Promise<string[]> {
    await this.ensureWorkspaceExists();

    // Check basic GitHub CLI authentication
    console.log(chalk.blue('🔍 Checking GitHub authentication...'));
    const isAuthenticated = await this.checkGitAuthentication();

    if (!isAuthenticated) {
      console.log(chalk.yellow('⚠️  GitHub authentication not detected.'));
      console.log(chalk.red('🚫 Repository cloning requires GitHub authentication.'));

      await this.setupGitHubCLI();

      // Check again after setup
      console.log(chalk.cyan('\n🔍 Verifying GitHub authentication...'));
      const isNowAuthenticated = await this.checkGitAuthentication();
      if (!isNowAuthenticated) {
        console.log(chalk.red('❌ GitHub authentication setup was not completed.'));
        console.log(chalk.yellow('🚫 Cannot proceed with repository cloning without authentication.'));
        return [];
      }
    } else {
      console.log(chalk.green('✅ GitHub CLI authenticated!'));
    }

    // Detect organization from repository URLs
    const organization = this.getOrganizationFromRepos(repositories);
    if (organization) {
      console.log(chalk.blue(`🔍 Checking access to ${organization} organization...`));

      const { hasAccess, requiresSSO } = await this.checkOrganizationAccess(organization);

      if (!hasAccess) {
        if (requiresSSO) {
          console.log(chalk.yellow(`⚠️  SAML SSO authorization required for ${organization} organization.`));
          console.log(chalk.red('🚫 Repository cloning requires SAML SSO authentication.'));

          // Only setup SSO if required
          await this.setupSAMLSSO(organization);

          // Check again after SSO setup
          console.log(chalk.cyan(`\n🔍 Verifying SAML SSO access to ${organization}...`));
          const { hasAccess: hasAccessNow } = await this.checkOrganizationAccess(organization);
          if (!hasAccessNow) {
            console.log(chalk.red('❌ SAML SSO setup was not completed successfully.'));
            console.log(chalk.yellow(`🚫 Cannot access ${organization} repositories without SAML SSO.`));
            console.log(chalk.gray('\n💡 To fix this:'));
            console.log(chalk.gray('1. Complete the GitHub authentication setup'));
            console.log(chalk.gray(`2. Ensure SAML SSO is properly configured for ${organization}`));
            console.log(chalk.gray('3. Re-run: launchpad init --force'));
            return [];
          }

          console.log(chalk.green('✅ SAML SSO access verified! Proceeding with repository cloning...'));
        } else {
          console.log(chalk.red(`❌ Cannot access ${organization} organization.`));
          console.log(chalk.gray('This could be due to:'));
          console.log(chalk.gray('• The organization name is incorrect'));
          console.log(chalk.gray('• You don\'t have access to this organization'));
          console.log(chalk.gray('• Your token doesn\'t have the required scopes'));
          return [];
        }
      } else {
        console.log(chalk.green(`✅ Access to ${organization} organization verified!`));
      }
    }

    const reposToClone = onlyRequired ? repositories.filter((repo) => repo.required) : repositories;

    const clonedRepos: string[] = [];

    console.log(chalk.cyan(`\n📂 Setting up repositories in ${this.workspacePath}\n`));

    for (const repo of reposToClone) {
      const success = await this.cloneRepository(repo);
      if (success) {
        clonedRepos.push(repo.name);
      }
    }

    return clonedRepos;
  }

  async setupRepository(repoName: string): Promise<void> {
    const repoPath = join(this.workspacePath, repoName);

    // Create .env.local from example environment files
    await this.createEnvironmentFile(repoPath, repoName);

    try {
      // Check if package.json exists
      const packageJsonPath = join(repoPath, 'package.json');
      await fs.access(packageJsonPath);

      console.log(chalk.blue(`📦 Installing dependencies for ${repoName}...`));

      // Use pnpm if available, otherwise npm
      try {
        await execa('pnpm', ['install'], { cwd: repoPath });
        console.log(chalk.green(`✅ Dependencies installed for ${repoName} using pnpm`));
      } catch {
        try {
          await execa('npm', ['install'], { cwd: repoPath });
          console.log(chalk.green(`✅ Dependencies installed for ${repoName} using npm`));
        } catch (error) {
          console.error(chalk.red(`❌ Failed to install dependencies for ${repoName}:`), error);
        }
      }
    } catch {
      // No package.json, skip dependency installation
      console.log(
        chalk.gray(`ℹ️  No package.json found in ${repoName}, skipping dependency installation`)
      );
    }
  }

  async setupRepositories(repoNames: string[]): Promise<void> {
    console.log(chalk.cyan('\n🔧 Setting up dependencies...\n'));

    for (const repoName of repoNames) {
      await this.setupRepository(repoName);
    }
  }

  private async createEnvironmentFile(repoPath: string, repoName: string): Promise<void> {
    try {
      const foundExampleFile = await this.findEnvironmentExampleFile(repoPath);
      if (!foundExampleFile || foundExampleFile.trim() === '') return;

      const envLocalPath = join(repoPath, '.env.local');

      // Check if .env.local already exists
      try {
        await fs.access(envLocalPath);
        console.log(chalk.gray(`ℹ️  .env.local already exists in ${repoName}, skipping...`));
      } catch {
        // .env.local doesn't exist, create it
        const exampleContent = await fs.readFile(foundExampleFile, 'utf-8');
        await fs.writeFile(envLocalPath, exampleContent);

        const exampleFileName = foundExampleFile.split('/').pop() ?? 'example file';
        console.log(chalk.green(`✅ Created .env.local for ${repoName} from ${exampleFileName}`));
      }

      // Ensure .gitignore properly ignores environment files
      await this.ensureGitignoreEnvFiles(repoPath, repoName);
    } catch (error) {
      console.log(
        chalk.yellow(
          `⚠️  Could not create environment file for ${repoName}: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async findEnvironmentExampleFile(repoPath: string): Promise<string | null> {
    const envExamplePatterns = [
      '.env.example',
      '.env.sample',
      '.env.template',
      'env.example',
      'env.sample',
      'env.template',
      '.env.dist',
      '.env.local.example'
    ];

    for (const pattern of envExamplePatterns) {
      const examplePath = join(repoPath, pattern);
      try {
        await fs.access(examplePath);
        return examplePath;
      } catch {
        // File doesn't exist, continue checking
      }
    }

    return null;
  }

  private async ensureGitignoreEnvFiles(repoPath: string, repoName: string): Promise<void> {
    try {
      const gitignorePath = join(repoPath, '.gitignore');

      // Environment file patterns that should be ignored
      const envPatternsToIgnore = ['.env.local', '.env.*.local', '.env'];

      let gitignoreContent = '';
      let gitignoreExists = false;

      // Read existing .gitignore if it exists
      try {
        gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        gitignoreExists = true;
      } catch {
        // .gitignore doesn't exist, we'll create it
      }

      // Check which patterns are missing
      const missingPatterns = envPatternsToIgnore.filter(
        (pattern) => !gitignoreContent.includes(pattern)
      );

      if (missingPatterns.length === 0) {
        // All environment patterns are already ignored
        return;
      }

      // Add missing patterns to .gitignore
      const newContent = gitignoreExists
        ? `${gitignoreContent}\n\n# Environment files\n${missingPatterns.join('\n')}\n`
        : `# Environment files\n${missingPatterns.join('\n')}\n`;

      await fs.writeFile(gitignorePath, newContent);

      console.log(chalk.green(`✅ Updated .gitignore for ${repoName} to ignore environment files`));
    } catch (error) {
      console.log(
        chalk.yellow(
          `⚠️  Could not update .gitignore for ${repoName}: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  async listRepositories(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.workspacePath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  async getRepositoryInfo(
    repoName: string
  ): Promise<{ path: string; exists: boolean; hasGit: boolean }> {
    const repoPath = join(this.workspacePath, repoName);
    const gitPath = join(repoPath, '.git');

    try {
      await fs.access(repoPath);
      const exists = true;

      try {
        await fs.access(gitPath);
        return { path: repoPath, exists, hasGit: true };
      } catch {
        return { path: repoPath, exists, hasGit: false };
      }
    } catch {
      return { path: repoPath, exists: false, hasGit: false };
    }
  }
}
