import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import chalk from 'chalk';
import { execa } from 'execa';
import { match } from 'ts-pattern';
import type { Repository } from '@/utils/config/types';
import { PackageManagerDetector } from './package-manager';
import fsExtra from 'fs-extra';
import trash from 'trash';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

export type RepoDeleteStrategy = 'tmp' | 'trash';

async function deleteRepositoryFolder(
  repoPath: string,
  repoName: string,
  strategy: RepoDeleteStrategy = 'tmp'
): Promise<void> {
  if (strategy === 'trash') {
    // Move to system trash (recoverable)
    await trash([repoPath]);
  } else {
    // Move to /tmp and delete in background (fast, not recoverable)
    const tmpPath = join(tmpdir(), `launchpad-trash-${Date.now()}-${repoName}`);
    await fsExtra.move(repoPath, tmpPath, { overwrite: true });
    // Delete in background
    const rm = spawn('rm', ['-rf', tmpPath], {
      detached: true,
      stdio: 'ignore',
    });
    rm.unref();
  }
}

export class RepositoryManager {
  private hasOpenedAuthPage = false; // Track if we've already opened a browser window

  constructor(private workspacePath: string) {}

  async checkGitAuthentication(): Promise<boolean> {
    // Not needed anymore since we're using regular git
    return true;
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

  async ensureWorkspaceExists(): Promise<void> {
    try {
      await fs.access(this.workspacePath);
    } catch {
      await fs.mkdir(this.workspacePath, { recursive: true });
      console.log(chalk.green(`✅ Created workspace directory: ${this.workspacePath}`));
    }
  }

  async cloneRepository(
    repo: Repository,
    options: { overwrite?: boolean; interactive?: boolean; deleteStrategy?: RepoDeleteStrategy } = {}
  ): Promise<{ success: boolean; authIssue?: 'saml' | 'login' | 'token' | null; skipped?: boolean }> {
    const repoPath = join(this.workspacePath, repo.name);

    try {
      // Check if repository already exists
      await fs.access(repoPath);

      if (options.overwrite) {
        console.log(chalk.yellow(`⚠️  Repository ${repo.name} already exists, removing...`));
        await deleteRepositoryFolder(repoPath, repo.name, options.deleteStrategy);
      } else if (options.interactive) {
        console.log(chalk.yellow(`⚠️  Repository ${repo.name} already exists.`));

        const readline = await import('node:readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.cyan('Do you want to overwrite it? (y/N): '), (answer) => {
            rl.close();
            resolve(answer.toLowerCase());
          });
        });

        if (answer === 'y' || answer === 'yes') {
          console.log(chalk.blue(`🗑️  Removing existing ${repo.name}...`));
          await deleteRepositoryFolder(repoPath, repo.name, options.deleteStrategy);
        } else {
          console.log(chalk.gray(`   Skipping ${repo.name}`));
          return { success: true, skipped: true };
        }
      } else {
        console.log(chalk.yellow(`⚠️  Repository ${repo.name} already exists, skipping...`));
        return { success: true, skipped: true };
      }
    } catch {
      // Repository doesn't exist, proceed with cloning
    }

    try {
      console.log(chalk.blue(`📦 Cloning ${repo.name}...`));

      // For GitHub repositories, ensure we use HTTPS URLs
      let cloneUrl = repo.url;

      if (repo.url.includes('github.com')) {
        // Convert SSH URLs to HTTPS if needed
        if (repo.url.startsWith('git@github.com:')) {
          cloneUrl = repo.url.replace('git@github.com:', 'https://github.com/');
        }

        // Ensure .git extension
        if (!cloneUrl.endsWith('.git')) {
          cloneUrl = `${cloneUrl}.git`;
        }
      }

      // Use regular git clone
      await execa('git', ['clone', cloneUrl, repoPath]);
      console.log(chalk.green(`✅ Successfully cloned ${repo.name}`));
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStr = String(error);

      console.error(chalk.red(`❌ Failed to clone ${repo.name}`));

      // Detect the type of authentication issue
      let authIssue: 'saml' | 'login' | 'token' | null = null;

      if (errorStr.includes('organization has enabled or enforced SAML SSO')) {
        authIssue = 'saml';
        console.log(chalk.yellow('💡 SAML SSO authorization required'));
      } else if (errorStr.includes('Authentication failed') || errorStr.includes('fatal: could not read Username')) {
        authIssue = 'token';
        console.log(chalk.yellow('💡 Authentication failed - token required'));
      } else if (errorStr.includes('Permission denied') || errorStr.includes('403')) {
        authIssue = 'login';
        console.log(chalk.yellow('💡 Access denied - check your permissions'));
      } else if (!errorMessage.includes('Authentication failed') && !errorMessage.includes('fatal: could not read Username')) {
        // Only show the error if it's not an authentication error
        console.log(chalk.gray(`   ${errorMessage.split('\n')[0]}`));
      }

      return { success: false, authIssue };
    }
  }

  async checkNpmAuthentication(): Promise<boolean> {
    try {
      // First check if NPM_TOKEN environment variable is set
      if (process.env['NPM_TOKEN'] && process.env['NPM_TOKEN'].trim() !== '') {
        return true;
      }

      // Fall back to checking npm config
      const { execSync } = await import('node:child_process');
      const npmToken = execSync('npm config get //registry.npmjs.org/:_authToken', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();

      return !!(npmToken && npmToken !== 'undefined');
    } catch {
      return false;
    }
  }

  async setupNpmAuthentication(): Promise<void> {
    console.log(chalk.cyan('\n📦 NPM Authentication Setup'));
    console.log(chalk.gray('─'.repeat(30)));

    // Check if already authenticated
    const isAuthenticated = await this.checkNpmAuthentication();

    if (isAuthenticated) {
      console.log(chalk.green('✅ NPM is already authenticated!'));
      return;
    }

    console.log(chalk.yellow('⚠️  NPM authentication not configured'));
    console.log(chalk.gray('This is required to install private npm packages'));

    console.log(chalk.cyan('\n📋 Setup Instructions:'));
    console.log(chalk.white('1. Create or sign in to your NPM account (2FA required)'));
    console.log(chalk.white('2. Request NPM org access via Slack #digital-product-infrastructure-team'));
    console.log(chalk.white('3. Create a Read-only token on NPM (name it "local-laptop")'));
    console.log(chalk.gray('   Go to: https://www.npmjs.com/settings/~/tokens/new'));
    console.log(chalk.white('4. Add to your shell config:'));
    console.log(chalk.gray('   For bash: echo \'export NPM_TOKEN=your_token\' >> ~/.bashrc'));
    console.log(chalk.gray('   For zsh:  echo \'export NPM_TOKEN=your_token\' >> ~/.zprofile'));
    console.log(chalk.gray('   For fish: echo \'set -x NPM_TOKEN your_token\' >> ~/.config/fish/config.fish'));
    console.log(chalk.white('5. Restart your terminal or run: source ~/.bashrc (or ~/.zprofile)'));

    // Only open browser if we haven't opened one yet
    if (!this.hasOpenedAuthPage) {
      await this.openAuthPage('npm');
      console.log(chalk.cyan('\n🌐 Opened NPM tokens page in your browser'));
    }

    // Wait for user to complete setup
    console.log(chalk.yellow('\n⏳ Waiting for you to complete NPM setup...'));
    console.log(chalk.gray('Press Enter once you\'ve completed the steps above'));

    // Import readline for user input
    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise<void>((resolve) => {
      rl.question('', () => {
        rl.close();
        resolve();
      });
    });

    // Verify authentication after user confirms
    console.log(chalk.blue('\n🔍 Verifying NPM authentication...'));

    const nowAuthenticated = await this.checkNpmAuthentication();

    if (nowAuthenticated) {
      console.log(chalk.green('✅ NPM authentication successful!'));
    } else {
      console.log(chalk.red('❌ NPM authentication still not configured'));
      console.log(chalk.yellow('\n💡 Troubleshooting:'));
      console.log(chalk.gray('• Make sure you added the NPM_TOKEN to your shell config'));
      console.log(chalk.gray('• Ensure you restarted your terminal or sourced the config file'));
      console.log(chalk.gray('• Check that the token is set: echo $NPM_TOKEN'));
      console.log(chalk.gray('• If using a new terminal, the environment variable might not be loaded'));

      throw new Error('NPM authentication setup failed');
    }
  }

  private async openAuthPage(authType: 'saml' | 'login' | 'token' | 'tokens' | 'npm', silent = false): Promise<string> {
    const url = match(authType)
      .with('saml', () => 'https://github.com/settings/tokens')
      .with('login', () => 'https://github.com/login')
      .with('token', 'tokens', () => 'https://github.com/settings/tokens/new?scopes=repo&description=Launchpad%20CLI')
      .with('npm', () => 'https://www.npmjs.com/settings/~/tokens/new')
      .exhaustive();

    if (!silent && !this.hasOpenedAuthPage) {
      try {
        const { execSync } = await import('node:child_process');
        const { platform } = process;

        match(platform)
          .with('darwin', () => execSync(`open "${url}"`))
          .with('linux', () => execSync(`xdg-open "${url}"`))
          .with('win32', () => execSync(`start "${url}"`))
          .otherwise(() => {
            // Platform not supported, silently ignore
          });

        this.hasOpenedAuthPage = true;
      } catch {
        // Silently fail if we can't open the browser
      }
    }

    return url;
  }

  async cloneRepositories(
    repositories: Repository[],
    onlyRequired = false,
    organization?: string,
    options: { overwrite?: boolean; interactive?: boolean } = {}
  ): Promise<string[]> {
    await this.ensureWorkspaceExists();

    // Basic check that git is available
    try {
      await execa('git', ['--version']);
    } catch {
      console.log(chalk.red('❌ Git is not installed or not available in PATH.'));
      console.log(chalk.gray('Please install Git and try again.'));
      return [];
    }

    const reposToClone = onlyRequired ? repositories.filter((repo) => repo.required) : repositories;
    const clonedRepos: string[] = [];
    const skippedRepos: string[] = [];
    const failedRepos: { name: string; authIssue: 'saml' | 'login' | 'token' | null }[] = [];

    console.log(chalk.cyan(`\n📂 Setting up repositories in ${this.workspacePath}\n`));

    // Clone repositories
    for (const repo of reposToClone) {
      const { success, authIssue, skipped } = await this.cloneRepository(repo, options);

      if (success) {
        if (skipped) {
          skippedRepos.push(repo.name);
        } else {
          clonedRepos.push(repo.name);
        }
      } else {
        failedRepos.push({ name: repo.name, authIssue: authIssue || null });
      }
    }

    // Report results
    if (clonedRepos.length > 0) {
      console.log(chalk.green(`\n✅ Successfully cloned ${clonedRepos.length} repositories`));
    }

    if (skippedRepos.length > 0) {
      console.log(chalk.yellow(`\n⏭️  Skipped ${skippedRepos.length} existing repositories`));
    }

    // Handle failures
    if (failedRepos.length > 0) {
      console.log(chalk.red(`\n❌ Failed to clone ${failedRepos.length} repositories:`));
      failedRepos.forEach(repo => {
        console.log(chalk.gray(`   • ${repo.name}`));
      });

      // Determine the primary auth issue
      const authIssues = failedRepos.filter(r => r.authIssue).map(r => r.authIssue);
      const hasSamlIssue = authIssues.includes('saml');
      const hasTokenIssue = authIssues.includes('token');
      const hasLoginIssue = authIssues.includes('login');

      if (hasSamlIssue) {
        console.log(chalk.yellow('\n💡 SAML SSO authorization required for GitHub access'));
        console.log(chalk.gray('1. Go to: https://github.com/settings/tokens'));
        console.log(chalk.gray('2. Find or create a personal access token'));
        console.log(chalk.gray('3. Click "Configure SSO" next to the token'));
        console.log(chalk.gray('4. Authorize your organization'));
        console.log(chalk.gray('5. Use the token as your password when prompted\n'));

        if (!this.hasOpenedAuthPage) {
          await this.openAuthPage('saml');
          console.log(chalk.cyan('🌐 Opened GitHub tokens page in your browser'));
        }
      } else if (hasTokenIssue) {
        console.log(chalk.yellow('\n💡 GitHub authentication required'));
        console.log(chalk.gray('1. Go to: https://github.com/settings/tokens/new'));
        console.log(chalk.gray('2. Create a personal access token with "repo" scope'));
        console.log(chalk.gray('3. Copy the token'));
        console.log(chalk.gray('4. Use it as your password when git prompts\n'));

        if (!this.hasOpenedAuthPage) {
          await this.openAuthPage('token');
          console.log(chalk.cyan('🌐 Opened GitHub token creation page in your browser'));
        }
      } else if (hasLoginIssue) {
        console.log(chalk.yellow('\n💡 GitHub login required'));
        console.log(chalk.gray('1. Go to: https://github.com/login'));
        console.log(chalk.gray('2. Log in to your GitHub account'));
        console.log(chalk.gray('3. Then create a personal access token'));
        console.log(chalk.gray('4. Use the token for authentication\n'));

        if (!this.hasOpenedAuthPage) {
          await this.openAuthPage('login');
          console.log(chalk.cyan('🌐 Opened GitHub login page in your browser'));
        }
      }
    }

    // Return all repositories that are now available (cloned + skipped)
    return [...clonedRepos, ...skippedRepos];
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

      // Detect the appropriate package manager based on lock files
      const detector = new PackageManagerDetector();
      const packageManagerInfo = await detector.getBestAvailablePackageManager(repoPath);

      console.log(chalk.gray(`   Using ${packageManagerInfo.manager} (detected from: ${packageManagerInfo.lockFile})`));

      try {
        const [command, ...args] = packageManagerInfo.installCommand;
        if (!command) {
          throw new Error('No install command available');
        }

        await execa(command, args, { cwd: repoPath });
        console.log(chalk.green(`✅ Dependencies installed for ${repoName} using ${packageManagerInfo.manager}`));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to install dependencies for ${repoName} using ${packageManagerInfo.manager}:`), error);

        // If the detected package manager failed, try npm as a last resort
        if (packageManagerInfo.manager !== 'npm') {
          console.log(chalk.yellow('   Trying npm as fallback...'));
          try {
            await execa('npm', ['install'], { cwd: repoPath });
            console.log(chalk.green(`✅ Dependencies installed for ${repoName} using npm (fallback)`));
          } catch (npmError) {
            console.error(chalk.red(`❌ Failed to install dependencies for ${repoName} with npm fallback:`), npmError);
          }
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

    // Check npm authentication first
    const npmAuthenticated = await this.checkNpmAuthentication();
    if (!npmAuthenticated && repoNames.length > 0) {
      console.log(chalk.yellow('⚠️  NPM authentication required for installing private packages'));
      await this.setupNpmAuthentication();
    }

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
