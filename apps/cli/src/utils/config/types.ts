import type { Team, SetupComponent } from "@/utils/config/data";

export interface LaunchpadConfig {
  user: {
    name: string;
    email: string;
    team: string;
  };
  workspace: {
    name: string;
    path: string;
    repositories: string[];
  };
  preferences: {
    defaultEditor?: string;
    autoClone: boolean;
    setupDependencies: boolean;
    preferredEditor: string;
    preferredTerminal: string;
    preferredSlackChannel: string;
    gitBranchPrefix?: string;
    customWorkflows: Record<string, unknown>;
  };
  teamSettings?: {
    slackNotifications: boolean;
    preferredSlackChannel: string;
    gitBranchPrefix?: string;
    customWorkflows: Record<string, unknown>;
  };
  sync?: SyncConfig;
  lastUpdated: string;
}

export interface SyncConfig {
  defaultProvider: 'github' | 'googledrive' | 'local';
  providers: {
    github?: {
      repository: string;
      branch: string;
      token?: string;
      path: string;
    };
    googledrive?: {
      folderId: string;
      fileName: string;
      credentials?: string;
    };
    local?: {
      path: string;
      autoBackup: boolean;
      backupRetention: number; // days
    };
  };
  autoSync: boolean;
  syncInterval?: number; // minutes
  lastSync?: string;
}

export interface ConfigPaths {
  configDir: string;
  configFile: string;
  syncConfigFile: string;
  logsDir: string;
  cacheDir: string;
}

export interface ConfigOptions {
  useXDGConfig?: boolean;
  customConfigDir?: string;
}

export interface ConfigSyncOptions {
  provider: 'github' | 'googledrive' | 'local';
  repository?: string; // For GitHub: "org/repo"
  branch?: string; // For GitHub: default "main"
  token?: string; // For GitHub: personal access token
  driveFolder?: string; // For Google Drive: folder ID
  localPath?: string; // For local: file system path
}

export interface ConfigBundle {
  version: string;
  timestamp: string;
  teams: Team[];
  setupComponents: SetupComponent[];
  globalDocs: string[];
  metadata: {
    source: string;
    description?: string;
  };
}
