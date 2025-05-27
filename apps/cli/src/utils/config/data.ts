// Type definitions for teams, setup components, and onboarding resources
// All actual data is stored in JSON files in ~/.config/launchpad/

export type Repository = {
  name: string;
  url: string;
  description: string;
  required: boolean;
  type: 'frontend' | 'backend' | 'mobile' | 'infrastructure' | 'shared';
}

export type SlackChannels = {
  main: string;
  standup?: string;
  alerts?: string;
  social?: string;
  support?: string;
}

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
}

export type Team = {
  id: string;
  name: string;
  description: string;
  lead: string;
  slackChannels: SlackChannels;
  repositories: Repository[];
  tools: string[];
  teamSpecificDocs?: string[];
  config: TeamConfig;
}

export type SetupComponent = {
  id: string;
  name: string;
  description: string;
  category: 'essential' | 'development' | 'monitoring' | 'communication' | 'optional';
  dependencies?: string[];
  platforms: ('macos' | 'windows' | 'linux')[];
}
