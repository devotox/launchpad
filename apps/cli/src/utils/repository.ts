import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { Repository } from "@/utils/config";
import chalk from "chalk";
import { execa } from "execa";
import inquirer from "inquirer";

export class RepositoryManager {
  constructor(private workspacePath: string) {}

  async checkGitAuthentication(): Promise<boolean> {
    try {
      // Try to access a private LoveHolidays repo to test authentication
      const result = await execa(
        "git",
        ["ls-remote", "https://github.com/loveholidays/aurora.git"],
        {
          timeout: 10000,
          reject: false,
        }
      );

      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async promptForAuthentication(): Promise<void> {
    console.log(chalk.yellow("\n🔐 GitHub Authentication Required"));
    console.log(
      chalk.gray("To clone LoveHolidays repositories, you need to authenticate with GitHub.\n")
    );

    const authMethods = [
      {
        name: "GitHub CLI (gh) - Recommended",
        value: "gh",
        description: "Use GitHub CLI for easy authentication",
      },
      {
        name: "Personal Access Token",
        value: "token",
        description: "Use a personal access token",
      },
      {
        name: "SSH Key",
        value: "ssh",
        description: "Use SSH key authentication",
      },
      {
        name: "Skip authentication setup",
        value: "skip",
        description: "I'll set this up manually later",
      },
    ];

    const { method } = await inquirer.prompt([
      {
        type: "list",
        name: "method",
        message: "How would you like to authenticate with GitHub?",
        choices: authMethods.map((method) => ({
          name: `${method.name} - ${method.description}`,
          value: method.value,
        })),
      },
    ]);

    switch (method) {
      case "gh":
        await this.setupGitHubCLI();
        break;
      case "token":
        await this.setupPersonalAccessToken();
        break;
      case "ssh":
        await this.setupSSHKey();
        break;
      case "skip":
        console.log(
          chalk.yellow(
            "⚠️  Skipping authentication setup. You may encounter issues cloning repositories."
          )
        );
        break;
    }
  }

  async setupGitHubCLI(): Promise<void> {
    console.log(chalk.cyan("\n📋 GitHub CLI Setup Instructions:"));
    console.log(chalk.gray("1. Install GitHub CLI if not already installed:"));
    console.log(chalk.gray("   macOS: brew install gh"));
    console.log(chalk.gray("   Windows: winget install GitHub.cli"));
    console.log(chalk.gray("   Linux: See https://github.com/cli/cli#installation"));
    console.log(chalk.gray("\n2. Authenticate with GitHub:"));
    console.log(chalk.gray("   gh auth login"));
    console.log(chalk.gray("\n3. Follow the prompts to authenticate"));

    const { proceed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Have you completed the GitHub CLI authentication?",
        default: false,
      },
    ]);

    if (proceed) {
      // Test authentication again
      const isAuthenticated = await this.checkGitAuthentication();
      if (isAuthenticated) {
        console.log(chalk.green("✅ GitHub authentication successful!"));
      } else {
        console.log(
          chalk.yellow(
            "⚠️  Authentication test failed. You may need to try again or use a different method."
          )
        );
      }
    }
  }

  async setupPersonalAccessToken(): Promise<void> {
    console.log(chalk.cyan("\n🔑 Personal Access Token Setup Instructions:"));
    console.log(
      chalk.gray("1. Go to GitHub Settings > Developer settings > Personal access tokens")
    );
    console.log(chalk.gray("2. Click 'Generate new token (classic)'"));
    console.log(chalk.gray("3. Select scopes: 'repo' (for private repositories)"));
    console.log(chalk.gray("4. Copy the generated token"));
    console.log(chalk.gray("5. Configure Git to use the token:"));
    console.log(chalk.gray("   git config --global credential.helper store"));
    console.log(chalk.gray("   git config --global user.name 'Your Name'"));
    console.log(chalk.gray("   git config --global user.email 'your.email@loveholidays.com'"));
    console.log(
      chalk.gray("\n6. When prompted for password during git operations, use your token")
    );

    console.log(
      chalk.yellow("\n💡 Tip: You can also use GitHub CLI (gh auth login) for easier setup")
    );
  }

