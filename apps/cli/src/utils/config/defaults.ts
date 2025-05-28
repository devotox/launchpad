import { homedir } from 'node:os';
import { join } from 'node:path';

import { DataManager } from '@/utils/config/data-manager';

import type { LaunchpadConfig, Team } from '@/utils/config/types';

export async function createDefaultConfig(
  user: {
    name: string;
    email: string;
    team: string;
  },
  workspaceName?: string
): Promise<LaunchpadConfig> {
  // Use provided workspace name or extract from email domain
  let finalWorkspaceName: string;

  if (workspaceName) {
    finalWorkspaceName = workspaceName;
  } else {
    const emailParts = user.email.split('@');
    const emailDomain = emailParts.length > 1 ? emailParts[1] : null;
    finalWorkspaceName = emailDomain ? emailDomain.split('.')[0] || 'workspace' : 'workspace';
  }

  // Try to get team-specific workspace configuration
  let workspacePath = join(homedir(), 'Documents', finalWorkspaceName);

  try {
    // Import DataManager here to avoid circular dependencies
    const { DataManager } = await import('@/utils/config/data-manager');
    const dataManager = DataManager.getInstance();
    const team = await dataManager.getTeamById(user.team);

    // If team has a specific workspace configuration, use it (but still use finalWorkspaceName if provided)
    if (!workspaceName && team?.config.workspacePrefix) {
      finalWorkspaceName = team.config.workspacePrefix;
      workspacePath = join(homedir(), 'Documents', finalWorkspaceName);
    }
  } catch {
    // If DataManager fails, use the current finalWorkspaceName
  }

  const defaultConfig: LaunchpadConfig = {
    user,
    workspace: {
      name: finalWorkspaceName,
      path: workspacePath,
      repositories: []
    },
    preferences: {
      autoClone: true,
      setupDependencies: true,
      defaultEnvironment: 'dev',
      preferredEditor: '',
      preferredTerminal: '',
      preferredSlackChannel: '',
      gitBranchPrefix: user.name.toLowerCase().split(' ')[0],
      customWorkflows: {}
    },
    teamSettings: {
      slackNotifications: true,
      preferredSlackChannel: '',
      gitBranchPrefix: user.name.toLowerCase().split(' ')[0],
      customWorkflows: {}
    },
    lastUpdated: new Date().toISOString()
  };

  return defaultConfig;
}

export function validateConfig(config: unknown): config is LaunchpadConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  // Check required top-level properties
  if (!cfg['user'] || typeof cfg['user'] !== 'object') {
    return false;
  }

  if (!cfg['workspace'] || typeof cfg['workspace'] !== 'object') {
    return false;
  }

  if (!cfg['preferences'] || typeof cfg['preferences'] !== 'object') {
    return false;
  }

  const user = cfg['user'] as Record<string, unknown>;
  const workspace = cfg['workspace'] as Record<string, unknown>;

  // Validate user object
  if (
    typeof user['name'] !== 'string' ||
    typeof user['email'] !== 'string' ||
    typeof user['team'] !== 'string'
  ) {
    return false;
  }

  // Validate workspace object
  if (typeof workspace['name'] !== 'string' || typeof workspace['path'] !== 'string') {
    return false;
  }

  // Validate repositories array
  if (!Array.isArray(workspace['repositories'])) {
    return false;
  }

  // Validate repositories array contains only strings
  if (!workspace['repositories'].every((repo: unknown) => typeof repo === 'string')) {
    return false;
  }

  return true;
}

export async function validateConfigWithTeams(
  config: unknown
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // First validate basic config structure
  if (!validateConfig(config)) {
    errors.push('Invalid configuration structure');
    return { isValid: false, errors };
  }

  const validConfig = config;

  // Validate team exists
  const dataManager = DataManager.getInstance();
  const teams = await dataManager.getTeams();
  const teamExists = teams.some((team: Team) => team.id === validConfig.user.team);

  if (!teamExists) {
    const teamIds = teams.map((team: Team) => team.id);
    errors.push(
      `Team '${validConfig.user.team}' not found. Available teams: ${teamIds.join(', ')}`
    );
  }

  return { isValid: errors.length === 0, errors };
}

export function migrateConfig(config: unknown): LaunchpadConfig {
  // Handle any config migrations here
  // For now, just ensure all required fields exist
  const cfg = config as Partial<LaunchpadConfig>;

  return {
    user: {
      name: cfg.user?.name || '',
      email: cfg.user?.email || '',
      team: cfg.user?.team || ''
    },
    workspace: {
      name: cfg.workspace?.name || 'workspace',
      path: cfg.workspace?.path || '',
      repositories: cfg.workspace?.repositories || []
    },
    preferences: {
      autoClone: cfg.preferences?.autoClone ?? true,
      setupDependencies: cfg.preferences?.setupDependencies ?? true,
      defaultEnvironment: cfg.preferences?.defaultEnvironment || 'dev',
      preferredEditor: cfg.preferences?.preferredEditor || '',
      preferredTerminal: cfg.preferences?.preferredTerminal || '',
      preferredSlackChannel: cfg.preferences?.preferredSlackChannel || '',
      gitBranchPrefix: cfg.preferences?.gitBranchPrefix || '',
      customWorkflows: cfg.preferences?.customWorkflows || {}
    },
    teamSettings: cfg.teamSettings,
    lastUpdated: cfg.lastUpdated || new Date().toISOString()
  };
}
