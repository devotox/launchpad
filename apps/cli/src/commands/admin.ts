import { ConfigManager, DataManager } from "@/utils/config";
import type { ConfigBundle } from "@/utils/config/types";
import type { Team } from "@/utils/config";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

export class AdminCommand {
  getCommand(): Command {
    const adminCmd = new Command("admin")
      .description("Administrative commands for managing teams and configuration");

    // Teams management
    adminCmd
      .command("teams")
      .description("Manage teams")
      .action(async () => {
        await this.manageTeams();
      });

    adminCmd
      .command("teams:add")
      .description("Add a new team")
      .action(async () => {
        await this.addTeam();
      });

    adminCmd
      .command("teams:list")
      .description("List all teams")
      .action(async () => {
        await this.listTeams();
      });

    adminCmd
      .command("teams:edit <teamId>")
      .description("Edit a team")
      .action(async (teamId) => {
        await this.editTeam(teamId);
      });

    adminCmd
      .command("teams:remove <teamId>")
      .description("Remove a team")
      .action(async (teamId) => {
        await this.removeTeam(teamId);
      });

    // Setup components management
    adminCmd
      .command("components")
      .description("Manage setup components")
      .action(async () => {
        await this.manageComponents();
      });

    adminCmd
      .command("components:add")
      .description("Add a new setup component")
      .action(async () => {
        await this.addComponent();
      });

    adminCmd
      .command("components:list")
      .description("List all setup components")
      .action(async () => {
        await this.listComponents();
      });

    // Global docs management
    adminCmd
      .command("docs")
      .description("Manage global onboarding documentation")
      .action(async () => {
        await this.manageDocs();
      });

    adminCmd
      .command("docs:add")
      .description("Add a new global documentation link")
      .action(async () => {
        await this.addDoc();
      });

    adminCmd
      .command("docs:list")
      .description("List all global documentation")
      .action(async () => {
        await this.listDocs();
      });

    // Config info
    adminCmd
      .command("info")
      .description("Show configuration file locations")
      .action(async () => {
        await this.showInfo();
      });

    // Config sync commands
    const configCmd = new Command("config").description("Manage configuration sync");

    configCmd
      .command("download")
      .description("Download configuration from remote source")
      .option("--provider <provider>", "Provider (gist, github, local)", "gist")
      .option("--repository <repo>", "GitHub repository (org/repo)")
      .option("--branch <branch>", "Git branch", "main")
      .option("--token <token>", "GitHub personal access token")
      .option("--path <path>", "File path in repository", "launchpad-config.json")
      .option("--gist-id <gistId>", "GitHub Gist ID")
      .option("--file-name <fileName>", "File name in gist", "launchpad-config.json")
      .option("--local-path <path>", "Local file path for local provider")
      .action(async (options) => {
        await this.downloadConfig(options);
      });

    configCmd
      .command("upload")
      .description("Upload current configuration to remote source")
      .option("--provider <provider>", "Provider (gist, github, local)", "gist")
      .option("--repository <repo>", "GitHub repository (org/repo)")
      .option("--branch <branch>", "Git branch", "main")
      .option("--token <token>", "GitHub personal access token")
      .option("--path <path>", "File path in repository", "launchpad-config.json")
      .option("--message <message>", "Commit message")
      .option("--gist-id <gistId>", "GitHub Gist ID (for updates)")
      .option("--file-name <fileName>", "File name in gist", "launchpad-config.json")
      .option("--description <description>", "Gist description")
      .option("--local-path <path>", "Local file path for local provider")
      .action(async (options) => {
        await this.uploadConfig(options);
      });

    configCmd
      .command("backup")
      .description("Create a local backup of configuration")
      .option("--type <type>", "Config type to backup (teams, setup-components, global-docs, or all)", "all")
      .option("--output <path>", "Output file path")
      .action(async (options) => {
        await this.backupConfig(options);
      });

    configCmd
      .command("backup:selective")
      .description("Interactive selective backup of configuration files")
      .action(async () => {
        await this.selectiveBackup();
      });

    configCmd
      .command("restore")
      .description("Restore configuration from a backup file")
      .option("--type <type>", "Config type to restore (teams, setup-components, global-docs, or auto-detect)")
      .option("--input <path>", "Input file path")
      .option("--no-backup", "Skip creating backup before restore")
      .action(async (options) => {
        await this.restoreConfig(options);
      });

    configCmd
      .command("restore:selective")
      .description("Interactive selective restore of configuration files")
      .action(async () => {
        await this.selectiveRestore();
      });

    configCmd
      .command("backups:list")
      .description("List available backup files")
      .option("--dir <directory>", "Backup directory to search")
      .action(async (options) => {
        await this.listBackups(options);
      });

    configCmd
      .command("backups:cleanup")
      .description("Clean up old backup files")
      .option("--days <days>", "Retention period in days", "30")
      .option("--dry-run", "Show what would be deleted without actually deleting")
      .action(async (options) => {
        await this.cleanupBackups(options);
      });

    configCmd
      .command("setup")
      .description("Setup sync configuration")
      .action(async () => {
        await this.setupSyncConfig();
      });

    configCmd
      .command("providers")
      .description("Manage sync providers")
      .action(async () => {
        await this.manageSyncProviders();
      });

    configCmd
      .command("providers:add")
      .description("Add a new sync provider")
      .action(async () => {
        await this.addSyncProvider();
      });

    configCmd
      .command("providers:list")
      .description("List configured sync providers")
      .action(async () => {
        await this.listSyncProviders();
      });

    configCmd
      .command("providers:set-default <provider>")
      .description("Set default sync provider")
      .action(async (provider) => {
        await this.setDefaultSyncProvider(provider);
      });

    adminCmd.addCommand(configCmd);

    return adminCmd;
  }

