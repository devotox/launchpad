// Comprehensive type definitions for the Launchpad CLI configuration system
// All actual data is stored in JSON files in ~/.config/launchpad/

// ============================================================================
// Core Data Types (formerly from data.ts)
// ============================================================================

export type Repository = {
  name: string;
  url: string;
  description: string;
  required: boolean;
  type: 'frontend' | 'backend' | 'mobile' | 'infrastructure' | 'shared';
};

export type SlackChannels = {
  main: string;
  standup?: string;
  alerts?: string;
  social?: string;
  support?: string;
};

export type TeamConfig = {
  defaultBranch: string;
  codeReviewRequired: boolean;
  deploymentEnvironments: string[];
  testingStrategy: string[];
  cicdPipeline: string;
  monitoringTools: string[];
  workspacePrefix?: string;
  communicationPreferences: {
    standupTime?: string;
    timezone: string;
    meetingDays: string[];
  };
};

export type Team = {
  id: string;
  name: string;
  description: string;
  lead: string;
  slackChannels: SlackChannels;
  repositories: Repository[];
  tools: string[] | Record<string, unknown>; // Support both old array and new unified structure
  teamSpecificDocs?: string[];
  config: TeamConfig;
};

export type Platform = 'macos' | 'linux' | 'windows';

// Type definitions for custom check configurations
export type CheckConfig =
  | { type: 'env'; variable?: string; variables?: string[]; value?: string }
  | { type: 'file-contains'; file: string; pattern?: string; patterns?: string[] }
  | { type: 'path-includes'; command: string; includes: string | string[] }
  | { type: 'combined'; checks: CheckConfig[]; operator?: 'AND' | 'OR' }
  | { type: 'command'; command: string };

// Type definitions for custom installation configurations
export type CustomInstallConfig =
  | { type: 'script'; script: string }
  | { type: 'commands'; commands: string[] }
  | { type: 'manual'; steps: string[]; links?: string[] }
  | { type: 'download'; url: string; message?: string };

export type SetupComponent = {
  id: string;
  name: string;
  description: string;
  category: 'essential' | 'development' | 'optional';
  platforms: Platform[];
  choiceGroup?: {
    id: string;
    name: string;
    description: string;
    required?: boolean;
    mutuallyExclusive?: boolean;
  };
  detection: {
    [platform in Platform]?: {
      type: 'command' | 'file' | 'custom';
      value: string;
      customCheck?: CheckConfig | string; // For complex detection logic or JSON string
    };
  };
  installation: {
    [platform in Platform]?: {
      type: 'package-manager' | 'script' | 'manual' | 'custom';
      commands?: string[];
      packageManager?: 'brew' | 'apt' | 'winget' | 'npm' | 'volta';
      packages?: string[];
      script?: string;
      manualSteps?: string[];
      customInstaller?: CustomInstallConfig | string; // Reference to custom installer function or JSON string
    };
  };
  postInstall?: {
    message?: string;
    steps?: string[];
    links?: string[];
  };
};

export type ChoiceGroup = {
  id: string;
  name: string;
  description: string;
  required: boolean;
  mutuallyExclusive: boolean;
  components: SetupComponent[];
};

export type InstallationConfig = {
  type: 'package-manager' | 'script' | 'manual' | 'custom';
  commands?: string[];
  packageManager?: 'brew' | 'apt' | 'winget' | 'npm' | 'volta';
  packages?: string[];
  script?: string;
  manualSteps?: string[];
  customInstaller?: CustomInstallConfig | string;
};

export type PostInstallConfig = {
  message?: string;
  steps?: string[];
  links?: string[];
};

// ============================================================================
// Configuration Types
// ============================================================================

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
    defaultEnvironment?: 'dev' | 'staging' | 'prod' | 'test';
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
};

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
};

export type ConfigPaths = {
  configDir: string;
  configFile: string;
  syncConfigFile: string;
  logsDir: string;
  cacheDir: string;
};

export type ConfigOptions = {
  useXDGConfig?: boolean;
  customConfigDir?: string;
};

export type ConfigSyncOptions = {
  provider: 'gist' | 'github' | 'googledrive' | 'local';
  repository?: string; // For GitHub: "org/repo"
  branch?: string; // For GitHub: default "main"
  token?: string; // For GitHub: personal access token
  gistId?: string; // For GitHub Gist: gist ID
  fileName?: string; // For GitHub Gist: file name in gist
  driveFolder?: string; // For Google Drive: folder ID
  localPath?: string; // For local: file system path
};

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
};

// ============================================================================
// Backup and Restore Types
// ============================================================================

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
};

export type BackupFileInfo = {
  path: string;
  type: string;
  timestamp: string;
  size: number;
};

export type RestoreData = {
  configType?: string;
  teams?: Team[];
  setupComponents?: SetupComponent[];
  globalDocs?: string[];
  version?: string;
  timestamp?: string;
  data?: { length: number };
};

export type GistFileData = {
  files: Record<
    string,
    {
      content: string;
      truncated: boolean;
    }
  >;
};

export type GistResponse = {
  id: string;
  html_url: string;
};

export type GitHubFileData = {
  type: string;
  content: string;
  sha?: string;
};

export type BackupListItem = {
  configType?: string;
  teams?: unknown;
  setupComponents?: unknown;
  globalDocs?: unknown;
  timestamp?: string;
};
