import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { match } from 'ts-pattern';

import type { Team, Repository, SlackChannels, TeamConfig } from '@/utils/config/types';

import { DataManager } from '@/utils/config/data-manager';

type TeamFormData = {
  id: string;
  name: string;
  description: string;
  lead: string;
  mainSlackChannel: string;
  workspacePrefix: string;
  // Extended properties
  additionalSlackChannels: boolean;
  standupChannel?: string;
  alertsChannel?: string;
  socialChannel?: string;
  supportChannel?: string;
  addRepositories: boolean;
  addTools: boolean;
  configureAdvanced: boolean;
  // Advanced config
  defaultBranch?: string;
  codeReviewRequired?: boolean;
  deploymentEnvironments?: string[];
  testingStrategy?: string[];
  cicdPipeline?: string;
  monitoringTools?: string[];
  standupTime?: string;
  timezone?: string;
  meetingDays?: string[];
};

type TeamUpdateData = {
  name: string;
  description: string;
  lead: string;
  workspacePrefix: string;
};

export class TeamsCommand {
  getCommand(): Command {
    const teamsCmd = new Command('teams').description('Manage teams');

    teamsCmd
      .command('list')
      .description('List all teams')
      .action(async () => {
        await this.listTeams();
      });

    teamsCmd
      .command('add')
      .description('Add a new team')
      .option('--quick', 'Quick setup with minimal prompts')
      .action(async (options: { quick?: boolean }) => {
        await this.addTeam(Boolean(options.quick));
      });

    teamsCmd
      .command('edit [teamId]')
      .description('Edit a team')
      .action(async (teamId) => {
        if (teamId) {
          await this.editTeam(teamId);
        } else {
          await this.selectAndEditTeam();
        }
      });

    teamsCmd
      .command('remove [teamId]')
      .description('Remove a team')
      .action(async (teamId) => {
        if (teamId) {
          await this.removeTeam(teamId);
        } else {
          await this.selectAndRemoveTeam();
        }
      });

    // Interactive management mode
    teamsCmd.action(async () => {
      await this.manageTeams();
    });

    return teamsCmd;
  }

  private async manageTeams(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    console.log(chalk.cyan('\n👥 Teams Management'));
    console.log(chalk.gray('─'.repeat(30)));

    if (teams.length === 0) {
      console.log(chalk.yellow('No teams found.'));
    } else {
      teams.forEach((team, index) => {
        console.log(chalk.white(`${index + 1}. ${team.name} (${team.id}) - ${team.description}`));
      });
    }

    const answers = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Add new team', value: 'add' },
          { name: 'Edit existing team', value: 'edit' },
          { name: 'Remove team', value: 'remove' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);

    await match(answers.action)
      .with('add', async () => this.addTeam(false))
      .with('edit', async () => this.selectAndEditTeam())
      .with('remove', async () => this.selectAndRemoveTeam())
      .otherwise(async () => Promise.resolve());
  }

  public async addTeam(quickMode = false): Promise<void> {
    console.log(chalk.cyan('\n➕ Add New Team'));
    console.log(chalk.gray('─'.repeat(20)));

    if (quickMode) {
      console.log(chalk.gray('Quick mode: Setting up basic team information only\n'));
    } else {
      console.log(chalk.gray('Comprehensive setup: Configure all team properties\n'));
    }

    const teamData = await this.promptTeamData(quickMode);
    const newTeam = await this.createTeamFromData(teamData);

    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    if (teams.find((team) => team.id === newTeam.id)) {
      console.log(chalk.red(`❌ Team with ID '${newTeam.id}' already exists.`));
      return;
    }

    teams.push(newTeam);
    await dataManager.updateTeams(teams);
    console.log(chalk.green(`✅ Team '${newTeam.name}' added successfully!`));

    // Show summary
    this.displayTeamSummary(newTeam);
  }

