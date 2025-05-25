export interface LaunchpadConfig {
  user: {
    name: string;
    email: string;
    team: string;
  };
  workspace: {
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
  lastUpdated: string;
}

export interface ConfigPaths {
  configDir: string;
  configFile: string;
  logsDir: string;
  cacheDir: string;
}

export interface ConfigOptions {
  useXDGConfig?: boolean;
  customConfigDir?: string;
}
