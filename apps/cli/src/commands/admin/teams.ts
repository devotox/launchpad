import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { DataManager } from '@/utils/config';
import type { Team } from '@/utils/config';

type TeamFormData = {
  id: string;
  name: string;
  description: string;
  lead: string;
  mainSlackChannel: string;
  workspacePrefix: string;
};

type TeamUpdateData = {
  name: string;
  description: string;
  lead: string;
  workspacePrefix: string;
};

export class TeamsCommand {
  getCommand(): Command {
    const teamsCmd = new Command('teams')
      .description('Manage teams');

    teamsCmd
      .command('list')
      .description('List all teams')
      .action(async () => {
        await this.listTeams();
      });

    teamsCmd
      .command('add')
      .description('Add a new team')
      .action(async () => {
        await this.addTeam();
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
    teamsCmd
      .action(async () => {
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

    const { action } = await inquirer.prompt([
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

    switch (action) {
      case 'add':
        await this.addTeam();
        break;
      case 'edit':
        await this.selectAndEditTeam();
        break;
      case 'remove':
        await this.selectAndRemoveTeam();
        break;
    }
  }

  private async addTeam(): Promise<void> {
    console.log(chalk.cyan('\n➕ Add New Team'));
    console.log(chalk.gray('─'.repeat(20)));

    const teamData = await this.promptTeamData();
    const newTeam = this.createTeamFromData(teamData);

    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    if (teams.find(team => team.id === newTeam.id)) {
      console.log(chalk.red(`❌ Team with ID '${newTeam.id}' already exists.`));
      return;
    }

    teams.push(newTeam);
    await dataManager.updateTeams(teams);
    console.log(chalk.green(`✅ Team '${newTeam.name}' added successfully!`));
  }

  private async promptTeamData() {
    return await inquirer.prompt([
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
  }

  private validateTeamId(input: string): boolean | string {
    if (!input.trim()) return 'Team ID is required';
    if (!/^[a-z0-9-_]+$/.test(input)) {
      return 'Team ID must be lowercase letters, numbers, hyphens, or underscores only';
    }
    return true;
  }

  private validateSlackChannel(input: string): boolean | string {
    if (!input.trim()) return 'Main Slack channel is required';
    if (!input.startsWith('#')) return 'Slack channel must start with #';
    return true;
  }

  private createTeamFromData(teamData: TeamFormData): Team {
    return {
      id: teamData.id,
      name: teamData.name,
      description: teamData.description,
      lead: teamData.lead,
      slackChannels: {
        main: teamData.mainSlackChannel
      },
      repositories: [],
      tools: [],
      config: {
        defaultBranch: 'main',
        codeReviewRequired: true,
        deploymentEnvironments: ['staging', 'production'],
        testingStrategy: ['unit', 'integration'],
        cicdPipeline: 'GitHub Actions',
        monitoringTools: [],
        workspacePrefix: teamData.workspacePrefix || undefined,
        communicationPreferences: {
          timezone: 'Europe/London',
          meetingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        }
      }
    };
  }

  private async listTeams(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    console.log(chalk.cyan('\n👥 All Teams'));
    console.log(chalk.gray('─'.repeat(20)));

    if (teams.length === 0) {
      console.log(chalk.yellow('No teams found.'));
      return;
    }

    for (const team of teams) {
      this.displayTeamInfo(team);
    }
  }

  private displayTeamInfo(team: Team): void {
    console.log(chalk.white(`\n📋 ${team.name} (${team.id})`));
    console.log(chalk.gray(`   Description: ${team.description}`));
    console.log(chalk.gray(`   Lead: ${team.lead}`));
    console.log(chalk.gray(`   Repositories: ${team.repositories.length}`));
    console.log(chalk.gray(`   Tools: ${team.tools.slice(0, 3).join(', ')}${team.tools.length > 3 ? '...' : ''}`));
    if (team.slackChannels.main) {
      console.log(chalk.gray(`   Main Slack: ${team.slackChannels.main}`));
    }
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
    return await inquirer.prompt([
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

    const team = teams[teamIndex]!;
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
