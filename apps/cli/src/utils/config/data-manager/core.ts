import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { getConfigDirectory } from '@/utils/config/paths';
import type { Team, SetupComponent } from '@/utils/config/data';

export class CoreDataManager {
  private static instance: CoreDataManager;
  private configDir: string;
  private teamsFile: string;
  private setupComponentsFile: string;
  private globalDocsFile: string;

  private constructor() {
    this.configDir = getConfigDirectory();
    this.teamsFile = join(this.configDir, 'teams.json');
    this.setupComponentsFile = join(this.configDir, 'setup-components.json');
    this.globalDocsFile = join(this.configDir, 'global-docs.json');
  }

  static getInstance(): CoreDataManager {
    if (!CoreDataManager.instance) {
      CoreDataManager.instance = new CoreDataManager();
    }
    return CoreDataManager.instance;
  }

  async ensureDataFiles(): Promise<void> {
    // Ensure config directory exists
    await fs.mkdir(this.configDir, { recursive: true });

    // Create teams.json if it doesn't exist
    await this.ensureFileExists(this.teamsFile, []);

    // Create setup-components.json if it doesn't exist
    await this.ensureFileExists(this.setupComponentsFile, []);

    // Create global-docs.json if it doesn't exist
    await this.ensureFileExists(this.globalDocsFile, []);
  }

  private async ensureFileExists(filePath: string, defaultContent: unknown[]): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
    }
  }

  // Teams operations
  async getTeams(): Promise<Team[]> {
    await this.ensureDataFiles();
    return this.readJsonFile<Team[]>(this.teamsFile, 'teams.json');
  }

  async updateTeams(teams: Team[]): Promise<void> {
    await this.ensureDataFiles();
    await fs.writeFile(this.teamsFile, JSON.stringify(teams, null, 2));
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const teams = await this.getTeams();
    return teams.find((team) => team.id === id);
  }

  async getTeamChoices(): Promise<{ name: string; value: string }[]> {
    const teams = await this.getTeams();
    return teams.map((team) => ({
      name: `${team.name} - ${team.description}`,
      value: team.id
    }));
  }

  async validateTeamExists(teamId: string): Promise<boolean> {
    const team = await this.getTeamById(teamId);
    return team !== undefined;
  }

  async getValidTeamIds(): Promise<string[]> {
    const teams = await this.getTeams();
    return teams.map(team => team.id);
  }

  // Setup components operations
  async getSetupComponents(): Promise<SetupComponent[]> {
    await this.ensureDataFiles();
    return this.readJsonFile<SetupComponent[]>(this.setupComponentsFile, 'setup-components.json');
  }

  async updateSetupComponents(components: SetupComponent[]): Promise<void> {
    await this.ensureDataFiles();
    await fs.writeFile(this.setupComponentsFile, JSON.stringify(components, null, 2));
  }

  async getSetupComponentById(id: string): Promise<SetupComponent | undefined> {
    const components = await this.getSetupComponents();
    return components.find((component) => component.id === id);
  }

  async getSetupComponentsByPlatform(platform: 'macos' | 'windows' | 'linux'): Promise<SetupComponent[]> {
    const components = await this.getSetupComponents();
    return components.filter((component) => component.platforms.includes(platform));
  }

  async groupSetupComponentsByCategory(components?: SetupComponent[]): Promise<Record<string, SetupComponent[]>> {
    const allComponents = components || await this.getSetupComponents();
    const grouped: Record<string, SetupComponent[]> = {};

    for (const component of allComponents) {
      if (!grouped[component.category]) {
        grouped[component.category] = [];
      }
      grouped[component.category]!.push(component);
    }

    return grouped;
  }

  // Global docs operations
  async getGlobalOnboardingDocs(): Promise<string[]> {
    await this.ensureDataFiles();
    return this.readJsonFile<string[]>(this.globalDocsFile, 'global-docs.json');
  }

  async updateGlobalOnboardingDocs(docs: string[]): Promise<void> {
    await this.ensureDataFiles();
    await fs.writeFile(this.globalDocsFile, JSON.stringify(docs, null, 2));
  }

  // Team-specific helper methods
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

  // File path getters
  getTeamsFilePath(): string {
    return this.teamsFile;
  }

  getSetupComponentsFilePath(): string {
    return this.setupComponentsFile;
  }

  getGlobalDocsFilePath(): string {
    return this.globalDocsFile;
  }

  // Utility methods
  private async readJsonFile<T>(filePath: string, fileName: string): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      // Type validation
      if (!Array.isArray(parsed)) {
        console.warn(`${fileName} is not an array, returning empty array`);
        return [] as T;
      }

      return parsed as T;
    } catch (error) {
      console.warn(`Failed to read ${fileName}:`, error);
      return [] as T;
    }
  }
}
