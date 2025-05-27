import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { ConfigManager, DataManager } from '@/utils/config';

export class TeamCommand {
  getCommand(): Command {
    const teamCmd = new Command('team').description('Manage team settings and information');

    teamCmd
      .command('info')
      .description('Show current team information')
      .action(async () => {
        await this.showTeamInfo();
      });

    teamCmd
      .command('slack')
      .description('Show team Slack channels')
      .action(async () => {
        await this.showSlackChannels();
      });

    teamCmd
      .command('config')
      .description('Show team configuration')
      .action(async () => {
        await this.showTeamConfig();
      });

    teamCmd
      .command('settings')
      .description('Manage personal team settings')
      .action(async () => {
        await this.manageSettings();
      });

    teamCmd
      .command('quickref')
      .alias('qr')
      .description('Quick reference for new team members')
      .action(async () => {
        await this.showQuickReference();
      });

    return teamCmd;
  }

  async showTeamInfo(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    const team = await dataManager.getTeamById(config.user.team);
    if (!team) {
      console.log(chalk.red('❌ Team not found.'));
      return;
    }

    console.log(chalk.cyan(`\n👥 ${team.name} Team Information`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white(`Description: ${team.description}`));
    console.log(chalk.white(`Team Lead: ${team.lead}`));
    console.log(chalk.white(`Tools: ${team.tools.join(', ')}`));

    console.log(chalk.cyan('\n📂 Repositories:'));
    for (const repo of team.repositories) {
      const requiredBadge = repo.required ? chalk.red('[REQUIRED]') : chalk.gray('[OPTIONAL]');
      const typeBadge = chalk.blue(`[${repo.type.toUpperCase()}]`);
      console.log(
        `  ${requiredBadge} ${typeBadge} ${chalk.white(repo.name)} - ${chalk.gray(repo.description)}`
      );
    }

    console.log(chalk.cyan('\n📚 Onboarding Resources:'));
    const teamSpecificDocs = await dataManager.getTeamSpecificDocs(config.user.team);
    const allDocs = await dataManager.getAllOnboardingDocs(config.user.team);
    const globalDocs = await dataManager.getGlobalOnboardingDocs();

    if (teamSpecificDocs.length > 0) {
      console.log(chalk.yellow('Team-Specific Documentation:'));
      for (const doc of teamSpecificDocs) {
        console.log(chalk.green(`  🎯 ${doc}`));
      }

      console.log(chalk.yellow('\nGeneral LoveHolidays Documentation:'));
      for (const doc of globalDocs) {
        console.log(chalk.gray(`  • ${doc}`));
      }
    } else {
      for (const doc of allDocs) {
        console.log(chalk.gray(`  • ${doc}`));
      }
    }
  }

  async showSlackChannels(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    const slackChannels = await configManager.getTeamSlackChannels();
    if (!slackChannels) {
      console.log(chalk.red('❌ No Slack channels found for your team.'));
      return;
    }

    console.log(chalk.cyan('\n💬 Team Slack Channels'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.white(`Main: ${slackChannels.main}`));

    if (slackChannels.standup) {
      console.log(chalk.white(`Standup: ${slackChannels.standup}`));
    }
    if (slackChannels.alerts) {
      console.log(chalk.white(`Alerts: ${slackChannels.alerts}`));
    }
    if (slackChannels.social) {
      console.log(chalk.white(`Social: ${slackChannels.social}`));
    }
    if (slackChannels.support) {
      console.log(chalk.white(`Support: ${slackChannels.support}`));
    }

    const { teamSettings } = config;
    if (teamSettings) {
      console.log(chalk.cyan('\n⚙️  Your Preferences:'));
      console.log(chalk.gray(`Preferred channel: ${teamSettings.preferredSlackChannel}`));
      console.log(
        chalk.gray(`Notifications: ${teamSettings.slackNotifications ? 'Enabled' : 'Disabled'}`)
      );
    }
  }

  async showTeamConfig(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const teamConfig = await configManager.getTeamConfig();

    if (!teamConfig) {
      console.log(chalk.red('❌ No team configuration found.'));
      return;
    }

    console.log(chalk.cyan('\n⚙️  Team Configuration'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(chalk.white(`Default Branch: ${teamConfig.defaultBranch}`));
    console.log(
      chalk.white(`Code Review Required: ${teamConfig.codeReviewRequired ? 'Yes' : 'No'}`)
    );
    console.log(chalk.white(`CI/CD Pipeline: ${teamConfig.cicdPipeline}`));

    console.log(chalk.cyan('\n🚀 Deployment Environments:'));
    for (const env of teamConfig.deploymentEnvironments) {
      console.log(chalk.gray(`  • ${env}`));
    }

    console.log(chalk.cyan('\n🧪 Testing Strategy:'));
    for (const strategy of teamConfig.testingStrategy) {
      console.log(chalk.gray(`  • ${strategy}`));
    }

    console.log(chalk.cyan('\n📊 Monitoring Tools:'));
    for (const tool of teamConfig.monitoringTools) {
      console.log(chalk.gray(`  • ${tool}`));
    }

    const comm = teamConfig.communicationPreferences;
    console.log(chalk.cyan('\n💬 Communication:'));
    console.log(chalk.gray(`Timezone: ${comm.timezone}`));
    if (comm.standupTime) {
      console.log(chalk.gray(`Daily Standup: ${comm.standupTime}`));
    }
    console.log(chalk.gray(`Meeting Days: ${comm.meetingDays.join(', ')}`));
  }

  async manageSettings(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    const slackChannels = await configManager.getTeamSlackChannels();
    if (!slackChannels) {
      console.log(chalk.red('❌ No Slack channels found for your team.'));
      return;
    }

    const currentSettings = config.teamSettings || {
      slackNotifications: true,
      preferredSlackChannel: slackChannels.main,
      customWorkflows: {}
    };

    console.log(chalk.cyan('\n⚙️  Manage Team Settings'));
    console.log(chalk.gray('Configure your personal preferences for team workflows\n'));

    const channelChoices = [
      { name: `Main (${slackChannels.main})`, value: slackChannels.main },
      ...(slackChannels.standup
        ? [{ name: `Standup (${slackChannels.standup})`, value: slackChannels.standup }]
        : []),
      ...(slackChannels.alerts
        ? [{ name: `Alerts (${slackChannels.alerts})`, value: slackChannels.alerts }]
        : []),
      ...(slackChannels.social
        ? [{ name: `Social (${slackChannels.social})`, value: slackChannels.social }]
        : []),
      ...(slackChannels.support
        ? [{ name: `Support (${slackChannels.support})`, value: slackChannels.support }]
        : [])
    ];

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'slackNotifications',
        message: 'Enable Slack notifications for team updates?',
        default: currentSettings.slackNotifications
      },
      {
        type: 'list',
        name: 'preferredSlackChannel',
        message: 'Which Slack channel do you prefer for notifications?',
        choices: channelChoices,
        default: currentSettings.preferredSlackChannel
      },
      {
        type: 'input',
        name: 'gitBranchPrefix',
        message: "Git branch prefix (e.g., 'john' for john/feature-name)?",
        default: currentSettings.gitBranchPrefix || config.user.name.toLowerCase().split(' ')[0]
      }
    ]);

    await configManager.updateTeamSettings({
      slackNotifications: answers.slackNotifications,
      preferredSlackChannel: answers.preferredSlackChannel,
      gitBranchPrefix: answers.gitBranchPrefix
    });

    console.log(chalk.green('\n✅ Team settings updated successfully!'));
    console.log(chalk.gray(`Config saved to: ${configManager.getConfigPath()}`));
  }

  async showQuickReference(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const dataManager = DataManager.getInstance();
    const config = await configManager.getConfig();

    if (!config) {
      console.log(chalk.red("❌ No configuration found. Please run 'launchpad init' first."));
      return;
    }

    const team = await dataManager.getTeamById(config.user.team);
    const slackChannels = await configManager.getTeamSlackChannels();
    const teamConfig = await configManager.getTeamConfig();

    if (!team || !slackChannels || !teamConfig) {
      console.log(chalk.red('❌ Team information not found.'));
      return;
    }

    console.log(chalk.cyan(`\n🚀 ${team.name} Team Quick Reference`));
    console.log(chalk.gray('═'.repeat(40)));

    // Essential Links
    console.log(chalk.yellow('\n📖 MUST READ FIRST:'));
    const teamSpecificDocs = await dataManager.getTeamSpecificDocs(config.user.team);
    const globalDocs = await dataManager.getGlobalOnboardingDocs();
    if (teamSpecificDocs.length > 0) {
      console.log(chalk.green(`🎯 ${teamSpecificDocs[0]}`));
    } else {
      console.log(chalk.green(`🎯 ${globalDocs[0]}`));
    }

    // Slack Channels
    console.log(chalk.yellow('\n💬 KEY SLACK CHANNELS:'));
    console.log(chalk.white(`• Main: ${slackChannels.main}`));
    console.log(chalk.white(`• Standup: ${slackChannels.standup || 'N/A'}`));
    console.log(chalk.white(`• Alerts: ${slackChannels.alerts || 'N/A'}`));

    // Repositories
    console.log(chalk.yellow('\n📂 REQUIRED REPOSITORIES:'));
    const requiredRepos = team.repositories.filter((repo) => repo.required);
    for (const repo of requiredRepos) {
      console.log(chalk.white(`• ${repo.name} (${repo.type}) - ${repo.description}`));
    }

    // Development Info
    console.log(chalk.yellow('\n⚙️  DEVELOPMENT ESSENTIALS:'));
    console.log(chalk.white(`• Default Branch: ${teamConfig.defaultBranch}`));
    console.log(chalk.white(`• CI/CD: ${teamConfig.cicdPipeline}`));
    console.log(
      chalk.white(`• Code Review: ${teamConfig.codeReviewRequired ? 'Required' : 'Optional'}`)
    );
    console.log(chalk.white(`• Tools: ${team.tools.slice(0, 4).join(', ')}`));

    // Communication
    if (teamConfig.communicationPreferences.standupTime) {
      console.log(chalk.yellow('\n🕘 TEAM SCHEDULE:'));
      console.log(
        chalk.white(
          `• Daily Standup: ${teamConfig.communicationPreferences.standupTime} (${teamConfig.communicationPreferences.timezone})`
        )
      );
      console.log(
        chalk.white(`• Meeting Days: ${teamConfig.communicationPreferences.meetingDays.join(', ')}`)
      );
    }

    // Quick Actions
    console.log(chalk.yellow('\n⚡ QUICK ACTIONS:'));
    console.log(chalk.gray('• launchpad team info     - Full team details'));
    console.log(chalk.gray('• launchpad team slack    - All Slack channels'));
    console.log(chalk.gray('• launchpad team config   - Complete configuration'));
    console.log(chalk.gray('• launchpad team settings - Manage your preferences'));

    console.log(chalk.green('\n🎉 Welcome to the team! Start with the onboarding guide above.'));
  }
}
