import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { match } from 'ts-pattern';

import type { DockerComposeInfo, NpmDockerInfo } from './types';

export class DockerDetector {
  async detectDockerCompose(repoPath: string): Promise<DockerComposeInfo> {
    const possibleFiles = [
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml',
      'docker-compose.dev.yml',
      'docker-compose.development.yml'
    ];

    for (const file of possibleFiles) {
      try {
        await fs.access(join(repoPath, file));
        return {
          isDockerCompose: true,
          composeFile: file
        };
      } catch {
        // File doesn't exist, continue checking
      }
    }

    return { isDockerCompose: false };
  }

  async detectNpmDockerUsage(repoPath: string, command: string): Promise<NpmDockerInfo> {
    try {
      const packageJsonPath = join(repoPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent) as { scripts?: Record<string, string> };

      if (!packageJson.scripts) {
        return { usesDocker: false };
      }

      // Map command to potential npm script names
      const scriptNames = this.getScriptNames(command);

      for (const scriptName of scriptNames) {
        const script = packageJson.scripts[scriptName];
        if (script && this.scriptUsesDockerCompose(script)) {
          const dockerInfo = this.parseDockerComposeScript(script);
          return {
            usesDocker: true,
            dockerCommand: script,
            services: dockerInfo.services,
            composeFile: dockerInfo.composeFile
          };
        }
      }

      return { usesDocker: false };
    } catch {
      return { usesDocker: false };
    }
  }

  private getScriptNames(command: string): string[] {
    return match(command)
      .with('dev', () => ['dev', 'start:dev', 'develop'])
      .with('start', () => ['start', 'serve', 'dev'])
      .with('build', () => ['build', 'build:prod', 'build:dev'])
      .with('test', () => ['test', 'test:unit', 'test:integration'])
      .with('lint', () => ['lint', 'lint:check'])
      .otherwise(() => [command]);
  }

  private scriptUsesDockerCompose(script: string): boolean {
    const dockerComposePatterns = [
      /docker-compose/,
      /docker compose/,
      /compose/
    ];

    return dockerComposePatterns.some(pattern => pattern.test(script));
  }

  private parseDockerComposeScript(script: string): {
    services?: string[];
    composeFile?: string;
  } {
    // Extract compose file if specified
    const composeFileMatch = script.match(/-f\s+([^\s]+)|--file\s+([^\s]+)/);
    const composeFile = composeFileMatch?.[1] || composeFileMatch?.[2] || 'docker-compose.yml';

    // Extract services if specified (services are usually at the end)
    const parts = script.split(/\s+/);
    const upIndex = parts.findIndex(part => part === 'up');

    if (upIndex !== -1) {
      // Services are typically after 'up' and any flags
      const afterUp = parts.slice(upIndex + 1);
      const services = afterUp.filter(part =>
        !part.startsWith('-') &&
        part !== 'up' &&
        part !== 'down' &&
        part !== 'build'
      );

      return {
        services: services.length > 0 ? services : undefined,
        composeFile
      };
    }

    return { composeFile };
  }
}
