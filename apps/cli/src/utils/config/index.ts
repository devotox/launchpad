// Public API for the configuration system
export type { LaunchpadConfig, ConfigPaths, ConfigOptions } from '@/utils/config/types';
export { ConfigManager } from '@/utils/config/manager';
export { getConfigDirectory, getConfigPaths, getDataDirectory } from '@/utils/config/paths';
export { createDefaultConfig, validateConfig, validateConfigWithTeams, migrateConfig } from '@/utils/config/defaults';
export { DataManager } from '@/utils/config/data-manager';

// Export data types for external use
export type {
  Team,
  Repository,
  SlackChannels,
  TeamConfig,
  SetupComponent
} from '@/utils/config/data';
