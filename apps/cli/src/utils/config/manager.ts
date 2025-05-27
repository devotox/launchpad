import { promises as fs } from 'node:fs';

import { DataManager } from '@/utils/config/data-manager';
import { createDefaultConfig, validateConfig, validateConfigWithTeams, migrateConfig } from '@/utils/config/defaults';
import { getConfigPaths } from '@/utils/config/paths';

import type { SlackChannels, TeamConfig } from '@/utils/config/data';
import type { LaunchpadConfig, ConfigOptions, SyncConfig } from '@/utils/config/types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: LaunchpadConfig | null = null;
  private configPaths: ReturnType<typeof getConfigPaths>;

  private constructor(options: ConfigOptions = {}) {
    this.configPaths = getConfigPaths(options);
  }

  static getInstance(options: ConfigOptions = {}): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(options);
    }
    return ConfigManager.instance;
  }

  async ensureConfigDir(): Promise<void> {
    try {
      await fs.access(this.configPaths.configDir);
    } catch {
      await fs.mkdir(this.configPaths.configDir, { recursive: true });
    }
  }

  async ensureLogsDir(): Promise<void> {
    try {
      await fs.access(this.configPaths.logsDir);
    } catch {
      await fs.mkdir(this.configPaths.logsDir, { recursive: true });
    }
  }

  async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.configPaths.cacheDir);
    } catch {
      await fs.mkdir(this.configPaths.cacheDir, { recursive: true });
    }
  }

  async loadConfig(): Promise<LaunchpadConfig | null> {
    try {
      const configData = await fs.readFile(this.configPaths.configFile, 'utf-8');
      const parsedConfig = JSON.parse(configData);

      // Validate config structure
      if (!validateConfig(parsedConfig)) {
        console.warn('Invalid config structure detected, attempting migration...');
        this.config = migrateConfig(parsedConfig);
        await this.saveConfig(this.config);
        return this.config;
      }

      // Validate team exists in teams.json
      const teamValidation = await validateConfigWithTeams(parsedConfig);
      if (!teamValidation.isValid) {
        console.warn('Config validation errors:', teamValidation.errors);
        // Don't auto-migrate team issues, let user handle it
        console.warn('Please check your team configuration and teams.json file');
      }

      this.config = parsedConfig;
      return this.config;
    } catch (error) {
      console.warn('Failed to load config:', error);
      return null;
    }
  }

  async saveConfig(config: LaunchpadConfig): Promise<void> {
    await this.ensureConfigDir();

    // Validate before saving
    const validation = await validateConfigWithTeams(config);
    if (!validation.isValid) {
      throw new Error(`Cannot save invalid config: ${validation.errors.join(', ')}`);
    }

    config.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.configPaths.configFile, JSON.stringify(config, null, 2));
    this.config = config;
  }

  async getConfig(): Promise<LaunchpadConfig | null> {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  async updateConfig(updates: Partial<LaunchpadConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error('No config found. Please run "launchpad init" first.');
    }

    const updatedConfig: LaunchpadConfig = {
      ...currentConfig,
      ...updates,
      user: { ...currentConfig.user, ...updates.user },
      workspace: { ...currentConfig.workspace, ...updates.workspace },
      preferences: { ...currentConfig.preferences, ...updates.preferences },
      teamSettings: updates.teamSettings
        ? { ...currentConfig.teamSettings, ...updates.teamSettings }
        : currentConfig.teamSettings,
      lastUpdated: new Date().toISOString()
    };

    await this.saveConfig(updatedConfig);
  }

  async hasConfig(): Promise<boolean> {
    try {
      await fs.access(this.configPaths.configFile);
      return true;
    } catch {
      return false;
    }
  }

  async deleteConfig(): Promise<void> {
    try {
      await fs.unlink(this.configPaths.configFile);
      this.config = null;
    } catch {
      // Config doesn't exist, that's fine
    }
  }

  getConfigPath(): string {
    return this.configPaths.configFile;
  }

  getConfigDir(): string {
    return this.configPaths.configDir;
  }

  getLogsDir(): string {
    return this.configPaths.logsDir;
  }

  getCacheDir(): string {
    return this.configPaths.cacheDir;
  }

  async createDefaultConfig(user: {
    name: string;
    email: string;
    team: string;
  }, workspaceName?: string): Promise<LaunchpadConfig> {
    // Validate team exists before creating config
    const dataManager = DataManager.getInstance();
    const teamExists = await dataManager.validateTeamExists(user.team);
    if (!teamExists) {
      const validTeams = await dataManager.getValidTeamIds();
      throw new Error(`Team '${user.team}' does not exist. Valid teams: ${validTeams.join(', ')}`);
    }

    const defaultConfig = await createDefaultConfig(user, workspaceName);
    await this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  async getTeamConfig(): Promise<TeamConfig | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const dataManager = DataManager.getInstance();
    const team = await dataManager.getTeamById(config.user.team);
    return team?.config || null;
  }

  async getTeamSlackChannels(): Promise<SlackChannels | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const dataManager = DataManager.getInstance();
    const team = await dataManager.getTeamById(config.user.team);
    return team?.slackChannels || null;
  }

  async updateTeamSettings(
    settings: Partial<NonNullable<LaunchpadConfig['teamSettings']>>
  ): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error('No config found. Please run "launchpad init" first.');
    }

    const currentTeamSettings = currentConfig.teamSettings || {
      slackNotifications: true,
      preferredSlackChannel: '',
      customWorkflows: {}
    };

    await this.updateConfig({
      teamSettings: {
        ...currentTeamSettings,
        ...settings
      }
    });
  }

  // Utility methods for other parts of the application
  async getWorkspacePath(): Promise<string | null> {
    const config = await this.getConfig();
    return config?.workspace.path || null;
  }

  async getRepositories(): Promise<string[]> {
    const config = await this.getConfig();
    return config?.workspace.repositories || [];
  }

  async getUserInfo(): Promise<LaunchpadConfig['user'] | null> {
    const config = await this.getConfig();
    return config?.user || null;
  }

  // Sync configuration management
  async getSyncConfig(): Promise<SyncConfig | null> {
    try {
      const syncData = await fs.readFile(this.configPaths.syncConfigFile, 'utf-8');
      return JSON.parse(syncData) as SyncConfig;
    } catch {
      return null;
    }
  }

  async saveSyncConfig(syncConfig: SyncConfig): Promise<void> {
    await this.ensureConfigDir();
    await fs.writeFile(this.configPaths.syncConfigFile, JSON.stringify(syncConfig, null, 2));
  }

  async updateSyncConfig(updates: Partial<SyncConfig>): Promise<void> {
    const currentSync = await this.getSyncConfig();
    const updatedSync: SyncConfig = {
      defaultProvider: 'gist',
      providers: {
        ...currentSync?.providers,
        ...updates.providers
      },
      autoSync: false,
      ...currentSync,
      ...updates
    };

    await this.saveSyncConfig(updatedSync);
  }

  async createDefaultSyncConfig(): Promise<SyncConfig> {
    const defaultSync: SyncConfig = {
      defaultProvider: 'gist',
      providers: {
        local: {
          path: this.configPaths.configDir,
          autoBackup: true,
          backupRetention: 30
        }
      },
      autoSync: false
    };

    await this.saveSyncConfig(defaultSync);
    return defaultSync;
  }

  async getSyncProvider(provider?: string): Promise<SyncConfig['providers'][keyof SyncConfig['providers']] | null> {
    const syncConfig = await this.getSyncConfig();
    if (!syncConfig) return null;

    const providerName = provider || syncConfig.defaultProvider;
    return syncConfig.providers[providerName as keyof SyncConfig['providers']] || null;
  }

  async setSyncProvider(provider: keyof SyncConfig['providers'], config: SyncConfig['providers'][keyof SyncConfig['providers']]): Promise<void> {
    const currentSync = await this.getSyncConfig();
    const currentProviders = currentSync?.providers || {};

    await this.updateSyncConfig({
      providers: {
        ...currentProviders,
        [provider]: config
      }
    });
  }

  async setDefaultSyncProvider(provider: SyncConfig['defaultProvider']): Promise<void> {
    await this.updateSyncConfig({
      defaultProvider: provider
    });
  }

  async deleteSyncConfig(): Promise<void> {
    try {
      await fs.unlink(this.configPaths.syncConfigFile);
    } catch {
      // File doesn't exist, that's fine
    }
  }

  getSyncConfigPath(): string {
    return this.configPaths.syncConfigFile;
  }
}
