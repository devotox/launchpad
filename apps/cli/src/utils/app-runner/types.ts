import type { ChildProcess } from 'node:child_process';

export type RunningProcess = {
  repo: string;
  command: string;
  pid: number;
  process: ChildProcess;
  startTime: Date;
  logFile: string;
  isDockerCompose?: boolean;
  composeFile?: string;
  npmUsesDocker?: boolean; // npm script that uses docker compose
  dockerServices?: string[]; // services started by this process
}

export type RunOptions = {
  environment: string;
  parallel: boolean;
  watch: boolean;
  fix?: boolean;
}

export type DockerComposeInfo = {
  isDockerCompose: boolean;
  composeFile?: string;
}

export type NpmDockerInfo = {
  usesDocker: boolean;
  dockerCommand?: string;
  services?: string[];
  composeFile?: string;
}

export type RunSingleCommandParams = {
  actualCommand: string[];
  repo: string;
  repoPath: string;
  command: string;
  options: RunOptions;
  dockerInfo: DockerComposeInfo;
  npmDockerInfo: NpmDockerInfo;
}

export type HandleProcessStreamsParams = {
  childProcess: import('node:child_process').ChildProcess;
  repo: string;
  logFile: string;
  command: string;
  options: RunOptions;
  resolve: () => void;
  reject: (error: Error) => void;
}
