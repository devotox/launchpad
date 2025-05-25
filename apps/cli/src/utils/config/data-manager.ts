import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { Team, SetupComponent } from "@/utils/config/data";
import { getConfigDirectory } from "@/utils/config/paths";

export class DataManager {
  private static instance: DataManager;
  private configDir: string;
  private teamsFile: string;
  private setupComponentsFile: string;
  private globalDocsFile: string;

  private constructor() {
    this.configDir = getConfigDirectory();
    this.teamsFile = join(this.configDir, "teams.json");
    this.setupComponentsFile = join(this.configDir, "setup-components.json");
    this.globalDocsFile = join(this.configDir, "global-docs.json");
  }

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  async ensureDataFiles(): Promise<void> {
    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    // Create teams.json if it doesn't exist
    try {
      await fs.access(this.teamsFile);
    } catch {
      await fs.writeFile(this.teamsFile, JSON.stringify([], null, 2));
    }

    // Create setup-components.json if it doesn't exist
    try {
      await fs.access(this.setupComponentsFile);
    } catch {
      await fs.writeFile(this.setupComponentsFile, JSON.stringify([], null, 2));
    }

    // Create global-docs.json if it doesn't exist
    try {
      await fs.access(this.globalDocsFile);
    } catch {
      await fs.writeFile(this.globalDocsFile, JSON.stringify([], null, 2));
    }
  }

  async getTeams(): Promise<Team[]> {
    await this.ensureDataFiles();
    try {
      const content = await fs.readFile(this.teamsFile, "utf-8");
      const parsed = JSON.parse(content);

      // Type validation
      if (!Array.isArray(parsed)) {
        console.warn("teams.json is not an array, returning empty array");
        return [];
      }

      return parsed as Team[];
    } catch (error) {
      console.warn("Failed to read teams.json:", error);
      return [];
    }
  }

  async getSetupComponents(): Promise<SetupComponent[]> {
    await this.ensureDataFiles();
    try {
      const content = await fs.readFile(this.setupComponentsFile, "utf-8");
      const parsed = JSON.parse(content);

      // Type validation
      if (!Array.isArray(parsed)) {
        console.warn("setup-components.json is not an array, returning empty array");
        return [];
      }

      return parsed as SetupComponent[];
    } catch (error) {
      console.warn("Failed to read setup-components.json:", error);
      return [];
    }
  }

  async getGlobalOnboardingDocs(): Promise<string[]> {
    await this.ensureDataFiles();
    try {
      const content = await fs.readFile(this.globalDocsFile, "utf-8");
      const parsed = JSON.parse(content);

      // Type validation
      if (!Array.isArray(parsed)) {
        console.warn("global-docs.json is not an array, returning empty array");
        return [];
      }

      return parsed as string[];
    } catch (error) {
      console.warn("Failed to read global-docs.json:", error);
      return [];
    }
  }

  async updateTeams(teams: Team[]): Promise<void> {
    await this.ensureDataFiles();
    await fs.writeFile(this.teamsFile, JSON.stringify(teams, null, 2));
  }

  async updateSetupComponents(components: SetupComponent[]): Promise<void> {
    await this.ensureDataFiles();
    await fs.writeFile(this.setupComponentsFile, JSON.stringify(components, null, 2));
  }

  async updateGlobalOnboardingDocs(docs: string[]): Promise<void> {
    await this.ensureDataFiles();
    await fs.writeFile(this.globalDocsFile, JSON.stringify(docs, null, 2));
  }

  // Helper methods for teams
  async getTeamById(id: string): Promise<Team | undefined> {
    const teams = await this.getTeams();
    return teams.find((team) => team.id === id);
  }

  async getTeamChoices(): Promise<Array<{ name: string; value: string }>> {
    const teams = await this.getTeams();
    return teams.map((team) => ({
      name: `${team.name} - ${team.description}`,
      value: team.id,
    }));
  }

  async getTeamSlackChannels(teamId: string) {
    const team = await this.getTeamById(teamId);
    return team?.slackChannels;
  }

  async getTeamConfig(teamId: string) {
    const team = await this.getTeamById(teamId);
    return team?.config;
  }

  async getAllOnboardingDocs(teamId: string): Promise<string[]> {
    const team = await this.getTeamById(teamId);
    const globalDocs = await this.getGlobalOnboardingDocs();

    if (!team) return globalDocs;

    // Combine team-specific docs (if any) with global docs
    const teamDocs = team.teamSpecificDocs || [];
    return [...teamDocs, ...globalDocs];
  }

  async getTeamSpecificDocs(teamId: string): Promise<string[]> {
    const team = await this.getTeamById(teamId);
    return team?.teamSpecificDocs || [];
  }

  // Validation methods
  async validateTeamExists(teamId: string): Promise<boolean> {
    const team = await this.getTeamById(teamId);
    return team !== undefined;
  }

  async getValidTeamIds(): Promise<string[]> {
    const teams = await this.getTeams();
    return teams.map(team => team.id);
  }

  // Helper methods for setup components
  async getSetupComponentById(id: string): Promise<SetupComponent | undefined> {
    const components = await this.getSetupComponents();
    return components.find((component) => component.id === id);
  }

  async getSetupComponentsByPlatform(platform: "macos" | "windows" | "linux"): Promise<SetupComponent[]> {
    const components = await this.getSetupComponents();
    return components.filter((component) => component.platforms.includes(platform));
  }

  async getSetupComponentsByCategory(category: SetupComponent["category"]): Promise<SetupComponent[]> {
    const components = await this.getSetupComponents();
    return components.filter((component) => component.category === category);
  }

  async groupSetupComponentsByCategory(components?: SetupComponent[]): Promise<Record<string, SetupComponent[]>> {
    const allComponents = components || await this.getSetupComponents();
    return allComponents.reduce(
      (acc, component) => {
        if (!acc[component.category]) {
          acc[component.category] = [];
        }
        acc[component.category]!.push(component);
        return acc;
      },
      {} as Record<string, SetupComponent[]>
    );
  }

  // File paths for external access (e.g., admin tools)
  getTeamsFilePath(): string {
    return this.teamsFile;
  }

  getSetupComponentsFilePath(): string {
    return this.setupComponentsFile;
  }

  getGlobalDocsFilePath(): string {
    return this.globalDocsFile;
  }
}