  private async promptTeamData(quickMode: boolean): Promise<TeamFormData> {
    // Basic team information
    const basicData = await inquirer.prompt([
      {
        type: 'input',
        name: 'id',
        message: 'Team ID (lowercase, no spaces):',
        validate: this.validateTeamId
      },
      {
        type: 'input',
        name: 'name',
        message: 'Team name:',
        validate: (input: string) => input.trim().length > 0 || 'Team name is required'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Team description:',
        validate: (input: string) => input.trim().length > 0 || 'Description is required'
      },
      {
        type: 'input',
        name: 'lead',
        message: 'Team lead:',
        default: 'TBD'
      },
      {
        type: 'input',
        name: 'mainSlackChannel',
        message: 'Main Slack channel (e.g., #team-name):',
        validate: this.validateSlackChannel
      },
      {
        type: 'input',
        name: 'workspacePrefix',
        message: 'Workspace directory prefix (optional):',
        default: ''
      }
    ]);

    if (quickMode) {
      return {
        ...basicData,
        additionalSlackChannels: false,
        addRepositories: false,
        addTools: false,
        configureAdvanced: false
      };
    }

    // Extended configuration options
    const extendedData = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'additionalSlackChannels',
        message: 'Configure additional Slack channels (standup, alerts, social, support)?',
        default: true
      },
      {
        type: 'confirm',
        name: 'addRepositories',
        message: 'Add team repositories now?',
        default: false
      },
      {
        type: 'confirm',
        name: 'addTools',
        message: 'Configure team tools and resources?',
        default: false
      },
      {
        type: 'confirm',
        name: 'configureAdvanced',
        message: 'Configure advanced team settings (CI/CD, testing, etc.)?',
        default: true
      }
    ]);

    let slackChannelsData = {};
    if (extendedData.additionalSlackChannels) {
      slackChannelsData = await this.promptSlackChannels();
    }

    let advancedConfigData = {};
    if (extendedData.configureAdvanced) {
      advancedConfigData = await this.promptAdvancedConfig();
    }

    return {
      ...basicData,
      ...extendedData,
      ...slackChannelsData,
      ...advancedConfigData
    };
  }

  private async promptSlackChannels() {
    console.log(chalk.cyan('\n💬 Additional Slack Channels'));
    console.log(chalk.gray('Leave empty to skip any channel\n'));

    return inquirer.prompt([
      {
        type: 'input',
        name: 'standupChannel',
        message: 'Standup channel (e.g., #team-standup):',
        validate: (input: string) => !input || this.validateSlackChannel(input)
      },
      {
        type: 'input',
        name: 'alertsChannel',
        message: 'Alerts channel (e.g., #team-alerts):',
        validate: (input: string) => !input || this.validateSlackChannel(input)
      },
      {
        type: 'input',
        name: 'socialChannel',
        message: 'Social channel (e.g., #team-social):',
        validate: (input: string) => !input || this.validateSlackChannel(input)
      },
      {
        type: 'input',
        name: 'supportChannel',
        message: 'Support channel (e.g., #team-support):',
        validate: (input: string) => !input || this.validateSlackChannel(input)
      }
    ]);
  }

  private async promptAdvancedConfig() {
    console.log(chalk.cyan('\n⚙️  Advanced Team Configuration'));
    console.log(chalk.gray('Configure team workflows and preferences\n'));

    const basicConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'defaultBranch',
        message: 'Default branch name:',
        default: 'main'
      },
      {
        type: 'confirm',
        name: 'codeReviewRequired',
        message: 'Require code reviews for all PRs?',
        default: true
      },
      {
        type: 'input',
        name: 'cicdPipeline',
        message: 'CI/CD pipeline:',
        default: 'GitHub Actions'
      }
    ]);

    const environments = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'deploymentEnvironments',
        message: 'Deployment environments:',
        choices: [
          { name: 'Development', value: 'development' },
          { name: 'Staging', value: 'staging', checked: true },
          { name: 'Production', value: 'production', checked: true },
          { name: 'Testing', value: 'testing' },
          { name: 'Preview', value: 'preview' }
        ]
      },
      {
        type: 'checkbox',
        name: 'testingStrategy',
        message: 'Testing strategy:',
        choices: [
          { name: 'Unit tests', value: 'unit', checked: true },
          { name: 'Integration tests', value: 'integration', checked: true },
          { name: 'End-to-end tests', value: 'e2e' },
          { name: 'Performance tests', value: 'performance' },
          { name: 'Security tests', value: 'security' }
        ]
      },
      {
        type: 'checkbox',
        name: 'monitoringTools',
        message: 'Monitoring tools:',
        choices: [
          { name: 'Datadog', value: 'datadog' },
          { name: 'New Relic', value: 'newrelic' },
          { name: 'Sentry', value: 'sentry' },
          { name: 'Grafana', value: 'grafana' },
          { name: 'Prometheus', value: 'prometheus' },
          { name: 'CloudWatch', value: 'cloudwatch' }
        ]
      }
    ]);

    const communication = await inquirer.prompt([
      {
        type: 'input',
        name: 'standupTime',
        message: 'Daily standup time (e.g., 09:30):',
        validate: (input: string) => {
          if (!input) return true;
          const timeRegex = /^([0-1]?\d|2[0-3]):[0-5]\d$/;
          return timeRegex.test(input) || 'Please enter time in HH:MM format';
        }
      },
      {
        type: 'list',
        name: 'timezone',
        message: 'Team timezone:',
        choices: [
          { name: 'Europe/London (GMT/BST)', value: 'Europe/London' },
          { name: 'Europe/Berlin (CET/CEST)', value: 'Europe/Berlin' },
          { name: 'America/New_York (EST/EDT)', value: 'America/New_York' },
          { name: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
          { name: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
          { name: 'Australia/Sydney (AEST/AEDT)', value: 'Australia/Sydney' }
        ],
        default: 'Europe/London'
      },
      {
        type: 'checkbox',
        name: 'meetingDays',
        message: 'Meeting days:',
        choices: [
          { name: 'Monday', value: 'Monday', checked: true },
          { name: 'Tuesday', value: 'Tuesday', checked: true },
          { name: 'Wednesday', value: 'Wednesday', checked: true },
          { name: 'Thursday', value: 'Thursday', checked: true },
          { name: 'Friday', value: 'Friday', checked: true },
          { name: 'Saturday', value: 'Saturday' },
          { name: 'Sunday', value: 'Sunday' }
        ]
      }
    ]);

    return {
      ...basicConfig,
      ...environments,
      ...communication
    };
  }

  private validateTeamId(input: string): boolean | string {
    if (!input.trim()) return 'Team ID is required';
    if (!/^[a-z0-9-_]+$/.test(input)) {
      return 'Team ID must be lowercase letters, numbers, hyphens, or underscores only';
    }
    return true;
  }

  private validateSlackChannel(input: string): boolean | string {
    if (!input.trim()) return 'Slack channel is required';
    if (!input.startsWith('#')) return 'Slack channel must start with #';
    return true;
  }

  private async createTeamFromData(teamData: TeamFormData): Promise<Team> {
    // Build Slack channels
    const slackChannels: SlackChannels = {
      main: teamData.mainSlackChannel
    };

    if (teamData.standupChannel) slackChannels.standup = teamData.standupChannel;
    if (teamData.alertsChannel) slackChannels.alerts = teamData.alertsChannel;
    if (teamData.socialChannel) slackChannels.social = teamData.socialChannel;
    if (teamData.supportChannel) slackChannels.support = teamData.supportChannel;

    // Build team config
    const config: TeamConfig = {
      defaultBranch: teamData.defaultBranch || 'main',
      codeReviewRequired: teamData.codeReviewRequired ?? true,
      deploymentEnvironments: teamData.deploymentEnvironments || ['staging', 'production'],
      testingStrategy: teamData.testingStrategy || ['unit', 'integration'],
      cicdPipeline: teamData.cicdPipeline || 'GitHub Actions',
      monitoringTools: teamData.monitoringTools || [],
      workspacePrefix: teamData.workspacePrefix || undefined,
      communicationPreferences: {
        standupTime: teamData.standupTime,
        timezone: teamData.timezone || 'Europe/London',
        meetingDays: teamData.meetingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      }
    };

    const team: Team = {
      id: teamData.id,
      name: teamData.name,
      description: teamData.description,
      lead: teamData.lead,
      slackChannels,
      repositories: [],
      tools: [],
      config
    };

    // Add repositories if requested
    if (teamData.addRepositories) {
      team.repositories = await this.promptRepositories();
    }

    // Add tools if requested
    if (teamData.addTools) {
      team.tools = await this.promptTools();
    }

    return team;
  }

  private async promptRepositories(): Promise<Repository[]> {
    console.log(chalk.cyan('\n📂 Team Repositories'));
    console.log(chalk.gray('Add repositories one by one. Press Enter with empty name to finish.\n'));

    const repositories: Repository[] = [];
    let addMore = true;

    while (addMore) {
      const repoData = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: `Repository name (${repositories.length + 1}):`,
          validate: (input: string) => {
            if (!input.trim()) {
              if (repositories.length === 0) {
                return 'At least one repository is required';
              }
              return true; // Empty input to finish
            }
            return true;
          }
        }
      ]);

      if (!repoData.name.trim()) {
        addMore = false;
        continue;
      }

      const repoDetails = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Repository URL:',
          validate: (input: string) => input.trim().length > 0 || 'URL is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description:',
          default: ''
        },
        {
          type: 'confirm',
          name: 'required',
          message: 'Is this repository required for new team members?',
          default: true
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
            { name: 'Shared/Library', value: 'shared' }
          ]
        }
      ]);

      repositories.push({
        name: repoData.name,
        url: repoDetails.url,
        description: repoDetails.description,
        required: repoDetails.required,
        type: repoDetails.type
      });

      const { continueAdding } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: 'Add another repository?',
          default: false
        }
      ]);

      addMore = continueAdding;
    }

    return repositories;
  }

  private async promptTools(): Promise<string[]> {
    console.log(chalk.cyan('\n🔧 Team Tools'));
    console.log(chalk.gray('Select tools and technologies your team uses.\n'));

    const { tools } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'tools',
        message: 'Select team tools:',
        choices: [
          // Development
          { name: 'Node.js', value: 'nodejs' },
          { name: 'TypeScript', value: 'typescript' },
          { name: 'React', value: 'react' },
          { name: 'Vue.js', value: 'vue' },
          { name: 'Angular', value: 'angular' },
          { name: 'Python', value: 'python' },
          { name: 'Java', value: 'java' },
          { name: 'Go', value: 'go' },
          { name: 'Rust', value: 'rust' },

          // Databases
          { name: 'PostgreSQL', value: 'postgresql' },
          { name: 'MySQL', value: 'mysql' },
          { name: 'MongoDB', value: 'mongodb' },
          { name: 'Redis', value: 'redis' },

          // Cloud & Infrastructure
          { name: 'AWS', value: 'aws' },
          { name: 'Google Cloud', value: 'gcp' },
          { name: 'Azure', value: 'azure' },
          { name: 'Docker', value: 'docker' },
          { name: 'Kubernetes', value: 'kubernetes' },
          { name: 'Terraform', value: 'terraform' },

          // Tools
          { name: 'GitHub Actions', value: 'github-actions' },
          { name: 'Jenkins', value: 'jenkins' },
          { name: 'Jira', value: 'jira' },
          { name: 'Confluence', value: 'confluence' },
          { name: 'Figma', value: 'figma' },
          { name: 'Postman', value: 'postman' }
        ]
      }
    ]);

    return tools;
  }

  private displayTeamSummary(team: Team): void {
    console.log(chalk.cyan('\n📋 Team Summary'));
    console.log(chalk.gray('─'.repeat(20)));
    console.log(`${chalk.white('Name:')} ${chalk.yellow(team.name)}`);
    console.log(`${chalk.white('ID:')} ${chalk.gray(team.id)}`);
    console.log(`${chalk.white('Description:')} ${chalk.gray(team.description)}`);
    console.log(`${chalk.white('Lead:')} ${chalk.green(team.lead)}`);
    console.log(`${chalk.white('Main Slack:')} ${chalk.magenta(team.slackChannels.main)}`);

    if (team.repositories.length > 0) {
      console.log(`${chalk.white('Repositories:')} ${chalk.blue(team.repositories.length)}`);
    }

    // Handle both old array format and new unified tools structure
    if (Array.isArray(team.tools) && team.tools.length > 0) {
      console.log(`${chalk.white('Tools:')} ${chalk.cyan(team.tools.length)}`);
    } else if (team.tools && typeof team.tools === 'object' && !Array.isArray(team.tools)) {
      const categoryCount = Object.keys(team.tools).length;
      console.log(`${chalk.white('Tools:')} ${chalk.cyan(`${categoryCount} categories`)}`);
    }

    console.log('');
  }

  private async listTeams(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    console.log(chalk.cyan('\n👥 All Teams'));
    console.log(chalk.gray('═'.repeat(25)));

    if (teams.length === 0) {
      console.log(chalk.yellow('📭 No teams found'));
      console.log('');
      console.log(chalk.cyan('⚡ Quick Actions'));
      console.log(chalk.gray('─'.repeat(15)));
      console.log(`   ${chalk.white('launchpad admin teams:add')} - Add new team`);
      console.log('');
      return;
    }

    console.log(chalk.white(`📊 Total Teams: ${chalk.yellow(teams.length)}`));
    console.log('');

    for (const team of teams) {
      this.displayTeamInfo(team);
    }

    console.log(chalk.cyan('⚡ Quick Actions'));
    console.log(chalk.gray('─'.repeat(15)));
    console.log(`   ${chalk.white('launchpad admin teams:add')}    - Add new team`);
    console.log(`   ${chalk.white('launchpad admin teams:edit')}   - Edit existing team`);
    console.log(`   ${chalk.white('launchpad admin teams:remove')} - Remove team`);
    console.log('');
  }

  private displayTeamInfo(team: Team): void {
    console.log(chalk.cyan(`📋 ${team.name}`));
    console.log(chalk.gray('─'.repeat(15)));
    console.log(`   ${chalk.white('ID:')} ${chalk.yellow(team.id)}`);
    console.log(`   ${chalk.white('Description:')} ${chalk.gray(team.description)}`);
    console.log(`   ${chalk.white('Lead:')} ${chalk.green(team.lead)}`);
    console.log(`   ${chalk.white('Repositories:')} ${chalk.blue(team.repositories.length)}`);

    // Handle both old array format and new unified tools structure
    if (Array.isArray(team.tools) && team.tools.length > 0) {
      const toolsDisplay = team.tools.length > 3
        ? `${team.tools.slice(0, 3).join(', ')} ${chalk.gray(`(+${team.tools.length - 3} more)`)}`
        : team.tools.join(', ');
      console.log(`   ${chalk.white('Tools:')} ${chalk.cyan(toolsDisplay)}`);
    } else if (team.tools && typeof team.tools === 'object' && !Array.isArray(team.tools)) {
      const categoryCount = Object.keys(team.tools).length;
      console.log(`   ${chalk.white('Tools:')} ${chalk.cyan(`${categoryCount} categories`)}`);
    }

    if (team.slackChannels.main) {
      console.log(`   ${chalk.white('Main Slack:')} ${chalk.magenta(team.slackChannels.main)}`);
    }

    if (team.config.workspacePrefix) {
      console.log(`   ${chalk.white('Workspace:')} ${chalk.gray(team.config.workspacePrefix)}`);
    }

    console.log('');
  }

  private async selectAndEditTeam(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    if (teams.length === 0) {
      console.log(chalk.yellow('No teams available to edit.'));
      return;
    }

    const { teamId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'teamId',
        message: 'Select team to edit:',
        choices: teams.map((team) => ({
          name: `${team.name} (${team.id})`,
          value: team.id
        }))
      }
    ]);

    await this.editTeam(teamId);
  }

  private async editTeam(teamId: string): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();
    const team = teams.find((t) => t.id === teamId);

    if (!team) {
      console.log(chalk.red(`❌ Team '${teamId}' not found.`));
      return;
    }

    console.log(chalk.cyan(`\n✏️  Edit Team: ${team.name}`));
    console.log(chalk.gray('─'.repeat(30)));

    const updates = await this.promptTeamUpdates(team);
    this.applyTeamUpdates(team, updates);

    await dataManager.updateTeams(teams);
    console.log(chalk.green(`✅ Team '${team.name}' updated successfully!`));
  }

  private async promptTeamUpdates(team: Team) {
    return inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Team name:',
        default: team.name
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: team.description
      },
      {
        type: 'input',
        name: 'lead',
        message: 'Team lead:',
        default: team.lead
      },
      {
        type: 'input',
        name: 'workspacePrefix',
        message: 'Workspace prefix:',
        default: team.config.workspacePrefix || ''
      }
    ]);
  }

  private applyTeamUpdates(team: Team, updates: TeamUpdateData): void {
    team.name = updates.name;
    team.description = updates.description;
    team.lead = updates.lead;
    team.config.workspacePrefix = updates.workspacePrefix || undefined;
  }

  private async selectAndRemoveTeam(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    if (teams.length === 0) {
      console.log(chalk.yellow('No teams available to remove.'));
      return;
    }

    const { teamId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'teamId',
        message: 'Select team to remove:',
        choices: teams.map((team) => ({
          name: `${team.name} (${team.id})`,
          value: team.id
        }))
      }
    ]);

    await this.removeTeam(teamId);
  }

  private async removeTeam(teamId: string): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();
    const teamIndex = teams.findIndex((team) => team.id === teamId);

    if (teamIndex === -1) {
      console.log(chalk.red(`❌ Team '${teamId}' not found.`));
      return;
    }

    const team = teams[teamIndex];
    if (!team) {
      console.log(chalk.red(`❌ Team '${teamId}' not found.`));
      return;
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Are you sure you want to remove team '${team.name}'?`,
        default: false
      }
    ]);

    if (!confirmed) {
      console.log(chalk.yellow('Team removal cancelled.'));
      return;
    }

    teams.splice(teamIndex, 1);
    await dataManager.updateTeams(teams);
    console.log(chalk.green(`✅ Team '${team.name}' removed successfully!`));
  }
}
