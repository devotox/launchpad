import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import chalk from 'chalk';
import { match } from 'ts-pattern';

import { CoreDataManager } from '@/utils/config/data-manager/core';

import type { Team, SetupComponent } from '@/utils/config/types';
import type { ConfigBundle, BackupFileInfo, SyncConfig } from '@/utils/config/types';

import parseJson from 'parse-json';
import { stringify } from 'safe-stable-stringify';

export class DataManager {
  private static instance: DataManager;
  private coreDataManager: CoreDataManager;

  private constructor() {
    this.coreDataManager = CoreDataManager.getInstance();
  }

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // Delegate all core data operations
  async ensureDataFiles(): Promise<void> {
    return this.coreDataManager.ensureDataFiles();
  }

  // Teams operations
  async getTeams(): Promise<Team[]> {
    return this.coreDataManager.getTeams();
  }

  async updateTeams(teams: Team[]): Promise<void> {
    return this.coreDataManager.updateTeams(teams);
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    return this.coreDataManager.getTeamById(id);
  }

  async getTeamChoices(): Promise<{ name: string; value: string }[]> {
    return this.coreDataManager.getTeamChoices();
  }

  async getTeamSlackChannels(teamId: string) {
    return this.coreDataManager.getTeamSlackChannels(teamId);
  }

  async getTeamConfig(teamId: string) {
    return this.coreDataManager.getTeamConfig(teamId);
  }

  async getAllOnboardingDocs(teamId: string): Promise<string[]> {
    return this.coreDataManager.getAllOnboardingDocs(teamId);
  }

  async getTeamSpecificDocs(teamId: string): Promise<string[]> {
    return this.coreDataManager.getTeamSpecificDocs(teamId);
  }

  async validateTeamExists(teamId: string): Promise<boolean> {
    return this.coreDataManager.validateTeamExists(teamId);
  }

  async getValidTeamIds(): Promise<string[]> {
    return this.coreDataManager.getValidTeamIds();
  }

  // Setup components operations
  async getSetupComponents(): Promise<SetupComponent[]> {
    return this.coreDataManager.getSetupComponents();
  }

  async updateSetupComponents(components: SetupComponent[]): Promise<void> {
    return this.coreDataManager.updateSetupComponents(components);
  }

  async getSetupComponentById(id: string): Promise<SetupComponent | undefined> {
    return this.coreDataManager.getSetupComponentById(id);
  }

  async getSetupComponentsByPlatform(
    platform: 'macos' | 'windows' | 'linux'
  ): Promise<SetupComponent[]> {
    return this.coreDataManager.getSetupComponentsByPlatform(platform);
  }

  async groupSetupComponentsByCategory(
    components?: SetupComponent[]
  ): Promise<Record<string, SetupComponent[]>> {
    return this.coreDataManager.groupSetupComponentsByCategory(components);
  }

  // Global docs operations
  async getGlobalOnboardingDocs(): Promise<string[]> {
    return this.coreDataManager.getGlobalOnboardingDocs();
  }

  async updateGlobalOnboardingDocs(docs: string[]): Promise<void> {
    return this.coreDataManager.updateGlobalOnboardingDocs(docs);
  }

  // File path getters
  getTeamsFilePath(): string {
    return this.coreDataManager.getTeamsFilePath();
  }

  getSetupComponentsFilePath(): string {
    return this.coreDataManager.getSetupComponentsFilePath();
  }

  getGlobalDocsFilePath(): string {
    return this.coreDataManager.getGlobalDocsFilePath();
  }

  // Sync config operations
  async getSyncConfig() {
    const { ConfigManager } = await import('@/utils/config/manager');
    const configManager = ConfigManager.getInstance();
    return configManager.getSyncConfig();
  }

  async updateSyncConfig(syncConfig: SyncConfig): Promise<void> {
    const { ConfigManager } = await import('@/utils/config/manager');
    const configManager = ConfigManager.getInstance();
    return configManager.saveSyncConfig(syncConfig);
  }

  async getSyncConfigFilePath(): Promise<string> {
    const { ConfigManager } = await import('@/utils/config/manager');
    const configManager = ConfigManager.getInstance();
    return configManager.getSyncConfigPath();
  }

