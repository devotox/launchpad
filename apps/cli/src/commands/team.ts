import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';

import { DataManager } from '@/utils/config/data-manager/index';
import { ConfigManager } from '@/utils/config/manager';

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

    // Header
    console.log(chalk.cyan(`\n👥 ${team.name} Team`));
    console.log(chalk.gray('═'.repeat(50)));

    // Basic Info
    console.log(chalk.white(`📝 ${team.description}`));
    console.log(chalk.white(`👤 Team Lead: ${chalk.yellow(team.lead)}`));
    console.log('');

    // Slack Channels
    console.log(chalk.cyan('💬 Slack Channels'));
    console.log(chalk.gray('─'.repeat(20)));
    if (team.slackChannels.main) {
      console.log(`   ${chalk.green('●')} Main: ${chalk.white(team.slackChannels.main)}`);
    }
    if ((team.slackChannels as any).dev) {
      console.log(`   ${chalk.blue('●')} Dev: ${chalk.white((team.slackChannels as any).dev)}`);
    }
    if (team.slackChannels.alerts) {
      console.log(`   ${chalk.red('●')} Alerts: ${chalk.white(team.slackChannels.alerts)}`);
    }
    if (team.slackChannels.support) {
      console.log(`   ${chalk.yellow('●')} Support: ${chalk.white(team.slackChannels.support)}`);
    }
    if ((team.slackChannels as any).updates) {
      console.log(`   ${chalk.magenta('●')} Updates: ${chalk.white((team.slackChannels as any).updates)}`);
    }
    console.log('');

    // Repositories
    console.log(chalk.cyan('📂 Repositories'));
    console.log(chalk.gray('─'.repeat(15)));
    for (const repo of team.repositories) {
      const requiredIcon = repo.required ? chalk.red('🔴') : chalk.gray('⚪');
      let typeColor;
      if (repo.type === 'backend') {
        typeColor = chalk.blue;
      } else if (repo.type === 'frontend') {
        typeColor = chalk.green;
      } else {
        typeColor = chalk.gray;
      }
      console.log(`   ${requiredIcon} ${typeColor(repo.name)} - ${chalk.gray(repo.description)}`);
    }
    console.log('');

    // Tools & Resources (new unified structure)
    if ((team as any).tools) {
      console.log(chalk.cyan('🔧 Tools & Resources'));
      console.log(chalk.gray('─'.repeat(25)));

      for (const [categoryKey, category] of Object.entries((team as any).tools)) {
        const categoryData = category as any;
        const icon = categoryData.icon ?? '🔧'; // Default icon if none specified
        console.log(`   ${icon} ${chalk.yellow(categoryData.name)}:`);

        if (Array.isArray(categoryData.items)) {
          // Simple list (like development tools)
          const itemsPerRow = 4;
          for (let i = 0; i < categoryData.items.length; i += itemsPerRow) {
            const itemsRow = categoryData.items.slice(i, i + itemsPerRow);
            const formattedItems = itemsRow.map((tool: string) => chalk.white(`• ${tool}`));
            console.log(`     ${formattedItems.join('  ')}`);
          }
        } else {
          // Object with URLs and descriptions
          for (const [itemName, itemData] of Object.entries(categoryData.items)) {
            if (typeof itemData === 'string') {
              // Simple URL
              console.log(`     ${chalk.gray('•')} ${chalk.white(itemName)}`);
              console.log(`       ${chalk.gray(itemData)}`);
            } else {
              // Object with description
              const item = itemData as any;
              console.log(`     ${chalk.gray('•')} ${chalk.white(itemName)} - ${chalk.gray(item.description || '')}`);
              if (item.url) {
                console.log(`       ${chalk.gray(item.url)}`);
              }
            }
          }
        }
        console.log('');
      }
    }

    // Global Documentation (condensed)
    const globalDocs = await dataManager.getGlobalOnboardingDocs();
    if (globalDocs.length > 0) {
      console.log(chalk.cyan('🌐 General Resources'));
      console.log(chalk.gray('─'.repeat(20)));

      // Group docs by category
      const categories = {
        'Setup & Access': globalDocs.filter(doc =>
          doc.includes('GitHub') || doc.includes('NPM') || doc.includes('VPN') || doc.includes('Kubernetes')
        ),
        'Development': globalDocs.filter(doc =>
          doc.includes('DevPortal') || doc.includes('Digital Product')
        ),
        'Monitoring': globalDocs.filter(doc =>
          doc.includes('Grafana') || doc.includes('Looker')
        ),
        'Support': globalDocs.filter(doc =>
          doc.includes('Freshservice')
        )
      };

      for (const [category, docs] of Object.entries(categories)) {
        if (docs.length > 0) {
          console.log(`   ${chalk.yellow(category)}:`);
          docs.slice(0, 3).forEach(doc => {
            const [title] = doc.split(': ');
            console.log(`     ${chalk.gray('•')} ${chalk.white(title)}`);
          });
          if (docs.length > 3) {
            const moreCount = docs.length - 3;
            console.log(`     ${chalk.gray(`... and ${moreCount} more`)}`);
          }
          console.log('');
        }
      }
    }

    // Quick Actions
    console.log(chalk.cyan('⚡ Quick Actions'));
    console.log(chalk.gray('─'.repeat(15)));
    console.log(`   ${chalk.white('launchpad team slack')}    - View all Slack channels`);
    console.log(`   ${chalk.white('launchpad team config')}   - View team configuration`);
    console.log(`   ${chalk.white('launchpad team qr')}       - Quick reference guide`);
    console.log(`   ${chalk.white('launchpad app dev --all')} - Start all repositories`);
    console.log('');
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

    // Show development tools from new structure
    const devTools = (team as any).tools?.development?.items;
    if (devTools && Array.isArray(devTools)) {
      console.log(chalk.white(`• Tools: ${devTools.slice(0, 4).join(', ')}`));
    }

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
