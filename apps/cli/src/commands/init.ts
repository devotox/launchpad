import { ConfigManager, DataManager } from "@/utils/config";
import { RepositoryManager } from "@/utils/repository";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

interface InitAnswers {
  name: string;
  email: string;
  team: string;
  workspacePath: string;
  cloneRepos: boolean;
  cloneType?: "required" | "all";
  setupDependencies?: boolean;
}

export class InitCommand {
  getCommand(): Command {
    return new Command("init")
      .description("Initialize your developer workspace")
      .option("--force", "Force re-initialization even if config exists")
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
      console.log(chalk.yellow("⚠️  Launchpad is already initialized!"));
      console.log(chalk.gray(`Config found at: ${configManager.getConfigPath()}`));
      console.log(chalk.gray(`Current team: ${existingConfig?.user.team}`));
      console.log(chalk.gray("Use --force to re-initialize"));
      return;
    }

    console.log(chalk.cyan("🚀 Welcome to LoveHolidays Launchpad!"));
    console.log(chalk.gray("Let's set up your developer workspace...\n"));

    const teamChoices = await dataManager.getTeamChoices();

    const answers = await inquirer.prompt<InitAnswers>([
      {
        type: "input",
        name: "name",
        message: "What's your name?",
        validate: (input: string) => input.length > 0 || "Please enter your name",
      },
      {
        type: "input",
        name: "email",
        message: "What's your email address?",
        default: (answers: Partial<InitAnswers>) => {
          const name = answers.name?.toLowerCase().trim();
          if (!name) return "";
          const nameParts = name.split(/\s+/);
          if (nameParts.length >= 2) {
            return `${nameParts[0]}.${nameParts[nameParts.length - 1]}@loveholidays.com`;
          }
          return `${name}@loveholidays.com`;
        },
        validate: (input: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) || "Please enter a valid email address";
        },
      },
      {
        type: "list",
        name: "team",
        message: "Which team are you joining?",
        choices: teamChoices,
      },
      {
        type: "input",
        name: "workspacePath",
        message: "Where would you like to create your workspace?",
        default: `${process.env["HOME"]}/Documents/loveholidays`,
        validate: (input: string) => input.length > 0 || "Please enter a workspace path",
      },
      {
        type: "confirm",
        name: "cloneRepos",
        message: "Would you like to clone your team's repositories?",
        default: true,
      },
      {
        type: "list",
        name: "cloneType",
        message: "Which repositories would you like to clone?",
        choices: [
          { name: "Required repositories only (recommended)", value: "required" },
          { name: "All team repositories", value: "all" },
        ],
        when: (answers) => answers.cloneRepos,
      },
      {
        type: "confirm",
        name: "setupDependencies",
        message: "Would you like to automatically install dependencies?",
        default: true,
        when: (answers) => answers.cloneRepos,
      },
    ]);

    // Create config
    const config = await configManager.createDefaultConfig({
      name: answers.name,
      email: answers.email,
      team: answers.team,
    });

    // Update workspace path
    await configManager.updateConfig({
      workspace: {
        path: answers.workspacePath,
        repositories: [],
      },
      preferences: {
        ...config.preferences,
        autoClone: answers.cloneRepos,
        setupDependencies: answers.setupDependencies || false,
      },
    });

    console.log(chalk.green("\n✅ Configuration saved successfully!"));
    console.log(chalk.gray(`Config location: ${configManager.getConfigPath()}`));

    // Get team information
    const team = await dataManager.getTeamById(answers.team);
    if (!team) {
      console.error(chalk.red("❌ Team not found"));
      return;
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
    console.log(chalk.gray(`Tools: ${team.tools.join(", ")}`));
    console.log(chalk.gray(`Default branch: ${team.config.defaultBranch}`));
    console.log(chalk.gray(`CI/CD: ${team.config.cicdPipeline}`));
    console.log(chalk.gray(`Monitoring: ${team.config.monitoringTools.join(", ")}`));
    if (team.config.communicationPreferences.standupTime) {
      console.log(
        chalk.gray(
          `Daily standup: ${team.config.communicationPreferences.standupTime} (${team.config.communicationPreferences.timezone})`
        )
      );
    }

    // Clone repositories if requested
    if (answers.cloneRepos) {
      const repoManager = new RepositoryManager(answers.workspacePath);
      const onlyRequired = answers.cloneType === "required";

      const clonedRepos = await repoManager.cloneRepositories(team.repositories, onlyRequired);

      // Update config with cloned repositories
      await configManager.updateConfig({
        workspace: {
          path: answers.workspacePath,
          repositories: clonedRepos,
        },
      });

      // Setup dependencies if requested
      if (answers.setupDependencies && clonedRepos.length > 0) {
        await repoManager.setupRepositories(clonedRepos);
      }

      console.log(chalk.green(`\n✅ Successfully set up ${clonedRepos.length} repositories!`));
    }

    // Show onboarding resources
    console.log(chalk.cyan("\n📚 Essential Onboarding Resources:"));
    const onboardingDocs = await dataManager.getAllOnboardingDocs(team.id);
    onboardingDocs.forEach((doc: string, index: number) => {
      if (index === 0) {
        // Highlight the main onboarding guide
        console.log(chalk.green(`  🎯 ${doc}`));
      } else {
        console.log(chalk.gray(`  • ${doc}`));
      }
    });

    console.log(chalk.cyan("\n🎯 Next Steps:"));
    console.log(chalk.green("  1. 📖 Start with the MMB Team Onboarding Guide (link above)"));
    console.log(chalk.gray("  2. Join your team's Slack channels"));
    console.log(chalk.gray("  3. Set up your development environment"));
    if (answers.cloneRepos) {
      console.log(chalk.gray(`  4. Navigate to your workspace: cd ${answers.workspacePath}`));
      console.log(chalk.gray("  5. Explore the codebase and run the applications"));
    } else {
      console.log(chalk.gray('  4. Run "launchpad create project" to start a new project'));
    }
    console.log(chalk.gray("  6. Attend your first team standup"));

    console.log(chalk.green(`\nWelcome to LoveHolidays, ${answers.name}! 🎉`));
    console.log(
      chalk.cyan("💡 Tip: Use 'launchpad team --help' to explore team-specific commands")
    );
  }
}