  // Bundle operations
  async createConfigBundle(): Promise<ConfigBundle> {
    const teams = await this.getTeams();
    const setupComponents = await this.getSetupComponents();
    const globalDocs = await this.getGlobalOnboardingDocs();

    // Get sanitized sync config
    let sanitizedSyncConfig: ConfigBundle['syncConfig'];
    try {
      const { ConfigManager } = await import('@/utils/config/manager');
      const configManager = ConfigManager.getInstance();
      const syncConfig = await configManager.getSyncConfig();

      if (syncConfig) {
        // Create a sanitized version with empty tokens
        sanitizedSyncConfig = {
          ...syncConfig,
          providers: Object.fromEntries(
            Object.entries(syncConfig.providers).map(([key, provider]) => {
              if (!provider) return [key, provider];

              // Sanitize sensitive fields by setting them to empty strings
              const sanitized = { ...provider } as Record<string, unknown>;
              if ('token' in sanitized) {
                (sanitized as { token: string }).token = '';
              }
              if ('credentials' in sanitized) {
                (sanitized as { credentials: string }).credentials = '';
              }

              return [key, sanitized];
            })
          )
        };
      }
    } catch {
      // Sync config is optional, don't fail bundle creation
    }

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      teams,
      setupComponents,
      globalDocs,
      syncConfig: sanitizedSyncConfig,
      metadata: {
        source: 'launchpad-cli',
        description: 'Configuration bundle created by Launchpad CLI'
      }
    };
  }

  async importConfigBundle(bundle: ConfigBundle): Promise<void> {
    // Validate bundle structure
    if (!bundle.teams || !bundle.setupComponents || !bundle.globalDocs) {
      throw new Error('Invalid config bundle: missing required data');
    }

    const configDir = this.coreDataManager.getTeamsFilePath().replace('/teams.json', '');

    // Backup existing data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(configDir, 'backups', timestamp);
    await fs.mkdir(backupDir, { recursive: true });

    try {
      // Backup existing files
      await fs.copyFile(this.getTeamsFilePath(), join(backupDir, 'teams.json'));
      await fs.copyFile(
        this.getSetupComponentsFilePath(),
        join(backupDir, 'setup-components.json')
      );
      await fs.copyFile(this.getGlobalDocsFilePath(), join(backupDir, 'global-docs.json'));
    } catch {
      // Files might not exist, that's okay
    }

    // Import new data
    await this.updateTeams(bundle.teams);
    await this.updateSetupComponents(bundle.setupComponents);
    await this.updateGlobalOnboardingDocs(bundle.globalDocs);

    // Import sync config if present (user will need to add tokens manually)
    if (bundle.syncConfig) {
      try {
        const { ConfigManager } = await import('@/utils/config/manager');
        const configManager = ConfigManager.getInstance();
        await configManager.saveSyncConfig(bundle.syncConfig);
        console.log('📋 Sync configuration imported (tokens will need to be added manually)');
      } catch (error) {
        console.warn(`⚠️  Could not import sync config: ${error}`);
      }
    }

    console.log('✅ Config bundle imported successfully');
    console.log(`📁 Backup created at: ${backupDir}`);
  }

  // Helper method to parse gist ID from various formats
  private parseGistId(gistInput: string): string {
    // Handle full URLs: https://gist.github.com/username/gistId
    const fullUrlMatch = gistInput.match(/https?:\/\/gist\.github\.com\/[^/]+\/([a-f0-9]+)/);
    if (fullUrlMatch?.[1]) {
      return fullUrlMatch[1];
    }

    // Handle username/gistId format: username/gistId
    const userGistMatch = gistInput.match(/^[^/]+\/([a-f0-9]+)$/);
    if (userGistMatch?.[1]) {
      return userGistMatch[1];
    }

    // Handle raw gist ID: just the gist ID
    const rawGistMatch = gistInput.match(/^([a-f0-9]+)$/);
    if (rawGistMatch?.[1]) {
      return rawGistMatch[1];
    }

    // If none of the patterns match, throw an error
    throw new Error(
      `Invalid gist format. Expected: full URL, username/gistId, or raw gist ID. Got: ${gistInput}`
    );
  }

  // Remote sync methods
  async downloadConfigFromGitHub(options: {
    repository: string;
    branch?: string;
    token?: string;
    path?: string;
  }): Promise<ConfigBundle> {
    const { repository, branch = 'main', token, path = 'launchpad-config.json' } = options;

    const url = `https://api.github.com/repos/${repository}/contents/${path}?ref=${branch}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
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

      const data = (await response.json()) as { type: string; content: string };

      if (data.type !== 'file') {
        throw new Error('Config path is not a file');
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return parseJson(content) as ConfigBundle;
    } catch (error) {
      throw new Error(`Failed to download config from GitHub: ${error}`);
    }
  }

  async uploadConfigToGitHub(
    bundle: ConfigBundle,
    options: {
      repository: string;
      branch?: string;
      token: string;
      path?: string;
      message?: string;
    }
  ): Promise<void> {
    const {
      repository,
      branch = 'main',
      token,
      path = 'launchpad-config.json',
      message = `Update Launchpad config - ${new Date().toISOString()}`
    } = options;

    const url = `https://api.github.com/repos/${repository}/contents/${path}`;
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
      'User-Agent': 'launchpad-cli'
    };

    try {
      // Get current file SHA if it exists
      let sha: string | undefined;
      try {
        const getResponse = await fetch(`${url}?ref=${branch}`, { headers });
        if (getResponse.ok) {
          const fileData = (await getResponse.json()) as { sha: string };
          sha = fileData.sha;
        }
      } catch {
        // File doesn't exist, that's okay
      }

      const content = Buffer.from(stringify(bundle, null, 2)).toString('base64');

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
        body: stringify(body)
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(
          `GitHub API error: ${response.status} ${errorData.message || response.statusText}`
        );
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
    const { gistId: gistInput, fileName = 'launchpad-config.json', token } = options;

    // Parse the gist ID from various possible formats
    const gistId = this.parseGistId(gistInput);
    console.log(chalk.gray(`Parsed gist ID: ${gistId}`));

    const url = `https://api.github.com/gists/${gistId}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'launchpad-cli'
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`GitHub Gist API error: ${response.status} ${response.statusText}`);
      }

      const gistData = (await response.json()) as {
        files: Record<string, { content: string; truncated: boolean }>;
      };

      const file = gistData.files[fileName];
      if (!file) {
        throw new Error(`File '${fileName}' not found in gist`);
      }

      if (file.truncated) {
        throw new Error(
          'Gist file is truncated. Please use a smaller config file or GitHub repository instead.'
        );
      }

      return parseJson(file.content) as ConfigBundle;
    } catch (error) {
      throw new Error(`Failed to download config from GitHub Gist: ${error}`);
    }
  }

  async uploadConfigToGist(
    bundle: ConfigBundle,
    options: {
      gistId?: string;
      fileName?: string;
      token: string;
      description?: string;
      saveConfig?: boolean;
    }
  ): Promise<string> {
    const {
      gistId: gistInput,
      fileName = 'launchpad-config.json',
      token,
      description = `Launchpad configuration - ${new Date().toISOString()}`,
      saveConfig = false
    } = options;

    // Parse the gist ID if provided
    const gistId = gistInput ? this.parseGistId(gistInput) : undefined;
    if (gistId) {
      console.log(chalk.gray(`Parsed gist ID: ${gistId}`));
    }

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`,
      'User-Agent': 'launchpad-cli',
      'Content-Type': 'application/json'
    };

    const content = stringify(bundle, null, 2);

    try {
      if (gistId) {
        // Update existing gist
        const url = `https://api.github.com/gists/${gistId}`;
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
          body: stringify(body)
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          throw new Error(
            `GitHub Gist API error: ${response.status} ${errorData.message || response.statusText}`
          );
        }

        const responseData = (await response.json()) as { id: string; html_url: string };
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
        body: stringify(body)
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(
          `GitHub Gist API error: ${response.status} ${errorData.message || response.statusText}`
        );
      }

      const responseData = (await response.json()) as { id: string; html_url: string };
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

  private async saveGistConfig(
    gistId: string,
    fileName: string,
    token: string,
    description: string
  ): Promise<void> {
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

  // Backup and restore methods
  async backupConfigFile(
    configType: 'teams' | 'setup-components' | 'global-docs' | 'sync-config',
    outputPath?: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const configDir = this.coreDataManager.getTeamsFilePath().replace('/teams.json', '');
    const backupDir = join(configDir, 'backups');

    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });

    const defaultPath =
      outputPath || join(backupDir, `launchpad-${configType}-backup-${timestamp}.json`);

    const { data, sourceFile } = await match(configType)
      .with('teams', async () => ({
        data: await this.getTeams(),
        sourceFile: this.getTeamsFilePath()
      }))
      .with('setup-components', async () => ({
        data: await this.getSetupComponents(),
        sourceFile: this.getSetupComponentsFilePath()
      }))
      .with('global-docs', async () => ({
        data: await this.getGlobalOnboardingDocs(),
        sourceFile: this.getGlobalDocsFilePath()
      }))
      .with('sync-config', async () => ({
        data: await this.getSyncConfig(),
        sourceFile: await this.getSyncConfigFilePath()
      }))
      .otherwise(() => {
        throw new Error(`Unknown config type: ${configType}`);
      });

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

    await fs.writeFile(defaultPath, stringify(backupData, null, 2));
    return defaultPath;
  }

  async restoreConfigFile(
    configType: 'teams' | 'setup-components' | 'global-docs' | 'sync-config',
    inputPath: string,
    createBackup = true
  ): Promise<void> {
    const configDir = this.getTeamsFilePath().replace('/teams.json', '');

    // Create backup of current data if requested
    if (createBackup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = join(configDir, 'backups', timestamp);
      await fs.mkdir(backupDir, { recursive: true });

      try {
        const sourceFile = await match(configType)
          .with('teams', () => this.getTeamsFilePath())
          .with('setup-components', () => this.getSetupComponentsFilePath())
          .with('global-docs', () => this.getGlobalDocsFilePath())
          .with('sync-config', async () => this.getSyncConfigFilePath())
          .otherwise(() => {
            throw new Error(`Unknown config type: ${configType}`);
          });

        await fs.copyFile(sourceFile, join(backupDir, `${configType}.json`));
        console.log(`📁 Backup created at: ${backupDir}/${configType}.json`);
      } catch {
        // File might not exist, that's okay
      }
    }

    // Read and validate restore data
    const content = await fs.readFile(inputPath, 'utf-8');
    const backupData = parseJson(content) as { configType: string; data: unknown };

    if (backupData.configType !== configType) {
      throw new Error(
        `Backup file is for '${backupData.configType}' but trying to restore '${configType}'`
      );
    }

    // Validate backup data based on config type
    if (configType !== 'sync-config' && !Array.isArray(backupData.data)) {
      throw new Error('Invalid backup data: expected array');
    }

    // Restore the data
    await match(configType)
      .with('teams', async () => this.updateTeams(backupData.data as Team[]))
      .with('setup-components', async () =>
        this.updateSetupComponents(backupData.data as SetupComponent[])
      )
      .with('global-docs', async () => this.updateGlobalOnboardingDocs(backupData.data as string[]))
      .with('sync-config', async () => this.updateSyncConfig(backupData.data as SyncConfig))
      .otherwise(async () => Promise.resolve());

    console.log(`✅ ${configType} configuration restored successfully`);
  }

  async listBackups(backupDir?: string): Promise<BackupFileInfo[]> {
    const configDir = this.getTeamsFilePath().replace('/teams.json', '');
    const searchDir = backupDir || join(configDir, 'backups');

    try {
      await fs.access(searchDir);
    } catch {
      return [];
    }

    const backups: BackupFileInfo[] = [];

    const entries = await fs.readdir(searchDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const filePath = join(searchDir, entry.name);
        const stats = await fs.stat(filePath);

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = parseJson(content) as {
            configType?: string;
            teams?: unknown;
            setupComponents?: unknown;
            globalDocs?: unknown;
            timestamp?: string;
          };

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

    return backups.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async cleanupOldBackups(retentionDays = 30): Promise<number> {
    const configDir = this.getTeamsFilePath().replace('/teams.json', '');
    const backupDir = join(configDir, 'backups');

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
