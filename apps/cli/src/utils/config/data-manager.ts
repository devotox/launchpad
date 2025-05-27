import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import chalk from 'chalk';

import { getConfigDirectory } from '@/utils/config/paths';

import type { Team, SetupComponent } from '@/utils/config/data';
import type { ConfigBundle } from '@/utils/config/types';

export class DataManager {
  private static instance: DataManager;
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
      const content = await fs.readFile(this.teamsFile, 'utf-8');
      const parsed = JSON.parse(content);

      // Type validation
      if (!Array.isArray(parsed)) {
        console.warn('teams.json is not an array, returning empty array');
        return [];
      }

      return parsed as Team[];
    } catch (error) {
      console.warn('Failed to read teams.json:', error);
      return [];
    }
  }

  async getSetupComponents(): Promise<SetupComponent[]> {
    await this.ensureDataFiles();
    try {
      const content = await fs.readFile(this.setupComponentsFile, 'utf-8');
      const parsed = JSON.parse(content);

      // Type validation
      if (!Array.isArray(parsed)) {
        console.warn('setup-components.json is not an array, returning empty array');
        return [];
      }

      return parsed as SetupComponent[];
    } catch (error) {
      console.warn('Failed to read setup-components.json:', error);
      return [];
    }
  }

  async getGlobalOnboardingDocs(): Promise<string[]> {
    await this.ensureDataFiles();
    try {
      const content = await fs.readFile(this.globalDocsFile, 'utf-8');
      const parsed = JSON.parse(content);

      // Type validation
      if (!Array.isArray(parsed)) {
        console.warn('global-docs.json is not an array, returning empty array');
        return [];
      }

      return parsed as string[];
    } catch (error) {
      console.warn('Failed to read global-docs.json:', error);
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

  async getTeamChoices(): Promise<{ name: string; value: string }[]> {
    const teams = await this.getTeams();
    return teams.map((team) => ({
      name: `${team.name} - ${team.description}`,
      value: team.id
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

  async getSetupComponentsByPlatform(platform: 'macos' | 'windows' | 'linux'): Promise<SetupComponent[]> {
    const components = await this.getSetupComponents();
    return components.filter((component) => component.platforms.includes(platform));
  }

  async getSetupComponentsByCategory(category: SetupComponent['category']): Promise<SetupComponent[]> {
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
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      teams,
      setupComponents,
      globalDocs,
      metadata: {
        source: 'launchpad-cli',
        description: 'Launchpad configuration bundle'
      }
    };
  }

  async importConfigBundle(bundle: ConfigBundle): Promise<void> {
    // Validate bundle structure
    if (!bundle.teams || !bundle.setupComponents || !bundle.globalDocs) {
      throw new Error('Invalid config bundle: missing required data');
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

    console.log('✅ Config bundle imported successfully');
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
      return JSON.parse(content) as ConfigBundle;
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

  async downloadConfigFromGist(options: {
    gistId: string;
    fileName?: string;
    token?: string;
  }): Promise<ConfigBundle> {
    const { gistId, fileName = 'launchpad-config.json', token } = options;

    // Extract just the gist ID if full URL or username/gistId format is provided
    const actualGistId = this.extractGistId(gistId);
    const url = `https://api.github.com/gists/${actualGistId}`;
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
        let errorMessage = `GitHub Gist API error: ${response.status} ${response.statusText}`;

        if (response.status === 404) {
          errorMessage = `Gist not found (404). This could mean:
  • The gist ID '${gistId}' doesn't exist
  • The gist is private and you don't have access
  • Your token doesn't have the required permissions (needs 'gist' scope)`;
        } else if (response.status === 401) {
          errorMessage = `Authentication failed (401). Check your GitHub token:
  • Make sure the token is valid
  • Ensure it has 'gist' scope for private gists
  • Token may have expired`;
        } else if (response.status === 403) {
          errorMessage = `Access forbidden (403). Your token may not have the required permissions:
  • Add 'gist' scope to your token for private gists
  • Check if the gist owner has restricted access`;
        }

        throw new Error(errorMessage);
      }

      const gistData = await response.json() as {
        files: Record<string, { content: string; truncated: boolean }>;
      };

      const file = gistData.files[fileName];
      if (!file) {
        throw new Error(`File '${fileName}' not found in gist`);
      }

      if (file.truncated) {
        throw new Error('Gist file is truncated. Please use a smaller config file or GitHub repository instead.');
      }

      return JSON.parse(file.content) as ConfigBundle;
    } catch (error) {
      throw new Error(`Failed to download config from GitHub Gist: ${error}`);
    }
  }

  async uploadConfigToGist(bundle: ConfigBundle, options: {
    gistId?: string;
    fileName?: string;
    token: string;
    description?: string;
    saveConfig?: boolean;
  }): Promise<string> {
    const {
      gistId,
      fileName = 'launchpad-config.json',
      token,
      description = `Launchpad configuration - ${new Date().toISOString()}`,
      saveConfig = false
    } = options;

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`,
      'User-Agent': 'launchpad-cli',
      'Content-Type': 'application/json'
    };

    const content = JSON.stringify(bundle, null, 2);

    try {
      if (gistId) {
        // Update existing gist
        const actualGistId = this.extractGistId(gistId);
        const url = `https://api.github.com/gists/${actualGistId}`;
        const body = {
          description,
          files: {
            [fileName]: {
              content
            }
          }
        };

        const response = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorData = await response.json() as { message?: string };
          let errorMessage = `GitHub Gist API error: ${response.status} ${errorData.message || response.statusText}`;

          if (response.status === 404) {
            errorMessage = `Gist not found (404). The gist ID '${gistId}' may not exist or you don't have access to it.`;
          } else if (response.status === 401) {
            errorMessage = "Authentication failed (401). Check your GitHub token and ensure it has 'gist' scope.";
          } else if (response.status === 403) {
            errorMessage = 'Access forbidden (403). Your token may not have permission to modify this gist.';
          }

          throw new Error(errorMessage);
        }

        const responseData = await response.json() as { id: string; html_url: string };
        console.log(`✅ Config updated in GitHub Gist: ${responseData.html_url}`);

        if (saveConfig) {
          await this.saveGistConfig(responseData.id, fileName, token, description);
        }

        return responseData.id;
      }

      // Create new gist
      const url = 'https://api.github.com/gists';
      const body = {
        description,
        public: false, // Private by default for security
        files: {
          [fileName]: {
            content
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        let errorMessage = `GitHub Gist API error: ${response.status} ${errorData.message || response.statusText}`;

        if (response.status === 401) {
          errorMessage = "Authentication failed (401). Check your GitHub token and ensure it has 'gist' scope.";
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden (403). Your token may not have permission to create gists.';
        } else if (response.status === 422) {
          errorMessage = 'Invalid request (422). Check your gist content and try again.';
        }

        throw new Error(errorMessage);
      }

      const responseData = await response.json() as { id: string; html_url: string };
      console.log(`✅ Config uploaded to new GitHub Gist: ${responseData.html_url}`);
      console.log(`📋 Gist ID: ${responseData.id} (automatically saved to config)`);

      if (saveConfig) {
        await this.saveGistConfig(responseData.id, fileName, token, description);
      }

      return responseData.id;
    } catch (error) {
      throw new Error(`Failed to upload config to GitHub Gist: ${error}`);
    }
  }

      private extractGistId(gistInput: string): string {
    // Handle different gist input formats:
    // 1. Full URL: https://gist.github.com/username/gistId
    // 2. Username/gistId format: username/gistId
    // 3. Just gistId: gistId

    if (gistInput.includes('gist.github.com/')) {
      // Extract from full URL
      const match = gistInput.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/);
      if (match?.[1]) {
        return match[1];
      }
      return gistInput;
    }

    if (gistInput.includes('/')) {
      // Extract from username/gistId format - take everything after the last slash
      const lastSlashIndex = gistInput.lastIndexOf('/');
      return gistInput.substring(lastSlashIndex + 1);
    }

    // Already just the gist ID
    return gistInput;
  }

  private async saveGistConfig(gistId: string, fileName: string, token: string, description: string): Promise<void> {
    try {
      // Import ConfigManager to save the gist configuration
      const { ConfigManager } = await import('@/utils/config/manager');
      const configManager = ConfigManager.getInstance();

      await configManager.setSyncProvider('gist', {
        gistId,
        fileName,
        token,
        description
      });

      // Set gist as default provider if no default is set
      const syncConfig = await configManager.getSyncConfig();
      if (!syncConfig || !syncConfig.defaultProvider) {
        await configManager.setDefaultSyncProvider('gist');
      }

      console.log(chalk.green('💾 Gist configuration saved for future use'));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Could not save gist configuration: ${error}`));
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
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      configType,
      data,
      metadata: {
        source: 'launchpad-cli',
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

  async listBackups(backupDir?: string): Promise<{ path: string; type: string; timestamp: string; size: number }[]> {
    const searchDir = backupDir || join(this.configDir, 'backups');

    try {
      await fs.access(searchDir);
    } catch {
      return [];
    }

    const backups: { path: string; type: string; timestamp: string; size: number }[] = [];

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
