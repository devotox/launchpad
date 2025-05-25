import { DataManager } from "@/utils/config";
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
}
