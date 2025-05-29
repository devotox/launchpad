import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { ConfigManager } from '@/utils/config/manager';
import { DataManager } from '@/utils/config/data-manager';
import { RepositoryManager } from '@/utils/repository';
import type { Repository } from '@/utils/config/types';

export class RepoCommand {
  getCommand(): Command {
    const repoCmd = new Command('repo').description('Repository management commands');

    // Download (clone) repositories
    repoCmd
      .command('download')
      .description('Download (clone) repositories for your team and optionally install dependencies')
      .option('-a, --all', 'Clone all team repositories (not just required)', false)
      .option('-o, --overwrite', 'Overwrite existing repositories without prompting', false)
      .option('-r, --repo <name>', 'Clone a specific repository by name')
      .option('-i, --install', 'Install dependencies after cloning', false)
      .action(async (options) => {
        await this.downloadRepositories(options);
      });

    // Info (future: add more repo-related actions)
    repoCmd
      .command('info')
      .description('Show info about repositories in your workspace')
      .action(async () => {
        await this.showRepoInfo();
      });

    // Update (git pull) repositories
    repoCmd
      .command('update')
      .description('Update (git pull) repositories to latest main/master')
      .option('-a, --all', 'Update all team repositories', false)
      .option('-r, --repo <name>', 'Update a specific repository by name')
      .action(async (options) => {
        const configManager = ConfigManager.getInstance();
        const dataManager = DataManager.getInstance();
        const config = await configManager.getConfig();
        if (!config) {
          console.log(chalk.red('❌ No configuration found.'));
          return;
        }
        const repoManager = new RepositoryManager(config.workspace.path);
        let repos: string[] = [];
        const allRepoObjs = await repoManager.listRepositories();
        if (options.all) {
          repos = allRepoObjs.map(r => r.name);
        } else if (options.repo) {
          repos = [options.repo];
        } else {
          // Interactive selection
          const allRepos = allRepoObjs.map(r => r.name);
          const { selected } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selected',
              message: 'Select repositories to update:',
              choices: allRepos
            }
          ]);
          repos = selected;
        }
        for (const repo of repos) {
          // Get repo path (assume workspace path + repo name)
          const path = require('node:path');
          const repoPath = path.join(config.workspace.path, repo);
          const { execSync } = await import('node:child_process');
          let branch = 'main';
          try {
            const branches = execSync('git branch -a', { cwd: repoPath }).toString();
            if (branches.includes('master')) branch = 'master';
          } catch (e) {
            console.log(chalk.red(`❌ Failed to detect branch for ${repo}`));
            continue;
          }
          try {
            console.log(chalk.cyan(`🔄 Pulling latest for ${repo} (${branch})...`));
            const output = execSync(`git pull origin ${branch}`, { cwd: repoPath }).toString();
            console.log(chalk.green(output));
          } catch (e) {
            console.log(chalk.red(`❌ git pull failed for ${repo}`));
          }
        }
      });

    return repoCmd;
  }

  async downloadRepositories(options: { all?: boolean; overwrite?: boolean; repo?: string; install?: boolean }) {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    const team = await dataManager.getTeamById(config.user.team);
    if (!team) {
      console.log(chalk.red('❌ Team information not found.'));
      return;
    }

    const repoManager = new RepositoryManager(config.workspace.path);
    let reposToClone: Repository[] = [];
    let warnNotInTeam = false;

    if (options.all) {
      reposToClone = team.repositories;
    } else if (options.repo) {
      // Try to find the repo in the team
      const found = team.repositories.find(r => r.name === options.repo);
      if (found) {
        reposToClone = [found];
      } else {
        warnNotInTeam = true;
        // Allow user to specify a repo not in their team
        // Prompt for URL and minimal info
        const { url, description, type } = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: `Repository URL for '${options.repo}':`,
            validate: (input: string) => input.length > 0 || 'URL is required',
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):',
            default: '',
          },
          {
            type: 'list',
            name: 'type',
            message: 'Repository type:',
            choices: [
              { name: 'Frontend', value: 'frontend' },
              { name: 'Backend', value: 'backend' },
              { name: 'Mobile', value: 'mobile' },
              { name: 'Infrastructure', value: 'infrastructure' },
              { name: 'Shared/Library', value: 'shared' },
            ],
            default: 'shared',
          },
        ]);
        reposToClone = [{
          name: options.repo,
          url,
          description,
          required: false,
          type,
        }];
      }
    } else {
      // Interactive selection
      const choices = team.repositories.map((repo) => ({
        name: `${repo.name} (${repo.type}) - ${repo.description}`,
        value: repo.name,
        checked: repo.required,
      }));
      const { selectedRepos } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedRepos',
          message: 'Select repositories to clone:',
          choices,
        },
      ]);
      reposToClone = team.repositories.filter((repo) => selectedRepos.includes(repo.name));
      if (reposToClone.length === 0) {
        console.log(chalk.yellow('⚠️  No repositories selected.'));
        return;
      }
    }

    if (warnNotInTeam) {
      console.log(chalk.yellow(`⚠️  The repository '${options.repo}' is not in your team. Proceeding anyway.`));
    }

    const cloneOptions = {
      overwrite: !!options.overwrite,
      interactive: !options.overwrite,
      deleteStrategy: 'tmp',
    };

    try {
      const clonedRepos = await repoManager.cloneRepositories(
        reposToClone,
        false, // onlyRequired is not relevant here
        undefined,
        cloneOptions
      );

      // Update config with cloned repositories (add new ones if not present)
      const updatedRepoNames = Array.from(new Set([
        ...config.workspace.repositories,
        ...clonedRepos,
      ]));
      await configManager.updateConfig({
        workspace: {
          ...config.workspace,
          repositories: updatedRepoNames,
        },
      });

      if (clonedRepos.length > 0) {
        console.log(chalk.green(`\n✅ Successfully set up ${clonedRepos.length} repositories!`));
        if (options.install) {
          await repoManager.setupRepositories(clonedRepos);
        } else {
          const { shouldInstall } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'shouldInstall',
              message: 'Do you want to install dependencies for the cloned repositories?',
              default: true,
            },
          ]);
          if (shouldInstall) {
            await repoManager.setupRepositories(clonedRepos);
          }
        }
      } else {
        console.log(chalk.yellow('\n⚠️  No repositories were cloned.'));
      }
    } catch (error) {
      console.log(chalk.red('\n❌ Repository cloning encountered issues.'));
      console.log(chalk.gray(`Error: ${error}`));
    }
  }

  async showRepoInfo() {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();
    if (!config) {
      console.log(chalk.red('❌ No configuration found.'));
      return;
    }
    const repoManager = new RepositoryManager(config.workspace.path);
    const repos = await repoManager.listRepositories();
    if (repos.length === 0) {
      console.log(chalk.yellow('No repositories found in workspace.'));
      return;
    }
    console.log(chalk.cyan('\n📁 Available Repositories'));
    repos.forEach((repo) => {
      console.log(chalk.white(`- ${repo}`));
    });
  }
}
