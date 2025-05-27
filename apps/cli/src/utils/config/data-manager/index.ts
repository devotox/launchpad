import { CoreDataManager } from '@/utils/config/data-manager/core';
import type { Team, SetupComponent } from '@/utils/config/data';
import type { ConfigBundle, BackupFileInfo } from '@/utils/config/types';

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

  async getSetupComponentsByPlatform(platform: 'macos' | 'windows' | 'linux'): Promise<SetupComponent[]> {
    return this.coreDataManager.getSetupComponentsByPlatform(platform);
  }

  async groupSetupComponentsByCategory(components?: SetupComponent[]): Promise<Record<string, SetupComponent[]>> {
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

  // Bundle operations (simplified for now)
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
        description: 'Configuration bundle created by Launchpad CLI'
      }
    };
  }

  async importConfigBundle(bundle: ConfigBundle): Promise<void> {
    console.log('📦 Importing configuration bundle...');

    if (bundle.teams) {
      await this.updateTeams(bundle.teams);
      console.log(`✅ Imported ${bundle.teams.length} teams`);
    }

    if (bundle.setupComponents) {
      await this.updateSetupComponents(bundle.setupComponents);
      console.log(`✅ Imported ${bundle.setupComponents.length} setup components`);
    }

    if (bundle.globalDocs) {
      await this.updateGlobalOnboardingDocs(bundle.globalDocs);
      console.log(`✅ Imported ${bundle.globalDocs.length} global documentation links`);
    }

    console.log('✅ Configuration bundle imported successfully!');
  }

  // Placeholder methods for backup/restore and remote sync
  // These will be implemented by specialized managers later
  async backupConfigFile(_configType: string, _outputPath?: string): Promise<string> {
    throw new Error('Backup functionality not yet implemented in refactored version');
  }

  async restoreConfigFile(_configType: string, _inputPath: string, _createBackup = true): Promise<void> {
    throw new Error('Restore functionality not yet implemented in refactored version');
  }

  async listBackups(_backupDir?: string): Promise<BackupFileInfo[]> {
    throw new Error('List backups functionality not yet implemented in refactored version');
  }

  async cleanupOldBackups(_retentionDays = 30): Promise<number> {
    throw new Error('Cleanup backups functionality not yet implemented in refactored version');
  }
}