  async manageTeams(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    console.log(chalk.cyan("\n👥 Teams Management"));
    console.log(chalk.gray("─".repeat(30)));

    if (teams.length === 0) {
      console.log(chalk.yellow("No teams found."));
    } else {
      teams.forEach((team, index) => {
        console.log(chalk.white(`${index + 1}. ${team.name} (${team.id}) - ${team.description}`));
      });
    }

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "Add new team", value: "add" },
          { name: "Edit existing team", value: "edit" },
          { name: "Remove team", value: "remove" },
          { name: "Back to main menu", value: "back" },
        ],
      },
    ]);

    switch (action) {
      case "add":
        await this.addTeam();
        break;
      case "edit":
        await this.selectAndEditTeam();
        break;
      case "remove":
        await this.selectAndRemoveTeam();
        break;
    }
  }

  async addTeam(): Promise<void> {
    console.log(chalk.cyan("\n➕ Add New Team"));
    console.log(chalk.gray("─".repeat(20)));

    const teamData = await inquirer.prompt([
      {
        type: "input",
        name: "id",
        message: "Team ID (lowercase, no spaces):",
        validate: (input: string) => {
          if (!input.trim()) return "Team ID is required";
          if (!/^[a-z0-9-_]+$/.test(input)) return "Team ID must be lowercase letters, numbers, hyphens, or underscores only";
          return true;
        },
      },
      {
        type: "input",
        name: "name",
        message: "Team name:",
        validate: (input: string) => input.trim().length > 0 || "Team name is required",
      },
      {
        type: "input",
        name: "description",
        message: "Team description:",
        validate: (input: string) => input.trim().length > 0 || "Description is required",
      },
      {
        type: "input",
        name: "lead",
        message: "Team lead:",
        default: "TBD",
      },
      {
        type: "input",
        name: "mainSlackChannel",
        message: "Main Slack channel (e.g., #team-name):",
        validate: (input: string) => {
          if (!input.trim()) return "Main Slack channel is required";
          if (!input.startsWith("#")) return "Slack channel must start with #";
          return true;
        },
      },
      {
        type: "input",
        name: "workspacePrefix",
        message: "Workspace directory prefix (optional):",
        default: "",
      },
    ]);

    const newTeam: Team = {
      id: teamData.id,
      name: teamData.name,
      description: teamData.description,
      lead: teamData.lead,
      slackChannels: {
        main: teamData.mainSlackChannel,
      },
      repositories: [],
      tools: [],
      config: {
        defaultBranch: "main",
        codeReviewRequired: true,
        deploymentEnvironments: ["staging", "production"],
        testingStrategy: ["unit", "integration"],
        cicdPipeline: "GitHub Actions",
        monitoringTools: [],
        workspacePrefix: teamData.workspacePrefix || undefined,
        communicationPreferences: {
          timezone: "Europe/London",
          meetingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        },
      },
    };

    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    // Check if team ID already exists
    if (teams.find(team => team.id === newTeam.id)) {
      console.log(chalk.red(`❌ Team with ID '${newTeam.id}' already exists.`));
      return;
    }

    teams.push(newTeam);
    await dataManager.updateTeams(teams);

    console.log(chalk.green(`✅ Team '${newTeam.name}' added successfully!`));
  }

  async listTeams(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    console.log(chalk.cyan("\n👥 All Teams"));
    console.log(chalk.gray("─".repeat(20)));

    if (teams.length === 0) {
      console.log(chalk.yellow("No teams found."));
      return;
    }

    for (const team of teams) {
      console.log(chalk.white(`\n📋 ${team.name} (${team.id})`));
      console.log(chalk.gray(`   Description: ${team.description}`));
      console.log(chalk.gray(`   Lead: ${team.lead}`));
      console.log(chalk.gray(`   Repositories: ${team.repositories.length}`));
      console.log(chalk.gray(`   Tools: ${team.tools.slice(0, 3).join(", ")}${team.tools.length > 3 ? "..." : ""}`));
      if (team.slackChannels.main) {
        console.log(chalk.gray(`   Main Slack: ${team.slackChannels.main}`));
      }
    }
  }

  async selectAndEditTeam(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    if (teams.length === 0) {
      console.log(chalk.yellow("No teams available to edit."));
      return;
    }

    const { teamId } = await inquirer.prompt([
      {
        type: "list",
        name: "teamId",
        message: "Select team to edit:",
        choices: teams.map((team) => ({
          name: `${team.name} (${team.id})`,
          value: team.id,
        })),
      },
    ]);

    await this.editTeam(teamId);
  }

  async editTeam(teamId: string): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();
    const team = teams.find((t) => t.id === teamId);

    if (!team) {
      console.log(chalk.red(`❌ Team '${teamId}' not found.`));
      return;
    }

    console.log(chalk.cyan(`\n✏️  Edit Team: ${team.name}`));
    console.log(chalk.gray("─".repeat(30)));

    const updates = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Team name:",
        default: team.name,
      },
      {
        type: "input",
        name: "description",
        message: "Description:",
        default: team.description,
      },
      {
        type: "input",
        name: "lead",
        message: "Team lead:",
        default: team.lead,
      },
      {
        type: "input",
        name: "workspacePrefix",
        message: "Workspace prefix:",
        default: team.config.workspacePrefix || "",
      },
    ]);

    // Update team
    team.name = updates.name;
    team.description = updates.description;
    team.lead = updates.lead;
    team.config.workspacePrefix = updates.workspacePrefix || undefined;

    await dataManager.updateTeams(teams);
    console.log(chalk.green(`✅ Team '${team.name}' updated successfully!`));
  }

  async selectAndRemoveTeam(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();

    if (teams.length === 0) {
      console.log(chalk.yellow("No teams available to remove."));
      return;
    }

    const { teamId } = await inquirer.prompt([
      {
        type: "list",
        name: "teamId",
        message: "Select team to remove:",
        choices: teams.map((team) => ({
          name: `${team.name} (${team.id})`,
          value: team.id,
        })),
      },
    ]);

    await this.removeTeam(teamId);
  }

  async removeTeam(teamId: string): Promise<void> {
    const dataManager = DataManager.getInstance();
    const teams = await dataManager.getTeams();
    const teamIndex = teams.findIndex((t) => t.id === teamId);

    if (teamIndex === -1) {
      console.log(chalk.red(`❌ Team '${teamId}' not found.`));
      return;
    }

    const team = teams[teamIndex]!;

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Are you sure you want to remove team '${team.name}'?`,
        default: false,
      },
    ]);

    if (confirm) {
      teams.splice(teamIndex, 1);
      await dataManager.updateTeams(teams);
      console.log(chalk.green(`✅ Team '${team.name}' removed successfully!`));
    } else {
      console.log(chalk.gray("Operation cancelled."));
    }
  }

  async manageComponents(): Promise<void> {
    console.log(chalk.cyan("\n🔧 Setup Components Management"));
    console.log(chalk.gray("─".repeat(40)));
    console.log(chalk.yellow("Setup components management coming soon..."));
  }

  async addComponent(): Promise<void> {
    console.log(chalk.cyan("\n➕ Add Setup Component"));
    console.log(chalk.gray("─".repeat(30)));
    console.log(chalk.yellow("Add component functionality coming soon..."));
  }

  async listComponents(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const components = await dataManager.getSetupComponents();

    console.log(chalk.cyan("\n🔧 All Setup Components"));
    console.log(chalk.gray("─".repeat(30)));

    if (components.length === 0) {
      console.log(chalk.yellow("No setup components found."));
      return;
    }

    const grouped = await dataManager.groupSetupComponentsByCategory();

    for (const [category, comps] of Object.entries(grouped)) {
      console.log(chalk.white(`\n📦 ${category.toUpperCase()}`));
      for (const comp of comps) {
        console.log(chalk.gray(`   • ${comp.name} - ${comp.description}`));
        console.log(chalk.gray(`     Platforms: ${comp.platforms.join(", ")}`));
      }
    }
  }

  async manageDocs(): Promise<void> {
    console.log(chalk.cyan("\n📚 Global Documentation Management"));
    console.log(chalk.gray("─".repeat(40)));
    console.log(chalk.yellow("Documentation management coming soon..."));
  }

  async addDoc(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const docs = await dataManager.getGlobalOnboardingDocs();

    console.log(chalk.cyan("\n➕ Add Global Documentation"));
    console.log(chalk.gray("─".repeat(35)));

    const { docUrl } = await inquirer.prompt([
      {
        type: "input",
        name: "docUrl",
        message: "Documentation title and URL (e.g., 'Setup Guide: https://example.com'):",
        validate: (input: string) => input.trim().length > 0 || "Documentation entry is required",
      },
    ]);

    docs.push(docUrl);
    await dataManager.updateGlobalOnboardingDocs(docs);

    console.log(chalk.green("✅ Documentation added successfully!"));
  }

  async listDocs(): Promise<void> {
    const dataManager = DataManager.getInstance();
    const docs = await dataManager.getGlobalOnboardingDocs();

    console.log(chalk.cyan("\n📚 Global Onboarding Documentation"));
    console.log(chalk.gray("─".repeat(40)));

    if (docs.length === 0) {
      console.log(chalk.yellow("No global documentation found."));
      return;
    }

    docs.forEach((doc, index) => {
      console.log(chalk.white(`${index + 1}. ${doc}`));
    });
  }

  async showInfo(): Promise<void> {
    const dataManager = DataManager.getInstance();

    console.log(chalk.cyan("\n📁 Configuration File Locations"));
    console.log(chalk.gray("─".repeat(40)));
    console.log(chalk.white(`Teams: ${dataManager.getTeamsFilePath()}`));
    console.log(chalk.white(`Setup Components: ${dataManager.getSetupComponentsFilePath()}`));
    console.log(chalk.white(`Global Docs: ${dataManager.getGlobalDocsFilePath()}`));
  }

  async downloadConfig(options: {
    provider: string;
    repository?: string;
    branch?: string;
    token?: string;
    path?: string;
    gistId?: string;
    fileName?: string;
    localPath?: string;
  }): Promise<void> {
    const dataManager = DataManager.getInstance();
    const configManager = ConfigManager.getInstance();

    try {
      console.log(chalk.cyan("📥 Downloading configuration..."));

      let bundle: ConfigBundle;
      let providerToUse = options.provider;
      let configToUse = { ...options };

      // If no specific options provided, try to use stored sync config
      if ((providerToUse === "github" && !options.repository) || (providerToUse === "gist" && !options.gistId) || providerToUse === "gist") {
        const syncConfig = await configManager.getSyncConfig();
        if (syncConfig) {
          providerToUse = syncConfig.defaultProvider;
          const providerConfig = syncConfig.providers[providerToUse as keyof typeof syncConfig.providers];

          if (providerToUse === "github" && providerConfig) {
            const githubConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              repository: githubConfig.repository,
              branch: githubConfig.branch,
              token: githubConfig.token,
              path: githubConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "gist" && providerConfig) {
            const gistConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              gistId: gistConfig.gistId,
              fileName: gistConfig.fileName,
              token: gistConfig.token,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "local" && providerConfig) {
            const localConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              localPath: localConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          }
        }
      }

      if (providerToUse === "github") {
        if (!configToUse.repository) {
          console.log(chalk.red("❌ GitHub repository is required for GitHub provider"));
          console.log(chalk.gray("Example: --repository loveholidays/launchpad-config"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        bundle = await dataManager.downloadConfigFromGitHub({
          repository: configToUse.repository,
          branch: configToUse.branch,
          token: configToUse.token,
          path: configToUse.path,
        });
      } else if (providerToUse === "gist") {
        if (!configToUse.gistId) {
          console.log(chalk.red("❌ No GitHub Gist configured"));
          console.log(chalk.gray("To download from a specific gist: --gist-id abc123def456"));
          console.log(chalk.gray("To configure a default gist: launchpad admin config providers:add"));
          console.log(chalk.gray("To upload and create a new gist: launchpad admin config upload"));
          return;
        }

        bundle = await dataManager.downloadConfigFromGist({
          gistId: configToUse.gistId,
          fileName: configToUse.fileName,
          token: configToUse.token,
        });
      } else if (providerToUse === "local") {
        if (!configToUse.localPath) {
          console.log(chalk.red("❌ Local path is required for local provider"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        const fs = await import("node:fs/promises");
        const content = await fs.readFile(configToUse.localPath, "utf-8");
        bundle = JSON.parse(content);
      } else {
        console.log(chalk.red(`❌ Unsupported provider: ${providerToUse}`));
        return;
      }

      console.log(chalk.yellow("⚠️  This will replace your current configuration."));
      console.log(chalk.gray(`Bundle version: ${bundle.version}`));
      console.log(chalk.gray(`Bundle timestamp: ${bundle.timestamp}`));
      console.log(chalk.gray(`Teams: ${bundle.teams.length}`));
      console.log(chalk.gray(`Setup components: ${bundle.setupComponents.length}`));
      console.log(chalk.gray(`Global docs: ${bundle.globalDocs.length}`));

      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Do you want to proceed with the import?",
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray("Import cancelled."));
        return;
      }

      await dataManager.importConfigBundle(bundle);

      // Update last sync time
      await configManager.updateSyncConfig({
        lastSync: new Date().toISOString(),
      });

      console.log(chalk.green("✅ Configuration downloaded and imported successfully!"));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to download config: ${error}`));
    }
  }

  async uploadConfig(options: {
    provider: string;
    repository?: string;
    branch?: string;
    token?: string;
    path?: string;
    message?: string;
    gistId?: string;
    fileName?: string;
    description?: string;
    localPath?: string;
  }): Promise<void> {
    const dataManager = DataManager.getInstance();
    const configManager = ConfigManager.getInstance();

    try {
      console.log(chalk.cyan("📤 Creating configuration bundle..."));

      const bundle = await dataManager.createConfigBundle();

      console.log(chalk.gray("Bundle created with:"));
      console.log(chalk.gray(`  Teams: ${bundle.teams.length}`));
      console.log(chalk.gray(`  Setup components: ${bundle.setupComponents.length}`));
      console.log(chalk.gray(`  Global docs: ${bundle.globalDocs.length}`));

      let providerToUse = options.provider;
      let configToUse = { ...options };

      // If no specific options provided, try to use stored sync config
      if ((providerToUse === "github" && !options.repository) || (providerToUse === "gist" && !options.gistId) || providerToUse === "gist") {
        const syncConfig = await configManager.getSyncConfig();
        if (syncConfig) {
          providerToUse = syncConfig.defaultProvider;
          const providerConfig = syncConfig.providers[providerToUse as keyof typeof syncConfig.providers];

          if (providerToUse === "github" && providerConfig) {
            const githubConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              repository: githubConfig.repository,
              branch: githubConfig.branch,
              token: githubConfig.token,
              path: githubConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "gist" && providerConfig) {
            const gistConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              gistId: gistConfig.gistId,
              fileName: gistConfig.fileName,
              token: gistConfig.token,
              description: gistConfig.description,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          } else if (providerToUse === "local" && providerConfig) {
            const localConfig = providerConfig as any;
            configToUse = {
              ...configToUse,
              localPath: localConfig.path,
            };
            console.log(chalk.gray(`Using stored ${providerToUse} configuration...`));
          }
        }
      }

      if (providerToUse === "github") {
        if (!configToUse.repository) {
          console.log(chalk.red("❌ GitHub repository is required for GitHub provider"));
          console.log(chalk.gray("Example: --repository loveholidays/launchpad-config"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        if (!configToUse.token) {
          console.log(chalk.red("❌ GitHub token is required for uploading"));
          console.log(chalk.gray("Create a token at: https://github.com/settings/tokens"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        await dataManager.uploadConfigToGitHub(bundle, {
          repository: configToUse.repository,
          branch: configToUse.branch,
          token: configToUse.token,
          path: configToUse.path,
          message: configToUse.message,
        });
      } else if (providerToUse === "gist") {
        if (!configToUse.token) {
          console.log(chalk.red("❌ GitHub token is required for Gist uploads"));
          console.log(chalk.gray("Create a token at: https://github.com/settings/tokens"));
          console.log(chalk.gray("Then use: --token YOUR_TOKEN"));
          console.log(chalk.gray("Or configure it permanently: launchpad admin config providers:add"));
          return;
        }

        const resultGistId = await dataManager.uploadConfigToGist(bundle, {
          gistId: configToUse.gistId,
          fileName: configToUse.fileName,
          token: configToUse.token,
          description: configToUse.description,
          saveConfig: !configToUse.gistId, // Save config when creating new gist
        });

        // If we created a new gist and don't have stored config, save it
        if (!configToUse.gistId && resultGistId) {
          const syncConfig = await configManager.getSyncConfig();
          if (!syncConfig?.providers.gist) {
            console.log(chalk.cyan("🔧 Setting up Gist as your default sync provider..."));
            await configManager.setSyncProvider("gist", {
              gistId: resultGistId,
              fileName: configToUse.fileName || 'launchpad-config.json',
              token: configToUse.token,
              description: configToUse.description || 'Launchpad configuration',
            });
            await configManager.setDefaultSyncProvider("gist");
          }
        }
      } else if (providerToUse === "local") {
        if (!configToUse.localPath) {
          console.log(chalk.red("❌ Local path is required for local provider"));
          console.log(chalk.gray("Or configure it with: launchpad admin config providers:add"));
          return;
        }

        const fs = await import("node:fs/promises");
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `launchpad-config-${timestamp}.json`;
        const fullPath = require("node:path").join(configToUse.localPath, fileName);

        await fs.writeFile(fullPath, JSON.stringify(bundle, null, 2));
        console.log(chalk.green(`✅ Configuration saved to: ${fullPath}`));
      } else {
        console.log(chalk.red(`❌ Unsupported provider: ${providerToUse}`));
        return;
      }

      // Update last sync time
      await configManager.updateSyncConfig({
        lastSync: new Date().toISOString(),
      });

      console.log(chalk.green("✅ Configuration uploaded successfully!"));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to upload config: ${error}`));
    }
  }

  async backupConfig(options: { type: string; output?: string }): Promise<void> {
    const dataManager = DataManager.getInstance();

    try {
      console.log(chalk.cyan("💾 Creating configuration backup..."));

      if (options.type === "all") {
        // Create full bundle backup (existing behavior)
        const bundle = await dataManager.createConfigBundle();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = options.output || `launchpad-backup-${timestamp}.json`;

        const fs = await import("node:fs/promises");
        await fs.writeFile(outputPath, JSON.stringify(bundle, null, 2));

        console.log(chalk.green(`✅ Backup created: ${outputPath}`));
        console.log(chalk.gray(`  Teams: ${bundle.teams.length}`));
        console.log(chalk.gray(`  Setup components: ${bundle.setupComponents.length}`));
        console.log(chalk.gray(`  Global docs: ${bundle.globalDocs.length}`));
      } else {
        // Create selective backup
        const validTypes = ['teams', 'setup-components', 'global-docs'];
        if (!options.type || !validTypes.includes(options.type)) {
          console.log(chalk.red(`❌ Invalid config type. Must be one of: ${validTypes.join(', ')}`));
          return;
        }

        const outputPath = await dataManager.backupConfigFile(
          options.type as 'teams' | 'setup-components' | 'global-docs',
          options.output
        );

        console.log(chalk.green(`✅ ${options.type} backup created: ${outputPath}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create backup: ${error}`));
    }
  }

  async restoreConfig(options: { type?: string; input?: string; noBackup?: boolean }): Promise<void> {
    const dataManager = DataManager.getInstance();

    try {
      if (!options.input) {
        console.log(chalk.red("❌ Input file path is required"));
        console.log(chalk.gray("Example: --input launchpad-backup-2024-01-01.json"));
        return;
      }

      console.log(chalk.cyan(`📁 Restoring configuration from: ${options.input}`));

      const fs = await import("node:fs/promises");
      const content = await fs.readFile(options.input, "utf-8");
      const backupData = JSON.parse(content);

      // Auto-detect backup type if not specified
      let configType = options.type;
      if (!configType) {
        if (backupData.configType) {
          configType = backupData.configType;
          console.log(chalk.gray(`Auto-detected config type: ${configType}`));
        } else if (backupData.teams && backupData.setupComponents && backupData.globalDocs) {
          configType = "all";
          console.log(chalk.gray("Auto-detected config type: full bundle"));
        } else {
          console.log(chalk.red("❌ Cannot auto-detect config type. Please specify --type"));
          return;
        }
      }

      if (configType === "all") {
        // Restore full bundle
        console.log(chalk.yellow("⚠️  This will replace your current configuration."));
        console.log(chalk.gray(`Bundle version: ${backupData.version}`));
        console.log(chalk.gray(`Bundle timestamp: ${backupData.timestamp}`));
        console.log(chalk.gray(`Teams: ${backupData.teams.length}`));
        console.log(chalk.gray(`Setup components: ${backupData.setupComponents.length}`));
        console.log(chalk.gray(`Global docs: ${backupData.globalDocs.length}`));

        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: "Do you want to proceed with the restore?",
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray("Restore cancelled."));
          return;
        }

        await dataManager.importConfigBundle(backupData);
      } else {
        // Restore selective config
        const validTypes = ['teams', 'setup-components', 'global-docs'];
        if (!configType || !validTypes.includes(configType)) {
          console.log(chalk.red(`❌ Invalid config type. Must be one of: ${validTypes.join(', ')}`));
          return;
        }

        console.log(chalk.yellow(`⚠️  This will replace your current ${configType} configuration.`));
        console.log(chalk.gray(`Backup timestamp: ${backupData.timestamp}`));
        console.log(chalk.gray(`Items: ${backupData.data.length}`));

        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `Do you want to proceed with restoring ${configType}?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray("Restore cancelled."));
          return;
        }

        await dataManager.restoreConfigFile(
          configType as 'teams' | 'setup-components' | 'global-docs',
          options.input!,
          !options.noBackup
        );
      }

      console.log(chalk.green("✅ Configuration restored successfully!"));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to restore config: ${error}`));
    }
  }

  async setupSyncConfig(): Promise<void> {
    const configManager = ConfigManager.getInstance();

    console.log(chalk.cyan("\n🔄 Setup Sync Configuration"));
    console.log(chalk.gray("─".repeat(40)));

    const existingSync = await configManager.getSyncConfig();
    if (existingSync) {
      console.log(chalk.yellow("⚠️  Sync configuration already exists."));
      console.log(chalk.gray(`Current default provider: ${existingSync.defaultProvider}`));

      const { overwrite } = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: "Do you want to reconfigure sync settings?",
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.gray("Setup cancelled."));
        return;
      }
    }

    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "defaultProvider",
        message: "Choose your default sync provider:",
        choices: [
          { name: "GitHub Gist (simple file sharing) - Recommended", value: "gist" },
          { name: "GitHub (repository sync)", value: "github" },
          { name: "Local (file system backup)", value: "local" },
          { name: "Google Drive (cloud storage)", value: "googledrive" },
        ],
      },
      {
        type: "confirm",
        name: "autoSync",
        message: "Enable automatic sync?",
        default: false,
      },
    ]);

    await configManager.updateSyncConfig({
      defaultProvider: answers.defaultProvider,
      autoSync: answers.autoSync,
    });

    console.log(chalk.green("✅ Sync configuration created successfully!"));
    console.log(chalk.gray(`Default provider: ${answers.defaultProvider}`));
    console.log(chalk.gray(`Auto sync: ${answers.autoSync ? "Enabled" : "Disabled"}`));
    console.log(chalk.cyan("\n💡 Next: Configure your provider with 'launchpad admin config providers:add'"));
  }

  async manageSyncProviders(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const syncConfig = await configManager.getSyncConfig();

    console.log(chalk.cyan("\n🔄 Manage Sync Providers"));
    console.log(chalk.gray("─".repeat(40)));

    if (!syncConfig) {
      console.log(chalk.yellow("No sync configuration found. Run 'launchpad admin config setup' first."));
      return;
    }

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "Add new provider", value: "add" },
          { name: "List providers", value: "list" },
          { name: "Set default provider", value: "default" },
          { name: "Back to main menu", value: "back" },
        ],
      },
    ]);

    switch (action) {
      case "add":
        await this.addSyncProvider();
        break;
      case "list":
        await this.listSyncProviders();
        break;
      case "default":
        await this.selectDefaultSyncProvider();
        break;
    }
  }

  async addSyncProvider(): Promise<void> {
    const configManager = ConfigManager.getInstance();

    console.log(chalk.cyan("\n➕ Add Sync Provider"));
    console.log(chalk.gray("─".repeat(30)));

    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select provider type:",
        choices: [
          { name: "GitHub Gist (Recommended)", value: "gist" },
          { name: "GitHub Repository", value: "github" },
          { name: "Google Drive", value: "googledrive" },
          { name: "Local File System", value: "local" },
        ],
      },
    ]);

    if (provider === "github") {
      const githubConfig = await inquirer.prompt([
        {
          type: "input",
          name: "repository",
          message: "GitHub repository (org/repo):",
          validate: (input: string) => {
            if (!input.includes("/")) return "Repository must be in format 'org/repo'";
            return true;
          },
        },
        {
          type: "input",
          name: "branch",
          message: "Branch name:",
          default: "main",
        },
        {
          type: "input",
          name: "path",
          message: "File path in repository:",
          default: "launchpad-config.json",
        },
        {
          type: "password",
          name: "token",
          message: "GitHub personal access token (optional):",
        },
      ]);

      await configManager.setSyncProvider("github", {
        repository: githubConfig.repository,
        branch: githubConfig.branch,
        path: githubConfig.path,
        token: githubConfig.token || undefined,
      });

      console.log(chalk.green("✅ GitHub provider configured successfully!"));
    } else if (provider === "gist") {
      const gistConfig = await inquirer.prompt([
        {
          type: "input",
          name: "gistId",
          message: "GitHub Gist ID (leave empty to create new gist when uploading):",
        },
        {
          type: "input",
          name: "fileName",
          message: "File name in gist:",
          default: "launchpad-config.json",
        },
        {
          type: "input",
          name: "description",
          message: "Gist description:",
          default: "Launchpad configuration",
        },
        {
          type: "password",
          name: "token",
          message: "GitHub personal access token:",
          validate: (input: string) => input.length > 0 || "Token is required for Gist operations",
        },
      ]);

      await configManager.setSyncProvider("gist", {
        gistId: gistConfig.gistId || "",
        fileName: gistConfig.fileName,
        description: gistConfig.description,
        token: gistConfig.token,
      });

      console.log(chalk.green("✅ GitHub Gist provider configured successfully!"));
    } else if (provider === "googledrive") {
      const driveConfig = await inquirer.prompt([
        {
          type: "input",
          name: "folderId",
          message: "Google Drive folder ID:",
          validate: (input: string) => input.length > 0 || "Folder ID is required",
        },
        {
          type: "input",
          name: "fileName",
          message: "File name:",
          default: "launchpad-config.json",
        },
      ]);

      await configManager.setSyncProvider("googledrive", {
        folderId: driveConfig.folderId,
        fileName: driveConfig.fileName,
      });

      console.log(chalk.green("✅ Google Drive provider configured successfully!"));
    } else if (provider === "local") {
      const localConfig = await inquirer.prompt([
        {
          type: "input",
          name: "path",
          message: "Local backup directory:",
          default: configManager.getConfigDir(),
        },
        {
          type: "confirm",
          name: "autoBackup",
          message: "Enable automatic backups?",
          default: true,
        },
        {
          type: "number",
          name: "backupRetention",
          message: "Backup retention (days):",
          default: 30,
        },
      ]);

      await configManager.setSyncProvider("local", {
        path: localConfig.path,
        autoBackup: localConfig.autoBackup,
        backupRetention: localConfig.backupRetention,
      });

      console.log(chalk.green("✅ Local provider configured successfully!"));
    }
  }

  async listSyncProviders(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const syncConfig = await configManager.getSyncConfig();

    console.log(chalk.cyan("\n🔄 Configured Sync Providers"));
    console.log(chalk.gray("─".repeat(40)));

    if (!syncConfig) {
      console.log(chalk.yellow("No sync configuration found."));
      return;
    }

    const providers = Object.entries(syncConfig.providers);
    if (providers.length === 0) {
      console.log(chalk.yellow("No sync providers configured."));
      return;
    }

    console.log(chalk.white(`Default provider: ${chalk.green(syncConfig.defaultProvider)}`));
    console.log(chalk.white(`Auto sync: ${syncConfig.autoSync ? chalk.green("Enabled") : chalk.gray("Disabled")}`));
    console.log("");

    for (const [name, config] of providers) {
      const isDefault = name === syncConfig.defaultProvider;
      const badge = isDefault ? chalk.green("[DEFAULT]") : chalk.gray("[CONFIGURED]");

      console.log(chalk.white(`${badge} ${name.toUpperCase()}`));

      if (name === "github" && config) {
        const githubConfig = config as any;
        console.log(chalk.gray(`  Repository: ${githubConfig.repository}`));
        console.log(chalk.gray(`  Branch: ${githubConfig.branch}`));
        console.log(chalk.gray(`  Path: ${githubConfig.path}`));
        console.log(chalk.gray(`  Token: ${githubConfig.token ? "Configured" : "Not set"}`));
      } else if (name === "gist" && config) {
        const gistConfig = config as any;
        console.log(chalk.gray(`  Gist ID: ${gistConfig.gistId || "Will create new"}`));
        console.log(chalk.gray(`  File name: ${gistConfig.fileName}`));
        console.log(chalk.gray(`  Description: ${gistConfig.description}`));
        console.log(chalk.gray(`  Token: ${gistConfig.token ? "Configured" : "Not set"}`));
      } else if (name === "googledrive" && config) {
        const driveConfig = config as any;
        console.log(chalk.gray(`  Folder ID: ${driveConfig.folderId}`));
        console.log(chalk.gray(`  File name: ${driveConfig.fileName}`));
      } else if (name === "local" && config) {
        const localConfig = config as any;
        console.log(chalk.gray(`  Path: ${localConfig.path}`));
        console.log(chalk.gray(`  Auto backup: ${localConfig.autoBackup ? "Yes" : "No"}`));
        console.log(chalk.gray(`  Retention: ${localConfig.backupRetention} days`));
      }
      console.log("");
    }
  }

  async selectDefaultSyncProvider(): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const syncConfig = await configManager.getSyncConfig();

    if (!syncConfig) {
      console.log(chalk.yellow("No sync configuration found."));
      return;
    }

    const providers = Object.keys(syncConfig.providers);
    if (providers.length === 0) {
      console.log(chalk.yellow("No sync providers configured."));
      return;
    }

    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select default sync provider:",
        choices: providers.map(p => ({
          name: `${p} ${p === syncConfig.defaultProvider ? "(current)" : ""}`,
          value: p,
        })),
      },
    ]);

    await configManager.setDefaultSyncProvider(provider as any);
    console.log(chalk.green(`✅ Default sync provider set to '${provider}'!`));
  }

  async setDefaultSyncProvider(provider: string): Promise<void> {
    const configManager = ConfigManager.getInstance();
    const syncConfig = await configManager.getSyncConfig();

    if (!syncConfig) {
      console.log(chalk.red("❌ No sync configuration found. Run 'launchpad admin config setup' first."));
      return;
    }

    if (!syncConfig.providers[provider as keyof typeof syncConfig.providers]) {
      console.log(chalk.red(`❌ Sync provider '${provider}' not configured.`));
      console.log(chalk.gray(`Available providers: ${Object.keys(syncConfig.providers).join(", ")}`));
      return;
    }

    await configManager.setDefaultSyncProvider(provider as any);
    console.log(chalk.green(`✅ Default sync provider set to '${provider}'!`));
  }

  async selectiveBackup(): Promise<void> {
    const dataManager = DataManager.getInstance();

    console.log(chalk.cyan("\n💾 Interactive Selective Backup"));
    console.log(chalk.gray("─".repeat(40)));

    const answers = await inquirer.prompt({
      type: "checkbox",
      name: "configTypes",
      message: "Select config types to backup:",
      choices: [
        { name: "Teams", value: "teams" },
        { name: "Setup Components", value: "setup-components" },
        { name: "Global Documentation", value: "global-docs" },
      ],
    });

    const configTypes = answers.configTypes as string[];
    if (configTypes.length === 0) {
      console.log(chalk.red("❌ Please select at least one config type"));
      return;
    }

    const { outputDir } = await inquirer.prompt([
      {
        type: "input",
        name: "outputDir",
        message: "Output directory (optional):",
        default: ".",
      },
    ]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPaths: string[] = [];

    try {
      for (const configType of configTypes) {
        const outputPath = outputDir === "."
          ? undefined
          : `${outputDir}/launchpad-${configType}-backup-${timestamp}.json`;

        const path = await dataManager.backupConfigFile(
          configType as 'teams' | 'setup-components' | 'global-docs',
          outputPath
        );
        backupPaths.push(path);
      }

      console.log(chalk.green("\n✅ Selective backup completed!"));
      console.log(chalk.gray("Created backups:"));
      for (const path of backupPaths) {
        console.log(chalk.gray(`  • ${path}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create selective backup: ${error}`));
    }
  }

  async selectiveRestore(): Promise<void> {
    const dataManager = DataManager.getInstance();

    console.log(chalk.cyan("\n📁 Interactive Selective Restore"));
    console.log(chalk.gray("─".repeat(40)));

    // List available backups
    const backups = await dataManager.listBackups();
    const selectiveBackups = backups.filter(backup =>
      backup.type !== 'full-bundle' && backup.type !== 'unknown'
    );

    if (selectiveBackups.length === 0) {
      console.log(chalk.yellow("No selective backup files found."));
      console.log(chalk.gray("Create backups with: launchpad admin config backup:selective"));
      return;
    }

    const { selectedBackup } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedBackup",
        message: "Select backup file to restore:",
        choices: selectiveBackups.map(backup => ({
          name: `${backup.type} - ${new Date(backup.timestamp).toLocaleString()} (${(backup.size / 1024).toFixed(1)}KB)`,
          value: backup.path,
        })),
      },
    ]);

    const { createBackup } = await inquirer.prompt([
      {
        type: "confirm",
        name: "createBackup",
        message: "Create backup of current data before restore?",
        default: true,
      },
    ]);

    try {
      // Auto-detect config type from backup file
      const fs = await import("node:fs/promises");
      const content = await fs.readFile(selectedBackup, "utf-8");
      const backupData = JSON.parse(content);
      const configType = backupData.configType;

      if (!configType) {
        console.log(chalk.red("❌ Cannot determine config type from backup file"));
        return;
      }

      await dataManager.restoreConfigFile(
        configType as 'teams' | 'setup-components' | 'global-docs',
        selectedBackup,
        createBackup
      );

      console.log(chalk.green("✅ Selective restore completed!"));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to restore from backup: ${error}`));
    }
  }

  async listBackups(options: { dir?: string }): Promise<void> {
    const dataManager = DataManager.getInstance();
    const backups = await dataManager.listBackups(options.dir);

    console.log(chalk.cyan("\n💾 Available Backup Files"));
    console.log(chalk.gray("─".repeat(40)));

    if (backups.length === 0) {
      console.log(chalk.yellow("No backup files found."));
      return;
    }

    // Group backups by type
    const grouped = backups.reduce((acc, backup) => {
      if (!acc[backup.type]) {
        acc[backup.type] = [];
      }
      acc[backup.type]!.push(backup);
      return acc;
    }, {} as Record<string, typeof backups>);

    for (const [type, typeBackups] of Object.entries(grouped)) {
      console.log(chalk.white(`\n📦 ${type.toUpperCase()}`));
      typeBackups.forEach((backup, index) => {
        const date = new Date(backup.timestamp).toLocaleString();
        const size = (backup.size / 1024).toFixed(1);
        console.log(chalk.gray(`  ${index + 1}. ${date} - ${size}KB`));
        console.log(chalk.gray(`     ${backup.path}`));
      });
    }
  }

  async cleanupBackups(options: { days: string; dryRun?: boolean }): Promise<void> {
    const dataManager = DataManager.getInstance();
    const days = Number.parseInt(options.days);
    const dryRun = options.dryRun || false;

    console.log(chalk.cyan("\n🧹 Cleanup Old Backups"));
    console.log(chalk.gray("─".repeat(40)));

    if (dryRun) {
      console.log(chalk.yellow("🔍 DRY RUN - No files will be deleted"));
    }

    try {
      const deletedCount = await dataManager.cleanupOldBackups(days);

      if (deletedCount === 0) {
        console.log(chalk.green("No old backups found to clean up."));
      } else {
        const message = dryRun
          ? `Would delete ${deletedCount} old backup files`
          : `Deleted ${deletedCount} old backup files`;
        console.log(chalk.green(`✅ ${message}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to cleanup backups: ${error}`));
    }
  }
}
