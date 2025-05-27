import type { Team, SetupComponent } from '@/utils/config/data';

export type LaunchpadConfig = {
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

export type SyncConfig = {
  defaultProvider: 'gist' | 'github' | 'googledrive' | 'local';
  providers: {
    github?: {
      repository: string;
      branch: string;
      token?: string;
      path: string;
    };
    gist?: {
      gistId: string;
      fileName: string;
      token?: string;
      description?: string;
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

export type ConfigPaths = {
  configDir: string;
  configFile: string;
  syncConfigFile: string;
  logsDir: string;
  cacheDir: string;
}

export type ConfigOptions = {
  useXDGConfig?: boolean;
  customConfigDir?: string;
}

export type ConfigSyncOptions = {
  provider: 'gist' | 'github' | 'googledrive' | 'local';
  repository?: string; // For GitHub: "org/repo"
  branch?: string; // For GitHub: default "main"
  token?: string; // For GitHub: personal access token
  gistId?: string; // For GitHub Gist: gist ID
  fileName?: string; // For GitHub Gist: file name in gist
  driveFolder?: string; // For Google Drive: folder ID
  localPath?: string; // For local: file system path
}

export type ConfigBundle = {
  version: string;
  timestamp: string;
  teams: Team[];
  setupComponents: SetupComponent[];
  globalDocs: string[];
  syncConfig?: SyncConfig;
  metadata: {
    source: string;
    description?: string;
  };
}

// Backup and Restore Types
export type BackupConfigType = 'teams' | 'setup-components' | 'global-docs';

export type BackupData<T = Team[] | SetupComponent[] | string[]> = {
  version: string;
  timestamp: string;
  configType: BackupConfigType;
  data: T;
  metadata: {
    source: string;
    sourceFile: string;
    description: string;
  };
}

export type BackupFileInfo = {
  path: string;
  type: string;
  timestamp: string;
  size: number;
}

export type RestoreData = {
  configType?: string;
  teams?: Team[];
  setupComponents?: SetupComponent[];
  globalDocs?: string[];
  version?: string;
  timestamp?: string;
  data?: { length: number };
}

export type GistFileData = {
  files: Record<string, {
    content: string;
    truncated: boolean;
  }>;
}

export type GistResponse = {
  id: string;
  html_url: string;
}

export type GitHubFileData = {
  type: string;
  content: string;
  sha?: string;
}

export type BackupListItem = {
  configType?: string;
  teams?: unknown;
  setupComponents?: unknown;
  globalDocs?: unknown;
  timestamp?: string;
}