  async setupSSHKey(): Promise<void> {
    console.log(chalk.cyan("\n🔐 SSH Key Setup Instructions:"));
    console.log(chalk.gray("1. Generate an SSH key (if you don't have one):"));
    console.log(chalk.gray("   ssh-keygen -t ed25519 -C 'your.email@loveholidays.com'"));
    console.log(chalk.gray("\n2. Add the SSH key to your SSH agent:"));
    console.log(chalk.gray('   eval "$(ssh-agent -s)"'));
    console.log(chalk.gray("   ssh-add ~/.ssh/id_ed25519"));
    console.log(chalk.gray("\n3. Copy your public key:"));
    console.log(chalk.gray("   cat ~/.ssh/id_ed25519.pub"));
    console.log(chalk.gray("\n4. Add the key to your GitHub account:"));
    console.log(chalk.gray("   Go to GitHub Settings > SSH and GPG keys > New SSH key"));
    console.log(chalk.gray("\n5. Test the connection:"));
    console.log(chalk.gray("   ssh -T git@github.com"));

    console.log(chalk.yellow("\n💡 Note: SSH URLs will be used for cloning (git@github.com:...)"));
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
      await execa("git", ["clone", repo.url, repoPath]);
      console.log(chalk.green(`✅ Successfully cloned ${repo.name}`));
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("Authentication failed") ||
        errorMessage.includes("Permission denied") ||
        errorMessage.includes("could not read Username")
      ) {
        console.error(chalk.red(`❌ Authentication failed for ${repo.name}`));
        console.log(
          chalk.yellow(
            "💡 You may need to set up GitHub authentication. Run the command again to get setup instructions."
          )
        );
      } else {
        console.error(chalk.red(`❌ Failed to clone ${repo.name}:`), errorMessage);
      }
      return false;
    }
  }

  async cloneRepositories(repositories: Repository[], onlyRequired = false): Promise<string[]> {
    await this.ensureWorkspaceExists();

    // Check authentication before attempting to clone
    console.log(chalk.blue("🔍 Checking GitHub authentication..."));
    const isAuthenticated = await this.checkGitAuthentication();

    if (!isAuthenticated) {
      console.log(chalk.yellow("⚠️  GitHub authentication not detected or failed."));
      await this.promptForAuthentication();

      // Check again after setup
      const isNowAuthenticated = await this.checkGitAuthentication();
      if (!isNowAuthenticated) {
        console.log(
          chalk.yellow("⚠️  Proceeding with cloning, but you may encounter authentication errors.")
        );
      }
    } else {
      console.log(chalk.green("✅ GitHub authentication verified!"));
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

    try {
      // Check if package.json exists
      const packageJsonPath = join(repoPath, "package.json");
      await fs.access(packageJsonPath);

      console.log(chalk.blue(`📦 Installing dependencies for ${repoName}...`));

      // Use pnpm if available, otherwise npm
      try {
        await execa("pnpm", ["install"], { cwd: repoPath });
        console.log(chalk.green(`✅ Dependencies installed for ${repoName} using pnpm`));
      } catch {
        try {
          await execa("npm", ["install"], { cwd: repoPath });
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
    console.log(chalk.cyan("\n🔧 Setting up dependencies...\n"));

    for (const repoName of repoNames) {
      await this.setupRepository(repoName);
    }
  }

  async listRepositories(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.workspacePath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  async getRepositoryInfo(
    repoName: string
  ): Promise<{ path: string; exists: boolean; hasGit: boolean }> {
    const repoPath = join(this.workspacePath, repoName);
    const gitPath = join(repoPath, ".git");

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
