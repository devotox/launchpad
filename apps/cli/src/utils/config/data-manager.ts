import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { Team, SetupComponent } from "@/utils/config/data";
import type { ConfigBundle } from "@/utils/config/types";
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

  // Config sync methods
  async createConfigBundle(): Promise<ConfigBundle> {
    const teams = await this.getTeams();
    const setupComponents = await this.getSetupComponents();
    const globalDocs = await this.getGlobalOnboardingDocs();

    return {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      teams,
      setupComponents,
      globalDocs,
      metadata: {
        source: "launchpad-cli",
        description: "Launchpad configuration bundle"
      }
    };
  }

  async importConfigBundle(bundle: ConfigBundle): Promise<void> {
    // Validate bundle structure
    if (!bundle.teams || !bundle.setupComponents || !bundle.globalDocs) {
      throw new Error("Invalid config bundle: missing required data");
    }

    // Backup existing data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(this.configDir, 'backups', timestamp);
    await fs.mkdir(backupDir, { recursive: true });

    try {
      // Backup existing files
      await fs.copyFile(this.teamsFile, join(backupDir, 'teams.json'));
      await fs.copyFile(this.setupComponentsFile, join(backupDir, 'setup-components.json'));
      await fs.copyFile(this.globalDocsFile, join(backupDir, 'global-docs.json'));
    } catch {
      // Files might not exist, that's okay
    }

    // Import new data
    await fs.writeFile(this.teamsFile, JSON.stringify(bundle.teams, null, 2));
    await fs.writeFile(this.setupComponentsFile, JSON.stringify(bundle.setupComponents, null, 2));
    await fs.writeFile(this.globalDocsFile, JSON.stringify(bundle.globalDocs, null, 2));

    console.log("✅ Config bundle imported successfully");
    console.log(`📁 Backup created at: ${backupDir}`);
  }

  async downloadConfigFromGitHub(options: {
    repository: string;
    branch?: string;
    token?: string;
    path?: string;
  }): Promise<ConfigBundle> {
    const { repository, branch = 'main', token, path = 'launchpad-config.json' } = options;

    const url = `https://api.github.com/repos/${repository}/contents/${path}?ref=${branch}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'launchpad-cli'
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { type: string; content: string };

      if (data.type !== 'file') {
        throw new Error('Config path is not a file');
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const bundle = JSON.parse(content) as ConfigBundle;

      return bundle;
    } catch (error) {
      throw new Error(`Failed to download config from GitHub: ${error}`);
    }
  }

  async uploadConfigToGitHub(bundle: ConfigBundle, options: {
    repository: string;
    branch?: string;
    token: string;
    path?: string;
    message?: string;
  }): Promise<void> {
    const {
      repository,
      branch = 'main',
      token,
      path = 'launchpad-config.json',
      message = `Update Launchpad config - ${new Date().toISOString()}`
    } = options;

    const url = `https://api.github.com/repos/${repository}/contents/${path}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`,
      'User-Agent': 'launchpad-cli'
    };

    try {
      // Get current file SHA if it exists
      let sha: string | undefined;
      try {
        const getResponse = await fetch(`${url}?ref=${branch}`, { headers });
        if (getResponse.ok) {
          const fileData = await getResponse.json() as { sha: string };
          sha = fileData.sha;
        }
      } catch {
        // File doesn't exist, that's okay
      }

      const content = Buffer.from(JSON.stringify(bundle, null, 2)).toString('base64');

      const body = {
        message,
        content,
        branch,
        ...(sha && { sha })
      };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(`GitHub API error: ${response.status} ${errorData.message || response.statusText}`);
      }

      console.log(`✅ Config uploaded to GitHub: ${repository}/${path}`);
    } catch (error) {
      throw new Error(`Failed to upload config to GitHub: ${error}`);
    }
  }

  // Selective backup and restore methods
  async backupConfigFile(configType: 'teams' | 'setup-components' | 'global-docs', outputPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = outputPath || `launchpad-${configType}-backup-${timestamp}.json`;

    let data: Team[] | SetupComponent[] | string[];
    let sourceFile: string;

    switch (configType) {
      case 'teams':
        data = await this.getTeams();
        sourceFile = this.teamsFile;
        break;
      case 'setup-components':
        data = await this.getSetupComponents();
        sourceFile = this.setupComponentsFile;
        break;
      case 'global-docs':
        data = await this.getGlobalOnboardingDocs();
        sourceFile = this.globalDocsFile;
        break;
      default:
        throw new Error(`Unknown config type: ${configType}`);
    }

    const backupData = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      configType,
      data,
      metadata: {
        source: "launchpad-cli",
        sourceFile,
        description: `Backup of ${configType} configuration`
      }
    };

    await fs.writeFile(defaultPath, JSON.stringify(backupData, null, 2));
    return defaultPath;
  }

  async restoreConfigFile(configType: 'teams' | 'setup-components' | 'global-docs', inputPath: string, createBackup = true): Promise<void> {
    // Create backup of current data if requested
    if (createBackup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = join(this.configDir, 'backups', timestamp);
      await fs.mkdir(backupDir, { recursive: true });

      try {
        let sourceFile: string;
        switch (configType) {
          case 'teams':
            sourceFile = this.teamsFile;
            break;
          case 'setup-components':
            sourceFile = this.setupComponentsFile;
            break;
          case 'global-docs':
            sourceFile = this.globalDocsFile;
            break;
          default:
            throw new Error(`Unknown config type: ${configType}`);
        }

        await fs.copyFile(sourceFile, join(backupDir, `${configType}.json`));
        console.log(`📁 Backup created at: ${backupDir}/${configType}.json`);
      } catch {
        // File might not exist, that's okay
      }
    }

    // Read and validate restore data
    const content = await fs.readFile(inputPath, 'utf-8');
    const backupData = JSON.parse(content);

    if (backupData.configType !== configType) {
      throw new Error(`Backup file is for '${backupData.configType}' but trying to restore '${configType}'`);
    }

    if (!Array.isArray(backupData.data)) {
      throw new Error('Invalid backup data: expected array');
    }

    // Restore the data
    switch (configType) {
      case 'teams':
        await this.updateTeams(backupData.data);
        break;
      case 'setup-components':
        await this.updateSetupComponents(backupData.data);
        break;
      case 'global-docs':
        await this.updateGlobalOnboardingDocs(backupData.data);
        break;
    }

    console.log(`✅ ${configType} configuration restored successfully`);
  }

  async listBackups(backupDir?: string): Promise<Array<{ path: string; type: string; timestamp: string; size: number }>> {
    const searchDir = backupDir || join(this.configDir, 'backups');

    try {
      await fs.access(searchDir);
    } catch {
      return [];
    }

    const backups: Array<{ path: string; type: string; timestamp: string; size: number }> = [];

    const entries = await fs.readdir(searchDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const filePath = join(searchDir, entry.name);
        const stats = await fs.stat(filePath);

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          let type = 'unknown';
          if (data.configType) {
            type = data.configType;
          } else if (data.teams && data.setupComponents && data.globalDocs) {
            type = 'full-bundle';
          }

          backups.push({
            path: filePath,
            type,
            timestamp: data.timestamp || stats.mtime.toISOString(),
            size: stats.size
          });
        } catch {
          // Skip invalid JSON files
        }
      } else if (entry.isDirectory()) {
        // Check subdirectories for timestamped backups
        const subBackups = await this.listBackups(join(searchDir, entry.name));
        backups.push(...subBackups);
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async cleanupOldBackups(retentionDays = 30): Promise<number> {
    const backupDir = join(this.configDir, 'backups');

    try {
      await fs.access(backupDir);
    } catch {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    const entries = await fs.readdir(backupDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(backupDir, entry.name);
      const stats = await fs.stat(entryPath);

      if (stats.mtime < cutoffDate) {
        if (entry.isDirectory()) {
          await fs.rm(entryPath, { recursive: true });
        } else {
          await fs.unlink(entryPath);
        }
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
